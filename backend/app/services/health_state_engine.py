from __future__ import annotations

from typing import Any, Dict, List

HEALTH_STATE_ENGINE_VERSION = "health_state_engine_v1"

_DOMAIN_MARKERS = {
    "iron_status": {"ferritin", "iron", "transferrin", "hemoglobin", "hematocrit", "rbc"},
    "metabolic_health": {"glucose", "hba1c", "insulin"},
    "cardiovascular": {"ldl", "hdl", "cholesterol", "triglyceride", "triglycerides", "homocysteine"},
    "inflammation": {"crp", "esr", "homocysteine"},
    "thyroid": {"tsh", "t3", "t4", "thyroid"},
    "liver": {"alt", "ast", "ggt", "bilirubin"},
    "kidney": {"creatinine", "urea", "egfr"},
    "micronutrients": {"vitamin", "vitamin_d", "b12", "folate", "magnesium", "zinc", "selenium"},
    "recovery_energy": {"ferritin", "vitamin", "b12", "folate", "magnesium", "tsh", "crp"},
}

_DOMAIN_SYMPTOMS = {
    "iron_status": {"fatigue", "weakness", "dizziness", "shortness of breath", "втома", "слабкість"},
    "metabolic_health": {"thirst", "cravings", "energy crash", "сонливість", "спрага"},
    "cardiovascular": {"chest pain", "palpitations", "серцебиття"},
    "inflammation": {"pain", "aches", "joint pain", "біль", "запалення"},
    "thyroid": {"cold intolerance", "hair loss", "weight gain", "випадіння волосся"},
    "liver": {"nausea", "right upper pain", "нудота"},
    "kidney": {"swelling", "набряк"},
    "micronutrients": {"fatigue", "brain fog", "втома", "туман"},
    "recovery_energy": {"fatigue", "brain fog", "poor sleep", "low energy", "втома", "поганий сон"},
}

_REQUIRED_MARKERS = {
    "iron_status": {"ferritin", "hemoglobin"},
    "metabolic_health": {"glucose", "hba1c"},
    "cardiovascular": {"ldl", "hdl", "triglyceride"},
    "inflammation": {"crp"},
    "thyroid": {"tsh"},
    "liver": {"alt", "ast"},
    "kidney": {"creatinine", "egfr"},
    "micronutrients": {"vitamin_d", "b12", "folate", "magnesium"},
    "recovery_energy": {"ferritin", "vitamin_d", "tsh", "crp"},
}

_STATUS_PENALTY = {
    "ELEVATED": 22,
    "DEFICIENT": 22,
    "BORDERLINE": 10,
    "OPTIMAL": 0,
}


def _marker_key(item: Dict[str, Any]) -> str:
    text = " ".join(
        str(item.get(key) or "")
        for key in ("canonical_name", "name", "category")
    ).lower()
    return text.replace("canonical_", "")


def _matches_marker(item: Dict[str, Any], aliases: set[str]) -> bool:
    key = _marker_key(item)
    return any(alias in key for alias in aliases)


def _symptom_matches(symptoms: List[str], aliases: set[str]) -> List[str]:
    matches: List[str] = []
    for symptom in symptoms or []:
        text = str(symptom or "").strip().lower()
        if text and any(alias in text for alias in aliases):
            matches.append(text)
    return matches[:8]


def _risk_level(score: int) -> str:
    if score < 45:
        return "high_attention"
    if score < 70:
        return "needs_attention"
    if score < 85:
        return "watch"
    return "stable"


def _confidence(contributing: List[Dict[str, Any]], matched_symptoms: List[str], required: set[str]) -> str:
    if not contributing:
        return "low"
    matched_required = 0
    marker_blob = " ".join(_marker_key(item) for item in contributing)
    for marker in required:
        if marker in marker_blob:
            matched_required += 1
    coverage = matched_required / max(len(required), 1)
    if coverage >= 0.6 or (len(contributing) >= 3 and matched_symptoms):
        return "high"
    if coverage >= 0.3 or len(contributing) >= 2:
        return "medium"
    return "low"


def evaluate_health_states(
    *,
    biomarkers: List[Dict[str, Any]],
    symptoms: List[str],
    health_context: Dict[str, Any] | None = None,
    knowledge_report: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    states: List[Dict[str, Any]] = []
    matched_rules = knowledge_report.get("why_it_matters") if isinstance(knowledge_report, dict) else []

    for domain, aliases in _DOMAIN_MARKERS.items():
        contributing = [item for item in biomarkers or [] if _matches_marker(item, aliases)]
        matched_symptoms = _symptom_matches(symptoms, _DOMAIN_SYMPTOMS.get(domain, set()))
        required = _REQUIRED_MARKERS.get(domain, set())
        missing_data = sorted(
            marker
            for marker in required
            if marker not in " ".join(_marker_key(item) for item in contributing)
        )
        penalties = [
            _STATUS_PENALTY.get(str(item.get("status") or "BORDERLINE").upper(), 8)
            for item in contributing
        ]
        symptom_penalty = min(12, len(matched_symptoms) * 4)
        score = max(0, min(100, 100 - sum(penalties[:6]) - symptom_penalty))
        confidence = _confidence(contributing, matched_symptoms, required)

        if not contributing and not matched_symptoms:
            score = 0

        states.append(
            {
                "domain": domain,
                "score": score,
                "risk_level": _risk_level(score) if contributing or matched_symptoms else "unknown",
                "confidence": confidence,
                "contributing_biomarkers": [
                    {
                        "name": item.get("name"),
                        "canonical_name": item.get("canonical_name"),
                        "status": item.get("status"),
                        "value": item.get("value"),
                        "unit": item.get("unit"),
                    }
                    for item in contributing[:8]
                ],
                "symptom_signals": matched_symptoms,
                "missing_data": missing_data[:8],
            }
        )

    states = sorted(
        states,
        key=lambda item: (
            1 if item["risk_level"] == "unknown" else 0,
            item["score"],
            item["domain"],
        ),
    )
    top_priorities = [
        item
        for item in states
        if item["risk_level"] in {"high_attention", "needs_attention", "watch"}
    ][:5]

    return {
        "version": HEALTH_STATE_ENGINE_VERSION,
        "states": states,
        "top_priorities": top_priorities,
        "context_readiness": (health_context or {}).get("readiness") or {},
        "knowledge_rule_count": len(matched_rules or []),
    }
