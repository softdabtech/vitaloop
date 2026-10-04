import pytest

from app.services import symptom_report_update


def test_newer_symptom_check_explicitly_offers_report_regeneration():
    offer = symptom_report_update.build_report_update_offer(
        completed_at="2026-10-04T10:00:00+00:00",
        latest_ready_report={
            "upload_id": "upload-1",
            "report_generated_at": "2026-10-04T09:00:00+00:00",
        },
    )

    assert offer["status"] == "update_available"
    assert offer["update_available"] is True
    assert offer["action"] == {
        "type": "regenerate_report",
        "method": "POST",
        "endpoint": "/analyze/upload-1/regenerate",
        "path": "/results/upload-1",
    }


def test_older_symptom_check_does_not_offer_redundant_update():
    offer = symptom_report_update.build_report_update_offer(
        completed_at="2026-10-04T08:00:00+00:00",
        latest_ready_report={
            "upload_id": "upload-1",
            "report_generated_at": "2026-10-04T09:00:00+00:00",
        },
    )
    assert offer["status"] == "current"
    assert offer["update_available"] is False
    assert offer["action"]["type"] == "view_report"


def test_no_report_routes_user_to_upload():
    offer = symptom_report_update.build_report_update_offer(
        completed_at="2026-10-04T08:00:00+00:00",
        latest_ready_report=None,
    )
    assert offer["status"] == "no_report"
    assert offer["action"] == {"type": "upload_labs", "path": "/upload"}


@pytest.mark.asyncio
async def test_report_lookup_failure_is_explicit_and_fail_open(monkeypatch):
    async def fail(_user_id):
        raise RuntimeError("temporary database failure")

    monkeypatch.setattr(symptom_report_update.svc, "get_latest_ready_report", fail)
    offer = await symptom_report_update.resolve_report_update_offer(
        user_id="user-1",
        completed_at="2026-10-04T08:00:00+00:00",
    )
    assert offer["status"] == "unavailable"
    assert offer["update_available"] is False

