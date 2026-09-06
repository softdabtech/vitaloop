"""Stage 2PRE — regression harness for the metadata-hallucinated-as-biomarker bug (F04).

Stage 2A closes this at TWO independent boundaries, both using the exact same
`is_metadata_field()` classifier (no duplicated filtering logic):

  1. `normalize_biomarkers()` (app/services/lab_analysis_pipeline.py) — keeps metadata
     out of the in-memory pipeline output (interpreted_report/protocol/knowledge_report).
  2. `save_biomarkers()` (app/services/supabase_service.py) — the shared persistence
     chokepoint every write path funnels through — keeps metadata out of the canonical
     `biomarkers` DB table itself, and therefore out of everything that reads it
     directly (dashboard, /progress, /progress/overview, insights/health-score).

Both must hold for the Stage 2A acceptance criterion ("metadata must not become a
biomarker") to be genuinely satisfied — filtering only #1 would still let a bad row
reach the dashboard, since those read paths query the DB table directly, not the
pipeline's in-memory output (confirmed via the Stage 2 planning trace).

Expected status against CURRENT production code (before this extended Stage 2A change):
  - all metadata-reproduction tests (normalize_biomarkers AND save_biomarkers layers) -> RED
  - both uncommon-legitimate-biomarker tests (C1, both layers)                        -> GREEN

The fixture values mirror the exact live-reproduced Stage 1 audit finding:
a "Report Date: 2026-07-29" line was persisted as a biomarker named "Report Date"
with value 2026, ref_low 7, ref_high 29, status ELEVATED.
"""

import pytest

from app.services import supabase_service as svc
from app.services.lab_analysis_pipeline import normalize_biomarkers


def test_metadata_line_is_not_extracted_as_biomarker():
    """Reproduces Stage 1 finding F04. Currently RED — no metadata filter exists yet."""
    raw_candidates = [
        # The exact hallucinated shape observed live in Stage 1's production audit.
        {"name": "Report Date", "value": 2026, "unit": "-", "ref_low": 7, "ref_high": 29},
        # A real marker from the same document, must still pass through.
        {"name": "Glucose", "value": 92, "unit": "mg/dL", "ref_low": 70, "ref_high": 99},
    ]

    result = normalize_biomarkers(raw_candidates)
    names = [item["name"].lower() for item in result]

    assert "glucose" in names, "the real biomarker in the same document must still be extracted"
    assert not any("report date" in n or "date" in n for n in names), (
        "a document-metadata field (Report Date) must not be persisted as a biomarker candidate — "
        "this fixture reproduces the exact live Stage 1 finding (F04); it should turn GREEN once "
        "Stage 2A's metadata-field classifier is added to normalize_biomarkers()"
    )


def test_common_metadata_field_variants_are_not_extracted_as_biomarkers():
    """Broader coverage of the metadata categories named in the Stage 2 brief. Currently RED."""
    metadata_like = [
        {"name": "Collection Date", "value": 2026, "unit": "-", "ref_low": 1, "ref_high": 12},
        {"name": "Patient ID", "value": 84421, "unit": "-"},
        {"name": "Page", "value": 1, "unit": "-", "ref_low": 1, "ref_high": 3},
        {"name": "Specimen ID", "value": 55213, "unit": "-"},
    ]
    real_marker = {"name": "TSH", "value": 2.1, "unit": "mIU/L", "ref_low": 0.4, "ref_high": 4.0}

    result = normalize_biomarkers(metadata_like + [real_marker])
    names = [item["name"].lower() for item in result]

    assert "tsh" in names
    for leaked in ("collection date", "patient id", "specimen id"):
        assert not any(leaked in n for n in names), f"metadata field leaked through as biomarker: {leaked!r} matched one of {names}"


def test_uncommon_legitimate_biomarker_is_not_dropped():
    """Guards against over-filtering (Test C1). Should already be GREEN today and must
    stay GREEN after Stage 2A ships — an uncommon marker not in the canonical alias
    dictionary must still be accepted as a candidate, not silently discarded."""
    raw_candidates = [
        # Not in biomarker_mapping.py's _CANONICAL_MAP — a real, if uncommon, lab marker.
        {"name": "Lipoprotein(a)", "value": 45, "unit": "nmol/L", "ref_low": 0, "ref_high": 75},
        {"name": "Glucose", "value": 92, "unit": "mg/dL", "ref_low": 70, "ref_high": 99},
    ]

    result = normalize_biomarkers(raw_candidates)
    names = [item["name"].lower() for item in result]

    assert "glucose" in names
    assert any("lipoprotein" in n for n in names), (
        "an uncommon but legitimate biomarker not present in the canonical alias map "
        "must still be accepted as a candidate, not treated as metadata or dropped"
    )


