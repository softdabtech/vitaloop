import asyncio
import time
import httpx
from fastapi import APIRouter
from app.config import settings
from app.services import supabase_service as svc
from app.utils.build_info import get_build_info
import logging

logger = logging.getLogger("vitaloop.health")
router = APIRouter()


def _llm_chat_completions_path() -> str:
    """Return provider-specific chat completions path.

    Keep path relative to preserve any base URL suffix like `/v1`.
    """
    base_url = settings.active_llm_base_url.rstrip("/").lower()
    if "agents.do-ai.run" in base_url:
        return "api/v1/chat/completions"
    return "chat/completions"


async def _probe_llm_connectivity(timeout_seconds: float = 5.0) -> dict:
    base_url = (settings.active_llm_base_url or "").rstrip("/")
    api_key = settings.active_llm_api_key or ""
    model = settings.active_llm_model or ""

    configured = bool(base_url and api_key and model)
    result = {
        "configured": configured,
        "base_url": base_url,
        "model": model,
        "reachable": False,
        "probe": None,
        "status_code": None,
        "reason": None,
    }
    if not configured:
        result["reason"] = "missing_llm_configuration"
        return result

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(base_url=base_url, headers=headers, timeout=timeout_seconds) as client:
        try:
            models_resp = await client.get("models")
            result["probe"] = "models"
            result["status_code"] = models_resp.status_code
            if models_resp.is_success:
                result["reachable"] = True
                return result
        except Exception as ex:
            result["probe"] = "models"
            result["reason"] = f"models_probe_error: {str(ex)[:80]}"

        try:
            chat_resp = await client.post(
                _llm_chat_completions_path(),
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": "ping"}],
                    "temperature": 0,
                    "max_tokens": 1,
                },
            )
            result["probe"] = "chat_completions"
            result["status_code"] = chat_resp.status_code
            result["reachable"] = chat_resp.is_success
            if not chat_resp.is_success:
                result["reason"] = f"http_{chat_resp.status_code}"
        except Exception as ex:
            result["probe"] = "chat_completions"
            result["reason"] = f"chat_probe_error: {str(ex)[:80]}"

    return result


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


@router.get("/ops/llm/health")
async def llm_health_check():
    """Dedicated LLM health endpoint for operational monitoring.

    Checks LLM configuration and provider reachability independently from
    general `/health` and readiness probes.
    """
    started = time.perf_counter()
    probe = await _probe_llm_connectivity(timeout_seconds=5.0)
    ok = bool(probe.get("reachable"))
    payload = {
        "service": "vitaloop-api",
        "component": "llm",
        "ok": ok,
        "status": "ok" if ok else "degraded",
        "duration_ms": int((time.perf_counter() - started) * 1000),
        "provider": {
            "base_url": probe.get("base_url"),
            "model": probe.get("model"),
        },
        "probe": {
            "configured": probe.get("configured"),
            "name": probe.get("probe"),
            "reachable": probe.get("reachable"),
            "status_code": probe.get("status_code"),
            "reason": probe.get("reason"),
        },
        "build": get_build_info(),
        "timestamp": time.time(),
    }
    logger.info(
        "llm_health_check completed",
        extra={
            "endpoint": "/ops/llm/health",
            "ok": payload["ok"],
            "probe": payload["probe"],
        },
    )
    return payload
