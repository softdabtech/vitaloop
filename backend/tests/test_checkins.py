from datetime import date

import pytest

from app.routers.protocol import checkins


@pytest.mark.asyncio
async def test_submit_checkin_allows_authenticated_free_user(monkeypatch):
    saved = {}

    async def fake_submit_weekly_checkin(user_id, data):
        saved["user_id"] = user_id
        saved["data"] = data
        return {"id": "checkin-1", "user_id": user_id, **data}

    monkeypatch.setattr(checkins.svc, "submit_weekly_checkin", fake_submit_weekly_checkin)

    body = checkins.CheckinCreate(
        week_start=date(2026, 7, 10),
        energy_score=4,
        sleep_quality=5,
        mood_score=6,
        protocol_adherence=3,
        symptom_changes="stable",
    )

    result = await checkins.submit_checkin(body, {"sub": "free-user-1"})

    assert result["id"] == "checkin-1"
    assert result["user_id"] == "free-user-1"
    assert saved["user_id"] == "free-user-1"
    assert saved["data"]["week_start"] == "2026-07-10"
    assert saved["data"]["energy_score"] == 4
