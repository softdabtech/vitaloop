"""Next-best-test engine.

2026-09-12 clinical analyzer audit, "not implemented yet" item #3: a
next-best-test engine driven by uncertainty, missing paired markers,
unit-blocked markers, and pattern gaps did not exist at all.

This is deliberately pure composition, same posture as
clinical_priority_planner.py: evidence_gaps.py already identifies exactly
these three uncertainty sources (missing domain-expected markers,
no-active-rule markers, unit-blocked markers) per gap, and each interpreted
pattern already carries its own retest_plan. Recommending "which test to add
or repeat next" from data the pipeline already has beats inventing a new,
separate uncertainty model that could silently disagree with evidence_gaps
or the pattern engine about what's actually missing.
"""

from __future__ import annotations

from typing import Any, Dict, List


NEXT_BEST_TEST_ENGINE_VERSION = "next_best_test_engine_v1"

_REASON_LABELS = {
    "domain_expected_marker": "Would clarify a health domain currently only partially covered.",
    "no_active_rule_for_marker": "Measured but not yet interpreted — no active rule evaluates it.",
    "unit_not_reconcilable": "Reported unit could not be matched to what interpretation requires; a repeat with a standard unit would resolve this.",
}


def _priority_rank(priority: Any) -> int:
    return {"high": 0, "medium": 1, "low": 2}.get(str(priority or "medium").strip().lower(), 1)


def build_next_best_tests(
    *,
    evidence_gaps: Dict[str, Any] | None = None,
    patterns: List[Dict[str, Any]] | None = None,
    limit: int = 10,
) -> Dict[str, Any]:
    candidates: List[Dict[str, Any]] = []
    seen_markers: set[str] = set()

    for gap in (evidence_gaps or {}).get("gaps") or []:
        if not isinstance(gap, dict):
            continue
        marker = str(gap.get("missing_marker") or "").strip().lower()
        if not marker or marker in seen_markers:
            continue
        seen_markers.add(marker)
        reason_key = str(gap.get("reason") or "")
        candidates.append(
            {
                "marker": marker,
                "domain": gap.get("domain"),
                "priority": gap.get("priority") or "medium",
                "reason": _REASON_LABELS.get(reason_key) or gap.get("suggested_next_step") or reason_key,
                "source": "evidence_gaps",
            }
        )

    for pattern in patterns or []:
        if not isinstance(pattern, dict):
            continue
        for retest in pattern.get("retest_plan") or []:
            if not isinstance(retest, dict):
                continue
            marker = str(retest.get("marker") or "").strip().lower()
            if not marker or marker in seen_markers:
                continue
            seen_markers.add(marker)
            candidates.append(
                {
                    "marker": marker,
                    "domain": pattern.get("domain"),
                    "priority": retest.get("priority") or pattern.get("priority") or "medium",
                    "reason": retest.get("reason") or f"Follow-up for the {pattern.get('title') or pattern.get('key')} pattern.",
                    "source": "pattern_retest_plan",
                }
            )

    candidates.sort(key=lambda item: _priority_rank(item.get("priority")))
    ranked = candidates[:limit]

    return {
        "version": NEXT_BEST_TEST_ENGINE_VERSION,
        "recommended_tests": ranked,
        "summary": {
            "count": len(ranked),
            "high_priority_count": len([item for item in ranked if item.get("priority") == "high"]),
        },
    }
