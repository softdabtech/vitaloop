"""Security middleware: baseline headers + lightweight in-process rate limiting.

This is intentionally simple and dependency-free for immediate hardening.
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response


@dataclass(frozen=True)
class RateLimitRule:
    prefix: str
    max_requests: int
    window_seconds: int


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds baseline API security headers to every response."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Cache-Control"] = "no-store"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class PathRateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window path-based limiter keyed by client IP + path prefix.

    Note: in-memory limiter is per-process. For horizontal scaling use Redis.
    """

    def __init__(self, app, *, rules: list[RateLimitRule]):
        super().__init__(app)
        self._rules = [r for r in rules if r.max_requests > 0 and r.window_seconds > 0]
        self._buckets: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if request.method == "OPTIONS":
            return await call_next(request)

        matched = next((rule for rule in self._rules if path.startswith(rule.prefix)), None)
        if matched is None:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = (matched.prefix, client_ip)
        now = time.monotonic()
        cutoff = now - matched.window_seconds

        async with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= matched.max_requests:
                retry_after = max(1, int(bucket[0] + matched.window_seconds - now)) if bucket else matched.window_seconds
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded", "code": "RATE_LIMITED"},
                    headers={"Retry-After": str(retry_after)},
                )
            bucket.append(now)

        return await call_next(request)
