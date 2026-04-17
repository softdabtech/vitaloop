"""
JWT dependency: validates Supabase-issued Bearer tokens.
Uses Supabase JWKS to validate ES256 tokens by kid.
Usage:  current_user: dict = Depends(get_current_user)
Returns the JWT payload (includes 'sub' = user UUID).
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import logging
from jwt import PyJWKClient

from app.config import settings
from app.services import supabase_service as svc

_bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger("auth.jwt")
logger.setLevel(logging.INFO)

def _build_jwks_url() -> str:
    base = (settings.supabase_url or "").rstrip("/")
    if not base:
        raise RuntimeError("SUPABASE_URL is not configured; cannot build JWKS URL")
    return f"{base}/auth/v1/.well-known/jwks.json"

# Cache JWKS for 5 minutes; auto-refreshes on expiry so key rotations are
# picked up without a restart (PyJWT default is no TTL → keys cached forever).
jwks_client = PyJWKClient(_build_jwks_url(), cache_keys=True, lifespan=300)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError as exc:
        logger.error("jwt_validation failed exception=%s", repr(exc))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_same_user(user_id: str, current_user: dict) -> None:
    """Raise 403 if the authenticated user doesn't match the requested user_id."""
    if current_user.get("sub") != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


async def require_active_subscription(current_user: dict = Depends(get_current_user)) -> dict:
    """Require active paid subscription for end-user premium routes."""
    user_id = current_user.get("sub")
    jwt_role = str(current_user.get("global_role") or current_user.get("role") or "").lower()

    account = await svc.get_user_account(user_id)
    global_role = str(account.get("global_role") or jwt_role or "end_user").lower()
    sub_status = str(account.get("sub_status") or "").lower()

    # Non-end-user roles (ops/admin/practitioner) bypass B2C subscription gating.
    if global_role != "end_user":
        return current_user

    if sub_status == "active":
        return current_user

    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={"detail": "Active subscription required", "code": "SUBSCRIPTION_REQUIRED"},
    )


async def require_freemium_analyze(current_user: dict = Depends(get_current_user)) -> dict:
    """Allow free users up to `settings.freemium_upload_limit` lab analyses.

    Premium users and non-end-user roles (admin/ops/practitioner) bypass this gate.
    Free users who have reached the limit receive 402 with code UPLOAD_LIMIT_REACHED.
    """
    user_id = current_user.get("sub")
    jwt_role = str(current_user.get("global_role") or current_user.get("role") or "").lower()

    account = await svc.get_user_account(user_id)
    global_role = str(account.get("global_role") or jwt_role or "end_user").lower()
    sub_status = str(account.get("sub_status") or "").lower()

    # Non-end-users and active subscribers pass through unconditionally.
    if global_role != "end_user" or sub_status == "active":
        return current_user

    upload_count = await svc.get_user_upload_count(user_id)
    limit = settings.freemium_upload_limit

    if upload_count >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "detail": f"Free plan allows {limit} lab upload(s). Upgrade to analyze more.",
                "code": "UPLOAD_LIMIT_REACHED",
                "upload_count": upload_count,
                "upload_limit": limit,
            },
        )

    return current_user
