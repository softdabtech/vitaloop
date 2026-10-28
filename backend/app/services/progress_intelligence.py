"""Progress Intelligence (P5) — compares this upload's clinical reasoning
traces against the user's previous upload's traces.

2026-09-13 roadmap item P5 ("Progress Intelligence / Trajectory Layer"):
not "here is a new report", but "here is what changed since last time" —
which patterns strengthened, weakened, resolved, or newly appeared.

Deliberately pure composition, same posture as clinical_priority_planner.py
and next_best_test_engine.py: this reads two already-computed
clinical_reasoning_trace lists (current and previous, see
clinical_reasoning_trace.py) and diffs them by pattern_id. It does not
recompute confidence, does not re-run pattern detection, and does not touch
raw biomarker values — trend_engine.py already owns marker-level value
trends (rising/falling/stable per biomarker); this is the pattern-level
counterpart trend_engine.py does not cover.
"""

from __future__ import annotations

from typing import Any, Dict, List


PROGRESS_INTELLIGENCE_VERSION = "progress_intelligence_v1"

# A confidence swing smaller than this is noise, not a real strengthening/
# weakening signal — mirrors the spirit of trend_engine.py's
# _significance_threshold_pct guard against over-reporting small moves.
_CONFIDENCE_CHANGE_THRESHOLD = 0.08


def _traces_by_pattern_id(traces: List[Dict[str, Any]] | None) -> Dict[str, Dict[str, Any]]:
    result: Dict[str, Dict[str, Any]] = {}
    for trace in traces or []:
        if not isinstance(trace, dict):
            continue
        pattern_id = trace.get("pattern_id")
        if pattern_id:
            result[str(pattern_id)] = trace
    return result


def _confidence(trace: Dict[str, Any]) -> float | None:
    value = trace.get("confidence")
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _severity_rank(severity: Any) -> int:
    return {"mild": 0, "moderate": 1, "high": 2}.get(str(severity or "").strip().lower(), -1)


def build_progress_intelligence(
    *,
    current_traces: List[Dict[str, Any]] | None,
    previous_traces: List[Dict[str, Any]] | None,
    previous_upload_id: str | None = None,
    previous_measured_at: str | None = None,
) -> Dict[str, Any]:
    """Diff current vs previous clinical_reasoning_traces by pattern_id.

    Returns an "unavailable" shape (available=False) when there is no
    previous upload to compare against — the caller (pipeline, first-ever
    upload) should not treat this as an error, just as "nothing to compare
    yet", the same way trend_engine.evaluate_biomarker_trends does when
    history is empty.
    """
    if not previous_traces:
        return {
            "version": PROGRESS_INTELLIGENCE_VERSION,
            "available": False,
            "previous_upload_id": previous_upload_id,
            "previous_measured_at": previous_measured_at,
            "changes": [],
            "summary": {
                "strengthened_count": 0,
                "weakened_count": 0,
                "new_signal_count": 0,
                "resolved_count": 0,
                "stable_count": 0,
            },
        }

    current_by_id = _traces_by_pattern_id(current_traces)
    previous_by_id = _traces_by_pattern_id(previous_traces)

    changes: List[Dict[str, Any]] = []

    for pattern_id, current in current_by_id.items():
        previous = previous_by_id.get(pattern_id)
        if previous is None:
            changes.append(
                {
                    "pattern_id": pattern_id,
                    "domain": current.get("domain"),
                    "pattern_name": current.get("pattern_name"),
                    "status": "new_signal",
                    "current_confidence": _confidence(current),
                    "previous_confidence": None,
                    "confidence_delta": None,
                    "current_severity": current.get("severity"),
                    "previous_severity": None,
                }
            )
            continue

        current_confidence = _confidence(current)
        previous_confidence = _confidence(previous)
        delta = (
            round(current_confidence - previous_confidence, 3)
            if current_confidence is not None and previous_confidence is not None
            else None
        )
        severity_delta = _severity_rank(current.get("severity")) - _severity_rank(previous.get("severity"))

        if delta is not None and delta >= _CONFIDENCE_CHANGE_THRESHOLD:
            status = "strengthened"
        elif delta is not None and delta <= -_CONFIDENCE_CHANGE_THRESHOLD:
            status = "weakened"
        elif severity_delta > 0:
            status = "strengthened"
        elif severity_delta < 0:
            status = "weakened"
        else:
            status = "stable"

        changes.append(
            {
                "pattern_id": pattern_id,
                "domain": current.get("domain"),
                "pattern_name": current.get("pattern_name"),
                "status": status,
                "current_confidence": current_confidence,
                "previous_confidence": previous_confidence,
                "confidence_delta": delta,
                "current_severity": current.get("severity"),
                "previous_severity": previous.get("severity"),
            }
        )

    for pattern_id, previous in previous_by_id.items():
        if pattern_id in current_by_id:
            continue
        # Present last time, not detected this time — read as improvement/
        # resolution (the pattern's trigger condition no longer holds), not
        # silently dropped. A caller that wants more nuance can still see
        # previous_severity/previous_confidence on this entry.
        changes.append(
            {
                "pattern_id": pattern_id,
                "domain": previous.get("domain"),
                "pattern_name": previous.get("pattern_name"),
                "status": "resolved_or_improved",
                "current_confidence": None,
                "previous_confidence": _confidence(previous),
                "confidence_delta": None,
                "current_severity": None,
                "previous_severity": previous.get("severity"),
            }
        )

    status_rank = {"new_signal": 0, "weakened": 1, "strengthened": 2, "stable": 3, "resolved_or_improved": 4}
    changes.sort(key=lambda item: status_rank.get(item["status"], 5))

    summary = {
        "strengthened_count": len([c for c in changes if c["status"] == "strengthened"]),
        "weakened_count": len([c for c in changes if c["status"] == "weakened"]),
        "new_signal_count": len([c for c in changes if c["status"] == "new_signal"]),
        "resolved_count": len([c for c in changes if c["status"] == "resolved_or_improved"]),
        "stable_count": len([c for c in changes if c["status"] == "stable"]),
    }

    return {
        "version": PROGRESS_INTELLIGENCE_VERSION,
        "available": True,
        "previous_upload_id": previous_upload_id,
        "previous_measured_at": previous_measured_at,
        "changes": changes,
        "summary": summary,
    }
