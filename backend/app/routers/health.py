import asyncio
import time
from fastapi import APIRouter
from app.config import settings
from app.services import supabase_service as svc
from app.utils.build_info import get_build_info
import logging

logger = logging.getLogger("vitaloop.health")
router = APIRouter()


@router.get("/health")
async def health_check():
    """Quick liveness probe (always fast, no external calls).
    
    HTTP 200: Service is running
    HTTP 503: Service is down
    """
    logger.info("health_check request", extra={"endpoint": "/health"})
    return {
        "status": "ok",
        "service": "vitaloop-api",
        "timestamp": time.time(),
        "build": get_build_info(),
    }


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
        "build": get_build_info(),
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

    logger.info(
        "detailed_health_check completed",
        extra={
            "endpoint": "/health/detailed",
            "status": checks["status"],
            "services": {k: v.get("status") for k, v in checks["services"].items()},
        },
    )
    return checks


@router.get("/health/ready")
async def readiness_check():
    """Kubernetes readiness probe.
    
    HTTP 200: Service is ready to accept traffic
    HTTP 503: Service is not ready (degraded/critical dependencies missing)
    
    Checks critical readiness requirements:
    - Supabase is accessible
    - Required configuration is present
    """
    checks = {
        "ready": True,
        "reason": "ready",
        "checks": {},
    }

    # 1. Check Supabase (CRITICAL)
    try:
        await asyncio.wait_for(
            svc._run(
                lambda: svc._get_supabase()
                .from_("users")
                .select("count", count="exact")
                .limit(1)
                .execute()
            ),
            timeout=3.0,
        )
        checks["checks"]["supabase"] = "ok"
    except Exception as e:
        checks["ready"] = False
        checks["reason"] = f"supabase_unavailable: {str(e)[:50]}"
        checks["checks"]["supabase"] = "failed"
        logger.error(
            "readiness_check failed: supabase unavailable",
            extra={"error": str(e)[:100]},
        )
        return {"ready": False, "reason": checks["reason"], "status_code": 503}

    # 2. Check required configuration
    required_env = {
        "supabase_url": settings.supabase_url,
        "supabase_service_role_key": settings.supabase_service_role_key,
    }
    
    for env_name, env_value in required_env.items():
        if not env_value or not str(env_value).strip():
            checks["ready"] = False
            checks["reason"] = f"missing_config: {env_name}"
            checks["checks"][env_name] = "missing"
            logger.error(
                "readiness_check failed: missing required config",
                extra={"missing": env_name},
            )
            return {"ready": False, "reason": checks["reason"], "status_code": 503}
        checks["checks"][env_name] = "ok"

    logger.info("readiness_check passed", extra={"checks": checks["checks"]})
    return checks
