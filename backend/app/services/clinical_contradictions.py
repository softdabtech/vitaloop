"""Clinical Contradiction Detector (P15, backend-only v1).

Deterministic layer that flags where one marker (or missing marker) makes
another marker/pattern/hypothesis harder to interpret cleanly — e.g. a
normal-or-high ferritin next to an elevated CRP, where ferritin is an acute
phase reactant and inflammation can mask a true iron deficiency. This is not
a new detection engine: each rule below reads biomarkers (by canonical name/
status), the already-detected `patterns`, and the already-built
`clinical_hypotheses`, and emits a contradiction record cross-referencing
them by id/domain — no new clinical judgment beyond "these two facts pull in
different directions" or "one signal needs the other to interpret safely".

No LLM anywhere in this module — `message` is fixed-template, deterministic,
and non-diagnostic (see docs/TRUST_AND_CLAIMS_GUIDELINES.md: "may", "can
limit interpretation", "possible signal", never "you have").

P16 (Confidence Calibration Engine) is the intended consumer of this
module's output — contradictions here are a signal, not yet wired back into
P14's hypothesis confidence_score. That wiring is deliberately deferred
(TODO P16) rather than folded into this stage, per the same
one-stage-at-a-time discipline as P11/P14.

Frozen-replay safe: pure function of biomarkers/patterns/hypotheses already
computed earlier in the same pipeline run — a contradiction list built from
a persisted input_snapshot is identical to one built at generation time.
"""

from __future__ import annotations

from typing import Any, Dict, List


CLINICAL_CONTRADICTIONS_VERSION = "clinical_contradictions_v1"

_LOW_STATUSES = {"DEFICIENT", "LOW", "L"}
_HIGH_STATUSES = {"ELEVATED", "HIGH", "H", "BORDERLINE"}
_NORMAL_STATUSES = {"OPTIMAL", "NORMAL", "IN_RANGE", "IN RANGE"}


def _marker_name(item: Dict[str, Any]) -> str:
    raw = str(item.get("canonical_name") or item.get("name") or item.get("source_name") or "")
    return raw.strip().lower().replace("-", "_").replace(" ", "_")


def _status(item: Dict[str, Any]) -> str:
    return str(item.get("status") or "").strip().upper()


