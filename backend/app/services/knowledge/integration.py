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

    payload = {
        "lab_results": lab_results,
        "symptoms": symptoms or [],
        "context": {
            "upload_id": upload_id,
            "source": "biomarker_analyzer",
            "data_age_days": 0,
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
