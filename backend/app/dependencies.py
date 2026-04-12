"""
JWT dependency: validates Supabase-issued Bearer tokens.
Supports both ES256 (new Supabase ECDSA keys) and HS256 (legacy).
Usage:  current_user: dict = Depends(get_current_user)
Returns the JWT payload (includes 'sub' = user UUID).
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from app.config import settings

_bearer = HTTPBearer()


def _get_verify_key():
    """Return (key, algorithms) based on configured JWT settings."""
    if settings.supabase_jwt_public_key_jwk:
        # New Supabase format: ES256 with ECDSA public key (JWK)
        public_key = jwt.algorithms.ECAlgorithm.from_jwk(
            settings.supabase_jwt_public_key_jwk
        )
        return public_key, ["ES256"]
    # Legacy: HS256 with symmetric secret
    return settings.supabase_jwt_secret, ["HS256"]


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    token = credentials.credentials
    key, algorithms = _get_verify_key()
    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=algorithms,
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_same_user(user_id: str, current_user: dict) -> None:
    """Raise 403 if the authenticated user doesn't match the requested user_id."""
    if current_user.get("sub") != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
