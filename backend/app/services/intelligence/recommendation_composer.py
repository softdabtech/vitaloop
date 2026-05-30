from __future__ import annotations

from typing import Any, Dict


def compose_partner_recommendations(insight_payload: Dict[str, Any]) -> Dict[str, Any]:
    # Recommendation layer is intentionally conservative for MVP and can be replaced by LLM/rules engine.
    recommendations = []
    for item in insight_payload.get("priority_insights", []):
        biomarker = item.get("biomarker") or "unknown"
        recommendations.append(
            {
                "biomarker": biomarker,
                "action": "Discuss corrective protocol with clinician",
            }
        )

    return {
        "recommendations": recommendations,
        "count": len(recommendations),
    }
