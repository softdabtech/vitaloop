"""Negative Evidence Layer (P17, backend-only v1).

Surfaces the domains this report actively checked and found no strong
signal in — NOT "the user does not have a problem", but "given the markers
available in this upload, this domain did not produce a strong pattern,
hypothesis, or contradiction". A domain with poor marker coverage is never
reported as stable; it is reported as under-tested instead, because a
confident negative claim requires the same evidence quality a positive one
would.

Deliberately downstream of P14/P15/P16: a domain is excluded from this
layer entirely (not "stable", not "under-tested" — simply not surfaced
here) whenever it already has an active pattern, an active hypothesis with
moderate-or-higher calibrated confidence, or any doctor/urgent safety flag
— those domains are already being reported elsewhere in the report, and
restating "no strong signal" next to them would be actively misleading.

No LLM anywhere in this module. Wording is fixed-template and restricted to
non-diagnostic phrasing (see docs/TRUST_AND_CLAIMS_GUIDELINES.md):
  - "No strong signal detected in this upload"
  - "Available markers did not show a strong pattern"
  - "This domain appears stable based on available markers"
  - "Cannot assess confidently because key markers are missing"
Never: "ruled out", "no disease", "you do not have", "confirmed normal",
"guaranteed healthy", "clear of" — this module does not use any of those
phrases anywhere, by construction (every string is a fixed template
authored once, listed at the top of this file, not composed at runtime
from free text).

Frozen-replay safe: pure function of biomarkers + patterns + hypotheses +
contradictions + evidence_gaps, all already computed earlier in the same
pipeline run — identical output from a persisted input_snapshot as from
generation time.
"""

from __future__ import annotations

from typing import Any, Dict, List


NEGATIVE_EVIDENCE_VERSION = "negative_evidence_v1"

# Domain vocabulary matches report_interpretation.py's actual pattern
# `domain` values (iron_status, metabolic_health, cardiovascular, thyroid,
# liver, inflammation, micronutrients, kidney — see that module's
# _build_pattern call sites) — NOT evidence_gaps.py's older, narrower
# domain keys, so pattern/hypothesis cross-referencing here actually
# matches in production (the same mismatch was just fixed in
# clinical_contradictions.py's rule domains for the same reason).
_DOMAIN_MARKERS: Dict[str, Dict[str, List[str]]] = {
    "kidney": {
        "required": ["creatinine", "egfr"],
        "supportive": ["bun", "urea", "urine_albumin_creatinine_ratio"],
    },
    "liver": {
        "required": ["alt", "ast"],
        "supportive": ["ggt", "bilirubin"],
    },
    "inflammation": {
        "required": ["crp"],
        "supportive": ["esr"],
    },
    "metabolic_health": {
        "required": ["glucose", "hba1c"],
        "supportive": ["insulin", "homa_ir"],
    },
    "cardiovascular": {
        "required": ["ldl", "hdl", "triglycerides"],
        "supportive": ["apob", "total_cholesterol"],
    },
    "thyroid": {
        "required": ["tsh"],
        "supportive": ["free_t4", "free_t3", "tpo_antibodies", "thyroglobulin_antibodies"],
    },
    "iron_status": {
        "required": ["ferritin", "hemoglobin"],
        "supportive": ["transferrin_saturation", "iron", "tibc"],
    },
    "micronutrients": {
        "required": ["vitamin_d", "b12"],
        "supportive": ["folate", "magnesium", "zinc"],
    },
}

_HUMAN_MARKER_NAMES = {
    "creatinine": "creatinine",
    "egfr": "eGFR",
    "bun": "BUN",
    "urea": "urea",
    "urine_albumin_creatinine_ratio": "urine albumin/creatinine ratio",
    "alt": "ALT",
    "ast": "AST",
    "ggt": "GGT",
    "bilirubin": "bilirubin",
    "crp": "CRP",
    "esr": "ESR",
    "glucose": "glucose",
    "hba1c": "HbA1c",
    "insulin": "fasting insulin",
    "homa_ir": "HOMA-IR",
    "ldl": "LDL",
    "hdl": "HDL",
    "triglycerides": "triglycerides",
    "apob": "ApoB",
    "total_cholesterol": "total cholesterol",
    "tsh": "TSH",
    "free_t4": "Free T4",
    "free_t3": "Free T3",
    "tpo_antibodies": "TPO antibodies",
    "thyroglobulin_antibodies": "TgAb",
    "ferritin": "ferritin",
    "hemoglobin": "hemoglobin",
    "transferrin_saturation": "transferrin saturation",
    "iron": "serum iron",
    "tibc": "TIBC",
    "vitamin_d": "vitamin D",
    "b12": "vitamin B12",
    "folate": "folate",
    "magnesium": "magnesium",
    "zinc": "zinc",
}


def _human_name(marker_key: str) -> str:
    return _HUMAN_MARKER_NAMES.get(marker_key, marker_key.replace("_", " "))


def _marker_name(item: Dict[str, Any]) -> str:
    raw = str(item.get("canonical_name") or item.get("name") or item.get("source_name") or "")
    return raw.strip().lower().replace("-", "_").replace(" ", "_")


def _index_biomarkers(biomarkers: List[Dict[str, Any]] | None) -> set[str]:
    keys: set[str] = set()
    for item in biomarkers or []:
        if not isinstance(item, dict):
            continue
        name = _marker_name(item)
        if name:
            keys.add(name)
            keys.update(name.split("_"))
    return keys


def _coverage_label(required_present: int, required_total: int, supportive_present: int) -> str:
    if required_total == 0:
        return "sufficient" if supportive_present else "none"
    if required_present == required_total:
        return "sufficient"
    if required_present > 0:
        return "partial"
    if supportive_present > 0:
        return "limited"
    return "none"


