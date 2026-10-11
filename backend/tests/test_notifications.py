from datetime import datetime, timedelta, timezone

import pytest

from app.routers.notifications import notifications


def _obligation():
    return {
        "id": "obligation-1",
        "related_recommendation_id": "Ferritin",
        "retest_window_start": "2026-10-01",
        "retest_window_end": "2026-10-31",
    }


@pytest.mark.asyncio
async def test_pending_retest_is_selected_with_context(monkeypatch):
    monkeypatch.setattr(notifications, "_latest_row_timestamp", lambda *args: _async_result(None))
    monkeypatch.setattr(
        notifications.svc,
        "get_pending_retest_obligation",
        lambda _user_id: _async_result(_obligation()),
    )
    monkeypatch.setattr(notifications, "_was_dispatched_recently", lambda *args, **kwargs: _async_result(False))

    selection = await notifications._choose_reminder_for_user(
        "user-1",
        {"weekly_checkin": False, "assignment_due": False, "retest_reminder": True},
    )

    assert selection == {
        "reminder_type": "retest_reminder",
        "context": {
            "target": "Ferritin",
            "window_start": "2026-10-01",
            "window_end": "2026-10-31",
            "obligation_id": "obligation-1",
        },
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("obligation", [None, {}])
async def test_missing_or_ineligible_retest_uses_no_reminder(monkeypatch, obligation):
    monkeypatch.setattr(
        notifications.svc,
        "get_pending_retest_obligation",
        lambda _user_id: _async_result(obligation),
    )
    monkeypatch.setattr(notifications, "_latest_row_timestamp", lambda *args: _async_result(None))

    selection = await notifications._choose_reminder_for_user(
        "user-1",
        {"weekly_checkin": False, "assignment_due": False, "retest_reminder": True},
    )

    assert selection is None


@pytest.mark.asyncio
async def test_legacy_last_upload_fallback_is_preserved(monkeypatch):
    monkeypatch.setattr(
        notifications.svc,
        "get_pending_retest_obligation",
        lambda _user_id: _async_result(None),
    )
    monkeypatch.setattr(
        notifications,
        "_latest_row_timestamp",
        lambda *args: _async_result(datetime.now(timezone.utc) - timedelta(days=71)),
    )
    monkeypatch.setattr(notifications, "_was_dispatched_recently", lambda *args, **kwargs: _async_result(False))

    selection = await notifications._choose_reminder_for_user(
        "user-1",
        {"weekly_checkin": False, "assignment_due": False, "retest_reminder": True},
    )

    assert selection == {"reminder_type": "retest_reminder", "context": {}}


def test_retest_copy_contains_obligation_context():
    copy = notifications._reminder_copy(
        "retest_reminder",
        "desktop",
        {
            "target": "Ferritin",
            "window_start": "2026-10-01",
            "window_end": "2026-10-31",
            "obligation_id": "obligation-1",
        },
    )

    assert copy["context"]["target"] == "Ferritin"
    assert "2026-10-01" in copy["body"]


def _async_result(value):
    async def result():
        return value

    return result()