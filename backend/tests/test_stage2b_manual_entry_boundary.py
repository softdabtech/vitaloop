"""Stage 2B (manual-entry gap closure) — regression coverage.

Root cause closed: `biomarker_service.create_upload_from_manual_entries()` used
to write directly to the canonical `biomarkers` table, bypassing the
quality-gate/confirmation boundary every other B2C ingestion path (PDF/image/
text) already goes through via `run_lab_analysis_pipeline(persist_biomarkers=True)`.
It no longer does — this file proves that at both the persistence-function level
(M0, direct) and the pipeline-boundary level (M1-M4, reusing the exact same
mechanism `analyze.py`'s manual-entry route now calls), with NO second gate
implementation and NO gate-threshold changes.

No live database connection is used anywhere in this file.
"""

from datetime import datetime, timezone

import pytest

from app.services import biomarker_service as bm_service
from app.services import supabase_service as svc
from app.services.analysis_candidates import build_candidate_payloads
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline


CONFIDENT_PROFILE = {
    "age": 34,
    "sex": "female",
    "height_cm": 168,
    "weight_kg": 62,
    "current_medications": ["none"],
}


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, rows, on_insert=None):
        self._rows = rows
        self._on_insert = on_insert

    def insert(self, payload):
        if self._on_insert is not None:
            self._on_insert(payload)
        return self

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def execute(self):
        return _Resp(self._rows if self._rows is not None else [{"id": "upload-manual-1"}])


class _FakeSupabaseForUploadCreate:
    """Tracks every table write so M0 can assert `biomarkers` is never touched."""

    def __init__(self):
        self.inserts_by_table = {}

    def table(self, name):
        def _record(payload):
            self.inserts_by_table.setdefault(name, []).append(payload)

        rows = [{"id": "upload-manual-1"}] if name == "lab_uploads" else []
        return _Query(rows, on_insert=_record)


# --- M0: create_upload_from_manual_entries no longer writes biomarkers ----------


@pytest.mark.asyncio
async def test_create_upload_from_manual_entries_does_not_write_biomarkers_table(monkeypatch):
    fake_supabase = _FakeSupabaseForUploadCreate()
    monkeypatch.setattr(svc, "_get_supabase", lambda: fake_supabase)

    async def _fake_run(fn):
        return fn()

    monkeypatch.setattr(svc, "_run", _fake_run)

    async def _fake_audit(**_kwargs):
        return None

    monkeypatch.setattr(svc, "write_audit_log", _fake_audit)

    entry = bm_service.ManualBiomarkerEntry(biomarker_id="ferritin", value=12.0, unit="ng/mL")
    entry.display_name = "Ferritin"
    entry.status = "DEFICIENT"
    entry.ref_low = 20
    entry.ref_high = 250

    service = bm_service.BiomarkerService()
    result = await service.create_upload_from_manual_entries(
        user_id="user-manual",
        entries=[entry],
        lab_name="Home Test",
        test_date=datetime.now(timezone.utc),
    )

    assert result["upload_id"] == "upload-manual-1"
    assert "biomarkers" not in fake_supabase.inserts_by_table, (
        "create_upload_from_manual_entries() must no longer insert into the "
        "canonical biomarkers table directly — persistence must happen inside "
        "run_lab_analysis_pipeline(), gated on the quality-gate decision"
    )
    assert "lab_uploads" in fake_supabase.inserts_by_table


# --- M1: valid manual input -> gate passes -> persisted once -> report ----------


@pytest.mark.asyncio
async def test_m1_valid_manual_input_auto_continues_and_persists(monkeypatch):
    calls = []

    async def _fake_save_biomarkers(upload_id, user_id, biomarkers):
        calls.append({"upload_id": upload_id, "biomarkers": biomarkers})
        return [{"id": "bm-1", **b} for b in biomarkers]

    async def _fake_history(_user_id):
        return []

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)
    monkeypatch.setattr("app.services.lab_analysis_pipeline._load_historical_biomarkers", _fake_history)

    manual_biomarkers = [
        {"name": "Vitamin D (25-OH)", "value": 18.0, "unit": "ng/mL", "ref_low": 30, "ref_high": 100, "status": "DEFICIENT"},
        {"name": "Ferritin", "value": 22.0, "unit": "ng/mL", "ref_low": 20, "ref_high": 250, "status": "BORDERLINE"},
    ]
    # Mirrors exactly what analyze.py's manual-entry route builds: source="manual"
    # candidates are auto-marked confirmed + high confidence by
    # build_candidate_payloads() (analysis_candidates.py) — the SAME mechanism
    # already reused for the PDF/text confirmation flow, no manual-only gate logic.
    manual_candidates = build_candidate_payloads(biomarkers=manual_biomarkers, source="manual")
    assert manual_candidates[0]["status"] == "confirmed"
    assert manual_candidates[0]["confidence_score"] == 1.0

    result = await run_lab_analysis_pipeline(
        biomarkers=manual_biomarkers,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-m1",
        analysis_id="upload-m1",
        source_metadata={"source": "b2c_manual", "candidates": manual_candidates},
        persist_biomarkers=True,
        generate_ai_protocol=False,
    )

    assert result["analysis_input_quality_gate"]["decision"] == "auto_continue", result["analysis_input_quality_gate"]
    assert result["analysis_status"] == "completed"
    assert len(calls) == 1, "canonical biomarkers must be persisted exactly once for valid manual input"
    assert result.get("interpreted_report") is not None
    assert result.get("protocol") is not None


