import pytest

from app.services import entitlements


@pytest.mark.asyncio
async def test_manual_active_subscription_from_crm_grants_premium(monkeypatch):
    async def fake_account(_user_id):
        return {
            "id": "user-1",
            "email": "premium@example.com",
            "sub_status": "active",
            "plan_tier": "personal",
            "global_role": "end_user",
        }

    async def fake_profile(_user_id):
        return {"onboarding_complete": True}

    async def no_active_subscription(_user_id):
        return None

    monkeypatch.setattr(entitlements.svc, "get_user_account", fake_account)
    monkeypatch.setattr(entitlements.svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(entitlements.svc, "get_user_active_subscription", no_active_subscription)

    result = await entitlements.resolve_user_entitlements("user-1", {"role": "end_user"})

    assert result["is_premium"] is True
    assert result["has_active_subscription"] is True
    assert result["billing_status"] == "active"
    assert result["plan_key"] == "personal"
    assert result["source"] == "users"
    assert result["features"]["upload_limit"] is None
    assert result["features"]["advanced_protocol"] is True


@pytest.mark.asyncio
async def test_manual_active_plan_overrides_stale_free_subscription_row(monkeypatch):
    async def fake_account(_user_id):
        return {
            "id": "user-1",
            "email": "premium@example.com",
            "sub_status": "active",
            "plan_tier": "personal",
            "global_role": "end_user",
        }

    async def fake_profile(_user_id):
        return {"onboarding_complete": True}

    async def stale_free_subscription(_user_id):
        return {
            "status": "active",
            "plan_name": "free",
            "cancel_at_period_end": False,
        }

    monkeypatch.setattr(entitlements.svc, "get_user_account", fake_account)
    monkeypatch.setattr(entitlements.svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(entitlements.svc, "get_user_active_subscription", stale_free_subscription)

    result = await entitlements.resolve_user_entitlements("user-1", {"role": "end_user"})

    assert result["is_premium"] is True
    assert result["billing_status"] == "active"
    assert result["plan_key"] == "personal"
    assert result["source"] == "users"


@pytest.mark.asyncio
async def test_active_account_without_paid_plan_does_not_grant_premium(monkeypatch):
    async def fake_account(_user_id):
        return {
            "id": "user-1",
            "email": "free@example.com",
            "sub_status": "active",
            "plan_tier": "free",
            "global_role": "end_user",
        }

    async def fake_profile(_user_id):
        return {"onboarding_complete": False}

    async def no_active_subscription(_user_id):
        return None

    monkeypatch.setattr(entitlements.svc, "get_user_account", fake_account)
    monkeypatch.setattr(entitlements.svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(entitlements.svc, "get_user_active_subscription", no_active_subscription)

    result = await entitlements.resolve_user_entitlements("user-1", {"role": "end_user"})

    assert result["is_premium"] is False
    assert result["has_active_subscription"] is False
    assert result["billing_status"] == "free"
    assert result["plan_key"] == "free"


@pytest.mark.asyncio
async def test_manual_active_subscription_without_plan_tier_grants_premium(monkeypatch):
    async def fake_account(_user_id):
        return {
            "id": "user-1",
            "email": "premium@example.com",
            "sub_status": "active",
            "global_role": "end_user",
        }

    async def fake_profile(_user_id):
        return {"onboarding_complete": True}

    async def no_active_subscription(_user_id):
        return None

    monkeypatch.setattr(entitlements.svc, "get_user_account", fake_account)
    monkeypatch.setattr(entitlements.svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(entitlements.svc, "get_user_active_subscription", no_active_subscription)

    result = await entitlements.resolve_user_entitlements("user-1", {"role": "end_user"})

    assert result["is_premium"] is True
    assert result["has_active_subscription"] is True
    assert result["billing_status"] == "active"
    assert result["plan_key"] == "personal"
    assert result["source"] == "users"
