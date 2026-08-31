"""
Biomarker Service Layer

Handles validation, conversion, and processing of manually entered biomarkers.
Integrates with biomarker_reference database and existing Claude service.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from app.services.biomarker_reference import (
    get_all_biomarkers,
    get_biomarker_info,
    validate_biomarker_input,
    convert_unit,
    calculate_status,
)
from app.services import supabase_service as svc
from app.services.entitlements import resolve_user_entitlements

logger = logging.getLogger("biomarker.service")


class ManualBiomarkerEntry:
    """Represents a manually entered biomarker value."""

    def __init__(
        self,
        biomarker_id: str,
        value: float,
        unit: str,
        date: Optional[datetime] = None,
    ):
        self.biomarker_id = biomarker_id
        self.value = value
        self.unit = unit
        self.date = date
        self.errors: List[str] = []
        self.is_valid = False
        self.status = "OPTIMAL"
        self.normalized_value = value
        self.normalized_unit = unit
        self.display_name = ""
        self.ref_low = None
        self.ref_high = None

    async def validate(self, *, sex: Optional[str] = None, age: Optional[int] = None) -> bool:
        """Validate the entry against biomarker rules.

        sex/age (from the user's profile) let calculate_status() prefer an
        age/sex-matched knowledge-base reference range over the flat
        BIOMARKER_DATABASE default when one exists. Optional — omitting them
        reproduces the prior behavior exactly.
        """
        # Check value is reasonable
        is_valid, error = validate_biomarker_input(
            self.biomarker_id, self.value, self.unit
        )
        if not is_valid:
            self.errors.append(error)
            self.is_valid = False
            return False

        # Get biomarker info
        info = get_biomarker_info(self.biomarker_id)
        if not info:
            self.errors.append(f"Unknown biomarker: {self.biomarker_id}")
            self.is_valid = False
            return False

        self.display_name = info["display_name"]

        # Calculate status
        self.status = await calculate_status(
            self.biomarker_id, self.value, self.unit, sex=sex, age=age
        )

        # Get reference ranges for the unit
        unit_data = info["units"].get(self.unit, {})
        self.ref_low = unit_data.get("min")
        self.ref_high = unit_data.get("max")

        self.is_valid = True
        return True

    def to_dict(self) -> Dict:
        """Convert to database-ready dictionary."""
        return {
            "name": self.display_name,
            "value": self.value,
            "unit": self.unit,
            "status": self.status,
            "ref_low": self.ref_low,
            "ref_high": self.ref_high,
            "category": get_biomarker_info(self.biomarker_id).get(
                "category", "Other"
            ),
        }


class BiomarkerService:
    """Service for manual biomarker entry processing."""

    def get_available_biomarkers(self) -> List[Dict]:
        """
        Get list of available biomarkers for dropdown selection.

        Returns:
            List of dicts with id, name, category, default_unit, alternative_units
        """
        return get_all_biomarkers()

    def get_biomarker_units(self, biomarker_id: str) -> List[str]:
        """Get all available units for a biomarker."""
        info = get_biomarker_info(biomarker_id)
        if not info:
            return []
        return list(info["units"].keys())

    async def validate_entries(
        self, entries: List[Dict], *, sex: Optional[str] = None, age: Optional[int] = None
    ) -> Tuple[List[ManualBiomarkerEntry], List[str]]:
        """
        Validate a list of manually entered biomarkers.

        Args:
            entries: List of dicts with biomarker_id, value, unit
            sex/age: from the user's profile, forwarded to calculate_status()
                so it can prefer a matching knowledge-base reference range.

        Returns:
            (valid_entries, error_messages)
        """
        valid_entries = []
        errors = []

        if not entries:
            errors.append("At least one biomarker entry is required")
            return [], errors

        if len(entries) > 50:
            errors.append("Maximum 50 biomarkers per upload")
            return [], errors

        for idx, entry in enumerate(entries):
            try:
                biomarker_entry = ManualBiomarkerEntry(
                    biomarker_id=entry.get("biomarker_id", "").strip(),
                    value=float(entry.get("value", 0)),
                    unit=entry.get("unit", "").strip(),
                    date=entry.get("date"),
                )

                if not await biomarker_entry.validate(sex=sex, age=age):
                    for error in biomarker_entry.errors:
                        errors.append(f"Entry {idx + 1}: {error}")
                else:
                    valid_entries.append(biomarker_entry)

            except (ValueError, KeyError, TypeError) as e:
                errors.append(f"Entry {idx + 1}: Invalid data format - {str(e)}")

        return valid_entries, errors

    async def create_upload_from_manual_entries(
        self,
        user_id: str,
        entries: List[ManualBiomarkerEntry],
        lab_name: Optional[str] = None,
        test_date: Optional[datetime] = None,
        notes: Optional[str] = None,
    ) -> Dict:
        """
        Create a lab_uploads record for a manual-entry submission.

        Stage 2B: this function used to ALSO insert the entries directly into the
        canonical `biomarkers` table, bypassing the quality-gate/confirmation
        boundary that every other B2C ingestion path (PDF/image/text) now goes
        through. It no longer does that — canonical biomarker persistence for
        manual entry now happens the same way as every other ingestion method:
        inside run_lab_analysis_pipeline(), gated on the quality-gate decision,
        via the shared save_biomarkers() chokepoint. This function only creates
        the upload record and returns the entries as candidate-shaped data for
        the caller to route through that same pipeline.

        Returns:
            Dict with upload_id and biomarkers list (same format as PDF analysis) —
            NOT YET PERSISTED to the biomarkers table; the caller is responsible
            for routing this through run_lab_analysis_pipeline(persist_biomarkers=True).
        """
        try:
            # Create upload record in database
            sb = svc._get_supabase()

            upload_data = {
                "user_id": user_id,
                "lab_name": lab_name or "Manual Entry",
                "extracted_text": notes or "",
                "analyze_prompt_version": "manual_v1",
                "status": "done",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "date_source": "user_provided" if test_date else "missing",
                "date_confidence": "high" if test_date else "low",
            }
            if test_date:
                upload_data["test_date"] = test_date.date().isoformat() if isinstance(test_date, datetime) else str(test_date)

            # Insert upload record
            upload_response = await svc._run(
                lambda: sb.table("lab_uploads").insert(upload_data).execute()
            )

            if not upload_response.data:
                raise Exception("Failed to create upload record")

            upload_id = upload_response.data[0]["id"]

            # Stage 2B: canonical biomarker persistence intentionally removed from
            # here — see docstring. The upload record above is still created
            # (it's needed as the analysis_id/upload_id target for candidates and
            # the pipeline call), but no biomarkers row is written until the
            # shared quality gate allows it.

            # Log the action
            await svc.write_audit_log(
                user_id=user_id,
                action="create",
                entity_type="lab_upload",
                entity_id=str(upload_id),
                new_value={
                    "source": "manual",
                    "biomarker_count": len(entries),
                    "lab_name": lab_name,
                },
            )

            logger.info(
                f"Created manual upload {upload_id} for user {user_id} with {len(entries)} biomarkers"
            )

            return {
                "upload_id": str(upload_id),
                "biomarkers": [e.to_dict() for e in entries],
                "source": "manual",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to create upload from manual entries: {e}")
            raise

    async def check_freemium_limit(self, user_id: str) -> Tuple[bool, str]:
        """
        Check if freemium user has exceeded their monthly manual entry limit.

        Returns:
            (can_proceed, message)
        """
        try:
            # Check user subscription status
            account = await svc.get_user_account(user_id)
            if not account:
                return False, "User account not found"

            # Check if user has active subscription
            is_premium = account.get("subscription_status") == "active"
            if is_premium:
                return True, "Premium user - unlimited manual entries"

            # Count manual entries from this month
            sb = svc._get_supabase()
            from datetime import datetime, timedelta

            month_start = (
                datetime.now(timezone.utc)
                .replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                .isoformat()
            )

            response = await svc._run(
                lambda: sb.table("lab_uploads")
                .select("id")
                .eq("user_id", user_id)
                .eq("analyze_prompt_version", "manual_v1")
                .gte("created_at", month_start)
                .execute()
            )

            manual_entries_this_month = len(response.data or [])
            freemium_limit = 3

            if manual_entries_this_month >= freemium_limit:
                remaining = freemium_limit - manual_entries_this_month
                return (
                    False,
                    f"You've used {manual_entries_this_month}/{freemium_limit} manual entries this month. Upgrade to Premium for unlimited.",
                )

            return True, f"You have {freemium_limit - manual_entries_this_month} manual entries remaining this month"

        except Exception as e:
            logger.error(f"Error checking freemium limit: {e}")
            # Be permissive on error - don't block user
            return True, "Unable to verify limit - proceeding anyway"

    async def check_freemium_biomarker_quota(self, user_id: str, entry_type: str) -> Tuple[bool, str, Optional[str]]:
        """
        Check if freemium user has exceeded their unified biomarker entry quota.
        
        Free users get 1 entry total (either PDF upload OR manual entry).
        Premium users get unlimited entries.
        
        Args:
            user_id: User ID to check
            entry_type: Either "pdf" or "manual" - the type of entry being attempted
        
        Returns:
            (can_proceed: bool, message: str, used_by: Optional[str])
            where used_by is None if quota available, or "pdf"/"manual" if quota already used
        """
        try:
            entitlements = await resolve_user_entitlements(user_id)
            if entitlements.get("is_premium"):
                return True, "Premium user - unlimited biomarker entries", None

            # Count all biomarker uploads (both PDF and manual) for this user
            sb = svc._get_supabase()
            
            response = await svc._run(
                lambda: sb.table("lab_uploads")
                .select("id, analyze_prompt_version, status")
                .eq("user_id", user_id)
                .neq("status", "failed")
                .execute()
            )

            uploads = response.data or []
            
            # Check if any upload exists
            if not uploads:
                # Quota available - user hasn't used any entry method yet
                return True, "Biomarker entry available", None
            
            # User already has an entry - determine what type
            first_upload = uploads[0]
            used_by_type = "manual" if first_upload.get("analyze_prompt_version") == "manual_v1" else "pdf"
            
            msg = f"You've already used your 1 free biomarker entry via {used_by_type} upload. Upgrade to Premium for unlimited entries."
            return False, msg, used_by_type

        except Exception as e:
            logger.error(f"Error checking freemium biomarker quota: {e}")
            # Be permissive on error - don't block user
            return True, "Unable to verify quota - proceeding anyway", None

    async def convert_to_standard_units(
        self, entries: List[ManualBiomarkerEntry], *, sex: Optional[str] = None, age: Optional[int] = None
    ) -> List[ManualBiomarkerEntry]:
        """
        Convert all biomarker values to standard units for Claude analysis.

        This ensures Claude service receives consistent units regardless of what user entered.

        Returns:
            List with values converted to default unit for each biomarker
        """
        converted = []

        for entry in entries:
            info = get_biomarker_info(entry.biomarker_id)
            if not info:
                converted.append(entry)
                continue

            # Get default unit (first in list)
            default_unit = list(info["units"].keys())[0]

            if entry.unit == default_unit:
                converted.append(entry)
            else:
                try:
                    converted_value = convert_unit(
                        entry.value,
                        entry.biomarker_id,
                        entry.unit,
                        default_unit,
                    )

                    new_entry = ManualBiomarkerEntry(
                        biomarker_id=entry.biomarker_id,
                        value=converted_value,
                        unit=default_unit,
                        date=entry.date,
                    )
                    await new_entry.validate(sex=sex, age=age)
                    converted.append(new_entry)

                    logger.info(
                        f"Converted {entry.biomarker_id}: {entry.value} {entry.unit} → {converted_value:.2f} {default_unit}"
                    )

                except Exception as e:
                    logger.warning(
                        f"Failed to convert {entry.biomarker_id}: {e}. Keeping original."
                    )
                    converted.append(entry)

        return converted

    def format_for_claude_analysis(self, entries: List[ManualBiomarkerEntry]) -> str:
        """
        Format validated biomarkers into text for Claude service analysis.

        Returns:
            Formatted text string for Claude protocol generation
        """
        if not entries:
            return ""

        lines = ["Lab Results (Manually Entered):"]
        lines.append("=" * 40)

        current_category = None
        for entry in entries:
            info = get_biomarker_info(entry.biomarker_id)
            category = info.get("category", "Other") if info else "Other"

            if category != current_category:
                lines.append(f"\n{category}:")
                current_category = category

            ref_range = ""
            if entry.ref_low is not None and entry.ref_high is not None:
                ref_range = f" (Normal: {entry.ref_low}-{entry.ref_high})"

            status_indicator = {
                "OPTIMAL": "✓",
                "BORDERLINE": "→",
                "DEFICIENT": "↓",
                "ELEVATED": "↑",
            }.get(entry.status, "?")

            lines.append(
                f"  {status_indicator} {entry.display_name}: {entry.value} {entry.unit}{ref_range}"
            )

        return "\n".join(lines)
