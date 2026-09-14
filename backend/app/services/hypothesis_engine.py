"""Clinical Hypothesis Engine (P14, backend-only v1).

Turns the patterns report_interpretation.py already detected into a ranked
list of clinical hypotheses: what's most likely, what's merely possible, what
evidence weakens each one, what's missing, and what would help confirm or
rule it out next.

Deliberately NOT a new clinical-detection layer — a pattern from
report_interpretation.py is already a candidate explanation for a cluster of
markers (it has confidence, contradicting_markers, missing_context,
triggered/supportive markers). This module's only job is to turn that
per-pattern data into a *ranked, comparative* view across all of a report's
patterns, using one deterministic formula, and to phrase it with fixed
templates — no LLM call anywhere in this module (an LLM wording pass, if ever
added, would sit strictly downstream of this contract and could only reword
existing fields, never change likelihood_bucket/rank/confidence_score).

Deterministic scoring only, so a hypothesis list built from a frozen/replayed
input_snapshot (patterns + evidence_gaps + next_best_tests + safety_result,
all already persisted) is byte-identical to one built at generation time, as
long as those inputs are unchanged — same posture as
clinical_reasoning_trace.py.
"""

from __future__ import annotations

from typing import Any, Dict, List


HYPOTHESIS_ENGINE_VERSION = "hypothesis_engine_v1"

# Per-item confidence penalties, capped so a pattern with many contradictions/
# gaps still bottoms out at a floor rather than going negative or to zero
# outright — a heavily-contradicted hypothesis should read as "unlikely but
# flagged", not disappear or read as a mathematical negative.
_CONTRADICTION_PENALTY = 0.08
_MAX_CONTRADICTION_PENALTY = 0.32
_MISSING_CONTEXT_PENALTY = 0.04
_MAX_MISSING_CONTEXT_PENALTY = 0.16
_MISSING_EVIDENCE_PENALTY = 0.03
_MAX_MISSING_EVIDENCE_PENALTY = 0.15
_CONFIDENCE_FLOOR = 0.05

_LIKELY_THRESHOLD = 0.65
_POSSIBLE_THRESHOLD = 0.4

_PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


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


def _base_confidence(pattern: Dict[str, Any]) -> float:
    confidence = pattern.get("confidence")
    if isinstance(confidence, (int, float)):
        return max(0.0, min(1.0, float(confidence)))
    return 0.5


def _score_hypothesis(
    pattern: Dict[str, Any],
    *,
    domain_gaps: List[Dict[str, Any]],
) -> tuple[float, Dict[str, float]]:
    """Returns (adjusted_confidence, breakdown) — the breakdown is exposed on
    the hypothesis so a caller (or a reviewer) can see exactly why a
    hypothesis was downgraded, rather than trusting an opaque number."""
    base = _base_confidence(pattern)

    contradicting = pattern.get("contradicting_markers") or []
    contradiction_penalty = min(
        _MAX_CONTRADICTION_PENALTY, _CONTRADICTION_PENALTY * len(contradicting)
    )

    missing_context = pattern.get("missing_context") or []
    missing_context_penalty = min(
        _MAX_MISSING_CONTEXT_PENALTY, _MISSING_CONTEXT_PENALTY * len(missing_context)
    )

    missing_evidence_penalty = min(
        _MAX_MISSING_EVIDENCE_PENALTY, _MISSING_EVIDENCE_PENALTY * len(domain_gaps)
    )

    adjusted = base - contradiction_penalty - missing_context_penalty - missing_evidence_penalty
    adjusted = max(_CONFIDENCE_FLOOR, min(1.0, adjusted))

    return adjusted, {
        "base_confidence": round(base, 3),
        "contradiction_penalty": round(contradiction_penalty, 3),
        "missing_context_penalty": round(missing_context_penalty, 3),
        "missing_evidence_penalty": round(missing_evidence_penalty, 3),
    }


def _likelihood_bucket(adjusted_confidence: float, *, has_contradictions: bool) -> str:
    if adjusted_confidence >= _LIKELY_THRESHOLD and not has_contradictions:
        return "likely"
    if adjusted_confidence >= _POSSIBLE_THRESHOLD:
        return "possible"
    return "unlikely_but_flagged"


