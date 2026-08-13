from __future__ import annotations

from typing import Any, Dict, List


ANALYSIS_INPUT_QUALITY_GATE_VERSION = "analysis_input_quality_gate_v1"


def _candidate_scores(candidates: List[Dict[str, Any]] | None) -> List[float]:
    scores: List[float] = []
    for item in candidates or []:
        try:
            scores.append(float(item.get("confidence_score")))
        except (TypeError, ValueError):
            continue
    return scores


def _readiness_score(health_context: Dict[str, Any] | None) -> tuple[float, List[str]]:
    readiness = (health_context or {}).get("readiness") or {}
    score = 0.0
    reasons: List[str] = []
    if readiness.get("has_biomarkers"):
        score += 0.35
        reasons.append("biomarkers_present")
    if readiness.get("has_profile"):
        score += 0.2
        reasons.append("profile_present")
    if readiness.get("has_symptoms"):
        score += 0.15
        reasons.append("symptoms_present")
    if readiness.get("has_questionnaire"):
        score += 0.15
        reasons.append("questionnaire_present")
    if readiness.get("has_safety_context"):
        score += 0.15
        reasons.append("safety_context_present")
    return min(score, 1.0), reasons


def build_analysis_input_quality_gate(
    *,
    biomarkers: List[Dict[str, Any]],
    candidates: List[Dict[str, Any]] | None = None,
    clinical_integrity: Dict[str, Any] | None = None,
    health_context: Dict[str, Any] | None = None,
    source_metadata: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Score whether the whole input is strong enough for interpretation.

    This is intentionally conservative. It does not block legacy flows yet; it
    produces a decision artifact the API/FE can use for confirmation UX.
    """

    scores = _candidate_scores(candidates)
    reasons: List[str] = []
    blockers: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []

    marker_count = len(biomarkers or [])
    if marker_count:
        marker_component = 0.25
        reasons.append("normalized_biomarkers_present")
    else:
        marker_component = 0.0
        blockers.append({"key": "no_normalized_biomarkers", "message": "No normalized biomarkers are available."})

    if scores:
        average_candidate_confidence = sum(scores) / len(scores)
        low_candidate_count = len([score for score in scores if score < 0.55])
        medium_candidate_count = len([score for score in scores if 0.55 <= score < 0.8])
    else:
        average_candidate_confidence = 0.75 if marker_count else 0.0
        low_candidate_count = 0
        medium_candidate_count = 0

    candidate_component = 0.25 * average_candidate_confidence
    if scores:
        reasons.append("candidate_confidence_available")
    else:
        warnings.append({"key": "candidate_confidence_missing", "message": "Candidate confidence was not available for this input."})

    integrity_summary = (clinical_integrity or {}).get("summary") or {}
    integrity_issues = (clinical_integrity or {}).get("issues") or []
    high_integrity_issues = int(integrity_summary.get("high_issue_count") or 0)
    medium_integrity_issues = int(integrity_summary.get("medium_issue_count") or 0)
    conflict_issue_keys = {
        "unknown_unit",
        "physiologically_implausible_value",
        "invalid_lab_reference_range",
        "missing_numeric_value",
    }
    integrity_conflicts = [
        item
        for item in integrity_issues
        if item.get("key") in conflict_issue_keys or item.get("severity") == "high"
    ]
    pediatric_context = bool(integrity_summary.get("pediatric_context"))
    profile_complete = bool(integrity_summary.get("profile_complete"))
    if high_integrity_issues:
        integrity_component = 0.05
        blockers.append({"key": "clinical_integrity_high_issues", "count": high_integrity_issues})
    elif medium_integrity_issues:
        integrity_component = 0.15
        warnings.append({"key": "clinical_integrity_warnings", "count": medium_integrity_issues})
    else:
        integrity_component = 0.25
        reasons.append("clinical_integrity_passed")

    readiness_component, readiness_reasons = _readiness_score(health_context)
    readiness_component *= 0.25
    reasons.extend(readiness_reasons)

    score = round(min(marker_component + candidate_component + integrity_component + readiness_component, 1.0), 3)

    if low_candidate_count:
        warnings.append({"key": "low_confidence_candidates", "count": low_candidate_count})
    if medium_candidate_count:
        warnings.append({"key": "medium_confidence_candidates", "count": medium_candidate_count})

    if low_candidate_count:
        blockers.append({"key": "low_confidence_candidates", "count": low_candidate_count})
    if integrity_conflicts:
        blockers.append(
            {
                "key": "unit_or_plausibility_conflict",
                "count": len(integrity_conflicts),
                "issues": [
                    {
                        "key": item.get("key"),
                        "marker": item.get("marker"),
                        "severity": item.get("severity"),
                    }
                    for item in integrity_conflicts[:5]
                ],
            }
        )
    if pediatric_context and not profile_complete:
        blockers.append({"key": "pediatric_profile_safety_gap", "message": "Pediatric interpretation requires complete profile context."})

    if blockers:
        decision = "block_or_confirm"
    elif score >= 0.82 and not low_candidate_count:
        decision = "auto_continue"
    elif score >= 0.55:
        decision = "confirm"
    else:
        decision = "block_or_confirm"

    return {
        "version": ANALYSIS_INPUT_QUALITY_GATE_VERSION,
        "score": score,
        "label": "high" if score >= 0.82 else "medium" if score >= 0.55 else "low",
        "decision": decision,
        "requires_confirmation": decision != "auto_continue",
        "components": {
            "marker_presence": round(marker_component, 3),
            "candidate_confidence": round(candidate_component, 3),
            "clinical_integrity": round(integrity_component, 3),
            "context_readiness": round(readiness_component, 3),
        },
        "candidate_summary": {
            "count": len(scores),
            "average_confidence": round(average_candidate_confidence, 3),
            "low_count": low_candidate_count,
            "medium_count": medium_candidate_count,
        },
        "warnings": warnings,
        "blockers": blockers,
        "reasons": reasons,
        "source": source_metadata or {},
    }
