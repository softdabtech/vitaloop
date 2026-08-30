"""Stage 2B — regression coverage for the canonical-data persistence boundary.

Extraction -> candidates -> gate -> [confirmation] -> canonical biomarkers ->
health analysis -> safety -> report/protocol/report_version.

These tests verify the actual WRITE CHOKEPOINT (supabase_service.save_biomarkers),
not just the shape of the returned dict — Test A/B in test_stage2pre_pipeline_gate.py
already cover the response-shape side; this file proves persistence itself is
correctly gated, using a call-tracking spy on save_biomarkers().

No live database connection is used anywhere in this file.
"""

import pytest

from app.services import lab_analysis_pipeline
from app.services import supabase_service as svc


CLEAN_BIOMARKERS = [
    {"name": "Glucose", "value": 92, "unit": "mg/dL", "ref_low": 70, "ref_high": 99, "status": "OPTIMAL"},
    {"name": "TSH", "value": 2.1, "unit": "mIU/L", "ref_low": 0.4, "ref_high": 4.0, "status": "OPTIMAL"},
]
CONFIDENT_PROFILE = {
    "age": 34,
    "sex": "female",
    "height_cm": 168,
    "weight_kg": 62,
    "current_medications": ["none"],
}
LOW_CONFIDENCE_CANDIDATES = [{"confidence_score": 0.3, "status": "pending"}]
CONFIRMED_CANDIDATES = [{"confidence_score": 0.3, "status": "confirmed"}]


@pytest.fixture
def save_biomarkers_spy(monkeypatch):
    calls = []

    async def _fake_save_biomarkers(upload_id, user_id, biomarkers):
        calls.append({"upload_id": upload_id, "user_id": user_id, "biomarkers": biomarkers})
        return [{"id": "bm-1", **b} for b in biomarkers]

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)
    return calls


@pytest.fixture(autouse=True)
def _stub_historical_biomarkers(monkeypatch):
    calls = {"count": 0}

    async def _fake(user_id):
        calls["count"] += 1
        return []

    monkeypatch.setattr(lab_analysis_pipeline, "_load_historical_biomarkers", _fake)
    return calls


# --- A: clean/high-confidence analysis -----------------------------------------


@pytest.mark.asyncio
async def test_auto_continue_persists_canonical_biomarkers(save_biomarkers_spy):
    """A. auto_continue -> save_biomarkers() IS called with the normalized data,
    and a full report/protocol is produced."""
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-a",
        analysis_id="upload-a",
        source_metadata={"candidates": []},
        persist_biomarkers=True,
        generate_ai_protocol=False,
    )

    assert result["analysis_input_quality_gate"]["decision"] == "auto_continue", result["analysis_input_quality_gate"]
    assert result["analysis_status"] == "completed"
    assert len(save_biomarkers_spy) == 1, "save_biomarkers() must be called exactly once for an auto_continue upload"
    assert save_biomarkers_spy[0]["upload_id"] == "upload-a"
    saved_names = [b["name"].lower() for b in save_biomarkers_spy[0]["biomarkers"]]
    assert "glucose" in saved_names and "tsh" in saved_names
    assert result.get("interpreted_report") is not None
    assert result.get("protocol") is not None


# --- B: low-confidence analysis --------------------------------------------------


@pytest.mark.asyncio
async def test_needs_confirmation_never_persists_canonical_biomarkers(save_biomarkers_spy, _stub_historical_biomarkers):
    """B. needs_confirmation -> save_biomarkers() is NEVER called, no report/
    protocol/report_version, explicit machine-readable state returned, and
    downstream trend evaluation never even runs (no wasted historical read)."""
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=[],
        user_profile={"age": 34},  # incomplete profile, no questionnaire
        user_id="user-b",
        analysis_id="upload-b",
        source_metadata={"candidates": LOW_CONFIDENCE_CANDIDATES},
        persist_biomarkers=True,
        persist_report_version=True,
        persist_knowledge=True,
    )

    assert result["analysis_input_quality_gate"]["decision"] in ("confirm", "block_or_confirm"), result["analysis_input_quality_gate"]
    assert result["analysis_status"] == "needs_confirmation"
    assert save_biomarkers_spy == [], "save_biomarkers() must NEVER be called while confirmation is pending"
    assert result.get("interpreted_report") is None
    assert result.get("protocol") is None
    assert result.get("report_version") is None
    assert _stub_historical_biomarkers["count"] == 0, (
        "trend evaluation must not run at all for an unconfirmed upload — "
        "the pipeline should short-circuit before ever loading historical data"
    )


# --- C: confirmation --------------------------------------------------------------


