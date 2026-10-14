import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.services import supabase_service as svc


@pytest.mark.asyncio
async def test_profile_patch_updates_full_name_and_profile(monkeypatch):
    user_id = str(uuid.uuid4())
    captured = {"full_name": None, "profile_payload": None, "protocols_invalidated": False, "account_reads": 0}

    async def fake_update_admin_user_fields(_user_id, *, full_name=None, global_role=None, sub_status=None):
        captured["full_name"] = full_name

    async def fake_upsert_user_profile(_user_id, payload):
        captured["profile_payload"] = payload
        return {"height_cm": payload.get("height_cm")}

    async def fake_get_user_profile(_user_id):
        return {"height_cm": 170, "age": 42}

    async def fake_get_user_account(_user_id):
        captured["account_reads"] += 1
        return {"full_name": "Jane Mary Doe"}

    async def fake_invalidate_user_protocols(_user_id):
        captured["protocols_invalidated"] = True

    monkeypatch.setattr(svc, "update_admin_user_fields", fake_update_admin_user_fields)
    monkeypatch.setattr(svc, "upsert_user_profile", fake_upsert_user_profile)
    monkeypatch.setattr(svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(svc, "invalidate_user_protocols", fake_invalidate_user_protocols)

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
        assert captured["protocols_invalidated"] is True
        assert captured["account_reads"] == 1
        assert response.json()["profile"] == {"height_cm": 170, "age": 42, "full_name": "Jane Mary Doe"}
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
        return {"onboarding_complete": False, "age": 42, "height_cm": 170, "weight_kg": 65}

    async def fake_get_user_account(_user_id):
        return {"full_name": "John Doe"}

    monkeypatch.setattr(svc, "update_admin_user_fields", fake_update_admin_user_fields)
    monkeypatch.setattr(svc, "upsert_user_profile", fake_upsert_user_profile)
    monkeypatch.setattr(svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)

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
        assert response.json()["profile"]["full_name"] == "John Doe"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_profile_get_merges_canonical_account_name(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_get_user_profile(_user_id):
        return {"age": 42, "goals": ["More energy"]}

    async def fake_get_user_account(_user_id):
        return {"full_name": "Canonical Name"}

    async def fake_get_user_location(_user_id):
        return None

    monkeypatch.setattr(svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(svc, "get_user_location", fake_get_user_location)
    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/profile")

        assert response.status_code == 200
        assert response.json()["profile"] == {"age": 42, "goals": ["More energy"], "full_name": "Canonical Name"}
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_profile_patch_empty_full_name_keeps_canonical_account_name(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_get_user_profile(_user_id):
        return {"age": 42}

    async def fake_get_user_account(_user_id):
        return {"full_name": "Existing Name"}

    async def fail_update_admin_user_fields(*args, **kwargs):
        raise AssertionError("empty full_name must not write the account name")

    monkeypatch.setattr(svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(svc, "update_admin_user_fields", fail_update_admin_user_fields)
    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch("/profile", json={"full_name": "   "})

        assert response.status_code == 200
        assert response.json()["profile"]["full_name"] == "Existing Name"
    finally:
        app.dependency_overrides.clear()
