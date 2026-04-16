import asyncio
from fastapi import APIRouter
from app.config import settings
from app.services import supabase_service as svc

router = APIRouter()


@router.get("/health")
async def health_check():
    """Quick health check (always fast, no external calls)."""
    return {"status": "ok", "service": "vitaloop-api"}


@router.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with critical service monitoring.
    
    Checks:
    - Supabase connectivity
    - Stripe configuration
    - Email provider configuration
    - Runtime configuration
    """
    checks = {
        "service": "vitaloop-api",
        "status": "ok",
        "services": {},
    }

    # Check Supabase
    try:
        # Try a simple query to verify Supabase is accessible
        await asyncio.wait_for(
            svc._run(
                lambda: svc._get_supabase()
                .from_("users")
                .select("count", count="exact")
                .limit(1)
                .execute()
            ),
            timeout=5.0,
        )
        checks["services"]["supabase"] = {"status": "ok"}
    except asyncio.TimeoutError:
        checks["services"]["supabase"] = {"status": "timeout", "error": "Supabase query exceeded 5s"}
        checks["status"] = "degraded"
    except Exception as e:
        checks["services"]["supabase"] = {"status": "error", "error": str(e)[:100]}
        checks["status"] = "degraded"

    # Check API Gateway configuration
    stripe_ok = bool(settings.stripe_secret_key and settings.stripe_price_id)
    checks["services"]["stripe"] = {"status": "ok" if stripe_ok else "unconfigured"}
    if not stripe_ok:
        checks["status"] = "degraded"

    # Check Email provider
    email_configured = bool(settings.resend_api_key or settings.sendgrid_api_key)
    checks["services"]["email"] = {"status": "ok" if email_configured else "unconfigured"}

    # Check Sentry
    sentry_ok = bool(settings.sentry_dsn)
    checks["services"]["sentry"] = {"status": "ok" if sentry_ok else "unconfigured"}

    # Overall status logic
    if checks["status"] == "ok":
        # All checks passed
        checks["ok"] = True
    else:
        # Degraded but still functional
        checks["ok"] = True

    return checks
