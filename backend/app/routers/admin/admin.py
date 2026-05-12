import asyncio

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field
from app.config import settings
from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.services.claude_service import is_llm_configured
from app.services.email_service import send_ops_alert_email

router = APIRouter()


class AdminUserSubscriptionUpdateRequest(BaseModel):
    sub_status: str = Field(min_length=1, max_length=64)


class AdminUserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    global_role: str | None = Field(default=None, min_length=1, max_length=64)
    sub_status: str | None = Field(default=None, min_length=1, max_length=64)


def _is_set(value: str) -> bool:
    return bool(str(value or "").strip())


def _is_http_url(value: str) -> bool:
    raw = str(value or "").strip().lower()
    return raw.startswith("http://") or raw.startswith("https://")


# Error message constants
_UNSUPPORTED_GLOBAL_ROLE = "Unsupported global_role"
_AT_LEAST_ONE_FIELD_REQUIRED = "At least one field is required"
_SUB_STATUS_REQUIRED = "sub_status is required"
_RECIPIENT_EMAIL_REQUIRED = "recipient_email is required"
_ALERT_TITLE_REQUIRED = "alert_title is required"
_ALERT_MESSAGE_REQUIRED = "alert_message is required"


async def _probe_redis_connectivity(redis_url: str, timeout_seconds: float = 1.5) -> tuple[bool, str | None]:
    try:
        import redis.asyncio as redis
    except Exception:
        return False, "redis_dependency_missing"

    client = redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
    try:
        pong = await asyncio.wait_for(client.ping(), timeout=timeout_seconds)
        return bool(pong), None if pong else "redis_ping_failed"
    except asyncio.TimeoutError:
        return False, "redis_timeout"
    except Exception:
        return False, "redis_unreachable"
    finally:
        await client.aclose()


async def _get_rate_limiter_runtime_status() -> dict:
    backend = (settings.rate_limit_backend or "inmemory").strip().lower()
    backend = backend if backend in {"inmemory", "redis"} else "inmemory"

    if backend != "redis":
        return {
            "backend": backend,
            "ok": True,
            "redis": {
                "required": False,
                "configured": _is_set(settings.rate_limit_redis_url),
                "reachable": None,
                "reason": "not_required",
            },
        }

    redis_url = (settings.rate_limit_redis_url or "").strip()
    if not redis_url:
        return {
            "backend": backend,
            "ok": False,
            "redis": {
                "required": True,
                "configured": False,
                "reachable": False,
                "reason": "missing_redis_url",
            },
        }

    reachable, reason = await _probe_redis_connectivity(redis_url)
    return {
        "backend": backend,
        "ok": reachable,
        "redis": {
            "required": True,
            "configured": True,
            "reachable": reachable,
            "reason": reason,
        },
    }


async def _build_runtime_readiness_payload() -> dict:
    rate_limiter = await _get_rate_limiter_runtime_status()
    requires_redis_url = rate_limiter["backend"] == "redis"

    # Required: app cannot function without these
    required_checks = {
        "supabase_url": _is_set(settings.supabase_url),
        "supabase_service_role_key": _is_set(settings.supabase_service_role_key),
        "llm_provider_key": is_llm_configured(),
        "resend_api_key": _is_set(settings.resend_api_key),
        "resend_from_email": _is_set(settings.resend_from_email),
        "stripe_secret_key": _is_set(settings.stripe_secret_key),
        "stripe_webhook_secret": _is_set(settings.stripe_webhook_secret),
        "stripe_price_id": _is_set(settings.stripe_price_id),
        "rate_limit_backend": _is_set(settings.rate_limit_backend),
        "rate_limit_redis_url": (not requires_redis_url) or _is_set(settings.rate_limit_redis_url),
    }
    # Optional: desirable but not blocking
    optional_checks = {
        "sentry_dsn": _is_set(settings.sentry_dsn),
    }
    all_checks = {**required_checks, **optional_checks}
    missing = [name for name, ok in required_checks.items() if not ok]
    warnings = [name for name, ok in optional_checks.items() if not ok]
    return {
        "ok": len(missing) == 0 and rate_limiter["ok"],
        "checks": all_checks,
        "missing": missing,
        "missing_count": len(missing),
        "warnings": warnings,
        "rate_limiter": rate_limiter,
    }


