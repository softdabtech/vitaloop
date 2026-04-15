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

_bearer = HTTPBearer(auto_error=False)


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

    # Attempt 1: Try ES256 with ECDSA public key (new Supabase format)
    if settings.supabase_jwt_public_key_jwk:
        try:
            public_key = jwt.algorithms.ECAlgorithm.from_jwk(settings.supabase_jwt_public_key_jwk)
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                audience="authenticated",
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        except jwt.PyJWTError:
            # ES256 validation failed, try HS256 next
            pass

    # Attempt 2: Try HS256 with symmetric secret (legacy format or Supabase HS256 tokens)
    if settings.supabase_jwt_secret:
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        except jwt.PyJWTError as e:
            # Both ES256 and HS256 failed
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # No valid JWT configuration available
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT configuration missing")


def require_same_user(user_id: str, current_user: dict) -> None:
    """Raise 403 if the authenticated user doesn't match the requested user_id."""
    if current_user.get("sub") != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
