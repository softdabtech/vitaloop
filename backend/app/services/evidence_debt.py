"""Evidence Debt Score (P22, backend-first v1).

Answers "how completely can the system reason about this upload's
available data" — NOT "how healthy is this person". A high evidence debt
score means important context is missing (required markers, resolved
contradictions, confirmatory tests), not that anything is wrong
medically. This module aggregates P3/P12/P14-P17/P19-P21's own outputs
into one explainable completeness/uncertainty summary; it never detects
a new clinical signal and never computes a health score.

No LLM anywhere in this module. Every generated string uses data-
completeness language ("would improve interpretation", "cannot assess
confidently", "data completeness") — never diagnosis-adjacent or health-
grading language ("you have", "disease", "ruled out", "healthy/unhealthy
score"), per docs/TRUST_AND_CLAIMS_GUIDELINES.md.

Frozen-replay safe: pure function of already-computed evidence_gaps,
clinical_contradictions, clinical_hypotheses (calibrated),
negative_evidence, next_test_funnel, personal_baseline.velocity,
intervention_memory, and outcome_attribution — a score built from a
persisted input_snapshot is identical to one built at generation time.
"""

from __future__ import annotations

from typing import Any, Dict, List

from app.services.negative_evidence import _human_name


EVIDENCE_DEBT_VERSION = "p22_v1"

_SCORE_FLOOR = 0.0
_SCORE_CEILING = 1.0
_BASELINE_SCORE = 0.3  # some irreducible uncertainty always exists

_LOW_THRESHOLD = 0.25
_MODERATE_THRESHOLD = 0.55
_HIGH_THRESHOLD = 0.85

_MEANINGFUL_VELOCITY_STATUSES = {
    "improved_toward_baseline", "worsened_from_baseline", "rapid_change",
    "normal_but_drifting", "direction_consistent",
}

_LOW_CONFIDENCE_LABELS = {"low", "blocked"}


def _label_from_score(score: float) -> str:
    if score <= _LOW_THRESHOLD:
        return "low"
    if score <= _MODERATE_THRESHOLD:
        return "moderate"
    if score <= _HIGH_THRESHOLD:
        return "high"
    return "blocked"


def _domain_of(item: Dict[str, Any]) -> str:
    return str(item.get("domain") or "").strip().lower()


def _collect_domains(
    evidence_gaps: Dict[str, Any] | None,
    contradictions: List[Dict[str, Any]] | None,
    hypotheses: List[Dict[str, Any]] | None,
    negative_evidence: Dict[str, Any] | None,
    velocity_signals: List[Dict[str, Any]] | None,
) -> List[str]:
    domains: set[str] = set()
    for gap in (evidence_gaps or {}).get("gaps") or []:
        if isinstance(gap, dict):
            d = _domain_of(gap)
            if d:
                domains.add(d)
    for c in contradictions or []:
        if isinstance(c, dict):
            d = _domain_of(c)
            if d:
                domains.add(d)
    for h in hypotheses or []:
        if isinstance(h, dict):
            d = _domain_of(h)
            if d:
                domains.add(d)
    for bucket in ("stable_domains", "under_tested_domains"):
        for entry in (negative_evidence or {}).get(bucket) or []:
            if isinstance(entry, dict):
                d = _domain_of(entry)
                if d:
                    domains.add(d)
    for s in velocity_signals or []:
        if isinstance(s, dict):
            d = _domain_of(s)
            if d:
                domains.add(d)
    return sorted(domains)


def _negative_evidence_entry(negative_evidence: Dict[str, Any] | None, domain: str) -> tuple[str | None, Dict[str, Any] | None]:
    """Returns (bucket_name, entry) — bucket_name is "stable" or
    "under_tested", or (None, None) if this domain has no negative_evidence
    entry at all (e.g. it already has an active pattern/hypothesis, which
    negative_evidence.py deliberately excludes)."""
    for entry in (negative_evidence or {}).get("stable_domains") or []:
        if isinstance(entry, dict) and _domain_of(entry) == domain:
            return "stable", entry
    for entry in (negative_evidence or {}).get("under_tested_domains") or []:
        if isinstance(entry, dict) and _domain_of(entry) == domain:
            return "under_tested", entry
    return None, None


