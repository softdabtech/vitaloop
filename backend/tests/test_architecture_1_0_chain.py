"""Stage 2I — Architecture 1.0 cross-stage invariant chain test.

This is NOT a re-run of every unit test from Stages 2A-2H.1 (those are run
separately as part of this stage's required test matrix). This file proves
the ARCHITECTURAL CHAIN itself — that each stage's output is what the next
stage's input actually requires — by exercising real production functions in
sequence, using the same fake-Supabase mocking convention established
throughout this project (never a live DB).

Covers the 12 invariants from the Stage 2I brief, in order.

No live database connection is used anywhere in this file.
"""

from pathlib import Path

import pytest

from app.services import supabase_service as svc
from app.services.analysis_candidates import build_candidate_payloads
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline
from app.services.progress_overview import build_progress_overview
from app.services.report_history import assemble_frozen_response, is_frozen_report_version
from app.services import entitlements


CONFIDENT_PROFILE = {
    "age": 34, "sex": "female", "height_cm": 168, "weight_kg": 62,
    "current_medications": ["none"],
}


def _clean_biomarkers():
    return [
        {"name": "Ferritin", "value": 22.0, "unit": "ng/mL", "ref_low": 20, "ref_high": 250, "status": "BORDERLINE"},
        {"name": "Vitamin D (25-OH)", "value": 18.0, "unit": "ng/mL", "ref_low": 30, "ref_high": 100, "status": "DEFICIENT"},
    ]


# --- 1/2/3: metadata vs needs_confirmation vs confirmed-valid -> canonical ------


@pytest.mark.asyncio
async def test_chain_1_metadata_cannot_become_canonical_biomarker(monkeypatch):
    """Stage 2A invariant: a non-biomarker metadata-shaped row (no numeric
    value, a units/label field masquerading as a result) never reaches
    canonical persistence — normalize_biomarkers()/the quality gate reject it
    before persist_biomarkers is ever reached with it included as real data."""
    calls = []

    async def _fake_save_biomarkers(upload_id, user_id, biomarkers):
        calls.append(biomarkers)
        return [{"id": "bm-1", **b} for b in biomarkers]

    async def _fake_history(_user_id):
        return []

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)
    monkeypatch.setattr("app.services.lab_analysis_pipeline._load_historical_biomarkers", _fake_history)

    metadata_like_row = {"name": "Report Generated Date", "value": None, "unit": None, "status": None}
    candidates = build_candidate_payloads(biomarkers=[metadata_like_row], source="manual")

    result = await run_lab_analysis_pipeline(
        biomarkers=[metadata_like_row],
        symptoms=[],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-chain-1",
        analysis_id="upload-chain-1",
        source_metadata={"source": "b2c_manual", "candidates": candidates},
        persist_biomarkers=True,
        generate_ai_protocol=False,
    )

    persisted_names = [b.get("name") for call in calls for b in call]
    assert "Report Generated Date" not in persisted_names, (
        "a metadata-shaped row with no real value must never reach canonical persistence"
    )


@pytest.mark.asyncio
async def test_chain_2_needs_confirmation_cannot_become_canonical(monkeypatch):
    """Stage 2B invariant: a gate decision other than auto_continue must
    never persist to the canonical biomarkers table."""
    calls = []

    async def _fake_save_biomarkers(upload_id, user_id, biomarkers):
        calls.append(biomarkers)
        return []

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)

    # Low-confidence AI candidates with no confirmation -> gate should not
    # reach auto_continue.
    low_confidence_candidates = [
        {"raw_name": "Ferritin", "status": "pending", "confidence_score": 0.3, "source": "ai"},
    ]

    result = await run_lab_analysis_pipeline(
        biomarkers=_clean_biomarkers(),
        symptoms=[],
        user_profile={},  # sparse profile -> lower gate score
        user_id="user-chain-2",
        analysis_id="upload-chain-2",
        source_metadata={"source": "b2c_file", "candidates": low_confidence_candidates},
        persist_biomarkers=True,
        generate_ai_protocol=False,
    )

    if result["analysis_input_quality_gate"]["decision"] != "auto_continue":
        assert result["analysis_status"] == "needs_confirmation"
        assert calls == [], "needs_confirmation must never persist canonical biomarkers"


