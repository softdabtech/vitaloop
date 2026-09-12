"""Clinical priority planner + clinical_story composer.

2026-09-12 clinical analyzer audit, items #2 and #6 of "not implemented yet":
  - a clinical priority planner (urgent review / review soon / symptom
    drivers / lifestyle-supplement opportunities / monitor-only), and
  - one cohesive clinical_story output object combining top patterns, likely
    symptom links, safety constraints, prioritized actions, retest plan, and
    uncertainty.

Both are pure composition over pieces the pipeline already computes
(interpreted_report's patterns, health_states, safety_result, evidence_gaps,
retest_suggestions) — no new clinical logic, no new source of truth. The
planner buckets what already exists into a stable, UI-ready shape instead of
leaving callers to re-derive "what should I look at first" from five
separate objects each with their own priority vocabulary.

symptom_drivers is populated from each pattern's symptom_signal (see
report_interpretation.py::_attach_symptom_links), which matches reported
symptoms against domain_registry.py's existing symptom_aliases per domain —
set-membership against data that already exists, not new diagnostic
reasoning. It stays empty when no symptoms were reported or none matched a
detected pattern's domain.
"""

from __future__ import annotations

from typing import Any, Dict, List


CLINICAL_PRIORITY_PLANNER_VERSION = "clinical_priority_planner_v1"
CLINICAL_STORY_VERSION = "clinical_story_v1"

_BUCKET_ORDER = ("urgent_review", "review_soon", "symptom_drivers", "lifestyle_opportunities", "monitor_only")


def _dedupe_by_key(items: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    seen: set[Any] = set()
    result: List[Dict[str, Any]] = []
    for item in items:
        key = item.get("key")
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
        if len(result) >= limit:
            break
    return result


def build_clinical_priority_planner(
    *,
    patterns: List[Dict[str, Any]] | None = None,
    health_states: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    buckets: Dict[str, List[Dict[str, Any]]] = {key: [] for key in _BUCKET_ORDER}

    for pattern in patterns or []:
        if not isinstance(pattern, dict):
            continue
        priority = str(pattern.get("priority") or "medium").strip().lower()
        item = {
            "key": pattern.get("key"),
            "domain": pattern.get("domain"),
            "title": pattern.get("title"),
            "reason": pattern.get("summary"),
            "confidence": pattern.get("confidence"),
        }
        if priority == "high":
            buckets["urgent_review"].append(item)
        elif priority == "low":
            buckets["lifestyle_opportunities"].append(item)
        else:
            buckets["review_soon"].append(item)

        # Symptom-lab linking (2026-09-12 audit follow-up): report_interpretation.py
        # now attaches symptom_signal to every pattern by matching reported
        # symptoms against domain_registry.py's existing symptom_aliases. A
        # pattern with a matched symptom is ALSO a symptom driver — it stays
        # in its priority bucket above too, since urgency and "this explains
        # a symptom" are different axes.
        symptom_signal = pattern.get("symptom_signal") or []
        if symptom_signal:
            buckets["symptom_drivers"].append(
                {
                    **item,
                    "reason": f"Reported symptom(s) {', '.join(symptom_signal)} align with this domain.",
                    "symptoms": list(symptom_signal),
                }
            )

    safety_risk_level = str((safety_result or {}).get("risk_level") or "").strip().lower()
    safety_status = str((safety_result or {}).get("status") or "").strip().lower()
    safety_urgent = safety_risk_level in {"urgent_review", "immediate"} or safety_status == "blocked"
    if safety_urgent and not buckets["urgent_review"]:
        # The pattern engine didn't independently flag a 'high' priority
        # pattern, but the safety engine (a separate, stricter check — see
        # safety/safety_engine.py) did. Surface that so urgent_review is
        # never empty while safety_result says otherwise.
        buckets["urgent_review"].append(
            {
                "key": "safety_engine_flag",
                "domain": "safety",
                "title": "Safety engine flagged this result for prompt review",
                "reason": (safety_result or {}).get("message") or "One or more values require prompt medical review.",
                "confidence": None,
            }
        )

    for state in (health_states or {}).get("states") or []:
        if not isinstance(state, dict):
            continue
        domain = state.get("domain") or state.get("key")
        if not domain:
            continue
        risk_level = str(state.get("risk_level") or "").strip().lower()
        if risk_level == "high_attention":
            buckets["review_soon"].append(
                {
                    "key": f"health_state_{domain}",
                    "domain": domain,
                    "title": state.get("label") or domain,
                    "reason": "This health domain scored in the high-attention range.",
                    "confidence": None,
                }
            )
        elif risk_level in {"monitor", "stable"}:
            buckets["monitor_only"].append(
                {
                    "key": f"health_state_{domain}",
                    "domain": domain,
                    "title": state.get("label") or domain,
                    "reason": "Stable — routine monitoring.",
                    "confidence": None,
                }
            )

    for gap in (evidence_gaps or {}).get("gaps") or []:
        if not isinstance(gap, dict) or gap.get("priority") != "high":
            continue
        buckets["lifestyle_opportunities"].append(
            {
                "key": f"evidence_gap_{gap.get('missing_marker') or gap.get('domain')}",
                "domain": gap.get("domain"),
                "title": gap.get("missing_marker") or gap.get("domain"),
                "reason": gap.get("suggested_next_step") or gap.get("reason"),
                "confidence": None,
            }
        )

    for key in buckets:
        buckets[key] = _dedupe_by_key(buckets[key], limit=8)

    return {
        "version": CLINICAL_PRIORITY_PLANNER_VERSION,
        "buckets": buckets,
        "summary": {
            "urgent_review_count": len(buckets["urgent_review"]),
            "review_soon_count": len(buckets["review_soon"]),
            "symptom_driver_count": len(buckets["symptom_drivers"]),
            "lifestyle_opportunity_count": len(buckets["lifestyle_opportunities"]),
            "monitor_only_count": len(buckets["monitor_only"]),
        },
    }


def build_clinical_story(
    *,
    interpreted_report: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
    priority_planner: Dict[str, Any] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
    retest_suggestions: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    interpreted_report = interpreted_report or {}
    summary = interpreted_report.get("summary") or {}
    evidence_summary = (evidence_gaps or {}).get("summary") or {}

    return {
        "version": CLINICAL_STORY_VERSION,
        "headline": summary.get("headline"),
        "narrative": summary.get("body"),
        "top_patterns": [
            {
                "key": pattern.get("key"),
                "domain": pattern.get("domain"),
                "title": pattern.get("title"),
                "priority": pattern.get("priority"),
                "confidence": pattern.get("confidence"),
            }
            for pattern in (interpreted_report.get("patterns") or [])[:5]
            if isinstance(pattern, dict)
        ],
        "safety_constraints": {
            "status": (safety_result or {}).get("status"),
            "risk_level": (safety_result or {}).get("risk_level"),
            "requires_doctor": bool(
                (safety_result or {}).get("requires_doctor") or (safety_result or {}).get("urgent_review_required")
            ),
        },
        "prioritized_actions": (priority_planner or {}).get("buckets") or {key: [] for key in _BUCKET_ORDER},
        "retest_plan": retest_suggestions or [],
        "uncertainty": {
            "gap_count": evidence_summary.get("gap_count", 0),
            "high_priority_gap_count": evidence_summary.get("high_priority_count", 0),
            "domains_needing_more_context": evidence_summary.get("domains") or [],
        },
        "disclaimer": summary.get("disclaimer"),
    }
