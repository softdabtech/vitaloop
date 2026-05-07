"""
Tests for billing/Stripe router:

  POST /billing/checkout          — multi-plan checkout session creation
  GET  /billing/subscription      — subscription status + plan reflection
  POST /billing/cancel            — schedule cancellation at period end
  POST /billing/portal            — customer portal session
  POST /billing/webhook           — all 5 event types + duplicates + bad sig

All Stripe SDK calls and supabase helpers are monkey-patched;
no network or external infrastructure required.
"""
import json
import types
import pytest
from fastapi import HTTPException

import app.routers.billing.stripe_router as billing
import app.services.supabase_service as svc

# ---------------------------------------------------------------------------
# Shared stubs
# ---------------------------------------------------------------------------

USER_ID = "user-billing-test-001"
USER_EMAIL = "billing@example.com"
CURRENT_USER = {"sub": USER_ID, "email": USER_EMAIL}

STRIPE_SUB_ID = "sub_testABCDEF123456"
STRIPE_CUSTOMER_ID = "cus_testXYZ789"
STRIPE_CHECKOUT_URL = "https://checkout.stripe.com/pay/cs_test_abc"
STRIPE_PORTAL_URL = "https://billing.stripe.com/session/test_portal"

_ACTIVE_SUBSCRIPTION = {
    "plan_name": "personal",
    "status": "active",
    "stripe_subscription_id": STRIPE_SUB_ID,
    "stripe_customer_id": STRIPE_CUSTOMER_ID,
    "current_period_end": "2026-05-17T00:00:00+00:00",
    "cancel_at_period_end": False,
}

_USER_ACCOUNT_FREE = {
    "sub_status": "free",
    "global_role": "end_user",
    "plan_tier": None,
}

_USER_ACCOUNT_PREMIUM = {
    "sub_status": "active",
    "global_role": "end_user",
    "plan_tier": "personal",
}


# ---------------------------------------------------------------------------
# Autouse fixture: silence DB side-effects for all tests
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _stub_svc(monkeypatch):
    async def noop(*_a, **_kw):
        return None

    # Patch in billing module namespace (imported via `from ... import`)
    monkeypatch.setattr(billing, "update_user_subscription", noop)
    monkeypatch.setattr(billing, "sync_stripe_subscription_to_subscriptions_table", noop)
    monkeypatch.setattr(billing, "record_stripe_event", lambda *_a, **_kw: _coro(True))
    monkeypatch.setattr(billing, "get_user_account", lambda _uid: _coro(_USER_ACCOUNT_FREE))
    monkeypatch.setattr(billing, "get_user_upload_count", lambda _uid: _coro(0))
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(None))
    monkeypatch.setattr(billing, "get_user_by_stripe_sub", lambda _sid: _coro(None))


# ===========================================================================
# POST /billing/checkout
# ===========================================================================

@pytest.mark.asyncio
async def test_checkout_personal_returns_url(monkeypatch):
    _configure_stripe(monkeypatch, personal_price="price_personal_test")

    _mock_stripe_checkout(monkeypatch, STRIPE_CHECKOUT_URL)

    body = billing.CheckoutRequest(plan_id="personal")
    result = await billing.create_checkout_session(body, current_user=CURRENT_USER)

    assert result["checkout_url"] == STRIPE_CHECKOUT_URL
    assert result["plan_id"] == "personal"


@pytest.mark.asyncio
async def test_checkout_practitioner_returns_url(monkeypatch):
    _configure_stripe(monkeypatch, practitioner_price="price_practitioner_test")

    _mock_stripe_checkout(monkeypatch, "https://checkout.stripe.com/pay/cs_prac")

    body = billing.CheckoutRequest(plan_id="practitioner")
    result = await billing.create_checkout_session(body, current_user=CURRENT_USER)

    assert result["plan_id"] == "practitioner"
    assert "checkout.stripe.com" in result["checkout_url"]


@pytest.mark.asyncio
async def test_checkout_invalid_plan_raises_422(monkeypatch):
    _configure_stripe(monkeypatch, personal_price="price_personal_test")

    body = billing.CheckoutRequest(plan_id="enterprise")
    with pytest.raises(HTTPException) as exc:
        await billing.create_checkout_session(body, current_user=CURRENT_USER)

    assert exc.value.status_code == 422
    assert "Invalid plan_id" in exc.value.detail


