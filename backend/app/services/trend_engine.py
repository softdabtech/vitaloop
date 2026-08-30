from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, List

from app.services.lab_date_extraction import choose_measurement_date
from app.services.lab_normalization.biomarker_mapping import to_canonical_name

TREND_ENGINE_VERSION = "trend_engine_v1"


def _canonical_key(name: Any) -> str:
    raw = str(name or "").strip()
    if not raw:
        return ""
    canonical = raw if raw.startswith("canonical_") else f"canonical_{to_canonical_name(raw)}"
    return canonical


def _num(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_dt(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def _measurement_date(row: Dict[str, Any]) -> datetime | None:
    return _parse_dt(choose_measurement_date(row))


def _normalize_history_rows(rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for row in rows or []:
        key = _canonical_key(row.get("canonical_name") or row.get("name"))
        value = _num(row.get("value"))
        measured_at = _measurement_date(row)
        if not key or value is None or measured_at is None:
            continue
        normalized.append(
            {
                "upload_id": row.get("upload_id"),
                "canonical_name": key,
                "name": row.get("name") or key.replace("canonical_", "").replace("_", " ").title(),
                "value": value,
                "unit": row.get("unit"),
                "status": row.get("status"),
                "measured_at": measured_at.isoformat(),
            }
        )
    return normalized


def _direction(delta_pct: float) -> str:
    if delta_pct >= 10:
        return "rising"
    if delta_pct <= -10:
        return "falling"
    return "stable"


def _interpret_trend(current_status: str, direction: str) -> str:
    status = str(current_status or "").upper()
    if status in {"ELEVATED", "DEFICIENT"} and direction in {"rising", "falling"}:
        return "watch_closely"
    if status == "OPTIMAL" and direction == "stable":
        return "stable"
    if status == "OPTIMAL":
        return "monitor"
    return "monitor"


def evaluate_biomarker_trends(
    *,
    current_biomarkers: List[Dict[str, Any]],
    historical_biomarkers: List[Dict[str, Any]] | None = None,
    current_upload_id: str | None = None,
) -> Dict[str, Any]:
    current_measured_at: datetime | None = None
    if current_upload_id:
        current_dates = [
            _measurement_date(row)
            for row in (historical_biomarkers or [])
            if str(row.get("upload_id") or "") == str(current_upload_id)
        ]
        current_dates = [item for item in current_dates if item is not None]
        current_measured_at = max(current_dates) if current_dates else None
        if current_measured_at is None:
            return {
                "version": TREND_ENGINE_VERSION,
                "available": False,
                "history_points": 0,
                "trends": [],
                "priority_changes": [],
                "reason": "current_upload_missing_lab_date",
            }

    filtered_history = [
        row
        for row in (historical_biomarkers or [])
        if not current_upload_id or str(row.get("upload_id") or "") != str(current_upload_id)
    ]
    history = _normalize_history_rows(filtered_history)
    by_key: Dict[str, List[Dict[str, Any]]] = {}
    for row in history:
        by_key.setdefault(row["canonical_name"], []).append(row)
    for rows in by_key.values():
        rows.sort(key=lambda item: item["measured_at"])

    trends: List[Dict[str, Any]] = []
    for current in current_biomarkers or []:
        key = _canonical_key(current.get("canonical_name") or current.get("name"))
        current_value = _num(current.get("value"))
        if not key or current_value is None:
            continue
        prior_rows = by_key.get(key, [])
        if not prior_rows:
            continue
        previous = prior_rows[-1]
        previous_measured_at = _parse_dt(previous.get("measured_at"))
        if current_measured_at and previous_measured_at and previous_measured_at.date() == current_measured_at.date():
            continue
        previous_value = _num(previous.get("value"))
        if previous_value in (None, 0):
            continue
        absolute_change = current_value - previous_value
        delta_pct = round((absolute_change / previous_value) * 100, 2)
        direction = _direction(delta_pct)
        trends.append(
            {
                "canonical_name": key,
                "name": current.get("name") or previous.get("name"),
                "current_value": current_value,
                "previous_value": previous_value,
                "unit": current.get("unit") or previous.get("unit"),
                "absolute_change": round(absolute_change, 4),
                "percent_change": delta_pct,
                "direction": direction,
                "current_status": current.get("status"),
                "previous_status": previous.get("status"),
                "previous_measured_at": previous.get("measured_at"),
                "current_measured_at": current_measured_at.isoformat() if current_measured_at else None,
                "interpretation": _interpret_trend(str(current.get("status") or ""), direction),
            }
        )

    priority = sorted(
        trends,
        key=lambda item: (
            0 if item["interpretation"] == "watch_closely" else 1,
            -abs(float(item.get("percent_change") or 0)),
        ),
    )[:8]

    return {
        "version": TREND_ENGINE_VERSION,
        "available": bool(trends),
        "history_points": len(history),
        "trends": trends,
        "priority_changes": priority,
    }
