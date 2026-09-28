"""Deterministic safety merge for the structured symptom assessment.

The external provider may increase urgency, never reduce an existing internal
VITALOOP safety decision. Missing provider data is not equivalent to self-care.
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class SymptomSafetyLevel(str, Enum):
    EMERGENCY = "emergency"
    URGENT_24H = "urgent_24h"
    CLINICIAN_REVIEW = "clinician_review"
    INSUFFICIENT_DATA = "insufficient_data"
    ROUTINE = "routine"


_SAFETY_RANK = {
    SymptomSafetyLevel.ROUTINE: 0,
    SymptomSafetyLevel.INSUFFICIENT_DATA: 1,
    SymptomSafetyLevel.CLINICIAN_REVIEW: 2,
    SymptomSafetyLevel.URGENT_24H: 3,
    SymptomSafetyLevel.EMERGENCY: 4,
}

_PROVIDER_TRIAGE_MAP = {
    "emergency_ambulance": SymptomSafetyLevel.EMERGENCY,
    "emergency": SymptomSafetyLevel.EMERGENCY,
    "consultation_24": SymptomSafetyLevel.URGENT_24H,
    "consultation": SymptomSafetyLevel.CLINICIAN_REVIEW,
    "self_care": SymptomSafetyLevel.ROUTINE,
}

_PROVIDER_SERIOUSNESS_MAP = {
    "serious": SymptomSafetyLevel.CLINICIAN_REVIEW,
    "emergency": SymptomSafetyLevel.EMERGENCY,
    "emergency_ambulance": SymptomSafetyLevel.EMERGENCY,
}

_INTERNAL_LEVEL_ALIASES = {
    "critical_now": SymptomSafetyLevel.EMERGENCY,
    "immediate": SymptomSafetyLevel.EMERGENCY,
    "urgent": SymptomSafetyLevel.EMERGENCY,
    "urgent_review": SymptomSafetyLevel.EMERGENCY,
    "high": SymptomSafetyLevel.CLINICIAN_REVIEW,
    "medical_review": SymptomSafetyLevel.CLINICIAN_REVIEW,
    "doctor": SymptomSafetyLevel.CLINICIAN_REVIEW,
    "routine": SymptomSafetyLevel.ROUTINE,
}


class SymptomSafetyDecision(BaseModel):
    internal_level: SymptomSafetyLevel
    provider_level: SymptomSafetyLevel
    final_level: SymptomSafetyLevel
    escalated_by_provider: bool
    provider_available: bool
    interrupt: bool
    provider_triage_level: str | None = None
    provider_root_cause: str | None = None
    provider_serious_observation_ids: list[str] = Field(default_factory=list)
    reason_code: str


def normalize_internal_safety_level(value: Any) -> SymptomSafetyLevel:
    if isinstance(value, SymptomSafetyLevel):
        return value
    normalized = str(value or "").strip().lower()
    try:
        return SymptomSafetyLevel(normalized)
    except ValueError:
        return _INTERNAL_LEVEL_ALIASES.get(normalized, SymptomSafetyLevel.INSUFFICIENT_DATA)


def map_provider_triage(value: Any) -> SymptomSafetyLevel:
    normalized = str(value or "").strip().lower()
    return _PROVIDER_TRIAGE_MAP.get(normalized, SymptomSafetyLevel.INSUFFICIENT_DATA)


def _serious_observation_value(item: Any, field: str) -> Any:
    if isinstance(item, dict):
        return item.get(field)
    return getattr(item, field, None)


def resolve_provider_safety(
    *,
    triage_level: Any,
    serious_observations: list[Any] | None = None,
    root_cause: Any = None,
) -> tuple[SymptomSafetyLevel, bool, list[str], str]:
    """Resolve provider urgency using triage plus typed serious observations."""
    normalized_triage = str(triage_level or "").strip().lower()
    provider_available = normalized_triage in _PROVIDER_TRIAGE_MAP
    level = map_provider_triage(normalized_triage)
    serious_ids: list[str] = []

    for observation in serious_observations or []:
        seriousness = str(_serious_observation_value(observation, "seriousness") or "").lower()
        observation_level = _PROVIDER_SERIOUSNESS_MAP.get(seriousness)
        if observation_level is None:
            continue
        observation_id = str(_serious_observation_value(observation, "id") or "").strip()
        if observation_id:
            serious_ids.append(observation_id)
        if _SAFETY_RANK[observation_level] > _SAFETY_RANK[level]:
            level = observation_level

    normalized_root_cause = str(root_cause or "").strip().lower()
    if normalized_root_cause == "diagnosis_unknown" and level == SymptomSafetyLevel.ROUTINE:
        level = SymptomSafetyLevel.INSUFFICIENT_DATA

    if not provider_available:
        reason = "provider_data_unavailable"
    elif serious_ids and level == SymptomSafetyLevel.EMERGENCY:
        reason = "provider_emergency_observation"
    elif serious_ids:
        reason = "provider_serious_observation"
    elif normalized_root_cause == "diagnosis_unknown":
        reason = "provider_diagnosis_unknown"
    else:
        reason = "provider_triage"
    return level, provider_available, sorted(set(serious_ids)), reason


def merge_symptom_safety(
    *,
    internal_level: Any,
    provider_triage_level: Any = None,
    provider_serious_observations: list[Any] | None = None,
    provider_root_cause: Any = None,
) -> SymptomSafetyDecision:
    """Return the more conservative deterministic safety decision."""
    internal = normalize_internal_safety_level(internal_level)
    provider, provider_available, serious_ids, provider_reason = resolve_provider_safety(
        triage_level=provider_triage_level,
        serious_observations=provider_serious_observations,
        root_cause=provider_root_cause,
    )
    provider_is_more_conservative = (
        provider_available and _SAFETY_RANK[provider] > _SAFETY_RANK[internal]
    )
    final = provider if provider_is_more_conservative else internal

    # Missing or invalid provider data is never self-care. A known internal
    # safety state remains authoritative; routine becomes insufficient data.
    if not provider_available and internal == SymptomSafetyLevel.ROUTINE:
        final = SymptomSafetyLevel.INSUFFICIENT_DATA

    if not provider_available:
        reason_code = "provider_data_unavailable"
    elif provider_is_more_conservative:
        reason_code = (
            "provider_escalation_applied"
            if provider_reason == "provider_triage"
            else f"provider_escalation_applied:{provider_reason}"
        )
    elif _SAFETY_RANK[provider] < _SAFETY_RANK[internal]:
        reason_code = "internal_safety_preserved"
    else:
        reason_code = "safety_levels_agree"

    return SymptomSafetyDecision(
        internal_level=internal,
        provider_level=provider,
        final_level=final,
        escalated_by_provider=provider_is_more_conservative,
        provider_available=provider_available,
        interrupt=final == SymptomSafetyLevel.EMERGENCY,
        provider_triage_level=str(provider_triage_level).strip() if provider_triage_level else None,
        provider_root_cause=str(provider_root_cause).strip() if provider_root_cause else None,
        provider_serious_observation_ids=serious_ids,
        reason_code=reason_code,
    )
