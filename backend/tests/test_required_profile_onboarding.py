import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.config import Settings
from app.dependencies import get_current_user
from app.main import app
from app.routers.identity import onboarding as onboarding_router
from app.services import supabase_service as svc


VALID_PROFILE = {
    "age": 34,
    "sex": "female",
    "height_cm": 168,
    "weight_kg": 64,
    "onboarding_complete": True,
}


def test_symptom_engine_rollout_is_disabled_and_bounded():
    local_settings = Settings(_env_file=None)
    assert local_settings.infermedica_enabled is False
    assert local_settings.symptom_engine_rollout_percent == 0
    with pytest.raises(ValidationError):
        Settings(_env_file=None, symptom_engine_rollout_percent=101)


def test_required_profile_validation_is_adult_and_provider_compatible():
    assert onboarding_router._missing_profile_basics(VALID_PROFILE) == []
    assert onboarding_router._missing_profile_basics({}) == ["age", "sex", "height_cm", "weight_kg"]
    assert onboarding_router._missing_profile_basics({**VALID_PROFILE, "age": 17}) == ["age"]
    assert onboarding_router._missing_profile_basics({**VALID_PROFILE, "sex": "other"}) == ["sex"]
    assert onboarding_router._missing_profile_basics({**VALID_PROFILE, "height_cm": 99}) == ["height_cm"]
    assert onboarding_router._missing_profile_basics({**VALID_PROFILE, "weight_kg": 351}) == ["weight_kg"]


@pytest.mark.asyncio
async def test_stale_onboarding_flag_cannot_bypass_missing_profile(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_account(_user_id):
        return {"id": user_id, "global_role": "end_user"}

    async def fake_profile(_user_id):
        return {"onboarding_complete": True}

    async def fake_location(_user_id):
        return {}

    async def fake_has_user_row(*_args, **_kwargs):
        return False

    async def fake_audit(**_kwargs):
        return None

    async def no_completed_symptom_check(_user_id):
        return None

    monkeypatch.setattr(svc, "get_user_account", fake_account)
    monkeypatch.setattr(svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(svc, "get_user_location", fake_location)
    monkeypatch.setattr(onboarding_router, "_has_user_row", fake_has_user_row)
    monkeypatch.setattr(onboarding_router, "load_latest_eligible_symptom_snapshot", no_completed_symptom_check)
    monkeypatch.setattr(svc, "write_audit_log", fake_audit)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/auth/onboarding/state")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["requires_onboarding"] is True
    assert body["account_setup_complete"] is False
    assert body["current_stage"] == "profile"
    assert body["missing_required_profile_fields"] == ["age", "sex", "height_cm", "weight_kg"]


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", ["/auth/onboarding/complete", "/auth/onboarding/skip"])
async def test_required_profile_cannot_be_completed_or_skipped(monkeypatch, endpoint):
    user_id = str(uuid.uuid4())

    async def fake_profile(_user_id):
        return {"age": 34, "sex": "female"}

    monkeypatch.setattr(svc, "get_user_profile", fake_profile)
    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(endpoint)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "REQUIRED_PROFILE_INCOMPLETE"
    assert "required profile" in body["detail"].lower() or "cannot be skipped" in body["detail"].lower()


@pytest.mark.asyncio
async def test_valid_required_profile_completes_onboarding(monkeypatch):
    user_id = str(uuid.uuid4())
    writes = []

    async def fake_profile(_user_id):
        return {**VALID_PROFILE, "onboarding_complete": False}

    async def fake_upsert(_user_id, payload):
        writes.append(payload)
        return {**VALID_PROFILE, **payload}

    monkeypatch.setattr(svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(svc, "upsert_user_profile", fake_upsert)
    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/auth/onboarding/complete")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert writes == [{"onboarding_complete": True}]
