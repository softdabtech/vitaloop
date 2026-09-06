import pytest

from app.services import lab_analysis_pipeline
from app.services.safety.safety_engine import (
    sanitize_knowledge_evaluation_for_safety,
    sanitize_knowledge_report_for_safety,
    sanitize_protocol_for_safety,
    validate_report,
)


PROFILE_52F = {"age": 52, "sex": "female", "height_cm": 165, "weight_kg": 92}
def _confident_candidates(count=1):
    return [{"confidence_score": 0.95, "status": "pending"} for _ in range(count)]


SEVERE_BIOMARKERS = [
    {"name": "White Blood Cells (WBC)", "value": 1.8, "unit": "10^9/L", "status": "DEFICIENT"},
    {"name": "Absolute Neutrophils", "value": 0.45, "unit": "10^9/L", "status": "DEFICIENT"},
    {"name": "Hemoglobin", "value": 8.9, "unit": "g/dL", "status": "DEFICIENT"},
    {"name": "Platelets", "value": 62, "unit": "10^9/L", "status": "DEFICIENT"},
    {"name": "MCV", "value": 71, "unit": "fL", "status": "DEFICIENT"},
    {"name": "Ferritin", "value": 4, "unit": "ng/mL", "status": "DEFICIENT"},
    {"name": "Potassium", "value": 2.6, "unit": "mmol/L", "status": "DEFICIENT"},
]


MILD_BIOMARKERS = [
    {"name": "Hemoglobin", "value": 11.8, "unit": "g/dL", "status": "DEFICIENT"},
    {"name": "Platelets", "value": 145, "unit": "10^9/L", "status": "BORDERLINE"},
    {"name": "Potassium", "value": 3.4, "unit": "mmol/L", "status": "BORDERLINE"},
]


UNSAFE_ACTION = {
    "title": "Iron deficiency anemia protocol",
    "supplement": "Iron",
    "body": "Very low ferritin and low hemoglobin indicate iron deficiency anemia. Iron supplementation is necessary.",
    "dosage": "Ferrous sulfate 325 mg once daily",
    "rationale": "Take 100 mg iron daily and repeat labs later. Smoking increases your risk.",
}


