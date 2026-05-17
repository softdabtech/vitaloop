import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.services import supabase_service as svc


@pytest.mark.asyncio
async def test_profile_patch_updates_full_name_and_profile(monkeypatch):
    user_id = str(uuid.uuid4())
    captured = {"full_name": None, "profile_payload": None}

    async def fake_update_admin_user_fields(_user_id, *, full_name=None, global_role=None, sub_status=None):
        captured["full_name"] = full_name

    async def fake_upsert_user_profile(_user_id, payload):
        captured["profile_payload"] = payload
        return {"height_cm": payload.get("height_cm")}

    monkeypatch.setattr(svc, "update_admin_user_fields", fake_update_admin_user_fields)
    monkeypatch.setattr(svc, "upsert_user_profile", fake_upsert_user_profile)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(
                "/profile",
                json={"full_name": "  Jane   Mary   Doe  ", "height_cm": 170},
            )

        assert response.status_code == 200
        assert captured["full_name"] == "Jane Mary Doe"
        assert captured["profile_payload"] == {"height_cm": 170}
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_profile_patch_only_full_name_skips_profile_upsert(monkeypatch):
    user_id = str(uuid.uuid4())
    captured = {"full_name": None, "upsert_called": False}

    async def fake_update_admin_user_fields(_user_id, *, full_name=None, global_role=None, sub_status=None):
        captured["full_name"] = full_name

    async def fake_upsert_user_profile(_user_id, payload):
        captured["upsert_called"] = True
        return payload

    async def fake_get_user_profile(_user_id):
        return {"onboarding_complete": False}

    monkeypatch.setattr(svc, "update_admin_user_fields", fake_update_admin_user_fields)
    monkeypatch.setattr(svc, "upsert_user_profile", fake_upsert_user_profile)
    monkeypatch.setattr(svc, "get_user_profile", fake_get_user_profile)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(
                "/profile",
                json={"full_name": "John Doe"},
            )

        assert response.status_code == 200
        assert captured["full_name"] == "John Doe"
        assert captured["upsert_called"] is False
    finally:
        app.dependency_overrides.clear()
