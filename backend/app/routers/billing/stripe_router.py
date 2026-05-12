import stripe
import json
import logging
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from app.config import settings
from app.dependencies import get_current_user
from app.services.supabase_service import (
    update_user_subscription,
    get_user_by_stripe_sub,
    get_user_active_subscription,
    record_stripe_event,
    sync_stripe_subscription_to_subscriptions_table,
    get_user_account,
    get_user_upload_count,
    get_user_subscription_history,
)

stripe.api_key = settings.stripe_secret_key
logger = logging.getLogger("uvicorn.error")

router = APIRouter()

# Error message constants
_STRIPE_NOT_CONFIGURED = "Stripe not configured"
_STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED = "Webhook secret not configured"
_INVALID_WEBHOOK_SIGNATURE = "Invalid webhook signature"
_NO_ACTIVE_SUBSCRIPTION = "No active subscription found"
_NO_BILLING_ACCOUNT = "No billing account found. Subscribe first."

# ---------------------------------------------------------------------------
# Plan → Stripe price ID mapping
# ---------------------------------------------------------------------------

VALID_PLANS = {"personal", "practitioner"}
_FREE_PLAN_NAMES = {"free"}


def _price_id_for_plan(plan_id: str) -> str:
    """Return the configured Stripe price ID for a given plan slug."""
    mapping = {
        "personal": settings.stripe_price_id_personal or settings.stripe_price_id,
        "practitioner": settings.stripe_price_id_practitioner,
    }
    price_id = mapping.get(plan_id, "")
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe price not configured for plan '{plan_id}'",
        )
    return price_id


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CheckoutRequest(BaseModel):
    plan_id: str = "personal"  # "personal" | "practitioner"


# ---------------------------------------------------------------------------
# POST /billing/checkout
# ---------------------------------------------------------------------------

@router.post("/checkout")
async def create_checkout_session(
    body: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout session for the requested subscription plan."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail=_STRIPE_NOT_CONFIGURED)

    plan_id = body.plan_id.lower()
    if plan_id not in VALID_PLANS:
        raise HTTPException(status_code=422, detail=f"Invalid plan_id. Choose from: {', '.join(VALID_PLANS)}")

    price_id = _price_id_for_plan(plan_id)
    user_id: str = current_user["sub"]
    user_email: str = current_user.get("email", "")

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=settings.stripe_success_url,
            cancel_url=settings.stripe_cancel_url,
            customer_email=user_email or None,
            metadata={"user_id": user_id, "plan_name": plan_id},
            client_reference_id=user_id,
        )
    except stripe.error.StripeError as e:
        logger.error(f"stripe_checkout_create_failed user_id={user_id} error={str(e)}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to create checkout session: {str(e)}"
        ) from e
    except Exception as e:
        logger.error(f"stripe_checkout_unexpected_error user_id={user_id} error={str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while creating checkout session"
        ) from e

    return {"checkout_url": session.url, "plan_id": plan_id}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events to sync subscription status.
    
    Processes validated Stripe events and updates user subscription status
    with idempotency via stripe_events table.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail=_STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED)

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        logger.warning("stripe_webhook_invalid_signature")
        raise HTTPException(status_code=400, detail=_INVALID_WEBHOOK_SIGNATURE)

    event_id = event.get("id", "unknown")
    event_type = event.get("type", "unknown")
    data = event.get("data", {}).get("object", {})

    # Record event for idempotency (returns False if duplicate)
    is_new_event = await record_stripe_event(
        event_id=event_id,
        event_type=event_type,
        event_payload={"type": event_type, "object_type": data.get("object", "unknown")},
    )

    if not is_new_event:
        logger.info(f"stripe_webhook_duplicate event_id={event_id} type={event_type}")
        return JSONResponse({"received": True})

    # Process event by type
    try:
        if event_type == "checkout.session.completed":
            await _handle_checkout_session_completed(data)
        elif event_type == "customer.subscription.updated":
            await _handle_subscription_updated(data)
        elif event_type == "customer.subscription.deleted":
            await _handle_subscription_deleted(data)
        elif event_type == "customer.subscription.paused":
            await _handle_subscription_paused(data)
        elif event_type == "invoice.payment_failed":
            await _handle_payment_failed(data)
        else:
            logger.info(f"stripe_webhook_unhandled event_type={event_type}")
    except Exception as e:
        logger.error(f"stripe_webhook_handler_error type={event_type} error={str(e)}")
        # Do not re-raise; webhook should return 200 even if processing fails
        # (Stripe will retry on 5xx or timeouts)

    return JSONResponse({"received": True})


