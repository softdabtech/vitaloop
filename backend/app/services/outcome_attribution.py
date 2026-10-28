"""Outcome Attribution Engine (P21, backend-first v1).

Cautiously connects a marker's meaningful change (from P19's personal
baseline velocity signals) to a self-reported intervention event (from
P20's intervention_memory) that plausibly precedes it and shares its
domain. This module NEVER claims causation — every attribution is labeled
"possible_contributor", every marker change is a "possible" association,
and every attribution carries confounders/limitations explaining exactly
why it should not be read as proof.

Deliberately downstream of, and reusing, P19/P20/P15/P16's own outputs —
no new marker-change detection (that's P19's job) and no new event
normalization (that's P20's job). This module is pure matching + cautious
scoring over data those stages already produced.

No LLM anywhere in this module. Every generated string is a fixed
template using non-causal language ("possible contributor", "may be
relevant", "temporally plausible", "does not prove causation" — never
"caused"/"cured"/"treated"/"fixed"/"reversed"/"because of"/"proves"/
"guaranteed"/"diagnosis"), per docs/TRUST_AND_CLAIMS_GUIDELINES.md.

Frozen-replay safe: pure function of already-computed personal_baseline
velocity signals, intervention_memory events, clinical_contradictions,
and evidence_gaps — a result built from a persisted input_snapshot is
identical to one built at generation time.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from app.services.trend_engine import _parse_dt


OUTCOME_ATTRIBUTION_VERSION = "p21_v1"

# Velocity statuses (personal_baseline.py's P19 section) worth attempting
# to attribute at all. volatile_marker is deliberately excluded — an
# erratic history is too noisy to responsibly connect to any one event.
# stable_near_baseline is excluded because there is no meaningful change
# to explain.
_ATTRIBUTABLE_STATUSES = {
    "improved_toward_baseline": "improved",
    "worsened_from_baseline": "worsened",
    "rapid_change": "changed",
    "normal_but_drifting": "drifted",
    "direction_consistent": "trending",
}

# What direction of change a given event_type would plausibly be aiming
# for or associated with, when the events actually available support any
# claim at all. None means "no assumed direction" — the event can still be
# a candidate contributor, but "direction_matches_expected_response" never
# applies to it, keeping confidence capped lower for those events by not
# rewarding a match that wasn't checked. Medication is deliberately absent
# — see _CANDIDATE_EVENT_TYPES below.
_EXPECTED_DIRECTION_BY_EVENT_TYPE = {
    "supplement": "improved",
    "nutrition": "improved",
    "training": "improved",
    "sleep": "improved",
    "protocol_action": "improved",
    "alcohol": "worsened",
    "illness": "worsened",
    "stress": "worsened",
}

# Event types this module will generate candidate contributors from.
# Medication is excluded in this v1: there is no established, safe
# marker-mapping for arbitrary self-reported medications (a drug's effect
# on a given marker is far more variable and clinically consequential to
# get wrong than a supplement/lifestyle change) — see the P21 spec's own
# "medication event stays context_only unless safe mapping exists" rule.
# "other" and "weight_change" are excluded for the same reason: no
# reliable assumed direction, and forcing a low-confidence guess adds
# noise without real value.
_CANDIDATE_EVENT_TYPES = {
    "supplement", "nutrition", "training", "sleep",
    "alcohol", "illness", "stress", "protocol_action",
}

_CONFIDENCE_HIGH = 0.75
_CONFIDENCE_MODERATE = 0.5
_CONFIDENCE_LOW = 0.25


def _label_from_score(score: float) -> str:
    if score >= _CONFIDENCE_HIGH:
        return "high"
    if score >= _CONFIDENCE_MODERATE:
        return "moderate"
    if score >= _CONFIDENCE_LOW:
        return "low"
    return "blocked"


def _domain_has_doctor_flag(hypotheses: List[Dict[str, Any]] | None, domain: str) -> bool:
    for hypothesis in hypotheses or []:
        if not isinstance(hypothesis, dict):
            continue
        if str(hypothesis.get("domain") or "").strip().lower() != domain:
            continue
        if hypothesis.get("doctor_only") or hypothesis.get("doctor_flag"):
            return True
    return False


def _contradictions_for_domain(contradictions: List[Dict[str, Any]] | None, domain: str) -> List[Dict[str, Any]]:
    return [
        c for c in contradictions or []
        if isinstance(c, dict) and str(c.get("domain") or "").strip().lower() == domain
    ]


def _gaps_for_domain(evidence_gaps: Dict[str, Any] | None, domain: str) -> List[Dict[str, Any]]:
    return [
        g for g in (evidence_gaps or {}).get("gaps") or []
        if isinstance(g, dict) and str(g.get("domain") or "").strip().lower() == domain
    ]


def _event_precedes(event: Dict[str, Any], window_to: datetime | None) -> bool | None:
    """True if the event's started_at is on/before window_to (the
    marker-change window's upper bound — the current report's date);
    False if strictly after (must not attribute); None if unknown
    (no started_at recorded at all)."""
    started = event.get("started_at")
    if not started:
        return None
    started_dt = _parse_dt(started)
    if started_dt is None or window_to is None:
        return None
    return started_dt <= window_to


def _candidate_events_for_domain(events: List[Dict[str, Any]], domain: str) -> List[Dict[str, Any]]:
    return [
        e for e in events
        if isinstance(e, dict)
        and str(e.get("type")) in _CANDIDATE_EVENT_TYPES
        and domain in (e.get("domains") or [])
    ]


def _build_attribution(
    *,
    marker_signal: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    window_to: datetime | None,
    contradictions: List[Dict[str, Any]],
    domain_gaps: List[Dict[str, Any]],
) -> Dict[str, Any] | None:
    domain = marker_signal.get("domain")
    outcome_status = marker_signal.get("status")
    outcome_direction = _ATTRIBUTABLE_STATUSES.get(outcome_status)
    if outcome_direction is None:
        return None

    # Sort earliest-first so the primary/first-listed contributor is the
    # one that had the most time to plausibly act.
    def _sort_key(event):
        started = _parse_dt(event.get("started_at")) if event.get("started_at") else None
        return started or datetime.min.replace(tzinfo=window_to.tzinfo if window_to else None)

    usable_candidates = []
    excluded_for_timing = 0
    for event in candidates:
        precedes = _event_precedes(event, window_to)
        if precedes is False:
            excluded_for_timing += 1
            continue
        usable_candidates.append((event, precedes))

    if not usable_candidates:
        return None

    usable_candidates.sort(key=lambda pair: _sort_key(pair[0]))

    confounders: List[str] = []
    if len(usable_candidates) > 1:
        confounders.append(
            "More than one self-reported event overlaps this domain, so it is unclear which (if any) is relevant."
        )
    if domain_gaps:
        confounders.append(
            f"{len(domain_gaps)} evidence gap(s) in this domain make the surrounding context incomplete."
        )
    if contradictions:
        confounders.append(
            "A related contradiction was found in this domain, which limits how confidently this can be interpreted."
        )
    if any(precedes is None for _, precedes in usable_candidates):
        confounders.append("The exact timing of at least one event is unknown, so precedence cannot be confirmed.")
    if marker_signal.get("confidence") == "low":
        confounders.append("The underlying marker trend itself has limited confidence (little history to compare).")

    possible_contributors = []
    for event, precedes in usable_candidates:
        score = 0.5
        reason_codes = ["marker_domain_match"]

        if precedes is True:
            score += 0.15
            reason_codes.append("intervention_precedes_change")
        elif precedes is None:
            score -= 0.1
            reason_codes.append("unclear_event_timing")

        expected_direction = _EXPECTED_DIRECTION_BY_EVENT_TYPE.get(event.get("type"))
        if expected_direction and expected_direction == outcome_direction:
            score += 0.15
            reason_codes.append("direction_matches_expected_response")

        adherence = event.get("adherence")
        if adherence == "high":
            score += 0.15
            reason_codes.append("high_adherence")
        elif adherence == "partial":
            score += 0.05
            reason_codes.append("partial_adherence")
        else:
            score -= 0.1
            reason_codes.append("unknown_adherence")

        if event.get("source") == "user":
            score -= 0.05
            reason_codes.append("self_reported_event")

        if len(usable_candidates) > 1:
            score -= 0.15
            reason_codes.append("multiple_concurrent_interventions")
        if contradictions:
            score -= 0.15
            reason_codes.append("contradiction_in_domain")
        if domain_gaps:
            score -= 0.1
            reason_codes.append("evidence_gap_in_domain")

        score = max(0.0, min(1.0, score))
        confidence = _label_from_score(score)

        possible_contributors.append(
            {
                "event_id": event.get("id"),
                "label": event.get("label"),
                "event_type": event.get("type"),
                "source": event.get("source"),
                "relationship": "temporally_plausible" if precedes else "context_only",
                "confidence": confidence,
                "reason_codes": reason_codes,
            }
        )

    if not possible_contributors:
        return None

    top = possible_contributors[0]
    return {
        "id": f"{marker_signal.get('marker')}_{outcome_status}",
        "domain": domain,
        "outcome_marker": marker_signal.get("marker"),
        "outcome_direction": outcome_direction,
        "outcome_summary": marker_signal.get("reason") or "This marker showed a trend signal worth noting.",
        "possible_contributors": possible_contributors,
        "confounders": confounders,
        "limitations": [
            "Self-reported intervention data may be incomplete.",
            "This does not prove the intervention caused the change.",
        ],
        "confidence": top["confidence"],
        "claim_strength": "possible_contributor",
        "reason_codes": top["reason_codes"],
    }


def build_outcome_attribution(
    *,
    velocity_signals: List[Dict[str, Any]] | None,
    intervention_memory: Dict[str, Any] | None,
    clinical_contradictions: List[Dict[str, Any]] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
    clinical_hypotheses: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    signals = [s for s in (velocity_signals or []) if isinstance(s, dict)]
    events = [
        e for e in (
            (intervention_memory or {}).get("active_interventions") or []
        ) + ((intervention_memory or {}).get("completed_interventions") or [])
        if isinstance(e, dict)
    ]
    events_considered = (intervention_memory or {}).get("events_considered") or 0
    window_to = None
    window = (intervention_memory or {}).get("window") or {}
    if window.get("to"):
        window_to = _parse_dt(window["to"])

    if not events:
        return {
            "version": OUTCOME_ATTRIBUTION_VERSION,
            "attributions": [],
            "summary": {
                "markers_reviewed": len(signals),
                "events_considered": 0,
                "attribution_count": 0,
                "confounded_count": 0,
                "no_event_context_count": len(
                    [s for s in signals if s.get("status") in _ATTRIBUTABLE_STATUSES]
                ),
            },
            "global_limitations": ["No intervention events were available for outcome attribution."],
        }

    attributions: List[Dict[str, Any]] = []
    no_event_context_count = 0

    for signal in signals:
        if signal.get("status") not in _ATTRIBUTABLE_STATUSES:
            continue
        domain = str(signal.get("domain") or "").strip().lower()
        if not domain:
            continue
        if _domain_has_doctor_flag(clinical_hypotheses, domain):
            # Already flagged for a doctor elsewhere — restating a
            # "possible contributor" note here would undercut that,
            # matching negative_evidence.py's own exclusion posture.
            continue

        candidates = _candidate_events_for_domain(events, domain)
        if not candidates:
            no_event_context_count += 1
            continue

        try:
            attribution = _build_attribution(
                marker_signal=signal,
                candidates=candidates,
                window_to=window_to,
                contradictions=_contradictions_for_domain(clinical_contradictions, domain),
                domain_gaps=_gaps_for_domain(evidence_gaps, domain),
            )
        except Exception:
            attribution = None

        if attribution:
            attributions.append(attribution)
        else:
            no_event_context_count += 1

    confounded_count = len([a for a in attributions if a.get("confounders")])

    return {
        "version": OUTCOME_ATTRIBUTION_VERSION,
        "attributions": attributions,
        "summary": {
            "markers_reviewed": len(signals),
            "events_considered": events_considered,
            "attribution_count": len(attributions),
            "confounded_count": confounded_count,
            "no_event_context_count": no_event_context_count,
        },
        "global_limitations": ["Outcome attribution is contextual and does not prove causation."],
    }