def _assess_domain(
    domain: str,
    *,
    evidence_gaps: Dict[str, Any] | None,
    contradictions: List[Dict[str, Any]] | None,
    hypotheses: List[Dict[str, Any]] | None,
    negative_evidence: Dict[str, Any] | None,
    velocity_signals: List[Dict[str, Any]] | None,
    intervention_memory: Dict[str, Any] | None,
    outcome_attribution: Dict[str, Any] | None,
    next_test_funnel: Dict[str, Any] | None,
) -> Dict[str, Any]:
    domain_gaps = [g for g in (evidence_gaps or {}).get("gaps") or [] if isinstance(g, dict) and _domain_of(g) == domain]
    domain_contradictions = [c for c in contradictions or [] if isinstance(c, dict) and _domain_of(c) == domain]
    domain_hypotheses = [h for h in hypotheses or [] if isinstance(h, dict) and _domain_of(h) == domain]
    domain_velocity = [s for s in velocity_signals or [] if isinstance(s, dict) and _domain_of(s) == domain]
    ne_bucket, ne_entry = _negative_evidence_entry(negative_evidence, domain)
    domain_intervention_events = [
        e for e in (
            (intervention_memory or {}).get("active_interventions") or []
        ) + ((intervention_memory or {}).get("completed_interventions") or [])
        if isinstance(e, dict) and domain in (e.get("domains") or [])
    ]
    domain_attributions = [
        a for a in (outcome_attribution or {}).get("attributions") or []
        if isinstance(a, dict) and _domain_of(a) == domain
    ]

    score = _BASELINE_SCORE
    reason_codes: List[str] = []

    high_priority_gaps = [g for g in domain_gaps if g.get("priority") == "high"]
    if high_priority_gaps:
        score += min(0.3, 0.15 * len(high_priority_gaps))
        reason_codes.append("missing_required_markers")
    elif domain_gaps:
        score += 0.1
        reason_codes.append("missing_context")

    if domain_contradictions:
        score += min(0.2, 0.1 * len(domain_contradictions))
        reason_codes.append("unresolved_contradiction")

    low_confidence_hypotheses = [
        h for h in domain_hypotheses
        if (h.get("calibrated_confidence") or h.get("likelihood_bucket")) in _LOW_CONFIDENCE_LABELS
    ]
    high_confidence_hypotheses = [
        h for h in domain_hypotheses
        if (h.get("calibrated_confidence") or h.get("likelihood_bucket")) in {"high", "likely"}
    ]
    doctor_only_hypotheses = [h for h in domain_hypotheses if h.get("doctor_only") or h.get("doctor_flag")]

    if low_confidence_hypotheses:
        score += 0.15
        reason_codes.append("low_calibrated_confidence")
    if high_confidence_hypotheses:
        score -= 0.15
        reason_codes.append("high_calibrated_confidence")
    if doctor_only_hypotheses:
        score += 0.1
        reason_codes.append("requires_external_clinical_review")

    if ne_bucket == "under_tested":
        score += 0.1
        reason_codes.append("under_tested_domain")
    elif ne_bucket == "stable" and ne_entry and ne_entry.get("coverage") == "sufficient":
        score -= 0.1
        reason_codes.append("sufficient_stable_coverage")

    meaningful_velocity = [s for s in domain_velocity if s.get("status") in _MEANINGFUL_VELOCITY_STATUSES]
    if meaningful_velocity and not domain_intervention_events:
        score += 0.1
        reason_codes.append("missing_intervention_context")
    elif meaningful_velocity and any(s.get("confidence") == "moderate" for s in meaningful_velocity):
        score -= 0.05
        reason_codes.append("personal_baseline_consistency")

    if any(a.get("confounders") for a in domain_attributions):
        score += 0.05
        reason_codes.append("outcome_attribution_confounded")

    # next_test_funnel.py's `panel` is keyed by domain directly (see
    # build_next_test_funnel) — not a flat list with a `domain` field.
    domain_next_tests = ((next_test_funnel or {}).get("panel") or {}).get(domain) or []
    if domain_gaps and domain_next_tests:
        score -= 0.05
        reason_codes.append("clear_next_test_plan_available")

    score = max(_SCORE_FLOOR, min(_SCORE_CEILING, score))

    coverage_none = ne_entry is not None and ne_entry.get("coverage") == "none"
    debt_level = "blocked" if (coverage_none or score > _HIGH_THRESHOLD) else _label_from_score(score)

    missing_markers = sorted({
        _human_name(str(g.get("missing_marker")))
        for g in domain_gaps if g.get("missing_marker")
    })
    missing_context = sorted({
        str(g.get("reason")) for g in domain_gaps if not g.get("missing_marker") and g.get("reason")
    })

    top_debt_reducers = [
        {
            "type": "lab_test",
            "label": _human_name(str(g.get("missing_marker"))),
            "priority": g.get("priority") or "medium",
            "reason": f"Would improve {domain.replace('_', ' ')} interpretation confidence.",
        }
        for g in domain_gaps if g.get("missing_marker")
    ]

    return {
        "domain": domain,
        "debt_level": debt_level,
        "debt_score": round(score, 3),
        "reason_codes": reason_codes,
        "missing_markers": missing_markers,
        "missing_context": missing_context,
        "contradictions": [c.get("message") for c in domain_contradictions if c.get("message")],
        "top_debt_reducers": top_debt_reducers[:5],
    }


