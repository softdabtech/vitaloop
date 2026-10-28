"""Middleware for brute force protection on authentication endpoints."""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging

from app.services.brute_force_protection import (
    is_account_locked,
    get_lockout_time_remaining,
)

_logger = logging.getLogger(__name__)

# Endpoints that should be protected (require email parameter)
PROTECTED_ENDPOINTS = {
    "/auth/login",
    "/auth/sign-up",
    "/auth/signup",
    "/auth/register",
}


class BruteForceProtectionMiddleware(BaseHTTPMiddleware):
    """Middleware to protect authentication endpoints from brute force attacks."""

    async def dispatch(self, request: Request, call_next):
        # Only protect certain endpoints
        if request.url.path not in PROTECTED_ENDPOINTS:
            return await call_next(request)

        # Only protect POST requests (login/signup attempts)
        if request.method != "POST":
            return await call_next(request)

        # Try to extract email from request body
        try:
            body = await request.body()
            if not body:
                return await call_next(request)

            # Parse JSON
            import json
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                return await call_next(request)

            email = data.get("email") or data.get("email_address") or ""
            email = str(email).lower().strip()

            if not email:
                return await call_next(request)

            # Check if account is locked
            if await is_account_locked(email):
                remaining_seconds = await get_lockout_time_remaining(email)
                _logger.warning(
                    f"brute_force_lockout email={email} "
                    f"remaining_seconds={remaining_seconds}"
                )
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": (
                            f"Too many login attempts. "
                            f"Please try again in {remaining_seconds} seconds."
                        ),
                        "retry_after": remaining_seconds,
                        "error_code": "ACCOUNT_LOCKED",
                    },
                )

            # Get client IP address
            client_ip = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent", "")

            # Store it in request state for use in endpoint
            request.state.email = email
            request.state.ip_address = client_ip
            request.state.user_agent = user_agent

            # Call the actual endpoint
            response = await call_next(request)

            # After endpoint response, we don't know if login was successful
            # This must be handled in the endpoint itself by calling:
            # await record_login_attempt(email, success=True/False, ...)

            return response

        except Exception as e:
            _logger.error(f"brute_force_middleware_error: {str(e)}")
            # Don't block the request on middleware error
            return await call_next(request)
