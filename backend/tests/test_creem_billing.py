import hashlib
import hmac

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.config import settings
from app.routers.billing import creem


def _request_with_origin(origin: str) -> Request:
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/creem/checkout",
        "headers": [(b"origin", origin.encode("utf-8"))],
    })


def test_creem_rejects_ua_origin_for_checkout_and_portal():
    with pytest.raises(HTTPException) as exc_info:
        creem._reject_ua_origin(_request_with_origin("https://ua.vitaloop.today"))

    assert exc_info.value.status_code == 403
    creem._reject_ua_origin(_request_with_origin("https://vitaloop.today"))


def test_verify_creem_signature_uses_raw_body_and_timing_safe_secret(monkeypatch):
    monkeypatch.setattr(settings, "creem_webhook_secret", "test-webhook-secret")
    raw_body = b'{"id":"evt_1","eventType":"checkout.completed"}'
    signature = hmac.new(b"test-webhook-secret", raw_body, hashlib.sha256).hexdigest()

    assert creem._verify_signature(raw_body, signature) is True
    assert creem._verify_signature(raw_body + b" ", signature) is False
    assert creem._verify_signature(raw_body, "not-a-signature") is False


def test_only_configured_products_map_to_personal_plan(monkeypatch):
    monkeypatch.setattr(settings, "creem_monthly_product_id", "prod_month")
    monkeypatch.setattr(settings, "creem_annual_product_id", "prod_year")

    assert creem._plan_for_product("prod_month") == "personal"
    assert creem._plan_for_product("prod_year") == "personal"
    assert creem._plan_for_product("prod_other") is None


@pytest.mark.asyncio
async def test_paid_webhook_uses_metadata_and_stores_only_billing_identifiers(monkeypatch):
    calls = []

    async def find_subscription(_subscription_id):
        return None

    async def upsert(user_id, **kwargs):
        calls.append((user_id, kwargs))

    monkeypatch.setattr(settings, "creem_monthly_product_id", "prod_month")
    monkeypatch.setattr(settings, "creem_annual_product_id", "prod_year")
    monkeypatch.setattr(creem.svc, "get_subscription_by_creem_subscription_id", find_subscription)
    monkeypatch.setattr(creem.svc, "upsert_user_subscription_row", upsert)

    await creem._apply_paid_subscription({
        "metadata": {"vitaloop_user_id": "user-123"},
        "product": {"id": "prod_month"},
        "customer": {"id": "cust_123", "email": "person@example.com"},
        "subscription": {
            "id": "sub_123",
            "current_period_start_date": "2026-10-19T10:00:00Z",
            "current_period_end_date": "2026-11-19T10:00:00Z",
        },
    })

    assert calls == [("user-123", {
        "plan_name": "personal", "status": "active",
        "current_period_start": "2026-10-19T10:00:00Z",
        "current_period_end": "2026-11-19T10:00:00Z",
        "cancel_at_period_end": False, "billing_provider": "creem",
        "creem_customer_id": "cust_123", "creem_subscription_id": "sub_123",
        "creem_product_id": "prod_month",
    })]
