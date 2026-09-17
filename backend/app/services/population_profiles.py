"""Population Profiles (P24, backend-first v1).

An overlay layer, not a new detection layer. Every one of P14-P23's
deterministic reasoning stages already produces domain-tagged, calibrated
output (clinical_hypotheses, clinical_contradictions, negative_evidence,
personal_baseline velocity, intervention_memory, outcome_attribution,
evidence_debt, next_test_funnel, action_plan_by_role, report_quality_audit).
This module does not re-detect anything and does not touch biomarker
values, patterns, or hypotheses themselves — it re-reads what those stages
already computed through the lens of one named population profile, and
produces *emphasis*, not new facts:

- which already-computed hypotheses in the profile's focus domains get
  elevated or downgraded emphasis (never a confidence value change --
  calibrated_confidence/confidence_score on the hypothesis itself are
  untouched, this only adds a profile-level annotation next to them),
- which already-pending next-tests are worth emphasizing for this profile,
- short, cautious practitioner-facing prompts assembled from fixed
  templates (no LLM, no free text generation),
- context notes when the profile's focus domains have high/blocked
  evidence debt (i.e. this module also HONORS incomplete data rather than
  overriding it with profile-driven confidence).

Only one profile exists in this v1: "longevity_metabolic_optimization".
The module is written so a second profile is just another entry in
_PROFILES, never a fork of this file or of any P14-P23 module.

Language discipline (docs/TRUST_AND_CLAIMS_GUIDELINES.md): every generated
string uses "may be worth discussing" / "consider" / "worth monitoring" /
"insufficient data" phrasing. Never "diagnosis", "you have", "disease",
"cured", "treatment", "guaranteed", "ruled out".

Frozen-replay safe by construction: computed once at report-generation
time from data that is itself already frozen-verbatim persisted, and its
own output — `population_profile_overlays` — is persisted into
input_snapshot and returned by report_history.py verbatim on every later
read, exactly like evidence_debt/report_quality_audit. Never recomputed
for a historical report: a later change to this module's templates or
scoring must not silently rewrite what an old report says.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


POPULATION_PROFILES_VERSION = "p24_v1"

LONGEVITY_METABOLIC_OPTIMIZATION = "longevity_metabolic_optimization"

# Domains this profile pays extra attention to. Deliberately a subset of
# the same canonical domain vocabulary negative_evidence.py /
# evidence_debt.py / report_quality_audit.py already use -- no new domain
# names invented here.
_FOCUS_DOMAINS = ["metabolic_health", "cardiovascular", "inflammation", "liver", "micronutrients"]

# Signals this profile cares about, grouped by domain. These intentionally
# mirror negative_evidence.py's _DOMAIN_MARKERS required/supportive marker
# ids for the same domains (insulin/HOMA-IR, fasting glucose/HbA1c,
# triglycerides/HDL/LDL/ApoB, hsCRP/CRP, ALT/AST/GGT, vitamin D/B12/folate)
# so "focus marker" here never drifts from the vocabulary the rest of the
# reasoning core already uses.
_FOCUS_MARKERS_BY_DOMAIN = {
    "metabolic_health": ["glucose", "hba1c", "insulin", "homa_ir"],
    "cardiovascular": ["ldl", "hdl", "triglycerides", "apob"],
    "inflammation": ["crp"],
    "liver": ["alt", "ast", "ggt"],
    "micronutrients": ["vitamin_d", "b12", "folate"],
}

_ELEVATABLE_CONFIDENCE = {"high", "moderate", "likely"}
_LOW_CONFIDENCE = {"low", "blocked", "unlikely"}
_HIGH_DEBT_LEVELS = {"high", "blocked"}

_MAX_PRACTITIONER_PROMPTS = 8


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _domain_of(item: Dict[str, Any]) -> str:
    return str(item.get("domain") or "").strip().lower()


def _normalize_marker(value: Any) -> str:
    return str(value or "").strip().lower().replace(" ", "_").replace("-", "_")


def _marker_in_focus(marker: Any, domain: str) -> bool:
    """Loose match, same posture as next_test_funnel._marker_fulfilled:
    a next-test/velocity marker may arrive as a raw id ("hba1c") or a
    human label ("HbA1c", "Hemoglobin A1c") -- match by substring in
    either direction against this domain's focus marker ids."""
    normalized = _normalize_marker(marker)
    if not normalized:
        return False
    for focus_marker in _FOCUS_MARKERS_BY_DOMAIN.get(domain, []):
        if focus_marker in normalized or normalized in focus_marker:
            return True
    return False


