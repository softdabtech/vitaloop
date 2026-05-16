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

# Lazy singleton — built on first auth request so unit tests that never
# call get_current_user can import this module without SUPABASE_URL set.
_jwks_client: PyJWKClient | None = None

def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(_build_jwks_url(), cache_keys=True, lifespan=300)
    return _jwks_client


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = credentials.credentials
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
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


async def require_active_subscription(current_user: dict = Depends(get_current_user)) -> None:
    """Require active paid subscription for end-user premium routes."""
    user_id = current_user.get("sub")
    jwt_role = str(current_user.get("global_role") or current_user.get("role") or "").lower()

    account = await svc.get_user_account(user_id)
    active_sub = await svc.get_user_active_subscription(user_id)
    global_role = str(account.get("global_role") or jwt_role or "end_user").lower()
    sub_status = str(account.get("sub_status") or "").lower()
    account_plan = str(account.get("plan_tier") or "").strip().lower()
    sub_table_status = str((active_sub or {}).get("status") or "free").lower()
    sub_table_plan = str((active_sub or {}).get("plan_name") or "").strip().lower()

    paid_from_sub_table = bool(
        active_sub
        and sub_table_status == "active"
        and sub_table_plan
        and sub_table_plan != "free"
        and not active_sub.get("cancel_at_period_end", False)
    )
    paid_from_account = bool(
        not active_sub
        and sub_status == "active"
        and account_plan
        and account_plan != "free"
    )
    is_paid = paid_from_sub_table or paid_from_account

    # Non-end-user roles (ops/admin/practitioner) bypass B2C subscription gating.
    if global_role != "end_user" or is_paid:
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"detail": "Active subscription required", "code": "SUBSCRIPTION_REQUIRED"},
        )


async def require_freemium_analyze(current_user: dict = Depends(get_current_user)) -> None:
    """Allow free users up to 1 biomarker analysis (PDF upload OR manual entry).

    Premium users and non-end-user roles (admin/ops/practitioner) bypass this gate.
    Free users who have reached the limit receive 402 with code BIOMARKER_QUOTA_EXCEEDED.
    """
    user_id = current_user.get("sub")
    jwt_role = str(current_user.get("global_role") or current_user.get("role") or "").lower()

    account = await svc.get_user_account(user_id)
    active_sub = await svc.get_user_active_subscription(user_id)
    global_role = str(account.get("global_role") or jwt_role or "end_user").lower()
    sub_status = str(account.get("sub_status") or "").lower()
    account_plan = str(account.get("plan_tier") or "").strip().lower()
    sub_table_status = str((active_sub or {}).get("status") or "free").lower()
    sub_table_plan = str((active_sub or {}).get("plan_name") or "").strip().lower()

    paid_from_sub_table = bool(
        active_sub
        and sub_table_status == "active"
        and sub_table_plan
        and sub_table_plan != "free"
        and not active_sub.get("cancel_at_period_end", False)
    )
    paid_from_account = bool(
        not active_sub
        and sub_status == "active"
        and account_plan
        and account_plan != "free"
    )
    is_paid = paid_from_sub_table or paid_from_account

    # Non-end-users and active subscribers pass through unconditionally.
    if global_role != "end_user" or is_paid:
        pass
    else:
        # For free users, check the unified biomarker quota
        from app.services.biomarker_service import BiomarkerService
        biomarker_service = BiomarkerService()
        quota_ok, quota_msg, used_by = await biomarker_service.check_freemium_biomarker_quota(user_id, "pdf")

        if not quota_ok:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "detail": quota_msg,
                    "code": "BIOMARKER_QUOTA_EXCEEDED",
                    "used_by": used_by,
                },
            )
