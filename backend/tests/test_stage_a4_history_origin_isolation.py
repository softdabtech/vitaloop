import pytest

from app.routers.analysis import uploads as uploads_router
from app.services import supabase_service as svc
from app.services.progress_overview import build_progress_overview


class _Response:
    def __init__(self, data):
        self.data = data
        self.count = None


class _Query:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def in_(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        return _Response(self.rows)


class _Supabase:
    def __init__(self, uploads, biomarkers=None):
        self.uploads = uploads
        self.biomarkers = biomarkers or []

    def table(self, name):
        if name == "lab_uploads":
            return _Query(self.uploads)
        if name == "biomarkers":
            return _Query(self.biomarkers)
        raise AssertionError(name)


def _upload(upload_id, origin, *, test_date):
    return {
        "id": upload_id,
        "created_at": f"{test_date}T12:00:00Z",
        "lab_name": upload_id,
        "test_date": test_date,
        "collected_at": None,
        "reported_at": None,
        "date_source": "user_provided",
        "date_confidence": "high",
        "status": "done",
        "data_origin": origin,
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("origin", ["synthetic", "qa", "smoke", "validation"])
async def test_progress_hides_explicit_non_clinical_origins(monkeypatch, origin):
    uploads = [
        _upload("clinical", "clinical", test_date="2026-01-01"),
        _upload("legacy", "legacy_unclassified", test_date="2026-02-01"),
        _upload("excluded", origin, test_date="2026-03-01"),
    ]
    monkeypatch.setattr(svc, "_get_supabase", lambda: _Supabase(uploads))
    monkeypatch.setattr(svc, "_audit_medical_read", lambda **_kwargs: None)

    async def no_audit(**_kwargs):
        return None

    monkeypatch.setattr(svc, "_audit_medical_read", no_audit)

    result = await svc.get_user_progress("user-a4")

    assert [row["id"] for row in result] == ["legacy", "clinical"]
    assert all("data_origin" not in row for row in result)


@pytest.mark.asyncio
async def test_upload_count_excludes_explicit_non_clinical_origins(monkeypatch):
    uploads = [
        {"id": "clinical", "data_origin": "clinical"},
        {"id": "legacy", "data_origin": "legacy_unclassified"},
        {"id": "synthetic", "data_origin": "synthetic"},
        {"id": "qa", "data_origin": "qa"},
        {"id": "smoke", "data_origin": "smoke"},
        {"id": "validation", "data_origin": "validation"},
    ]
    monkeypatch.setattr(svc, "_get_supabase", lambda: _Supabase(uploads))

    async def run(operation, **_kwargs):
        return operation()

    monkeypatch.setattr(svc, "_run", run)

    assert await svc.get_user_upload_count("user-a4") == 2


@pytest.mark.asyncio
async def test_recent_upload_returns_most_recent_eligible_history(monkeypatch):
    uploads = [
        _upload("synthetic", "synthetic", test_date="2026-03-01"),
        _upload("clinical", "clinical", test_date="2026-02-01"),
    ]
    monkeypatch.setattr(uploads_router, "_get_supabase", lambda: _Supabase(uploads))

    async def run(operation, **_kwargs):
        return operation()

    monkeypatch.setattr(uploads_router, "_run", run)

    result = await uploads_router.get_recent_uploads({"sub": "user-a4"})

    assert [row["id"] for row in result] == ["clinical"]
    assert "data_origin" not in result[0]


@pytest.mark.parametrize("origin", ["synthetic", "qa", "smoke", "validation"])
def test_progress_overview_excludes_non_clinical_points_when_rows_are_filtered(origin):
    rows = [
        {
            **_upload("clinical", "clinical", test_date="2026-01-01"),
            "biomarkers": [{"name": "Hemoglobin", "value": 89, "unit": "g/L", "status": "LOW"}],
        },
        {
            **_upload("excluded", origin, test_date="2026-02-01"),
            "biomarkers": [{"name": "Hemoglobin", "value": 132, "unit": "g/L", "status": "OPTIMAL"}],
        },
        {
            **_upload("legacy", "legacy_unclassified", test_date="2026-03-01"),
            "biomarkers": [{"name": "Hemoglobin", "value": 140, "unit": "g/L", "status": "OPTIMAL"}],
        },
    ]

    eligible_rows = [
        row for row in rows if svc._is_clinical_upload_origin(row["data_origin"])
    ]
    overview = build_progress_overview(eligible_rows)
    marker = overview["all_comparable_markers"][0]

    assert marker["first_value"] == 89.0
    assert marker["previous_value"] == 89.0
    assert marker["latest_value"] == 140.0
    assert all(point["value"] != 132.0 for point in marker["history"])


def test_progress_overview_preserves_unknown_unit_fail_closed():
    overview = build_progress_overview(
        [
            {
                "id": "u1",
                "test_date": "2026-01-01",
                "biomarkers": [{"name": "Hemoglobin", "value": 89, "unit": "unknown", "status": "LOW"}],
            },
            {
                "id": "u2",
                "test_date": "2026-02-01",
                "biomarkers": [{"name": "Hemoglobin", "value": 132, "unit": "unknown", "status": "OPTIMAL"}],
            },
        ]
    )

    marker = overview["insufficient_history_markers"][0]
    assert marker["comparison_status"] == "insufficient_comparable_history"
    assert marker["comparison_reason"] == "unverified_unit_conversion"


def test_progress_overview_preserves_missing_date_fail_closed():
    overview = build_progress_overview(
        [
            {
                "id": "u1",
                "created_at": "2026-01-01T00:00:00Z",
                "biomarkers": [{"name": "Hemoglobin", "value": 89, "unit": "g/L", "status": "LOW"}],
            },
            {
                "id": "u2",
                "created_at": "2026-02-01T00:00:00Z",
                "biomarkers": [{"name": "Hemoglobin", "value": 132, "unit": "g/L", "status": "OPTIMAL"}],
            },
        ]
    )

    assert overview["top_changes"] == []
    assert overview["summary"]["uploads_with_lab_date"] == 0
