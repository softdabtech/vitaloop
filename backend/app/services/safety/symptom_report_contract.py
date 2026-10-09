"""Shared symptom-to-report safety contract."""

from __future__ import annotations

from typing import Any, Dict, Optional


REPORT_SAFETY_RANK = {
    "routine": 0,
    "insufficient_data": 1,
    "medical_review": 2,
    "high": 3,
    "immediate": 4,
}

_SYMPTOM_TO_REPORT = {
    "routine": "routine",
    "insufficient_data": "insufficient_data",
    "provider_outage": "insufficient_data",
    "clinician_review": "medical_review",
    "urgent_24h": "high",
    "emergency": "immediate",
}

_REPORT_ALIASES = {
    "routine": "routine",
    "insufficient": "insufficient_data",
    "insufficient_data": "insufficient_data",
    "medical_review": "medical_review",
    "doctor": "medical_review",
    "urgent": "high",
    "urgent_review": "high",
    "high": "high",
    "critical": "immediate",
    "immediate": "immediate",
}


def normalize_symptom_level(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    return _SYMPTOM_TO_REPORT.get(normalized, "insufficient_data")


def normalize_report_level(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    return _REPORT_ALIASES.get(normalized, "routine")


def symptom_snapshot_level(snapshot: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(snapshot, dict):
        return None
    safety = snapshot.get("safety")
    if not isinstance(safety, dict):
        return None
    return normalize_symptom_level(safety.get("final_level"))


def merge_report_levels(*levels: Any) -> str:
    normalized = [normalize_report_level(level) for level in levels if level is not None]
    return max(normalized or ["routine"], key=lambda level: REPORT_SAFETY_RANK[level])


def effective_report_safety(
    report_safety: Optional[Dict[str, Any]] = None,
    symptom_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Return a normalized report safety result without allowing downgrades."""
    result = dict(report_safety) if isinstance(report_safety, dict) else {}
    report_level = normalize_report_level(result.get("risk_level"))
    symptom_level = symptom_snapshot_level(symptom_snapshot)
    effective_level = merge_report_levels(report_level, symptom_level)

    result["risk_level"] = effective_level
    result["safety_level"] = effective_level
    result["urgent_review_required"] = bool(
        result.get("urgent_review_required")
        or REPORT_SAFETY_RANK[effective_level] >= REPORT_SAFETY_RANK["high"]
    )
    result["doctor_discussion_required"] = bool(
        result.get("doctor_discussion_required")
        or REPORT_SAFETY_RANK[effective_level] >= REPORT_SAFETY_RANK["medical_review"]
    )
    return result