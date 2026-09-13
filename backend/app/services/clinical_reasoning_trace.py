"""Clinical Reasoning Trace — contract + assembler (P1.0).

2026-09-13: per Codex's field-map recheck, the pieces of a reasoning trace
(pattern, evidence_gaps, next_best_tests, safety_result) already exist but
are computed at different granularities — patterns are per-pattern,
evidence_gaps/next_best_tests are effectively per-domain/global, and safety
is per-report. This module is the linking layer: it does not invent new
clinical logic, it reads what report_interpretation.py / evidence_gaps.py /
next_best_test_engine.py / clinical_priority_planner.py already produced and
assembles ONE object per detected pattern, matched by `domain` (every
detector already tags its pattern with a domain that lines up with
evidence_gaps.py's _DOMAIN_REQUIRED_MARKERS keys and with
next_best_test_engine's pattern-sourced candidates).

`contradicting_markers` and `practitioner_explanation` are populated when a
pattern detector supplies them (see report_interpretation.py::_build_pattern)
and are otherwise left as an empty list / None — deliberately nullable so
this contract does not block on content that hasn't been written for every
domain yet (P1.1+ fills these in domain by domain, starting with iron/anemia).
"""

from __future__ import annotations

from typing import Any, Dict, List


CLINICAL_REASONING_TRACE_VERSION = "clinical_reasoning_trace_v1"


def _domain_of(pattern: Dict[str, Any]) -> str:
    return str(pattern.get("domain") or "").strip().lower()


def _gaps_for_domain(evidence_gaps: Dict[str, Any] | None, domain: str) -> List[Dict[str, Any]]:
    gaps = (evidence_gaps or {}).get("gaps") or []
    return [
        gap for gap in gaps
        if isinstance(gap, dict) and str(gap.get("domain") or "").strip().lower() == domain
    ]


def _next_best_tests_for_domain(next_best_tests: Dict[str, Any] | None, domain: str) -> List[Dict[str, Any]]:
    tests = (next_best_tests or {}).get("recommended_tests") or []
    return [
        item for item in tests
        if isinstance(item, dict) and str(item.get("domain") or "").strip().lower() == domain
    ]


def _safety_level_for_pattern(pattern: Dict[str, Any], safety_result: Dict[str, Any] | None) -> str:
    """Normalize pattern-level priority + report-level safety into one
    per-pattern safety_level, instead of leaving callers to reconcile two
    different vocabularies (pattern.priority: high/medium/low vs
    safety_result.risk_level: immediate/high/routine) themselves.
    """
    if (pattern.get("doctor_escalation") or {}).get("triggered"):
        return "doctor_only"
    report_risk = str((safety_result or {}).get("risk_level") or "").strip().lower()
    if report_risk == "immediate":
        return "blocked_by_missing_data" if pattern.get("status") == "context_required" and not pattern.get("triggered_biomarkers") else "high_confidence_urgent"
    priority = str(pattern.get("priority") or "medium").strip().lower()
    if priority == "high":
        return "high_confidence_urgent"
    if pattern.get("missing_context"):
        confidence = pattern.get("confidence")
        if isinstance(confidence, (int, float)) and confidence < 0.5:
            return "low_confidence"
    if priority == "medium":
        return "moderate_confidence"
    return "low_confidence"


def _doctor_flag(pattern: Dict[str, Any], safety_result: Dict[str, Any] | None) -> bool:
    if (pattern.get("doctor_escalation") or {}).get("triggered"):
        return True
    return bool(
        (safety_result or {}).get("doctor_discussion_required")
        or (safety_result or {}).get("urgent_review_required")
    )


def build_clinical_reasoning_trace(
    pattern: Dict[str, Any],
    *,
    evidence_gaps: Dict[str, Any] | None = None,
    next_best_tests: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Assemble one clinical_reasoning_trace object for a single detected pattern."""
    domain = _domain_of(pattern)
    return {
        "version": CLINICAL_REASONING_TRACE_VERSION,
        "pattern_id": pattern.get("pattern_id") or pattern.get("key"),
        "pattern_name": pattern.get("pattern_name") or pattern.get("title"),
        "domain": domain,
        "matched_symptoms": pattern.get("symptom_signal") or [],
        "matched_biomarkers": pattern.get("triggered_biomarkers") or [],
        "supporting_markers": pattern.get("supportive_markers") or pattern.get("normal_context") or [],
        "contradicting_markers": pattern.get("contradicting_markers") or [],
        "confidence": pattern.get("confidence"),
        "confidence_reason": pattern.get("confidence_reason") or [],
        "severity": pattern.get("severity"),
        "evidence_gaps": _gaps_for_domain(evidence_gaps, domain),
        "next_best_tests": _next_best_tests_for_domain(next_best_tests, domain),
        "safety_level": _safety_level_for_pattern(pattern, safety_result),
        "doctor_flag": _doctor_flag(pattern, safety_result),
        "doctor_escalation": pattern.get("doctor_escalation") or {"triggered": False, "reasons": []},
        "user_explanation": {
            "headline": pattern.get("title"),
            "summary": pattern.get("summary"),
            "what_this_means": pattern.get("what_this_means") or [],
            "what_this_does_not_confirm": pattern.get("what_this_does_not_confirm") or [],
        },
        "practitioner_explanation": pattern.get("practitioner_explanation"),
    }


def build_clinical_reasoning_traces(
    patterns: List[Dict[str, Any]] | None,
    *,
    evidence_gaps: Dict[str, Any] | None = None,
    next_best_tests: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
) -> List[Dict[str, Any]]:
    """One trace per detected pattern, in the same order as `patterns`.

    Pure assembly over data the pipeline already computed — safe to call on
    a frozen/replayed snapshot (patterns, evidence_gaps, next_best_tests,
    safety_result are all already-persisted values at that point, not
    recomputed), so a trace built from a replay is identical to one built at
    generation time as long as those inputs are unchanged.
    """
    return [
        build_clinical_reasoning_trace(
            pattern,
            evidence_gaps=evidence_gaps,
            next_best_tests=next_best_tests,
            safety_result=safety_result,
        )
        for pattern in (patterns or [])
        if isinstance(pattern, dict)
    ]
