"""Request context middleware for correlation identifiers."""

from __future__ import annotations

from typing import Callable
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


REQUEST_ID_HEADER = "X-Request-ID"
MAX_REQUEST_ID_LENGTH = 128


def _safe_request_id(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return str(uuid4())
    if len(value) > MAX_REQUEST_ID_LENGTH:
        value = value[:MAX_REQUEST_ID_LENGTH]
    return value


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Adds request_id to request state and response headers."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = _safe_request_id(request.headers.get(REQUEST_ID_HEADER))
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
