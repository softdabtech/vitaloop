"""Report Quality Audit (P23, backend-first v1).

A technical/product audit of THIS report's generation — not a health
score, not a clinical conclusion. Answers: what was recognized, which
reasoning layers ran and with how much output, which domains have
coverage, are there unresolved contradictions or doctor-only items, was
an LLM involved, and is this report reproducible (frozen-replay-safe).

Pure aggregation over data every earlier pipeline stage already computed
— no new detection, no new marker/pattern logic, no LLM call. Every
generated string uses report-quality language ("report completeness",
"reasoning layer ran", "audit limitation") — never clinical-outcome
language ("you have", "disease", "healthy/unhealthy", "cured",
"treated", "guaranteed"), per docs/TRUST_AND_CLAIMS_GUIDELINES.md.

Frozen-replay safe by construction: this module is called once at
report-generation time and its output is persisted verbatim into
input_snapshot — report_history.py never recomputes it (recomputing an
audit of "what happened during generation" on a later read would be
nonsensical anyway, not just inconsistent).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.services.negative_evidence import _DOMAIN_MARKERS as _NEGATIVE_EVIDENCE_DOMAINS

REPORT_QUALITY_AUDIT_VERSION = "p23_v1"

# Domain vocabulary: every domain negative_evidence.py knows about, plus
# "recovery" (P20's sleep/stress/training/illness cluster, which has no
# lab-marker domain of its own).
_KNOWN_DOMAINS = sorted(set(_NEGATIVE_EVIDENCE_DOMAINS) | {"recovery"})

_LOW_MARKER_COUNT_THRESHOLD = 5


def _domain_of(item: Dict[str, Any]) -> str:
    return str(item.get("domain") or "").strip().lower()


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _layer(name: str, container: Any, *, count_fn=None, skipped: bool = False, skip_reason: str | None = None) -> Dict[str, Any]:
    """Builds one reasoning_layers entry. `container` is the raw layer
    output (a dict or list); None means the layer wasn't computed at all
    ("missing" — should not normally happen in a live pipeline run, but a
    caller building an audit from a partial/older snapshot may pass
    None). `skipped` covers a layer that legitimately did not run this
    time (e.g. progress_intelligence with no previous upload)."""
    if skipped:
        entry = {"layer": name, "status": "skipped", "item_count": 0}
        if skip_reason:
            entry["limitations"] = [skip_reason]
        return entry
    if container is None:
        return {"layer": name, "status": "missing", "item_count": 0}
    count = count_fn(container) if count_fn else 0
    return {"layer": name, "status": "ran" if count > 0 else "empty", "item_count": count}


def _build_reasoning_layers(
    *,
    patterns: List[Dict[str, Any]] | None,
    clinical_hypotheses: Dict[str, Any] | None,
    clinical_contradictions: Dict[str, Any] | None,
    confidence_calibration: Dict[str, Any] | None,
    negative_evidence: Dict[str, Any] | None,
    progress_intelligence: Dict[str, Any] | None,
    personal_baseline: Dict[str, Any] | None,
    intervention_memory: Dict[str, Any] | None,
    outcome_attribution: Dict[str, Any] | None,
    evidence_debt: Dict[str, Any] | None,
    action_plan_by_role: Dict[str, Any] | None,
    next_test_funnel: Dict[str, Any] | None,
    evidence_gaps: Dict[str, Any] | None,
) -> List[Dict[str, Any]]:
    progress_skipped = isinstance(progress_intelligence, dict) and progress_intelligence.get("available") is False

    return [
        _layer("detected_patterns", patterns, count_fn=lambda v: len(_safe_list(v))),
        _layer(
            "clinical_hypotheses", clinical_hypotheses,
            count_fn=lambda v: len(_safe_list(_safe_dict(v).get("hypotheses"))),
        ),
        _layer(
            "clinical_contradictions", clinical_contradictions,
            count_fn=lambda v: len(_safe_list(_safe_dict(v).get("contradictions"))),
        ),
        _layer(
            "confidence_calibration", confidence_calibration,
            count_fn=lambda v: len(_safe_list(_safe_dict(v).get("calibrated_items"))),
        ),
        _layer(
            "negative_evidence", negative_evidence,
            count_fn=lambda v: len(_safe_list(_safe_dict(v).get("stable_domains"))) + len(_safe_list(_safe_dict(v).get("under_tested_domains"))),
        ),
        _layer(
            "progress_intelligence", progress_intelligence,
            count_fn=lambda v: len(_safe_list(_safe_dict(v).get("changes"))),
            skipped=progress_skipped,
            skip_reason="No previous upload was available to compare against." if progress_skipped else None,
        ),
        _layer(
            "personal_baseline", personal_baseline,
            count_fn=lambda v: len(_safe_list(_safe_dict(v).get("markers"))),
        ),
        _layer(
            "intervention_memory", intervention_memory,
            count_fn=lambda v: len(_safe_list(_safe_dict(v).get("active_interventions"))) + len(_safe_list(_safe_dict(v).get("completed_interventions"))),
        ),
        _layer(
            "outcome_attribution", outcome_attribution,
            count_fn=lambda v: len(_safe_list(_safe_dict(v).get("attributions"))),
        ),
        _layer(
            "evidence_debt", evidence_debt,
            count_fn=lambda v: len(_safe_list(_safe_dict(v).get("domain_debt"))),
        ),
        _layer(
            "action_plan_by_role", action_plan_by_role,
            count_fn=lambda v: sum(len(_safe_list(_safe_dict(v).get(b))) for b in ("urgent", "doctor", "practitioner", "self")),
        ),
        _layer(
            "next_test_funnel", next_test_funnel,
            count_fn=lambda v: int(_safe_dict(_safe_dict(v).get("summary")).get("total_pending") or 0),
        ),
        _layer(
            "evidence_gaps", evidence_gaps,
            count_fn=lambda v: len(_safe_list(_safe_dict(v).get("gaps"))),
        ),
    ]


def _build_domain_coverage(
    *,
    clinical_hypotheses: Dict[str, Any] | None,
    clinical_contradictions: Dict[str, Any] | None,
    evidence_gaps: Dict[str, Any] | None,
    negative_evidence: Dict[str, Any] | None,
    evidence_debt: Dict[str, Any] | None,
) -> List[Dict[str, Any]]:
    hypotheses = _safe_list(_safe_dict(clinical_hypotheses).get("hypotheses"))
    contradictions = _safe_list(_safe_dict(clinical_contradictions).get("contradictions"))
    gaps = _safe_list(_safe_dict(evidence_gaps).get("gaps"))
    stable = _safe_list(_safe_dict(negative_evidence).get("stable_domains"))
    under_tested = _safe_list(_safe_dict(negative_evidence).get("under_tested_domains"))
    domain_debt_entries = _safe_list(_safe_dict(evidence_debt).get("domain_debt"))

    coverage: List[Dict[str, Any]] = []
    for domain in _KNOWN_DOMAINS:
        hyp_count = len([h for h in hypotheses if isinstance(h, dict) and _domain_of(h) == domain])
        con_count = len([c for c in contradictions if isinstance(c, dict) and _domain_of(c) == domain])
        gap_count = len([g for g in gaps if isinstance(g, dict) and _domain_of(g) == domain])
        ne_status = None
        if any(isinstance(s, dict) and _domain_of(s) == domain for s in stable):
            ne_status = "stable"
        elif any(isinstance(u, dict) and _domain_of(u) == domain for u in under_tested):
            ne_status = "under_tested"
        debt_entry = next((d for d in domain_debt_entries if isinstance(d, dict) and _domain_of(d) == domain), None)
        debt_level = debt_entry.get("debt_level") if debt_entry else None

        if not (hyp_count or con_count or gap_count or ne_status or debt_level):
            continue  # no signal at all for this domain — omit rather than pad with zeros

        if ne_status == "stable" or (hyp_count and not gap_count):
            domain_coverage_label = "sufficient"
        elif hyp_count or con_count or gap_count or ne_status:
            domain_coverage_label = "partial"
        else:
            domain_coverage_label = "none"

        coverage.append(
            {
                "domain": domain,
                "coverage": domain_coverage_label,
                "signals": {
                    "hypotheses": hyp_count,
                    "contradictions": con_count,
                    "evidence_gaps": gap_count,
                    "negative_evidence": ne_status,
                    "debt_level": debt_level,
                },
            }
        )
    return coverage


def _build_quality_flags(
    *,
    markers_extracted_count: int,
    has_lab_dates: Optional[bool],
    has_historical_context: Optional[bool],
    has_symptom_context: Optional[bool],
    has_intervention_context: Optional[bool],
    evidence_debt: Dict[str, Any] | None,
    contradiction_count: int,
    doctor_only_items: int,
    snapshot_persisted: bool,
    version_provenance_present: bool,
    llm_used: Optional[bool],
) -> List[Dict[str, Any]]:
    flags: List[Dict[str, Any]] = []

    if markers_extracted_count < _LOW_MARKER_COUNT_THRESHOLD:
        flags.append({
            "code": "low_marker_count",
            "severity": "warning",
            "message": f"Only {markers_extracted_count} marker(s) were extracted, which limits report completeness.",
        })
    if has_lab_dates is False:
        flags.append({
            "code": "missing_lab_date",
            "severity": "info",
            "message": "No lab date was available for this upload.",
        })
    if has_historical_context is False:
        flags.append({
            "code": "no_historical_context",
            "severity": "info",
            "message": "No previous upload was available for historical comparison.",
        })
    if has_symptom_context is False:
        flags.append({
            "code": "no_symptom_context",
            "severity": "info",
            "message": "No reported symptoms were available as context.",
        })
    if has_intervention_context is False:
        flags.append({
            "code": "missing_intervention_context",
            "severity": "info",
            "message": "No intervention events were available, so outcome attribution is limited.",
        })

    overall_debt = _safe_dict(evidence_debt).get("overall_debt")
    if overall_debt in {"high", "blocked"}:
        flags.append({
            "code": "high_evidence_debt",
            "severity": "warning",
            "message": "Overall evidence debt is high, meaning several domains lack complete data for confident interpretation.",
        })

    if contradiction_count > 0:
        flags.append({
            "code": "unresolved_contradictions",
            "severity": "warning",
            "message": f"{contradiction_count} contradiction(s) were found and remain unresolved in this report.",
        })

    if doctor_only_items > 0:
        flags.append({
            "code": "doctor_only_items_present",
            "severity": "warning",
            "message": f"{doctor_only_items} item(s) in this report are flagged as doctor-only.",
        })

    if not snapshot_persisted:
        flags.append({
            "code": "frozen_snapshot_missing",
            "severity": "critical",
            "message": "This report's snapshot was not persisted, so frozen replay is not available for it.",
        })
    if not version_provenance_present:
        flags.append({
            "code": "version_provenance_missing",
            "severity": "critical",
            "message": "Version provenance was not available for this report.",
        })
    if llm_used is None:
        flags.append({
            "code": "llm_usage_unknown",
            "severity": "info",
            "message": "Whether an LLM was used for this report could not be determined from available data.",
        })

    return flags


def build_report_quality_audit(
    *,
    biomarkers: List[Dict[str, Any]] | None = None,
    symptoms: List[Any] | None = None,
    source_metadata: Dict[str, Any] | None = None,
    patterns: List[Dict[str, Any]] | None = None,
    clinical_hypotheses: Dict[str, Any] | None = None,
    clinical_contradictions: Dict[str, Any] | None = None,
    confidence_calibration: Dict[str, Any] | None = None,
    negative_evidence: Dict[str, Any] | None = None,
    progress_intelligence: Dict[str, Any] | None = None,
    personal_baseline: Dict[str, Any] | None = None,
    intervention_memory: Dict[str, Any] | None = None,
    outcome_attribution: Dict[str, Any] | None = None,
    evidence_debt: Dict[str, Any] | None = None,
    action_plan_by_role: Dict[str, Any] | None = None,
    next_test_funnel: Dict[str, Any] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
    version_provenance: Dict[str, Any] | None = None,
    cost_metadata: Dict[str, Any] | None = None,
    snapshot_will_persist: bool = True,
) -> Dict[str, Any]:
    markers_extracted_count = len(_safe_list(biomarkers))

    # Every field below is either directly knowable from what the
    # pipeline already computed, or explicitly None ("unknown") rather
    # than guessed — this module adds no new extraction/OCR/date logic.
    has_lab_dates: Optional[bool] = None
    if isinstance(source_metadata, dict) and "lab_date" in source_metadata:
        has_lab_dates = bool(source_metadata.get("lab_date"))
    has_historical_context = (
        bool(progress_intelligence.get("available")) if isinstance(progress_intelligence, dict) else None
    )
    has_symptom_context = bool(_safe_list(symptoms))
    has_intervention_context = bool(
        _safe_list(_safe_dict(intervention_memory).get("active_interventions"))
        or _safe_list(_safe_dict(intervention_memory).get("completed_interventions"))
    ) if intervention_memory is not None else None

    input_limitations: List[str] = []
    documents_count = None  # not tracked anywhere in the pipeline yet — honestly unknown, not guessed.
    input_limitations.append("Document count is not tracked by the current pipeline.")
    if has_lab_dates is None:
        input_limitations.append("Lab date presence could not be determined from available metadata.")
    if has_intervention_context is False:
        input_limitations.append("No intervention events were available.")

    reasoning_layers = _build_reasoning_layers(
        patterns=patterns,
        clinical_hypotheses=clinical_hypotheses,
        clinical_contradictions=clinical_contradictions,
        confidence_calibration=confidence_calibration,
        negative_evidence=negative_evidence,
        progress_intelligence=progress_intelligence,
        personal_baseline=personal_baseline,
        intervention_memory=intervention_memory,
        outcome_attribution=outcome_attribution,
        evidence_debt=evidence_debt,
        action_plan_by_role=action_plan_by_role,
        next_test_funnel=next_test_funnel,
        evidence_gaps=evidence_gaps,
    )

    domain_coverage = _build_domain_coverage(
        clinical_hypotheses=clinical_hypotheses,
        clinical_contradictions=clinical_contradictions,
        evidence_gaps=evidence_gaps,
        negative_evidence=negative_evidence,
        evidence_debt=evidence_debt,
    )

    action_plan = _safe_dict(action_plan_by_role)
    urgent_count = len(_safe_list(action_plan.get("urgent")))
    doctor_count = len(_safe_list(action_plan.get("doctor")))
    hypotheses = _safe_list(_safe_dict(clinical_hypotheses).get("hypotheses"))
    doctor_only_items = len([h for h in hypotheses if isinstance(h, dict) and (h.get("doctor_only") or h.get("doctor_flag"))])

    safety_audit = {
        "urgent_count": urgent_count,
        "doctor_count": doctor_count,
        "doctor_only_items": doctor_only_items,
        "safety_layers_present": safety_result is not None,
    }

    model = (version_provenance or {}).get("model")
    cost = _safe_dict(cost_metadata)
    llm_used: Optional[bool] = None
    if isinstance(cost_metadata, dict) and "estimated" in cost_metadata:
        llm_used = not bool(cost_metadata.get("estimated"))
    elif model:
        llm_used = True

    cost_audit = {
        "llm_used": llm_used,
        "usage_event_present": None,  # not queried here — see module docstring: no new DB access in P23 v1.
        "estimated_cost_usd": cost.get("estimated_cost_usd"),
        "model": model,
    }

    version_provenance_present = bool(version_provenance)
    contradiction_count = len(_safe_list(_safe_dict(clinical_contradictions).get("contradictions")))

    quality_flags = _build_quality_flags(
        markers_extracted_count=markers_extracted_count,
        has_lab_dates=has_lab_dates,
        has_historical_context=has_historical_context,
        has_symptom_context=has_symptom_context,
        has_intervention_context=has_intervention_context,
        evidence_debt=evidence_debt,
        contradiction_count=contradiction_count,
        doctor_only_items=doctor_only_items,
        snapshot_persisted=snapshot_will_persist,
        version_provenance_present=version_provenance_present,
        llm_used=llm_used,
    )

    critical_flags = [f for f in quality_flags if f["severity"] == "critical"]
    if markers_extracted_count == 0:
        audit_status = "blocked"
    elif critical_flags:
        audit_status = "partial"
    elif quality_flags:
        audit_status = "complete_with_limitations"
    else:
        audit_status = "complete"

    high_confidence_items = len([
        h for h in hypotheses
        if (h.get("calibrated_confidence") or h.get("likelihood_bucket")) in {"high", "likely"}
    ])
    blocked_or_low_confidence_items = len([
        h for h in hypotheses
        if (h.get("calibrated_confidence") or h.get("likelihood_bucket")) in {"low", "blocked"}
    ])

    return {
        "version": REPORT_QUALITY_AUDIT_VERSION,
        "audit_status": audit_status,
        "report_reproducibility": {
            "snapshot_persisted": snapshot_will_persist,
            "frozen_replay_supported": snapshot_will_persist,
            "version_provenance_present": version_provenance_present,
        },
        "input_quality": {
            "markers_extracted_count": markers_extracted_count,
            "documents_count": documents_count,
            "has_lab_dates": has_lab_dates,
            "has_historical_context": has_historical_context,
            "has_symptom_context": has_symptom_context,
            "has_intervention_context": has_intervention_context,
            "limitations": input_limitations,
        },
        "reasoning_layers": reasoning_layers,
        "domain_coverage": domain_coverage,
        "safety_audit": safety_audit,
        "cost_audit": cost_audit,
        "quality_flags": quality_flags,
        "summary": {
            "markers_reviewed": markers_extracted_count,
            "domains_assessed": len(domain_coverage),
            "high_confidence_items": high_confidence_items,
            "blocked_or_low_confidence_items": blocked_or_low_confidence_items,
            "audit_limitations_count": len(input_limitations),
        },
    }
