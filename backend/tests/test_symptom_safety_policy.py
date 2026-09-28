import pytest

from app.services.symptom_safety_policy import (
    SymptomSafetyLevel,
    map_provider_triage,
    merge_symptom_safety,
    resolve_provider_safety,
)


@pytest.mark.parametrize(
    ("provider_level", "expected"),
    [
        ("emergency_ambulance", SymptomSafetyLevel.EMERGENCY),
        ("emergency", SymptomSafetyLevel.EMERGENCY),
        ("consultation_24", SymptomSafetyLevel.URGENT_24H),
        ("consultation", SymptomSafetyLevel.CLINICIAN_REVIEW),
        ("self_care", SymptomSafetyLevel.ROUTINE),
        (None, SymptomSafetyLevel.INSUFFICIENT_DATA),
        ("future_unknown_value", SymptomSafetyLevel.INSUFFICIENT_DATA),
    ],
)
def test_provider_triage_mapping(provider_level, expected):
    assert map_provider_triage(provider_level) == expected


def test_provider_can_escalate_internal_safety():
    result = merge_symptom_safety(internal_level="routine", provider_triage_level="consultation_24")
    assert result.final_level == SymptomSafetyLevel.URGENT_24H
    assert result.escalated_by_provider is True
    assert result.provider_available is True
    assert result.interrupt is False
    assert result.reason_code == "provider_escalation_applied"


def test_provider_can_never_deescalate_internal_emergency():
    result = merge_symptom_safety(internal_level="immediate", provider_triage_level="self_care")
    assert result.internal_level == SymptomSafetyLevel.EMERGENCY
    assert result.provider_level == SymptomSafetyLevel.ROUTINE
    assert result.final_level == SymptomSafetyLevel.EMERGENCY
    assert result.escalated_by_provider is False
    assert result.interrupt is True
    assert result.reason_code == "internal_safety_preserved"


def test_provider_failure_is_not_treated_as_routine():
    result = merge_symptom_safety(internal_level="routine", provider_triage_level=None)
    assert result.provider_level == SymptomSafetyLevel.INSUFFICIENT_DATA
    assert result.final_level == SymptomSafetyLevel.INSUFFICIENT_DATA
    assert result.escalated_by_provider is False
    assert result.provider_available is False
    assert result.reason_code == "provider_data_unavailable"


def test_existing_clinician_review_survives_provider_self_care():
    result = merge_symptom_safety(internal_level="medical_review", provider_triage_level="self_care")
    assert result.final_level == SymptomSafetyLevel.CLINICIAN_REVIEW


def test_critical_now_alias_interrupts_even_when_provider_is_missing():
    result = merge_symptom_safety(internal_level="critical_now", provider_triage_level=None)
    assert result.final_level == SymptomSafetyLevel.EMERGENCY
    assert result.interrupt is True
    assert result.provider_available is False


def test_serious_observation_can_raise_provider_triage_to_emergency():
    result = merge_symptom_safety(
        internal_level="routine",
        provider_triage_level="consultation",
        provider_root_cause="emergency_evidence_present",
        provider_serious_observations=[
            {"id": "s_emergency", "seriousness": "emergency"}
        ],
    )
    assert result.provider_level == SymptomSafetyLevel.EMERGENCY
    assert result.final_level == SymptomSafetyLevel.EMERGENCY
    assert result.interrupt is True
    assert result.provider_serious_observation_ids == ["s_emergency"]
    assert result.reason_code == "provider_escalation_applied:provider_emergency_observation"


def test_diagnosis_unknown_is_never_treated_as_self_care():
    level, available, serious_ids, reason = resolve_provider_safety(
        triage_level="self_care",
        root_cause="diagnosis_unknown",
    )
    assert level == SymptomSafetyLevel.INSUFFICIENT_DATA
    assert available is True
    assert serious_ids == []
    assert reason == "provider_diagnosis_unknown"


def test_internal_emergency_wins_over_lower_provider_seriousness():
    result = merge_symptom_safety(
        internal_level="critical_now",
        provider_triage_level="consultation",
        provider_serious_observations=[{"id": "s_serious", "seriousness": "serious"}],
    )
    assert result.final_level == SymptomSafetyLevel.EMERGENCY
    assert result.reason_code == "internal_safety_preserved"
