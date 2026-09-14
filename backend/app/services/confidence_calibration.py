"""Confidence Calibration Engine (P16, backend-only v1).

A single deterministic layer that turns each P14 hypothesis's raw
confidence into a calibrated confidence, by applying P15's contradictions,
evidence_gaps, symptom alignment, progress/trend history, and personal
baseline as adjustments — plus safety overrides — on top of what P14 already
computed. This is a CALIBRATION layer, not a new reasoning engine: it never
invents a hypothesis, never re-detects a pattern, and never changes medical
wording — it only adjusts a number and attaches machine-readable reason
codes explaining why.

No LLM anywhere in this module. Deterministic and frozen-replay safe: a
calibration built from a persisted input_snapshot (hypotheses + contradictions
+ evidence_gaps + progress_intelligence + personal_baseline, all already
computed earlier in the same pipeline run) is identical to one built at
generation time.

--------------------------------------------------------------------------
Scoring formula (documented here, not just in code, per P16 spec)
--------------------------------------------------------------------------
calibrated_score starts at the hypothesis's own P14 `confidence_score`
(already adjusted by P14 for THAT pattern's own contradicting_markers/
missing_context/domain evidence_gaps — see hypothesis_engine.py). P16 adds
a second, independent layer of adjustment using signals P14 does not see:

Positive adjustments (capped combined at +0.12):
  +0.02  required_markers_present   — hypothesis has >=1 supporting_evidence
  +0.05  supportive_symptom_match   — the source pattern's symptom_signal
                                       overlaps the user's reported symptoms
  +0.05  historical_confirmation    — progress_intelligence shows this same
                                       pattern_id "strengthened" since last
                                       upload
  +0.04  personal_baseline_confirms_direction — a supporting marker shows a
                                       silent_signal (drifting even though
                                       in reference range) in personal_baseline

Negative adjustments (each capped, see constants below):
  -0.10 per contradiction (cap -0.30) contradiction_downgrade — a P15
                                       contradiction whose effect_on_confidence
                                       is "downgrade" and whose domain or
                                       related_hypotheses matches this one
  -0.03 per gap (cap -0.15)          missing_confirmatory_tests — this
                                       hypothesis's domain evidence_gaps
  -0.05                              single_marker_support — supporting
                                       evidence has 0 or 1 marker
  -0.05                              historical_weakening — progress_intelligence
                                       shows this pattern_id "weakened"

Overrides (applied after the score is computed):
  - doctor_only: hypothesis.doctor_flag is True, OR any matching
    contradiction has doctor_flag True, OR the source pattern's safety_level
    is doctor-escalation-worthy. Takes priority over every other label.
  - blocked: any matching domain evidence_gap has reason
    "unit_not_reconcilable" (data literally cannot be reconciled), OR the
    calibrated_score falls below the "blocked" threshold. blocked yields to
    doctor_only if both would apply (a doctor-flagged item is never merely
    "blocked" — it needs a human, not more data).

Label thresholds (score-based, used only when no override applies):
  high     >= 0.75
  moderate >= 0.50 and < 0.75
  low      >= 0.25 and < 0.50
  blocked  <  0.25
"""

from __future__ import annotations

from typing import Any, Dict, List


CONFIDENCE_CALIBRATION_VERSION = "confidence_calibration_v1"

_SCORE_FLOOR = 0.05
_SCORE_CEILING = 1.0

_HIGH_THRESHOLD = 0.75
_MODERATE_THRESHOLD = 0.50
_LOW_THRESHOLD = 0.25

_REQUIRED_MARKERS_BONUS = 0.02
_SYMPTOM_MATCH_BONUS = 0.05
_HISTORICAL_CONFIRMATION_BONUS = 0.05
_BASELINE_CONFIRMS_BONUS = 0.04

