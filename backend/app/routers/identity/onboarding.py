import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.services.profile_requirements import missing_required_profile_fields
from app.services.symptom_snapshot import load_latest_eligible_symptom_snapshot

router = APIRouter(prefix="/auth/onboarding", tags=["onboarding"])
logger = logging.getLogger(__name__)

_CRM_ROLES = {"super_admin", "admin", "org_admin", "org_owner", "client_admin", "manager", "practitioner"}
_PROFILE_NOT_FOUND = "Profile not found"


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes"}
    if isinstance(value, (int, float)):
        return value != 0
    return False


def _missing_profile_basics(profile: Dict[str, Any]) -> list[str]:
    """Return invalid or missing required adult B2C profile fields.

    This is the server-side source of truth for cabinet access. A stale or
    manually-set ``onboarding_complete`` flag must never bypass these checks.
    """
    return missing_required_profile_fields(profile)


def _has_profile_basics(profile: Dict[str, Any]) -> bool:
    return not _missing_profile_basics(profile)


def _has_location(location: Dict[str, Any]) -> bool:
    return bool(
        location.get("city")
        or location.get("state")
        or location.get("country")
        or location.get("district")
    )


def _normalize_role(*values: Any) -> str:
    for value in values:
        role = str(value or "").strip().lower()
        if not role:
            continue
        if role in _CRM_ROLES or role == "end_user":
            return role
    return "end_user"


async def _has_user_row(table: str, user_id: str, *, status: Optional[str] = None) -> bool:
    try:
        sb = svc._get_supabase()
        query = (
            sb.table(table)
            .select("id")
            .eq("user_id", user_id)
        )
        if status is not None:
            query = query.eq("status", status)
        resp = await svc._run(lambda: query.limit(1).execute())
        return bool(resp.data)
    except Exception:
        return False


async def _safe_optional_lookup(label: str, user_id: str, coro, default):
    try:
        return await coro
    except Exception as exc:
        logger.warning(
            "onboarding_optional_lookup_failed label=%s user_id=%s error=%r",
            label,
            user_id,
            exc,
        )
        return default


@router.get("/state")
async def get_onboarding_state(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")

    account = await _safe_optional_lookup("user_account", user_id, svc.get_user_account(user_id), {})
    profile = await _safe_optional_lookup("user_profile", user_id, svc.get_user_profile(user_id), {})
    location = await _safe_optional_lookup("user_location", user_id, svc.get_user_location(user_id), {}) or {}

    role = _normalize_role(account.get("global_role"), current_user.get("global_role"), current_user.get("role"))
    onboarding_completed = _as_bool(profile.get("onboarding_complete") or current_user.get("onboarding_completed"))
    missing_profile_fields = _missing_profile_basics(profile)
    has_profile_basics = not missing_profile_fields

    # The boolean flag records that the flow was submitted, but valid required
    # profile data is what makes the account setup safe to use. Both are needed.
    account_setup_complete = onboarding_completed and has_profile_basics

    # Only end-user role is constrained by account setup.
    requires_onboarding = role == "end_user" and not account_setup_complete

    if role != "end_user":
        return {
            "role": role,
            "requires_onboarding": False,
            "current_stage": "complete",
            "completed": True,
            "checklist": {
                "profile_basics": True,
                "location": True,
                "complaints": True,
                "first_upload": True,
                "questionnaire_completed": True,
                "onboarding_complete": True,
                "account_setup_complete": True,
                "first_health_loop_started": True,
                "first_health_loop_complete": True,
            },
            "account_setup_complete": True,
            "first_health_loop_started": True,
            "first_health_loop_complete": True,
        }

    has_location = _has_location(location)
    has_complaints = await _has_user_row("recurring_complaints", user_id)
    has_uploads = await _has_user_row("lab_uploads", user_id)
    has_questionnaire = bool(await _safe_optional_lookup(
        "canonical_symptom_snapshot",
        user_id,
        load_latest_eligible_symptom_snapshot(user_id),
        None,
    ))
    first_health_loop_started = bool(has_complaints or has_uploads or has_questionnaire)
    first_health_loop_complete = bool(has_uploads and has_questionnaire)

    await svc.write_audit_log(
        user_id=user_id,
        action="read",
        entity_type="onboarding_state",
        entity_id=user_id,
        new_value={
            "scope": "medical",
            "profile_basics": has_profile_basics,
            "location": has_location,
            "complaints": has_complaints,
            "first_upload": has_uploads,
            "questionnaire_completed": has_questionnaire,
        },
    )

    if not has_profile_basics:
        current_stage = "profile"
    elif not has_location:
        current_stage = "location"
    elif not has_complaints:
        current_stage = "complaints"
    elif not has_uploads:
        current_stage = "upload"
    elif not has_questionnaire:
        current_stage = "questionnaire"
    else:
        current_stage = "review"

    return {
        "role": role,
        "requires_onboarding": requires_onboarding,
        "current_stage": "complete" if not requires_onboarding else current_stage,
        "completed": not requires_onboarding,
        "checklist": {
            "profile_basics": has_profile_basics,
            "location": has_location,
            "complaints": has_complaints,
            "first_upload": has_uploads,
            "questionnaire_completed": has_questionnaire,
            "onboarding_complete": onboarding_completed,
            "account_setup_complete": account_setup_complete,
            "first_health_loop_started": first_health_loop_started,
            "first_health_loop_complete": first_health_loop_complete,
        },
        "account_setup_complete": account_setup_complete,
        "first_health_loop_started": first_health_loop_started,
        "first_health_loop_complete": first_health_loop_complete,
        "missing_required_profile_fields": missing_profile_fields,
    }


@router.post("/complete")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    profile = await svc.get_user_profile(user_id)

    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_PROFILE_NOT_FOUND)

    missing = _missing_profile_basics(profile)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "Complete the required profile fields before entering the cabinet.",
                "code": "REQUIRED_PROFILE_INCOMPLETE",
                "missing_fields": missing,
            },
        )

    updated = await svc.upsert_user_profile(user_id, {"onboarding_complete": True})
    return {"ok": True, "profile": updated}


@router.post("/skip")
async def skip_onboarding(current_user: dict = Depends(get_current_user)):
    """Skip only optional onboarding steps after required profile completion."""
    user_id = current_user.get("sub")
    profile = await svc.get_user_profile(user_id) or {}
    missing = _missing_profile_basics(profile)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "Age, sex, height, and weight cannot be skipped.",
                "code": "REQUIRED_PROFILE_INCOMPLETE",
                "missing_fields": missing,
            },
        )
    updated = await svc.upsert_user_profile(user_id, {"onboarding_complete": True})
    return {"ok": True, "profile": updated, "skipped": True}
