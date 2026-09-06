from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.partners.results import PartnerResultIngestRequest
from app.services.lab_adapters.base import BaseLabAdapter
from app.services.lab_normalization.biomarker_mapping import infer_category, to_canonical_name
from app.services.lab_normalization.canonical import CanonicalBiomarker, CanonicalLabResult
from app.services.lab_normalization.unit_conversion import normalize_value_unit
from app.services.biomarker_reference import BIOMARKER_DATABASE


class SmartlabAdapter(BaseLabAdapter):
    name = "smartlab"

    def to_canonical(self, request: PartnerResultIngestRequest, raw_payload: Dict[str, Any]) -> CanonicalLabResult:
        rows: List[Dict[str, Any]] = []

        if isinstance(raw_payload.get("biomarkers"), list):
            rows = [r for r in raw_payload.get("biomarkers", []) if isinstance(r, dict)]
        elif isinstance(raw_payload.get("results"), list):
            rows = [r for r in raw_payload.get("results", []) if isinstance(r, dict)]

        biomarkers: List[CanonicalBiomarker] = []
        for row in rows:
            name = str(row.get("name") or row.get("marker") or "").strip()
            if not name:
                continue
            raw_value = row.get("value")

            # Extract inequality operator and numeric value (FIX 1: Inequality Preservation)
            qualifier, numeric_value, raw_value_str = _extract_inequality_and_value(raw_value)

            # If no numeric value extracted, skip this row
            if numeric_value is None:
                continue

            value = numeric_value
            unit = str(row.get("unit") or "unit")
            ref_low = _to_float_or_none(row.get("ref_low") or row.get("reference_low"))
            ref_high = _to_float_or_none(row.get("ref_high") or row.get("reference_high"))
            value, unit = normalize_value_unit(value, unit)

            canonical_name = to_canonical_name(name)

            # Check unit-marker compatibility (FIX 2: Unit-Marker Compatibility)
            unit_compatibility_issue = _check_unit_marker_compatibility(canonical_name, unit)

            status = str(row.get("status") or _status_by_range(value, ref_low, ref_high)).upper()

            biomarkers.append(
                CanonicalBiomarker(
                    canonical_name=canonical_name,
                    display_name=name,
                    value=value,
                    unit=unit,
                    ref_low=ref_low,
                    ref_high=ref_high,
                    status=status,
                    category=infer_category(canonical_name),
                    confidence=1.0,
                    raw_value=raw_value_str,
                    value_qualifier=qualifier,
                    unit_compatibility_issue=unit_compatibility_issue,
                )
            )

        return CanonicalLabResult(
            partner_slug=request.partner_slug,
            external_patient_id=request.external_patient_id,
            external_order_id=request.external_order_id,
            external_result_id=request.external_result_id,
            lab_name=request.lab_name or self.name,
            result_date=request.result_date,
            biomarkers=biomarkers,
            metadata={"adapter": self.name, "raw_keys": sorted(raw_payload.keys())},
        )


def _extract_inequality_and_value(raw_value: Any) -> Tuple[Optional[str], Optional[float], str]:
    """Extract inequality operator and numeric value from strings like '<5' or '>=100'.

    Returns: (qualifier, numeric_value, raw_string)
      qualifier: '<', '>', '<=', '>=', '<>', or None if no operator
      numeric_value: parsed float value, or None if unparseable
      raw_string: original string representation
    """
    raw_str = str(raw_value or "").strip()
    if not raw_str:
        return None, None, raw_str

    # Pattern: optional operator, then numeric value
    # Operators: <, >, <=, >=, =<, =>, <>, ≤, ≥
    match = re.match(r'^(<=|>=|=<|=>|<>|≤|≥|<|>)?(.*)$', raw_str)
    if not match:
        return None, None, raw_str

    operator_raw = match.group(1)
    value_str = match.group(2).strip()

    # Normalize operator symbols
    qualifier = None
    if operator_raw:
        qualifier = operator_raw.replace('≤', '<=').replace('≥', '>=').replace('=<', '<=').replace('=>', '>=')

    # Try to parse numeric value
    try:
        numeric_value = float(value_str)
        return qualifier, numeric_value, raw_str
    except (TypeError, ValueError):
        return qualifier, None, raw_str


def _check_unit_marker_compatibility(canonical_marker: str, unit: str) -> Optional[str]:
    """Check if unit is valid for the given biomarker.

    Returns None if compatible, or error reason if incompatible.
    Unknown markers are allowed (not in database).
    """
    # Remove 'canonical_' prefix if present
    marker_key = canonical_marker.removeprefix('canonical_')

    # Unknown markers are allowed (not in database)
    if marker_key not in BIOMARKER_DATABASE:
        return None

    # Check if unit is in the marker's valid units
    valid_units = BIOMARKER_DATABASE[marker_key].get("units", {})
    if unit not in valid_units:
        return f"unit_not_valid_for_marker:{unit}"

    return None


def _to_float_or_none(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _status_by_range(value: float, ref_low: float | None, ref_high: float | None) -> str:
    if ref_low is not None and value < ref_low:
        return "DEFICIENT"
    if ref_high is not None and value > ref_high:
        return "ELEVATED"
    return "OPTIMAL"
