from __future__ import annotations

from typing import Any, Dict, List

from app.services.lab_normalization.canonical import CanonicalLabResult


def compose_insight_payload(result: CanonicalLabResult) -> Dict[str, Any]:
    biomarkers: List[Dict[str, Any]] = [b.model_dump() for b in result.biomarkers]
    concerning = [b for b in biomarkers if b.get("status") in {"DEFICIENT", "ELEVATED"}]

    if concerning:
        summary = f"Detected {len(concerning)} biomarker signals that need attention."
    else:
        summary = "No critical biomarker deviations detected in this panel."

    score_penalty = min(60, len(concerning) * 12)
    health_score = max(25, 90 - score_penalty)

    priority_insights: List[Dict[str, Any]] = []
    for item in concerning[:3]:
        priority_insights.append(
            {
                "title": f"{item['display_name']} is {item['status'].lower()}",
                "rationale": "Compared against provided reference range.",
                "severity": "high" if item["status"] == "DEFICIENT" else "medium",
                "biomarker": item["canonical_name"],
            }
        )

    doctor_summary = (
        "Automated pre-screen summary for partner panel. "
        "Correlate with symptoms, medication history, and repeat-testing protocol."
    )

    return {
        "summary": summary,
        "health_score": health_score,
        "priority_insights": priority_insights,
        "biomarkers": biomarkers,
        "recommended_tests": [],
        "next_touchpoints": ["clinical_review", "follow_up_in_30_days"],
        "doctor_summary": doctor_summary,
        "powered_by_vitaloop": {"enabled": True, "version": "partner-mvp"},
    }