async def _require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    user_meta = current_user.get("user_metadata") or {}
    app_meta = current_user.get("app_metadata") or {}
    
    # First check JWT metadata (fast path)
    is_super_admin = user_meta.get("is_super_admin") or app_meta.get("is_super_admin")
    
    # If not in JWT, check the database (for users with global_role set but not is_super_admin flag)
    if not is_super_admin:
        # Check if user has super_admin global_role in their account/metadata
        global_role_jwt = (
            current_user.get("global_role")
            or app_meta.get("global_role") 
            or user_meta.get("global_role")
        )
        if global_role_jwt == "super_admin":
            is_super_admin = True
        else:
            # Check database as last resort
            user_id = current_user.get("sub")
            try:
                account = await svc.get_user_account(user_id)
                if account and account.get("global_role") == "super_admin":
                    is_super_admin = True
            except Exception:
                pass
    
    if not is_super_admin:
        raise HTTPException(
            status_code=403,
            detail={"detail": "Access denied", "code": "ACCESS_DENIED"},
        )
    return current_user


@router.get("/overview")
async def admin_overview(current_user: dict = Depends(_require_super_admin)):
    return await svc.get_admin_overview()


@router.get("/users")
async def admin_users(_: dict = Depends(_require_super_admin)):
    return await svc.get_all_users_for_admin()


@router.get("/users/{user_id}")
async def admin_user_detail(user_id: str, _: dict = Depends(_require_super_admin)):
    return await svc.get_admin_user_detail(user_id)


@router.patch("/users/{user_id}")
async def admin_update_user(
    user_id: str,
    body: AdminUserUpdateRequest,
    _: dict = Depends(_require_super_admin),
):
    allowed_global_roles = {"end_user", "support", "practitioner", "client_admin", "super_admin"}
    full_name = body.full_name.strip() if isinstance(body.full_name, str) else None
    global_role = str(body.global_role or "").strip().lower() or None
    sub_status = str(body.sub_status or "").strip().lower() or None

    if global_role is not None and global_role not in allowed_global_roles:
        raise HTTPException(status_code=400, detail=_UNSUPPORTED_GLOBAL_ROLE)

    if full_name is None and global_role is None and sub_status is None:
        raise HTTPException(status_code=400, detail=_AT_LEAST_ONE_FIELD_REQUIRED)

    await svc.update_admin_user_fields(
        user_id,
        full_name=full_name,
        global_role=global_role,
        sub_status=sub_status,
    )
    return {
        "ok": True,
        "user_id": user_id,
        "full_name": full_name,
        "global_role": global_role,
        "sub_status": sub_status,
    }


@router.patch("/users/{user_id}/subscription")
async def admin_update_user_subscription(
    user_id: str,
    body: AdminUserSubscriptionUpdateRequest,
    _: dict = Depends(_require_super_admin),
):
    sub_status = str(body.sub_status or "").strip().lower()
    if not sub_status:
        raise HTTPException(status_code=400, detail=_SUB_STATUS_REQUIRED)

    await svc.update_user_subscription(user_id=user_id, sub_status=sub_status)
    return {"ok": True, "user_id": user_id, "sub_status": sub_status}


@router.get("/platform-overview")
async def admin_platform_overview(_: dict = Depends(_require_super_admin)):
    return await svc.get_platform_overview()


@router.get("/public-platform-stats")
async def admin_public_platform_stats():
    overview = await svc.get_platform_overview()
    return {
        "total_users": overview.get("total_users", 0),
        "total_organizations": overview.get("total_organizations", 0),
        "active_programs": overview.get("active_programs", 0),
        "new_registrations_24h": overview.get("new_registrations_24h", 0),
        "generated_at": overview.get("generated_at"),
    }


@router.get("/funnel-overview")
async def admin_funnel_overview(
    days: int = 30,
    min_dropoff_reached: int = 1,
    dropoff_sort: str = "count",
    dropoff_limit: int = 10,
    _: dict = Depends(_require_super_admin),
):
    safe_days = max(1, min(days, 365))
    safe_min_dropoff_reached = max(1, min(min_dropoff_reached, 10000))
    safe_dropoff_sort = str(dropoff_sort or "count").strip().lower()
    if safe_dropoff_sort not in {"count", "rate", "order"}:
        safe_dropoff_sort = "count"
    safe_dropoff_limit = max(1, min(dropoff_limit, 100))
    return await svc.get_funnel_overview(
        days=safe_days,
        min_dropoff_reached=safe_min_dropoff_reached,
        dropoff_sort=safe_dropoff_sort,
        dropoff_limit=safe_dropoff_limit,
    )


@router.get("/audit-logs")
async def admin_audit_logs(
    limit: int = 200,
    organization_id: str | None = None,
    _: dict = Depends(_require_super_admin),
):
    safe_limit = max(1, min(limit, 1000))
    return await svc.get_audit_logs(limit=safe_limit, organization_id=organization_id)


@router.get("/runtime-readiness")
async def admin_runtime_readiness(_: dict = Depends(_require_super_admin)):
    return await _build_runtime_readiness_payload()