def _contradiction_messages_for_domain(contradictions: List[Dict[str, Any]], domain: str) -> List[str]:
    return [
        str(c.get("message")) for c in contradictions
        if isinstance(c, dict) and _domain_of(c) == domain and c.get("message")
    ]


def _build_priority_adjustments(
    hypotheses: List[Dict[str, Any]],
    contradictions: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    adjustments: List[Dict[str, Any]] = []
    for hypothesis in hypotheses:
        if not isinstance(hypothesis, dict):
            continue
        domain = _domain_of(hypothesis)
        if domain not in _FOCUS_DOMAINS:
            continue

        calibrated = str(
            hypothesis.get("calibrated_confidence") or hypothesis.get("likelihood_bucket") or ""
        ).strip().lower()
        domain_contradiction_messages = _contradiction_messages_for_domain(contradictions, domain)

        if domain_contradiction_messages:
            emphasis = "downgraded_due_to_contradiction"
            reason = (
                f"An unresolved contradiction was found in {domain.replace('_', ' ')}, "
                "so this profile does not elevate this item until that is clarified."
            )
        elif calibrated in _ELEVATABLE_CONFIDENCE:
            emphasis = "elevated"
            reason = (
                f"Within the longevity/metabolic-optimization focus domains "
                f"({domain.replace('_', ' ')}) and not contradicted in this report."
            )
        elif calibrated in _LOW_CONFIDENCE:
            emphasis = "standard"
            reason = "Calibrated confidence is low/blocked, so no elevation is applied despite the domain match."
        else:
            emphasis = "standard"
            reason = "Calibrated confidence was not available; no elevation applied."

        adjustments.append(
            {
                "domain": domain,
                "hypothesis_id": hypothesis.get("hypothesis_id"),
                "label": hypothesis.get("label"),
                "calibrated_confidence": calibrated or None,
                "profile_emphasis": emphasis,
                "reason": reason,
                "contradiction_notes": domain_contradiction_messages,
            }
        )
    return adjustments


def _build_context_notes(evidence_debt: Dict[str, Any]) -> List[Dict[str, Any]]:
    notes: List[Dict[str, Any]] = []
    for entry in _safe_list(evidence_debt.get("domain_debt")):
        if not isinstance(entry, dict):
            continue
        domain = _domain_of(entry)
        if domain not in _FOCUS_DOMAINS:
            continue
        debt_level = entry.get("debt_level")
        if debt_level not in _HIGH_DEBT_LEVELS:
            continue
        missing_markers = _safe_list(entry.get("missing_markers"))
        note = f"Data completeness for {domain.replace('_', ' ')} is currently {debt_level}."
        if missing_markers:
            note += f" Additional data on {', '.join(missing_markers)} would help sharpen this before drawing conclusions."
        notes.append(
            {
                "domain": domain,
                "debt_level": debt_level,
                "missing_markers": missing_markers,
                "note": note,
            }
        )
    return notes


def _intervention_covers_domain(intervention_memory: Dict[str, Any], domain: str) -> bool:
    active = _safe_list(intervention_memory.get("active_interventions"))
    for event in active:
        if isinstance(event, dict) and domain in _safe_list(event.get("domains")):
            return True
    return False


def _marker_already_addressed(marker: str, domain: str, outcome_attribution: Dict[str, Any], intervention_memory: Dict[str, Any]) -> bool:
    for attribution in _safe_list(outcome_attribution.get("attributions")):
        if not isinstance(attribution, dict):
            continue
        if _domain_of(attribution) != domain:
            continue
        if not _marker_in_focus(attribution.get("outcome_marker"), domain):
            continue
        outcome_marker_norm = _normalize_marker(attribution.get("outcome_marker"))
        marker_norm = _normalize_marker(marker)
        markers_match = bool(outcome_marker_norm) and (outcome_marker_norm in marker_norm or marker_norm in outcome_marker_norm)
        if markers_match and attribution.get("claim_strength") == "possible_contributor" and _safe_list(attribution.get("possible_contributors")):
            return True
    return _intervention_covers_domain(intervention_memory, domain)


def _build_next_test_emphasis(
    next_test_funnel: Dict[str, Any],
    outcome_attribution: Dict[str, Any],
    intervention_memory: Dict[str, Any],
) -> List[Dict[str, Any]]:
    emphasis: List[Dict[str, Any]] = []
    panel = _safe_dict(next_test_funnel.get("panel"))
    for domain, items in panel.items():
        if domain not in _FOCUS_DOMAINS:
            continue
        for item in _safe_list(items):
            if not isinstance(item, dict):
                continue
            marker = item.get("marker")
            if not _marker_in_focus(marker, domain):
                continue
            already_addressed = _marker_already_addressed(marker, domain, outcome_attribution, intervention_memory)
            emphasis.append(
                {
                    "domain": domain,
                    "marker": marker,
                    "priority": item.get("priority") or "medium",
                    "already_being_addressed": already_addressed,
                    "reason": (
                        "Already linked to an active intervention in this domain; additional testing may be "
                        "lower priority until effects are reassessed."
                        if already_addressed
                        else "Relevant to longevity/metabolic-optimization monitoring in this domain."
                    ),
                }
            )
    return emphasis


def _build_velocity_notes(velocity_signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    notes: List[Dict[str, Any]] = []
    for signal in velocity_signals:
        if not isinstance(signal, dict):
            continue
        domain = _domain_of(signal)
        marker = signal.get("marker")
        if domain not in _FOCUS_DOMAINS or not _marker_in_focus(marker, domain):
            continue
        if signal.get("status") != "worsened_from_baseline":
            continue
        notes.append(
            {
                "domain": domain,
                "marker": marker,
                "status": signal.get("status"),
                "confidence": signal.get("confidence"),
            }
        )
    return notes


def _build_practitioner_prompts(
    priority_adjustments: List[Dict[str, Any]],
    context_notes: List[Dict[str, Any]],
    velocity_notes: List[Dict[str, Any]],
) -> List[str]:
    prompts: List[str] = []

    for adj in priority_adjustments:
        if adj["profile_emphasis"] == "elevated":
            prompts.append(
                f"Consider discussing {adj.get('label') or adj['domain']} further "
                f"({adj['domain'].replace('_', ' ')}) in the context of longevity/metabolic optimization; "
                "a consistent focus-domain signal worth a conversation, not a conclusion on its own."
            )
        elif adj["profile_emphasis"] == "downgraded_due_to_contradiction":
            prompts.append(
                f"Before treating {adj.get('label') or adj['domain']} as a metabolic-optimization priority, "
                f"discuss the unresolved contradiction noted in {adj['domain'].replace('_', ' ')}."
            )

    for note in context_notes:
        prompts.append(
            f"Data in {note['domain'].replace('_', ' ')} is currently insufficient ({note['debt_level']}) "
            "for a confident longevity/metabolic-optimization read; consider closing that gap first."
        )

    for velocity_note in velocity_notes:
        prompts.append(
            f"{velocity_note.get('marker') or 'A marker'} in {velocity_note['domain'].replace('_', ' ')} "
            "shows a worsening trend versus personal baseline; may be worth monitoring in this context."
        )

    # Stable de-dup while preserving order, then cap.
    seen: set[str] = set()
    deduped: List[str] = []
    for prompt in prompts:
        if prompt in seen:
            continue
        seen.add(prompt)
        deduped.append(prompt)
    return deduped[:_MAX_PRACTITIONER_PROMPTS]


def _build_longevity_metabolic_optimization_profile(
    *,
    clinical_hypotheses: Dict[str, Any],
    clinical_contradictions: Dict[str, Any],
    velocity_signals: List[Dict[str, Any]],
    intervention_memory: Dict[str, Any],
    outcome_attribution: Dict[str, Any],
    evidence_debt: Dict[str, Any],
    next_test_funnel: Dict[str, Any],
) -> Dict[str, Any]:
    hypotheses = _safe_list(clinical_hypotheses.get("hypotheses"))
    contradictions = _safe_list(clinical_contradictions.get("contradictions"))

    priority_adjustments = _build_priority_adjustments(hypotheses, contradictions)
    context_notes = _build_context_notes(evidence_debt)
    velocity_notes = _build_velocity_notes(velocity_signals)
    next_test_emphasis = _build_next_test_emphasis(next_test_funnel, outcome_attribution, intervention_memory)
    practitioner_prompts = _build_practitioner_prompts(priority_adjustments, context_notes, velocity_notes)

    elevated_count = len([a for a in priority_adjustments if a["profile_emphasis"] == "elevated"])
    downgraded_count = len([a for a in priority_adjustments if a["profile_emphasis"] == "downgraded_due_to_contradiction"])

    return {
        "profile_id": LONGEVITY_METABOLIC_OPTIMIZATION,
        "label": "Longevity / Metabolic Optimization",
        "focus_domains": list(_FOCUS_DOMAINS),
        "priority_adjustments": priority_adjustments,
        "context_notes": context_notes,
        "velocity_notes": velocity_notes,
        "next_test_emphasis": next_test_emphasis,
        "practitioner_prompts": practitioner_prompts,
        "limitations": [
            "This profile reorganizes emphasis and phrasing over existing deterministic reasoning stages; "
            "it does not add new biomarker detection or clinical logic.",
            "Not a clinical conclusion, risk score, or care recommendation.",
            "Population-profile emphasis does not override calibrated confidence, contradictions, or evidence debt.",
        ],
        "summary": {
            "hypotheses_in_focus": len(priority_adjustments),
            "elevated_count": elevated_count,
            "downgraded_count": downgraded_count,
            "context_notes_count": len(context_notes),
            "next_test_emphasis_count": len(next_test_emphasis),
            "practitioner_prompts_count": len(practitioner_prompts),
        },
    }


_PROFILE_BUILDERS = {
    LONGEVITY_METABOLIC_OPTIMIZATION: _build_longevity_metabolic_optimization_profile,
}


def build_population_profile_overlays(
    *,
    clinical_hypotheses: Dict[str, Any] | None = None,
    clinical_contradictions: Dict[str, Any] | None = None,
    confidence_calibration: Dict[str, Any] | None = None,
    negative_evidence: Dict[str, Any] | None = None,
    velocity_signals: List[Dict[str, Any]] | None = None,
    intervention_memory: Dict[str, Any] | None = None,
    outcome_attribution: Dict[str, Any] | None = None,
    evidence_debt: Dict[str, Any] | None = None,
    next_test_funnel: Dict[str, Any] | None = None,
    action_plan_by_role: Dict[str, Any] | None = None,
    report_quality_audit: Dict[str, Any] | None = None,
    profile_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Pure aggregation over already-computed P14-P23 outputs -- see module
    docstring. `confidence_calibration`, `action_plan_by_role`, and
    `report_quality_audit` are accepted for forward-compatibility with
    future profiles/cross-checks but are not required by the v1 longevity
    profile (calibrated confidence already lives merged onto each
    hypothesis; action_plan_by_role and report_quality_audit are not yet
    read by any profile here). Never raises on missing/malformed input --
    every field defaults to an empty container and the result is always a
    well-formed dict, even with zero upstream data."""
    requested_ids = profile_ids if profile_ids else [LONGEVITY_METABOLIC_OPTIMIZATION]

    profiles: List[Dict[str, Any]] = []
    unknown_profile_ids: List[str] = []
    for profile_id in requested_ids:
        builder = _PROFILE_BUILDERS.get(profile_id)
        if builder is None:
            unknown_profile_ids.append(profile_id)
            continue
        profiles.append(
            builder(
                clinical_hypotheses=_safe_dict(clinical_hypotheses),
                clinical_contradictions=_safe_dict(clinical_contradictions),
                velocity_signals=_safe_list(velocity_signals),
                intervention_memory=_safe_dict(intervention_memory),
                outcome_attribution=_safe_dict(outcome_attribution),
                evidence_debt=_safe_dict(evidence_debt),
                next_test_funnel=_safe_dict(next_test_funnel),
            )
        )

    return {
        "version": POPULATION_PROFILES_VERSION,
        "active_profile_ids": [p["profile_id"] for p in profiles],
        "unknown_profile_ids": unknown_profile_ids,
        "profiles": profiles,
    }
