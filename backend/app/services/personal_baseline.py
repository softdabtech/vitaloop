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
    _measurement_date,
    _normalize_history_rows,
    _num,
    _parse_dt,
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


# ===========================================================================
# P19: Personal Baseline 2.0 — velocity/direction extension
# ===========================================================================
#
# Nested under personal_baseline["velocity"] rather than replacing anything
# above: build_personal_baseline()'s existing contract (version/available/
# markers/summary) is untouched, so every existing caller (frozen replay,
# P18's reasoning map adapter, etc.) keeps working unchanged. This section
# adds a second, independent axis — not "how far from your baseline" but
# "which way is it moving, how fast, and how consistently" — reusing
# trend_engine.py's canonicalization/threshold logic exactly like the
# section above, never re-deriving a second notion of "meaningful change".
#
# Formula (documented here, not just in code):
#   1. A marker needs >=1 prior history point (2 total values incl. current)
#      to produce ANY velocity signal — with none, it's skipped entirely
#      (never fabricate a trend from a single point).
#   2. delta_pct = percent change from the MOST RECENT prior value to the
#      current value (distinct from the baseline markers above, which use
#      the MEAN of all prior values — velocity cares about the latest move,
#      baseline cares about the settled personal norm).
#   3. magnitude_ratio = abs(delta_pct) / significance_threshold_pct(marker)
#      velocity tier: <1.5 -> "slow", 1.5-3 -> "moderate", >=3 -> "fast".
#   4. direction: "up"/"down" if delta_pct crosses the threshold, else
#      "stable" (same threshold trend_engine already uses for this marker).
#   5. Consistency/volatility need >=2 prior points (3 total values): look
#      at the sign of every consecutive step (prior[i] -> prior[i+1] ->
#      ... -> current). All-same-sign (ignoring "stable" steps) ->
#      direction_consistent; >=2 sign flips -> volatile.
#   6. Status, in priority order (first match wins — an erratic history
#      deserves a cautious frame before anything more specific is claimed):
#        volatile_marker      - sign flips across history
#        rapid_change         - magnitude_ratio >= 3 and direction != stable
#        (then, using the marker's direction category — see
#         _MARKER_DIRECTION_CATEGORY below)
#        improved_toward_baseline / worsened_from_baseline - for
#          higher_may_be_concerning / lower_may_be_concerning markers,
#          based on whether the move is toward or away from the
#          less-concerning side
#        normal_but_drifting  - too_high_or_too_low/context_dependent
#          marker, still within the lab reference range, but has moved
#          meaningfully from its own recent value
#        direction_consistent - same category, outside range, but the
#          move doesn't cleanly map to "better"/"worse" (no default
#          direction to prefer) and is at least consistent across history
#        stable_near_baseline - direction is "stable"
#
# No LLM. Deterministic and frozen-replay safe: same posture as every
# other reasoning-core module in this codebase.

PERSONAL_BASELINE_VELOCITY_VERSION = "p19_v1"

# Domain vocabulary matches negative_evidence.py / report_interpretation.py
# so a future reasoning-map/practitioner UI can cross-reference by domain
# the same way P15-P17 already do.
_MARKER_DOMAIN = {
    "canonical_tsh": "thyroid",
    "canonical_ferritin": "iron_status",
    "canonical_alt": "liver",
    "canonical_ast": "liver",
    "canonical_ggt": "liver",
    "canonical_hba1c": "metabolic_health",
    "canonical_glucose": "metabolic_health",
    "canonical_insulin": "metabolic_health",
    "canonical_homa_ir": "metabolic_health",
    "canonical_triglycerides": "cardiovascular",
    "canonical_hdl": "cardiovascular",
    "canonical_ldl": "cardiovascular",
    "canonical_apob": "cardiovascular",
    "canonical_crp": "inflammation",
    "canonical_vitamin_d": "micronutrients",
    "canonical_b12": "micronutrients",
}

# "higher_may_be_concerning" / "lower_may_be_concerning": there is a
# direction a reasonable person would rather this marker NOT move in.
# "too_high_or_too_low": both extremes are undesirable, so an isolated
# up/down move doesn't map to "better"/"worse" without more context —
# treated the same as "context_dependent" throughout this module.
_MARKER_DIRECTION_CATEGORY = {
    "canonical_alt": "higher_may_be_concerning",
    "canonical_ast": "higher_may_be_concerning",
    "canonical_ggt": "higher_may_be_concerning",
    "canonical_crp": "higher_may_be_concerning",
    "canonical_hba1c": "higher_may_be_concerning",
    "canonical_glucose": "higher_may_be_concerning",
    "canonical_insulin": "higher_may_be_concerning",
    "canonical_homa_ir": "higher_may_be_concerning",
    "canonical_triglycerides": "higher_may_be_concerning",
    "canonical_ldl": "higher_may_be_concerning",
    "canonical_apob": "higher_may_be_concerning",
    "canonical_hdl": "lower_may_be_concerning",
    "canonical_ferritin": "too_high_or_too_low",
    "canonical_tsh": "too_high_or_too_low",
    "canonical_vitamin_d": "too_high_or_too_low",
    "canonical_b12": "too_high_or_too_low",
}