def _value(item: Dict[str, Any]) -> float | None:
    value = item.get("value")
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _index_biomarkers(biomarkers: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Maps a marker key (e.g. "ferritin") to its biomarker dict. Later
    entries win on collision — good enough for a deterministic v1 where each
    panel realistically reports one value per marker."""
    index: Dict[str, Dict[str, Any]] = {}
    for item in biomarkers or []:
        if not isinstance(item, dict):
            continue
        name = _marker_name(item)
        if not name:
            continue
        index[name] = item
        # Also index by any word inside a multi-word canonical name so
        # "transferrin_saturation" is reachable via "transferrin" lookups
        # elsewhere without a second normalization pass.
        for part in name.split("_"):
            index.setdefault(part, item)
    return index


def _find(index: Dict[str, Dict[str, Any]], *aliases: str) -> Dict[str, Any] | None:
    for alias in aliases:
        item = index.get(alias)
        if item is not None:
            return item
    return None


def _is_low(item: Dict[str, Any] | None) -> bool:
    return item is not None and _status(item) in _LOW_STATUSES


def _is_high(item: Dict[str, Any] | None) -> bool:
    return item is not None and _status(item) in _HIGH_STATUSES


def _is_normal(item: Dict[str, Any] | None) -> bool:
    return item is not None and _status(item) in _NORMAL_STATUSES


def _pattern_ids_for_domain(patterns: List[Dict[str, Any]] | None, domain: str) -> List[str]:
    ids: List[str] = []
    for pattern in patterns or []:
        if not isinstance(pattern, dict):
            continue
        if str(pattern.get("domain") or "").strip().lower() != domain:
            continue
        pid = pattern.get("pattern_id") or pattern.get("key")
        if pid:
            ids.append(str(pid))
    return ids


def _hypothesis_ids_for_domain(hypotheses: List[Dict[str, Any]] | None, domain: str) -> List[str]:
    ids: List[str] = []
    for hypothesis in hypotheses or []:
        if not isinstance(hypothesis, dict):
            continue
        if str(hypothesis.get("domain") or "").strip().lower() != domain:
            continue
        hid = hypothesis.get("hypothesis_id")
        if hid:
            ids.append(str(hid))
    return ids


def _symptom_keys(symptoms: List[Any] | None) -> set[str]:
    keys: set[str] = set()
    for item in symptoms or []:
        if isinstance(item, dict):
            text = str(item.get("key") or item.get("name") or "").strip().lower()
        else:
            text = str(item or "").strip().lower()
        if text:
            keys.add(text)
    return keys


def _record(
    *,
    rule_id: str,
    domain: str,
    severity: str,
    markers: List[str],
    message: str,
    effect_on_confidence: str,
    recommended_next_tests: List[str],
    evidence_basis: List[str],
    patterns: List[Dict[str, Any]] | None,
    hypotheses: List[Dict[str, Any]] | None,
    doctor_flag: bool = False,
) -> Dict[str, Any]:
    return {
        "id": rule_id,
        "domain": domain,
        "severity": severity,
        "markers": markers,
        "related_patterns": _pattern_ids_for_domain(patterns, domain),
        "related_hypotheses": _hypothesis_ids_for_domain(hypotheses, domain),
        "message": message,
        "effect_on_confidence": effect_on_confidence,
        "recommended_next_tests": recommended_next_tests,
        "doctor_flag": doctor_flag,
        "evidence_basis": evidence_basis,
    }


# ---------------------------------------------------------------------------
# MVP rule set — deterministic, non-diagnostic, one rule per (domain, signal
# combination). Each rule reads only from `index` (biomarkers by name),
# `symptoms`, `patterns`, and `hypotheses` — no new markers/thresholds beyond
# status (LOW/HIGH/NORMAL) is invented here.
# ---------------------------------------------------------------------------


def _rule_ferritin_masked_by_inflammation(index, patterns, hypotheses) -> Dict[str, Any] | None:
    ferritin = _find(index, "ferritin")
    crp = _find(index, "crp", "c_reactive_protein", "hs_crp")
    if ferritin is None or crp is None:
        return None
    if not _is_high(crp):
        return None
    if not (_is_normal(ferritin) or _is_high(ferritin)):
        return None
    return _record(
        rule_id="ferritin_inflammation_context",
        domain="iron_anemia",
        severity="moderate",
        markers=["ferritin", "crp"],
        message=(
            "Ferritin can read as normal or high when an inflammation marker is "
            "elevated, which may mask a true iron deficiency signal."
        ),
        effect_on_confidence="downgrade",
        recommended_next_tests=["transferrin saturation", "TIBC", "serum iron"],
        evidence_basis=["ferritin present", "inflammation marker elevated"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


def _rule_low_ferritin_normal_hemoglobin(index, patterns, hypotheses) -> Dict[str, Any] | None:
    ferritin = _find(index, "ferritin")
    hemoglobin = _find(index, "hemoglobin", "hgb")
    if ferritin is None or hemoglobin is None:
        return None
    if not _is_low(ferritin) or not _is_normal(hemoglobin):
        return None
    return _record(
        rule_id="low_ferritin_normal_hemoglobin",
        domain="iron_anemia",
        severity="low",
        markers=["ferritin", "hemoglobin"],
        message=(
            "Low ferritin alongside a normal hemoglobin can be an early "
            "iron-store signal rather than anemia — the two markers do not "
            "confirm the same stage of iron depletion."
        ),
        effect_on_confidence="context_only",
        recommended_next_tests=["transferrin saturation", "serum iron"],
        evidence_basis=["ferritin low", "hemoglobin normal"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


def _rule_high_mcv_normal_b12(index, patterns, hypotheses) -> Dict[str, Any] | None:
    mcv = _find(index, "mcv")
    b12 = _find(index, "b12", "vitamin_b12", "cobalamin")
    if mcv is None or b12 is None:
        return None
    if not _is_high(mcv) or not (_is_normal(b12) or _is_high(b12)):
        return None
    return _record(
        rule_id="high_mcv_b12_context",
        domain="blood_count",
        severity="low",
        markers=["mcv", "b12"],
        message=(
            "An elevated MCV with normal or high B12 may point elsewhere — "
            "folate status, liver context, or supplementation can also raise "
            "red cell size."
        ),
        effect_on_confidence="context_only",
        recommended_next_tests=["folate", "liver panel"],
        evidence_basis=["mcv elevated", "b12 normal_or_high"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


def _rule_tsh_trend_normal_ft4(index, patterns, hypotheses) -> Dict[str, Any] | None:
    tsh = _find(index, "tsh")
    ft4 = _find(index, "free_t4", "ft4")
    if tsh is None or ft4 is None:
        return None
    if not _is_high(tsh) or not _is_normal(ft4):
        return None
    return _record(
        rule_id="tsh_ft4_subclinical_signal",
        domain="thyroid",
        severity="moderate",
        markers=["tsh", "free_t4"],
        message=(
            "An elevated TSH with a normal free T4 is a trend-style signal "
            "rather than an overt thyroid finding — it may be worth watching "
            "rather than acting on immediately."
        ),
        effect_on_confidence="downgrade",
        recommended_next_tests=["free T3", "TPO antibodies", "repeat TSH"],
        evidence_basis=["tsh elevated", "free_t4 normal"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


def _rule_thyroid_symptoms_missing_context(index, symptoms, patterns, hypotheses) -> Dict[str, Any] | None:
    thyroid_symptom_keys = {"fatigue", "hair_loss", "cold_intolerance", "weight_change", "brain_fog"}
    if not (symptoms & thyroid_symptom_keys):
        return None
    tsh = _find(index, "tsh")
    if tsh is None:
        return None
    ft3 = _find(index, "free_t3", "ft3")
    tpo = _find(index, "tpo", "tpo_antibodies", "anti_tpo")
    tgab = _find(index, "tgab", "thyroglobulin_antibodies", "anti_tg")
    if ft3 is not None and tpo is not None and tgab is not None:
        return None
    missing = [name for name, item in (("free T3", ft3), ("TPO antibodies", tpo), ("TgAb", tgab)) if item is None]
    return _record(
        rule_id="thyroid_symptoms_missing_context",
        domain="thyroid",
        severity="low",
        markers=["tsh"],
        message=(
            "Thyroid-related symptoms are present but part of the thyroid "
            "panel is missing, which can limit interpretation of the TSH "
            "value on its own."
        ),
        effect_on_confidence="downgrade",
        recommended_next_tests=missing,
        evidence_basis=["thyroid_symptom_reported", "thyroid_panel_incomplete"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


def _rule_normal_glucose_high_insulin(index, patterns, hypotheses) -> Dict[str, Any] | None:
    glucose = _find(index, "glucose", "fasting_glucose")
    insulin = _find(index, "insulin", "fasting_insulin")
    homa_ir = _find(index, "homa_ir", "homair")
    if glucose is None:
        return None
    if not _is_normal(glucose):
        return None
    if not (_is_high(insulin) or _is_high(homa_ir)):
        return None
    markers = ["glucose"] + (["insulin"] if insulin is not None else []) + (["homa_ir"] if homa_ir is not None else [])
    return _record(
        rule_id="normal_glucose_high_insulin",
        domain="metabolic",
        severity="moderate",
        markers=markers,
        message=(
            "Glucose alone reads as normal, but an elevated insulin or "
            "HOMA-IR can be an earlier metabolic-strain signal that glucose "
            "does not yet reflect."
        ),
        effect_on_confidence="downgrade",
        recommended_next_tests=["HbA1c", "fasting insulin", "HOMA-IR"],
        evidence_basis=["glucose normal", "insulin_or_homa_ir elevated"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


def _rule_hba1c_glucose_mismatch(index, patterns, hypotheses) -> Dict[str, Any] | None:
    glucose = _find(index, "glucose", "fasting_glucose")
    hba1c = _find(index, "hba1c", "hba1c_ifcc", "a1c")
    if glucose is None or hba1c is None:
        return None
    glucose_high = _is_high(glucose)
    hba1c_high = _is_high(hba1c)
    if glucose_high == hba1c_high:
        return None
    return _record(
        rule_id="hba1c_glucose_mismatch",
        domain="metabolic",
        severity="low",
        markers=["glucose", "hba1c"],
        message=(
            "Glucose and HbA1c point in different directions here, which can "
            "reflect timing (a recent change vs. a 3-month average) rather "
            "than a contradiction in the underlying picture."
        ),
        effect_on_confidence="context_only",
        recommended_next_tests=["repeat fasting glucose", "repeat HbA1c"],
        evidence_basis=["glucose_and_hba1c_disagree"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


def _rule_crp_nonspecific_symptoms(index, symptoms, patterns, hypotheses) -> Dict[str, Any] | None:
    crp = _find(index, "crp", "c_reactive_protein", "hs_crp")
    if not _is_high(crp):
        return None
    nonspecific = {"fatigue", "joint_pain", "brain_fog", "low_energy", "malaise"}
    matched = symptoms & nonspecific
    if len(matched) < 2:
        return None
    return _record(
        rule_id="crp_elevated_nonspecific_symptoms",
        domain="inflammation",
        severity="moderate",
        markers=["crp"],
        message=(
            "An elevated inflammation marker alongside several nonspecific "
            "symptoms may explain or distort findings in other domains "
            "(iron, thyroid, metabolic) rather than being independent."
        ),
        effect_on_confidence="downgrade",
        recommended_next_tests=["repeat CRP", "ESR"],
        evidence_basis=["crp elevated", "multiple_nonspecific_symptoms"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


def _rule_normal_liver_high_ggt(index, patterns, hypotheses) -> Dict[str, Any] | None:
    alt = _find(index, "alt")
    ast = _find(index, "ast")
    ggt = _find(index, "ggt")
    if ggt is None or not _is_high(ggt):
        return None
    if alt is None and ast is None:
        return None
    if (alt is not None and not _is_normal(alt)) or (ast is not None and not _is_normal(ast)):
        return None
    return _record(
        rule_id="normal_alt_ast_high_ggt",
        domain="liver_metabolic",
        severity="moderate",
        markers=["alt", "ast", "ggt"],
        message=(
            "ALT and AST are normal, but an elevated GGT can still be a "
            "liver or metabolic stress signal worth tracking rather than "
            "dismissing."
        ),
        effect_on_confidence="context_only",
        recommended_next_tests=["repeat GGT", "liver ultrasound (practitioner discretion)"],
        evidence_basis=["alt_ast_normal", "ggt_elevated"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


def _rule_liver_markers_supplement_context(index, supplements, patterns, hypotheses) -> Dict[str, Any] | None:
    alt = _find(index, "alt")
    ast = _find(index, "ast")
    if not (_is_high(alt) or _is_high(ast)):
        return None
    if not supplements:
        return None
    return _record(
        rule_id="elevated_liver_markers_supplement_context",
        domain="liver_metabolic",
        severity="high",
        markers=[name for name, item in (("alt", alt), ("ast", ast)) if _is_high(item)],
        message=(
            "Liver markers are elevated while supplement use is on file — "
            "this combination needs practitioner review rather than "
            "self-directed changes."
        ),
        effect_on_confidence="downgrade",
        recommended_next_tests=["repeat liver panel", "practitioner review of current supplements"],
        evidence_basis=["liver_marker_elevated", "supplement_context_present"],
        patterns=patterns,
        hypotheses=hypotheses,
        doctor_flag=True,
    )


def _rule_ldl_apob_mismatch(index, patterns, hypotheses) -> Dict[str, Any] | None:
    ldl = _find(index, "ldl", "ldl_cholesterol")
    apob = _find(index, "apob", "apo_b")
    if ldl is None or apob is None:
        return None
    if not _is_normal(ldl) or not _is_high(apob):
        return None
    return _record(
        rule_id="ldl_apob_mismatch",
        domain="lipids",
        severity="moderate",
        markers=["ldl", "apob"],
        message=(
            "LDL cholesterol looks normal, but an elevated ApoB suggests the "
            "particle-level picture may not match the LDL impression — ApoB "
            "reflects particle count more directly."
        ),
        effect_on_confidence="downgrade",
        recommended_next_tests=["repeat ApoB", "lipoprotein(a)"],
        evidence_basis=["ldl normal", "apob elevated"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


def _rule_triglycerides_low_hdl(index, patterns, hypotheses) -> Dict[str, Any] | None:
    triglycerides = _find(index, "triglycerides", "trig")
    hdl = _find(index, "hdl", "hdl_cholesterol")
    total_cholesterol = _find(index, "total_cholesterol", "cholesterol")
    if triglycerides is None or hdl is None:
        return None
    if not _is_high(triglycerides) or not _is_low(hdl):
        return None
    if total_cholesterol is not None and not _is_normal(total_cholesterol):
        return None
    return _record(
        rule_id="high_triglycerides_low_hdl",
        domain="lipids",
        severity="moderate",
        markers=["triglycerides", "hdl"],
        message=(
            "High triglycerides with low HDL is a cardiometabolic pattern "
            "signal that can be present even when total cholesterol looks "
            "normal on its own."
        ),
        effect_on_confidence="context_only",
        recommended_next_tests=["ApoB", "fasting insulin", "HbA1c"],
        evidence_basis=["triglycerides_high", "hdl_low"],
        patterns=patterns,
        hypotheses=hypotheses,
    )


_RULES_NO_SYMPTOMS = [
    _rule_ferritin_masked_by_inflammation,
    _rule_low_ferritin_normal_hemoglobin,
    _rule_high_mcv_normal_b12,
    _rule_tsh_trend_normal_ft4,
    _rule_normal_glucose_high_insulin,
    _rule_hba1c_glucose_mismatch,
    _rule_normal_liver_high_ggt,
    _rule_ldl_apob_mismatch,
    _rule_triglycerides_low_hdl,
]


def build_clinical_contradictions(
    biomarkers: List[Dict[str, Any]] | None,
    *,
    symptoms: List[Any] | None = None,
    patterns: List[Dict[str, Any]] | None = None,
    hypotheses: List[Dict[str, Any]] | None = None,
    supplement_context: List[Any] | None = None,
) -> Dict[str, Any]:
    """Returns {"version", "contradictions": [...], "summary": {...}}.

    Empty biomarkers -> empty contradictions list (never a fabricated
    contradiction record). `patterns`/`hypotheses` are optional cross-refs
    only — every rule still fires from biomarkers/symptoms alone."""
    index = _index_biomarkers(biomarkers or [])
    symptom_keys = _symptom_keys(symptoms)

    contradictions: List[Dict[str, Any]] = []
    if index:
        for rule in _RULES_NO_SYMPTOMS:
            try:
                result = rule(index, patterns, hypotheses)
            except Exception:
                # A single malformed marker must never take down the whole
                # report — skip that rule, keep the rest (defense-in-depth,
                # same posture as evidence_gaps.py's per-item tolerance).
                result = None
            if result:
                contradictions.append(result)

        for rule in (_rule_thyroid_symptoms_missing_context, _rule_crp_nonspecific_symptoms):
            try:
                result = rule(index, symptom_keys, patterns, hypotheses)
            except Exception:
                result = None
            if result:
                contradictions.append(result)

        try:
            result = _rule_liver_markers_supplement_context(index, bool(supplement_context), patterns, hypotheses)
        except Exception:
            result = None
        if result:
            contradictions.append(result)

    high_count = len([c for c in contradictions if c.get("severity") == "high"])
    doctor_flagged = len([c for c in contradictions if c.get("doctor_flag")])

    return {
        "version": CLINICAL_CONTRADICTIONS_VERSION,
        "contradictions": contradictions,
        "summary": {
            "count": len(contradictions),
            "high_severity_count": high_count,
            "doctor_flagged_count": doctor_flagged,
            "domains": sorted({c["domain"] for c in contradictions}),
        },
    }