def _reasoning_statement(
    pattern: Dict[str, Any],
    *,
    bucket: str,
    domain_gaps: List[Dict[str, Any]],
) -> str:
    """Fixed-template phrasing — deterministic, no LLM. A future wording pass
    may reword this for tone, but must not change the underlying facts it is
    built from (name, bucket, counts)."""
    name = pattern.get("pattern_name") or pattern.get("title") or "This pattern"
    contradicting = pattern.get("contradicting_markers") or []
    missing_context = pattern.get("missing_context") or []

    if bucket == "likely":
        statement = f"{name} is the most likely explanation given the markers reviewed."
    elif bucket == "possible":
        statement = f"{name} is possible but not yet the strongest explanation."
    else:
        statement = f"{name} is flagged as unlikely given the current evidence, but is kept visible rather than dropped."

    if contradicting:
        statement += f" {len(contradicting)} marker(s) argue against it."
    if missing_context:
        statement += f" {len(missing_context)} piece(s) of context are still missing."
    if domain_gaps:
        statement += f" {len(domain_gaps)} related gap(s) in this domain would sharpen this further."
    return statement


def _build_hypothesis(
    pattern: Dict[str, Any],
    *,
    evidence_gaps: Dict[str, Any] | None,
    next_best_tests: Dict[str, Any] | None,
) -> Dict[str, Any]:
    domain = _domain_of(pattern)
    domain_gaps = _gaps_for_domain(evidence_gaps, domain)
    domain_tests = _next_best_tests_for_domain(next_best_tests, domain)

    adjusted_confidence, breakdown = _score_hypothesis(pattern, domain_gaps=domain_gaps)
    contradicting = pattern.get("contradicting_markers") or []
    bucket = _likelihood_bucket(adjusted_confidence, has_contradictions=bool(contradicting))

    return {
        "hypothesis_id": pattern.get("pattern_id") or pattern.get("key"),
        "label": pattern.get("pattern_name") or pattern.get("title"),
        "domain": domain,
        "likelihood_bucket": bucket,
        "confidence_score": round(adjusted_confidence, 3),
        "confidence_breakdown": breakdown,
        "supporting_evidence": (
            (pattern.get("triggered_biomarkers") or [])
            + (pattern.get("supportive_markers") or [])
        ),
        "weakening_evidence": {
            "contradicting_markers": contradicting,
            "missing_context": pattern.get("missing_context") or [],
        },
        "evidence_gaps": domain_gaps,
        "what_would_confirm_or_rule_out": domain_tests,
        "reasoning_statement": _reasoning_statement(pattern, bucket=bucket, domain_gaps=domain_gaps),
        "severity": pattern.get("severity"),
        "priority": pattern.get("priority"),
        "doctor_flag": bool((pattern.get("doctor_escalation") or {}).get("triggered")),
    }


def build_clinical_hypotheses(
    patterns: List[Dict[str, Any]] | None,
    *,
    evidence_gaps: Dict[str, Any] | None = None,
    next_best_tests: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """One ranked hypothesis per detected pattern. Empty patterns list ->
    explicit empty state, never a fabricated hypothesis."""
    valid_patterns = [p for p in (patterns or []) if isinstance(p, dict)]

    if not valid_patterns:
        return {
            "version": HYPOTHESIS_ENGINE_VERSION,
            "hypotheses": [],
            "summary": {
                "count": 0,
                "likely_count": 0,
                "possible_count": 0,
                "unlikely_but_flagged_count": 0,
                "top_hypothesis_id": None,
            },
            "empty_reason": "no_patterns_detected",
        }

    hypotheses = [
        _build_hypothesis(pattern, evidence_gaps=evidence_gaps, next_best_tests=next_best_tests)
        for pattern in valid_patterns
    ]

    # Deterministic ranking: adjusted confidence first (descending), then
    # pattern priority as a tiebreaker, then hypothesis_id for full stability
    # across runs with identical inputs (never rely on dict/insertion order
    # alone once two hypotheses tie on both confidence and priority).
    hypotheses.sort(
        key=lambda h: (
            -h["confidence_score"],
            _PRIORITY_RANK.get(h.get("priority"), 1),
            str(h.get("hypothesis_id") or ""),
        )
    )
    for rank, hypothesis in enumerate(hypotheses, start=1):
        hypothesis["rank"] = rank

    bucket_counts = {"likely": 0, "possible": 0, "unlikely_but_flagged": 0}
    for hypothesis in hypotheses:
        bucket = hypothesis["likelihood_bucket"]
        bucket_counts[bucket] = bucket_counts.get(bucket, 0) + 1

    return {
        "version": HYPOTHESIS_ENGINE_VERSION,
        "hypotheses": hypotheses,
        "summary": {
            "count": len(hypotheses),
            "likely_count": bucket_counts["likely"],
            "possible_count": bucket_counts["possible"],
            "unlikely_but_flagged_count": bucket_counts["unlikely_but_flagged"],
            "top_hypothesis_id": hypotheses[0]["hypothesis_id"] if hypotheses else None,
        },
    }