def _rank_top_debt_reducers(domain_debt: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicates missing-marker reducers by label across domains, then
    ranks by: how many domains it would help (descending), whether any of
    those domains is high/blocked debt, then alphabetically for stable
    output. A full "ranked by contradiction-resolution /
    doctor-practitioner-bucket" scheme per the P22 spec's wishlist is a
    reasonable v2 refinement — this v1 keeps the ranking to signals this
    module already computes directly, documented here rather than
    silently approximated."""
    by_label: Dict[str, Dict[str, Any]] = {}
    for domain_entry in domain_debt:
        domain = domain_entry["domain"]
        is_high_debt = domain_entry["debt_level"] in {"high", "blocked"}
        for reducer in domain_entry.get("top_debt_reducers") or []:
            label = reducer["label"]
            existing = by_label.get(label)
            if existing is None:
                by_label[label] = {
                    "type": reducer["type"],
                    "label": label,
                    "domains": {domain},
                    "priority": reducer["priority"],
                    "reason": reducer["reason"],
                    "high_debt": is_high_debt,
                }
            else:
                existing["domains"].add(domain)
                existing["high_debt"] = existing["high_debt"] or is_high_debt
                if len(existing["domains"]) > 1:
                    existing["reason"] = (
                        f"Would clarify whether this is affecting interpretation in multiple domains "
                        f"({', '.join(sorted(existing['domains']))})."
                    )

    ranked = sorted(
        by_label.values(),
        key=lambda item: (-len(item["domains"]), 0 if item["high_debt"] else 1, item["label"]),
    )
    return [
        {
            "type": item["type"],
            "label": item["label"],
            "domain": sorted(item["domains"])[0] if len(item["domains"]) == 1 else None,
            "priority": item["priority"],
            "reason": item["reason"],
        }
        for item in ranked
    ]


def build_evidence_debt(
    *,
    evidence_gaps: Dict[str, Any] | None = None,
    clinical_contradictions: List[Dict[str, Any]] | None = None,
    clinical_hypotheses: List[Dict[str, Any]] | None = None,
    negative_evidence: Dict[str, Any] | None = None,
    velocity_signals: List[Dict[str, Any]] | None = None,
    intervention_memory: Dict[str, Any] | None = None,
    outcome_attribution: Dict[str, Any] | None = None,
    next_test_funnel: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    domains = _collect_domains(
        evidence_gaps, clinical_contradictions, clinical_hypotheses, negative_evidence, velocity_signals
    )

    if not domains:
        return {
            "version": EVIDENCE_DEBT_VERSION,
            "overall_debt": "blocked",
            "overall_score": 0.9,
            "summary": {
                "high_confidence_findings": 0,
                "moderate_confidence_hypotheses": 0,
                "low_confidence_or_blocked_items": 0,
                "under_tested_domains": 0,
                "contradiction_count": 0,
                "missing_context_count": 0,
                "top_debt_reducers_count": 0,
            },
            "domain_debt": [],
            "top_debt_reducers": [],
            "limitations": [
                "Evidence debt reflects data completeness, not health status.",
                "Too little data was available in this upload to assess any domain.",
            ],
        }

    domain_debt: List[Dict[str, Any]] = []
    for domain in domains:
        try:
            entry = _assess_domain(
                domain,
                evidence_gaps=evidence_gaps,
                contradictions=clinical_contradictions,
                hypotheses=clinical_hypotheses,
                negative_evidence=negative_evidence,
                velocity_signals=velocity_signals,
                intervention_memory=intervention_memory,
                outcome_attribution=outcome_attribution,
                next_test_funnel=next_test_funnel,
            )
        except Exception:
            entry = None
        if entry:
            domain_debt.append(entry)

    overall_score = round(sum(d["debt_score"] for d in domain_debt) / len(domain_debt), 3) if domain_debt else 0.9
    overall_debt = "blocked" if any(d["debt_level"] == "blocked" for d in domain_debt) and overall_score > _HIGH_THRESHOLD else _label_from_score(overall_score)

    top_debt_reducers = _rank_top_debt_reducers(domain_debt)

    valid_hypotheses = [h for h in clinical_hypotheses or [] if isinstance(h, dict)]
    high_confidence_findings = len([
        h for h in valid_hypotheses
        if (h.get("calibrated_confidence") or h.get("likelihood_bucket")) in {"high", "likely"}
    ])
    moderate_confidence_hypotheses = len([
        h for h in valid_hypotheses
        if (h.get("calibrated_confidence") or h.get("likelihood_bucket")) in {"moderate", "possible"}
    ])
    low_confidence_or_blocked_items = len([
        h for h in valid_hypotheses
        if (h.get("calibrated_confidence") or h.get("likelihood_bucket")) in _LOW_CONFIDENCE_LABELS
    ])

    return {
        "version": EVIDENCE_DEBT_VERSION,
        "overall_debt": overall_debt,
        "overall_score": overall_score,
        "summary": {
            "high_confidence_findings": high_confidence_findings,
            "moderate_confidence_hypotheses": moderate_confidence_hypotheses,
            "low_confidence_or_blocked_items": low_confidence_or_blocked_items,
            "under_tested_domains": len((negative_evidence or {}).get("under_tested_domains") or []),
            "contradiction_count": len(clinical_contradictions or []),
            "missing_context_count": len((evidence_gaps or {}).get("gaps") or []),
            "top_debt_reducers_count": len(top_debt_reducers),
        },
        "domain_debt": domain_debt,
        "top_debt_reducers": top_debt_reducers[:10],
        "limitations": ["Evidence debt reflects data completeness, not health status."],
    }
