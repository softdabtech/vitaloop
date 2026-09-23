"""WayForPay integration for the UA cabinet's Premium checkout.

Flow (WayForPay's "Purchase" + widget + serviceUrl webhook, per
https://wiki.wayforpay.com/uk/view/852102 and /view/852091):

1. Frontend calls POST /wayforpay/checkout (authenticated) -> this module
   builds a signed purchase payload for wayforpay.run().
2. The widget collects card details on WayForPay's own page (never ours --
   no PCI DSS scope for us).
3. WayForPay calls POST /wayforpay/webhook (serviceUrl) with the result,
   authenticated by its own HMAC_MD5 signature -- verified here before any
   subscription row is touched. We reply with our own signed
   {orderReference, status, time, signature} acknowledgement, exactly the
   shape WayForPay's docs require, or it keeps retrying for up to 4 days.

Security: wayforpay_secret_key never leaves the backend. The frontend only
ever receives merchantAccount/orderReference/amount/... and a signature
already computed here -- never the key itself.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import time
import uuid
from typing import Any, Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger("uvicorn.error")

REGULAR_API_URL = "https://api.wayforpay.com/regularApi"

# UAH prices, kept in one place -- see frontend/src/pages/UaLanding.jsx's
# PRICING array (249 грн/міс, 2499 грн/рік) for the customer-facing copy;
# this is the number that actually gets charged, so it must stay in sync
# with that page by hand until there's a single shared source of truth.
PLAN_CONFIG: Dict[str, Dict[str, str]] = {
    "monthly": {
        "amount": "249.00",
        "regularMode": "monthly",
        "productName": "VITALOOP Premium — щомісячна підписка",
    },
    "yearly": {
        "amount": "2499.00",
        "regularMode": "yearly",
        "productName": "VITALOOP Premium — річна підписка",
    },
}

# Statuses WayForPay's serviceUrl payload can carry in transactionStatus.
# Only "Approved" ever activates/renews a subscription; every other status
# is acknowledged (so WayForPay stops retrying) but never grants access.
APPROVED_STATUS = "Approved"


def _hmac_md5(parts: list[str], key: str) -> str:
    base_string = ";".join(parts)
    return hmac.new(key.encode("utf-8"), base_string.encode("utf-8"), hashlib.md5).hexdigest()


def build_order_reference(user_id: str) -> str:
    """Encodes user_id into the order reference so the webhook can resolve
    the subscription deterministically -- never by trusting a client-
    supplied email to match a users row (a payer's card email can differ
    from their VITALOOP account email)."""
    return f"vtl-{user_id}-{int(time.time())}-{uuid.uuid4().hex[:6]}"


def parse_user_id_from_order_reference(order_reference: str) -> Optional[str]:
    if not order_reference or not order_reference.startswith("vtl-"):
        return None
    # vtl-<uuid (5 hyphen-separated groups)>-<unix ts>-<6 hex chars>
    parts = order_reference.split("-")
    if len(parts) < 8:
        return None
    candidate = "-".join(parts[1:6])
    try:
        uuid.UUID(candidate)
    except ValueError:
        return None
    return candidate


def build_purchase_payload(
    *,
    user_id: str,
    plan: str,
    client_email: str,
    client_first_name: str = "",
) -> Dict[str, Any]:
    """Returns the exact field set the frontend passes to wayforpay.run(),
    signature already computed. Raises ValueError for an unknown plan --
    the router turns that into a 400, never a silently-wrong charge."""
    plan_cfg = PLAN_CONFIG.get(plan)
    if not plan_cfg:
        raise ValueError(f"Unknown plan: {plan!r}")

    order_reference = build_order_reference(user_id)
    order_date = int(time.time())
    amount = plan_cfg["amount"]
    currency = "UAH"
    product_name = plan_cfg["productName"]
    product_count = "1"
    product_price = amount

    signature = _hmac_md5(
        [
            settings.wayforpay_merchant_login,
            settings.wayforpay_merchant_domain,
            order_reference,
            str(order_date),
            amount,
            currency,
            product_name,
            product_count,
            product_price,
        ],
        settings.wayforpay_secret_key,
    )

    return {
        "merchantAccount": settings.wayforpay_merchant_login,
        "merchantDomainName": settings.wayforpay_merchant_domain,
        "merchantSignature": signature,
        "authorizationType": "SimpleSignature",
        "orderReference": order_reference,
        "orderDate": order_date,
        "amount": amount,
        "currency": currency,
        "productName": [product_name],
        "productPrice": [product_price],
        "productCount": [product_count],
        "clientEmail": client_email,
        "clientFirstName": client_first_name or "VITALOOP",
        "clientLastName": "Premium",
        "language": "UA",
        "regularMode": plan_cfg["regularMode"],
        "regularAmount": amount,
        # First recurring charge is scheduled a period out by WayForPay
        # itself from dateNext/regularMode; the *initial* charge made right
        # now is the one-time SALE this Purchase request represents.
        "serviceUrl": f"{settings.wayforpay_api_base_url}/wayforpay/webhook",
        "returnUrl": settings.wayforpay_return_url,
    }


def verify_webhook_signature(payload: Dict[str, Any]) -> bool:
    """Recomputes the webhook's own HMAC_MD5 (merchantAccount;orderReference;
    amount;currency;authCode;cardPan;transactionStatus;reasonCode per the
    docs) and compares it to the signature WayForPay sent. A forged or
    corrupted callback fails this and must never reach the subscription
    write path."""
    expected = _hmac_md5(
        [
            str(payload.get("merchantAccount", "")),
            str(payload.get("orderReference", "")),
            str(payload.get("amount", "")),
            str(payload.get("currency", "")),
            str(payload.get("authCode", "")),
            str(payload.get("cardPan", "")),
            str(payload.get("transactionStatus", "")),
            str(payload.get("reasonCode", "")),
        ],
        settings.wayforpay_secret_key,
    )
    received = str(payload.get("merchantSignature", ""))
    return hmac.compare_digest(expected, received)


def build_webhook_ack(order_reference: str) -> Dict[str, Any]:
    """The exact acknowledgement shape WayForPay's docs require. Without a
    correctly-signed reply WayForPay keeps re-sending the same callback for
    up to 4 days."""
    ack_time = int(time.time())
    signature = _hmac_md5([order_reference, "accept", str(ack_time)], settings.wayforpay_secret_key)
    return {
        "orderReference": order_reference,
        "status": "accept",
        "time": ack_time,
        "signature": signature,
    }


def plan_name_for(plan: str) -> str:
    """Canonical subscriptions.plan_name for a checkout plan key -- both
    monthly and yearly WayForPay plans grant the same 'personal' (Premium)
    tier, billing period is tracked via current_period_end, not plan_name."""
    return "personal" if plan in PLAN_CONFIG else "free"


async def remove_regular_payment(order_reference: str) -> Dict[str, Any]:
    """Permanently stops the recurring charge tied to order_reference
    (WayForPay's REMOVE request, https://wiki.wayforpay.com/uk/view/852521).
    Irreversible on WayForPay's side ("без можливості відновлення") -- this
    only ever stops *future* charges, it never claws back a period the user
    already paid for, which is why the router still leaves the subscription
    row 'active' with cancel_at_period_end=True rather than downgrading
    access immediately.

    Auth here is merchantAccount + merchantPassword (not the HMAC signature
    used by Purchase/webhook) -- this is the one WayForPay call that uses
    the merchant dashboard password rather than the secret key, per its own
    docs.

    Raises RuntimeError with a human-readable reason on any non-Ok
    response, including transport failures -- callers must not silently
    treat a failed REMOVE as a successful cancellation.
    """
    payload = {
        "requestType": "REMOVE",
        "merchantAccount": settings.wayforpay_merchant_login,
        "merchantPassword": settings.wayforpay_merchant_password,
        "orderReference": order_reference,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(REGULAR_API_URL, json=payload)
    except httpx.HTTPError as exc:
        logger.error("wayforpay_remove_transport_error orderReference=%s error=%s", order_reference, repr(exc))
        raise RuntimeError("Could not reach WayForPay") from exc

    try:
        data = resp.json()
    except ValueError as exc:
        logger.error(
            "wayforpay_remove_invalid_response orderReference=%s status=%s body=%s",
            order_reference, resp.status_code, resp.text[:500],
        )
        raise RuntimeError("WayForPay returned an unreadable response") from exc

    reason_code = data.get("reasonCode")
    # 4100 is WayForPay's documented "Ok" code for this endpoint.
    if reason_code != 4100:
        logger.error(
            "wayforpay_remove_failed orderReference=%s reasonCode=%s reason=%s",
            order_reference, reason_code, data.get("reason"),
        )
        raise RuntimeError(str(data.get("reason") or f"WayForPay error {reason_code}"))

    logger.info("wayforpay_remove_succeeded orderReference=%s", order_reference)
    return data
