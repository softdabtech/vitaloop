"""
Structured logging middleware for FastAPI.

Logs all HTTP requests/responses with:
- Request method, path, query params
- Response status code and latency
- Error details (if any)
- User ID (if authenticated)
"""

import time
import logging
from typing import Callable
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.datastructures import MutableHeaders

logger = logging.getLogger("vitaloop.http")


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs HTTP requests with structured fields."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Start timer
        start_time = time.perf_counter()

        # Extract relevant request info
        method = request.method
        path = request.url.path
        query_string = request.url.query
        
        # Try to extract user ID from JWT token (if present)
        user_id = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            # Extract user from JWT claims if available (processed by auth middleware)
            user_id = request.state.user_id if hasattr(request.state, "user_id") else None

        # Log incoming request
        logger.info(
            f"{method} {path} started",
            extra={
                "http.method": method,
                "http.path": path,
                "http.query": query_string or None,
                "user_id": user_id,
                "event": "http.request.start",
            },
        )

        # Call the endpoint
        try:
            response: Response = await call_next(request)
        except Exception as exc:
            # Log the exception
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"{method} {path} failed with exception",
                extra={
                    "http.method": method,
                    "http.path": path,
                    "http.status_code": 500,
                    "http.response_time_ms": elapsed_ms,
                    "user_id": user_id,
                    "error": str(exc)[:200],
                    "event": "http.request.error",
                },
                exc_info=True,
            )
            raise

        # Calculate latency
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # Log response
        log_level = (
            logging.WARNING
            if response.status_code >= 400
            else logging.INFO
        )
        
        logger.log(
            log_level,
            f"{method} {path} completed with {response.status_code}",
            extra={
                "http.method": method,
                "http.path": path,
                "http.status_code": response.status_code,
                "http.response_time_ms": round(elapsed_ms, 2),
                "user_id": user_id,
                "event": "http.request.complete",
            },
        )

        # Add timing header for debugging
        response.headers["X-Response-Time-Ms"] = str(round(elapsed_ms, 2))

        return response
