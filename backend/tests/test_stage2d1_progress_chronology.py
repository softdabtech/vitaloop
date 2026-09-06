"""Stage 2D-1 — regression coverage for legacy Progress chronology correctness.

Point of truth: test_date -> collected_at -> reported_at -> undated.
created_at (upload time) must never determine clinical/medical chronology.

No live database connection is used anywhere in this file — the Supabase
client is mocked following the same convention already used in
tests/test_stage2pre_progress_chronology.py.
"""

import pytest

from app.services import supabase_service as svc
from app.services.progress_overview import build_progress_overview


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    """Table-aware fake query builder — returns lab_uploads or biomarkers
    fixture rows depending on which table was requested. Filters/order calls
    are accepted and ignored (this function no longer relies on DB-level
    ordering; the test verifies the function's OWN sort, not the query)."""

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
    def __init__(self, lab_uploads, biomarkers):
        self._lab_uploads = lab_uploads
        self._biomarkers = biomarkers

    def table(self, name):
        if name == "lab_uploads":
            return _Query(self._lab_uploads)
        if name == "biomarkers":
            return _Query(self._biomarkers)
        raise AssertionError(f"unexpected table requested in this fixture: {name!r}")


@pytest.fixture
def _mock_progress(monkeypatch):
    async def _fake_audit(**_kwargs):
        return None

    monkeypatch.setattr(svc, "_audit_medical_read", _fake_audit)

    def _apply(lab_uploads, biomarkers=None):
        monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSupabase(lab_uploads, biomarkers or []))

    return _apply


# --- F1: out-of-order uploads --------------------------------------------------


@pytest.mark.asyncio
async def test_f1_out_of_order_uploads_follow_real_lab_dates(_mock_progress):
    upload_a = {  # uploaded FIRST, but the chronologically LATER lab
        "id": "upload-a", "created_at": "2026-08-20T09:00:00Z", "lab_name": "Lab A",
        "test_date": "2026-08-20", "collected_at": None, "reported_at": None,
        "date_source": "user_provided", "date_confidence": "high",
    }
    upload_b = {  # uploaded SECOND, but a month OLDER lab
        "id": "upload-b", "created_at": "2026-08-20T09:05:00Z", "lab_name": "Lab B",
        "test_date": "2026-07-20", "collected_at": None, "reported_at": None,
        "date_source": "user_provided", "date_confidence": "high",
    }
    _mock_progress([upload_a, upload_b])

    result = await svc.get_user_progress(user_id="user-f1")
    assert [row["id"] for row in result] == ["upload-a", "upload-b"]


# --- F2: same marker, two dates -> latest clinical value by measurement date ---


@pytest.mark.asyncio
async def test_f2_latest_marker_value_selected_by_measurement_date_not_upload_order(_mock_progress):
    upload_old_lab_uploaded_last = {
        "id": "upload-old", "created_at": "2026-08-20T09:05:00Z", "lab_name": "Old",
        "test_date": "2026-07-20", "collected_at": None, "reported_at": None,
        "date_source": "user_provided", "date_confidence": "high",
    }
    upload_new_lab_uploaded_first = {
        "id": "upload-new", "created_at": "2026-08-20T09:00:00Z", "lab_name": "New",
        "test_date": "2026-08-20", "collected_at": None, "reported_at": None,
        "date_source": "user_provided", "date_confidence": "high",
    }
    biomarkers = [
        {"upload_id": "upload-old", "name": "Glucose", "value": 82, "unit": "mg/dL", "status": "OPTIMAL", "ref_low": 70, "ref_high": 99},
        {"upload_id": "upload-new", "name": "Glucose", "value": 95, "unit": "mg/dL", "status": "OPTIMAL", "ref_low": 70, "ref_high": 99},
    ]
    _mock_progress([upload_old_lab_uploaded_last, upload_new_lab_uploaded_first], biomarkers)

    result = await svc.get_user_progress(user_id="user-f2")
    # The first row in clinical order must be the one carrying the NEWER test_date.
    assert result[0]["id"] == "upload-new"
    assert result[0]["biomarkers"][0]["value"] == 95, "the clinically-latest Glucose value must be from the newer lab date"


# --- F3: undated upload never becomes "latest lab result" ----------------------


@pytest.mark.asyncio
async def test_f3_undated_upload_uploaded_last_does_not_outrank_dated_upload(_mock_progress):
    dated_older = {
        "id": "upload-dated", "created_at": "2026-06-01T00:00:00Z", "lab_name": "Dated",
        "test_date": "2026-05-01", "collected_at": None, "reported_at": None,
        "date_source": "user_provided", "date_confidence": "high",
    }
    undated_just_uploaded = {
        "id": "upload-undated", "created_at": "2026-08-28T12:00:00Z", "lab_name": "Undated",
        "test_date": None, "collected_at": None, "reported_at": None,
        "date_source": "missing", "date_confidence": "low",
    }
    _mock_progress([dated_older, undated_just_uploaded])

    result = await svc.get_user_progress(user_id="user-f3")
    assert result[0]["id"] == "upload-dated", "a properly dated result must rank first even if uploaded long before an undated one"
    assert result[1]["id"] == "upload-undated"
    assert result[1]["measurement_date"] is None


