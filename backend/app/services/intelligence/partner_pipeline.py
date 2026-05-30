from __future__ import annotations

from typing import Any, Dict

from app.services.intelligence.insight_composer import compose_insight_payload
from app.services.intelligence.recommendation_composer import compose_partner_recommendations
from app.services.lab_normalization.canonical import CanonicalLabResult


def build_partner_insights(result: CanonicalLabResult) -> Dict[str, Any]:
    base_payload = compose_insight_payload(result)
    base_payload["recommendation_context"] = compose_partner_recommendations(base_payload)
    return base_payload
