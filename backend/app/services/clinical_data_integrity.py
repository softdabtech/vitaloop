from __future__ import annotations

from typing import Any, Dict, List


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
    return raw.replace("μ", "µ")


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

        marker_issues: List[str] = []
        unit_family = _KNOWN_UNIT_FAMILIES.get(unit) or _KNOWN_UNIT_FAMILIES.get(unit.lower())
        if not unit_family:
            marker_issues.append("unknown_unit")
            issues.append({"key": "unknown_unit", "severity": "medium", "marker": name, "unit": unit})

        if value is None:
            marker_issues.append("missing_numeric_value")
            issues.append({"key": "missing_numeric_value", "severity": "high", "marker": name})
        else:
            plausible = _PLAUSIBLE_LIMITS.get(canonical)
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
