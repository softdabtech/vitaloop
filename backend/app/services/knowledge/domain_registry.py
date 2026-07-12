from __future__ import annotations

from typing import Any, Dict, List

DOMAIN_REGISTRY_VERSION = "knowledge_domain_registry_v1"

_DOMAIN_REGISTRY: Dict[str, Dict[str, Any]] = {
    "iron_status": {
        "label": "Iron status",
        "marker_aliases": ["ferritin", "iron", "transferrin", "hemoglobin", "hematocrit", "rbc"],
        "symptom_aliases": ["fatigue", "weakness", "dizziness", "shortness of breath", "втома", "слабкість"],
        "required_markers": ["ferritin", "hemoglobin"],
        "retest_markers": ["Ferritin", "CBC", "Iron panel"],
        "protocol_sections": ["nutrition", "supplements", "training_recovery"],
        "expected_timeline": "Review safety first; reassess symptoms in 2-4 weeks and labs at the recommended retest interval.",
        "evidence_level": "clinical_context",
        "requires_doctor_if_flagged": True,
    },
    "metabolic_health": {
        "label": "Metabolic health",
        "marker_aliases": ["glucose", "hba1c", "insulin"],
        "symptom_aliases": ["thirst", "cravings", "energy crash", "сонливість", "спрага"],
        "required_markers": ["glucose", "hba1c"],
        "retest_markers": ["Glucose", "HbA1c", "Insulin"],
        "protocol_sections": ["nutrition", "lifestyle", "training_recovery"],
        "expected_timeline": "Start with meal timing, movement, sleep, and clinician follow-up where indicated; reassess trends in 8-12 weeks.",
        "evidence_level": "clinical_context",
        "requires_doctor_if_flagged": True,
    },
    "cardiovascular": {
        "label": "Cardiovascular risk context",
        "marker_aliases": ["ldl", "hdl", "cholesterol", "triglyceride", "triglycerides", "homocysteine"],
        "symptom_aliases": ["chest pain", "palpitations", "серцебиття"],
        "required_markers": ["ldl", "hdl", "triglyceride"],
        "retest_markers": ["LDL", "HDL", "Triglycerides", "ApoB"],
        "protocol_sections": ["nutrition", "lifestyle", "training_recovery"],
        "expected_timeline": "Treat as a risk pattern, not a diagnosis; align nutrition, activity, and medical review with repeat lipids.",
        "evidence_level": "clinical_context",
        "requires_doctor_if_flagged": True,
    },
    "inflammation": {
        "label": "Inflammation load",
        "marker_aliases": ["crp", "esr", "homocysteine"],
        "symptom_aliases": ["pain", "aches", "joint pain", "біль", "запалення"],
        "required_markers": ["crp"],
        "retest_markers": ["CRP", "ESR"],
        "protocol_sections": ["lifestyle", "training_recovery", "nutrition"],
        "expected_timeline": "Reduce avoidable stressors and retest after acute illness, heavy training, or clinician-directed follow-up.",
        "evidence_level": "clinical_context",
        "requires_doctor_if_flagged": True,
    },
    "thyroid": {
        "label": "Thyroid context",
        "marker_aliases": ["tsh", "t3", "t4", "thyroid"],
        "symptom_aliases": ["cold intolerance", "hair loss", "weight gain", "випадіння волосся"],
        "required_markers": ["tsh"],
        "retest_markers": ["TSH", "Free T4", "Free T3"],
        "protocol_sections": ["lifestyle", "nutrition"],
        "expected_timeline": "Interpret with symptoms, medications, pregnancy context, and clinician guidance before supplement changes.",
        "evidence_level": "clinical_context",
        "requires_doctor_if_flagged": True,
    },
    "liver": {
        "label": "Liver stress context",
        "marker_aliases": ["alt", "ast", "ggt", "bilirubin"],
        "symptom_aliases": ["nausea", "right upper pain", "нудота"],
        "required_markers": ["alt", "ast"],
        "retest_markers": ["ALT", "AST", "GGT", "Bilirubin"],
        "protocol_sections": ["lifestyle", "nutrition"],
        "expected_timeline": "Review alcohol, medications, supplements, illness, and training load; repeat testing per clinician guidance.",
        "evidence_level": "clinical_context",
        "requires_doctor_if_flagged": True,
    },
    "kidney": {
        "label": "Kidney function context",
        "marker_aliases": ["creatinine", "urea", "egfr"],
        "symptom_aliases": ["swelling", "набряк"],
        "required_markers": ["creatinine", "egfr"],
        "retest_markers": ["Creatinine", "eGFR", "Urinalysis"],
        "protocol_sections": ["nutrition", "lifestyle"],
        "expected_timeline": "Check hydration, medications, supplements, protein intake, and clinician guidance before changing protocols.",
        "evidence_level": "clinical_context",
        "requires_doctor_if_flagged": True,
    },
    "micronutrients": {
        "label": "Micronutrient status",
        "marker_aliases": ["vitamin", "vitamin_d", "b12", "folate", "magnesium", "zinc", "selenium"],
        "symptom_aliases": ["fatigue", "brain fog", "втома", "туман"],
        "required_markers": ["vitamin_d", "b12", "folate", "magnesium"],
        "retest_markers": ["Vitamin D", "B12", "Folate", "Magnesium"],
        "protocol_sections": ["nutrition", "supplements"],
        "expected_timeline": "Confirm dose and safety, then retest relevant markers after the recommended interval.",
        "evidence_level": "clinical_context",
        "requires_doctor_if_flagged": False,
    },
    "recovery_energy": {
        "label": "Recovery and energy",
        "marker_aliases": ["ferritin", "vitamin", "b12", "folate", "magnesium", "tsh", "crp"],
        "symptom_aliases": ["fatigue", "brain fog", "poor sleep", "low energy", "втома", "поганий сон"],
        "required_markers": ["ferritin", "vitamin_d", "tsh", "crp"],
        "retest_markers": ["Ferritin", "Vitamin D", "TSH", "CRP"],
        "protocol_sections": ["training_recovery", "lifestyle", "nutrition"],
        "expected_timeline": "Use symptoms and training load to adjust recovery immediately; validate with repeat markers when appropriate.",
        "evidence_level": "clinical_context",
        "requires_doctor_if_flagged": False,
    },
}


def list_domain_definitions() -> List[Dict[str, Any]]:
    return [
        {"key": key, **definition, "registry_version": DOMAIN_REGISTRY_VERSION}
        for key, definition in _DOMAIN_REGISTRY.items()
    ]


def get_domain_definition(domain_key: str) -> Dict[str, Any] | None:
    definition = _DOMAIN_REGISTRY.get(str(domain_key or "").strip())
    if not definition:
        return None
    return {"key": str(domain_key).strip(), **definition, "registry_version": DOMAIN_REGISTRY_VERSION}


def domain_registry_summary() -> Dict[str, Any]:
    return {
        "version": DOMAIN_REGISTRY_VERSION,
        "domain_count": len(_DOMAIN_REGISTRY),
        "domains": sorted(_DOMAIN_REGISTRY.keys()),
    }
