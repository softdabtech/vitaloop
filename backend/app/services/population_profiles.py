"""Population Profiles (P24, backend-first).

An overlay layer, not a new detection layer. Every one of P14-P23's
deterministic reasoning stages already produces domain-tagged, calibrated
output (clinical_hypotheses, clinical_contradictions, negative_evidence,
personal_baseline velocity, intervention_memory, outcome_attribution,
evidence_debt, next_test_funnel, action_plan_by_role, report_quality_audit).
This module does not re-detect anything and does not touch biomarker
values, patterns, or hypotheses themselves — it re-reads what those stages
already computed through the lens of a named population profile, and
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

Two profiles exist so far:
- "longevity_metabolic_optimization" (P24.1)
- "athlete_recovery" (P24.2)

Both are driven by one shared, config-parameterized builder
(_build_profile) -- a new profile is a new _PROFILE_CONFIGS entry plus,
optionally, a profile-specific enrichment hook, never a fork of this
file's logic or of any P14-P23 module. Only "longevity_metabolic_
optimization" is active by default (see build_population_profile_overlays'
docstring) -- "athlete_recovery" must be requested explicitly via
profile_ids until a profile-selection/targeting mechanism exists upstream.

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
scoring (including adding a new profile) must not silently rewrite what
an old report says -- an old snapshot's `profiles` list simply won't
contain a profile that did not exist yet at generation time.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


POPULATION_PROFILES_VERSION = "p24_v1"

LONGEVITY_METABOLIC_OPTIMIZATION = "longevity_metabolic_optimization"
ATHLETE_RECOVERY = "athlete_recovery"

_DEFAULT_ACTIVE_PROFILE_IDS = [LONGEVITY_METABOLIC_OPTIMIZATION]

_ELEVATABLE_CONFIDENCE = {"high", "moderate", "likely"}
_LOW_CONFIDENCE = {"low", "blocked", "unlikely"}
_HIGH_DEBT_LEVELS = {"high", "blocked"}

_MAX_PRACTITIONER_PROMPTS = 8
_MAX_RELATED_CONTEXT_EVENTS = 3


# ---------------------------------------------------------------------------
# Per-profile configuration. Domain names are the same canonical vocabulary
# negative_evidence.py / evidence_debt.py / report_quality_audit.py already
# use ("recovery" is P20's own pseudo-domain for sleep/stress/training/
# illness/alcohol/weight-change context -- see intervention_memory.py). No
# new domain names are invented here.
# ---------------------------------------------------------------------------

_PROFILE_CONFIGS = {
    LONGEVITY_METABOLIC_OPTIMIZATION: {
        "label": "Longevity / Metabolic Optimization",
        "context_label": "longevity/metabolic optimization",
        "focus_domains": ["metabolic_health", "cardiovascular", "inflammation", "liver", "micronutrients"],
        # Mirrors negative_evidence.py's _DOMAIN_MARKERS required/supportive
        # marker ids for these domains (insulin/HOMA-IR, fasting glucose/
        # HbA1c, triglycerides/HDL/LDL/ApoB, hsCRP/CRP, ALT/AST/GGT,
        # vitamin D/B12/folate) -- "focus marker" here never drifts from the
        # vocabulary the rest of the reasoning core already uses.
        "focus_markers_by_domain": {
            "metabolic_health": ["glucose", "hba1c", "insulin", "homa_ir"],
            "cardiovascular": ["ldl", "hdl", "triglycerides", "apob"],
            "inflammation": ["crp"],
            "liver": ["alt", "ast", "ggt"],
            "micronutrients": ["vitamin_d", "b12", "folate"],
        },
    },
    ATHLETE_RECOVERY: {
        "label": "Athlete / Recovery",
        "context_label": "athletic recovery",
        "focus_domains": ["iron_status", "micronutrients", "inflammation", "liver", "metabolic_health", "recovery"],
        "focus_markers_by_domain": {
            # mcv/mch are evidence_gaps.py's "blood_count" domain markers,
            # not negative_evidence.py's iron_status set -- included here
            # anyway as a curated, profile-specific signal list (this
            # module's marker lists are not required to be a strict subset
            # of any one P14-P23 module's own domain->marker map).
            "iron_status": ["ferritin", "hemoglobin", "mcv", "mch"],
            "micronutrients": ["vitamin_d", "b12", "folate"],
            "inflammation": ["crp"],
            "liver": ["alt", "ast", "ggt"],
            "metabolic_health": ["glucose", "hba1c", "insulin", "homa_ir"],
            # "recovery" has no lab markers of its own (it's P20's
            # self-reported sleep/stress/training/illness/alcohol/
            # weight-change context, not a biomarker domain) -- an empty
            # list here means next_test_emphasis never fires for it
            # (correct: there is no lab test "for recovery"), while
            # priority_adjustments/context_notes/velocity_notes still work
            # for it like any other domain if evidence_debt or a
            # hypothesis ever tags it.
            "recovery": [],
        },
    },
}


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _domain_of(item: Dict[str, Any]) -> str:
    return str(item.get("domain") or "").strip().lower()


def _normalize_marker(value: Any) -> str:
    return str(value or "").strip().lower().replace(" ", "_").replace("-", "_")


def _marker_in_focus(marker: Any, domain: str, focus_markers_by_domain: Dict[str, List[str]]) -> bool:
    """Loose match, same posture as next_test_funnel._marker_fulfilled:
    a next-test/velocity marker may arrive as a raw id ("hba1c") or a
    human label ("HbA1c", "Hemoglobin A1c") -- match by substring in
    either direction against this domain's focus marker ids."""
    normalized = _normalize_marker(marker)
    if not normalized:
        return False
    for focus_marker in focus_markers_by_domain.get(domain, []):
        if focus_marker in normalized or normalized in focus_marker:
            return True
    return False


