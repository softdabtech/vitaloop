"""Creem checkout, customer portal, and signed webhook endpoints.

Creem's hosted checkout owns all card handling. VITALOOP only sends the
minimum account/billing metadata needed to connect a payment to an existing
user; health data is never included in a checkout or webhook request.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_current_user
from app.services import supabase_service as svc

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/creem", tags=["billing"])


class CheckoutRequest(BaseModel):
    plan: str  # monthly | yearly


def _product_id_for(plan: str) -> str:
    products = {
        "monthly": settings.creem_monthly_product_id,
        "yearly": settings.creem_annual_product_id,
    }
    product_id = products.get(plan)
    if not product_id:
        raise HTTPException(status_code=400, detail="Unknown subscription plan")
    return product_id


def _safe_success_url(request: Request) -> str:
    """Use the requesting first-party origin when it is allowlisted."""
    origin = (request.headers.get("origin") or "").rstrip("/")
    allowed = {item.rstrip("/") for item in settings.origins_list}
    if origin in allowed and urlparse(origin).scheme == "https":
        return f"{origin}/subscription?upgraded=true"
    # Creem is EN-only (UA remains on WayForPay), so its fallback may safely
    # target the dedicated English cabinet without changing UA return URLs.
    return f"{settings.end_user_app_base_url.rstrip('/')}/subscription?upgraded=true"


def _reject_ua_origin(request: Request) -> None:
    """Creem is international-only; UA checkout is owned by WayForPay."""
    origin = (request.headers.get("origin") or "").lower()
    if "ua.vitaloop.today" in origin:
        raise HTTPException(status_code=403, detail="Creem checkout is unavailable for the Ukrainian service")


async def _creem_request(method: str, path: str, *, payload: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    if not settings.creem_api_key:
        raise HTTPException(status_code=503, detail="Billing is not configured")
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.request(
                method,
                f"{settings.creem_api_base_url.rstrip('/')}/v1{path}",
                headers={"x-api-key": settings.creem_api_key},
                json=payload,
            )
    except httpx.HTTPError as exc:
        logger.error("creem_api_transport_error path=%s error=%r", path, exc)
        raise HTTPException(status_code=502, detail="Could not reach the billing provider") from exc

    if response.is_error:
        logger.error("creem_api_error path=%s status=%s", path, response.status_code)
        raise HTTPException(status_code=502, detail="Billing provider rejected the request")
    try:
        return response.json()
    except ValueError as exc:
        logger.error("creem_api_invalid_json path=%s", path)
        raise HTTPException(status_code=502, detail="Billing provider returned an invalid response") from exc


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Create a hosted Creem checkout for the authenticated VITALOOP user."""
    user_id = str(current_user.get("sub") or "").strip()
    _reject_ua_origin(request)
    email = str(current_user.get("email") or "").strip()
    if not user_id or not email:
        raise HTTPException(status_code=400, detail="Account identity is incomplete")

    product_id = _product_id_for(body.plan)
    checkout = await _creem_request("POST", "/checkouts", payload={
        "product_id": product_id,
        "request_id": f"vitaloop:{user_id}:{body.plan}",
        "customer": {"email": email},
        "success_url": _safe_success_url(request),
        "metadata": {"vitaloop_user_id": user_id, "plan": body.plan},
        "custom_fields": [{
            "type": "checkbox",
            "key": "termsAccepted",
            "label": "Terms acceptance",
            "optional": False,
            "checkbox": {
                "label": "I agree to the [VITALOOP Terms](https://vitaloop.today/terms/), [Privacy Policy](https://vitaloop.today/privacy-policy/), [Refund Policy](https://vitaloop.today/refund-policy/), and [Creem Buyer Terms](https://www.creem.io/buyer-terms)",
            },
        }],
    })
    checkout_url = checkout.get("checkout_url")
    if not checkout_url:
        logger.error("creem_checkout_missing_url user_id=%s", user_id)
        raise HTTPException(status_code=502, detail="Billing provider did not return a checkout URL")
    logger.info("creem_checkout_created user_id=%s plan=%s checkout_id=%s", user_id, body.plan, checkout.get("id"))
    return {"checkout_url": checkout_url}


