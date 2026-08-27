import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.protocol import progress as progress_router
from app.services.progress_overview import build_progress_overview


def _upload(upload_id, *, test_date=None, created_at="2026-08-01T10:00:00Z", biomarkers=None):
    return {
        "id": upload_id,
        "created_at": created_at,
        "lab_name": "Test lab",
        "test_date": test_date,
        "collected_at": None,
        "reported_at": None,
        "date_source": "extracted_test_date" if test_date else "missing",
        "date_confidence": "high" if test_date else None,
        "biomarkers": biomarkers or [],
    }


def _marker(name, value, status="normal", unit="ng/mL"):
    return {
        "name": name,
        "value": value,
        "unit": unit,
        "status": status,
        "ref_low": 30,
        "ref_high": 100,
    }


def test_progress_overview_never_uses_created_at_as_lab_date():
    overview = build_progress_overview(
        [
            _upload("u1", created_at="2026-01-01T10:00:00Z", biomarkers=[_marker("Ferritin", 20, "low")]),
            _upload("u2", created_at="2026-02-01T10:00:00Z", biomarkers=[_marker("Ferritin", 30, "normal")]),
        ]
    )

    assert overview["mode"] == "undated"
    assert overview["timeline_eligible"] is False
    assert overview["date_spine"] == []
    assert overview["summary"]["unique_lab_dates"] == 0
    assert overview["summary"]["uploads_missing_lab_date"] == 2
    assert overview["top_changes"] == []


def test_progress_overview_one_lab_date_is_snapshot_not_progress():
    overview = build_progress_overview(
        [
            _upload("u1", test_date="2026-01-10", biomarkers=[_marker("Ferritin", 20, "low")]),
            _upload("u2", test_date="2026-01-10", biomarkers=[_marker("Vitamin D", 24, "low")]),
        ]
    )

    assert overview["mode"] == "snapshot"
    assert overview["timeline_eligible"] is False
    assert overview["summary"]["unique_lab_dates"] == 1
    assert overview["top_changes"] == []


def test_progress_overview_builds_time_trend_between_real_lab_dates():
    overview = build_progress_overview(
        [
            _upload("u1", test_date="2026-01-10", biomarkers=[_marker("Ferritin", 20, "low")]),
            _upload("u2", test_date="2026-02-10", biomarkers=[_marker("Ferritin", 42, "normal")]),
        ]
    )

    assert overview["mode"] == "time_trend"
    assert overview["timeline_eligible"] is True
    assert overview["summary"]["unique_lab_dates"] == 2
    assert overview["summary"]["markers_with_2plus_dates"] == 1
    assert overview["date_spine"][0]["date"] == "2026-01-10"
    assert overview["date_spine"][1]["date"] == "2026-02-10"
    assert overview["top_changes"][0]["name"] == "Ferritin"
    assert overview["top_changes"][0]["direction"] == "rising"
    assert overview["all_comparable_markers"][0]["name"] == "Ferritin"


def test_progress_overview_marks_high_confidence_after_three_dates_and_21_days():
    overview = build_progress_overview(
        [
            _upload("u1", test_date="2026-01-10", biomarkers=[_marker("Ferritin", 20, "low")]),
            _upload("u2", test_date="2026-02-10", biomarkers=[_marker("Ferritin", 42, "normal")]),
            _upload("u3", test_date="2026-03-10", biomarkers=[_marker("Ferritin", 44, "normal")]),
        ]
    )

    assert overview["mode"] == "high_confidence_time_trend"
    assert overview["confidence"]["label"] == "high"
    assert overview["stable_markers"][0]["name"] == "Ferritin"


@pytest.mark.asyncio
async def test_progress_overview_route_preserves_existing_progress_contract(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_get_user_progress(_user_id):
        return [
            _upload("u1", test_date="2026-01-10", biomarkers=[_marker("Ferritin", 20, "low")]),
            _upload("u2", test_date="2026-02-10", biomarkers=[_marker("Ferritin", 42, "normal")]),
        ]

    monkeypatch.setattr(progress_router, "get_user_progress", fake_get_user_progress)
    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            overview_response = await client.get("/progress/overview")
            legacy_response = await client.get("/progress")
    finally:
        app.dependency_overrides.clear()

    assert overview_response.status_code == 200
    assert overview_response.json()["version"] == "progress_overview_v1"
    assert overview_response.json()["mode"] == "time_trend"
    assert legacy_response.status_code == 200
    assert isinstance(legacy_response.json(), list)
