import pytest

from app.models.safety_state import SafetyLevel, resolve_safety_state
from app.services.clinical_engine import prioritize_biomarkers
from app.services.clinical_engine.normalizer import _status_for_value, normalize_biomarkers
from app.services.report_history import assemble_frozen_response
from app.services.safety.safety_engine import validate_report


def test_unknown_without_reference_does_not_become_elevated():
    result = normalize_biomarkers([{"name": "Unmapped marker", "value": 650, "unit": "units"}])
    assert result[0]["status"] == "UNKNOWN"
    assert result[0]["status"] != "ELEVATED"


def test_unevaluated_does_not_become_deficient_or_borderline():
    status = _status_for_value(
        650,
        500,
        None,
        has_reference=True,
        is_verified_fallback=False,
    )
    assert status == "UNEVALUATED"
    assert status not in {"DEFICIENT", "BORDERLINE"}


def test_needs_confirmation_does_not_enter_clinical_priority():
    prioritized = prioritize_biomarkers(
        [{
            "name": "Potassium",
            "canonical_name": "potassium",
            "value": 2.1,
            "unit": "mmol/L",
            "status": "NEEDS_CONFIRMATION",
        }]
    )
    assert prioritized == []


def test_valid_canonical_potassium_triggers_absolute_safety():
    result = validate_report(
        biomarkers=[{
            "name": "Potassium",
            "canonical_name": "potassium",
            "value": 2.5,
            "unit": "mmol/L",
            "status": "UNKNOWN",
        }]
    )
    assert any(event["key"] == "critical_potassium" for event in result["safety_events"])
    state = resolve_safety_state(
        [{
            "name": "Potassium",
            "canonical_name": "potassium",
            "value": 2.1,
            "unit": "mmol/L",
            "status": "UNEVALUATED",
        }]
    )
    assert state.level == SafetyLevel.IMMEDIATE


def test_unverified_unit_does_not_trigger_absolute_safety():
    result = validate_report(
        biomarkers=[{
            "name": "Potassium",
            "canonical_name": "potassium",
            "value": 2.1,
            "unit": "unknown-unit",
        }]
    )
    assert not any(event["key"] == "critical_potassium" for event in result["safety_events"])
    assert resolve_safety_state([{
        "name": "Potassium",
        "canonical_name": "potassium",
        "value": 2.1,
        "unit": "unknown-unit",
    }]).level == SafetyLevel.ROUTINE


def test_ambiguous_biomarker_identity_does_not_trigger_absolute_safety():
    result = validate_report(
        biomarkers=[{"name": "electrolyte", "value": 2.1, "unit": "mmol/L"}],
    )
    assert not any(event["severity"] == "critical" for event in result["safety_events"])


def _frozen_report_with_event(event):
    return {
        "status": "completed",
        "input_snapshot": {"biomarkers": []},
        "knowledge_report": {},
        "protocol": {},
        "safety_result": {
            "risk_level": "urgent_review",
            "urgent_review_required": True,
            "safety_events": [event],
        },
    }


@pytest.mark.parametrize(
    "event",
    [{
        "key": "derived_reference_claim",
        "severity": "high",
        "message": "D-dimer is elevated",
        "item": {"name": "D-dimer", "status": "UNEVALUATED", "value": 650, "unit": "ug/L"},
    }],
)
def test_frozen_read_suppresses_invalid_reference_claim(event):
    response = assemble_frozen_response(
        upload_id="upload-1",
        biomarkers=[],
        protocol_recommendations=[],
        report_version=_frozen_report_with_event(event),
        user_profile=None,
        locale="en",
    )
    assert response["safety_result"]["safety_events"] == []
    assert response["safety_result"]["risk_level"] == "routine"


def test_frozen_read_preserves_valid_absolute_critical_event():
    event = {
        "key": "critical_potassium",
        "severity": "critical",
        "message": "Very low potassium requires prompt medical review.",
        "item": {
            "name": "Potassium",
            "canonical_name": "potassium",
            "status": "UNEVALUATED",
            "value": 2.1,
            "unit": "mmol/L",
        },
    }
    response = assemble_frozen_response(
        upload_id="upload-1",
        biomarkers=[],
        protocol_recommendations=[],
        report_version=_frozen_report_with_event(event),
        user_profile=None,
        locale="en",
    )
    assert response["safety_result"]["safety_events"] == [event]
    assert response["safety_result"]["urgent_review_required"] is True