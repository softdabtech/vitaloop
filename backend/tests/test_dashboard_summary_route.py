import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.analysis import dashboard as dashboard_router
from app.services import supabase_service as svc


class _Response:
    def __init__(self, data):
        self.data = data


@pytest.mark.asyncio
async def test_latest_activity_exposes_only_public_canonical_symptom_snapshot(monkeypatch):
    snapshot = {
        "version": "symptom_snapshot_v1",
        "source_type": "controlled_symptom_check",
        "session_id": "symptom-session-1",
        "completed_at": "2026-10-06T08:00:00Z",
        "provider_model": "must-stay-private",
        "primary_concern": {
            "vitaloop_concept_id": "fatigue",
            "provider_concept_id": "private-provider-id",
            "display_name_en": "Fatigue",
        },
        "evidence": {"present": [], "absent": [], "unknown": []},
        "assessment": {"urgent_warning": "absent"},
    }

    class _Query:
        def __getattr__(self, _name):
            return lambda *_args, **_kwargs: self

    class _Supabase:
        def table(self, _name):
            return _Query()

    async def fake_run(_operation):
        return _Response([{"week_start": "2026-10-05"}])

    async def fake_snapshot(_user_id):
        return snapshot

    monkeypatch.setattr(svc, "_get_supabase", lambda: _Supabase())
    monkeypatch.setattr(svc, "_run", fake_run)
    monkeypatch.setattr(dashboard_router, "load_latest_eligible_symptom_snapshot", fake_snapshot)

    weekly, latest = await dashboard_router._fetch_latest_activity("user-1")

    assert weekly == {"week_start": "2026-10-05"}
    assert latest["session_id"] == "symptom-session-1"
    assert latest["source_type"] == "controlled_symptom_check"
    assert latest["symptom_snapshot"]["primary_concern"]["vitaloop_concept_id"] == "fatigue"
    assert "provider_model" not in latest["symptom_snapshot"]
    assert "provider_concept_id" not in latest["symptom_snapshot"]["primary_concern"]


@pytest.mark.asyncio
async def test_dashboard_summary_uses_account_full_name_for_first_name(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_get_user_account(_user_id):
        return {
            "id": user_id,
            "email": "john.doe@example.com",
            "full_name": "John Doe",
            "global_role": "end_user",
            "sub_status": "free",
            "created_at": "2026-01-01T00:00:00Z",
        }

    async def fake_get_user_progress(_user_id):
        return []

    async def fake_get_user_insights(_user_id):
        return []

    async def fake_get_user_upload_count(_user_id):
        return 0

    async def fake_resolve_onboarding_state(_user_id, _current_user):
        return {
            "requires_onboarding": True,
            "current_stage": "profile",
            "current_stage_label": "Set up your profile",
            "checklist": {"onboarding_complete": False},
            "completion_pct": 0,
        }

    async def fake_fetch_assignments(_user_id, _global_role):
        return []

    async def fake_fetch_health_and_streak(_user_id):
        return None, 0, 0

    async def fake_fetch_user_goals(_user_id):
        return 0

    async def fake_fetch_latest_activity(_user_id):
        return None, None

    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(svc, "get_user_progress", fake_get_user_progress)
    monkeypatch.setattr(svc, "get_user_insights", fake_get_user_insights)
    monkeypatch.setattr(svc, "get_user_upload_count", fake_get_user_upload_count)
    monkeypatch.setattr(dashboard_router, "_resolve_onboarding_state", fake_resolve_onboarding_state)
    monkeypatch.setattr(dashboard_router, "_fetch_assignments", fake_fetch_assignments)
    monkeypatch.setattr(dashboard_router, "_fetch_health_and_streak", fake_fetch_health_and_streak)
    monkeypatch.setattr(dashboard_router, "_fetch_user_goals", fake_fetch_user_goals)
    monkeypatch.setattr(dashboard_router, "_fetch_latest_activity", fake_fetch_latest_activity)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id, "email": "john.doe@example.com"}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/dashboard/summary")

        assert response.status_code == 200
        payload = response.json()
        assert payload["profile"]["full_name"] == "John Doe"
        assert payload["profile"]["first_name"] == "John"
        assert payload["profile"]["subscription_status"] == "free"
    finally:
        app.dependency_overrides.clear()
