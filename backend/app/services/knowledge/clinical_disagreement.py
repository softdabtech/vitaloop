"""Clinical Disagreement Mode (P27, internal-only, backend-first v1).

NOT user-facing. This is an internal Ops/practitioner-trust and product-
research tool: it reads already-computed outputs from two independent
interpretation lenses that already exist in this codebase --

- VITALOOP Core reasoning: clinical_hypotheses' per-domain
  calibrated_confidence (P14+P16), and
- Population Profile overlays: population_profiles.py's per-domain
  priority_adjustments (P24) --

and reports where they diverge, in fixed, cautious language. It detects
NOTHING new: every "disagreement" here is a difference between two
numbers/labels the pipeline already computed, never a new clinical
judgment, never a new threshold, and never a claim that either lens is
"wrong". A population profile emphasizing a domain more than core
confidence does is framed as a difference in EMPHASIS/CONTEXT, never as
a contradiction of core reasoning -- see _classify_profile_divergence.

What counts as a real divergence (and what deliberately does NOT):
- Core calibrated_confidence is NOT already "high" AND a profile marks
  the same domain "elevated" -> a real divergence (the profile is
  emphasizing something core is not yet confident about). If core is
  already "high", a profile electing to also elevate it is AGREEMENT,
  not a divergence -- no record is created.
- A profile downgrades a domain ("downgraded_due_to_contradiction")
  while core's own calibrated_confidence for that domain is "high" or
  "moderate" -> a real divergence (the profile applied caution core's
  raw confidence label doesn't reflect). If core is already "low"/
  "blocked", both lenses already agree to be cautious -- no record.
- A profile leaves a domain at "standard" emphasis -> never a
  divergence; "standard" means the profile explicitly deferred to core.

What NEVER creates a disagreement record, by construction (the
corresponding data is either not read at all, or read only as read-only
context on an EXISTING record):
- negative_evidence is not an accepted parameter at all here -- there is
  nothing to compare it against (see negative_evidence.py's own domain-
  exclusion rule: a domain with an active hypothesis/pattern is excluded
  from negative_evidence, so the two data sources structurally never
  overlap anyway).
- evidence_debt only ever ADDS a cautionary limitation note to a domain
  that ALREADY has a disagreement record from the core-vs-profile
  comparison above -- it can never spawn a record by itself.
- rule_packs/rule_pack_quality are accepted for completeness (the
  roadmap explicitly asks this module to consider them) but v1 has no
  per-pack, per-domain CLINICAL POSITION to compare -- packs are
  provenance groupings over the SAME evaluator, not independent
  reasoning engines with their own stance on a domain. Passing them
  therefore always adds an explanatory limitation, never a disagreement
  record; see LIMITATIONS below and _RULE_PACK_LIMITATION_NOTE.
- doctor_escalation_precision (P25) is read ONLY to annotate
  `safety_impact` on an existing record -- this module has no code path
  that could write to, mutate, or otherwise influence an escalation
  level. A domain already carrying a doctor/urgent escalation keeps that
  escalation exactly as P25 computed it; this module can only ever
  report `safety_impact: "doctor_or_urgent_unchanged"` on top of it,
  never suppress, soften, or replace it.

Severity is a simple, documented function of how far apart the two
positions are (see _severity_for), not a new clinical risk score.

LIMITATIONS (documented, not hidden):
- Only two lenses are compared in v1: core clinical_hypotheses vs.
  population profile overlays. Rule-pack-vs-rule-pack comparison is not
  possible with current data (no per-pack report-level interpretation
  exists) -- always surfaced as a limitation when rule pack data is
  passed, never fabricated as a disagreement.
- Comparison is domain-level, not marker-level -- `marker` in each
  disagreement record is currently always null; the underlying
  clinical_hypotheses/priority_adjustments data this module reads is
  itself domain-level, not per-marker.
- `difference_type` values `threshold_philosophy`, `next_test_difference`,
  and `safety_difference` are reserved for a future version once a data
  source exists to populate them without inventing new logic; v1 only
  ever emits `priority_shift`, `profile_context_difference`, or
  `confidence_shift`.
- This is a governance/consistency signal for internal review, not a
  clinical accuracy or diagnosis tool.

No LLM anywhere in this module. Frozen replay: NOT APPLICABLE -- this
module is never called from lab_analysis_pipeline.py and is never
persisted into input_snapshot; it is an internal, on-demand comparison
over already-computed outputs, exactly like rule_pack_quality.py (P26)
and llm_cost_audit.py (P28) before it.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


CLINICAL_DISAGREEMENT_VERSION = "p27_v1"

_HIGH_CONFIDENCE = {"high"}
_MODERATE_CONFIDENCE = {"moderate"}
_LOW_CONFIDENCE = {"low", "blocked"}
_HIGH_DEBT_LEVELS = {"high", "blocked"}
_ESCALATION_SAFETY_LEVELS = {"doctor", "urgent"}

_RULE_PACK_LIMITATION_NOTE = (
    "Rule-pack-vs-rule-pack comparison was requested, but no per-pack, per-domain clinical position exists in "
    "the current data model to compare -- rule packs are provenance groupings over the same evaluator, not "
    "independent reasoning engines. No rule-pack disagreement was evaluated."
)

_FORBIDDEN_PHRASE_GUARD = (
    # Not user-facing content -- this tuple exists only so the module's own
    # test suite can assert against it in one place. See
    # docs/TRUST_AND_CLAIMS_GUIDELINES.md.
    "you have", "diagnosed", "diagnosis", "treat", "cure", "guarantee", "guaranteed",
)


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _domain_of(item: Dict[str, Any]) -> str:
    return str(item.get("domain") or "").strip().lower()


def _core_confidence_by_domain(clinical_hypotheses: Dict[str, Any]) -> Dict[str, Optional[str]]:
    by_domain: Dict[str, Optional[str]] = {}
    for hypothesis in _safe_list(clinical_hypotheses.get("hypotheses")):
        if not isinstance(hypothesis, dict):
            continue
        domain = _domain_of(hypothesis)
        if not domain:
            continue
        confidence = hypothesis.get("calibrated_confidence") or hypothesis.get("likelihood_bucket")
        confidence = str(confidence).strip().lower() if confidence else None
        # If a domain has multiple hypotheses, keep the highest-confidence
        # one as core's overall stance for that domain -- deterministic,
        # documented tie-break (order: high > moderate > low/blocked > None).
        rank = {"high": 3, "moderate": 2, "low": 1, "blocked": 1}
        existing = by_domain.get(domain)
        if existing is None or rank.get(confidence or "", 0) > rank.get(existing or "", 0):
            by_domain[domain] = confidence
    return by_domain


def _escalation_levels_by_domain(doctor_escalation_precision: Dict[str, Any]) -> Dict[str, str]:
    levels: Dict[str, str] = {}
    for escalation in _safe_list(doctor_escalation_precision.get("escalations")):
        if not isinstance(escalation, dict):
            continue
        domain = _domain_of(escalation)
        if domain:
            levels[domain] = str(escalation.get("level") or "").strip().lower()
    return levels


def _debt_level_by_domain(evidence_debt: Dict[str, Any]) -> Dict[str, str]:
    levels: Dict[str, str] = {}
    for entry in _safe_list(evidence_debt.get("domain_debt")):
        if isinstance(entry, dict):
            domain = _domain_of(entry)
            if domain:
                levels[domain] = str(entry.get("debt_level") or "").strip().lower()
    return levels


def _safety_impact_for(domain: str, escalation_levels: Dict[str, str]) -> str:
    level = escalation_levels.get(domain)
    if level in _ESCALATION_SAFETY_LEVELS:
        return "doctor_or_urgent_unchanged"
    if level == "practitioner":
        return "review_recommended"
    return "none"


def _classify_profile_divergence(
    *, domain: str, profile_id: str, profile_emphasis: str, core_confidence: Optional[str],
) -> Optional[Dict[str, str]]:
    """Returns None when the two lenses actually agree (no record should
    be created), or a dict describing the divergence otherwise. See
    module docstring for the exact agree/disagree rules."""
    if profile_emphasis == "elevated":
        if core_confidence in _HIGH_CONFIDENCE:
            return None  # agreement: both lenses already treat this domain seriously
        difference_type = "priority_shift" if core_confidence in _MODERATE_CONFIDENCE else "profile_context_difference"
        return {
            "difference_type": difference_type,
            "core_level": core_confidence or "unknown",
            "comparison_level": "elevated_priority",
            "severity": "moderate" if difference_type == "priority_shift" else "low",
            "explanation": (
                f"The {profile_id.replace('_', ' ')} profile gives {domain.replace('_', ' ')} more emphasis for its "
                f"focus context, while core reasoning's calibrated confidence here is "
                f"{'not yet established' if core_confidence is None else core_confidence}. This is a difference in "
                "emphasis, not a claim that core reasoning is incorrect."
            ),
        }
    if profile_emphasis == "downgraded_due_to_contradiction":
        if core_confidence not in (_HIGH_CONFIDENCE | _MODERATE_CONFIDENCE):
            return None  # agreement: both lenses are already cautious here
        return {
            "difference_type": "confidence_shift",
            "core_level": core_confidence,
            "comparison_level": "downgraded_emphasis",
            "severity": "high" if core_confidence in _HIGH_CONFIDENCE else "moderate",
            "explanation": (
                f"Core reasoning's calibrated confidence for {domain.replace('_', ' ')} is {core_confidence}, but the "
                f"{profile_id.replace('_', ' ')} profile applies additional caution here due to an unresolved "
                "contradiction. Neither lens is being overridden -- this flags where their emphasis diverges."
            ),
        }
    return None  # "standard" emphasis always means the profile deferred to core -- never a divergence


def build_clinical_disagreement(
    *,
    clinical_hypotheses: Dict[str, Any] | None = None,
    population_profile_overlays: Dict[str, Any] | None = None,
    population_profile_selection: Dict[str, Any] | None = None,
    doctor_escalation_precision: Dict[str, Any] | None = None,
    evidence_debt: Dict[str, Any] | None = None,
    rule_packs: Dict[str, Any] | None = None,
    rule_pack_quality: Dict[str, Any] | None = None,
    negative_evidence: Dict[str, Any] | None = None,  # accepted, never read -- see module docstring
) -> Dict[str, Any]:
    """Pure, read-only comparison over already-computed outputs -- see
    module docstring for what can and cannot create a disagreement
    record. Never raises on missing/malformed input, never mutates any
    input, and never touches negative_evidence's contents (accepted only
    so a caller can pass the same kwargs it already has on hand; see
    LIMITATIONS)."""
    clinical_hypotheses = _safe_dict(clinical_hypotheses)
    population_profile_overlays = _safe_dict(population_profile_overlays)
    population_profile_selection = _safe_dict(population_profile_selection)
    doctor_escalation_precision = _safe_dict(doctor_escalation_precision)
    evidence_debt = _safe_dict(evidence_debt)

    has_core_data = bool(_safe_list(clinical_hypotheses.get("hypotheses")))
    has_profile_data = bool(_safe_list(population_profile_overlays.get("profiles")))
    has_rule_pack_data = bool(rule_packs) or bool(rule_pack_quality)

    limitations: List[str] = []

    if not has_core_data and not has_profile_data and not has_rule_pack_data:
        return {
            "version": CLINICAL_DISAGREEMENT_VERSION,
            "status": "empty",
            "disagreements": [],
            "summary": {"total": 0, "by_type": {}, "by_domain": {}, "with_safety_impact": 0},
            "limitations": ["No comparable interpretation lenses were provided -- nothing to compare."],
        }

    if has_rule_pack_data:
        limitations.append(_RULE_PACK_LIMITATION_NOTE)

    if not has_core_data or not has_profile_data:
        limitations.append(
            "Only one interpretation lens (core reasoning or a population profile) was provided -- a "
            "core-vs-profile comparison requires both, so no disagreement could be evaluated."
        )
        return {
            "version": CLINICAL_DISAGREEMENT_VERSION,
            "status": "limited",
            "disagreements": [],
            "summary": {"total": 0, "by_type": {}, "by_domain": {}, "with_safety_impact": 0},
            "limitations": limitations,
        }

    core_confidence_by_domain = _core_confidence_by_domain(clinical_hypotheses)
    escalation_levels = _escalation_levels_by_domain(doctor_escalation_precision)
    debt_levels = _debt_level_by_domain(evidence_debt)
    active_profile_ids = set(_safe_list(population_profile_selection.get("active_profile_ids"))) or None

    disagreements: List[Dict[str, Any]] = []
    domains_with_debt_limitation: set[str] = set()

    for profile in _safe_list(population_profile_overlays.get("profiles")):
        if not isinstance(profile, dict):
            continue
        profile_id = str(profile.get("profile_id") or "").strip()
        if not profile_id or (active_profile_ids is not None and profile_id not in active_profile_ids):
            continue
        for adjustment in _safe_list(profile.get("priority_adjustments")):
            if not isinstance(adjustment, dict):
                continue
            domain = _domain_of(adjustment)
            if not domain:
                continue
            profile_emphasis = str(adjustment.get("profile_emphasis") or "").strip()
            core_confidence = core_confidence_by_domain.get(domain)

            classification = _classify_profile_divergence(
                domain=domain, profile_id=profile_id, profile_emphasis=profile_emphasis, core_confidence=core_confidence,
            )
            if classification is None:
                continue

            safety_impact = _safety_impact_for(domain, escalation_levels)
            debt_level = debt_levels.get(domain)
            if debt_level in _HIGH_DEBT_LEVELS:
                domains_with_debt_limitation.add(domain)

            disagreements.append(
                {
                    "id": f"{domain}_{profile_id}_{classification['difference_type']}",
                    "domain": domain,
                    "marker": None,  # v1 is domain-level only -- see LIMITATIONS
                    "difference_type": classification["difference_type"],
                    "core_position": {"level": classification["core_level"], "source": "clinical_hypotheses"},
                    "comparison_position": {
                        "level": classification["comparison_level"],
                        "source": f"population_profile:{profile_id}",
                    },
                    "severity": classification["severity"],
                    "safety_impact": safety_impact,
                    "explanation": classification["explanation"],
                    "not_a_diagnosis": True,
                }
            )

    for domain in sorted(domains_with_debt_limitation):
        limitations.append(
            f"Evidence debt for {domain.replace('_', ' ')} is currently {debt_levels[domain]} -- interpret the "
            "divergence(s) in this domain cautiously; incomplete data can itself look like disagreement."
        )

    if not disagreements:
        limitations.append("No divergence was found between core reasoning and the provided population profile(s).")
        status = "limited"
    else:
        status = "available"

    by_type: Dict[str, int] = {}
    by_domain: Dict[str, int] = {}
    with_safety_impact = 0
    for item in disagreements:
        by_type[item["difference_type"]] = by_type.get(item["difference_type"], 0) + 1
        by_domain[item["domain"]] = by_domain.get(item["domain"], 0) + 1
        if item["safety_impact"] != "none":
            with_safety_impact += 1

    return {
        "version": CLINICAL_DISAGREEMENT_VERSION,
        "status": status,
        "disagreements": disagreements,
        "summary": {
            "total": len(disagreements),
            "by_type": by_type,
            "by_domain": by_domain,
            "with_safety_impact": with_safety_impact,
        },
        "limitations": limitations,
    }
