from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.services.ops_alerts import send_ops_alert

logger = logging.getLogger("vitaloop.frontend_monitoring")
router = APIRouter()


class FrontendErrorEvent(BaseModel):
    type: Literal["api_error", "browser_error", "unhandled_rejection", "route_error", "smoke_error"] = "browser_error"
    severity: Literal["info", "warning", "error", "critical"] = "error"
    code: str = Field(default="FRONTEND_ERROR", max_length=120)
    message: str = Field(default="", max_length=1000)
    route: str | None = Field(default=None, max_length=500)
    endpoint: str | None = Field(default=None, max_length=500)
    method: str | None = Field(default=None, max_length=20)
    status: int | None = None
    build: str | None = Field(default=None, max_length=120)
    locale: str | None = Field(default=None, max_length=20)
    user_agent: str | None = Field(default=None, max_length=500)
    metadata: dict[str, Any] = Field(default_factory=dict)


class FrontendActivityEvent(BaseModel):
    type: Literal["route_view", "user_action", "smoke_check"] = "route_view"
    route: str = Field(default="", max_length=500)
    referrer: str | None = Field(default=None, max_length=500)
    build: str | None = Field(default=None, max_length=120)
    locale: str | None = Field(default=None, max_length=20)
    metadata: dict[str, Any] = Field(default_factory=dict)


@router.post("/monitoring/frontend-event")
async def report_frontend_event(event: FrontendActivityEvent, request: Request):
    details = event.model_dump()
    details["client_host"] = request.client.host if request.client else None
    details["origin"] = request.headers.get("origin")
    details["referer_header"] = request.headers.get("referer")
    details["request_id"] = getattr(request.state, "request_id", None)

    logger.info(
        "frontend_activity_event type=%s route=%s",
        event.type,
        event.route,
        extra={"event": "frontend.activity", "frontend_activity": details},
    )
    return {"ok": True}


@router.post("/monitoring/frontend-error")
async def report_frontend_error(event: FrontendErrorEvent, request: Request):
    details = event.model_dump()
    details["client_host"] = request.client.host if request.client else None
    details["origin"] = request.headers.get("origin")
    details["referer"] = request.headers.get("referer")
    details["request_id"] = getattr(request.state, "request_id", None)

    logger.warning(
        "frontend_error_event type=%s severity=%s code=%s route=%s endpoint=%s status=%s",
        event.type,
        event.severity,
        event.code,
        event.route,
        event.endpoint,
        event.status,
        extra={"event": "frontend.error", "frontend_error": details},
    )

    should_email = (
        event.severity in {"error", "critical"}
        and (event.type != "api_error" or (event.status or 0) >= 500)
    )
    if should_email:
        await send_ops_alert(
            code=event.code or "FRONTEND_ERROR",
            title=event.message[:120] or "Frontend error",
            severity=event.severity,
            source="frontend",
            details=details,
        )

    return {"ok": True}