# --- M2: manual input requiring confirmation ------------------------------------


@pytest.mark.asyncio
async def test_m2_low_confidence_manual_input_needs_confirmation_no_persistence(monkeypatch):
    calls = []

    async def _fake_save_biomarkers(upload_id, user_id, biomarkers):
        calls.append(biomarkers)
        return []

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)
    history_calls = {"count": 0}

    async def _fake_history(_user_id):
        history_calls["count"] += 1
        return []

    monkeypatch.setattr("app.services.lab_analysis_pipeline._load_historical_biomarkers", _fake_history)

    manual_biomarkers = [
        {"name": "Ferritin", "value": 22.0, "unit": "ng/mL", "ref_low": 20, "ref_high": 250, "status": "BORDERLINE"},
    ]
    # Deliberately override the manual-source confidence boost by marking the
    # candidate not-yet-confirmed (status="pending", low score) — simulates a
    # genuinely low-confidence/ambiguous manual submission (e.g. an entry the
    # client-side validator itself flagged) reaching the gate as such, WITHOUT
    # touching the gate's thresholds or introducing a manual-only code path.
    ambiguous_candidates = [{"status": "pending", "confidence_score": 0.2}]

    result = await run_lab_analysis_pipeline(
        biomarkers=manual_biomarkers,
        symptoms=[],
        user_profile={"age": 8},  # incomplete + pediatric, same as other paths' M2-equivalent
        user_id="user-m2",
        analysis_id="upload-m2",
        source_metadata={"source": "b2c_manual", "candidates": ambiguous_candidates},
        persist_biomarkers=True,
        persist_report_version=True,
        persist_knowledge=True,
    )

    assert result["analysis_input_quality_gate"]["decision"] in ("confirm", "block_or_confirm"), result["analysis_input_quality_gate"]
    assert result["analysis_status"] == "needs_confirmation"
    assert calls == [], "no canonical biomarkers may be persisted while manual-entry confirmation is pending"
    assert result.get("interpreted_report") is None
    assert result.get("protocol") is None
    assert result.get("report_version") is None
    assert history_calls["count"] == 0, "trend evaluation must not run for a pending manual upload either"


# --- M3: confirmed/corrected manual input ---------------------------------------


@pytest.mark.asyncio
async def test_m3_confirmed_manual_candidates_promote_once(monkeypatch):
    calls = []

    async def _fake_save_biomarkers(upload_id, user_id, biomarkers):
        calls.append(biomarkers)
        return [{"id": "bm-1", **b} for b in biomarkers]

    async def _fake_history(_user_id):
        return []

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)
    monkeypatch.setattr("app.services.lab_analysis_pipeline._load_historical_biomarkers", _fake_history)

    manual_biomarkers = [
        {"name": "Ferritin", "value": 22.0, "unit": "ng/mL", "ref_low": 20, "ref_high": 250, "status": "BORDERLINE"},
    ]
    # A candidate the user corrected/confirmed after an initial low-confidence
    # pass — status="confirmed" triggers the SAME _candidate_scores() boost
    # (analysis_quality_gate.py) reused across every ingestion path.
    confirmed_candidates = [{"status": "confirmed", "confidence_score": 0.3}]

    result = await run_lab_analysis_pipeline(
        biomarkers=manual_biomarkers,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-m3",
        analysis_id="upload-m3",
        source_metadata={"source": "b2c_manual", "candidates": confirmed_candidates},
        persist_biomarkers=True,
        generate_ai_protocol=False,
    )

    assert result["analysis_input_quality_gate"]["decision"] == "auto_continue", result["analysis_input_quality_gate"]
    assert result["analysis_status"] == "completed"
    assert len(calls) == 1, "confirmation must promote canonical biomarkers exactly once"
    assert result.get("interpreted_report") is not None


# --- M4: pending manual upload contributes nothing to longitudinal data ----------


@pytest.mark.asyncio
async def test_m4_pending_manual_upload_absent_from_progress(monkeypatch):
    async def _fake_save_biomarkers(*_a, **_k):
        raise AssertionError("save_biomarkers must not be called for a pending manual upload")

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)

    manual_biomarkers = [
        {"name": "Ferritin", "value": 22.0, "unit": "ng/mL", "ref_low": 20, "ref_high": 250, "status": "BORDERLINE"},
    ]
    ambiguous_candidates = [{"status": "pending", "confidence_score": 0.2}]

    result = await run_lab_analysis_pipeline(
        biomarkers=manual_biomarkers,
        symptoms=[],
        user_profile={"age": 8},
        user_id="user-m4",
        analysis_id="upload-m4",
        source_metadata={"source": "b2c_manual", "candidates": ambiguous_candidates},
        persist_biomarkers=True,
    )
    assert result["analysis_status"] == "needs_confirmation"

    class _Resp:
        def __init__(self, data):
            self.data = data

    class _Query:
        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def in_(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def execute(self):
            return _Resp([])

    class _FakeSupabase:
        def table(self, _name):
            return _Query()

    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSupabase())

    async def _fake_audit(**_kwargs):
        return None

    monkeypatch.setattr(svc, "_audit_medical_read", _fake_audit)

    progress = await svc.get_user_progress(user_id="user-m4")
    assert progress == [], "a pending manual upload must contribute nothing to longitudinal/progress data"
