"""Doctor Escalation Precision 2.0 (P25, backend-first v1).

A structured explanation layer, not a new detection layer. Every "this
needs a doctor" / "this is urgent" signal in VITALOOP today already comes
from exactly two places:

- clinical_reasoning_trace.py's per-pattern `safety_level` /`doctor_flag`
  (itself already a merge of report_interpretation.py's per-pattern
  doctor_escalation rules and safety/safety_engine.py's report-level
  risk_level/doctor_discussion_required/urgent_review_required), and
- safety_result itself, for a report-level safety signal that has no
  matching detected pattern (clinical_priority_planner.py already has its
  own fallback for exactly this gap).

This module does not invent a third source, does not add new marker
thresholds, and does not re-score anything. Its only job is to:
1. translate those already-existing flags into structured, per-domain
   escalation objects with fixed reason codes instead of leaving every
   caller to re-derive "why" from scattered booleans,
2. attach read-only context from clinical_contradictions, evidence_gaps,
   evidence_debt, and calibrated confidence -- explaining what LIMITS
   confidence in that domain, never creating a NEW escalation on their
   own,
3. attach which population profile(s) (P24) apply to that domain as pure
   context, and
4. never let anything (including a population profile) downgrade a level
   that clinical_reasoning_traces/safety_result already established.

Level/timing rules (deliberately conservative -- see module-level
constants below for the exact mapping):
- "urgent" only from an existing safety_level=="high_confidence_urgent"
  trace or safety_result.urgent_review_required.
- "doctor" only from an existing doctor_flag/safety_level=="doctor_only"
  trace or safety_result.doctor_discussion_required (and not urgent).
- "practitioner" only from an existing safety_level=="moderate_confidence"
  trace, or a trace carrying its own evidence_gaps/next_best_tests --
  i.e. exactly the same per-trace facts action_plan_by_role.py already
  uses to route into its own "practitioner" bucket.
- Low/blocked calibrated confidence, evidence gaps, evidence debt, and
  contradictions only ever ADD a reason code / context note to an
  escalation that already exists for other reasons -- they never create
  one by themselves ("no escalation from lab markers alone").
- negative_evidence is accepted as an input for completeness (and to
  prove it stays inert) but is never read to build an escalation:
  negative_evidence.py's own domain selection already excludes any domain
  with an active pattern/hypothesis, so a domain flagged there can never
  simultaneously be a source of an escalation here.

Language discipline (docs/TRUST_AND_CLAIMS_GUIDELINES.md): every generated
string uses "should be discussed" / "may need review" / "can limit
interpretation" phrasing. Never "you have", "diagnosed", "treat", "cure",
"guarantee".

Frozen-replay safe by construction: pure function of already-computed,
already frozen-verbatim inputs. Its own output -- `doctor_escalation_
precision` -- is persisted into input_snapshot and returned by
report_history.py verbatim on every later read, exactly like
population_profile_overlays/evidence_debt. Never recomputed for a
historical report.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


DOCTOR_ESCALATION_PRECISION_VERSION = "p25_v1"

_LEVEL_RANK = {"urgent": 3, "doctor": 2, "practitioner": 1, "self": 0}
_LOW_CONFIDENCE = {"low", "blocked"}
_HIGH_DEBT_LEVELS = {"high", "blocked"}


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _domain_of(item: Dict[str, Any]) -> str:
    return str(item.get("domain") or "").strip().lower()


def _marker_names(markers: Any) -> List[str]:
    names: List[str] = []
    for marker in _safe_list(markers):
        if isinstance(marker, dict) and marker.get("name") and marker["name"] not in names:
            names.append(marker["name"])
        elif isinstance(marker, str) and marker not in names:
            names.append(marker)
    return names


def _candidates_from_traces(clinical_reasoning_traces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    for trace in clinical_reasoning_traces:
        if not isinstance(trace, dict):
            continue
        domain = _domain_of(trace)
        if not domain:
            continue
        safety_level = str(trace.get("safety_level") or "").strip()
        doctor_flag = bool(trace.get("doctor_flag"))

        if safety_level == "high_confidence_urgent":
            level = "urgent"
        elif doctor_flag or safety_level == "doctor_only":
            level = "doctor"
        elif safety_level == "moderate_confidence" or trace.get("evidence_gaps") or trace.get("next_best_tests"):
            level = "practitioner"
        else:
            continue

        candidates.append(
            {
                "domain": domain,
                "level": level,
                "source": "clinical_reasoning_traces",
                "pattern_id": trace.get("pattern_id"),
                "pattern_name": trace.get("pattern_name"),
                "matched_markers": _marker_names(trace.get("matched_biomarkers")),
                "matched_symptoms": list(trace.get("matched_symptoms") or []),
                "doctor_escalation_reasons": list((trace.get("doctor_escalation") or {}).get("reasons") or []),
                "doctor_flag": doctor_flag,
            }
        )
    return candidates


def _safety_result_fallback(safety_result: Dict[str, Any], existing_levels: set) -> List[Dict[str, Any]]:
    """clinical_priority_planner.py already establishes this exact
    fallback posture: a report-level safety signal with no matching
    detected pattern must not be silently lost."""
    urgent = bool(safety_result.get("urgent_review_required"))
    doctor = bool(safety_result.get("doctor_discussion_required"))

    if urgent and "urgent" not in existing_levels:
        return [{
            "domain": "safety", "level": "urgent", "source": "safety_result",
            "pattern_id": None, "pattern_name": "Safety engine flag",
            "matched_markers": [], "matched_symptoms": [],
            "doctor_escalation_reasons": [], "doctor_flag": True,
        }]
    if doctor and not urgent and not (existing_levels & {"urgent", "doctor"}):
        return [{
            "domain": "safety", "level": "doctor", "source": "safety_result",
            "pattern_id": None, "pattern_name": "Safety engine flag",
            "matched_markers": [], "matched_symptoms": [],
            "doctor_escalation_reasons": [], "doctor_flag": True,
        }]
    return []


def _merge_candidates(candidates: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    for candidate in candidates:
        domain = candidate["domain"]
        existing = merged.get(domain)
        if existing is None or _LEVEL_RANK[candidate["level"]] > _LEVEL_RANK[existing["level"]]:
            merged[domain] = {
                "domain": domain,
                "level": candidate["level"],
                "pattern_ids": [candidate["pattern_id"]] if candidate["pattern_id"] else [],
                "matched_markers": list(candidate["matched_markers"]),
                "matched_symptoms": list(candidate["matched_symptoms"]),
                "doctor_escalation_reasons": list(candidate["doctor_escalation_reasons"]),
                "doctor_flag": candidate["doctor_flag"],
            }
        else:
            existing["pattern_ids"] += [candidate["pattern_id"]] if candidate["pattern_id"] else []
            for marker in candidate["matched_markers"]:
                if marker not in existing["matched_markers"]:
                    existing["matched_markers"].append(marker)
            for symptom in candidate["matched_symptoms"]:
                if symptom not in existing["matched_symptoms"]:
                    existing["matched_symptoms"].append(symptom)
            for reason in candidate["doctor_escalation_reasons"]:
                if reason not in existing["doctor_escalation_reasons"]:
                    existing["doctor_escalation_reasons"].append(reason)
            existing["doctor_flag"] = existing["doctor_flag"] or candidate["doctor_flag"]
    return merged


def _human_readable_reason(level: str, domain: str, reason_codes: List[str]) -> str:
    domain_label = domain.replace("_", " ")
    context_limited = "confidence_limited_by_missing_context" in reason_codes or "confidence_limited_by_contradiction" in reason_codes

    if level == "urgent":
        return (
            f"This finding is flagged for urgent review because the report includes an urgent safety signal"
            f"{'' if domain == 'safety' else f' in {domain_label}'}."
        )
    if level == "doctor":
        base = "This finding should be discussed with a doctor because the report includes a doctor-review signal"
        return f"{base} and the available context is incomplete." if context_limited else f"{base}."
    if level == "practitioner":
        return (
            f"This finding may need review with a practitioner because more context or testing in {domain_label} "
            "can help clarify it."
        )
    return "There is not enough structured data yet to determine a review priority."


def _related_profiles_for_domain(
    domain: str,
    population_profile_overlays: Dict[str, Any],
    population_profile_selection: Dict[str, Any],
) -> List[str]:
    active_ids = set(_safe_list(population_profile_selection.get("active_profile_ids")))
    related: List[str] = []
    for profile in _safe_list(population_profile_overlays.get("profiles")):
        if not isinstance(profile, dict):
            continue
        profile_id = profile.get("profile_id")
        if profile_id in active_ids and domain in _safe_list(profile.get("focus_domains")):
            related.append(profile_id)
    return related


def _enrich_escalation(
    merged: Dict[str, Any],
    *,
    clinical_contradictions: List[Dict[str, Any]],
    evidence_gaps: Dict[str, Any],
    evidence_debt: Dict[str, Any],
    clinical_hypotheses: List[Dict[str, Any]],
    population_profile_overlays: Dict[str, Any],
    population_profile_selection: Dict[str, Any],
    safety_result: Dict[str, Any],
) -> Dict[str, Any]:
    domain = merged["domain"]
    level = merged["level"]

    reason_codes: List[str] = []
    if level == "urgent":
        reason_codes.append("urgent_review_flag_present")
    if merged["doctor_flag"] and level in {"urgent", "doctor"}:
        reason_codes.append("doctor_flag_present")
    if merged["doctor_escalation_reasons"]:
        reason_codes.append("pattern_doctor_escalation")
    if level == "practitioner":
        reason_codes.append("needs_more_context_or_testing")

    domain_contradictions = [
        c for c in clinical_contradictions if isinstance(c, dict) and _domain_of(c) == domain and c.get("message")
    ]
    if domain_contradictions:
        reason_codes.append("confidence_limited_by_contradiction")

    domain_gaps_high = [
        g for g in _safe_list(evidence_gaps.get("gaps"))
        if isinstance(g, dict) and _domain_of(g) == domain and g.get("priority") == "high"
    ]
    domain_debt_entry = next(
        (d for d in _safe_list(evidence_debt.get("domain_debt")) if isinstance(d, dict) and _domain_of(d) == domain),
        None,
    )
    high_debt = bool(domain_debt_entry and domain_debt_entry.get("debt_level") in _HIGH_DEBT_LEVELS)
    if domain_gaps_high or high_debt:
        reason_codes.append("confidence_limited_by_missing_context")

    domain_hypotheses = [
        h for h in clinical_hypotheses if isinstance(h, dict) and _domain_of(h) == domain
    ]
    if any(
        str(h.get("calibrated_confidence") or "").strip().lower() in _LOW_CONFIDENCE
        for h in domain_hypotheses
    ):
        reason_codes.append("confidence_limited_by_calibration")

    if level == "urgent":
        recommended_timing = "urgent"
    elif level == "doctor":
        strong_extra = bool(domain_contradictions) or high_debt or bool(safety_result.get("doctor_discussion_required"))
        recommended_timing = "prompt" if strong_extra else "soon"
    elif level == "practitioner":
        recommended_timing = "routine"
    else:
        recommended_timing = "unknown"

    related_profiles = _related_profiles_for_domain(domain, population_profile_overlays, population_profile_selection)

    return {
        "id": f"{domain}_{level}_review",
        "level": level,
        "recommended_timing": recommended_timing,
        "domain": domain,
        "reason_codes": reason_codes,
        "related_markers": merged["matched_markers"],
        "related_symptoms": merged["matched_symptoms"],
        "related_hypotheses": [h.get("hypothesis_id") for h in domain_hypotheses if h.get("hypothesis_id")],
        "related_contradictions": [c.get("message") for c in domain_contradictions],
        "related_profiles": related_profiles,
        "pattern_escalation_reasons": merged["doctor_escalation_reasons"],
        "human_readable_reason": _human_readable_reason(level, domain, reason_codes),
        "not_a_diagnosis": True,
    }


def build_doctor_escalation_precision(
    *,
    action_plan_by_role: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
    clinical_hypotheses: Dict[str, Any] | None = None,
    clinical_contradictions: Dict[str, Any] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
    negative_evidence: Dict[str, Any] | None = None,
    evidence_debt: Dict[str, Any] | None = None,
    population_profile_selection: Dict[str, Any] | None = None,
    population_profile_overlays: Dict[str, Any] | None = None,
    report_quality_audit: Dict[str, Any] | None = None,
    clinical_reasoning_traces: List[Dict[str, Any]] | None = None,
    detected_patterns: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """Pure aggregation over already-computed pipeline outputs -- see
    module docstring. `negative_evidence`, `report_quality_audit`, and
    `detected_patterns` are accepted for completeness/forward-compat but
    never used to build or gate an escalation (negative_evidence
    structurally cannot overlap with an escalated domain; detected_patterns
    is superseded here by clinical_reasoning_traces, which already merges
    pattern + safety_result). Never raises on missing/malformed input and
    never mutates any input."""
    action_plan_by_role = _safe_dict(action_plan_by_role)
    safety_result = _safe_dict(safety_result)
    clinical_hypotheses_list = _safe_list(_safe_dict(clinical_hypotheses).get("hypotheses"))
    clinical_contradictions_list = _safe_list(_safe_dict(clinical_contradictions).get("contradictions"))
    evidence_gaps = _safe_dict(evidence_gaps)
    evidence_debt = _safe_dict(evidence_debt)
    population_profile_selection = _safe_dict(population_profile_selection)
    population_profile_overlays = _safe_dict(population_profile_overlays)
    clinical_reasoning_traces = _safe_list(clinical_reasoning_traces)

    trace_candidates = _candidates_from_traces(clinical_reasoning_traces)
    existing_levels = {c["level"] for c in trace_candidates}
    fallback_candidates = _safety_result_fallback(safety_result, existing_levels)

    merged_by_domain = _merge_candidates(trace_candidates + fallback_candidates)

    escalations = [
        _enrich_escalation(
            merged,
            clinical_contradictions=clinical_contradictions_list,
            evidence_gaps=evidence_gaps,
            evidence_debt=evidence_debt,
            clinical_hypotheses=clinical_hypotheses_list,
            population_profile_overlays=population_profile_overlays,
            population_profile_selection=population_profile_selection,
            safety_result=safety_result,
        )
        for merged in merged_by_domain.values()
    ]
    # Stable, priority-first ordering.
    escalations.sort(key=lambda e: (-_LEVEL_RANK[e["level"]], e["domain"]))

    urgent_count = len([e for e in escalations if e["level"] == "urgent"])
    doctor_count = len([e for e in escalations if e["level"] == "doctor"])
    practitioner_count = len([e for e in escalations if e["level"] == "practitioner"])
    self_count = len(_safe_list(_safe_dict(action_plan_by_role.get("buckets")).get("self")))

    if urgent_count:
        overall_level = "urgent"
        recommended_timing = "urgent"
    elif doctor_count:
        overall_level = "doctor"
        recommended_timing = next(e["recommended_timing"] for e in escalations if e["level"] == "doctor")
    elif practitioner_count:
        overall_level = "practitioner"
        recommended_timing = "routine"
    else:
        overall_level = "self"
        has_any_structured_input = bool(
            action_plan_by_role or safety_result or clinical_reasoning_traces or clinical_hypotheses_list
        )
        recommended_timing = "routine" if has_any_structured_input else "unknown"

    return {
        "version": DOCTOR_ESCALATION_PRECISION_VERSION,
        "overall_level": overall_level,
        "recommended_timing": recommended_timing,
        "escalations": escalations,
        "summary": {
            "urgent_count": urgent_count,
            "doctor_count": doctor_count,
            "practitioner_count": practitioner_count,
            "self_count": self_count,
        },
    }
