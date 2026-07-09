from __future__ import annotations

from typing import Any, Dict, List


def _missing_profile_context(profile: Dict[str, Any] | None) -> List[str]:
    profile = profile if isinstance(profile, dict) else {}
    required = ("age", "sex", "height_cm", "weight_kg")
    return [field for field in required if profile.get(field) in (None, "", [])]


def build_marker_explanation(
    marker: Dict[str, Any],
    *,
    symptoms: List[str] | None = None,
    profile: Dict[str, Any] | None = None,
    matched_rule: Dict[str, Any] | None = None,
    safety_notes: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    return {
        "triggered_biomarker": {
            "name": marker.get("name") or marker.get("source_name"),
            "value": marker.get("value"),
            "unit": marker.get("unit"),
            "status": marker.get("status"),
            "reference_range": marker.get("reference_range")
            or (
                f"{marker.get('ref_low')} - {marker.get('ref_high')} {marker.get('unit') or ''}".strip()
                if marker.get("ref_low") is not None and marker.get("ref_high") is not None
                else None
            ),
        },
        "symptom_signal": symptoms or [],
        "profile_signal": {
            "age": (profile or {}).get("age"),
            "sex": (profile or {}).get("sex"),
        },
        "matched_rule_key": (matched_rule or {}).get("rule_key"),
        "confidence": (matched_rule or {}).get("confidence"),
        "evidence_level": (matched_rule or {}).get("evidence_level") or (matched_rule or {}).get("source"),
        "missing_context": _missing_profile_context(profile),
        "safety_notes": safety_notes or [],
    }


def build_recommendation_explanations(
    *,
    biomarkers: List[Dict[str, Any]] | None = None,
    symptoms: List[str] | None = None,
    profile: Dict[str, Any] | None = None,
    knowledge_evaluation: Dict[str, Any] | None = None,
    recommendations: List[Dict[str, Any]] | None = None,
    safety_result: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    biomarkers = biomarkers or []
    matched_rules = (knowledge_evaluation or {}).get("matched_rules") or []
    recommendations = recommendations or (knowledge_evaluation or {}).get("generated_recommendations") or []
    safety_notes = (safety_result or {}).get("warnings") or []

    marker_explanations = [
        build_marker_explanation(
            marker,
            symptoms=symptoms,
            profile=profile,
            matched_rule=matched_rules[0] if matched_rules else None,
            safety_notes=safety_notes,
        )
        for marker in biomarkers
        if str(marker.get("status") or "").upper() != "OPTIMAL"
    ]

    recommendation_explanations = []
    for rec in recommendations:
        if not isinstance(rec, dict):
            continue
        related_rule = None
        rec_key = rec.get("key")
        for rule in matched_rules:
            if rec_key in (rule.get("recommendation_keys") or []):
                related_rule = rule
                break
        recommendation_explanations.append(
            {
                "recommendation_key": rec_key or rec.get("title") or rec.get("supplement"),
                "triggered_biomarker": marker_explanations[0]["triggered_biomarker"] if marker_explanations else None,
                "symptom_signal": symptoms or [],
                "profile_signal": {
                    "age": (profile or {}).get("age"),
                    "sex": (profile or {}).get("sex"),
                },
                "matched_rule_key": (related_rule or {}).get("rule_key"),
                "confidence": (related_rule or {}).get("confidence") or (knowledge_evaluation or {}).get("confidence"),
                "evidence_level": rec.get("evidence_level") or (related_rule or {}).get("source"),
                "missing_context": _missing_profile_context(profile),
                "safety_notes": safety_notes,
            }
        )

    return {
        "version": "explainability_v1",
        "marker_explanations": marker_explanations[:12],
        "recommendation_explanations": recommendation_explanations[:12],
    }
