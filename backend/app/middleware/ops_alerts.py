from __future__ import annotations

import asyncio
import logging
import time
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.services.ops_alerts import send_ops_alert

logger = logging.getLogger("vitaloop.ops_monitoring")


CRITICAL_PREFIXES = (
    "/auth",
    "/analyze",
    "/protocol",
    "/profile",
    "/dashboard",
    "/progress",
    "/timeline",
    "/insights",
    "/checkins",
    "/admin",
    "/crm",
    "/assignments",
    "/health/ready",
    "/health/knowledge",
    "/ops/llm",
)


def _is_critical_path(path: str) -> bool:
    return any(path == prefix or path.startswith(f"{prefix}/") for prefix in CRITICAL_PREFIXES)


def _alert_code(method: str, path: str, status_code: int) -> str:
    normalized = path.strip("/").replace("/", ".") or "root"
    return f"HTTP_{status_code}_{method.upper()}_{normalized}"[:120]


def _schedule_alert(*, code: str, title: str, severity: str, details: dict) -> None:
    try:
        asyncio.create_task(
            send_ops_alert(
                code=code,
                title=title,
                severity=severity,
                source="backend.http",
                details=details,
            )
        )
    except RuntimeError:
        logger.warning("ops_alert_schedule_failed code=%s", code, exc_info=True)


class OpsAlertMiddleware(BaseHTTPMiddleware):
    """Send rate-limited ops emails for critical backend failures."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.perf_counter()
        method = request.method
        path = request.url.path
        request_id = getattr(request.state, "request_id", None)

        try:
            response: Response = await call_next(request)
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            code = _alert_code(method, path, 500)
            logger.error(
                "ops_route_exception code=%s method=%s path=%s request_id=%s error=%s",
                code,
                method,
                path,
                request_id,
                exc,
                exc_info=True,
                extra={"event": "ops.route.exception"},
            )
            _schedule_alert(
                code=code,
                title=f"{method} {path} raised an exception",
                severity="critical",
                details={
                    "method": method,
                    "path": path,
                    "query": request.url.query or None,
                    "request_id": request_id,
                    "client_host": request.client.host if request.client else None,
                    "elapsed_ms": elapsed_ms,
                    "error": str(exc)[:500],
                },
            )
            raise

        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
        if response.status_code >= 500 or (response.status_code >= 400 and _is_critical_path(path)):
            severity = "critical" if response.status_code >= 500 else "warning"
            code = _alert_code(method, path, response.status_code)
            logger.warning(
                "ops_route_error code=%s method=%s path=%s status=%s request_id=%s elapsed_ms=%s",
                code,
                method,
                path,
                response.status_code,
                request_id,
                elapsed_ms,
                extra={"event": "ops.route.error"},
            )
            if response.status_code >= 500:
                _schedule_alert(
                    code=code,
                    title=f"{method} {path} returned {response.status_code}",
                    severity=severity,
                    details={
                        "method": method,
                        "path": path,
                        "query": request.url.query or None,
                        "status_code": response.status_code,
                        "request_id": request_id,
                        "client_host": request.client.host if request.client else None,
                        "elapsed_ms": elapsed_ms,
                    },
                )

        return response