# Kept short and specific to the two markers already called out in the P19
# spec's own worked example — not an attempt to enumerate every marker's
# ideal companion test, which belongs to evidence_gaps.py, not here.
_VELOCITY_LIMITATION_HINTS = {
    "canonical_tsh": ["Free T4 and thyroid antibodies would improve interpretation."],
    "canonical_ferritin": ["CRP would help interpret this alongside inflammation status."],
}

_VELOCITY_MVP_MARKERS = set(_MARKER_DOMAIN)


def _velocity_tier(magnitude_ratio: float) -> str:
    if magnitude_ratio >= 3:
        return "fast"
    if magnitude_ratio >= 1.5:
        return "moderate"
    return "slow"


def _step_directions(values: List[float], threshold_pct: float) -> List[str]:
    """Sign of each consecutive step across the full ordered value
    sequence (oldest prior -> ... -> current), using the same
    threshold-gated direction() as everywhere else in this module — a
    sub-threshold wobble is "stable", not a direction change."""
    directions: List[str] = []
    for previous, current in zip(values, values[1:]):
        if previous == 0:
            directions.append("stable")
            continue
        step_pct = (current - previous) / previous * 100
        directions.append(_direction(step_pct, threshold_pct))
    return directions


def _is_direction_consistent(step_directions: List[str]) -> bool:
    moving = [d for d in step_directions if d != "stable"]
    return len(moving) >= 2 and len(set(moving)) == 1


def _is_volatile(step_directions: List[str]) -> bool:
    moving = [d for d in step_directions if d != "stable"]
    flips = sum(1 for a, b in zip(moving, moving[1:]) if a != b)
    return flips >= 2


def _assess_marker_velocity(
    key: str,
    *,
    current: Dict[str, Any],
    current_value: float,
    prior_rows: List[Dict[str, Any]],
) -> Dict[str, Any] | None:
    if not prior_rows:
        return None

    ordered = sorted(prior_rows, key=lambda row: row.get("measured_at") or "")
    values = [row["value"] for row in ordered] + [current_value]
    n = len(values)

    latest_prior = values[-2]
    if latest_prior == 0:
        return None
    delta_pct = round((current_value - latest_prior) / latest_prior * 100, 2)
    threshold_pct = _significance_threshold_pct(key)
    direction_raw = _direction(delta_pct, threshold_pct)
    magnitude_ratio = abs(delta_pct) / threshold_pct if threshold_pct else 0.0
    velocity = _velocity_tier(magnitude_ratio)

    step_directions = _step_directions(values, threshold_pct)
    direction_consistent = n >= 3 and _is_direction_consistent(step_directions)
    volatile = n >= 3 and _is_volatile(step_directions)

    status_str = str(current.get("status") or "").strip().upper()
    in_reference_range = status_str in _IN_RANGE_STATUSES

    baseline_mean = statistics.mean(values[:-1])
    if baseline_mean == 0:
        relative_to_baseline = "at"
    else:
        baseline_delta_pct = (current_value - baseline_mean) / baseline_mean * 100
        relative_to_baseline = (
            "above" if baseline_delta_pct >= threshold_pct
            else "below" if baseline_delta_pct <= -threshold_pct
            else "at"
        )

    reason_codes: List[str] = ["within_lab_range" if in_reference_range else "outside_lab_range"]
    if relative_to_baseline != "at":
        reason_codes.append("meaningful_personal_change")
    if direction_consistent:
        reason_codes.append("consistent_direction")
    if volatile:
        reason_codes.append("volatile_history")
    if velocity == "fast" and direction_raw != "stable":
        reason_codes.append("rapid_velocity")

    direction_out = "stable" if direction_raw == "stable" else ("up" if direction_raw == "rising" else "down")
    category = _MARKER_DIRECTION_CATEGORY.get(key, "context_dependent")

    # Status priority, per this module's documented formula above.
    if volatile:
        status = "volatile_marker"
        confidence = "low"
    elif velocity == "fast" and direction_raw != "stable":
        status = "rapid_change"
        confidence = "moderate" if n >= 3 else "low"
    elif direction_raw == "stable":
        status = "stable_near_baseline"
        confidence = "moderate" if n >= 3 else "low"
    elif category in ("higher_may_be_concerning", "lower_may_be_concerning"):
        better_direction = "down" if category == "higher_may_be_concerning" else "up"
        status = "improved_toward_baseline" if direction_out == better_direction else "worsened_from_baseline"
        confidence = "moderate" if n >= 3 else "low"
    elif in_reference_range:
        status = "normal_but_drifting"
        confidence = "moderate" if n >= 3 else "low"
    elif direction_consistent:
        status = "direction_consistent"
        confidence = "moderate"
    else:
        # Outside range, context-dependent marker, meaningful move, but not
        # (yet) consistent across enough history to call it a trend —
        # still worth a cautious note rather than silence.
        status = "direction_consistent"
        confidence = "low"

    earliest_measured_at = ordered[0].get("measured_at")
    current_measured_at = _measurement_date(current) if isinstance(current, dict) else None
    time_window_days = None
    if earliest_measured_at and current_measured_at:
        try:
            earliest_dt = _parse_dt(earliest_measured_at)
            if earliest_dt:
                time_window_days = max(0, (current_measured_at - earliest_dt).days)
        except Exception:
            time_window_days = None

    return {
        "marker": key.replace("canonical_", ""),
        "domain": _MARKER_DOMAIN.get(key, "general"),
        "status": status,
        "direction": direction_out,
        "velocity": velocity,
        "change_summary": f"{round(latest_prior, 4)} → {round(current_value, 4)}",
        "time_window_days": time_window_days,
        "within_lab_range": in_reference_range,
        "relative_to_personal_baseline": relative_to_baseline,
        "confidence": confidence,
        "reason_codes": reason_codes,
        "reason": _VELOCITY_REASON_TEMPLATES.get(status, _VELOCITY_REASON_TEMPLATES["_default"])(key),
        "limitations": _VELOCITY_LIMITATION_HINTS.get(key, []),
    }


