"""P25 pipeline integration: proves build_doctor_escalation_precision() is
actually wired into run_lab_analysis_pipeline() -- present in the live
result and persisted into input_snapshot for frozen replay. Uses the same
fake-Supabase mocking convention as test_architecture_1_0_chain.py. No
live database.
"""

import pytest

from app.services import supabase_service as svc
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline


CONFIDENT_PROFILE = {
    "age": 34, "sex": "female", "height_cm": 168, "weight_kg": 62,
    "current_medications": ["none"],
}


def _clean_biomarkers():
    return [
        {"name": "Ferritin", "value": 22.0, "unit": "ng/mL", "ref_low": 20, "ref_high": 250, "status": "BORDERLINE"},
        {"name": "Vitamin D (25-OH)", "value": 18.0, "unit": "ng/mL", "ref_low": 30, "ref_high": 100, "status": "DEFICIENT"},
    ]


def _install_common_fakes(monkeypatch, *, saved_report_versions):
    async def _fake_save_biomarkers(upload_id, user_id, biomarkers):
        return [{"id": f"bm-{i}", **b} for i, b in enumerate(biomarkers)]

    async def _fake_history(_user_id):
        return []

    async def _fake_save_report_version(**kwargs):
        saved_report_versions.append(kwargs)
        return {"id": "report-p25", **{k: v for k, v in kwargs.items() if k in ("status", "locale", "version")}}

    async def _fake_save_safety_events(**_kwargs):
        return None

    async def _fake_save_artifacts(**_kwargs):
        return {"persisted": True}

    async def _fake_get_intervention_events(_user_id):
        return []

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)
    monkeypatch.setattr("app.services.lab_analysis_pipeline._load_historical_biomarkers", _fake_history)
    monkeypatch.setattr(svc, "save_report_version", _fake_save_report_version)
    monkeypatch.setattr(svc, "save_safety_events", _fake_save_safety_events)
    monkeypatch.setattr(svc, "save_analysis_intelligence_artifacts", _fake_save_artifacts)
    monkeypatch.setattr(svc, "get_intervention_events", _fake_get_intervention_events)


@pytest.mark.asyncio
async def test_doctor_escalation_precision_present_in_fresh_pipeline_output_and_persisted(monkeypatch):
    saved_report_versions = []
    _install_common_fakes(monkeypatch, saved_report_versions=saved_report_versions)

    result = await run_lab_analysis_pipeline(
        biomarkers=_clean_biomarkers(),
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-p25",
        analysis_id="upload-p25",
        source_metadata={"source": "b2c_manual", "candidates": []},
        persist_biomarkers=False,
        persist_report_version=True,
        generate_ai_protocol=False,
    )

    assert "doctor_escalation_precision" in result
    escalation = result["doctor_escalation_precision"]
    assert escalation["version"] == "p25_v1"
    assert escalation["overall_level"] in {"self", "practitioner", "doctor", "urgent"}
    assert "summary" in escalation
    assert result["metadata"]["version_provenance"]["doctor_escalation_precision_version"] == "p25_v1"

    assert len(saved_report_versions) == 1
    snapshot = saved_report_versions[0]["input_snapshot"]
    assert "doctor_escalation_precision" in snapshot
    assert snapshot["doctor_escalation_precision"]["version"] == "p25_v1"
