"""P24.3 pipeline integration: proves select_population_profiles() is
actually wired into run_lab_analysis_pipeline() and that its output is
both returned live and persisted into input_snapshot for frozen replay --
not just unit-tested in isolation. Uses the same fake-Supabase mocking
convention as test_architecture_1_0_chain.py. No live database.
"""

import pytest

from app.services import supabase_service as svc
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline
from app.services.population_profiles import ATHLETE_RECOVERY, LONGEVITY_METABOLIC_OPTIMIZATION


CONFIDENT_PROFILE = {
    "age": 34, "sex": "female", "height_cm": 168, "weight_kg": 62,
    "current_medications": ["none"],
}


def _clean_biomarkers():
    return [
        {"name": "Ferritin", "value": 22.0, "unit": "ng/mL", "ref_low": 20, "ref_high": 250, "status": "BORDERLINE"},
        {"name": "Vitamin D (25-OH)", "value": 18.0, "unit": "ng/mL", "ref_low": 30, "ref_high": 100, "status": "DEFICIENT"},
    ]


def _install_common_fakes(monkeypatch, *, saved_report_versions, intervention_events=None):
    async def _fake_save_biomarkers(upload_id, user_id, biomarkers):
        return [{"id": f"bm-{i}", **b} for i, b in enumerate(biomarkers)]

    async def _fake_history(_user_id):
        return []

    async def _fake_save_report_version(**kwargs):
        saved_report_versions.append(kwargs)
        return {"id": "report-p24-3", **{k: v for k, v in kwargs.items() if k in ("status", "locale", "version")}}

    async def _fake_save_safety_events(**_kwargs):
        return None

    async def _fake_save_artifacts(**_kwargs):
        return {"persisted": True}

    async def _fake_get_intervention_events(_user_id):
        return intervention_events or []

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)
    monkeypatch.setattr("app.services.lab_analysis_pipeline._load_historical_biomarkers", _fake_history)
    monkeypatch.setattr(svc, "save_report_version", _fake_save_report_version)
    monkeypatch.setattr(svc, "save_safety_events", _fake_save_safety_events)
    monkeypatch.setattr(svc, "save_analysis_intelligence_artifacts", _fake_save_artifacts)
    monkeypatch.setattr(svc, "get_intervention_events", _fake_get_intervention_events)


@pytest.mark.asyncio
async def test_no_signal_pipeline_run_selects_default_profile_only(monkeypatch):
    saved_report_versions = []
    _install_common_fakes(monkeypatch, saved_report_versions=saved_report_versions, intervention_events=[])

    result = await run_lab_analysis_pipeline(
        biomarkers=_clean_biomarkers(),
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-p24-3-default",
        analysis_id="upload-p24-3-default",
        source_metadata={"source": "b2c_manual", "candidates": []},
        persist_biomarkers=False,
        persist_report_version=True,
        generate_ai_protocol=False,
    )

    assert result["population_profile_selection"]["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]
    assert result["population_profile_selection"]["selection_source"] == "default"
    assert result["population_profile_overlays"]["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]

    assert len(saved_report_versions) == 1
    snapshot = saved_report_versions[0]["input_snapshot"]
    assert snapshot["population_profile_selection"]["selection_source"] == "default"
    assert snapshot["population_profile_overlays"]["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]


@pytest.mark.asyncio
async def test_training_intervention_event_selects_both_profiles_and_persists_selection(monkeypatch):
    """A real "training" event fetched from (fake) Supabase must flow all
    the way through: get_intervention_events -> build_intervention_memory
    -> select_population_profiles -> build_population_profile_overlays ->
    both the live result AND the persisted input_snapshot."""
    saved_report_versions = []
    training_event = {
        "id": "evt-1",
        "event_type": "training",
        "label": "Marathon training block",
        "started_at": "2026-06-01T00:00:00Z",
        "ongoing": True,
        "source": "user",
    }
    _install_common_fakes(monkeypatch, saved_report_versions=saved_report_versions, intervention_events=[training_event])

    result = await run_lab_analysis_pipeline(
        biomarkers=_clean_biomarkers(),
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-p24-3-athlete",
        analysis_id="upload-p24-3-athlete",
        source_metadata={"source": "b2c_manual", "candidates": []},
        persist_biomarkers=False,
        persist_report_version=True,
        generate_ai_protocol=False,
    )

    selection = result["population_profile_selection"]
    assert selection["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION, ATHLETE_RECOVERY]
    assert selection["selection_source"] == "mixed"
    assert any(r["reason_code"] == "training_context_present" for r in selection["selection_reasons"])

    overlays = result["population_profile_overlays"]
    assert overlays["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION, ATHLETE_RECOVERY]
    assert len(overlays["profiles"]) == 2

    assert len(saved_report_versions) == 1
    snapshot = saved_report_versions[0]["input_snapshot"]
    assert snapshot["population_profile_selection"]["selection_source"] == "mixed"
    assert snapshot["population_profile_overlays"]["active_profile_ids"] == [
        LONGEVITY_METABOLIC_OPTIMIZATION, ATHLETE_RECOVERY,
    ]


@pytest.mark.asyncio
async def test_explicit_source_metadata_override_selects_only_requested_profile(monkeypatch):
    saved_report_versions = []
    _install_common_fakes(monkeypatch, saved_report_versions=saved_report_versions, intervention_events=[])

    result = await run_lab_analysis_pipeline(
        biomarkers=_clean_biomarkers(),
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-p24-3-explicit",
        analysis_id="upload-p24-3-explicit",
        source_metadata={"source": "b2c_manual", "candidates": [], "population_profile_ids": [ATHLETE_RECOVERY]},
        persist_biomarkers=False,
        persist_report_version=True,
        generate_ai_protocol=False,
    )

    selection = result["population_profile_selection"]
    assert selection["active_profile_ids"] == [ATHLETE_RECOVERY]
    assert selection["selection_source"] == "explicit"
    assert result["population_profile_overlays"]["active_profile_ids"] == [ATHLETE_RECOVERY]
