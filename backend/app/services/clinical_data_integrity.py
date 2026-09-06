from __future__ import annotations

import re
from typing import Any, Dict, List

from app.services.biomarker_reference import BIOMARKER_DATABASE


CLINICAL_DATA_INTEGRITY_VERSION = "clinical_data_integrity_v1"

_KNOWN_UNIT_FAMILIES = {
    "%": "fraction",
    "fL": "volume",
    "fl": "volume",
    "g/dL": "mass_concentration",
    "g/L": "mass_concentration",
    "mg/dL": "mass_concentration",
    "ng/mL": "mass_concentration",
    "ug/L": "mass_concentration",
    "mcg/L": "mass_concentration",
    "mmol/L": "molar_concentration",
    "U/L": "enzyme_activity",
    "IU/L": "enzyme_activity",
    "uIU/mL": "hormone_concentration",
    "mIU/L": "hormone_concentration",
    "pg/mL": "mass_concentration",
    "pg": "mass",
    "x10^3/uL": "cell_count",
    "x10^3/µL": "cell_count",
    "x10^9/L": "cell_count",
    "x10^6/uL": "cell_count",
    "x10^6/µL": "cell_count",
    "x10^12/L": "cell_count",
    "ng/dL": "mass_concentration",
    "pmol/L": "molar_concentration",
    "µmol/L": "molar_concentration",
    "umol/L": "molar_concentration",
    "µg/dL": "mass_concentration",
    "ug/dL": "mass_concentration",
    "µg/L": "mass_concentration",
    "mEq/L": "electrolyte_concentration",
    "meq/L": "electrolyte_concentration",
    "mg/L": "mass_concentration",
    "L/L": "fraction",
    "mmol/mol": "ratio",
    "µkat/L": "enzyme_activity",
    "ukat/L": "enzyme_activity",
    "mL/min/1.73m²": "filtration_rate",
    "mL/min/1.73m2": "filtration_rate",
    "mm/h": "sedimentation_rate",
}

_UNIT_ALIASES = {
    "г/л": "g/L",
    "г/дл": "g/dL",
    "мг/дл": "mg/dL",
    "ммоль/л": "mmol/L",
    "нг/мл": "ng/mL",
    "мкг/л": "ug/L",
    "од/л": "U/L",
    "мо/л": "IU/L",
    "фл": "fL",
    "пг": "pg",
    "мм/год": "mm/h",
    "10^9/л": "x10^9/L",
    "10^12/л": "x10^12/L",
}

_REFERENCE_UNIT_FAMILIES = {
    unit: _KNOWN_UNIT_FAMILIES.get(unit) or _KNOWN_UNIT_FAMILIES.get(unit.lower()) or "reference_defined"
    for biomarker in BIOMARKER_DATABASE.values()
    for unit in (biomarker.get("units") or {})
}

_PLAUSIBLE_LIMITS = {
    "canonical_glucose": (10, 1500),
    "canonical_hba1c": (2, 20),
    "canonical_ferritin": (0, 5000),
    "canonical_vitamin_d_25_oh": (0, 250),
    "canonical_hemoglobin": (1, 30),
    "canonical_tsh": (0, 300),
    "canonical_alt": (0, 5000),
    "canonical_ast": (0, 5000),
    "canonical_creatinine": (0, 50),
    "canonical_mean_reticulocyte_volume": (20, 250),
    "canonical_mean_spherical_cell_volume": (20, 250),
}


def _unit_key(value: Any) -> str:
    raw = str(value or "").strip()
    normalized = (
        raw.replace("μ", "µ")
        .replace("㎍", "µg")
        .replace("㎎", "mg")
        .replace("⁄", "/")
    )
    return _UNIT_ALIASES.get(normalized.lower(), normalized)


def _plausible_limits(canonical: str, unit: str) -> tuple[float, float] | None:
    unit_key = _unit_lookup_key(unit).lower()
    if canonical == "canonical_hemoglobin":
        return (10, 300) if unit_key == "g/l" else (1, 30)
    if canonical == "canonical_glucose":
        return (0.5, 83.3) if unit_key == "mmol/l" else (10, 1500)
    if canonical == "canonical_creatinine" and unit_key in {"µmol/l", "umol/l"}:
        return (0, 4500)
    return _PLAUSIBLE_LIMITS.get(canonical)