_CONTRADICTION_PENALTY = 0.10
_MAX_CONTRADICTION_PENALTY = 0.30
_EVIDENCE_GAP_PENALTY = 0.03
_MAX_EVIDENCE_GAP_PENALTY = 0.15
_SINGLE_MARKER_PENALTY = 0.05
_HISTORICAL_WEAKENING_PENALTY = 0.05

_DOCTOR_SAFETY_LEVELS = {"doctor_only", "high_confidence_urgent", "blocked_by_missing_data"}


def _label_from_score(score: float) -> str:
    if score >= _HIGH_THRESHOLD:
        return "high"
    if score >= _MODERATE_THRESHOLD:
        return "moderate"
    if score >= _LOW_THRESHOLD:
        return "low"
    return "blocked"


def _marker_key(item: Any) -> str:
    if isinstance(item, dict):
        raw = item.get("canonical_name") or item.get("name") or ""
    else:
        raw = str(item or "")
    return str(raw).strip().lower().replace("-", "_").replace(" ", "_")


def _domain_of(item: Dict[str, Any]) -> str:
    return str(item.get("domain") or "").strip().lower()


def _contradictions_for_hypothesis(
    contradictions: List[Dict[str, Any]], *, domain: str, hypothesis_id: str
) -> List[Dict[str, Any]]:
    matched = []
    for c in contradictions or []:
        if not isinstance(c, dict):
            continue
        if _domain_of(c) == domain or hypothesis_id in (c.get("related_hypotheses") or []):
            matched.append(c)
    return matched


def _pattern_for_hypothesis(patterns: List[Dict[str, Any]] | None, hypothesis_id: str) -> Dict[str, Any] | None:
    for pattern in patterns or []:
        if not isinstance(pattern, dict):
            continue
        pid = pattern.get("pattern_id") or pattern.get("key")
        if pid and str(pid) == hypothesis_id:
            return pattern
    return None


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


def _progress_change_for(progress_intelligence: Dict[str, Any] | None, hypothesis_id: str) -> Dict[str, Any] | None:
    for change in (progress_intelligence or {}).get("changes") or []:
        if isinstance(change, dict) and str(change.get("pattern_id") or "") == hypothesis_id:
            return change
    return None

def _baseline_markers_confirm(
    personal_baseline: Dict[str, Any] | None, supporting_marker_keys: set[str]
) -> bool:
    for marker in (personal_baseline or {}).get("markers") or []:
        if not isinstance(marker, dict):
            continue
        if _marker_key(marker) in supporting_marker_keys and marker.get("silent_signal"):
            return True
    return False


def _is_doctor_escalation(
    hypothesis: Dict[str, Any],
    *,
    matched_contradictions: List[Dict[str, Any]],
    pattern: Dict[str, Any] | None,
) -> bool:
    if hypothesis.get("doctor_flag"):
        return True
    if any(c.get("doctor_flag") for c in matched_contradictions):
        return True
    if pattern and (pattern.get("doctor_escalation") or {}).get("triggered"):
        return True
    return False


