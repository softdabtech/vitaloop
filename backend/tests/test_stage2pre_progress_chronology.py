"""Stage 2PRE — regression harness for Test F (out-of-order lab dates), per
docs/audit/VITALOOP_STAGE2_ACCEPTANCE_TESTS.md and finding F03.

Mocks the Supabase client chain (`_get_supabase().table(...).select(...).eq(...)
.order(...).execute()`) following the same pattern already established in
tests/test_supabase_service_results_helpers.py. No real Supabase/staging database
connection is required.

Expected status against CURRENT production code (before Stage 2D-1 ships):
  RED — `get_user_progress()` orders by `created_at` (upload time), not `test_date`
  (lab time), so an older lab uploaded second is returned as if it were "latest."
"""

import pytest

from app.services import supabase_service as svc


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    """Minimal fake query builder. Table-aware: returns lab_uploads or biomarkers
    fixture data depending on which table was requested, ignores filter args
    (since these fixtures are already scoped to one user_id and one upload set),
    and — critically — actually respects `.order(column, desc=...)` so the test
    exercises the real sort-column bug rather than assuming an order."""

    def __init__(self, rows):
        self._rows = list(rows)
        self._order_col = None
        self._order_desc = False

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def in_(self, *_args, **_kwargs):
        return self

    def order(self, column, desc=False):
        self._order_col = column
        self._order_desc = desc
        return self

    def execute(self):
        rows = self._rows
        if self._order_col:
            rows = sorted(
                rows,
                key=lambda r: r.get(self._order_col) or "",
                reverse=self._order_desc,
            )
        return _Resp(rows)


class _FakeSupabase:
    def __init__(self, lab_uploads, biomarkers):
        self._lab_uploads = lab_uploads
        self._biomarkers = biomarkers

    def table(self, name):
        if name == "lab_uploads":
            return _Query(self._lab_uploads)
        if name == "biomarkers":
            return _Query(self._biomarkers)
        raise AssertionError(f"unexpected table requested in this fixture: {name!r}")


# Upload A: uploaded FIRST (created_at earlier), but is the CHRONOLOGICALLY LATER lab
# (test_date 2026-08-20).
# Upload B: uploaded SECOND (created_at later), but is the CHRONOLOGICALLY EARLIER lab
# (test_date 2026-07-20).
# This exactly mirrors the regression case specified in the approved Stage 2 plan
# (Implementation Plan, Stage 2D-1).
UPLOAD_A = {
    "id": "upload-a-later-lab-date",
    "created_at": "2026-08-20T09:00:00Z",
    "lab_name": "AUDIT-TEST Lab A",
    "test_date": "2026-08-20",
    "collected_at": None,
    "reported_at": None,
    "date_source": "user_provided",
    "date_confidence": "high",
}
UPLOAD_B = {
    "id": "upload-b-earlier-lab-date",
    "created_at": "2026-08-20T09:05:00Z",  # uploaded 5 minutes after A
    "lab_name": "AUDIT-TEST Lab B",
    "test_date": "2026-07-20",  # but the lab itself is a month OLDER
    "collected_at": None,
    "reported_at": None,
    "date_source": "user_provided",
    "date_confidence": "high",
}


@pytest.mark.asyncio
async def test_progress_chronology_follows_test_date_not_upload_order(monkeypatch):
    monkeypatch.setattr(
        svc, "_get_supabase", lambda: _FakeSupabase([UPLOAD_A, UPLOAD_B], [])
    )

    async def _fake_audit_medical_read(**_kwargs):
        return None

    monkeypatch.setattr(svc, "_audit_medical_read", _fake_audit_medical_read)

    result = await svc.get_user_progress(user_id="audit-test-user")
    ordered_ids = [row["id"] for row in result]

    assert ordered_ids == [UPLOAD_A["id"], UPLOAD_B["id"]], (
        "get_user_progress() must return uploads in real lab-date order "
        f"(A, the chronologically later lab, first), not upload order. Got: {ordered_ids}. "
        "This reproduces F03 — currently RED because get_user_progress() sorts by "
        "created_at instead of test_date (see docs/audit/VITALOOP_STAGE2_IMPLEMENTATION_PLAN.md, "
        "Stage 2D-1)."
    )