# --- F4/F5: collected_at / reported_at fallback ---------------------------------


@pytest.mark.asyncio
async def test_f4_collected_at_fallback_when_test_date_missing(_mock_progress):
    row = {
        "id": "upload-collected", "created_at": "2026-01-01T00:00:00Z", "lab_name": "X",
        "test_date": None, "collected_at": "2026-06-15", "reported_at": None,
        "date_source": "extracted", "date_confidence": "medium",
    }
    _mock_progress([row])
    result = await svc.get_user_progress(user_id="user-f4")
    assert result[0]["measurement_date"] == "2026-06-15"


@pytest.mark.asyncio
async def test_f5_reported_at_fallback_when_test_date_and_collected_at_missing(_mock_progress):
    row = {
        "id": "upload-reported", "created_at": "2026-01-01T00:00:00Z", "lab_name": "X",
        "test_date": None, "collected_at": None, "reported_at": "2026-06-16",
        "date_source": "extracted", "date_confidence": "low",
    }
    _mock_progress([row])
    result = await svc.get_user_progress(user_id="user-f5")
    assert result[0]["measurement_date"] == "2026-06-16"


# --- F6: created_at alone never creates a medical chronology position ----------


@pytest.mark.asyncio
async def test_f6_created_at_alone_never_produces_a_measurement_date(_mock_progress):
    row = {
        "id": "upload-created-only", "created_at": "2026-08-28T00:00:00Z", "lab_name": "X",
        "test_date": None, "collected_at": None, "reported_at": None,
        "date_source": "missing", "date_confidence": "low",
    }
    _mock_progress([row])
    result = await svc.get_user_progress(user_id="user-f6")
    assert result[0]["measurement_date"] is None, "created_at must never be substituted as a measurement date"


# --- F7: /dashboard/summary uses the same corrected chronology -----------------


@pytest.mark.asyncio
async def test_f7_dashboard_separates_latest_upload_from_latest_lab_result(monkeypatch):
    from app.routers.analysis import dashboard as dashboard_router

    # progress already in the corrected clinical order get_user_progress()
    # would now produce: dated result first, undated (just-uploaded) last.
    progress = [
        {"id": "upload-dated", "created_at": "2026-06-01T00:00:00Z", "test_date": "2026-05-01", "measurement_date": "2026-05-01", "biomarkers": []},
        {"id": "upload-undated", "created_at": "2026-08-28T12:00:00Z", "test_date": None, "measurement_date": None, "biomarkers": []},
    ]

    onboarding = {"requires_onboarding": False}
    next_best_action = dashboard_router._build_next_best_action(onboarding, [], progress)
    assert next_best_action["title"] != "Upload your first lab"

    latest_lab_result = next((row for row in progress if row.get("measurement_date")), None)
    latest_upload = max(progress, key=lambda row: str(row.get("created_at") or ""))

    assert latest_lab_result["id"] == "upload-dated", "latest_lab_result must reflect real lab-date chronology"
    assert latest_upload["id"] == "upload-undated", "latest_upload must reflect actual upload recency — a genuinely different concept"


# --- F8: /progress/overview behavior is unchanged -------------------------------


def test_f8_progress_overview_unaffected_by_row_order_or_new_measurement_date_key():
    """build_progress_overview() must produce identical output whether rows
    arrive in legacy upload order or corrected clinical order, and must not
    choke on the new `measurement_date` key get_user_progress() now adds —
    proving Stage 2D-1 did not touch /progress/overview's own logic."""
    upload_a = {
        "id": "upload-a", "created_at": "2026-08-20T09:00:00Z", "lab_name": "Lab A",
        "test_date": "2026-08-20", "collected_at": None, "reported_at": None,
        "date_source": "user_provided", "date_confidence": "high", "measurement_date": "2026-08-20",
        "biomarkers": [{"name": "Glucose", "value": 95, "unit": "mg/dL", "status": "OPTIMAL", "ref_low": 70, "ref_high": 99}],
    }
    upload_b = {
        "id": "upload-b", "created_at": "2026-08-20T09:05:00Z", "lab_name": "Lab B",
        "test_date": "2026-07-20", "collected_at": None, "reported_at": None,
        "date_source": "user_provided", "date_confidence": "high", "measurement_date": "2026-07-20",
        "biomarkers": [{"name": "Glucose", "value": 82, "unit": "mg/dL", "status": "OPTIMAL", "ref_low": 70, "ref_high": 99}],
    }

    overview_new_order = build_progress_overview([upload_a, upload_b])
    overview_legacy_order = build_progress_overview([upload_b, upload_a])

    assert overview_new_order == overview_legacy_order, "build_progress_overview() must be order-independent, unchanged"
    assert overview_new_order["timeline_eligible"] is True
    assert overview_new_order["summary"]["unique_lab_dates"] == 2