def _calibrate_hypothesis(
    hypothesis: Dict[str, Any],
    *,
    contradictions: List[Dict[str, Any]] | None,
    evidence_gaps: Dict[str, Any] | None,
    patterns: List[Dict[str, Any]] | None,
    symptom_keys: set[str],
    progress_intelligence: Dict[str, Any] | None,
    personal_baseline: Dict[str, Any] | None,
) -> Dict[str, Any]:
    hypothesis_id = str(hypothesis.get("hypothesis_id") or "")
    domain = _domain_of(hypothesis)

    raw_score = hypothesis.get("confidence_score")
    raw_score = float(raw_score) if isinstance(raw_score, (int, float)) else 0.5
    raw_confidence = _label_from_score(raw_score)

    score = raw_score
    reason_codes: List[str] = []
    positive_factors: List[str] = []
    negative_factors: List[str] = []

    supporting_evidence = hypothesis.get("supporting_evidence") or []
    supporting_marker_keys = {_marker_key(item) for item in supporting_evidence if _marker_key(item)}

    if supporting_evidence:
        score += _REQUIRED_MARKERS_BONUS
        reason_codes.append("required_markers_present")
        positive_factors.append("Required markers for this pattern are present.")
    else:
        pass

    if len(supporting_evidence) <= 1:
        score -= _SINGLE_MARKER_PENALTY
        reason_codes.append("single_marker_support")
        negative_factors.append("Only one marker supports this pattern.")

    pattern = _pattern_for_hypothesis(patterns, hypothesis_id)
    pattern_symptoms = {
        str(s).strip().lower() for s in ((pattern or {}).get("symptom_signal") or [])
    }
    if pattern_symptoms and (pattern_symptoms & symptom_keys):
        score += _SYMPTOM_MATCH_BONUS
        reason_codes.append("supportive_symptom_match")
        positive_factors.append("Reported symptoms support this pattern.")

    matched_contradictions = _contradictions_for_hypothesis(
        contradictions or [], domain=domain, hypothesis_id=hypothesis_id
    )
    downgrade_contradictions = [
        c for c in matched_contradictions if c.get("effect_on_confidence") == "downgrade"
    ]
    if downgrade_contradictions:
        penalty = min(_MAX_CONTRADICTION_PENALTY, _CONTRADICTION_PENALTY * len(downgrade_contradictions))
        score -= penalty
        reason_codes.append("contradiction_downgrade")
        for c in downgrade_contradictions:
            negative_factors.append(str(c.get("message") or "A related contradiction limits this pattern."))
    for c in matched_contradictions:
        if c.get("effect_on_confidence") == "context_only":
            negative_factors.append(str(c.get("message") or "Related context may limit interpretation."))

    domain_gaps = [
        g for g in (evidence_gaps or {}).get("gaps") or []
        if isinstance(g, dict) and _domain_of(g) == domain
    ]
    if domain_gaps:
        penalty = min(_MAX_EVIDENCE_GAP_PENALTY, _EVIDENCE_GAP_PENALTY * len(domain_gaps))
        score -= penalty
        reason_codes.append("missing_confirmatory_tests")
        negative_factors.append(f"{len(domain_gaps)} confirmatory marker(s) for this domain are missing.")

    blocked_by_gap = any(g.get("reason") == "unit_not_reconcilable" for g in domain_gaps)

    change = _progress_change_for(progress_intelligence, hypothesis_id)
    if change:
        status = change.get("status")
        if status == "strengthened":
            score += _HISTORICAL_CONFIRMATION_BONUS
            reason_codes.append("historical_confirmation")
            positive_factors.append("This pattern has strengthened since the last upload.")
        elif status == "weakened":
            score -= _HISTORICAL_WEAKENING_PENALTY
            reason_codes.append("historical_weakening")
            negative_factors.append("This pattern has weakened since the last upload.")

    if _baseline_markers_confirm(personal_baseline, supporting_marker_keys):
        score += _BASELINE_CONFIRMS_BONUS
        reason_codes.append("personal_baseline_confirms_direction")
        positive_factors.append("A supporting marker is drifting from this user's own baseline.")

    score = max(_SCORE_FLOOR, min(_SCORE_CEILING, score))

    doctor_only = _is_doctor_escalation(hypothesis, matched_contradictions=matched_contradictions, pattern=pattern)
    blocked = blocked_by_gap or score < _LOW_THRESHOLD

    if doctor_only:
        calibrated_confidence = "doctor_only"
        reason_codes.append("safety_escalation")
    elif blocked:
        calibrated_confidence = "blocked"
        if blocked_by_gap:
            reason_codes.append("blocked_insufficient_data")
    else:
        calibrated_confidence = _label_from_score(score)

    # Dedup reason codes while preserving first-seen order (stable, no set
    # reordering across runs with identical input).
    seen: set[str] = set()
    deduped_codes = [c for c in reason_codes if not (c in seen or seen.add(c))]

    return {
        "target_type": "hypothesis",
        "target_id": hypothesis_id,
        "domain": domain,
        "raw_confidence": raw_confidence,
        "raw_score": round(raw_score, 3),
        "calibrated_confidence": calibrated_confidence,
        "calibrated_score": round(score, 3),
        "reason_codes": deduped_codes,
        "positive_factors": positive_factors,
        "negative_factors": negative_factors,
        "blocked": calibrated_confidence == "blocked",
        "doctor_only": calibrated_confidence == "doctor_only",
    }


