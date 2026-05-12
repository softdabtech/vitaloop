from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from app.errors import http_exception_handler, validation_exception_handler
from app.config import settings
from app.middleware.request_context import RequestContextMiddleware
from app.middleware.logging import StructuredLoggingMiddleware
from app.middleware.security import (
    InMemoryRateLimiterBackend,
    PathRateLimitMiddleware,
    RateLimitRule,
    RedisRateLimiterBackend,
    SecurityHeadersMiddleware,
)
from app.utils.build_info import APP_VERSION
import logging
from app.utils import checkin_reminder
from app.utils.stripe_config import is_stripe_price_configured

from app.services.claude_service import is_llm_configured

try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
except Exception:  # pragma: no cover - optional dependency in some environments
    sentry_sdk = None
    FastApiIntegration = None
    StarletteIntegration = None

logger = logging.getLogger("uvicorn.error")

if settings.sentry_dsn and sentry_sdk is not None:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=settings.sentry_traces_sample_rate,
        environment=settings.app_env,
        send_default_pii=False,
    )
elif settings.sentry_dsn and sentry_sdk is None:
    logger.warning("sentry_dsn_set_but_sdk_missing")
from app.routers import health, llm_consult
from app.routers.identity import auth, profile, onboarding, settings as settings_router
from app.routers.analysis import analyze, insights, red_flags, timeline, dashboard, uploads
from app.routers.protocol import protocol, progress, symptoms, checkins, questionnaire, assignments, compatibility
from app.routers.notifications import notifications, complaints
from app.routers.billing import stripe_router
from app.routers.crm import crm, crm_clients, crm_ops
from app.routers.admin import admin


def _check_runtime_readiness() -> None:
    stripe_price_configured = is_stripe_price_configured(
        settings.stripe_price_id,
        settings.stripe_price_id_personal,
        settings.stripe_price_id_personal_monthly,
        settings.stripe_price_id_personal_yearly,
        settings.stripe_price_id_practitioner,
        settings.stripe_price_id_practitioner_monthly,
        settings.stripe_price_id_practitioner_yearly,
    )
    checks = {
        "supabase_url": bool((settings.supabase_url or "").strip()),
        "supabase_service_role_key": bool((settings.supabase_service_role_key or "").strip()),
        "llm_provider_key": is_llm_configured(),
        "resend_api_key": bool((settings.resend_api_key or "").strip()),
        "stripe_secret_key": bool((settings.stripe_secret_key or "").strip()),
        "stripe_webhook_secret": bool((settings.stripe_webhook_secret or "").strip()),
        "stripe_price_id": stripe_price_configured,
    }
    missing = [name for name, ok in checks.items() if not ok]
    if missing:
        logger.warning("runtime_readiness_missing count=%s keys=%s", len(missing), ",".join(missing))
    else:
        logger.info("runtime_readiness_ok")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _check_runtime_readiness()
    yield


app = FastAPI(
    title="VITALOOP API",
    version=APP_VERSION,
    description="Biohacking-as-a-Service backend",
    lifespan=lifespan,
)

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

app.add_middleware(RequestContextMiddleware)

# Add structured logging middleware
app.add_middleware(StructuredLoggingMiddleware)

if settings.security_enable_headers:
    app.add_middleware(SecurityHeadersMiddleware)

rate_limit_backend_name = (settings.rate_limit_backend or "inmemory").strip().lower()
if rate_limit_backend_name == "redis":
    rate_limit_backend = RedisRateLimiterBackend(
        redis_url=settings.rate_limit_redis_url,
        key_prefix=settings.rate_limit_redis_prefix,
    )
else:
    rate_limit_backend = InMemoryRateLimiterBackend()

app.add_middleware(
    PathRateLimitMiddleware,
    rules=[
        RateLimitRule(prefix="/auth", max_requests=settings.auth_rate_limit_per_minute, window_seconds=60),
        RateLimitRule(prefix="/analyze", max_requests=settings.analyze_rate_limit_per_minute, window_seconds=60),
        RateLimitRule(prefix="/protocol", max_requests=settings.protocol_rate_limit_per_minute, window_seconds=60),
    ],
    backend=rate_limit_backend,
    trust_forwarded_for=settings.rate_limit_trust_forwarded_for,
    forwarded_for_header=settings.rate_limit_forwarded_for_header,
)

origins = settings.origins_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Idempotency-Key",
        "X-Request-ID",
        "stripe-signature",
    ],
    expose_headers=["X-Request-ID"],
)

app.include_router(health.router, tags=["health"])
app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(protocol.router, prefix="/protocol", tags=["protocol"])
app.include_router(progress.router, prefix="/progress", tags=["progress"])
app.include_router(symptoms.router, prefix="/symptoms", tags=["symptoms"])
app.include_router(stripe_router.router, prefix="/stripe", tags=["stripe"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(crm_clients.router, tags=["crm"])
app.include_router(crm_ops.router, tags=["crm"])
app.include_router(assignments.router, tags=["crm-assignments"])
app.include_router(crm.router, prefix="/admin", tags=["crm"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])
app.include_router(settings_router.router, prefix="/settings", tags=["settings"])
app.include_router(complaints.router, prefix="/complaints", tags=["complaints"])
app.include_router(checkins.router, prefix="/checkins", tags=["checkins"])
app.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
app.include_router(insights.router, prefix="/insights", tags=["insights"])
app.include_router(red_flags.router, prefix="/red-flags", tags=["red-flags"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(onboarding.router)
app.include_router(questionnaire.router, prefix="/questionnaire", tags=["questionnaire"])
# Backward-compatible aliases used by older clients/tests.
app.include_router(auth.router, prefix="/users", tags=["users"])
app.include_router(questionnaire.router, prefix="/questionnaires", tags=["questionnaire"])
app.include_router(dashboard.router)
app.include_router(compatibility.router)
app.include_router(uploads.router, tags=["uploads"])
app.include_router(llm_consult.router, prefix="/llm", tags=["llm"])
