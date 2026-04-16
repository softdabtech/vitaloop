import asyncio

from fastapi import APIRouter, Depends, HTTPException, Body
from app.config import settings
from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.services.claude_service import is_llm_configured
from app.services.email_service import send_ops_alert_email

router = APIRouter()


def _is_set(value: str) -> bool:
    return bool(str(value or "").strip())


def _is_http_url(value: str) -> bool:
    raw = str(value or "").strip().lower()
    return raw.startswith("http://") or raw.startswith("https://")


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

    checks = {
        "supabase_url": _is_set(settings.supabase_url),
        "supabase_service_role_key": _is_set(settings.supabase_service_role_key),
        "llm_provider_key": is_llm_configured(),
        "resend_api_key": _is_set(settings.resend_api_key),
        "resend_from_email": _is_set(settings.resend_from_email),
        "sentry_dsn": _is_set(settings.sentry_dsn),
        "stripe_secret_key": _is_set(settings.stripe_secret_key),
        "stripe_webhook_secret": _is_set(settings.stripe_webhook_secret),
        "stripe_price_id": _is_set(settings.stripe_price_id),
        "rate_limit_backend": _is_set(settings.rate_limit_backend),
        "rate_limit_redis_url": (not requires_redis_url) or _is_set(settings.rate_limit_redis_url),
    }
    missing = [name for name, ok in checks.items() if not ok]
    return {
        "ok": len(missing) == 0 and rate_limiter["ok"],
        "checks": checks,
        "missing": missing,
        "missing_count": len(missing),
        "rate_limiter": rate_limiter,
    }


def _require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    user_meta = current_user.get("user_metadata") or {}
    app_meta = current_user.get("app_metadata") or {}
    is_super_admin = user_meta.get("is_super_admin") or app_meta.get("is_super_admin")
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


@router.get("/platform-overview")
async def admin_platform_overview(_: dict = Depends(_require_super_admin)):
    return await svc.get_platform_overview()


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
        raise HTTPException(status_code=400, detail="recipient_email is required")
    if not alert_title:
        raise HTTPException(status_code=400, detail="alert_title is required")
    if not alert_message:
        raise HTTPException(status_code=400, detail="alert_message is required")

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