def _contradiction_messages_for_domain(contradictions: List[Dict[str, Any]], domain: str) -> List[str]:
    return [
        str(c.get("message")) for c in contradictions
        if isinstance(c, dict) and _domain_of(c) == domain and c.get("message")
    ]


def _related_context_events_for_domain(intervention_memory: Dict[str, Any], domain: str) -> List[Dict[str, Any]]:
    """Self-reported intervention/context events (sleep, stress, training,
    illness, alcohol, weight change, supplements, etc. -- see
    intervention_memory.py) whose domains overlap this one. Purely
    informational context attached to a priority_adjustment, e.g. surfacing
    that a liver-domain signal coincides with a logged alcohol or training
    event, or an iron_status signal coincides with logged sleep/stress/
    training context -- never used to infer causation."""
    events: List[Dict[str, Any]] = []
    for status_key in ("active_interventions", "completed_interventions"):
        for event in _safe_list(intervention_memory.get(status_key)):
            if not isinstance(event, dict):
                continue
            if domain not in _safe_list(event.get("domains")):
                continue
            events.append(
                {
                    "type": event.get("type"),
                    "label": event.get("label"),
                    "status": "active" if status_key == "active_interventions" else "completed",
                }
            )
    return events[:_MAX_RELATED_CONTEXT_EVENTS]


def _build_priority_adjustments(
    hypotheses: List[Dict[str, Any]],
    contradictions: List[Dict[str, Any]],
    intervention_memory: Dict[str, Any],
    *,
    focus_domains: List[str],
    context_label: str,
) -> List[Dict[str, Any]]:
    adjustments: List[Dict[str, Any]] = []
    for hypothesis in hypotheses:
        if not isinstance(hypothesis, dict):
            continue
        domain = _domain_of(hypothesis)
        if domain not in focus_domains:
            continue

        calibrated = str(
            hypothesis.get("calibrated_confidence") or hypothesis.get("likelihood_bucket") or ""
        ).strip().lower()
        domain_contradiction_messages = _contradiction_messages_for_domain(contradictions, domain)
        related_context_events = _related_context_events_for_domain(intervention_memory, domain)

        if domain_contradiction_messages:
            emphasis = "downgraded_due_to_contradiction"
            reason = (
                f"An unresolved contradiction was found in {domain.replace('_', ' ')}, "
                "so this profile does not elevate this item until that is clarified."
            )
        elif calibrated in _ELEVATABLE_CONFIDENCE:
            emphasis = "elevated"
            reason = (
                f"Within the {context_label} focus domains "
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
                "related_context_events": related_context_events,
            }
        )
    return adjustments


def _build_context_notes(evidence_debt: Dict[str, Any], *, focus_domains: List[str]) -> List[Dict[str, Any]]:
    notes: List[Dict[str, Any]] = []
    for entry in _safe_list(evidence_debt.get("domain_debt")):
        if not isinstance(entry, dict):
            continue
        domain = _domain_of(entry)
        if domain not in focus_domains:
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


def _marker_already_addressed(
    marker: str,
    domain: str,
    outcome_attribution: Dict[str, Any],
    intervention_memory: Dict[str, Any],
    focus_markers_by_domain: Dict[str, List[str]],
) -> bool:
    for attribution in _safe_list(outcome_attribution.get("attributions")):
        if not isinstance(attribution, dict):
            continue
        if _domain_of(attribution) != domain:
            continue
        if not _marker_in_focus(attribution.get("outcome_marker"), domain, focus_markers_by_domain):
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
    *,
    focus_domains: List[str],
    focus_markers_by_domain: Dict[str, List[str]],
    context_label: str,
) -> List[Dict[str, Any]]:
    emphasis: List[Dict[str, Any]] = []
    panel = _safe_dict(next_test_funnel.get("panel"))
    for domain, items in panel.items():
        if domain not in focus_domains:
            continue
        for item in _safe_list(items):
            if not isinstance(item, dict):
                continue
            marker = item.get("marker")
            if not _marker_in_focus(marker, domain, focus_markers_by_domain):
                continue
            already_addressed = _marker_already_addressed(
                marker, domain, outcome_attribution, intervention_memory, focus_markers_by_domain
            )
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
                        else f"Relevant to {context_label} monitoring in this domain."
                    ),
                }
            )
    return emphasis


