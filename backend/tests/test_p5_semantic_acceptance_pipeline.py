import pytest

from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline
from app.services.report_history import assemble_frozen_response
from app.services.semantic_acceptance import SEMANTIC_ACCEPTANCE_VERSION


@pytest.mark.asyncio
async def test_pipeline_returns_versions_and_freezes_semantic_acceptance(monkeypatch):
    from app.services import lab_analysis_pipeline
    from app.services import supabase_service as svc

    saved = {}

    async def no_history(_user_id):
        return []

    async def save_report_version(**kwargs):
        saved.update(kwargs)
        return {"id": "report-p5", **kwargs}

    async def no_safety_events(**_kwargs):
        return None

    async def save_artifacts(**_kwargs):
        return {"persisted": True}

    monkeypatch.setattr(lab_analysis_pipeline, "_load_historical_biomarkers", no_history)
    monkeypatch.setattr(svc, "save_report_version", save_report_version)
    monkeypatch.setattr(svc, "save_safety_events", no_safety_events)
    monkeypatch.setattr(svc, "save_analysis_intelligence_artifacts", save_artifacts)

    result = await run_lab_analysis_pipeline(
        biomarkers=[
            {
                "name": "Ferritin",
                "value": 9,
                "unit": "ng/mL",
                "ref_low": 15,
                "ref_high": 150,
                "status": "DEFICIENT",
            },
            {
                "name": "Hemoglobin",
                "value": 11.2,
                "unit": "g/dL",
                "ref_low": 12,
                "ref_high": 15.5,
                "status": "DEFICIENT",
            },
        ],
        symptoms=[],
        questionnaire={"completed": True},
        user_profile={"age": 37, "sex": "female", "height_cm": 168, "weight_kg": 62},
        user_id="00000000-0000-0000-0000-000000000005",
        analysis_id="00000000-0000-0000-0000-000000000105",
        source_metadata={
            "source": "p5_unit_test",
            "candidates": [
                {"confidence_score": 0.99, "status": "confirmed"},
                {"confidence_score": 0.99, "status": "confirmed"},
            ],
        },
        symptom_snapshot={
            "version": "symptom_snapshot_v1",
            "session_id": "symptom-p5",
            "completed_at": "2026-10-05T08:00:00Z",
            "assessment": {"urgent_warning": "present"},
            "evidence": {
                "present": [
                    {
                        "vitaloop_concept_id": "fatigue",
                        "display_name_en": "Fatigue",
                        "mapping_status": "mapped",
                        "is_primary": True,
                        "domain_keys": ["recovery_energy"],
                    }
                ],
                "absent": [],
                "unknown": [],
            },
        },
        persist_report_version=True,
        generate_ai_protocol=False,
        generate_ai_narrative=False,
    )

    acceptance = result["semantic_acceptance"]
    assert acceptance["version"] == SEMANTIC_ACCEPTANCE_VERSION
    assert set(acceptance["criteria"]) == {
        "report_specific_conclusion",
        "symptom_check_effect",
        "concrete_value_links",
        "report_specific_actions",
        "action_priority_clarity",
        "user_facing_language",
        "ai_fallback_disclosure",
        "safety_reason_specificity",
    }
    assert saved["input_snapshot"]["semantic_acceptance"] == acceptance
    assert (
        saved["input_snapshot"]["version_provenance"]["semantic_acceptance_version"]
        == SEMANTIC_ACCEPTANCE_VERSION
    )
    symptom_event = next(
        item
        for item in result["safety_result"]["safety_events"]
        if item["key"] == "symptom_check_urgent_warning"
    )
    assert symptom_event["severity"] == "critical"
    assert "Fatigue" in symptom_event["message"]
    assert acceptance["criteria"]["safety_reason_specificity"]["status"] == "pass"


def test_frozen_response_replays_semantic_acceptance_verbatim():
    acceptance = {
        "version": SEMANTIC_ACCEPTANCE_VERSION,
        "status": "passed",
        "passes_dod": True,
        "criteria": {},
        "failures": [],
    }
    response = assemble_frozen_response(
        upload_id="upload-p5",
        biomarkers=[{"name": "Ferritin", "value": 9, "unit": "ng/mL"}],
        protocol_recommendations=[],
        report_version={
            "id": "report-p5",
            "status": "completed",
            "locale": "en",
            "input_snapshot": {"semantic_acceptance": acceptance},
            "knowledge_report": {},
            "protocol": {},
            "safety_result": {},
            "explainability": {},
        },
        user_profile={},
        locale="en",
    )

    assert response["semantic_acceptance"] == acceptance
    assert response["final_analysis"]["semantic_acceptance"] == acceptance


def test_old_frozen_report_without_p5_contract_remains_readable():
    response = assemble_frozen_response(
        upload_id="old-upload",
        biomarkers=[{"name": "Ferritin", "value": 9}],
        protocol_recommendations=[],
        report_version={
            "id": "old-report",
            "status": "completed",
            "locale": "en",
            "input_snapshot": {},
            "knowledge_report": {},
            "protocol": {},
            "safety_result": {},
            "explainability": {},
        },
        user_profile={},
        locale="en",
    )

    assert response["semantic_acceptance"] is None