@router.post("/portal")
async def create_customer_portal(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Return Creem's hosted billing portal for an active Creem customer."""
    _reject_ua_origin(request)
    active_sub = await svc.get_user_active_subscription(str(current_user.get("sub") or ""))
    if not active_sub or active_sub.get("billing_provider") != "creem" or not active_sub.get("creem_customer_id"):
        raise HTTPException(status_code=404, detail="No Creem subscription found")
    portal = await _creem_request("POST", "/customers/billing", payload={
        "customer_id": active_sub["creem_customer_id"],
    })
    portal_url = portal.get("customer_portal_link")
    if not portal_url:
        raise HTTPException(status_code=502, detail="Billing provider did not return a portal URL")
    return {"portal_url": portal_url}


def _verify_signature(raw_body: bytes, signature: str) -> bool:
    if not signature or not settings.creem_webhook_secret:
        return False
    expected = hmac.new(settings.creem_webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _entity_id(value: Any) -> str:
    return str(value.get("id") or "") if isinstance(value, dict) else str(value or "")


def _plan_for_product(product_id: str) -> Optional[str]:
    if product_id in {settings.creem_monthly_product_id, settings.creem_annual_product_id}:
        return "personal"
    return None


async def _apply_paid_subscription(payload: dict[str, Any]) -> None:
    product = payload.get("product") or {}
    subscription = payload.get("subscription") or payload
    customer = payload.get("customer") or {}
    metadata = payload.get("metadata") or subscription.get("metadata") or {}
    product_id = _entity_id(product)
    subscription_id = _entity_id(subscription)
    user_id = str(metadata.get("vitaloop_user_id") or "")
    existing = await svc.get_subscription_by_creem_subscription_id(subscription_id) if subscription_id else None
    user_id = user_id or str((existing or {}).get("user_id") or "")
    plan_name = _plan_for_product(product_id) or str((existing or {}).get("plan_name") or "")

    if not user_id or not plan_name or not subscription_id:
        logger.warning("creem_webhook_unmatched_paid_subscription subscription_id=%s product_id=%s", subscription_id, product_id)
        return

    await svc.upsert_user_subscription_row(
        user_id,
        plan_name=plan_name,
        status="active",
        current_period_start=subscription.get("current_period_start_date"),
        current_period_end=subscription.get("current_period_end_date"),
        cancel_at_period_end=False,
        billing_provider="creem",
        creem_customer_id=_entity_id(customer),
        creem_subscription_id=subscription_id,
        creem_product_id=product_id,
    )


async def _apply_cancellation(payload: dict[str, Any]) -> None:
    subscription_id = _entity_id(payload)
    existing = await svc.get_subscription_by_creem_subscription_id(subscription_id)
    if not existing:
        logger.warning("creem_webhook_unmatched_cancellation subscription_id=%s", subscription_id)
        return
    # Creem supplies the paid-through date. Keep the row active until that
    # date so entitlement resolution honours the remaining paid access.
    await svc.upsert_user_subscription_row(
        str(existing["user_id"]),
        plan_name=str(existing.get("plan_name") or "personal"),
        status="active",
        current_period_start=payload.get("current_period_start_date") or existing.get("current_period_start"),
        current_period_end=payload.get("current_period_end_date") or existing.get("current_period_end"),
        cancel_at_period_end=True,
        billing_provider="creem",
        creem_customer_id=_entity_id(payload.get("customer")) or existing.get("creem_customer_id"),
        creem_subscription_id=subscription_id,
        creem_product_id=_entity_id(payload.get("product")) or existing.get("creem_product_id"),
    )


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def creem_webhook(request: Request):
    """Process only signed Creem events; never grant access from redirects."""
    raw_body = await request.body()
    if not _verify_signature(raw_body, request.headers.get("creem-signature", "")):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc

    event_id = str(event.get("id") or "")
    event_type = str(event.get("eventType") or "")
    if not event_id or not event_type:
        raise HTTPException(status_code=400, detail="Webhook event is incomplete")
    if await svc.was_creem_webhook_processed(event_id):
        return {"status": "already_processed"}

    payload = event.get("object") or {}
    if event_type in {"checkout.completed", "subscription.paid"}:
        await _apply_paid_subscription(payload)
    elif event_type == "subscription.canceled":
        await _apply_cancellation(payload)
    elif event_type in {"subscription.expired", "subscription.paused", "subscription.update", "refund.created", "dispute.created", "subscription.active", "subscription.trialing"}:
        logger.info("creem_webhook_received event_id=%s event_type=%s", event_id, event_type)
    else:
        logger.info("creem_webhook_ignored event_id=%s event_type=%s", event_id, event_type)

    await svc.mark_creem_webhook_processed(event_id, event_type)
    return {"status": "ok"}