def build_confidence_calibration(
    hypotheses: List[Dict[str, Any]] | None,
    *,
    contradictions: List[Dict[str, Any]] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
    patterns: List[Dict[str, Any]] | None = None,
    symptoms: List[Any] | None = None,
    progress_intelligence: Dict[str, Any] | None = None,
    personal_baseline: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """One calibrated_item per P14 hypothesis. Empty input -> a valid empty
    calibration object, never a fabricated item."""
    valid_hypotheses = [h for h in (hypotheses or []) if isinstance(h, dict)]

    if not valid_hypotheses:
        return {
            "version": CONFIDENCE_CALIBRATION_VERSION,
            "overall_confidence": "low",
            "overall_score": 0,
            "calibrated_items": [],
        }

    symptom_keys = _symptom_keys(symptoms)
    calibrated_items: List[Dict[str, Any]] = []
    for hypothesis in valid_hypotheses:
        try:
            item = _calibrate_hypothesis(
                hypothesis,
                contradictions=contradictions,
                evidence_gaps=evidence_gaps,
                patterns=patterns,
                symptom_keys=symptom_keys,
                progress_intelligence=progress_intelligence,
                personal_baseline=personal_baseline,
            )
        except Exception:
            # One malformed hypothesis must not take down calibration for
            # the rest of the report — same defense-in-depth posture as
            # clinical_contradictions.py's per-rule try/except.
            item = None
        if item:
            calibrated_items.append(item)

    overall_score = round(
        sum(item["calibrated_score"] for item in calibrated_items) / len(calibrated_items), 3
    ) if calibrated_items else 0.0

    if any(item["doctor_only"] for item in calibrated_items):
        overall_confidence = "doctor_only"
    elif calibrated_items and all(item["blocked"] for item in calibrated_items):
        overall_confidence = "blocked"
    else:
        overall_confidence = _label_from_score(overall_score)

    return {
        "version": CONFIDENCE_CALIBRATION_VERSION,
        "overall_confidence": overall_confidence,
        "overall_score": overall_score,
        "calibrated_items": calibrated_items,
    }


def apply_calibration_to_hypotheses(
    hypotheses: List[Dict[str, Any]] | None, calibration: Dict[str, Any] | None
) -> List[Dict[str, Any]]:
    """Returns a NEW list of hypothesis dicts with calibrated_confidence/
    calibrated_score/calibration_reason_codes merged in by target_id —
    every original P14 field is preserved untouched. A hypothesis with no
    matching calibrated_item (should not happen in practice, but frozen
    rows from a pre-P16 snapshot won't have one) is returned unchanged.
    """
    by_id = {
        item.get("target_id"): item
        for item in (calibration or {}).get("calibrated_items") or []
        if isinstance(item, dict)
    }
    merged: List[Dict[str, Any]] = []
    for hypothesis in hypotheses or []:
        if not isinstance(hypothesis, dict):
            continue
        calibrated = by_id.get(hypothesis.get("hypothesis_id"))
        new_hypothesis = dict(hypothesis)
        if calibrated:
            new_hypothesis["calibrated_confidence"] = calibrated.get("calibrated_confidence")
            new_hypothesis["calibrated_score"] = calibrated.get("calibrated_score")
            new_hypothesis["calibration_reason_codes"] = calibrated.get("reason_codes")
        merged.append(new_hypothesis)
    return merged
