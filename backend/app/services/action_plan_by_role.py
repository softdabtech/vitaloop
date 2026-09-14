"""Action Plan by Role (P9) — self / practitioner / doctor / urgent.

2026-09-14 roadmap item P9: after reasoning, gaps, retest, progress,
baseline, and the system map, the user still needs the simplest possible
answer — what to do myself, what to bring to a specialist, what needs a
doctor, and what's urgent. This is deliberately pure composition over
data the pipeline already computes (clinical_reasoning_traces' doctor_flag/
safety_level, protocol's self-guided actions, next_best_tests, evidence_gaps)
— no new clinical judgment, just routing already-classified signals into
one of four buckets by who should act on them.

Bucket assignment, in priority order (first match wins):
  urgent       — doctor_flag AND safety_level == high_confidence_urgent
  doctor       — doctor_flag (any other safety_level), or safety_level ==
                 doctor_only
  practitioner — moderate confidence, or has evidence gaps / next-best-tests
                 attached — "you need more context/testing before acting"
  self         — everything else: low/stable confidence findings, and every
                 protocol action (nutrition/supplements/lifestyle/training)
"""

from __future__ import annotations

from typing import Any, Dict, List

ACTION_PLAN_BY_ROLE_VERSION = "action_plan_by_role_v1"

_BUCKET_ORDER = ("urgent", "doctor", "practitioner", "self")


def _bucket_for_trace(trace: Dict[str, Any]) -> str:
    doctor_flag = bool(trace.get("doctor_flag"))
    safety_level = str(trace.get("safety_level") or "").strip()

    if doctor_flag and safety_level == "high_confidence_urgent":
        return "urgent"
    if doctor_flag or safety_level == "doctor_only":
        return "doctor"
    if safety_level == "moderate_confidence" or trace.get("evidence_gaps") or trace.get("next_best_tests"):
        return "practitioner"
    return "self"


def _trace_item(trace: Dict[str, Any], bucket: str) -> Dict[str, Any]:
    user_explanation = trace.get("user_explanation") or {}
    return {
        "bucket": bucket,
        "title": trace.get("pattern_name") or trace.get("pattern_id"),
        "reason": user_explanation.get("summary"),
        "confidence": trace.get("confidence"),
        "source": "pattern",
        "source_id": trace.get("pattern_id"),
    }


def _protocol_item(action: Dict[str, Any], section: str) -> Dict[str, Any]:
    return {
        "bucket": "self",
        "title": action.get("title") or action.get("supplement") or action.get("name") or "Action",
        "reason": action.get("body") or action.get("rationale") or action.get("reason"),
        "confidence": None,
        "source": "protocol",
        "source_id": section,
    }


def build_action_plan_by_role(
    *,
    clinical_reasoning_traces: List[Dict[str, Any]] | None = None,
    protocol: Dict[str, List[Dict[str, Any]]] | None = None,
    next_best_tests: Dict[str, Any] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    buckets: Dict[str, List[Dict[str, Any]]] = {key: [] for key in _BUCKET_ORDER}

    for trace in clinical_reasoning_traces or []:
        if not isinstance(trace, dict):
            continue
        bucket = _bucket_for_trace(trace)
        buckets[bucket].append(_trace_item(trace, bucket))

    for section, actions in (protocol or {}).items():
        for action in actions or []:
            if not isinstance(action, dict):
                continue
            buckets["self"].append(_protocol_item(action, section))

    # Report-level next_best_tests / high-priority evidence_gaps not already
    # attached to a specific pattern (e.g. no pattern detected at all, but a
    # domain-expected marker is still missing) still belong with the
    # practitioner — "bring this up at your next visit" — not silently
    # dropped just because no pattern trace carries them.
    existing_practitioner_markers = {
        str(item.get("source_id") or "").lower() for item in buckets["practitioner"]
    }
    for test in (next_best_tests or {}).get("recommended_tests") or []:
        if not isinstance(test, dict):
            continue
        marker = str(test.get("marker") or "").strip()
        if not marker or marker.lower() in existing_practitioner_markers:
            continue
        buckets["practitioner"].append(
            {
                "bucket": "practitioner",
                "title": marker,
                "reason": test.get("reason"),
                "confidence": None,
                "source": "next_best_tests",
                "source_id": marker,
            }
        )

    for gap in (evidence_gaps or {}).get("gaps") or []:
        if not isinstance(gap, dict) or gap.get("priority") != "high":
            continue
        label = gap.get("missing_marker") or gap.get("domain")
        if not label:
            continue
        buckets["practitioner"].append(
            {
                "bucket": "practitioner",
                "title": label,
                "reason": gap.get("suggested_next_step") or gap.get("reason"),
                "confidence": None,
                "source": "evidence_gap",
                "source_id": label,
            }
        )

    return {
        "version": ACTION_PLAN_BY_ROLE_VERSION,
        "buckets": buckets,
        "summary": {f"{key}_count": len(buckets[key]) for key in _BUCKET_ORDER},
    }
