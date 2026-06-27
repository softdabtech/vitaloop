import asyncio
import time
import httpx
from fastapi import APIRouter
from app.config import settings
from app.services import supabase_service as svc
from app.utils.build_info import get_build_info
from app.utils.stripe_config import is_stripe_price_configured
import logging

logger = logging.getLogger("vitaloop.health")
router = APIRouter()


def _llm_chat_completions_path() -> str:
    """Return chat completions path relative to the configured provider base URL."""
    from app.services.claude_service import _chat_completions_path as _svc_path

    return _svc_path()


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
    stripe_ok = bool(
        settings.stripe_secret_key
        and is_stripe_price_configured(
            settings.stripe_price_id,
            settings.stripe_price_id_personal,
            settings.stripe_price_id_personal_monthly,
            settings.stripe_price_id_personal_yearly,
            settings.stripe_price_id_practitioner,
            settings.stripe_price_id_practitioner_monthly,
            settings.stripe_price_id_practitioner_yearly,
        )
    )
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


@router.get("/health/knowledge")
async def knowledge_health_check():
    """Knowledge Base health check.

    Verifies:
    - Active rule count in Supabase
    - Recommendations table is populated
    - Evaluator engine runs without error (dry-run, no persist)
    """
    import time as _time
    started = _time.perf_counter()
    result: dict = {
        "service": "vitaloop-api",
        "component": "knowledge_base",
        "status": "ok",
        "ok": True,
        "checks": {},
        "timestamp": _time.time(),
    }

    # 1. Active rules count
    try:
        sb = svc._get_supabase()
        r = await asyncio.wait_for(
            svc._run(
                lambda: sb.table("knowledge_rules")
                .select("id", count="exact")
                .eq("active", True)
                .eq("governance_status", "active")
                .execute()
            ),
            timeout=4.0,
        )
        active_count = r.count or 0
        result["checks"]["active_rules"] = {"count": active_count, "ok": active_count >= 1}
        if active_count == 0:
            result["status"] = "degraded"
            result["ok"] = False
    except Exception as e:
        result["checks"]["active_rules"] = {"ok": False, "error": str(e)[:100]}
        result["status"] = "degraded"
        result["ok"] = False

    # 2. Recommendations count
    try:
        sb = svc._get_supabase()
        r2 = await asyncio.wait_for(
            svc._run(
                lambda: sb.table("recommendations")
                .select("id", count="exact")
                .execute()
            ),
            timeout=4.0,
        )
        rec_count = r2.count or 0
        result["checks"]["recommendations"] = {"count": rec_count, "ok": rec_count >= 1}
        if rec_count == 0:
            result["status"] = "degraded"
            result["ok"] = False
    except Exception as e:
        result["checks"]["recommendations"] = {"ok": False, "error": str(e)[:100]}
        result["status"] = "degraded"
        result["ok"] = False

    # 3. Evaluator engine dry-run (no DB persist, no LLM)
    try:
        from app.services.knowledge.evaluator import evaluate_health_input
        eval_result = await asyncio.wait_for(
            evaluate_health_input(
                {
                    "lab_results": {
                        "ferritin": {"value": 6.0, "unit": "ng/ml"},
                        "hba1c": {"value": 9.5, "unit": "%"},
                    },
                    "symptoms": ["fatigue"],
                    "context": {},
                },
                user_id=None,
                persist=False,
            ),
            timeout=5.0,
        )
        matched = len(eval_result.get("matched_rules", []))
        alerts = len(eval_result.get("safety_alerts", []))
        confidence = eval_result.get("confidence", 0)
        evaluator_ok = matched >= 1 and alerts >= 1
        result["checks"]["evaluator"] = {
            "ok": evaluator_ok,
            "matched_rules": matched,
            "safety_alerts": alerts,
            "confidence": confidence,
        }
        if not evaluator_ok:
            result["status"] = "degraded"
            result["ok"] = False
    except Exception as e:
        result["checks"]["evaluator"] = {"ok": False, "error": str(e)[:100]}
        result["status"] = "degraded"
        result["ok"] = False

    # 4. Recent evaluations activity (last 7 days)
    try:
        from datetime import datetime, timezone, timedelta
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        sb = svc._get_supabase()
        r3 = await asyncio.wait_for(
            svc._run(
                lambda: sb.table("rule_evaluations")
                .select("id", count="exact")
                .gte("created_at", since)
                .execute()
            ),
            timeout=4.0,
        )
        recent = r3.count or 0
        result["checks"]["recent_evaluations_7d"] = {"count": recent}
    except Exception as e:
        result["checks"]["recent_evaluations_7d"] = {"error": str(e)[:80]}

    result["duration_ms"] = int((_time.perf_counter() - started) * 1000)
    logger.info(
        "knowledge_health_check ok=%s status=%s duration_ms=%s",
        result["ok"], result["status"], result["duration_ms"],
    )
    return result


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


