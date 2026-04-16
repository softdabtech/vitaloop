"""Security middleware: baseline headers + lightweight in-process rate limiting.

This is intentionally simple and dependency-free for immediate hardening.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Callable, Optional, Protocol

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

logger = logging.getLogger("vitaloop.security")


@dataclass(frozen=True)
class RateLimitRule:
    prefix: str
    max_requests: int
    window_seconds: int


@dataclass(frozen=True)
class RateLimitDecision:
    limited: bool
    retry_after: int = 0


class RateLimiterBackend(Protocol):
    async def check(self, *, rule_prefix: str, client_key: str, max_requests: int, window_seconds: int) -> RateLimitDecision:
        ...


class InMemoryRateLimiterBackend:
    """Per-process rate limiter backend."""

    def __init__(self):
        self._buckets: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, *, rule_prefix: str, client_key: str, max_requests: int, window_seconds: int) -> RateLimitDecision:
        key = (rule_prefix, client_key)
        now = time.monotonic()
        cutoff = now - float(window_seconds)

        async with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= max_requests:
                retry_after = max(1, int(bucket[0] + window_seconds - now)) if bucket else window_seconds
                return RateLimitDecision(limited=True, retry_after=retry_after)

            bucket.append(now)
            return RateLimitDecision(limited=False)


class RedisRateLimiterBackend:
    """Redis-backed fixed-window limiter backend.

    Fail-open behavior: if Redis errors occur, requests are allowed and a warning is logged.
    """

    def __init__(self, *, redis_url: str, key_prefix: str = "rl"):
        self._redis_url = (redis_url or "").strip()
        self._key_prefix = (key_prefix or "rl").strip() or "rl"
        self._client = None

    async def _client_or_none(self):
        if not self._redis_url:
            return None
        if self._client is not None:
            return self._client
        try:
            import redis.asyncio as redis

            self._client = redis.from_url(self._redis_url, decode_responses=True)
            return self._client
        except Exception as ex:
            logger.warning("rate_limit_redis_init_failed error=%s", ex)
            return None

    async def check(self, *, rule_prefix: str, client_key: str, max_requests: int, window_seconds: int) -> RateLimitDecision:
        client = await self._client_or_none()
        if client is None:
            return RateLimitDecision(limited=False)

        now = int(time.time())
        window = max(1, int(window_seconds))
        window_start = now - (now % window)
        redis_key = f"{self._key_prefix}:{rule_prefix}:{client_key}:{window_start}"

        try:
            count = await client.incr(redis_key)
            if count == 1:
                await client.expire(redis_key, window)

            if count > max_requests:
                ttl = await client.ttl(redis_key)
                return RateLimitDecision(limited=True, retry_after=max(1, int(ttl) if ttl and ttl > 0 else window))

            return RateLimitDecision(limited=False)
        except Exception as ex:
            logger.warning("rate_limit_redis_check_failed key=%s error=%s", redis_key, ex)
            return RateLimitDecision(limited=False)


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

    def __init__(
        self,
        app,
        *,
        rules: list[RateLimitRule],
        backend: Optional[RateLimiterBackend] = None,
        trust_forwarded_for: bool = False,
        forwarded_for_header: str = "x-forwarded-for",
    ):
        super().__init__(app)
        self._rules = [r for r in rules if r.max_requests > 0 and r.window_seconds > 0]
        self._backend = backend or InMemoryRateLimiterBackend()
        self._trust_forwarded_for = trust_forwarded_for
        self._forwarded_for_header = (forwarded_for_header or "x-forwarded-for").strip().lower()

    def _resolve_client_ip(self, request: Request) -> str:
        if self._trust_forwarded_for:
            raw = request.headers.get(self._forwarded_for_header)
            if raw:
                first = raw.split(",", 1)[0].strip()
                if first:
                    return first
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if request.method == "OPTIONS":
            return await call_next(request)

        matched = next((rule for rule in self._rules if path.startswith(rule.prefix)), None)
        if matched is None:
            return await call_next(request)

        client_ip = self._resolve_client_ip(request)
        try:
            decision = await self._backend.check(
                rule_prefix=matched.prefix,
                client_key=client_ip,
                max_requests=matched.max_requests,
                window_seconds=matched.window_seconds,
            )
        except Exception as ex:
            logger.warning("rate_limit_backend_failed_open prefix=%s ip=%s error=%s", matched.prefix, client_ip, ex)
            decision = RateLimitDecision(limited=False)

        if decision.limited:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded", "code": "RATE_LIMITED"},
                headers={"Retry-After": str(max(1, int(decision.retry_after or matched.window_seconds)))},
            )

        return await call_next(request)
