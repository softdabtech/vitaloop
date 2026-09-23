from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.config import settings
from app.services import wayforpay_service as wfp

TEST_USER_ID = "11111111-1111-1111-1111-111111111111"


@pytest.fixture(autouse=True)
def _wayforpay_test_settings(monkeypatch):
    # Deterministic, non-secret test credentials -- never the real ones.
    monkeypatch.setattr(settings, "wayforpay_merchant_login", "test_merchant")
    monkeypatch.setattr(settings, "wayforpay_secret_key", "test_secret_key")
    monkeypatch.setattr(settings, "wayforpay_merchant_domain", "ua.vitaloop.today")
    monkeypatch.setattr(settings, "wayforpay_api_base_url", "https://api.vitaloop.today")
    monkeypatch.setattr(settings, "wayforpay_return_url", "https://ua.vitaloop.today/subscription?sub=success")


def test_build_order_reference_roundtrips_user_id():
    order_reference = wfp.build_order_reference(TEST_USER_ID)
    assert order_reference.startswith("vtl-")
    assert wfp.parse_user_id_from_order_reference(order_reference) == TEST_USER_ID


def test_parse_user_id_rejects_garbage():
    assert wfp.parse_user_id_from_order_reference("") is None
    assert wfp.parse_user_id_from_order_reference("not-a-vtl-order") is None
    assert wfp.parse_user_id_from_order_reference("vtl-not-a-uuid-123-abc") is None


def test_build_purchase_payload_monthly():
    payload = wfp.build_purchase_payload(user_id=TEST_USER_ID, plan="monthly", client_email="a@b.com")
    assert payload["amount"] == "249.00"
    assert payload["currency"] == "UAH"
    assert payload["regularMode"] == "monthly"
    assert payload["merchantAccount"] == "test_merchant"
    assert payload["clientEmail"] == "a@b.com"
    # The secret key itself must never appear anywhere in the outgoing payload.
    assert "test_secret_key" not in str(payload)
    assert len(payload["merchantSignature"]) == 32  # MD5 hex digest


def test_build_purchase_payload_yearly():
    payload = wfp.build_purchase_payload(user_id=TEST_USER_ID, plan="yearly", client_email="a@b.com")
    assert payload["amount"] == "2499.00"
    assert payload["regularMode"] == "yearly"


def test_build_purchase_payload_unknown_plan_raises():
    with pytest.raises(ValueError):
        wfp.build_purchase_payload(user_id=TEST_USER_ID, plan="lifetime", client_email="a@b.com")


def test_verify_webhook_signature_accepts_correctly_signed_payload():
    fields = {
        "merchantAccount": "test_merchant",
        "orderReference": "vtl-abc-123",
        "amount": 249.0,
        "currency": "UAH",
        "authCode": "123456",
        "cardPan": "41****8217",
        "transactionStatus": "Approved",
        "reasonCode": "1100",
    }
    signature = wfp._hmac_md5(
        [str(fields[k]) for k in ["merchantAccount", "orderReference", "amount", "currency", "authCode", "cardPan", "transactionStatus", "reasonCode"]],
        settings.wayforpay_secret_key,
    )
    fields["merchantSignature"] = signature
    assert wfp.verify_webhook_signature(fields) is True


def test_verify_webhook_signature_rejects_tampered_payload():
    fields = {
        "merchantAccount": "test_merchant",
        "orderReference": "vtl-abc-123",
        "amount": 249.0,
        "currency": "UAH",
        "authCode": "123456",
        "cardPan": "41****8217",
        "transactionStatus": "Approved",
        "reasonCode": "1100",
        "merchantSignature": "",
    }
    assert wfp.verify_webhook_signature(fields) is False

    signature = wfp._hmac_md5(
        [str(fields[k]) for k in ["merchantAccount", "orderReference", "amount", "currency", "authCode", "cardPan", "transactionStatus", "reasonCode"]],
        settings.wayforpay_secret_key,
    )
    fields["merchantSignature"] = signature
    fields["transactionStatus"] = "Declined"  # tampered after signing
    assert wfp.verify_webhook_signature(fields) is False


def test_build_webhook_ack_shape():
    ack = wfp.build_webhook_ack("vtl-abc-123")
    assert ack["orderReference"] == "vtl-abc-123"
    assert ack["status"] == "accept"
    assert isinstance(ack["time"], int)
    assert len(ack["signature"]) == 32


def test_plan_name_for():
    assert wfp.plan_name_for("monthly") == "personal"
    assert wfp.plan_name_for("yearly") == "personal"
    assert wfp.plan_name_for("bogus") == "free"


def _mock_response(json_body, status_code=200):
    resp = httpx.Response(status_code, json=json_body, request=httpx.Request("POST", wfp.REGULAR_API_URL))
    return resp


@pytest.mark.asyncio
async def test_remove_regular_payment_success():
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=_mock_response({"reasonCode": 4100, "reason": "Ok"}))) as mock_post:
        result = await wfp.remove_regular_payment("vtl-abc-123")
    assert result["reasonCode"] == 4100
    sent_payload = mock_post.call_args.kwargs["json"]
    assert sent_payload["requestType"] == "REMOVE"
    assert sent_payload["orderReference"] == "vtl-abc-123"
    assert sent_payload["merchantAccount"] == "test_merchant"


@pytest.mark.asyncio
async def test_remove_regular_payment_rejects_error_response():
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=_mock_response({"reasonCode": 1104, "reason": "Order not found"}))):
        with pytest.raises(RuntimeError, match="Order not found"):
            await wfp.remove_regular_payment("vtl-abc-123")


@pytest.mark.asyncio
async def test_remove_regular_payment_rejects_transport_error():
    with patch("httpx.AsyncClient.post", new=AsyncMock(side_effect=httpx.ConnectTimeout("timed out"))):
        with pytest.raises(RuntimeError, match="Could not reach WayForPay"):
            await wfp.remove_regular_payment("vtl-abc-123")
