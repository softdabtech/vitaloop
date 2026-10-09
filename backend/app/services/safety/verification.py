from __future__ import annotations

import math
from typing import Any, Dict

from app.services.clinical_engine.units import convert_value, normalize_unit


REFERENCE_DEPENDENT_STATUSES = frozenset({"UNKNOWN", "UNEVALUATED", "NEEDS_CONFIRMATION"})

_CANONICAL_ALIASES = {
    "anc": "anc",
    "neutrophils": "anc",
    "absolute neutrophils": "anc",
    "absolute neutrophil count": "anc",
    "calcium": "calcium",
    "ca": "calcium",
    "glucose": "glucose",
    "hba1c": "hba1c",
    "hemoglobin": "hemoglobin",
    "haemoglobin": "hemoglobin",
    "hgb": "hemoglobin",
    "hb": "hemoglobin",
    "ldl": "ldl",
    "platelets": "platelets",
    "platelet": "platelets",
    "plt": "platelets",
    "potassium": "potassium",
    "k": "potassium",
    "ast": "ast",
    "alt": "alt",
    "vitamin d": "vitamin_d",
    "vitamin_d": "vitamin_d",
}

_ABSOLUTE_EXPECTED_UNITS = {
    "anc": "10^9/L",
    "calcium": "mmol/L",
    "glucose": "mg/dL",
    "hba1c": "%",
    "hemoglobin": "g/dL",
    "ldl": "mg/dL",
    "platelets": "10^9/L",
    "potassium": "mmol/L",
    "ast": "U/L",
    "alt": "U/L",
    "vitamin_d": "ng/mL",
}

_ABSOLUTE_EVENT_KEYS = frozenset(
    {
        "dangerous_glucose",
        "dangerous_hba1c",
        "dangerous_alt",
        "dangerous_ast",
        "dangerous_ldl",
        "severe_vitamin_d",
        "critical_absolute_neutrophils",
        "critical_potassium",
        "critical_platelets",
        "critical_hemoglobin",
    }
)


def canonical_marker_key(marker: Dict[str, Any]) -> str | None:
    """Return an exact allowlisted identity; never infer from substrings."""
    raw = marker.get("canonical_name") or marker.get("name")
    normalized = str(raw or "").strip().lower().replace("_", " ")
    return _CANONICAL_ALIASES.get(normalized)


def verified_absolute_value(marker: Dict[str, Any]) -> tuple[str, float] | None:
    """Verify identity, numeric value, and a compatible normalized unit."""
    canonical = canonical_marker_key(marker)
    if canonical is None:
        return None
    try:
        value = float(marker.get("value"))
    except (TypeError, ValueError):
        return None
    if not math.isfinite(value):
        return None
    unit = str(marker.get("unit") or "").strip()
    expected_unit = _ABSOLUTE_EXPECTED_UNITS.get(canonical)
    if expected_unit is None:
        return None
    if not normalize_unit(unit):
        return None
    normalized_unit = normalize_unit(unit)
    if canonical in {"anc", "platelets"} and normalized_unit in {"10^9/l", "x10^9/l"}:
        converted = value
    else:
        converted = convert_value(canonical, value, unit, expected_unit)
    if converted is None or not math.isfinite(converted):
        return None
    return canonical, converted


def suppress_unverified_safety_claims(safety_result: Any) -> Any:
    """Remove unsafe persisted biomarker claims without mutating the row."""
    if not isinstance(safety_result, dict):
        return safety_result

    sanitized = dict(safety_result)
    for field in ("safety_events", "warnings", "blocked_items"):
        values = sanitized.get(field)
        if not isinstance(values, list):
            continue
        kept = []
        for item in values:
            if not isinstance(item, dict):
                kept.append(item)
                continue
            marker = item.get("item")
            status = str(marker.get("status") or "").strip().upper() if isinstance(marker, dict) else ""
            key = str(item.get("key") or "")
            if status in REFERENCE_DEPENDENT_STATUSES:
                if key not in _ABSOLUTE_EVENT_KEYS or not isinstance(marker, dict) or verified_absolute_value(marker) is None:
                    continue
            kept.append(item)
        sanitized[field] = kept

    events = sanitized.get("safety_events")
    if isinstance(events, list):
        critical = any(str(event.get("severity")) == "critical" for event in events if isinstance(event, dict))
        has_events = bool(events)
        sanitized["urgent_review_required"] = critical
        if not has_events and sanitized.get("risk_level") in {"urgent_review", "medical_review"}:
            sanitized["risk_level"] = "routine"
            sanitized["prominent_user_warning"] = None
    return sanitized