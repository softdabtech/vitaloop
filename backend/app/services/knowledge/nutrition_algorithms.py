from __future__ import annotations

from typing import Any, Dict, List


NUTRITION_ALGORITHMS_VERSION = "nutrition_algorithms_v1"

SOURCE_BASIS = [
    {
        "source": "USDA / National Agricultural Library DRI Calculator",
        "source_url": "https://www.nal.usda.gov/human-nutrition-and-food-safety/dri-calculator",
        "license_note": "DRI-derived educational reference context; individual needs may differ.",
    },
    {
        "source": "NIH Office of Dietary Supplements nutrient recommendations",
        "source_url": "https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx",
        "license_note": "Used as public educational nutrient-reference context.",
    },
]

FOOD_SOURCES = {
    "iron": ["lean meat", "fish", "eggs", "beans", "lentils", "buckwheat", "spinach", "pumpkin seeds"],
    "vitamin_d": ["oily fish", "eggs", "fortified dairy or plant drinks", "safe sunlight exposure"],
    "vitamin_b12": ["fish", "meat", "eggs", "dairy", "fortified foods for low-animal-food diets"],
    "folate": ["leafy greens", "legumes", "asparagus", "broccoli", "avocado"],
    "magnesium": ["pumpkin seeds", "nuts", "legumes", "whole grains", "dark chocolate"],
    "zinc": ["meat", "seafood", "pumpkin seeds", "beans", "nuts", "whole grains"],
}

REQUIREMENTS = {
    "child_4_8": {
        "iron": {"rda": 10, "unit": "mg/day", "ul": 40},
        "vitamin_d": {"rda": 15, "unit": "mcg/day", "ul": 75},
        "vitamin_b12": {"rda": 1.2, "unit": "mcg/day", "ul": None},
        "folate": {"rda": 200, "unit": "mcg DFE/day", "ul": 400},
        "magnesium": {"rda": 130, "unit": "mg/day", "ul": 110},
        "zinc": {"rda": 5, "unit": "mg/day", "ul": 12},
    },
    "child_9_13": {
        "iron": {"rda": 8, "unit": "mg/day", "ul": 40},
        "vitamin_d": {"rda": 15, "unit": "mcg/day", "ul": 100},
        "vitamin_b12": {"rda": 1.8, "unit": "mcg/day", "ul": None},
        "folate": {"rda": 300, "unit": "mcg DFE/day", "ul": 600},
        "magnesium": {"rda": 240, "unit": "mg/day", "ul": 350},
        "zinc": {"rda": 8, "unit": "mg/day", "ul": 23},
    },
    "adult_female": {
        "iron": {"rda": 18, "unit": "mg/day", "ul": 45},
        "vitamin_d": {"rda": 15, "unit": "mcg/day", "ul": 100},
        "vitamin_b12": {"rda": 2.4, "unit": "mcg/day", "ul": None},
        "folate": {"rda": 400, "unit": "mcg DFE/day", "ul": 1000},
        "magnesium": {"rda": 320, "unit": "mg/day", "ul": 350},
        "zinc": {"rda": 8, "unit": "mg/day", "ul": 40},
    },
    "adult_male": {
        "iron": {"rda": 8, "unit": "mg/day", "ul": 45},
        "vitamin_d": {"rda": 15, "unit": "mcg/day", "ul": 100},
        "vitamin_b12": {"rda": 2.4, "unit": "mcg/day", "ul": None},
        "folate": {"rda": 400, "unit": "mcg DFE/day", "ul": 1000},
        "magnesium": {"rda": 420, "unit": "mg/day", "ul": 350},
        "zinc": {"rda": 11, "unit": "mg/day", "ul": 40},
    },
}


