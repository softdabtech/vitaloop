import pytest

from app.services import entitlements


@pytest.mark.asyncio
async def test_active_free_subscription_resolves_as_free(monkeypatch):
    async def fake_get_user_account(_user_id):
        return {"global_role": "end_user", "sub_status": "active", "plan_tier": "free"}

    async def fake_get_user_profile(_user_id):
        return {"onboarding_complete": True}

    async def fake_get_user_active_subscription(_user_id):
        return {
            "status": "active",
            "plan_name": "free",
            "cancel_at_period_end": False,
        }

    monkeypatch.setattr(entitlements.svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(entitlements.svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(entitlements.svc, "get_user_active_subscription", fake_get_user_active_subscription)

    result = await entitlements.resolve_user_entitlements("user-1", {"role": "end_user"})

    assert result["billing_status"] == "free"
    assert result["plan_key"] == "free"
    assert result["is_premium"] is False
    assert result["has_active_subscription"] is False