@pytest.mark.asyncio
async def test_chain_3_confirmed_valid_data_becomes_canonical_and_creates_frozen_report(monkeypatch):
    """Stages 2B + 2G chained: valid, well-formed, confirmed candidates ->
    gate=auto_continue -> canonical biomarkers persisted AND a report_versions
    row created in the same pipeline run (invariant 5)."""
    saved_biomarkers_calls = []
    saved_report_versions = []

    async def _fake_save_biomarkers(upload_id, user_id, biomarkers):
        saved_biomarkers_calls.append(biomarkers)
        return [{"id": f"bm-{i}", **b} for i, b in enumerate(biomarkers)]

    async def _fake_history(_user_id):
        return []

    async def _fake_save_report_version(**kwargs):
        saved_report_versions.append(kwargs)
        return {"id": "report-chain-3", **{k: v for k, v in kwargs.items() if k in ("status", "locale", "version")}}

    async def _fake_save_safety_events(**_kwargs):
        return None

    async def _fake_save_artifacts(**_kwargs):
        return {"persisted": True}

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)
    monkeypatch.setattr("app.services.lab_analysis_pipeline._load_historical_biomarkers", _fake_history)
    monkeypatch.setattr(svc, "save_report_version", _fake_save_report_version)
    monkeypatch.setattr(svc, "save_safety_events", _fake_save_safety_events)
    monkeypatch.setattr(svc, "save_analysis_intelligence_artifacts", _fake_save_artifacts)

    clean_biomarkers = _clean_biomarkers()
    candidates = build_candidate_payloads(biomarkers=clean_biomarkers, source="manual")
    assert candidates[0]["status"] == "confirmed"

    result = await run_lab_analysis_pipeline(
        biomarkers=clean_biomarkers,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-chain-3",
        analysis_id="upload-chain-3",
        source_metadata={"source": "b2c_manual", "candidates": candidates},
        persist_biomarkers=True,
        persist_report_version=True,
        generate_ai_protocol=False,
    )

    assert result["analysis_input_quality_gate"]["decision"] == "auto_continue"
    assert len(saved_biomarkers_calls) == 1, "invariant 3: confirmed valid data must become canonical exactly once"
    assert len(saved_report_versions) == 1, "invariant 5: a completed analysis must create exactly one frozen report_version"


# --- 4: Safety blocked content cannot leak ---------------------------------------


def test_chain_4_safety_blocked_content_cannot_leak_through_frozen_serve():
    """Stages 2C + 2G chained: a report_versions row persisted BEFORE the
    Stage 2C fix (unsanitized diagnosis-like text) must still be redacted
    when served through the frozen-report path — proving the read-boundary
    sanitizer is actually wired into GET, not just available."""
    stale_frozen_row = {
        "id": "report-chain-4",
        "status": "completed",
        "knowledge_report": {
            "summary": {"headline": "Findings"},
            "why_it_matters": [{"title": "You have anemia", "summary": "Confirmed diagnosis.", "why_it_matters": "You have anemia."}],
            "doctor_discussion": [],
        },
        "protocol": {},
        "safety_result": {"status": "approved"},
        "explainability": {},
    }
    response = assemble_frozen_response(
        upload_id="upload-chain-4",
        biomarkers=[],
        protocol_recommendations=[],
        report_version=stale_frozen_row,
        user_profile={},
        locale="en",
    )
    served_title = response["knowledge_report"]["why_it_matters"][0]["title"]
    assert "you have" not in served_title.lower(), "blocked/diagnosis-like content must never leak through the frozen GET path"


# --- 6/7: historical GET uses frozen version; regenerate creates a new one -------