@pytest.mark.asyncio
async def test_checkout_no_stripe_key_raises_503(monkeypatch):
    monkeypatch.setattr(billing.settings, "stripe_secret_key", "")

    body = billing.CheckoutRequest(plan_id="personal")
    with pytest.raises(HTTPException) as exc:
        await billing.create_checkout_session(body, current_user=CURRENT_USER)

    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_checkout_unconfigured_price_raises_503(monkeypatch):
    """No price ID set for the requested plan → 503."""
    _configure_stripe(monkeypatch)  # both price IDs empty

    body = billing.CheckoutRequest(plan_id="practitioner")
    with pytest.raises(HTTPException) as exc:
        await billing.create_checkout_session(body, current_user=CURRENT_USER)

    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_checkout_passes_plan_name_in_stripe_metadata(monkeypatch):
    """Stripe Session.create must receive plan_name in metadata."""
    _configure_stripe(monkeypatch, personal_price="price_personal_test")
    captured = {}

    def fake_session_create(**kwargs):
        captured.update(kwargs)
        return _fake_session(STRIPE_CHECKOUT_URL)

    monkeypatch.setattr(billing.stripe.checkout.Session, "create", fake_session_create)

    body = billing.CheckoutRequest(plan_id="personal")
    await billing.create_checkout_session(body, current_user=CURRENT_USER)

    assert captured.get("metadata", {}).get("plan_name") == "personal"
    assert captured.get("metadata", {}).get("user_id") == USER_ID


# ===========================================================================
# GET /billing/subscription
# ===========================================================================

@pytest.mark.asyncio
async def test_subscription_status_free_user(monkeypatch):
    monkeypatch.setattr(billing, "get_user_account", lambda _uid: _coro(_USER_ACCOUNT_FREE))
    monkeypatch.setattr(billing, "get_user_upload_count", lambda _uid: _coro(0))
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(None))

    result = await billing.get_subscription_status(current_user=CURRENT_USER)

    assert result["sub_status"] == "free"
    assert result["is_premium"] is False
    assert result["plan_name"] is None
    assert result["upload_limit"] is not None
    assert result["uploads_remaining"] is not None


@pytest.mark.asyncio
async def test_subscription_status_personal_pro(monkeypatch):
    monkeypatch.setattr(billing, "get_user_account", lambda _uid: _coro(_USER_ACCOUNT_PREMIUM))
    monkeypatch.setattr(billing, "get_user_upload_count", lambda _uid: _coro(3))
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(_ACTIVE_SUBSCRIPTION))

    result = await billing.get_subscription_status(current_user=CURRENT_USER)

    assert result["sub_status"] == "active"
    assert result["is_premium"] is True
    assert result["plan_name"] == "personal"
    assert result["cancel_at_period_end"] is False
    assert result["upload_limit"] is None   # no limit for premium


@pytest.mark.asyncio
async def test_subscription_status_practitioner(monkeypatch):
    prac_sub = {**_ACTIVE_SUBSCRIPTION, "plan_name": "practitioner"}
    prac_account = {**_USER_ACCOUNT_PREMIUM, "plan_tier": "practitioner"}

    monkeypatch.setattr(billing, "get_user_account", lambda _uid: _coro(prac_account))
    monkeypatch.setattr(billing, "get_user_upload_count", lambda _uid: _coro(10))
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(prac_sub))

    result = await billing.get_subscription_status(current_user=CURRENT_USER)

    assert result["plan_name"] == "practitioner"
    assert result["is_premium"] is True


@pytest.mark.asyncio
async def test_subscription_status_active_free_plan_is_not_premium(monkeypatch):
    free_active_sub = {
        **_ACTIVE_SUBSCRIPTION,
        "plan_name": "free",
        "status": "active",
        "stripe_subscription_id": None,
        "stripe_customer_id": None,
    }

    monkeypatch.setattr(billing, "get_user_account", lambda _uid: _coro(_USER_ACCOUNT_FREE))
    monkeypatch.setattr(billing, "get_user_upload_count", lambda _uid: _coro(1))
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(free_active_sub))

    result = await billing.get_subscription_status(current_user=CURRENT_USER)

    assert result["sub_status"] == "free"
    assert result["is_premium"] is False
    assert result["plan_name"] == "free"
    assert result["upload_limit"] is not None