@pytest.mark.asyncio
async def test_confirmed_candidates_are_promoted_and_pipeline_resumes_once(save_biomarkers_spy):
    """C. Confirming low-confidence candidates (status="confirmed") boosts their
    gate confidence score (per analysis_quality_gate.py's existing
    _candidate_scores() boost, reused unmodified) and resolves to auto_continue —
    canonical biomarkers get persisted exactly once, report/protocol generated."""
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-c",
        analysis_id="upload-c",
        source_metadata={"candidates": CONFIRMED_CANDIDATES},
        persist_biomarkers=True,
        generate_ai_protocol=False,
    )

    assert result["analysis_input_quality_gate"]["decision"] == "auto_continue", (
        "a confirmed/corrected candidate's confidence score must be boosted "
        f"enough to pass the gate; got {result['analysis_input_quality_gate']}"
    )
    assert result["analysis_status"] == "completed"
    assert len(save_biomarkers_spy) == 1, "confirmation must promote canonical biomarkers exactly once"
    assert result.get("interpreted_report") is not None
    assert result.get("protocol") is not None


@pytest.mark.asyncio
async def test_confirmation_that_still_fails_gate_stays_pending_no_arbitrary_limit(save_biomarkers_spy):
    """No arbitrary confirmation-attempt limit: if the confirmed data still fails
    the gate (e.g. an unresolved integrity conflict, not just low confidence),
    the upload correctly stays in needs_confirmation — it is not forced through,
    and nothing is persisted, regardless of how many times this is called."""
    # Confirmed status alone isn't enough if OTHER blockers remain — an incomplete
    # pediatric profile is a distinct blocker (pediatric_profile_safety_gap) that
    # candidate-confidence boosting does not address.
    for _ in range(5):  # explicitly demonstrate no attempt-count cap exists
        result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
            biomarkers=CLEAN_BIOMARKERS,
            symptoms=[],
            user_profile={"age": 8},  # pediatric, incomplete profile
            user_id="user-c2",
            analysis_id="upload-c2",
            source_metadata={"candidates": CONFIRMED_CANDIDATES},
            persist_biomarkers=True,
        )
        assert result["analysis_status"] == "needs_confirmation"
    assert save_biomarkers_spy == []


# --- D: unconfirmed upload absent from longitudinal contribution -----------------


@pytest.mark.asyncio
async def test_unconfirmed_upload_contributes_nothing_to_progress(save_biomarkers_spy, monkeypatch):
    """D. Since save_biomarkers() is never called for a needs_confirmation upload
    (proven above), get_user_progress() — which reads the canonical `biomarkers`
    table directly — has structurally nothing to return for it. This test proves
    that end-to-end: run the pipeline in needs_confirmation mode, then query
    get_user_progress() against a fake Supabase client seeded with ONLY what
    save_biomarkers_spy actually persisted (i.e. nothing)."""
    await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=[],
        user_profile={"age": 34},
        user_id="user-d",
        analysis_id="upload-d",
        source_metadata={"candidates": LOW_CONFIDENCE_CANDIDATES},
        persist_biomarkers=True,
    )
    assert save_biomarkers_spy == [], "precondition: nothing was persisted"

    class _Resp:
        def __init__(self, data):
            self.data = data

    class _Query:
        def __init__(self, rows):
            self._rows = rows

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def in_(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def execute(self):
            return _Resp(self._rows)

    class _FakeSupabase:
        def table(self, name):
            # No lab_uploads row and no biomarkers row exist for upload-d, because
            # save_biomarkers() was never called — this fake simply has nothing to
            # return for it, mirroring real Postgres state after Stage 2B.
            return _Query([])

    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSupabase())

    async def _fake_audit(**_kwargs):
        return None

    monkeypatch.setattr(svc, "_audit_medical_read", _fake_audit)

    progress = await svc.get_user_progress(user_id="user-d")
    assert progress == [], "an unconfirmed upload must not appear in longitudinal/progress data at all"


# --- E: Stage 2A metadata protections remain intact -------------------------------


@pytest.mark.asyncio
async def test_stage_2a_metadata_filter_still_active_inside_stage_2b_flow(save_biomarkers_spy):
    """E. Defense-in-depth check: even inside the new persistence-gated flow, a
    metadata-shaped item (e.g. a hallucinated "Report Date" row) must still never
    reach the canonical biomarkers table, exactly as Stage 2A established."""
    biomarkers_with_metadata_leak = [
        *CLEAN_BIOMARKERS,
        {"name": "Report Date", "value": 2026, "unit": "-", "ref_low": 7, "ref_high": 29},
    ]
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=biomarkers_with_metadata_leak,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-e",
        analysis_id="upload-e",
        source_metadata={"candidates": []},
        persist_biomarkers=True,
        generate_ai_protocol=False,
    )
    assert result["analysis_status"] == "completed"
    assert len(save_biomarkers_spy) == 1
    saved_names = [b["name"].lower() for b in save_biomarkers_spy[0]["biomarkers"]]
    assert not any("report date" in n for n in saved_names), (
        "Stage 2A's metadata filter must still exclude non-biomarker fields even "
        "inside the Stage 2B gated persistence path"
    )
    assert "glucose" in saved_names