def _unit_lookup_key(value: Any) -> str:
    raw = _unit_key(value)
    return re.sub(r"\s+", "", raw).replace("²", "2")


def _known_unit_family(unit: str) -> str | None:
    lookup = _unit_lookup_key(unit)
    candidates = {**_KNOWN_UNIT_FAMILIES, **_REFERENCE_UNIT_FAMILIES}
    for key, family in candidates.items():
        if lookup == _unit_lookup_key(key):
            return family
    lowered = lookup.lower()
    for key, family in candidates.items():
        if lowered == _unit_lookup_key(key).lower():
            return family
    return None


def _to_float(value: Any) -> float | None:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _profile_age(profile: Dict[str, Any] | None) -> float | None:
    payload = profile if isinstance(profile, dict) else {}
    for key in ("age", "age_years"):
        age = _to_float(payload.get(key))
        if age is not None:
            return age
    return None


def _determine_evaluation_status(
    canonical: str,
    value: float | None,
    unit: str,
    plausible_range: tuple[float, float] | None,
    has_value_qualifier: bool,
    unit_compatibility_issue: str | None,
) -> tuple[str, List[str]]:
    """Determine if a marker can be clinically evaluated and why.

    Returns: (status, blocking_issues)
      status: 'EVALUABLE', 'NEEDS_CONFIRMATION', 'UNEVALUATED'
      blocking_issues: reasons why it cannot be safely evaluated
    """
    blocking_issues: List[str] = []

    # Check 1: Unit compatibility (FIX 2)
    if unit_compatibility_issue:
        blocking_issues.append(f"incompatible_unit:{unit_compatibility_issue}")

    # Check 2: Value has inequality qualifier (FIX 1)
    if has_value_qualifier and value is not None:
        # Inequality-qualified values need special handling by clinical engine
        blocking_issues.append("value_has_inequality_qualifier")

    # Check 3: Physiologically implausible (FIX 3)
    if value is not None and plausible_range and not (plausible_range[0] <= value <= plausible_range[1]):
        blocking_issues.append("physiologically_implausible_value")

    # Determine status based on issues
    if blocking_issues:
        # If unit is incompatible or value is impossible, mark UNEVALUATED
        if any("incompatible_unit" in issue for issue in blocking_issues):
            return "UNEVALUATED", blocking_issues
        if any("physiologically_implausible" in issue for issue in blocking_issues):
            return "NEEDS_CONFIRMATION", blocking_issues
        if any("inequality_qualifier" in issue for issue in blocking_issues):
            # Inequality qualifiers may still be evaluable by safety engine
            return "EVALUABLE", blocking_issues

    return "EVALUABLE", []


def _profile_completeness(profile: Dict[str, Any] | None) -> Dict[str, Any]:
    payload = profile if isinstance(profile, dict) else {}
    required = ("age", "sex", "height_cm", "weight_kg")
    missing = [key for key in required if payload.get(key) in (None, "", [], {})]
    return {
        "required_fields": list(required),
        "missing_fields": missing,
        "complete": not missing,
    }