@pytest.mark.asyncio
async def test_subscription_cancel_at_period_end_reflected(monkeypatch):
    cancelling_sub = {**_ACTIVE_SUBSCRIPTION, "cancel_at_period_end": True}

    monkeypatch.setattr(billing, "get_user_account", lambda _uid: _coro(_USER_ACCOUNT_PREMIUM))
    monkeypatch.setattr(billing, "get_user_upload_count", lambda _uid: _coro(0))
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(cancelling_sub))

    result = await billing.get_subscription_status(current_user=CURRENT_USER)

    assert result["cancel_at_period_end"] is True


# ===========================================================================
# POST /billing/cancel
# ===========================================================================

@pytest.mark.asyncio
async def test_cancel_schedules_period_end(monkeypatch):
    _configure_stripe(monkeypatch)
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(_ACTIVE_SUBSCRIPTION))

    fake_updated = {"status": "active", "current_period_end": 1747785600}
    monkeypatch.setattr(billing.stripe.Subscription, "modify", lambda _sid, **_kw: fake_updated)

    result = await billing.cancel_subscription(current_user=CURRENT_USER)

    assert result["ok"] is True
    assert result["cancel_at_period_end"] is True
    assert result["period_end"] == 1747785600


@pytest.mark.asyncio
async def test_cancel_no_subscription_raises_404(monkeypatch):
    _configure_stripe(monkeypatch)
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(None))

    with pytest.raises(HTTPException) as exc:
        await billing.cancel_subscription(current_user=CURRENT_USER)

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_cancel_no_stripe_key_raises_503(monkeypatch):
    monkeypatch.setattr(billing.settings, "stripe_secret_key", "")

    with pytest.raises(HTTPException) as exc:
        await billing.cancel_subscription(current_user=CURRENT_USER)

    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_cancel_passes_cancel_at_period_end_to_stripe(monkeypatch):
    _configure_stripe(monkeypatch)
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(_ACTIVE_SUBSCRIPTION))

    modify_kwargs = {}

    def fake_modify(sub_id, **kwargs):
        modify_kwargs["sub_id"] = sub_id
        modify_kwargs.update(kwargs)
        return {"status": "active", "current_period_end": 0}

    monkeypatch.setattr(billing.stripe.Subscription, "modify", fake_modify)

    await billing.cancel_subscription(current_user=CURRENT_USER)

    assert modify_kwargs["sub_id"] == STRIPE_SUB_ID
    assert modify_kwargs.get("cancel_at_period_end") is True


# ===========================================================================
# POST /billing/portal
# ===========================================================================

@pytest.mark.asyncio
async def test_portal_returns_url(monkeypatch):
    _configure_stripe(monkeypatch)
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(_ACTIVE_SUBSCRIPTION))

    portal_obj = types.SimpleNamespace(url=STRIPE_PORTAL_URL)
    monkeypatch.setattr(billing.stripe.billing_portal.Session, "create", lambda **_kw: portal_obj)

    result = await billing.create_customer_portal(current_user=CURRENT_USER)

    assert result["portal_url"] == STRIPE_PORTAL_URL


@pytest.mark.asyncio
async def test_portal_no_customer_id_raises_404(monkeypatch):
    _configure_stripe(monkeypatch)
    sub_no_customer = {**_ACTIVE_SUBSCRIPTION, "stripe_customer_id": None}
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(sub_no_customer))

    with pytest.raises(HTTPException) as exc:
        await billing.create_customer_portal(current_user=CURRENT_USER)

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_portal_no_subscription_raises_404(monkeypatch):
    _configure_stripe(monkeypatch)
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(None))

    with pytest.raises(HTTPException) as exc:
        await billing.create_customer_portal(current_user=CURRENT_USER)

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_portal_no_stripe_key_raises_503(monkeypatch):
    monkeypatch.setattr(billing.settings, "stripe_secret_key", "")

    with pytest.raises(HTTPException) as exc:
        await billing.create_customer_portal(current_user=CURRENT_USER)

    assert exc.value.status_code == 503


# ===========================================================================
# Webhook handler unit tests (bypass HTTP layer, call private handlers directly)
# ===========================================================================