def _build_velocity_notes(
    velocity_signals: List[Dict[str, Any]],
    *,
    focus_domains: List[str],
    focus_markers_by_domain: Dict[str, List[str]],
) -> List[Dict[str, Any]]:
    notes: List[Dict[str, Any]] = []
    for signal in velocity_signals:
        if not isinstance(signal, dict):
            continue
        domain = _domain_of(signal)
        marker = signal.get("marker")
        if domain not in focus_domains or not _marker_in_focus(marker, domain, focus_markers_by_domain):
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
    *,
    context_label: str,
) -> List[str]:
    prompts: List[str] = []

    for adj in priority_adjustments:
        if adj["profile_emphasis"] == "elevated":
            prompts.append(
                f"Consider discussing {adj.get('label') or adj['domain']} further "
                f"({adj['domain'].replace('_', ' ')}) in the context of {context_label}; "
                "a consistent focus-domain signal worth a conversation, not a conclusion on its own."
            )
        elif adj["profile_emphasis"] == "downgraded_due_to_contradiction":
            prompts.append(
                f"Before treating {adj.get('label') or adj['domain']} as a {context_label} priority, "
                f"discuss the unresolved contradiction noted in {adj['domain'].replace('_', ' ')}."
            )

    for note in context_notes:
        prompts.append(
            f"Data in {note['domain'].replace('_', ' ')} is currently insufficient ({note['debt_level']}) "
            f"for a confident {context_label} read; consider closing that gap first."
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


def _build_profile(
    profile_id: str,
    *,
    clinical_hypotheses: Dict[str, Any],
    clinical_contradictions: Dict[str, Any],
    velocity_signals: List[Dict[str, Any]],
    intervention_memory: Dict[str, Any],
    outcome_attribution: Dict[str, Any],
    evidence_debt: Dict[str, Any],
    next_test_funnel: Dict[str, Any],
) -> Dict[str, Any]:
    config = _PROFILE_CONFIGS[profile_id]
    focus_domains = config["focus_domains"]
    focus_markers_by_domain = config["focus_markers_by_domain"]
    context_label = config["context_label"]

    hypotheses = _safe_list(clinical_hypotheses.get("hypotheses"))
    contradictions = _safe_list(clinical_contradictions.get("contradictions"))

    priority_adjustments = _build_priority_adjustments(
        hypotheses, contradictions, intervention_memory,
        focus_domains=focus_domains, context_label=context_label,
    )
    context_notes = _build_context_notes(evidence_debt, focus_domains=focus_domains)
    velocity_notes = _build_velocity_notes(
        velocity_signals, focus_domains=focus_domains, focus_markers_by_domain=focus_markers_by_domain,
    )
    next_test_emphasis = _build_next_test_emphasis(
        next_test_funnel, outcome_attribution, intervention_memory,
        focus_domains=focus_domains, focus_markers_by_domain=focus_markers_by_domain, context_label=context_label,
    )
    practitioner_prompts = _build_practitioner_prompts(
        priority_adjustments, context_notes, velocity_notes, context_label=context_label,
    )

    elevated_count = len([a for a in priority_adjustments if a["profile_emphasis"] == "elevated"])
    downgraded_count = len([a for a in priority_adjustments if a["profile_emphasis"] == "downgraded_due_to_contradiction"])

    return {
        "profile_id": profile_id,
        "label": config["label"],
        "focus_domains": list(focus_domains),
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
    docstring. `confidence_calibration`, `negative_evidence`,
    `action_plan_by_role`, and `report_quality_audit` are accepted for
    forward-compatibility with future profiles/cross-checks but are not
    required by either profile implemented so far (calibrated confidence
    already lives merged onto each hypothesis). Never raises on missing/
    malformed input -- every field defaults to an empty container and the
    result is always a well-formed dict, even with zero upstream data.

    Only "longevity_metabolic_optimization" is active by default when
    `profile_ids` is omitted -- this is a deliberate backward-compatibility
    choice (P24.1 shipped with that as the sole default, and no
    profile-selection/targeting mechanism exists upstream yet). Pass
    `profile_ids=["athlete_recovery"]` (or both ids) explicitly to activate
    the second profile until that selection mechanism exists."""
    requested_ids = profile_ids if profile_ids else list(_DEFAULT_ACTIVE_PROFILE_IDS)

    profiles: List[Dict[str, Any]] = []
    unknown_profile_ids: List[str] = []
    for profile_id in requested_ids:
        if profile_id not in _PROFILE_CONFIGS:
            unknown_profile_ids.append(profile_id)
            continue
        profiles.append(
            _build_profile(
                profile_id,
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