def _has_active_pattern(patterns: List[Dict[str, Any]] | None, domain: str) -> bool:
    for pattern in patterns or []:
        if isinstance(pattern, dict) and str(pattern.get("domain") or "").strip().lower() == domain:
            return True
    return False


def _has_active_hypothesis(hypotheses: List[Dict[str, Any]] | None, domain: str) -> bool:
    for hypothesis in hypotheses or []:
        if not isinstance(hypothesis, dict):
            continue
        if str(hypothesis.get("domain") or "").strip().lower() != domain:
            continue
        confidence = hypothesis.get("calibrated_confidence") or hypothesis.get("likelihood_bucket")
        if confidence in {"high", "moderate", "likely", "possible"}:
            return True
    return False


def _has_doctor_flag(
    hypotheses: List[Dict[str, Any]] | None, contradictions: List[Dict[str, Any]] | None, domain: str
) -> bool:
    for hypothesis in hypotheses or []:
        if not isinstance(hypothesis, dict):
            continue
        if str(hypothesis.get("domain") or "").strip().lower() != domain:
            continue
        if hypothesis.get("doctor_only") or hypothesis.get("doctor_flag"):
            return True
    for c in contradictions or []:
        if isinstance(c, dict) and str(c.get("domain") or "").strip().lower() == domain and c.get("doctor_flag"):
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


def _assess_domain(
    domain: str,
    *,
    marker_keys: set[str],
    patterns: List[Dict[str, Any]] | None,
    hypotheses: List[Dict[str, Any]] | None,
    contradictions: List[Dict[str, Any]] | None,
    evidence_gaps: Dict[str, Any] | None,
) -> Dict[str, Any] | None:
    """Returns a domain record, or None if this domain already has a
    strong signal reported elsewhere (active pattern/hypothesis/safety
    flag) and therefore does not belong in a negative-evidence layer."""
    spec = _DOMAIN_MARKERS[domain]
    required = spec["required"]
    supportive = spec["supportive"]

    required_present = [m for m in required if m in marker_keys]
    supportive_present = [m for m in supportive if m in marker_keys]
    markers_checked = required_present + supportive_present

    if _has_active_pattern(patterns, domain) or _has_active_hypothesis(hypotheses, domain):
        return None
    if _has_doctor_flag(hypotheses, contradictions, domain):
        return None

    coverage = _coverage_label(len(required_present), len(required), len(supportive_present))
    domain_contradictions = _contradictions_for_domain(contradictions, domain)
    domain_gaps = _gaps_for_domain(evidence_gaps, domain)

    missing_required = [m for m in required if m not in marker_keys]
    missing_supportive = [m for m in supportive if m not in marker_keys]
    limitations = [f"{_human_name(m)} was not available." for m in missing_required + missing_supportive]

    if domain_contradictions:
        status = "conflicting_evidence"
        confidence = "low"
        reason = (
            "Some markers in this domain point in different directions in this "
            "upload, so a single stable read is not appropriate yet."
        )
    elif coverage == "sufficient":
        status = "no_strong_signal_detected"
        confidence = "high" if not domain_gaps else "moderate"
        reason = (
            "Available markers did not show a strong out-of-range or "
            "trend-based signal in this upload."
        )
    elif coverage == "partial":
        status = "stable_with_limitations"
        confidence = "moderate" if len(required_present) >= max(1, len(required) - 1) else "low"
        reason = (
            "This domain appears stable based on available markers, but part "
            "of the usual panel was not available."
        )
    elif coverage == "limited":
        status = "under_tested"
        confidence = "low"
        reason = "Cannot assess confidently because key markers are missing."
    else:
        status = "not_assessed"
        confidence = "low"
        reason = "Cannot assess confidently because key markers are missing."

    return {
        "domain": domain,
        "status": status,
        "coverage": coverage,
        "confidence": confidence,
        "markers_checked": [_human_name(m) for m in markers_checked],
        "reason": reason,
        "limitations": limitations,
        "related_evidence_gaps": [g.get("missing_marker") for g in domain_gaps if g.get("missing_marker")],
        "safety_note": None,
    }


def build_negative_evidence(
    biomarkers: List[Dict[str, Any]] | None,
    *,
    patterns: List[Dict[str, Any]] | None = None,
    hypotheses: List[Dict[str, Any]] | None = None,
    contradictions: List[Dict[str, Any]] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Evaluates the fixed MVP domain list against this upload's markers.
    Never crashes on malformed input; a domain whose evaluation raises is
    simply skipped (defense-in-depth, same posture as clinical_contradictions
    and confidence_calibration)."""
    marker_keys = _index_biomarkers(biomarkers)

    stable_domains: List[Dict[str, Any]] = []
    under_tested_domains: List[Dict[str, Any]] = []

    for domain in sorted(_DOMAIN_MARKERS):
        try:
            record = _assess_domain(
                domain,
                marker_keys=marker_keys,
                patterns=patterns,
                hypotheses=hypotheses,
                contradictions=contradictions,
                evidence_gaps=evidence_gaps,
            )
        except Exception:
            record = None
        if record is None:
            continue
        if record["status"] in {"no_strong_signal_detected", "stable_with_limitations", "conflicting_evidence"}:
            stable_domains.append(record)
        else:
            under_tested_domains.append(record)

    return {
        "version": NEGATIVE_EVIDENCE_VERSION,
        "domains_checked": len(_DOMAIN_MARKERS),
        "stable_domains": stable_domains,
        "under_tested_domains": under_tested_domains,
    }