# --- Persistence-layer coverage: save_biomarkers() -----------------------------
#
# Mocks the Supabase client chain following the same convention already used in
# tests/test_supabase_service_results_helpers.py and
# tests/test_stage2pre_progress_chronology.py. No real database connection is used.
# The fake captures exactly what would be sent to `.insert(...)` so these tests prove
# what actually reaches the persistence payload, not just what the function returns.


class _Resp:
    def __init__(self, data):
        self.data = data


class _BiomarkersTableSpy:
    """Fake `supabase.table("biomarkers")` builder. Records the payload passed to
    insert() so tests can assert on exactly what would have been written to the
    canonical biomarkers table."""

    def __init__(self, capture: dict):
        self._capture = capture

    def delete(self):
        return self

    def insert(self, rows):
        self._capture["inserted_rows"] = rows
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def execute(self):
        return _Resp(self._capture.get("inserted_rows") or [])


class _LabUploadsTableStub:
    def update(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def execute(self):
        return _Resp([])


class _FakeSupabaseForSaveBiomarkers:
    def __init__(self, capture: dict):
        self._capture = capture

    def table(self, name):
        if name == "biomarkers":
            return _BiomarkersTableSpy(self._capture)
        if name == "lab_uploads":
            return _LabUploadsTableStub()
        raise AssertionError(f"unexpected table requested in this fixture: {name!r}")


@pytest.fixture
def _capture_saved_rows(monkeypatch):
    """Wires save_biomarkers() to the fake client above and returns the dict that
    will contain whatever rows it actually tried to insert."""
    capture: dict = {}
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSupabaseForSaveBiomarkers(capture))

    async def _fake_run(callable_):
        return callable_()

    monkeypatch.setattr(svc, "_run", _fake_run)
    return capture


@pytest.mark.asyncio
async def test_metadata_field_does_not_reach_save_biomarkers_persistence_payload(_capture_saved_rows):
    """Proves layer 2: even if a metadata-shaped item reaches save_biomarkers() (e.g.
    from a caller that has not itself normalized/filtered it), it is stripped before
    the insert() payload is built — the exact live Stage 1 finding must never reach
    the canonical biomarkers table."""
    raw_biomarkers = [
        {"name": "Report Date", "value": 2026, "unit": "-", "ref_low": 7, "ref_high": 29, "status": "ELEVATED"},
        {"name": "Glucose", "value": 92, "unit": "mg/dL", "ref_low": 70, "ref_high": 99, "status": "OPTIMAL"},
    ]

    await svc.save_biomarkers(upload_id="upload-audit-test", user_id="user-audit-test", biomarkers=raw_biomarkers)

    inserted_names = [row["name"].lower() for row in _capture_saved_rows["inserted_rows"]]
    assert "glucose" in inserted_names
    assert not any("report date" in n for n in inserted_names), (
        f"a document-metadata field reached the save_biomarkers() insert payload: {inserted_names!r} — "
        "this is precisely what the Stage 2A extension (filtering at the save_biomarkers() chokepoint) "
        "exists to prevent, per docs/audit/VITALOOP_STAGE2_IMPLEMENTATION_PLAN.md, Stage 2A"
    )


@pytest.mark.asyncio
async def test_uncommon_legitimate_biomarker_still_reaches_persistence(_capture_saved_rows):
    """Test C1, persistence layer. An uncommon legitimate biomarker must still be
    written to the canonical table — the save_biomarkers() filter must not
    over-filter any more than normalize_biomarkers() does."""
    raw_biomarkers = [
        {"name": "Lipoprotein(a)", "value": 45, "unit": "nmol/L", "ref_low": 0, "ref_high": 75, "status": "OPTIMAL"},
        {"name": "Glucose", "value": 92, "unit": "mg/dL", "ref_low": 70, "ref_high": 99, "status": "OPTIMAL"},
    ]

    await svc.save_biomarkers(upload_id="upload-audit-test", user_id="user-audit-test", biomarkers=raw_biomarkers)

    inserted_names = [row["name"].lower() for row in _capture_saved_rows["inserted_rows"]]
    assert "glucose" in inserted_names
    assert any("lipoprotein" in n for n in inserted_names), (
        "an uncommon but legitimate biomarker must still reach the canonical "
        "biomarkers table via save_biomarkers(), not be silently dropped"
    )
