"""
JWT dependency: validates Supabase-issued Bearer tokens.
Supports both ES256 (new Supabase ECDSA keys) and HS256 (legacy).
Usage:  current_user: dict = Depends(get_current_user)
Returns the JWT payload (includes 'sub' = user UUID).
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import json
import logging
import traceback

from app.config import settings

_bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger("auth.jwt")


def _last_trace_line(exc: Exception) -> str:
    tb = traceback.extract_tb(exc.__traceback__)
    if not tb:
        return "unknown"
    last = tb[-1]
    return f"{last.filename}:{last.lineno}"


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """
    Validates JWT token using both ES256 and HS256 algorithms.
    Tries ES256 first (Supabase ECDSA public key), then falls back to HS256 (symmetric secret).
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = credentials.credentials

    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception as exc:
        logger.error(
            "jwt_validation header_decode_failed exception=%s location=%s",
            repr(exc),
            _last_trace_line(exc),
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        unverified_payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_aud": False, "verify_exp": False},
            algorithms=["HS256", "ES256", "RS256"],
        )
    except Exception as exc:
        logger.error(
            "jwt_validation payload_decode_failed alg=%s kid=%s exception=%s location=%s",
            unverified_header.get("alg"),
            unverified_header.get("kid"),
            repr(exc),
            _last_trace_line(exc),
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    token_alg = unverified_header.get("alg")
    token_kid = unverified_header.get("kid")
    token_iss = unverified_payload.get("iss")
    token_aud = unverified_payload.get("aud")
    token_sub = unverified_payload.get("sub")

    configured_jwk_kid = None
    kid_match = None
    if settings.supabase_jwt_public_key_jwk:
        try:
            configured_jwk = json.loads(settings.supabase_jwt_public_key_jwk)
            configured_jwk_kid = configured_jwk.get("kid")
            kid_match = (configured_jwk_kid == token_kid)
        except Exception as exc:
            logger.error(
                "jwt_validation configured_jwk_parse_failed exception=%s location=%s",
                repr(exc),
                _last_trace_line(exc),
            )

    logger.info(
        "jwt_validation token_meta alg=%s kid=%s iss=%s aud=%s sub=%s configured_jwk_kid=%s kid_match=%s",
        token_alg,
        token_kid,
        token_iss,
        token_aud,
        token_sub,
        configured_jwk_kid,
        kid_match,
    )

    # Attempt 1: Try ES256 with ECDSA public key (new Supabase format)
    if settings.supabase_jwt_public_key_jwk:
        logger.info("jwt_validation branch=ES256")
        try:
            public_key = jwt.algorithms.ECAlgorithm.from_jwk(settings.supabase_jwt_public_key_jwk)
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                audience="authenticated",
            )
            logger.info("jwt_validation branch=ES256 result=success")
            return payload
        except jwt.ExpiredSignatureError as exc:
            logger.error(
                "jwt_validation branch=ES256 result=expired exception=%s location=%s",
                repr(exc),
                _last_trace_line(exc),
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        except jwt.PyJWTError as exc:
            logger.error(
                "jwt_validation branch=ES256 result=failed exception=%s location=%s",
                repr(exc),
                _last_trace_line(exc),
            )
            # ES256 validation failed, try HS256 next
            pass
    else:
        logger.info("jwt_validation branch=ES256 skipped=no_public_jwk")

    # Attempt 2: Try HS256 with symmetric secret (legacy format or Supabase HS256 tokens)
    if settings.supabase_jwt_secret:
        logger.info("jwt_validation branch=HS256")
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            logger.info("jwt_validation branch=HS256 result=success")
            return payload
        except jwt.ExpiredSignatureError as exc:
            logger.error(
                "jwt_validation branch=HS256 result=expired exception=%s location=%s",
                repr(exc),
                _last_trace_line(exc),
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        except jwt.PyJWTError as e:
            # Both ES256 and HS256 failed
            logger.error(
                "jwt_validation branch=HS256 result=failed exception=%s location=%s",
                repr(e),
                _last_trace_line(e),
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    else:
        logger.info("jwt_validation branch=HS256 skipped=no_secret")

    # No valid JWT configuration available
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT configuration missing")


def require_same_user(user_id: str, current_user: dict) -> None:
    """Raise 403 if the authenticated user doesn't match the requested user_id."""
    if current_user.get("sub") != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
