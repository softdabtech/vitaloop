import stripe
import json
import logging
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse

from app.config import settings
from app.dependencies import get_current_user
from app.services.supabase_service import (
    update_user_subscription,
    get_user_by_stripe_sub,
    record_stripe_event,
    sync_stripe_subscription_to_subscriptions_table,
    get_user_account,
    get_user_upload_count,
)

stripe.api_key = settings.stripe_secret_key
logger = logging.getLogger("uvicorn.error")

router = APIRouter()


@router.post("/checkout")
async def create_checkout_session(
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout session for the $49/mo subscription."""
    if not settings.stripe_secret_key or not settings.stripe_price_id:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    user_id: str = current_user["sub"]
    user_email: str = current_user.get("email", "")

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        success_url=settings.stripe_success_url,
        cancel_url=settings.stripe_cancel_url,
        customer_email=user_email or None,
        metadata={"user_id": user_id},
        client_reference_id=user_id,
    )

    return {"checkout_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events to sync subscription status.
    
    Processes validated Stripe events and updates user subscription status
    with idempotency via stripe_events table.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        logger.warning("stripe_webhook_invalid_signature")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

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

    if not user_id or not sub_id:
        logger.warning(f"stripe_checkout_missing_ids user_id={user_id} sub_id={sub_id}")
        return

    # Update users table for legacy compatibility
    await update_user_subscription(user_id, sub_status="active", sub_id=sub_id)

    # Sync to normalized subscriptions table
    await sync_stripe_subscription_to_subscriptions_table(
        user_id=user_id,
        stripe_subscription_id=sub_id,
        stripe_customer_id=customer_id,
        stripe_status="active",
        plan_name="core",
    )

    logger.info(f"stripe_subscription_created user_id={user_id} sub_id={sub_id[:20]}")


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

    # Update users table
    await update_user_subscription(user_id, sub_status=internal_status, sub_id=sub_id)

    # Sync to subscriptions table
    await sync_stripe_subscription_to_subscriptions_table(
        user_id=user_id,
        stripe_subscription_id=sub_id,
        stripe_customer_id=customer_id,
        stripe_status=stripe_status,
        current_period_start=data.get("current_period_start"),
        current_period_end=data.get("current_period_end"),
        cancel_at_period_end=data.get("cancel_at_period_end", False),
        plan_name="core",
    )

    logger.info(f"stripe_subscription_updated user_id={user_id} status={stripe_status}")


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
    """Return current subscription status + freemium upload usage for the authenticated user."""
    user_id: str = current_user["sub"]
    account = await get_user_account(user_id)
    upload_count = await get_user_upload_count(user_id)
    sub_status = str(account.get("sub_status") or "free").lower()
    global_role = str(account.get("global_role") or "end_user").lower()
    limit = settings.freemium_upload_limit

    return {
        "sub_status": sub_status,
        "global_role": global_role,
        "is_premium": sub_status == "active" or global_role != "end_user",
        "upload_count": upload_count,
        "upload_limit": limit if (sub_status != "active" and global_role == "end_user") else None,
        "uploads_remaining": max(0, limit - upload_count) if (sub_status != "active" and global_role == "end_user") else None,
    }