def _flat_text(value) -> str:
    if isinstance(value, dict):
        return " ".join(_flat_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(_flat_text(item) for item in value)
    return str(value or "")


def _unsafe_counts(value):
    text = _flat_text(value).lower()
    return {
        "diagnosis_like": int("iron deficiency anemia" in text or "confirmed diagnosis" in text),
        "dosage": int("325 mg" in text or "100 mg" in text or "once daily" in text),
        "smoking": int("smoking increases your risk" in text),
    }


def test_critical_panel_escalates_to_urgent_review_with_prominent_warning():
    result = validate_report(
        biomarkers=SEVERE_BIOMARKERS,
        knowledge_report={"summary": {"headline": "Educational report"}},
        protocol={"supplements": []},
        profile=PROFILE_52F,
    )

    event_keys = {event["key"] for event in result["safety_events"]}
    assert result["urgent_review_required"] is True
    assert result["risk_level"] == "urgent_review"
    assert result["doctor_discussion_required"] is True
    assert result["prominent_user_warning"]
    assert {"critical_absolute_neutrophils", "critical_potassium", "critical_platelets", "critical_hemoglobin"} <= event_keys


def test_diagnosis_like_assertion_is_removed_from_final_protocol_content():
    sanitized = sanitize_protocol_for_safety([UNSAFE_ACTION], profile=PROFILE_52F, locale="en")

    text = _flat_text(sanitized).lower()
    assert "iron deficiency anemia" not in text
    assert "confirmed diagnosis" not in text
    assert "does not provide a diagnosis" in text or "clinical confirmation" in text


def test_prescriptive_supplement_dosage_is_removed_for_adult_profile():
    sanitized = sanitize_protocol_for_safety([UNSAFE_ACTION], profile=PROFILE_52F, locale="en")

    text = _flat_text(sanitized).lower()
    assert "325 mg" not in text
    assert "100 mg" not in text
    assert "once daily" not in text
    assert "supplementation is necessary" not in text
    assert "qualified clinician" in text


def test_unsupported_smoking_personalization_is_conditional_when_status_missing():
    sanitized_protocol = sanitize_protocol_for_safety([UNSAFE_ACTION], profile=PROFILE_52F, locale="en")
    sanitized_report = sanitize_knowledge_report_for_safety(
        {"why_it_matters": [{"title": "Risk context", "summary": "Smoking increases your risk."}]},
        locale="en",
    )
    sanitized_eval = sanitize_knowledge_evaluation_for_safety(
        {"matched_rules": [{"name": "Smoking", "summary": "Smoking increases your risk."}]},
        locale="en",
    )

    text = _flat_text([sanitized_protocol, sanitized_report, sanitized_eval]).lower()
    assert "smoking increases your risk" not in text
    assert "if you smoke" in text


def test_mild_abnormal_control_does_not_trigger_urgent_review():
    result = validate_report(
        biomarkers=MILD_BIOMARKERS,
        knowledge_report={"summary": {"headline": "Educational report"}},
        protocol={"supplements": []},
        profile=PROFILE_52F,
    )

    assert result["urgent_review_required"] is False
    assert result["risk_level"] == "routine"
    assert result["prominent_user_warning"] is None


@pytest.mark.asyncio
async def test_pipeline_final_output_has_urgent_flag_and_no_unsafe_text(monkeypatch):
    async def fake_evaluate_biomarkers_with_knowledge(**_kwargs):
        return {
            "matched_rules": [
                {
                    "rule_key": "unsafe_rule",
                    "name": "Iron deficiency anemia",
                    "summary": "Smoking increases your risk.",
                    "explanation": "Confirmed diagnosis of iron deficiency anemia.",
                }
            ],
            "safety_alerts": [],
            "generated_recommendations": [],
        }

    def fake_build_knowledge_report(**_kwargs):
        return {
            "version": "knowledge_report_test_v1",
            "summary": {"headline": "Educational report", "disclaimer": "Educational only."},
            "what_was_found": {"summary": "Synthetic severe panel."},
            "why_it_matters": [{"title": "Iron deficiency anemia", "summary": "Smoking increases your risk."}],
            "action_plan": [dict(UNSAFE_ACTION)],
            "doctor_discussion": ["Discuss confirmed diagnosis of iron deficiency anemia."],
            "retest_plan": [],
            "safety_alerts": [],
        }

    async def fake_domain_definitions():
        return []

    def fake_health_states(**_kwargs):
        return {"version": "health_states_test_v1", "states": [], "top_priorities": []}

    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_biomarkers_with_knowledge", fake_evaluate_biomarkers_with_knowledge)
    monkeypatch.setattr(lab_analysis_pipeline, "build_knowledge_report", fake_build_knowledge_report)
    monkeypatch.setattr(lab_analysis_pipeline, "resolve_domain_definitions", fake_domain_definitions)
    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_health_states", fake_health_states)
    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_biomarker_trends", lambda **_kwargs: {"available": False, "priority_changes": []})
    monkeypatch.setattr(
        lab_analysis_pipeline,
        "build_analysis_input_quality_gate",
        lambda **_kwargs: {"version": "analysis_input_quality_gate_test_v1", "decision": "auto_continue"},
    )
    async def fake_history(_user_id):
        return []

    monkeypatch.setattr(lab_analysis_pipeline, "_load_historical_biomarkers", fake_history)
    monkeypatch.setattr(lab_analysis_pipeline, "record_analysis_cost", lambda **_kwargs: None)

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=SEVERE_BIOMARKERS,
        symptoms=["severe fatigue", "orthostatic dizziness", "dyspnea with minor exertion"],
        questionnaire={"completed": True},
        user_profile=PROFILE_52F,
        user_id="user-critical-output",
        analysis_id="upload-critical-output",
        source_metadata={"source": "unit_test", "candidates": _confident_candidates(len(SEVERE_BIOMARKERS))},
        generate_ai_protocol=False,
    )

    assert result["analysis_status"] == "completed"
    assert result["safety_result"]["urgent_review_required"] is True
    assert result["health_summary"]["risk_level"] == "urgent_review"
    assert result["health_summary"]["prominent_user_warning"]

    counts = _unsafe_counts(
        {
            "health_summary": result["health_summary"],
            "recommendations": result["recommendations"],
            "protocol": result["protocol"],
            "ai_protocol": result["ai_protocol"],
            "knowledge_evaluation": result["knowledge_evaluation"],
            "knowledge_report": result["knowledge_report"],
            "interpreted_report": result["interpreted_report"],
            "safety_result": result["safety_result"],
        }
    )
    assert counts == {"diagnosis_like": 0, "dosage": 0, "smoking": 0}