def _num(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _unit(value: Any) -> str:
    return str(value or "").strip().lower().replace("μ", "u").replace("µ", "u")


def _read_marker(lab_results: Dict[str, Any], *keys: str) -> Dict[str, Any] | None:
    for key in keys:
        row = lab_results.get(key)
        if isinstance(row, dict) and _num(row.get("value")) is not None:
            return row
    return None


def _extract_avatar(input_data: Dict[str, Any] | None) -> Dict[str, Any]:
    payload = input_data if isinstance(input_data, dict) else {}
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    candidates = [
        context.get("person_avatar"),
        context.get("profile"),
        context.get("user_profile"),
        payload.get("person_avatar"),
        payload.get("profile"),
        payload.get("user_profile"),
    ]
    for candidate in candidates:
        if isinstance(candidate, dict):
            return candidate
    return {}


def _person_group(input_data: Dict[str, Any] | None) -> str:
    avatar = _extract_avatar(input_data)
    age = _num(avatar.get("age") or avatar.get("age_years"))
    age_band = str(avatar.get("age_band") or "").strip().lower()
    sex = str(avatar.get("sex") or "").strip().lower()
    if age is not None:
        if 4 <= age <= 8:
            return "child_4_8"
        if 9 <= age <= 13:
            return "child_9_13"
        if age < 18:
            return "child_9_13"
    if age_band in {"under_18", "child", "pediatric", "paediatric"}:
        # Deidentified context does not expose exact age; use conservative child band.
        return "child_9_13"
    if sex in {"female", "f"}:
        return "adult_female"
    return "adult_male"


def _requirement_rows(group: str) -> List[Dict[str, Any]]:
    rows = []
    for nutrient, values in (REQUIREMENTS.get(group) or REQUIREMENTS["adult_male"]).items():
        rows.append(
            {
                "nutrient": nutrient,
                "rda_or_ai": values.get("rda"),
                "unit": values.get("unit"),
                "upper_limit": values.get("ul"),
                "life_stage_group": group,
            }
        )
    return rows


def _signal(
    *,
    key: str,
    nutrient: str,
    status: str,
    triggered_by: Dict[str, Any],
    explanation: str,
    missing_context: List[str],
    confidence: float,
    priority: str = "medium",
) -> Dict[str, Any]:
    return {
        "key": key,
        "nutrient": nutrient,
        "status": status,
        "priority": priority,
        "confidence": round(max(0.0, min(confidence, 1.0)), 2),
        "triggered_by": {
            "marker": triggered_by.get("source_name") or triggered_by.get("name"),
            "value": triggered_by.get("value"),
            "unit": triggered_by.get("unit"),
            "status": triggered_by.get("status"),
        },
        "explanation": explanation,
        "missing_context": missing_context,
        "food_sources": FOOD_SOURCES.get(nutrient) or [],
        "safety_notes": [
            "Use food-source guidance as educational context.",
            "Do not start high-dose supplements from one marker alone.",
            "Confirm supplement form and dose with a qualified clinician, especially for children, pregnancy, kidney disease, liver disease, or medication use.",
        ],
    }


def _recommendation_from_signal(signal: Dict[str, Any]) -> Dict[str, Any]:
    nutrient = str(signal.get("nutrient") or "").replace("_", " ")
    title = f"Clarify {nutrient} context before supplement decisions"
    body = (
        f"{signal.get('explanation')} Prioritize food-source context, missing labs, symptoms, and clinician discussion before supplement dosing."
    )
    return {
        "key": f"nutrition_context_{signal.get('key')}",
        "title": title,
        "body": body,
        "category": "nutrition_context",
        "priority": signal.get("priority") or "medium",
        "requires_doctor": True,
        "evidence_level": "dri_context",
        "source": SOURCE_BASIS[0]["source"],
        "source_url": SOURCE_BASIS[0]["source_url"],
    }


def build_nutrition_kb_context(input_data: Dict[str, Any]) -> Dict[str, Any]:
    lab_results = input_data.get("lab_results") if isinstance(input_data, dict) else {}
    lab_results = {str(k).strip().lower(): v for k, v in (lab_results if isinstance(lab_results, dict) else {}).items()}
    group = _person_group(input_data)

    signals: List[Dict[str, Any]] = []

    ferritin = _read_marker(lab_results, "ferritin")
    iron = _read_marker(lab_results, "iron")
    transferrin_sat = _read_marker(lab_results, "transferrin_saturation")
    if ferritin:
        value = _num(ferritin.get("value"))
        if value is not None and value < 30:
            signals.append(
                _signal(
                    key="low_ferritin_food_and_context",
                    nutrient="iron",
                    status="context_required",
                    triggered_by=ferritin,
                    explanation="Ferritin is a storage-iron marker; low values should be interpreted with CBC, iron transport markers, inflammation context, diet pattern, and symptoms.",
                    missing_context=["CBC", "serum iron", "transferrin saturation", "CRP/inflammation context", "dietary iron intake"],
                    confidence=0.72 if iron or transferrin_sat else 0.58,
                    priority="high",
                )
            )

    vitamin_d = _read_marker(lab_results, "vitamin_d", "vitamin_d_25_oh")
    if vitamin_d:
        value = _num(vitamin_d.get("value"))
        unit = _unit(vitamin_d.get("unit"))
        ng_ml = value / 2.5 if value is not None and unit in {"nmol/l", "nmol/l."} else value
        if ng_ml is not None and ng_ml < 30:
            signals.append(
                _signal(
                    key="low_vitamin_d_food_and_followup",
                    nutrient="vitamin_d",
                    status="context_required",
                    triggered_by=vitamin_d,
                    explanation="25-OH vitamin D below common sufficiency targets should be reviewed with season, sun exposure, diet, calcium context, and repeat testing plan.",
                    missing_context=["season/sun exposure", "dietary vitamin D sources", "calcium", "supplement history", "repeat test timing"],
                    confidence=0.68 if ng_ml >= 20 else 0.76,
                    priority="high" if ng_ml < 20 else "medium",
                )
            )

    b12 = _read_marker(lab_results, "vitamin_b12", "b12")
    if b12:
        value = _num(b12.get("value"))
        unit = _unit(b12.get("unit"))
        low = value is not None and ((unit in {"pmol/l", "pmol/l."} and value < 150) or (unit in {"pg/ml", "ng/l"} and value < 300))
        if low:
            signals.append(
                _signal(
                    key="low_b12_food_and_context",
                    nutrient="vitamin_b12",
                    status="context_required",
                    triggered_by=b12,
                    explanation="Low B12 should be interpreted with blood-count indices, neurologic symptoms, diet pattern, and malabsorption or medication context.",
                    missing_context=["CBC indices", "folate", "MMA/homocysteine when appropriate", "diet pattern", "metformin/PPI use"],
                    confidence=0.68,
                    priority="high",
                )
            )

    folate = _read_marker(lab_results, "folate")
    if folate:
        value = _num(folate.get("value"))
        unit = _unit(folate.get("unit"))
        low = value is not None and ((unit in {"ng/ml"} and value < 4) or (unit in {"nmol/l"} and value < 10))
        if low:
            signals.append(
                _signal(
                    key="low_folate_food_and_context",
                    nutrient="folate",
                    status="context_required",
                    triggered_by=folate,
                    explanation="Low folate should be reviewed with diet quality, B12 status, blood-count indices, pregnancy context, and medication history.",
                    missing_context=["B12", "CBC indices", "diet pattern", "pregnancy context", "medication history"],
                    confidence=0.66,
                    priority="high",
                )
            )

    magnesium = _read_marker(lab_results, "magnesium")
    if magnesium:
        value = _num(magnesium.get("value"))
        if value is not None and _unit(magnesium.get("unit")) in {"mmol/l"} and value < 0.7:
            signals.append(
                _signal(
                    key="low_magnesium_food_and_context",
                    nutrient="magnesium",
                    status="context_required",
                    triggered_by=magnesium,
                    explanation="Low serum magnesium should be interpreted with diet pattern, GI losses, kidney function, medications, and symptoms such as cramps or palpitations.",
                    missing_context=["kidney function", "GI symptoms/losses", "medications", "dietary magnesium intake"],
                    confidence=0.62,
                )
            )

    zinc = _read_marker(lab_results, "zinc")
    if zinc:
        value = _num(zinc.get("value"))
        if value is not None and _unit(zinc.get("unit")) in {"umol/l", "µmol/l", "μmol/l"} and value < 10:
            signals.append(
                _signal(
                    key="low_zinc_food_and_context",
                    nutrient="zinc",
                    status="context_required",
                    triggered_by=zinc,
                    explanation="Low zinc should be reviewed with diet pattern, GI absorption, inflammation context, and copper balance before supplementation.",
                    missing_context=["dietary zinc intake", "GI context", "CRP/inflammation context", "copper status when supplementing"],
                    confidence=0.6,
                )
            )

    recommendations = [_recommendation_from_signal(signal) for signal in signals[:8]]

    return {
        "version": NUTRITION_ALGORITHMS_VERSION,
        "person_group": group,
        "source_basis": SOURCE_BASIS,
        "nutrient_requirements": _requirement_rows(group),
        "nutrition_signals": signals[:12],
        "generated_recommendations": recommendations,
    }
