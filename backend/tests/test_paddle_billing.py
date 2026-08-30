import hashlib
import hmac
import json

import pytest

from app.routers.billing import paddle_router


def _signature(raw_body: bytes, secret: str, timestamp: str = "123") -> str:
    digest = hmac.new(secret.encode("utf-8"), f"{timestamp}:".encode("utf-8") + raw_body, hashlib.sha256).hexdigest()
    return f"ts={timestamp};h1={digest}"


def test_paddle_signature_verification_accepts_valid_signature():
    raw = b'{"event_type":"transaction.completed"}'
    secret = "whsec_test"

    assert paddle_router._verify_paddle_signature(raw, _signature(raw, secret), secret) is True


def test_paddle_signature_verification_rejects_invalid_signature():
    raw = b'{"event_type":"transaction.completed"}'

    assert paddle_router._verify_paddle_signature(raw, "ts=123;h1=bad", "whsec_test") is False


@pytest.mark.asyncio
async def test_apply_subscription_event_activates_existing_user(monkeypatch):
    calls = []

    async def fake_update_user_subscription(**kwargs):
        calls.append(("user", kwargs))

    async def fake_upsert_user_subscription_row(user_id, **kwargs):
        calls.append(("subscription", {"user_id": user_id, **kwargs}))

    monkeypatch.setattr(paddle_router.svc, "update_user_subscription", fake_update_user_subscription)
    monkeypatch.setattr(paddle_router.svc, "upsert_user_subscription_row", fake_upsert_user_subscription_row)

    result = await paddle_router._apply_subscription_event(
        "transaction.completed",
        {
            "status": "completed",
            "custom_data": {"user_id": "user-1", "email": "paying@example.com"},
            "current_billing_period": {
                "starts_at": "2026-08-24T00:00:00Z",
                "ends_at": "2026-09-24T00:00:00Z",
            },
        },
    )

    assert result["handled"] is True
    assert result["status"] == "active"
    assert calls[0] == ("user", {"user_id": "user-1", "sub_status": "active", "plan_tier": "personal"})
    assert calls[1][0] == "subscription"
    assert calls[1][1]["plan_name"] == "personal"
    assert calls[1][1]["status"] == "active"


@pytest.mark.asyncio
async def test_apply_subscription_event_resolves_user_by_email(monkeypatch):
    async def fake_get_user_by_email(email):
        assert email == "buyer@example.com"
        return {"id": "user-2", "email": email}

    async def fake_update_user_subscription(**_kwargs):
        return None

    async def fake_upsert_user_subscription_row(_user_id, **_kwargs):
        return None

    monkeypatch.setattr(paddle_router.svc, "get_user_by_email", fake_get_user_by_email)
    monkeypatch.setattr(paddle_router.svc, "update_user_subscription", fake_update_user_subscription)
    monkeypatch.setattr(paddle_router.svc, "upsert_user_subscription_row", fake_upsert_user_subscription_row)

    result = await paddle_router._apply_subscription_event(
        "subscription.updated",
        {"status": "active", "custom_data": {"email": "buyer@example.com"}},
    )

    assert result["handled"] is True
    assert result["user_id"] == "user-2"


def test_apply_subscription_event_parses_current_shape_helpers():
    event = {
        "data": {
            "status": "active",
            "custom_data": {"user_id": "user-3", "billing_cycle": "yearly"},
        }
    }

    assert paddle_router._extract_user_id(event["data"]) == "user-3"
    assert paddle_router._map_paddle_status(event["data"], "subscription.updated") == "active"


def test_paddle_custom_data_accepts_json_string_shape():
    data = {
        "custom_data": json.dumps({
            "user_id": "user-4",
            "email": "buyer@example.com",
            "billing_cycle": "monthly",
        })
    }

    assert paddle_router._extract_user_id(data) == "user-4"
    assert paddle_router._extract_email(data) == "buyer@example.com"