async def _handle_checkout_session_completed(data: dict):
    """Handle checkout.session.completed event."""
    user_id = data.get("client_reference_id") or (data.get("metadata") or {}).get("user_id")
    sub_id = data.get("subscription")
    customer_id = data.get("customer")
    plan_name = (data.get("metadata") or {}).get("plan_name") or "personal"

    if not user_id or not sub_id:
        logger.warning(f"stripe_checkout_missing_ids user_id={user_id} sub_id={sub_id}")
        return

    # Update users table for legacy compatibility
    await update_user_subscription(user_id, sub_status="active", sub_id=sub_id, plan_tier=plan_name)

    # Sync to normalized subscriptions table
    await sync_stripe_subscription_to_subscriptions_table(
        user_id=user_id,
        stripe_subscription_id=sub_id,
        stripe_customer_id=customer_id,
        stripe_status="active",
        plan_name=plan_name,
    )

    logger.info(f"stripe_subscription_created user_id={user_id} sub_id={sub_id[:20]} plan={plan_name}")


async def _handle_subscription_updated(data: dict):
    """Handle customer.subscription.updated event."""
    sub_id = data.get("id")
    customer_id = data.get("customer")
    stripe_status = data.get("status", "unknown")

    if not sub_id:
        logger.warning("stripe_subscription_update_missing_id")
        return

    user = await get_user_by_stripe_sub(sub_id)
    if not user:
        logger.warning(f"stripe_subscription_update_user_not_found sub_id={sub_id}")
        return

    user_id = user["id"]

    # Map Stripe status to internal status
    status_map = {
        "active": "active",
        "trialing": "active",
        "past_due": "past_due",
        "paused": "paused",
        "cancelled": "cancelled",
        "unpaid": "past_due",
    }
    internal_status = status_map.get(stripe_status, stripe_status)

    # Preserve existing plan_name from subscriptions table
    existing = await get_user_active_subscription(user_id)
    plan_name = (existing or {}).get("plan_name") or "personal"

    # Update users table
    await update_user_subscription(user_id, sub_status=internal_status, sub_id=sub_id, plan_tier=plan_name)

    # Sync to subscriptions table
    await sync_stripe_subscription_to_subscriptions_table(
        user_id=user_id,
        stripe_subscription_id=sub_id,
        stripe_customer_id=customer_id,
        stripe_status=stripe_status,
        current_period_start=data.get("current_period_start"),
        current_period_end=data.get("current_period_end"),
        cancel_at_period_end=data.get("cancel_at_period_end", False),
        plan_name=plan_name,
    )

    logger.info(f"stripe_subscription_updated user_id={user_id} status={stripe_status} plan={plan_name}")


async def _handle_subscription_deleted(data: dict):
    """Handle customer.subscription.deleted event."""
    sub_id = data.get("id")
    if not sub_id:
        logger.warning("stripe_subscription_delete_missing_id")
        return

    user = await get_user_by_stripe_sub(sub_id)
    if not user:
        logger.warning(f"stripe_subscription_delete_user_not_found sub_id={sub_id}")
        return

    user_id = user["id"]
    await update_user_subscription(user_id, sub_status="cancelled")

    await sync_stripe_subscription_to_subscriptions_table(
        user_id=user_id,
        stripe_subscription_id=sub_id,
        stripe_status="cancelled",
    )

    logger.info(f"stripe_subscription_cancelled user_id={user_id} sub_id={sub_id[:20]}")


async def _handle_subscription_paused(data: dict):
    """Handle customer.subscription.paused event."""
    sub_id = data.get("id")
    customer_id = data.get("customer")
    if not sub_id:
        logger.warning("stripe_subscription_pause_missing_id")
        return

    user = await get_user_by_stripe_sub(sub_id)
    if not user:
        logger.warning(f"stripe_subscription_pause_user_not_found sub_id={sub_id}")
        return

    user_id = user["id"]
    await update_user_subscription(user_id, sub_status="paused")

    await sync_stripe_subscription_to_subscriptions_table(
        user_id=user_id,
        stripe_subscription_id=sub_id,
        stripe_customer_id=customer_id,
        stripe_status="paused",
    )

    logger.info(f"stripe_subscription_paused user_id={user_id}")


async def _handle_payment_failed(data: dict):
    """Handle invoice.payment_failed event."""
    sub_id = data.get("subscription")
    if not sub_id:
        logger.warning("stripe_payment_failed_missing_sub_id")
        return

    user = await get_user_by_stripe_sub(sub_id)
    if not user:
        logger.warning(f"stripe_payment_failed_user_not_found sub_id={sub_id}")
        return

    user_id = user["id"]
    await update_user_subscription(user_id, sub_status="past_due")

    await sync_stripe_subscription_to_subscriptions_table(
        user_id=user_id,
        stripe_subscription_id=sub_id,
        stripe_status="past_due",
    )

    logger.info(f"stripe_payment_failed user_id={user_id}")