@router.get("/stripe-readiness")
async def admin_stripe_readiness(_: dict = Depends(_require_super_admin)):
    checks = {
        "stripe_secret_key": _is_set(settings.stripe_secret_key),
        "stripe_price_id": _is_set(settings.stripe_price_id),
        "stripe_success_url": _is_http_url(settings.stripe_success_url),
        "stripe_cancel_url": _is_http_url(settings.stripe_cancel_url),
        "stripe_webhook_secret": _is_set(settings.stripe_webhook_secret),
    }

    checkout_required = [
        "stripe_secret_key",
        "stripe_price_id",
        "stripe_success_url",
        "stripe_cancel_url",
    ]
    webhook_required = [
        "stripe_secret_key",
        "stripe_webhook_secret",
    ]

    missing_checkout = [name for name in checkout_required if not checks[name]]
    missing_webhook = [name for name in webhook_required if not checks[name]]

    return {
        "ok": len(missing_checkout) == 0 and len(missing_webhook) == 0,
        "checks": checks,
        "checkout": {
            "ready": len(missing_checkout) == 0,
            "missing": missing_checkout,
        },
        "webhook": {
            "ready": len(missing_webhook) == 0,
            "missing": missing_webhook,
        },
        "notes": [
            "This is a config-only smoke check (no outbound Stripe API calls).",
            "Use /stripe/checkout and Stripe webhook tests after readiness is green.",
        ],
    }


@router.get("/red-flags")
async def admin_red_flags(acknowledged: bool = False, _: dict = Depends(_require_super_admin)):
    return await svc.get_all_red_flags(acknowledged=acknowledged)


@router.post("/send-ops-alert")
async def admin_send_ops_alert(
    body: dict = Body(...),
    _: dict = Depends(_require_super_admin),
):
    """Send an operational alert email to super_admin accounts.
    
    Request body:
    {
        "recipient_email": "admin@org.com",
        "organization_name": "VITALOOP Inc",
        "alert_title": "High Error Rate",
        "alert_message": "Error rate exceeded 5%",
        "alert_level": "warning",  # warning, critical, info
        "action_url": "https://api.vitaloop.today/admin/runtime-readiness"  # optional
    }
    """
    recipient_email = str(body.get("recipient_email") or "").strip()
    organization_name = str(body.get("organization_name") or "").strip()
    alert_title = str(body.get("alert_title") or "").strip()
    alert_message = str(body.get("alert_message") or "").strip()
    alert_level = str(body.get("alert_level") or "warning").strip().lower()
    action_url = str(body.get("action_url") or "").strip() or None

    if not recipient_email:
        raise HTTPException(status_code=400, detail=_RECIPIENT_EMAIL_REQUIRED)
    if not alert_title:
        raise HTTPException(status_code=400, detail=_ALERT_TITLE_REQUIRED)
    if not alert_message:
        raise HTTPException(status_code=400, detail=_ALERT_MESSAGE_REQUIRED)

    if alert_level not in ("warning", "critical", "info"):
        alert_level = "warning"

    try:
        sent = await send_ops_alert_email(
            to_email=recipient_email,
            organization_name=organization_name or "VITALOOP",
            alert_title=alert_title,
            alert_message=alert_message,
            alert_level=alert_level,
            action_url=action_url,
        )
        return {
            "ok": sent,
            "message": "Alert sent successfully" if sent else "Failed to send alert",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send alert: {str(e)}")


@router.post("/red-flags/{flag_id}/acknowledge")
async def admin_acknowledge_flag(flag_id: str, current: dict = Depends(_require_super_admin)):
    from app.services.supabase_service import _get_supabase, _run
    from datetime import datetime, timezone
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("red_flag_events")
        .update({
            "acknowledged": True,
            "acknowledged_at": datetime.now(timezone.utc).isoformat(),
            "acknowledged_by": current.get("sub", "admin"),
        })
        .eq("id", flag_id)
        .execute()
    )
    return resp.data[0] if resp.data else {}


@router.post("/retention/lab-uploads/redact")
async def admin_redact_old_lab_upload_text(
    dry_run: bool = True,
    days: int | None = None,
    batch_size: int | None = None,
    _: dict = Depends(_require_super_admin),
):
    return await svc.redact_old_lab_upload_text(
        retention_days=days if days is not None else settings.lab_upload_raw_retention_days,
        batch_size=batch_size if batch_size is not None else settings.lab_upload_retention_batch_size,
        dry_run=dry_run,
    )


@router.get("/retention/status")
async def admin_retention_status(_: dict = Depends(_require_super_admin)):
    return await svc.get_retention_redaction_status()