def _marker_label(key: str) -> str:
    return key.replace("canonical_", "").replace("_", " ")


_VELOCITY_REASON_TEMPLATES = {
    "normal_but_drifting": lambda key: (
        f"{_marker_label(key).upper()} is still within the lab reference range, but it has moved "
        "meaningfully compared with the user's prior values."
    ),
    "rapid_change": lambda key: (
        f"{_marker_label(key).upper()} changed more than expected over the available history and may "
        "deserve follow-up."
    ),
    "direction_consistent": lambda key: (
        f"{_marker_label(key).upper()} has moved in the same direction across the available history — "
        "a trend signal worth tracking."
    ),
    "improved_toward_baseline": lambda key: (
        f"{_marker_label(key).upper()} has moved toward this user's more stable prior range."
    ),
    "worsened_from_baseline": lambda key: (
        f"{_marker_label(key).upper()} has moved away from this user's more stable prior range."
    ),
    "stable_near_baseline": lambda key: (
        f"{_marker_label(key).upper()} is close to this user's recent values, with no meaningful move."
    ),
    "volatile_marker": lambda key: (
        f"{_marker_label(key).upper()} has fluctuated meaningfully across the available history and may "
        "be best interpreted cautiously."
    ),
    "_default": lambda key: f"{_marker_label(key).upper()} shows a trend signal worth noting.",
}


def build_personal_baseline_velocity(
    *,
    current_biomarkers: List[Dict[str, Any]],
    historical_biomarkers: List[Dict[str, Any]] | None = None,
    current_upload_id: str | None = None,
) -> Dict[str, Any]:
    """P19: direction/velocity signals, one per MVP marker with >=1 prior
    history point. See this section's module-level docstring for the full
    formula. Independent of build_personal_baseline() above — safe to call
    even when that function's min_history_points gate (default 2) would
    have skipped a marker that still has exactly 1 prior point here."""
    filtered_history = [
        row
        for row in (historical_biomarkers or [])
        if not current_upload_id or str(row.get("upload_id") or "") != str(current_upload_id)
    ]
    history = _normalize_history_rows(filtered_history)
    by_key: Dict[str, List[Dict[str, Any]]] = {}
    for row in history:
        by_key.setdefault(row["canonical_name"], []).append(row)

    signals: List[Dict[str, Any]] = []
    for current in current_biomarkers or []:
        if not isinstance(current, dict):
            continue
        key = _canonical_key(current.get("canonical_name") or current.get("name"))
        if key not in _VELOCITY_MVP_MARKERS:
            continue
        current_value = _num(current.get("value"))
        if current_value is None:
            continue
        try:
            signal = _assess_marker_velocity(
                key, current=current, current_value=current_value, prior_rows=by_key.get(key) or []
            )
        except Exception:
            signal = None
        if signal:
            signals.append(signal)

    summary = {
        "markers_assessed": len(signals),
        "normal_but_drifting_count": sum(1 for s in signals if s["status"] == "normal_but_drifting"),
        "rapid_change_count": sum(1 for s in signals if s["status"] == "rapid_change"),
        "improved_count": sum(1 for s in signals if s["status"] == "improved_toward_baseline"),
        "worsened_count": sum(1 for s in signals if s["status"] == "worsened_from_baseline"),
        "stable_count": sum(1 for s in signals if s["status"] == "stable_near_baseline"),
        "volatile_count": sum(1 for s in signals if s["status"] == "volatile_marker"),
        "direction_consistent_count": sum(1 for s in signals if s["status"] == "direction_consistent"),
    }

    return {
        "version": PERSONAL_BASELINE_VELOCITY_VERSION,
        "signals": signals,
        "summary": summary,
    }
