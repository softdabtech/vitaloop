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
from app.services.progress_overview import build_progress_overview


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
PROFILE_52F = {"age": 52, "sex": "female", "height_cm": 165, "weight_kg": 92}


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


@pytest.mark.asyncio
async def test_confirmed_batch_filters_conflicted_marker_and_persists_safe_critical_markers(save_biomarkers_spy):
    """A confirmed batch may contain one unresolved marker-level conflict.

    The conflicted marker must not be trusted, but it must not keep the safe
    confirmed markers out of canonical persistence and safety evaluation.
    """

    biomarkers = [
        {"name": "Absolute Neutrophils", "value": 0.38, "unit": "x10^9/L", "ref_low": 1.5, "ref_high": 7.5, "status": "DEFICIENT"},
        {"name": "Potassium", "value": 2.5, "unit": "mmol/L", "ref_low": 3.5, "ref_high": 5.1, "status": "DEFICIENT"},
        {"name": "Platelets", "value": 54, "unit": "x10^9/L", "ref_low": 150, "ref_high": 400, "status": "DEFICIENT"},
        {"name": "Hemoglobin", "value": 8.4, "unit": "g/dL", "ref_low": 12, "ref_high": 15.5, "status": "DEFICIENT"},
        {"name": "Coagulation Marker", "value": 1.8, "unit": "mg/L FEU", "ref_low": 0, "ref_high": 0.5, "status": "ELEVATED"},
    ]
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=biomarkers,
        symptoms=["severe fatigue", "dizziness", "palpitations"],
        questionnaire={"completed": True},
        user_profile=PROFILE_52F,
        user_id="user-confirmed-critical",
        analysis_id="upload-confirmed-critical",
        source_metadata={"source": "candidate_confirmation", "candidates": [{"confidence_score": 0.4, "status": "confirmed"} for _ in biomarkers]},
        persist_biomarkers=True,
        generate_ai_protocol=False,
    )

    assert result["analysis_status"] == "completed", result["analysis_input_quality_gate"]
    assert result["analysis_input_quality_gate"]["decision"] == "auto_continue"
    assert result["metadata"]["source"]["confirmation_safe_subset"]["excluded_marker_count"] == 1
    assert len(save_biomarkers_spy) == 1
    saved_names = {item["name"] for item in save_biomarkers_spy[0]["biomarkers"]}
    assert "Coagulation Marker" not in saved_names
    assert {"Absolute Neutrophils", "Potassium", "Platelets", "Hemoglobin"} <= saved_names
    assert result["safety_result"]["risk_level"] == "urgent_review"
    assert result["safety_result"]["urgent_review_required"] is True


@pytest.mark.asyncio
async def test_unconfirmed_conflicted_batch_stays_pending_and_does_not_trigger_urgent_review(save_biomarkers_spy):
    biomarkers = [
        {"name": "Absolute Neutrophils", "value": 0.38, "unit": "x10^9/L", "ref_low": 1.5, "ref_high": 7.5, "status": "DEFICIENT"},
        {"name": "Coagulation Marker", "value": 1.8, "unit": "mg/L FEU", "ref_low": 0, "ref_high": 0.5, "status": "ELEVATED"},
    ]
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=biomarkers,
        symptoms=["severe fatigue"],
        user_profile=PROFILE_52F,
        user_id="user-pending-critical",
        analysis_id="upload-pending-critical",
        source_metadata={"source": "b2c_file", "candidates": [{"confidence_score": 0.4, "status": "pending"} for _ in biomarkers]},
        persist_biomarkers=True,
        generate_ai_protocol=False,
    )

    assert result["analysis_status"] == "needs_confirmation"
    assert save_biomarkers_spy == []
    assert result.get("safety_result") is None


@pytest.mark.asyncio
@pytest.mark.parametrize("source", ["results_read", "report_regeneration", "results_compatibility"])
async def test_canonical_reprocessing_sources_get_safe_subset_too(source, save_biomarkers_spy):
    """P1 fix (2026-09-12 clinical analyzer audit).

    Before this fix, _is_candidate_confirmation() only recognized
    source=="candidate_confirmation" — every OTHER read/regenerate path that
    re-runs the pipeline against ALREADY-persisted canonical biomarkers (they
    only exist in storage because they cleared this same gate once already)
    had no safe-subset path, so one marker with e.g. an unrecognized unit
    forced the whole upload back into "needs_confirmation" on every single
    read. These sources must now get the same drop-the-conflicted-marker
    treatment as candidate_confirmation, with no candidates array required.
    """

    biomarkers = [
        {"name": "Hemoglobin", "value": 8.4, "unit": "g/dL", "ref_low": 12, "ref_high": 15.5, "status": "DEFICIENT"},
        {"name": "Potassium", "value": 2.5, "unit": "mmol/L", "ref_low": 3.5, "ref_high": 5.1, "status": "DEFICIENT"},
        {"name": "Coagulation Marker", "value": 1.8, "unit": "mg/L FEU", "ref_low": 0, "ref_high": 0.5, "status": "ELEVATED"},
    ]
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=biomarkers,
        symptoms=["severe fatigue"],
        user_profile=PROFILE_52F,
        user_id="user-reprocessing",
        analysis_id="upload-reprocessing",
        source_metadata={"source": source},
        generate_ai_protocol=False,
    )

    assert result["analysis_status"] == "completed", result["analysis_input_quality_gate"]
    assert result["metadata"]["source"]["confirmation_safe_subset"]["excluded_marker_count"] == 1
    assert result["metadata"]["source"]["confirmation_safe_subset"]["excluded_markers"][0]["name"] == "Coagulation Marker"


def test_progress_overview_counts_confirmed_lab_date_markers_not_created_at():
    overview = build_progress_overview(
        [
            {
                "id": "upload-2026-09-07",
                "lab_name": "Confirmed critical panel",
                "test_date": "2026-09-07",
                "created_at": "2026-09-08T12:00:00Z",
                "biomarkers": [
                    {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 8.4, "unit": "g/dL", "status": "DEFICIENT"},
                    {"name": "Platelets", "canonical_name": "platelets", "value": 54, "unit": "x10^9/L", "status": "DEFICIENT"},
                ],
            },
            {
                "id": "upload-2026-09-05",
                "lab_name": "Previous panel",
                "test_date": "2026-09-05",
                "created_at": "2026-09-09T12:00:00Z",
                "biomarkers": [
                    {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 9.1, "unit": "g/dL", "status": "DEFICIENT"},
                    {"name": "Platelets", "canonical_name": "platelets", "value": 62, "unit": "x10^9/L", "status": "DEFICIENT"},
                ],
            },
        ]
    )

    assert overview["summary"]["latest_lab_date"] == "2026-09-07"
    assert overview["summary"]["markers_with_2plus_dates"] == 2
    assert "2026-09-08" not in {item["date"] for item in overview["date_spine"]}
    assert "2026-09-09" not in {item["date"] for item in overview["date_spine"]}


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