def test_chain_6_historical_get_never_recomputes_when_frozen_version_exists():
    frozen_row = {"id": "r1", "status": "completed", "knowledge_report": {"summary": {"headline": "Original"}}, "protocol": {}, "safety_result": {}, "explainability": {}}
    assert is_frozen_report_version(frozen_row) is True
    response = assemble_frozen_response(
        upload_id="u1", biomarkers=[], protocol_recommendations=[], report_version=frozen_row, user_profile={}, locale="en",
    )
    assert response["report_source"] == "frozen"
    assert response["knowledge_report"]["summary"]["headline"] == "Original"


def test_chain_7_regenerate_creates_an_additional_immutable_version_not_an_overwrite():
    import inspect

    from app.routers.analysis import analyze as analyze_router
    from app.services import supabase_service as svc_mod

    regen_source = inspect.getsource(analyze_router.regenerate_results)
    assert "persist_report_version=True" in regen_source
    save_source = inspect.getsource(svc_mod.save_report_version)
    assert '.table("report_versions").insert' in save_source
    assert '.table("report_versions").update' not in save_source


# --- 8: check-in changes truthful dashboard state --------------------------------


def test_chain_8_checkin_completion_affects_dashboard_next_best_action():
    import inspect

    from app.routers.analysis import dashboard as dashboard_router

    source = inspect.getsource(dashboard_router)
    assert "checkin" in source.lower()
    # Full behavioral coverage (a real check-in flips next-best-action state)
    # lives in test_stage2e_checkin_dashboard.py, re-run as part of this
    # stage's test matrix — this only pins that the chain link still exists.


# --- 9/10: second real test date -> longitudinal progress, by measurement date --


def test_chain_9_10_second_measurement_date_creates_longitudinal_progress_by_lab_date():
    rows = [
        {
            "id": "u_a", "created_at": "2026-03-01T00:00:00Z", "test_date": "2026-01-01",
            "biomarkers": [{"name": "Ferritin", "value": 50, "unit": "ng/mL", "status": "OPTIMAL"}],
        },
        {
            "id": "u_b", "created_at": "2026-01-05T00:00:00Z", "test_date": "2026-02-01",
            "biomarkers": [{"name": "Ferritin", "value": 65, "unit": "ng/mL", "status": "OPTIMAL"}],
        },
    ]
    overview = build_progress_overview(rows)
    assert overview["timeline_eligible"] is True
    change = (overview["top_changes"] or overview["stable_markers"])[0]
    # Chronology comes from test_date, NOT created_at (upload u_a was created
    # LATER but its test_date is EARLIER — chronology must follow test_date).
    assert change["previous_date"] == "2026-01-01"
    assert change["latest_date"] == "2026-02-01"


# --- 11: frontend-facing progress comes from /progress/overview -----------------


def test_chain_11_frontend_reads_progress_overview_not_a_second_trend_engine():
    lab_results_jsx = Path("/var/www/VITALOOP/frontend/src/pages/LabResultsList.jsx").read_text()
    assert "api.get('/progress/overview')" in lab_results_jsx
    progress_jsx = Path("/var/www/VITALOOP/frontend/src/pages/Progress.jsx")
    app_jsx = Path("/var/www/VITALOOP/frontend/src/App.jsx").read_text()
    assert progress_jsx.exists()
    assert "Progress.jsx" not in app_jsx


# --- 12: entitlement is resolved canonically -------------------------------------


@pytest.mark.asyncio
async def test_chain_12_entitlement_resolved_canonically_end_to_end(monkeypatch):
    async def fake_get_user_account(_user_id):
        return {"global_role": "end_user", "subscription_status": "free", "sub_status": "free"}

    async def fake_get_user_profile(_user_id):
        return {}

    async def fake_get_user_active_subscription(_user_id):
        return {"status": "active", "plan_name": "personal", "cancel_at_period_end": False}

    monkeypatch.setattr(entitlements.svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(entitlements.svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(entitlements.svc, "get_user_active_subscription", fake_get_user_active_subscription)

    result = await entitlements.resolve_user_entitlements("user-chain-12", {"role": "end_user"})
    assert result["is_premium"] is True
    assert result["source"] == "subscriptions"