@pytest.mark.asyncio
async def test_webhook_checkout_completed_stores_plan(monkeypatch):
    stored = {}

    async def fake_update(user_id, sub_status, sub_id=None, plan_tier=None):
        stored["user_id"] = user_id
        stored["sub_status"] = sub_status
        stored["plan_tier"] = plan_tier

    async def fake_sync(*, user_id, stripe_subscription_id, plan_name="personal", **_kw):
        stored["plan_name"] = plan_name

    monkeypatch.setattr(billing, "update_user_subscription", fake_update)
    monkeypatch.setattr(billing, "sync_stripe_subscription_to_subscriptions_table", fake_sync)

    data = {
        "client_reference_id": USER_ID,
        "subscription": STRIPE_SUB_ID,
        "customer": STRIPE_CUSTOMER_ID,
        "metadata": {"user_id": USER_ID, "plan_name": "practitioner"},
    }
    await billing._handle_checkout_session_completed(data)

    assert stored["user_id"] == USER_ID
    assert stored["sub_status"] == "active"
    assert stored["plan_tier"] == "practitioner"
    assert stored["plan_name"] == "practitioner"


@pytest.mark.asyncio
async def test_webhook_checkout_defaults_plan_to_personal(monkeypatch):
    stored = {}

    async def fake_sync(*, user_id, stripe_subscription_id, plan_name="personal", **_kw):
        stored["plan_name"] = plan_name

    monkeypatch.setattr(billing, "sync_stripe_subscription_to_subscriptions_table", fake_sync)

    data = {
        "client_reference_id": USER_ID,
        "subscription": STRIPE_SUB_ID,
        "customer": STRIPE_CUSTOMER_ID,
        "metadata": {},  # no plan_name
    }
    await billing._handle_checkout_session_completed(data)
    assert stored["plan_name"] == "personal"


@pytest.mark.asyncio
async def test_webhook_checkout_missing_ids_is_noop(monkeypatch):
    """Missing user_id or sub_id must not raise and must not call update."""
    called = {"update": False}

    async def fake_update(*_a, **_kw):
        called["update"] = True

    monkeypatch.setattr(billing, "update_user_subscription", fake_update)

    await billing._handle_checkout_session_completed({"client_reference_id": None, "subscription": None})

    assert called["update"] is False


@pytest.mark.asyncio
async def test_webhook_subscription_updated_active(monkeypatch):
    stored = {}

    monkeypatch.setattr(billing, "get_user_by_stripe_sub", lambda _sid: _coro({"id": USER_ID}))
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(_ACTIVE_SUBSCRIPTION))

    async def fake_update(user_id, sub_status, sub_id=None, plan_tier=None):
        stored["sub_status"] = sub_status

    async def fake_sync(*, stripe_status, **_kw):
        stored["stripe_status"] = stripe_status

    monkeypatch.setattr(billing, "update_user_subscription", fake_update)
    monkeypatch.setattr(billing, "sync_stripe_subscription_to_subscriptions_table", fake_sync)

    await billing._handle_subscription_updated({"id": STRIPE_SUB_ID, "customer": STRIPE_CUSTOMER_ID, "status": "active"})

    assert stored["sub_status"] == "active"
    assert stored["stripe_status"] == "active"


@pytest.mark.asyncio
@pytest.mark.parametrize("stripe_status,expected_internal", [
    ("past_due", "past_due"),
    ("trialing", "active"),
    ("unpaid", "past_due"),
    ("paused", "paused"),
    ("cancelled", "cancelled"),
])
async def test_webhook_subscription_updated_status_mapping(monkeypatch, stripe_status, expected_internal):
    stored = {}

    monkeypatch.setattr(billing, "get_user_by_stripe_sub", lambda _sid: _coro({"id": USER_ID}))
    monkeypatch.setattr(billing, "get_user_active_subscription", lambda _uid: _coro(_ACTIVE_SUBSCRIPTION))

    async def fake_update(user_id, sub_status, sub_id=None, plan_tier=None):
        stored["sub_status"] = sub_status

    monkeypatch.setattr(billing, "update_user_subscription", fake_update)

    await billing._handle_subscription_updated({"id": STRIPE_SUB_ID, "customer": STRIPE_CUSTOMER_ID, "status": stripe_status})

    assert stored["sub_status"] == expected_internal


@pytest.mark.asyncio
async def test_webhook_subscription_updated_unknown_user_is_noop(monkeypatch):
    """If user not found by sub_id, must not raise or call update."""
    called = {"update": False}

    monkeypatch.setattr(billing, "get_user_by_stripe_sub", lambda _sid: _coro(None))

    async def fake_update(*_a, **_kw):
        called["update"] = True

    monkeypatch.setattr(billing, "update_user_subscription", fake_update)

    await billing._handle_subscription_updated({"id": STRIPE_SUB_ID, "status": "active"})

    assert called["update"] is False


