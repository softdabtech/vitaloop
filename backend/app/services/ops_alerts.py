from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

from app.config import settings
from app.services.email_service import _deliver_html_email

logger = logging.getLogger("vitaloop.ops_alerts")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _state_path() -> Path:
    return Path(settings.ops_alert_state_file or "/tmp/vitaloop_ops_alerts.json")


def _today_key(now: datetime | None = None) -> str:
    return (now or _utc_now()).strftime("%Y-%m-%d")


def _load_state() -> dict[str, Any]:
    path = _state_path()
    try:
        if not path.exists():
            return {}
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.warning("ops_alert_state_read_failed path=%s error=%s", path, exc)
        return {}


def _save_state(state: dict[str, Any]) -> None:
    path = _state_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        logger.warning("ops_alert_state_write_failed path=%s error=%s", path, exc)


def can_send_ops_alert(now: datetime | None = None) -> bool:
    if not settings.ops_alerts_enabled:
        return False
    if not (settings.ops_alert_email or "").strip():
        return False
    max_per_day = max(0, int(settings.ops_alerts_max_emails_per_day or 0))
    if max_per_day <= 0:
        return False
    state = _load_state()
    day = _today_key(now)
    count = int(((state.get("days") or {}).get(day) or {}).get("count") or 0)
    return count < max_per_day


def _record_sent(now: datetime | None = None) -> int:
    now = now or _utc_now()
    day = _today_key(now)
    state = _load_state()
    days = state.setdefault("days", {})
    bucket = days.setdefault(day, {"count": 0})
    bucket["count"] = int(bucket.get("count") or 0) + 1
    bucket["last_sent_at"] = now.isoformat()
    state["last_sent_at"] = now.isoformat()
    _save_state(state)
    return bucket["count"]


def _format_payload(payload: dict[str, Any]) -> str:
    safe_payload = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    return f"<pre style=\"white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;color:#0f172a;font-size:13px;line-height:1.45;\">{escape(safe_payload)}</pre>"


async def send_ops_alert(
    *,
    code: str,
    title: str,
    severity: str = "error",
    source: str = "backend",
    details: dict[str, Any] | None = None,
) -> bool:
    """Send a rate-limited operational alert email.

    The event is always logged by callers; this function only controls the
    email side effect. It never raises, so monitoring cannot break requests.
    """
    now = _utc_now()
    payload = {
        "code": code,
        "title": title,
        "severity": severity,
        "source": source,
        "occurred_at_utc": now.isoformat(),
        "details": details or {},
    }

    if not can_send_ops_alert(now):
        logger.warning(
            "ops_alert_email_suppressed code=%s source=%s severity=%s",
            code,
            source,
            severity,
            extra={"event": "ops.alert.suppressed", "ops_alert": payload},
        )
        return False

    try:
        count = _record_sent(now)
        subject = f"[VITALOOP {severity.upper()}] {code}: {title[:80]}"
        html = f"""
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:720px;color:#0f172a;">
          <h2 style="margin:0 0 8px;color:#b91c1c;">VITALOOP service alert</h2>
          <p style="margin:0 0 16px;color:#475569;">Alert {count}/{settings.ops_alerts_max_emails_per_day} for {_today_key(now)} UTC.</p>
          <table style="border-collapse:collapse;margin-bottom:16px;">
            <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Code</td><td><strong>{escape(code)}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b;">When</td><td>{escape(now.isoformat())}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Source</td><td>{escape(source)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Severity</td><td>{escape(severity)}</td></tr>
          </table>
          <h3 style="margin:18px 0 8px;">Details</h3>
          {_format_payload(payload)}
        </div>
        """.strip()
        delivered = await _deliver_html_email(
            to_email=settings.ops_alert_email,
            subject=subject,
            html=html,
        )
        logger.warning(
            "ops_alert_email_sent code=%s delivered=%s count=%s",
            code,
            delivered,
            count,
            extra={"event": "ops.alert.email", "ops_alert": payload},
        )
        return bool(delivered)
    except Exception as exc:
        logger.error("ops_alert_email_failed code=%s error=%s", code, exc, exc_info=True)
        return False