def validate_clinical_data_integrity(
    *,
    biomarkers: List[Dict[str, Any]],
    profile: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Validate normalized biomarkers before KB/reasoning.

    This layer does not diagnose and does not replace lab reference ranges. It
    records whether values, units, references, and profile context are strong
    enough for downstream educational interpretation.
    """

    issues: List[Dict[str, Any]] = []
    marker_summaries: List[Dict[str, Any]] = []
    duplicate_keys: Dict[str, int] = {}

    for item in biomarkers or []:
        canonical = str(item.get("canonical_name") or item.get("name") or "").strip()
        name = str(item.get("name") or canonical or "Unknown marker").strip()
        value = _to_float(item.get("value"))
        unit = _unit_key(item.get("unit"))
        ref_low = _to_float(item.get("ref_low"))
        ref_high = _to_float(item.get("ref_high"))
        reference_range = item.get("reference_range")
        duplicate_keys[canonical or name.lower()] = duplicate_keys.get(canonical or name.lower(), 0) + 1

        # NEW: Extract inequality qualifier and unit compatibility issue (FIX 1, FIX 2)
        value_qualifier = item.get("value_qualifier")
        unit_compatibility_issue = item.get("unit_compatibility_issue")

        marker_issues: List[str] = []
        unit_family = _known_unit_family(unit)
        if not unit_family:
            marker_issues.append("unknown_unit")
            issues.append({"key": "unknown_unit", "severity": "medium", "marker": name, "unit": unit})

        # NEW: Add unit compatibility issue (FIX 2)
        if unit_compatibility_issue:
            marker_issues.append("unit_marker_incompatible")
            issues.append(
                {
                    "key": "unit_marker_incompatible",
                    "severity": "high",
                    "marker": name,
                    "unit": unit,
                    "reason": unit_compatibility_issue,
                }
            )

        # NEW: Add inequality qualifier issue (FIX 1)
        if value_qualifier:
            marker_issues.append("value_has_qualifier")
            issues.append(
                {
                    "key": "value_has_qualifier",
                    "severity": "medium",
                    "marker": name,
                    "qualifier": value_qualifier,
                }
            )

        if value is None:
            marker_issues.append("missing_numeric_value")
            issues.append({"key": "missing_numeric_value", "severity": "high", "marker": name})
        else:
            plausible = _plausible_limits(canonical, unit)
            if plausible and not (plausible[0] <= value <= plausible[1]):
                marker_issues.append("physiologically_implausible_value")
                issues.append(
                    {
                        "key": "physiologically_implausible_value",
                        "severity": "high",
                        "marker": name,
                        "value": value,
                        "expected_range": plausible,
                    }
                )

        if ref_low is None and ref_high is None and not reference_range:
            marker_issues.append("missing_lab_reference_range")
            issues.append({"key": "missing_lab_reference_range", "severity": "medium", "marker": name})
        elif ref_low is not None and ref_high is not None and ref_low >= ref_high:
            marker_issues.append("invalid_lab_reference_range")
            issues.append(
                {
                    "key": "invalid_lab_reference_range",
                    "severity": "high",
                    "marker": name,
                    "ref_low": ref_low,
                    "ref_high": ref_high,
                }
            )

        # NEW: Determine evaluation status (FIX 3)
        plausible = _plausible_limits(canonical, unit)
        evaluation_status, blocking_issues = _determine_evaluation_status(
            canonical=canonical,
            value=value,
            unit=unit,
            plausible_range=plausible,
            has_value_qualifier=bool(value_qualifier),
            unit_compatibility_issue=unit_compatibility_issue,
        )

        marker_summaries.append(
            {
                "name": name,
                "canonical_name": canonical,
                "value": value,
                "unit": unit,
                "normalized_value": value,
                "normalized_unit": unit,
                "lab_ref_low": ref_low,
                "lab_ref_high": ref_high,
                "lab_reference_range": reference_range,
                "reference_source": "lab_provided" if (ref_low is not None or ref_high is not None or reference_range) else "missing",
                "unit_family": unit_family or "unknown",
                "issues": marker_issues,
                "evaluation_status": evaluation_status,
                "blocking_issues": blocking_issues,
                "value_qualifier": value_qualifier,
            }
        )

    for key, count in duplicate_keys.items():
        if key and count > 1:
            issues.append({"key": "duplicate_marker", "severity": "medium", "marker": key, "count": count})

    profile_status = _profile_completeness(profile)
    age = _profile_age(profile)
    if not profile_status["complete"]:
        issues.append(
            {
                "key": "profile_context_incomplete",
                "severity": "medium",
                "missing_fields": profile_status["missing_fields"],
            }
        )
    if age is not None and age < 18:
        issues.append({"key": "pediatric_context", "severity": "medium", "age": age})

    high_count = len([item for item in issues if item.get("severity") == "high"])
    medium_count = len([item for item in issues if item.get("severity") == "medium"])
    status = "pass"
    if high_count:
        status = "review_required"
    elif medium_count:
        status = "pass_with_warnings"

    return {
        "version": CLINICAL_DATA_INTEGRITY_VERSION,
        "status": status,
        "issues": issues,
        "summary": {
            "marker_count": len(biomarkers or []),
            "high_issue_count": high_count,
            "medium_issue_count": medium_count,
            "profile_complete": profile_status["complete"],
            "pediatric_context": age is not None and age < 18,
        },
        "profile": profile_status,
        "markers": marker_summaries,
    }
