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

_bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger("auth.jwt")
logger.setLevel(logging.INFO)
JWKS_URL = "https://bfjxkzydonhwmafnyktt.supabase.co/auth/v1/.well-known/jwks.json"
jwks_client = PyJWKClient(JWKS_URL)


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