@router.get("/subscription")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Return current subscription status + plan + freemium upload usage for the authenticated user."""
    user_id: str = current_user["sub"]
    active_sub = None
    try:
        account = await get_user_account(user_id)
        upload_count = await get_user_upload_count(user_id)
        active_sub = await get_user_active_subscription(user_id)
        account_sub_status = str(account.get("sub_status") or "free").lower()
        # Subscriptions table can be newer than users.sub_status, but an active
        # free plan must not be interpreted as paid premium access.
        sub_table_status = str((active_sub or {}).get("status") or "free").lower()
        claim_sub_status = "active" if bool(current_user.get("subscription_active")) else str(current_user.get("subscription_status") or "free").lower()
        global_role = str(account.get("global_role") or current_user.get("global_role") or "end_user").lower()
        plan_name = str((active_sub or {}).get("plan_name") or account.get("plan_tier") or "").strip().lower() or None
        paid_from_sub_table = bool(
            active_sub
            and sub_table_status == "active"
            and plan_name
            and plan_name not in _FREE_PLAN_NAMES
        )
        paid_from_account = account_sub_status == "active"
        is_premium = global_role != "end_user" or paid_from_account or paid_from_sub_table
        sub_status = "active" if is_premium and global_role == "end_user" else account_sub_status
    except Exception as ex:
        logger.warning("stripe_subscription_status_fallback user_id=%s error=%s", user_id, repr(ex))
        # Degrade gracefully on transient data-layer failures.
        sub_status = "active" if bool(current_user.get("subscription_active")) else str(current_user.get("subscription_status") or "free").lower()
        global_role = str(current_user.get("global_role") or "end_user").lower()
        plan_name = None
        upload_count = 0
        is_premium = sub_status == "active" or global_role != "end_user"

    limit = settings.freemium_upload_limit
    is_free = not is_premium and global_role == "end_user"
    customer_id = (active_sub or {}).get("stripe_customer_id")

    return {
        "sub_status": sub_status,
        "plan_name": plan_name,  # "personal" | "practitioner" | None
        "global_role": global_role,
        "is_premium": is_premium,
        "has_stripe_customer": bool(customer_id),
        "cancel_at_period_end": (active_sub or {}).get("cancel_at_period_end", False),
        "current_period_end": (active_sub or {}).get("current_period_end"),
        "upload_count": upload_count,
        "upload_limit": limit if is_free else None,
        "uploads_remaining": max(0, limit - upload_count) if is_free else None,
    }


@router.post("/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Schedule the current subscription to cancel at period end."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail=_STRIPE_NOT_CONFIGURED)

    user_id: str = current_user["sub"]
    active_sub = await get_user_active_subscription(user_id)
    if not active_sub or not active_sub.get("stripe_subscription_id"):
        raise HTTPException(status_code=404, detail=_NO_ACTIVE_SUBSCRIPTION)

    stripe_sub_id = active_sub["stripe_subscription_id"]
    updated = stripe.Subscription.modify(stripe_sub_id, cancel_at_period_end=True)

    await sync_stripe_subscription_to_subscriptions_table(
        user_id=user_id,
        stripe_subscription_id=stripe_sub_id,
        stripe_status=updated.get("status", "active"),
        cancel_at_period_end=True,
        plan_name=active_sub.get("plan_name", "personal"),
    )

    logger.info(f"stripe_subscription_cancel_requested user_id={user_id} sub_id={stripe_sub_id[:20]}")
    return {"ok": True, "cancel_at_period_end": True, "period_end": updated.get("current_period_end")}


@router.get("/billing-history")
async def get_billing_history(current_user: dict = Depends(get_current_user)):
    """Return all subscription history rows for the authenticated user."""
    user_id: str = current_user["sub"]
    rows = await get_user_subscription_history(user_id)
    return {"history": rows}


@router.post("/portal")
async def create_customer_portal(current_user: dict = Depends(get_current_user)):
    """Create a Stripe Customer Portal session so the user can manage billing details."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail=_STRIPE_NOT_CONFIGURED)

    user_id: str = current_user["sub"]
    active_sub = await get_user_active_subscription(user_id)
    customer_id = (active_sub or {}).get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=404, detail=_NO_BILLING_ACCOUNT)

    portal_session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=settings.stripe_portal_return_url,
    )

    return {"portal_url": portal_session.url}