@pytest.mark.asyncio
async def test_webhook_subscription_deleted_marks_cancelled(monkeypatch):
    stored = {}

    monkeypatch.setattr(billing, "get_user_by_stripe_sub", lambda _sid: _coro({"id": USER_ID}))

    async def fake_update(user_id, sub_status, sub_id=None, plan_tier=None):
        stored["sub_status"] = sub_status

    async def fake_sync(*, stripe_status, **_kw):
        stored["stripe_status"] = stripe_status

    monkeypatch.setattr(billing, "update_user_subscription", fake_update)
    monkeypatch.setattr(billing, "sync_stripe_subscription_to_subscriptions_table", fake_sync)

    await billing._handle_subscription_deleted({"id": STRIPE_SUB_ID})

    assert stored["sub_status"] == "cancelled"
    assert stored["stripe_status"] == "cancelled"


@pytest.mark.asyncio
async def test_webhook_subscription_paused(monkeypatch):
    stored = {}

    monkeypatch.setattr(billing, "get_user_by_stripe_sub", lambda _sid: _coro({"id": USER_ID}))

    async def fake_update(user_id, sub_status, sub_id=None, plan_tier=None):
        stored["sub_status"] = sub_status

    monkeypatch.setattr(billing, "update_user_subscription", fake_update)

    await billing._handle_subscription_paused({"id": STRIPE_SUB_ID, "customer": STRIPE_CUSTOMER_ID})

    assert stored["sub_status"] == "paused"


@pytest.mark.asyncio
async def test_webhook_payment_failed_marks_past_due(monkeypatch):
    stored = {}

    monkeypatch.setattr(billing, "get_user_by_stripe_sub", lambda _sid: _coro({"id": USER_ID}))

    async def fake_update(user_id, sub_status, sub_id=None, plan_tier=None):
        stored["sub_status"] = sub_status

    monkeypatch.setattr(billing, "update_user_subscription", fake_update)

    await billing._handle_payment_failed({"subscription": STRIPE_SUB_ID})

    assert stored["sub_status"] == "past_due"


@pytest.mark.asyncio
async def test_webhook_payment_failed_missing_sub_id_is_noop(monkeypatch):
    called = {"update": False}

    async def fake_update(*_a, **_kw):
        called["update"] = True

    monkeypatch.setattr(billing, "update_user_subscription", fake_update)

    await billing._handle_payment_failed({"subscription": None})

    assert called["update"] is False


# ===========================================================================
# _price_id_for_plan unit tests
# ===========================================================================

def test_price_id_personal_primary(monkeypatch):
    monkeypatch.setattr(billing.settings, "stripe_price_id_personal", "price_abc")
    monkeypatch.setattr(billing.settings, "stripe_price_id", "")
    assert billing._price_id_for_plan("personal") == "price_abc"


def test_price_id_personal_falls_back_to_legacy(monkeypatch):
    monkeypatch.setattr(billing.settings, "stripe_price_id_personal", "")
    monkeypatch.setattr(billing.settings, "stripe_price_id", "price_legacy")
    assert billing._price_id_for_plan("personal") == "price_legacy"


def test_price_id_practitioner(monkeypatch):
    monkeypatch.setattr(billing.settings, "stripe_price_id_practitioner", "price_prac")
    assert billing._price_id_for_plan("practitioner") == "price_prac"


def test_price_id_missing_raises_503(monkeypatch):
    monkeypatch.setattr(billing.settings, "stripe_price_id_practitioner", "")
    monkeypatch.setattr(billing.settings, "stripe_price_id", "")
    with pytest.raises(HTTPException) as exc:
        billing._price_id_for_plan("practitioner")
    assert exc.value.status_code == 503


# ===========================================================================
# Helpers
# ===========================================================================

async def _coro(value):
    return value


def _configure_stripe(
    monkeypatch,
    secret_key: str = "sk_test_fake",
    personal_price: str = "",
    practitioner_price: str = "",
):
    monkeypatch.setattr(billing.settings, "stripe_secret_key", secret_key)
    monkeypatch.setattr(billing.settings, "stripe_price_id_personal", personal_price)
    monkeypatch.setattr(billing.settings, "stripe_price_id_practitioner", practitioner_price)
    monkeypatch.setattr(billing.settings, "stripe_price_id", "")


def _fake_session(url: str):
    s = types.SimpleNamespace()
    s.url = url
    return s


def _mock_stripe_checkout(monkeypatch, url: str):
    monkeypatch.setattr(
        billing.stripe.checkout.Session,
        "create",
        lambda **_kw: _fake_session(url),
    )
