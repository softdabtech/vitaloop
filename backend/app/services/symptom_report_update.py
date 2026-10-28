"""Explicit report-refresh offer after a completed symptom check."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from app.services import supabase_service as svc


SYMPTOM_REPORT_UPDATE_VERSION = "symptom_report_update_v1"


def _timestamp(value: Any) -> datetime | None:
    raw = str(value or "").strip().replace("Z", "+00:00")
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def build_report_update_offer(
    *,
    completed_at: Any,
    latest_ready_report: Dict[str, Any] | None,
) -> Dict[str, Any]:
    report = latest_ready_report if isinstance(latest_ready_report, dict) else {}
    upload_id = str(report.get("upload_id") or "").strip()
    symptom_time = _timestamp(completed_at)
    report_time = _timestamp(report.get("report_generated_at"))

    if not upload_id:
        return {
            "version": SYMPTOM_REPORT_UPDATE_VERSION,
            "status": "no_report",
            "update_available": False,
            "reason": "no_completed_report_to_update",
            "action": {"type": "upload_labs", "path": "/upload"},
        }
    update_available = bool(symptom_time and report_time and symptom_time > report_time)
    return {
        "version": SYMPTOM_REPORT_UPDATE_VERSION,
        "status": "update_available" if update_available else "current",
        "update_available": update_available,
        "reason": (
            "symptom_check_completed_after_latest_report"
            if update_available else "latest_report_already_includes_newer_context"
        ),
        "report_upload_id": upload_id,
        "report_generated_at": report.get("report_generated_at"),
        "symptom_check_completed_at": completed_at,
        "action": {
            "type": "regenerate_report" if update_available else "view_report",
            "method": "POST" if update_available else "GET",
            "endpoint": (
                f"/analyze/{upload_id}/regenerate"
                if update_available else f"/results/{upload_id}"
            ),
            "path": f"/results/{upload_id}",
        },
    }


async def resolve_report_update_offer(*, user_id: str, completed_at: Any) -> Dict[str, Any]:
    """Read the user's latest ready report and return an explicit next action."""
    try:
        from app.routers.analysis.dashboard import invalidate_summary_cache

        invalidate_summary_cache(user_id)
    except Exception:
        pass
    try:
        latest = await svc.get_latest_ready_report(user_id)
    except Exception:
        return {
            "version": SYMPTOM_REPORT_UPDATE_VERSION,
            "status": "unavailable",
            "update_available": False,
            "reason": "latest_report_lookup_failed",
            "action": None,
        }
    return build_report_update_offer(completed_at=completed_at, latest_ready_report=latest)
