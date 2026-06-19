from __future__ import annotations

import logging
from typing import Any, Dict, List

from app.config import settings
from app.services import supabase_service as supabase
from app.services.lab_normalization.biomarker_mapping import to_canonical_name
from app.services.knowledge.evaluator import evaluate_health_input

logger = logging.getLogger("uvicorn.error")

_KNOWLEDGE_KEY_ALIASES = {
    "vitamin_d_25_oh": "vitamin_d",
    "25_oh_vitamin_d": "vitamin_d",
}


def _knowledge_marker_key(name: str) -> str:
    canonical = to_canonical_name(name)
    return _KNOWLEDGE_KEY_ALIASES.get(canonical, canonical)


def biomarkers_to_knowledge_lab_results(biomarkers: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    lab_results: Dict[str, Dict[str, Any]] = {}
    for item in biomarkers or []:
        name = str(item.get("name") or item.get("display_name") or "").strip()
        if not name:
            continue
        key = _knowledge_marker_key(name)
        value = item.get("value")
        unit = str(item.get("unit") or "").strip()
        if value is None or not unit:
            continue
        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            continue
        lab_results.setdefault(
            key,
            {
                "value": numeric_value,
                "unit": unit,
                "source_name": name,
                "status": item.get("status"),
            },
        )
    return lab_results


def _age_band(age: Any) -> str | None:
    try:
        value = int(age)
    except (TypeError, ValueError):
        return None
    if value < 18:
        return "under_18"
    if value < 30:
        return "18_29"
    if value < 40:
        return "30_39"
    if value < 50:
        return "40_49"
    if value < 60:
        return "50_59"
    if value < 70:
        return "60_69"
    return "70_plus"


def _bmi_band(height_cm: Any, weight_kg: Any) -> str | None:
    try:
        height_m = float(height_cm) / 100
        weight = float(weight_kg)
    except (TypeError, ValueError):
        return None
    if height_m <= 0 or weight <= 0:
        return None
    bmi = weight / (height_m * height_m)
    if bmi < 18.5:
        return "underweight"
    if bmi < 25:
        return "healthy_range"
    if bmi < 30:
        return "overweight"
    return "obesity_range"


def build_deidentified_person_avatar(profile: Dict[str, Any] | None) -> Dict[str, Any]:
    profile = profile if isinstance(profile, dict) else {}
    goals = profile.get("goals")
    safe_goals = [
        str(item).strip().lower()
        for item in (goals if isinstance(goals, list) else [])
        if str(item).strip()
    ][:10]
    avatar = {
        "age_band": _age_band(profile.get("age")),
        "sex": str(profile.get("sex") or "").strip().lower() or None,
        "bmi_band": _bmi_band(profile.get("height_cm"), profile.get("weight_kg")),
        "goals": safe_goals,
    }
    return {key: value for key, value in avatar.items() if value not in (None, [], "")}


async def evaluate_biomarkers_with_knowledge(
    *,
    biomarkers: List[Dict[str, Any]],
    symptoms: List[str],
    user_id: str | None,
    upload_id: str | None,
    persist: bool = True,
) -> Dict[str, Any] | None:
    if not settings.knowledge_evaluation_after_analyze_enabled:
        return None

    lab_results = biomarkers_to_knowledge_lab_results(biomarkers)
    if not lab_results:
        return None

    profile: Dict[str, Any] = {}
    if user_id:
        try:
            profile = await supabase.get_user_profile(user_id)
        except Exception as exc:
            logger.warning(
                "knowledge_person_avatar_unavailable user_id=%s error=%s",
                user_id,
                exc,
            )

    payload = {
        "lab_results": lab_results,
        "symptoms": symptoms or [],
        "context": {
            "upload_id": upload_id,
            "source": "biomarker_analyzer",
            "data_age_days": 0,
            "person_avatar": build_deidentified_person_avatar(profile),
            "cohort_learning_allowed": bool(profile.get("knowledge_learning_consent")),
        },
    }
    try:
        return await evaluate_health_input(payload, user_id=user_id, persist=persist)
    except Exception as exc:
        logger.warning(
            "knowledge_evaluation_after_analyze_failed upload_id=%s user_id=%s error=%s",
            upload_id,
            user_id,
            exc,
            exc_info=True,
        )
        return None


async def build_biomarker_extraction_knowledge_context() -> str:
    if not settings.knowledge_context_enabled:
        return ""

    try:
        client = supabase._get_supabase()
        markers_resp = await supabase._run(
            lambda: client.table("lab_markers")
            .select("key,display_name,common_units,category")
            .order("key")
            .limit(40)
            .execute()
        )
        rules_resp = await supabase._run(
            lambda: client.table("knowledge_rules")
            .select("key,input_entities,confidence,severity,requires_doctor")
            .eq("governance_status", "active")
            .eq("active", True)
            .order("key")
            .limit(20)
            .execute()
        )
    except Exception as exc:
        logger.warning("knowledge_extraction_context_unavailable error=%s", exc)
        return ""

    marker_lines = []
    for marker in markers_resp.data or []:
        units = marker.get("common_units")
        if isinstance(units, list):
            units_text = ", ".join(str(item) for item in units[:4])
        else:
            units_text = str(units or "")
        marker_lines.append(
            f"- {marker.get('key')}: {marker.get('display_name') or marker.get('key')}"
            f" | units: {units_text or 'unknown'} | category: {marker.get('category') or 'unknown'}"
        )

    rule_lines = []
    for rule in rules_resp.data or []:
        entities = rule.get("input_entities") if isinstance(rule.get("input_entities"), list) else []
        rule_lines.append(
            f"- {rule.get('key')} | inputs: {', '.join(str(item) for item in entities[:6])}"
            f" | severity: {rule.get('severity') or 'n/a'}"
        )

    if not marker_lines and not rule_lines:
        return ""

    return (
        "\n\nVitaloop Knowledge Base context for biomarker extraction:\n"
        "Use these marker keys/names to normalize extracted lab values when possible. "
        "Do not invent diagnoses. Return only the requested biomarker JSON schema.\n"
        "Known lab markers:\n"
        + "\n".join(marker_lines)
        + ("\nActive rule input hints:\n" + "\n".join(rule_lines) if rule_lines else "")
    )