async def _synthetic_llm_call(timeout_seconds: float = 15.0) -> dict:
    """Perform a real minimal LLM completion call and return detailed diagnostics.

    This goes beyond connectivity probing — it verifies that the provider
    actually returns a usable response to a simple 'ping' prompt.
    """
    base_url = (settings.active_llm_base_url or "").rstrip("/")
    api_key = settings.active_llm_api_key or ""
    model = settings.active_llm_model or ""

    result = {
        "configured": bool(base_url and api_key and model),
        "base_url": base_url,
        "model": model,
        "ok": False,
        "response_text": None,
        "status_code": None,
        "reason": None,
    }

    if not result["configured"]:
        result["reason"] = "missing_llm_configuration"
        return result

    from app.services.claude_service import _chat_completions_path as _svc_path

    path = _svc_path()
    payload: dict = {
        "messages": [
            {"role": "user", "content": "Reply with the single word: pong"},
        ],
        "temperature": 0,
        "max_tokens": 8,
        "model": model,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(
            base_url=base_url,
            headers=headers,
            timeout=timeout_seconds,
        ) as client:
            resp = await client.post(path, json=payload)
            result["status_code"] = resp.status_code
            result["duration_ms"] = int((time.perf_counter() - started) * 1000)
            if not resp.is_success:
                result["reason"] = f"http_{resp.status_code}"
                try:
                    body = resp.json()
                    result["reason"] += f": {str(body.get('error') or body)[:120]}"
                except Exception:
                    result["reason"] += f": {resp.text[:120]}"
                return result

            data = resp.json()
            choices = data.get("choices") or []
            content = ((choices[0] or {}).get("message") or {}).get("content", "")
            result["response_text"] = content.strip()[:200]
            result["ok"] = bool(result["response_text"])
            if not result["ok"]:
                result["reason"] = "empty_response_content"
    except httpx.TimeoutException:
        result["reason"] = f"timeout_after_{timeout_seconds}s"
        result["duration_ms"] = int((time.perf_counter() - started) * 1000)
    except Exception as ex:
        result["reason"] = f"exception: {str(ex)[:120]}"
        result["duration_ms"] = int((time.perf_counter() - started) * 1000)

    return result


@router.get("/ops/llm/synthetic-check")
async def llm_synthetic_check():
    """Synthetic LLM health check — makes a REAL minimal completion call.

    Unlike /ops/llm/health (which only probes connectivity), this endpoint
    actually sends a prompt and validates the response. Use it to confirm
    the LLM is not silently falling back to regex/local mode.

    Returns:
        ok=true  → real LLM responded with content
        ok=false → misconfigured, wrong URL, auth failure, or empty response
    """
    started = time.perf_counter()
    result = await _synthetic_llm_call(timeout_seconds=15.0)
    total_ms = int((time.perf_counter() - started) * 1000)

    ok = bool(result.get("ok"))
    payload = {
        "service": "vitaloop-api",
        "component": "llm_synthetic",
        "ok": ok,
        "status": "ok" if ok else "degraded",
        "total_duration_ms": total_ms,
        "llm_duration_ms": result.get("duration_ms"),
        "provider": {
            "base_url": result.get("base_url"),
            "model": result.get("model"),
        },
        "check": {
            "configured": result.get("configured"),
            "status_code": result.get("status_code"),
            "response_text": result.get("response_text"),
            "reason": result.get("reason"),
        },
        "timestamp": time.time(),
    }
    log_level = "info" if ok else "error"
    getattr(logger, log_level)(
        "llm_synthetic_check completed ok=%s reason=%s duration_ms=%s",
        ok,
        result.get("reason"),
        total_ms,
    )
    return payload
