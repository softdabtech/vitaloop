from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Tuple

from app.services.lab_normalization.biomarker_mapping import to_canonical_name

PROGRESS_OVERVIEW_VERSION = "progress_overview_v1"


def _parse_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text[:10]).date()
    except ValueError:
        return None


def _measurement_date(upload: Dict[str, Any]) -> Tuple[date | None, str | None]:
    """Return only real lab dates. Never fall back to created_at."""

    for field in ("test_date", "collected_at", "reported_at"):
        parsed = _parse_date(upload.get(field))
        if parsed:
            return parsed, field
    return None, None


def _num(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _canonical_key(name: Any) -> str:
    raw = str(name or "").strip()
    if not raw:
        return ""
    return to_canonical_name(raw)


def _marker_label(rows: Iterable[Dict[str, Any]], fallback: str) -> str:
    for row in rows:
        label = str(row.get("name") or "").strip()
        if label:
            return label
    return fallback.replace("_", " ").title()


def _status_group(status: Any) -> str:
    normalized = str(status or "").strip().lower()
    if normalized in {"high", "low", "elevated", "deficient", "out_of_range", "outside_range", "critical"}:
        return "needs_review"
    if normalized in {"watch", "monitor", "borderline"}:
        return "monitor"
    if normalized in {"normal", "optimal", "in_range", "stable"}:
        return "stable"
    return "unknown"


def _direction(delta: float, percent: float | None) -> str:
    magnitude = abs(percent if percent is not None else delta)
    if magnitude < 5:
        return "stable"
    return "rising" if delta > 0 else "falling"


def _same_day_average(points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for point in points:
        by_date.setdefault(point["date"], []).append(point)

    collapsed: List[Dict[str, Any]] = []
    for day, rows in by_date.items():
        values = [float(row["value"]) for row in rows]
        representative = rows[-1]
        collapsed.append(
            {
                **representative,
                "value": round(sum(values) / len(values), 4),
                "same_day_points": len(rows),
            }
        )
    return sorted(collapsed, key=lambda item: item["date"])


def _change_priority(change: Dict[str, Any]) -> Tuple[int, float]:
    status_rank = 0 if change.get("current_status_group") == "needs_review" else 1
    percent = abs(float(change.get("percent_change") or 0))
    absolute = abs(float(change.get("absolute_change") or 0))
    return status_rank, -(min(percent, 100.0) + absolute)


def _build_confidence(
    *,
    upload_count: int,
    uploads_with_lab_date: int,
    unique_lab_dates: int,
    markers_with_2plus_dates: int,
    date_span_days: int | None,
) -> Dict[str, Any]:
    warnings: List[str] = []
    score = 0.0
    if upload_count:
        score += 0.2
    if uploads_with_lab_date == upload_count and upload_count > 0:
        score += 0.25
    elif uploads_with_lab_date:
        score += 0.15
        warnings.append("some_uploads_missing_lab_date")
    else:
        warnings.append("uploads_missing_lab_date")

    if unique_lab_dates >= 2:
        score += 0.25
    else:
        warnings.append("insufficient_unique_lab_dates")

    if markers_with_2plus_dates:
        score += 0.2
    else:
        warnings.append("no_comparable_markers")

    if date_span_days is not None and date_span_days >= 21:
        score += 0.1
    elif unique_lab_dates >= 2:
        warnings.append("short_date_span")

    score = round(min(score, 1.0), 2)
    if score >= 0.75:
        label = "high"
    elif score >= 0.45:
        label = "medium"
    elif score > 0:
        label = "low"
    else:
        label = "none"
    return {"score": score, "label": label, "warnings": warnings}


def _mode(unique_lab_dates: int, date_span_days: int | None, biomarker_rows: int) -> str:
    if biomarker_rows == 0:
        return "empty"
    if unique_lab_dates == 0:
        return "undated"
    if unique_lab_dates == 1:
        return "snapshot"
    if unique_lab_dates >= 3 and (date_span_days or 0) >= 21:
        return "high_confidence_time_trend"
    return "time_trend"


def build_progress_overview(progress_rows: List[Dict[str, Any]] | None) -> Dict[str, Any]:
    uploads = list(progress_rows or [])
    dated_uploads: List[Dict[str, Any]] = []
    undated_uploads: List[Dict[str, Any]] = []
    points_by_marker: Dict[str, List[Dict[str, Any]]] = {}
    biomarker_rows = 0
    date_spine_map: Dict[str, Dict[str, Any]] = {}

    for upload in uploads:
        lab_date, date_field = _measurement_date(upload)
        biomarkers = list(upload.get("biomarkers") or [])
        biomarker_rows += len(biomarkers)

        if lab_date is None:
            undated_uploads.append(
                {
                    "upload_id": upload.get("id"),
                    "lab_name": upload.get("lab_name"),
                    "biomarker_count": len(biomarkers),
                    "date_source": upload.get("date_source") or "missing",
                    "date_confidence": upload.get("date_confidence"),
                }
            )
            continue

        day = lab_date.isoformat()
        dated_uploads.append({**upload, "lab_date": day, "lab_date_field": date_field})
        spine_item = date_spine_map.setdefault(
            day,
            {"date": day, "upload_count": 0, "marker_count": 0, "uploads": [], "status_counts": {}},
        )
        spine_item["upload_count"] += 1
        spine_item["marker_count"] += len(biomarkers)
        spine_item["uploads"].append({"upload_id": upload.get("id"), "lab_name": upload.get("lab_name")})

        for marker in biomarkers:
            value = _num(marker.get("value"))
            key = _canonical_key(marker.get("name"))
            if not key or value is None:
                continue
            group = _status_group(marker.get("status"))
            spine_item["status_counts"][group] = spine_item["status_counts"].get(group, 0) + 1
            points_by_marker.setdefault(key, []).append(
                {
                    "date": day,
                    "name": marker.get("name"),
                    "value": value,
                    "unit": marker.get("unit"),
                    "status": marker.get("status"),
                    "status_group": group,
                    "ref_low": marker.get("ref_low"),
                    "ref_high": marker.get("ref_high"),
                    "upload_id": upload.get("id"),
                }
            )

    date_spine = sorted(date_spine_map.values(), key=lambda item: item["date"])
    unique_lab_dates = len(date_spine)
    span_days = None
    if unique_lab_dates >= 2:
        first = _parse_date(date_spine[0]["date"])
        latest = _parse_date(date_spine[-1]["date"])
        if first and latest:
            span_days = (latest - first).days

    comparable_markers = 0
    changes: List[Dict[str, Any]] = []
    stable_markers_all: List[Dict[str, Any]] = []
    # Stage 2D-2: markers seen on exactly one dated occasion have no prior
    # value to diff against — they were previously dropped from the response
    # entirely (silently absent), which forces a frontend consumer to GUESS
    # whether "not in top_changes/stable_markers" means "new marker" or "no
    # data at all". Made explicit here instead: an additive, machine-readable
    # status so the frontend never has to infer it. No new formula — reuses
    # the exact same `_same_day_average()` collapse already computed below.
    insufficient_history_markers: List[Dict[str, Any]] = []
    for key, marker_points in points_by_marker.items():
        collapsed = _same_day_average(marker_points)
        if len(collapsed) < 2:
            if len(collapsed) == 1:
                only = collapsed[0]
                insufficient_history_markers.append(
                    {
                        "canonical_name": key,
                        "name": _marker_label(marker_points, key),
                        "unit": only.get("unit"),
                        "latest_value": only["value"],
                        "latest_date": only["date"],
                        "current_status": only.get("status"),
                        "current_status_group": only.get("status_group"),
                        "status": "insufficient_history",
                    }
                )
            continue
        comparable_markers += 1
        first = collapsed[0]
        latest = collapsed[-1]
        previous = collapsed[-2]
        absolute = round(float(latest["value"]) - float(previous["value"]), 4)
        percent = None
        if float(previous["value"]) != 0:
            percent = round((absolute / float(previous["value"])) * 100, 2)
        direction = _direction(absolute, percent)
        item = {
            "canonical_name": key,
            "name": _marker_label(marker_points, key),
            "unit": latest.get("unit") or previous.get("unit"),
            "first_date": first["date"],
            "previous_date": previous["date"],
            "latest_date": latest["date"],
            "first_value": first["value"],
            "previous_value": previous["value"],
            "latest_value": latest["value"],
            "absolute_change": absolute,
            "percent_change": percent,
            "direction": direction,
            "current_status": latest.get("status"),
            "current_status_group": latest.get("status_group"),
            "previous_status": previous.get("status"),
            "points": len(collapsed),
            "reliability": "high" if len(collapsed) >= 3 and (span_days or 0) >= 21 else "medium",
        }
        if direction == "stable":
            stable_markers_all.append(item)
        else:
            changes.append(item)

    top_changes = sorted(changes, key=_change_priority)[:5]
    stable_markers = sorted(stable_markers_all, key=lambda item: item["name"])[:12]
    insufficient_history_markers = sorted(insufficient_history_markers, key=lambda item: item["name"])
    all_comparable_markers = sorted(
        [*changes, *stable_markers_all],
        key=lambda item: (item["latest_date"], item["name"]),
        reverse=True,
    )
    overview_mode = _mode(unique_lab_dates, span_days, biomarker_rows)
    confidence = _build_confidence(
        upload_count=len(uploads),
        uploads_with_lab_date=len(dated_uploads),
        unique_lab_dates=unique_lab_dates,
        markers_with_2plus_dates=comparable_markers,
        date_span_days=span_days,
    )

    if overview_mode in {"time_trend", "high_confidence_time_trend"}:
        next_action = {
            "key": "start_check_in",
            "label": "Start check-in",
            "reason": "Connect symptom changes with dated lab results.",
            "href": "/check-ins",
        }
    elif overview_mode == "snapshot":
        next_action = {
            "key": "add_next_lab_date",
            "label": "Upload another dated lab result",
            "reason": "One lab date is a snapshot, not a time trend.",
            "href": "/upload",
        }
    else:
        next_action = {
            "key": "add_lab_dates",
            "label": "Add lab dates",
            "reason": "Progress requires real lab dates, not upload dates.",
            "href": "/lab-results",
        }

    return {
        "version": PROGRESS_OVERVIEW_VERSION,
        "mode": overview_mode,
        "timeline_eligible": unique_lab_dates >= 2,
        "summary": {
            "upload_count": len(uploads),
            "uploads_with_lab_date": len(dated_uploads),
            "uploads_missing_lab_date": len(undated_uploads),
            "unique_lab_dates": unique_lab_dates,
            "biomarker_rows": biomarker_rows,
            "markers_with_2plus_dates": comparable_markers,
            "markers_with_single_date": len(insufficient_history_markers),
            "date_span_days": span_days,
            "first_lab_date": date_spine[0]["date"] if date_spine else None,
            "latest_lab_date": date_spine[-1]["date"] if date_spine else None,
        },
        "confidence": confidence,
        "date_spine": date_spine,
        "top_changes": top_changes,
        "stable_markers": stable_markers,
        "all_comparable_markers": all_comparable_markers,
        "insufficient_history_markers": insufficient_history_markers,
        "undated_uploads": undated_uploads,
        "timeline": date_spine,
        "rule_insights": [
            {
                "key": "lab_dates_only",
                "severity": "info",
                "title": "Uses lab dates only",
                "body": "Upload dates are not used as analysis dates.",
            },
            {
                "key": "not_diagnostic",
                "severity": "safety",
                "title": "Educational interpretation",
                "body": "Changes are for discussion with a qualified clinician, not a diagnosis.",
            },
        ],
        "next_action": next_action,
    }
