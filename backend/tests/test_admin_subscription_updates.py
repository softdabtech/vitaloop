import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.admin import admin as admin_router
from app.services import supabase_service as svc


@pytest.mark.asyncio
async def test_generic_admin_user_update_keeps_canonical_subscription_in_sync(monkeypatch):
    user_id = str(uuid.uuid4())
    captured = {"profile": None, "subscription": None}

    async def fake_update_admin_user_fields(_user_id, **kwargs):
        captured["profile"] = kwargs

    async def fake_update_user_subscription(**kwargs):
        captured["subscription"] = kwargs

    monkeypatch.setattr(svc, "update_admin_user_fields", fake_update_admin_user_fields)
    monkeypatch.setattr(svc, "update_user_subscription", fake_update_user_subscription)
    app.dependency_overrides[admin_router._require_super_admin] = lambda: {"sub": "admin", "global_role": "super_admin"}

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(
                f"/admin/users/{user_id}",
                json={"sub_status": "active"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["profile"]["sub_status"] is None
    assert captured["subscription"] == {
        "user_id": user_id,
        "sub_status": "active",
        "plan_tier": "personal",
    }
