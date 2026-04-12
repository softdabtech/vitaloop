import stripe
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse

from app.config import settings
from app.dependencies import get_current_user
from app.services.supabase_service import update_user_subscription, get_user_by_stripe_sub

stripe.api_key = settings.stripe_secret_key

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
        success_url="https://app.vitaloop.com/dashboard?sub=success",
        cancel_url="https://app.vitaloop.com/dashboard?sub=cancelled",
        customer_email=user_email or None,
        metadata={"user_id": user_id},
        client_reference_id=user_id,
    )

    return {"checkout_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events to sync subscription status."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = data.get("client_reference_id") or data.get("metadata", {}).get("user_id")
        sub_id = data.get("subscription")
        if user_id:
            await update_user_subscription(user_id, sub_status="active", sub_id=sub_id)

    elif event_type in ("customer.subscription.deleted", "customer.subscription.paused"):
        sub_id = data.get("id")
        if sub_id:
            user = await get_user_by_stripe_sub(sub_id)
            if user:
                await update_user_subscription(user["id"], sub_status="cancelled")

    elif event_type == "invoice.payment_failed":
        sub_id = data.get("subscription")
        if sub_id:
            user = await get_user_by_stripe_sub(sub_id)
            if user:
                await update_user_subscription(user["id"], sub_status="cancelled")

    return JSONResponse({"received": True})
