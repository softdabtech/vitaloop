"""Personal Baseline (P6) — "is this normal for YOU", not just for the lab.

2026-09-14 roadmap item P6: a reference range says in-range/out-of-range;
trend_engine.py's marker-level trends say better/worse than last time. This
adds the third axis the user asked for: a personal historical baseline
(mean of the user's own past values for a marker) and — the actual
differentiator — a "silent signal" flag for a marker that sits comfortably
inside the lab reference range but has drifted meaningfully away from the
user's own baseline (the "TSH 1.4 -> 3.8, still 'normal', but that's not
normal for you" case discussed in the product planning thread).

Deliberately reuses trend_engine.py's canonicalization, numeric parsing,
and per-analyte significance-threshold logic (HIGH/LOW variability tiers)
rather than re-deriving a second, possibly-inconsistent notion of "how much
change is a real change" for the same markers.
"""

from __future__ import annotations

import statistics
from typing import Any, Dict, List

from app.services.trend_engine import (
    _canonical_key,
    _normalize_history_rows,
    _num,
    _significance_threshold_pct,
)

PERSONAL_BASELINE_VERSION = "personal_baseline_v1"

_IN_RANGE_STATUSES = {"OPTIMAL", "NORMAL", "IN_RANGE", "IN RANGE"}


def _direction(delta_pct: float, threshold_pct: float) -> str:
    if delta_pct >= threshold_pct:
        return "rising"
    if delta_pct <= -threshold_pct:
        return "falling"
    return "stable"


def build_personal_baseline(
    *,
    current_biomarkers: List[Dict[str, Any]],
    historical_biomarkers: List[Dict[str, Any]] | None = None,
    current_upload_id: str | None = None,
    min_history_points: int = 2,
) -> Dict[str, Any]:
    """For each current marker with enough prior history, compute the
    user's own baseline (mean of past values) and how far the current
    result sits from it — independent of whether the lab reference range
    calls it normal.
    """
    filtered_history = [
        row
        for row in (historical_biomarkers or [])
        if not current_upload_id or str(row.get("upload_id") or "") != str(current_upload_id)
    ]
    history = _normalize_history_rows(filtered_history)
    by_key: Dict[str, List[Dict[str, Any]]] = {}
    for row in history:
        by_key.setdefault(row["canonical_name"], []).append(row)

    markers: List[Dict[str, Any]] = []
    for current in current_biomarkers or []:
        key = _canonical_key(current.get("canonical_name") or current.get("name"))
        current_value = _num(current.get("value"))
        if not key or current_value is None:
            continue
        prior_rows = by_key.get(key) or []
        if len(prior_rows) < min_history_points:
            continue

        values = [row["value"] for row in prior_rows]
        baseline_value = statistics.mean(values)
        if baseline_value == 0:
            continue

        delta_pct = round((current_value - baseline_value) / baseline_value * 100, 2)
        threshold_pct = _significance_threshold_pct(key)
        direction = _direction(delta_pct, threshold_pct)
        status = str(current.get("status") or "").strip().upper()
        in_reference_range = status in _IN_RANGE_STATUSES
        drifting = direction != "stable"
        # The differentiator: "normal" by lab reference range but a real
        # move away from this user's own baseline — a signal a pure
        # reference-range read would hide entirely.
        silent_signal = in_reference_range and drifting

        markers.append(
            {
                "canonical_name": key,
                "name": current.get("name") or prior_rows[-1].get("name") or key,
                "current_value": current_value,
                "unit": current.get("unit") or prior_rows[-1].get("unit"),
                "personal_baseline_value": round(baseline_value, 4),
                "history_points": len(prior_rows),
                "percent_change_from_baseline": delta_pct,
                "significance_threshold_pct": threshold_pct,
                "direction": direction,
                "in_reference_range": in_reference_range,
                "silent_signal": silent_signal,
            }
        )

    # Silent signals first (the highest-value finding), then by magnitude
    # of drift, so the most informative rows surface first in any UI that
    # only shows the first N.
    markers.sort(key=lambda item: (0 if item["silent_signal"] else 1, -abs(item["percent_change_from_baseline"])))

    return {
        "version": PERSONAL_BASELINE_VERSION,
        "available": bool(markers),
        "markers": markers[:20],
        "summary": {
            "markers_with_baseline": len(markers),
            "silent_signal_count": sum(1 for item in markers if item["silent_signal"]),
        },
    }
