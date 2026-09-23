"""WayForPay checkout + webhook for the UA cabinet's Premium plan.

See app/services/wayforpay_service.py for the signature/payload logic this
router only wires up to HTTP. Kept deliberately thin: no subscription-state
decisions live here beyond "is this webhook's signature valid and is the
status Approved" -- everything else is in the service module so it stays
unit-testable without a live request.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.services import wayforpay_service as wfp

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/wayforpay", tags=["billing"])


class CheckoutRequest(BaseModel):
    plan: str  # "monthly" | "yearly"


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    """Returns the signed field set the UA Subscription page passes to
    wayforpay.run(). The secret key itself never leaves the backend --
    only merchantSignature, already computed with it, goes to the client."""
    user_id = current_user.get("sub")
    email = str(current_user.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Account has no email on file")

    try:
        payload = wfp.build_purchase_payload(
            user_id=user_id,
            plan=body.plan,
            client_email=email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    logger.info(
        "wayforpay_checkout_created user_id=%s plan=%s orderReference=%s",
        user_id, body.plan, payload["orderReference"],
    )
    return payload


@router.post("/webhook")
async def wayforpay_webhook(request: Request):
    """WayForPay's serviceUrl target. Public by design (WayForPay calls
    this directly, with no user session) -- authenticity comes entirely
    from verify_webhook_signature(), not from auth middleware. WayForPay
    retries for up to 4 days if it doesn't get back the exact ack shape
    build_webhook_ack() returns, so every path below -- including rejected
    ones -- must still return a well-formed ack for a request whose
    orderReference we can at least read, or WayForPay will keep hammering
    this endpoint for the same event."""
    try:
        payload = await request.json()
    except Exception:
        logger.warning("wayforpay_webhook_invalid_json")
        raise HTTPException(status_code=400, detail="Invalid JSON")

    order_reference = str(payload.get("orderReference") or "")

    if not wfp.verify_webhook_signature(payload):
        logger.warning(
            "wayforpay_webhook_signature_mismatch orderReference=%s", order_reference,
        )
        # Do not ack an unsigned/forged payload -- let it be retried (or
        # investigated) rather than silently accepted.
        raise HTTPException(status_code=400, detail="Invalid signature")

    transaction_status = str(payload.get("transactionStatus") or "")
    user_id = wfp.parse_user_id_from_order_reference(order_reference)

    if not user_id:
        logger.error(
            "wayforpay_webhook_unresolvable_order orderReference=%s status=%s",
            order_reference, transaction_status,
        )
        # Signature is valid but we can't map this order back to a user --
        # ack anyway (a malformed-but-signed order isn't something re-
        # delivery will fix) so WayForPay stops retrying, but grant nothing.
        return wfp.build_webhook_ack(order_reference)

    if transaction_status != wfp.APPROVED_STATUS:
        logger.info(
            "wayforpay_webhook_non_approved user_id=%s orderReference=%s status=%s",
            user_id, order_reference, transaction_status,
        )
        return wfp.build_webhook_ack(order_reference)

    regular_mode = str(payload.get("regularMode") or "")
    plan = "yearly" if regular_mode == "yearly" else "monthly"

    await svc.upsert_user_subscription_row(
        user_id,
        plan_name=wfp.plan_name_for(plan),
        status="active",
        cancel_at_period_end=False,
        billing_provider="wayforpay",
        wayforpay_order_reference=order_reference,
        wayforpay_rec_token=str(payload.get("recToken") or "") or None,
        wayforpay_regular_mode=regular_mode or None,
    )

    logger.info(
        "wayforpay_webhook_approved user_id=%s orderReference=%s plan=%s",
        user_id, order_reference, plan,
    )
    return wfp.build_webhook_ack(order_reference)
