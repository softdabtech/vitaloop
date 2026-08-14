from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, List, Optional
import logging

from app.config import settings
from app.services.affiliate import build_iherb_url
from app.services.ai.openai_service import is_llm_configured
from app.services.ai_orchestrator import generate_ai_protocol_orchestrated
from app.services.analysis_quality_gate import build_analysis_input_quality_gate
from app.services.analysis_quality_snapshot import build_analysis_quality_snapshot
from app.services.clinical_data_integrity import validate_clinical_data_integrity
from app.services.cost_analytics import record_analysis_cost
from app.services.evidence_gaps import build_evidence_gaps
from app.services.explainability import build_recommendation_explanations
from app.services.health_context import build_health_context
from app.services.health_state_engine import evaluate_health_states
from app.services.knowledge.domain_registry import DOMAIN_REGISTRY_VERSION, resolve_domain_definitions
from app.services.knowledge.integration import evaluate_biomarkers_with_knowledge
from app.services.knowledge.nutrition_algorithms import NUTRITION_ALGORITHMS_VERSION
from app.services.knowledge.report import build_knowledge_report
from app.services.lab_normalization.biomarker_mapping import infer_category, to_canonical_name
from app.services.protocol_enrichment import enrich_protocol
from app.services.report_interpretation import REPORT_INTERPRETATION_VERSION, build_interpreted_report
from app.services.safety import validate_report
from app.services.safety.safety_engine import SAFETY_ENGINE_VERSION
from app.services.trend_engine import evaluate_biomarker_trends

logger = logging.getLogger("uvicorn.error")

LAB_ANALYSIS_PIPELINE_VERSION = "lab_analysis_pipeline_v2"


DISCLAIMER = (
    "This analysis is educational decision support and is not a diagnosis. "
    "Discuss abnormal, urgent, or concerning results with a qualified clinician."
)

_NAME_ALIASES = {
    "ферритин": "ferritin",
    "феритин": "ferritin",
    "vit d": "vitamin d",
    "25 oh vitamin d": "vitamin d",
}

_STATUS_PRIORITY = {
    "DEFICIENT": 0,
    "ELEVATED": 1,
    "BORDERLINE": 2,
    "OPTIMAL": 3,
}

_PLACEHOLDER_SOURCE_HOSTS = ("example.org", "example.com")

_NAME_CATEGORY_KEYWORDS = {
    "blood_count": [
        "reticulocyte",
        "erythrocyte",
        "hemoglobin",
        "hematocrit",
        "spherical cell",
        "cell volume",
        "mcv",
        "mch",
        "rdw",
        "rbc",
        "wbc",
        "platelet",
    ],
    "minerals": ["ferritin", "iron", "transferrin", "magnesium", "zinc", "selenium"],
    "vitamins": ["vitamin", "b12", "folate", "folic"],
    "thyroid": ["tsh", "thyroid", "t3", "t4"],
    "lipids": ["cholesterol", "ldl", "hdl", "triglycer"],
    "metabolic": ["glucose", "hba1c", "insulin"],
    "liver": ["alt", "ast", "ggt", "bilirubin"],
    "kidney": ["creatinine", "urea", "egfr"],
    "inflammation": ["crp", "esr", "homocysteine"],
}


def _is_placeholder_source_url(value: Any) -> bool:
    url = str(value or "").strip().lower()
    return any(host in url for host in _PLACEHOLDER_SOURCE_HOSTS)


def _strip_placeholder_source_urls(value: Any) -> Any:
    if isinstance(value, list):
        return [_strip_placeholder_source_urls(item) for item in value]
    if isinstance(value, dict):
        cleaned: Dict[str, Any] = {}
        for key, item in value.items():
            if key == "source_url" and _is_placeholder_source_url(item):
                cleaned[key] = None
            else:
                cleaned[key] = _strip_placeholder_source_urls(item)
        return cleaned
    return value


def _parse_reference_range(raw: Any) -> tuple[float | None, float | None]:
    if raw in (None, ""):
        return None, None
    values = re.findall(r"(?<!\d)[-+]?\d+(?:[.,]\d+)?", str(raw))
    if len(values) < 2:
        return None, None
    return float(values[0].replace(",", ".")), float(values[1].replace(",", "."))


def _normalize_unit(raw_unit: str) -> str:
    unit = str(raw_unit or "").strip()
    normalized = unit.lower().replace("μ", "u").replace("µ", "u")
    aliases = {
        "ug/l": "ng/mL",
        "mcg/l": "ng/mL",
        "ng/ml": "ng/mL",
        "ng/ml.": "ng/mL",
        "mg/dl": "mg/dL",
        "g/dl": "g/dL",
        "u/l": "U/L",
        "iu/l": "IU/L",
        "miu/l": "uIU/mL",
        "uiu/ml": "uIU/mL",
        "%": "%",
    }
    return aliases.get(normalized, unit)


def _normalize_value_unit(name: str, value: float, unit: str) -> tuple[float, str]:
    canonical = to_canonical_name(name)
    normalized_unit = _normalize_unit(unit)
    numeric_value = float(value)

    if canonical in {"vitamin_d_25_oh", "vitamin_d", "canonical_vitamin_d_25_oh", "canonical_vitamin_d"}:
        raw_unit = str(unit or "").strip().lower()
        if raw_unit in {"nmol/l", "nmol/l."}:
            return numeric_value / 2.5, "ng/mL"

    return numeric_value, normalized_unit


def _convert_reference_range_for_unit(
    canonical: str,
    ref_low: float | None,
    ref_high: float | None,
    raw_unit: str,
) -> tuple[float | None, float | None]:
    raw = str(raw_unit or "").strip().lower()
    if canonical in {"canonical_vitamin_d_25_oh", "canonical_vitamin_d"} and raw in {"nmol/l", "nmol/l."}:
        return (
            ref_low / 2.5 if ref_low is not None else None,
            ref_high / 2.5 if ref_high is not None else None,
        )
    return ref_low, ref_high


def _normalize_name(raw_name: str, name_aliases: Optional[Dict[str, str]] = None) -> tuple[str, str]:
    display_name = re.sub(r"\s+", " ", str(raw_name or "").strip())
    alias_key = display_name.lower()
    aliases = {**_NAME_ALIASES, **{str(k).strip().lower(): str(v).strip() for k, v in (name_aliases or {}).items() if str(k).strip() and str(v).strip()}}
    english_name = aliases.get(alias_key, display_name)
    base_canonical = to_canonical_name(english_name)
    canonical = base_canonical if base_canonical.startswith("canonical_") else f"canonical_{base_canonical}"
    return display_name, canonical


def _infer_category_from_name(display_name: str, canonical: str) -> str:
    text = f"{display_name} {canonical}".lower()
    for category, keywords in _NAME_CATEGORY_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return category
    inferred = infer_category(canonical)
    return inferred if inferred and inferred != "other" else "other"


def _status_for_value(value: float, ref_low: float | None, ref_high: float | None, raw_status: Any = None) -> str:
    if ref_low is not None and value < ref_low:
        return "DEFICIENT"
    if ref_high is not None and value > ref_high:
        return "ELEVATED"
    if ref_low is not None or ref_high is not None:
        return "OPTIMAL"

    status = str(raw_status or "").strip().upper()
    aliases = {
        "NORMAL": "OPTIMAL",
        "IN_RANGE": "OPTIMAL",
        "IN RANGE": "OPTIMAL",
        "LOW": "DEFICIENT",
        "HIGH": "ELEVATED",
        "CRITICAL": "ELEVATED",
    }
    return aliases.get(status, status if status in _STATUS_PRIORITY else "BORDERLINE")


def normalize_biomarkers(raw_biomarkers: Iterable[Dict[str, Any]], *, name_aliases: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    seen: set[str] = set()

    for item in raw_biomarkers or []:
        if not isinstance(item, dict):
            continue

        name = item.get("name") or item.get("display_name") or item.get("canonical_name")
        if not name:
            continue
        value = item.get("value")
        unit = item.get("unit")
        if value in (None, "") or not unit:
            continue

        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            continue

        display_name, canonical = _normalize_name(str(name), name_aliases=name_aliases)
        raw_unit = str(unit)
        numeric_value, normalized_unit = _normalize_value_unit(canonical, numeric_value, raw_unit)
        ref_low = item.get("ref_low") or item.get("reference_low")
        ref_high = item.get("ref_high") or item.get("reference_high")
        if ref_low in (None, "") or ref_high in (None, ""):
            parsed_low, parsed_high = _parse_reference_range(item.get("reference_range"))
            ref_low = ref_low if ref_low not in (None, "") else parsed_low
            ref_high = ref_high if ref_high not in (None, "") else parsed_high
        ref_low = float(ref_low) if ref_low not in (None, "") else None
        ref_high = float(ref_high) if ref_high not in (None, "") else None
        ref_low, ref_high = _convert_reference_range_for_unit(canonical, ref_low, ref_high, raw_unit)
        status = _status_for_value(numeric_value, ref_low, ref_high, item.get("status"))

        unique_key = canonical
        if unique_key in seen:
            unique_key = f"{canonical}_{len(seen) + 1}"
        seen.add(unique_key)

        normalized.append(
            {
                "name": display_name,
                "canonical_name": canonical,
                "value": numeric_value,
                "unit": normalized_unit,
                "ref_low": ref_low,
                "ref_high": ref_high,
                "status": status,
                "category": (
                    _infer_category_from_name(display_name, canonical)
                    if str(item.get("category") or "").lower() in {"", "other", "unknown"}
                    else item.get("category")
                ),
                "reference_range": item.get("reference_range"),
                "collected_at": _iso_or_none(item.get("collected_at")),
                "lab_name": item.get("lab_name"),
            }
        )

    return normalized


def _iso_or_none(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _priority_for_status(status: str) -> str:
    if status in {"DEFICIENT", "ELEVATED"}:
        return "high"
    if status == "BORDERLINE":
        return "medium"
    return "low"


def _prioritize_biomarkers(biomarkers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    ordered = sorted(
        biomarkers,
        key=lambda item: (
            _STATUS_PRIORITY.get(str(item.get("status") or "BORDERLINE"), 9),
            str(item.get("category") or ""),
            str(item.get("name") or ""),
        ),
    )
    result: List[Dict[str, Any]] = []
    for item in ordered:
        status = str(item.get("status") or "BORDERLINE")
        if status == "OPTIMAL":
            continue
        result.append(
            {
                "name": item["name"],
                "canonical_name": item["canonical_name"],
                "value": item["value"],
                "unit": item["unit"],
                "status": status,
                "category": item.get("category"),
                "priority": _priority_for_status(status),
                "rationale": "Prioritized because the value is outside or near the provided reference range.",
                "reference_range": item.get("reference_range")
                or (
                    f"{item.get('ref_low')} - {item.get('ref_high')} {item.get('unit')}"
                    if item.get("ref_low") is not None and item.get("ref_high") is not None
                    else None
                ),
            }
        )
    return result[:12]


def _risk_flags(knowledge_report: Dict[str, Any], prioritized: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    flags: List[Dict[str, Any]] = []
    for alert in knowledge_report.get("safety_alerts") or []:
        if not isinstance(alert, dict):
            continue
        flags.append(
            {
                "type": "safety_alert",
                "severity": "critical",
                "title": f"{alert.get('marker') or 'Marker'} requires medical review",
                "rationale": alert.get("message") or "Safety alert requires medical review.",
                "biomarker": alert.get("marker"),
                "requires_doctor": True,
            }
        )

    for rule in knowledge_report.get("why_it_matters") or []:
        if not isinstance(rule, dict):
            continue
        flags.append(
            {
                "type": "knowledge_rule",
                "severity": str(rule.get("severity") or "moderate"),
                "title": str(rule.get("title") or "Matched health pattern"),
                "rationale": str(rule.get("why_it_matters") or rule.get("summary") or ""),
                "biomarker": None,
                "requires_doctor": bool(rule.get("requires_doctor")),
            }
        )

    if not flags:
        for item in prioritized[:5]:
            flags.append(
                {
                    "type": "biomarker_flag",
                    "severity": item["priority"],
                    "title": f"{item['name']} is {str(item['status']).lower()}",
                    "rationale": item["rationale"],
                    "biomarker": item["canonical_name"],
                    "requires_doctor": item["priority"] == "high",
                }
            )
    return flags[:10]


def _localized_knowledge_evaluation_for_response(
    knowledge_evaluation: Dict[str, Any],
    knowledge_report: Dict[str, Any],
    locale: str,
) -> Dict[str, Any]:
    if not str(locale or "").lower().startswith("uk"):
        return knowledge_evaluation

    localized = dict(knowledge_evaluation or {})
    report_rules = {
        str(item.get("rule_key") or ""): item
        for item in (knowledge_report.get("why_it_matters") or [])
        if isinstance(item, dict)
    }
    localized_rules = []
    for rule in localized.get("matched_rules") or []:
        if not isinstance(rule, dict):
            continue
        updated = dict(rule)
        report_rule = report_rules.get(str(updated.get("rule_key") or ""))
        if report_rule:
            updated["name"] = report_rule.get("title") or updated.get("name")
            updated["description"] = report_rule.get("summary") or updated.get("description")
            updated["summary"] = report_rule.get("summary") or updated.get("summary")
            updated["explanation"] = report_rule.get("why_it_matters") or updated.get("explanation")
        localized_rules.append(updated)
    localized["matched_rules"] = localized_rules

    report_actions = {
        str(item.get("key") or ""): item
        for item in (knowledge_report.get("action_plan") or [])
        if isinstance(item, dict)
    }
    localized_recommendations = []
    for rec in localized.get("generated_recommendations") or []:
        if not isinstance(rec, dict):
            continue
        updated = dict(rec)
        report_action = report_actions.get(str(updated.get("key") or ""))
        if report_action:
            updated["title"] = report_action.get("title") or updated.get("title")
            updated["body"] = report_action.get("body") or updated.get("body")
        localized_recommendations.append(updated)
    localized["generated_recommendations"] = localized_recommendations
    return localized


def _protocol_from_actions(actions: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    protocol = {
        "nutrition": [],
        "supplements": [],
        "lifestyle": [],
        "training_recovery": [],
    }
    for action in actions:
        category = str(action.get("category") or "").lower()
        target = "lifestyle"
        if "supplement" in category or "vitamin" in category or "mineral" in category:
            target = "supplements"
        elif "nutrition" in category or "diet" in category:
            target = "nutrition"
        elif "training" in category or "recovery" in category or "sleep" in category:
            target = "training_recovery"
        protocol[target].append(action)

    return protocol


def _estimate_tokens(payload: Any) -> int:
    raw = str(payload or "")
    return max(1, len(raw) // 4) if raw else 0


def _estimate_cost_usd(prompt_tokens: int, completion_tokens: int) -> float:
    model = (settings.active_llm_model or "").lower()
    if "gpt-4o-mini" in model:
        input_per_million = 0.15
        output_per_million = 0.60
    elif "gpt-4o" in model:
        input_per_million = 5.0
        output_per_million = 15.0
    else:
        input_per_million = 1.0
        output_per_million = 3.0
    return round((prompt_tokens / 1_000_000) * input_per_million + (completion_tokens / 1_000_000) * output_per_million, 6)


def _cost_metadata(
    *,
    biomarkers: List[Dict[str, Any]],
    symptoms: List[str],
    ai_protocol: List[Dict[str, Any]],
    used_llm: bool,
) -> Dict[str, Any]:
    prompt_tokens = _estimate_tokens({"biomarkers": biomarkers, "symptoms": symptoms})
    completion_tokens = _estimate_tokens(ai_protocol)
    return {
        "ai_prompt_tokens": prompt_tokens,
        "ai_completion_tokens": completion_tokens,
        "ai_total_tokens": prompt_tokens + completion_tokens,
        "estimated_cost_usd": _estimate_cost_usd(prompt_tokens, completion_tokens),
        "estimated": True,
        "llm_configured": used_llm,
        "model": settings.active_llm_model,
    }


def _log_analysis_core_completion(result: Dict[str, Any]) -> None:
    metadata = result.get("metadata") or {}
    quality = result.get("quality_snapshot") or {}
    coverage = quality.get("coverage") or {}
    safety = quality.get("safety") or {}
    ai = quality.get("ai") or {}
    persisted_domains = ((result.get("health_states") or {}).get("domain_registry_version")) or ""
    logger.info(
        "analysis_core_completed analysis_id=%s source=%s biomarker_count=%s "
        "registry_version=%s health_state_count=%s protocol_item_count=%s "
        "trend_available=%s ai_source=%s ai_fallback=%s safety_status=%s "
        "safety_events=%s doctor_discussion=%s",
        result.get("analysis_id") or "",
        (metadata.get("source") or {}).get("source") if isinstance(metadata.get("source"), dict) else "",
        metadata.get("biomarker_count"),
        persisted_domains,
        coverage.get("health_state_count"),
        coverage.get("protocol_item_count"),
        coverage.get("trend_available"),
        ai.get("analysis_source"),
        ai.get("fallback_used"),
        safety.get("status"),
        safety.get("event_count"),
        safety.get("doctor_discussion_required"),
    )


async def _load_historical_biomarkers(user_id: Optional[str]) -> List[Dict[str, Any]]:
    if not user_id:
        return []
    try:
        from app.services import supabase_service as supabase

        return await supabase.get_recent_biomarker_history(user_id, limit=250)
    except Exception as exc:
        logger.warning("trend_history_unavailable user_id=%s error=%s", user_id, exc)
        return []


def _protocol_sections_from_ai_and_rules(
    *,
    rule_actions: List[Dict[str, Any]],
    ai_protocol: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    protocol = _protocol_from_actions(rule_actions)
    for item in ai_protocol:
        if not isinstance(item, dict):
            continue
        category = str(item.get("category") or item.get("timing") or "").lower()
        target = "supplements" if item.get("supplement") else "lifestyle"
        if "diet" in category or "nutrition" in category:
            target = "nutrition"
        elif "sleep" in category or "recovery" in category or "training" in category:
            target = "training_recovery"
        protocol[target].append({**item, "source": item.get("source") or "ai_protocol"})
    return protocol


def _has_biomarker_family(biomarkers: List[Dict[str, Any]], keywords: Iterable[str]) -> bool:
    lowered_keywords = [keyword.lower() for keyword in keywords]
    for biomarker in biomarkers:
        haystack = " ".join(
            str(biomarker.get(key) or "")
            for key in ("name", "canonical_name", "category")
        ).lower()
        if any(keyword in haystack for keyword in lowered_keywords):
            return True
    return False


def _fill_protocol_section_fallbacks(
    protocol: Dict[str, List[Dict[str, Any]]],
    *,
    biomarkers: List[Dict[str, Any]],
    prioritized: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    if not prioritized:
        return protocol

    flagged_names = ", ".join(str(item.get("name") or "flagged marker") for item in prioritized[:3])
    iron_related = _has_biomarker_family(biomarkers, ("ferritin", "iron", "transferrin", "hemoglobin", "hematocrit", "rbc"))

    if not protocol.get("nutrition"):
        body = (
            "Use a food-first iron support pattern while confirming the cause: include protein at meals, "
            "iron-rich foods, vitamin C with iron-containing meals, and avoid taking tea/coffee or calcium "
            "right with the highest-iron meal. Do not start high-dose iron without clinician guidance."
            if iron_related
            else "Stabilize nutrition basics while this pattern is reviewed: regular protein-containing meals, vegetables, hydration, and enough total energy intake."
        )
        protocol["nutrition"] = [
            {
                "key": "nutrition_foundation_for_flagged_markers",
                "title": "Support nutrition basics while reviewing flagged markers",
                "body": body,
                "category": "nutrition",
                "priority": "medium",
                "evidence_level": "clinical_context",
                "requires_doctor": False,
                "source": "vitaloop_analysis_core",
            }
        ]

    if not protocol.get("training_recovery"):
        protocol["training_recovery"] = [
            {
                "key": "training_recovery_context_for_flagged_markers",
                "title": "Adjust training and recovery until follow-up is clear",
                "body": f"Because {flagged_names} needs review, keep training moderate if you feel fatigued, dizzy, short of breath, or unusually weak. Prioritize sleep and recovery, and seek clinician guidance before intensifying training.",
                "category": "training_recovery",
                "priority": "medium",
                "evidence_level": "clinical_context",
                "requires_doctor": iron_related,
                "source": "vitaloop_analysis_core",
            }
        ]

    return protocol


def _shopping_links(
    *,
    biomarkers: List[Dict[str, Any]],
    prioritized: List[Dict[str, Any]],
    ai_protocol: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    links: List[Dict[str, Any]] = []
    seen: set[str] = set()

    def add(label: str, query: str, reason: str, priority: str = "medium", category: str = "supplement") -> None:
        normalized_query = " ".join(str(query or "").lower().split())
        if not normalized_query or normalized_query in seen:
            return
        seen.add(normalized_query)
        links.append(
            {
                "label": label,
                "search_query": query,
                "reason": reason,
                "priority": priority,
                "category": category,
                "url": build_iherb_url(query),
                "disclaimer": "Educational shopping aid only. Confirm supplements, dosing, and interactions with a qualified clinician before use.",
            }
        )

    for item in ai_protocol:
        if not isinstance(item, dict):
            continue
        query = str(item.get("iherb_search") or item.get("supplement") or "").strip()
        if not query:
            continue
        label = str(item.get("supplement") or item.get("title") or query).strip()
        reason = str(item.get("rationale") or item.get("reason") or "Relevant to this protocol context.").strip()
        add(label, query, reason, str(item.get("priority") or "medium").lower(), "supplement")

    iron_related = _has_biomarker_family(biomarkers, ("ferritin", "iron", "transferrin", "hemoglobin", "hematocrit", "rbc"))
    has_low_ferritin = any("ferritin" in str(item.get("canonical_name") or item.get("name") or "").lower() for item in prioritized)

    if iron_related or has_low_ferritin:
        add(
            "Iron bisglycinate",
            "iron bisglycinate",
            "Relevant to low ferritin or iron-status context; confirm need and dose with a clinician.",
            "high",
        )
        add(
            "Vitamin C",
            "vitamin c",
            "Can support iron absorption when paired with iron-containing meals or clinician-approved iron supplementation.",
            "medium",
        )
        add(
            "B12 and folate support",
            "vitamin b12 folate",
            "Useful search context when reviewing iron, blood-count, or fatigue patterns with confirmatory labs.",
            "medium",
        )

    if _has_biomarker_family(biomarkers, ("vitamin d", "25 oh vitamin d")):
        add(
            "Vitamin D3",
            "vitamin d3",
            "Relevant when vitamin D is flagged; confirm dose, follow-up interval, and contraindications.",
            "medium",
        )

    if _has_biomarker_family(biomarkers, ("magnesium",)):
        add(
            "Magnesium glycinate",
            "magnesium glycinate",
            "Relevant when magnesium status or recovery context is flagged; check kidney disease and medication interactions.",
            "medium",
        )

    return links[:8]


async def run_lab_analysis_pipeline(
    *,
    biomarkers: List[Dict[str, Any]],
    symptoms: Optional[List[str]] = None,
    questionnaire: Optional[Dict[str, Any]] = None,
    user_profile: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
    analysis_id: Optional[str] = None,
    source_metadata: Optional[Dict[str, Any]] = None,
    persist_knowledge: bool = False,
    persist_report_version: bool = False,
    locale: str = "en",
    biomarker_name_aliases: Optional[Dict[str, str]] = None,
    generate_ai_protocol: bool = True,
) -> Dict[str, Any]:
    normalized_biomarkers = normalize_biomarkers(biomarkers, name_aliases=biomarker_name_aliases)
    clinical_integrity = validate_clinical_data_integrity(
        biomarkers=normalized_biomarkers,
        profile=user_profile,
    )
    normalized_symptoms = [str(item).strip().lower() for item in (symptoms or []) if str(item).strip()]
    health_context = build_health_context(
        biomarkers=normalized_biomarkers,
        symptoms=normalized_symptoms,
        questionnaire=questionnaire,
        user_profile=user_profile,
        source_metadata=source_metadata,
        locale=locale,
    )
    analysis_input_quality_gate = build_analysis_input_quality_gate(
        biomarkers=normalized_biomarkers,
        candidates=(source_metadata or {}).get("candidates") if isinstance(source_metadata, dict) else None,
        clinical_integrity=clinical_integrity,
        health_context=health_context,
        source_metadata=source_metadata,
    )

    knowledge_evaluation = await evaluate_biomarkers_with_knowledge(
        biomarkers=normalized_biomarkers,
        symptoms=normalized_symptoms,
        user_id=user_id,
        upload_id=analysis_id,
        user_profile=user_profile,
        health_context=health_context,
        persist=persist_knowledge,
    )
    knowledge_evaluation = knowledge_evaluation if isinstance(knowledge_evaluation, dict) else {}
    knowledge_report = build_knowledge_report(
        biomarkers=normalized_biomarkers,
        knowledge_evaluation=knowledge_evaluation,
        locale=locale,
    )
    knowledge_report = _strip_placeholder_source_urls(knowledge_report)
    knowledge_evaluation = _strip_placeholder_source_urls(knowledge_evaluation)
    prioritized = _prioritize_biomarkers(normalized_biomarkers)
    historical_biomarkers = await _load_historical_biomarkers(user_id)
    trend_analysis = evaluate_biomarker_trends(
        current_biomarkers=normalized_biomarkers,
        historical_biomarkers=historical_biomarkers,
        current_upload_id=analysis_id,
    )
    domain_definitions = await resolve_domain_definitions()
    health_states = evaluate_health_states(
        biomarkers=normalized_biomarkers,
        symptoms=normalized_symptoms,
        health_context=health_context,
        knowledge_report=knowledge_report,
        domain_definitions=domain_definitions,
    )
    rule_recommendations = knowledge_report.get("action_plan") or []
    ai_protocol = []
    ai_orchestration = {
        "version": "ai_orchestration_v1",
        "status": "skipped",
        "items": [],
        "metadata": {"reason": "generate_ai_protocol_disabled"},
    }
    if generate_ai_protocol:
        ai_orchestration = await generate_ai_protocol_orchestrated(
            biomarkers=normalized_biomarkers,
            symptoms=normalized_symptoms,
            user_profile=user_profile,
            user_id=user_id,
            upload_id=analysis_id,
            locale=locale,
            health_context=health_context,
            knowledge_report=knowledge_report,
            health_states=health_states,
            trend_analysis=trend_analysis,
        )
        ai_protocol = ai_orchestration.get("items") or []
    recommendations = [
        *rule_recommendations,
        *[{**item, "source": item.get("source") or "ai_protocol"} for item in ai_protocol if isinstance(item, dict)],
    ]
    protocol = _protocol_sections_from_ai_and_rules(rule_actions=rule_recommendations, ai_protocol=ai_protocol)
    protocol = _fill_protocol_section_fallbacks(
        protocol,
        biomarkers=normalized_biomarkers,
        prioritized=prioritized,
    )
    safety_result = validate_report(
        biomarkers=normalized_biomarkers,
        knowledge_report=knowledge_report,
        protocol=protocol,
        profile=user_profile,
    )
    retest_suggestions = knowledge_report.get("retest_plan") or []
    protocol = enrich_protocol(
        protocol,
        biomarkers=normalized_biomarkers,
        prioritized=prioritized,
        safety_result=safety_result,
        health_states=health_states,
        trend_analysis=trend_analysis,
        retest_suggestions=retest_suggestions,
        domain_definitions=domain_definitions,
        locale=locale,
    )
    safety_result = validate_report(
        biomarkers=normalized_biomarkers,
        knowledge_report=knowledge_report,
        protocol=protocol,
        profile=user_profile,
    )
    shopping_links = _shopping_links(
        biomarkers=normalized_biomarkers,
        prioritized=prioritized,
        ai_protocol=ai_protocol,
    )
    explainability = build_recommendation_explanations(
        biomarkers=normalized_biomarkers,
        symptoms=normalized_symptoms,
        profile=user_profile,
        knowledge_evaluation=knowledge_evaluation,
        recommendations=recommendations,
        safety_result=safety_result,
    )
    interpreted_report = build_interpreted_report(
        biomarkers=normalized_biomarkers,
        knowledge_report=knowledge_report,
        health_states=health_states,
        explainability=explainability,
        safety_result=safety_result,
        health_context=health_context,
        profile=user_profile,
        locale=locale,
    )
    evidence_gaps = build_evidence_gaps(
        biomarkers=normalized_biomarkers,
        health_states=health_states,
        interpreted_report=interpreted_report,
        clinical_integrity=clinical_integrity,
    )
    output_knowledge_evaluation = _localized_knowledge_evaluation_for_response(
        knowledge_evaluation,
        knowledge_report,
        locale,
    )
    cost_metadata = _cost_metadata(
        biomarkers=normalized_biomarkers,
        symptoms=normalized_symptoms,
        ai_protocol=ai_protocol,
        used_llm=is_llm_configured(),
    )
    quality_snapshot = build_analysis_quality_snapshot(
        health_context=health_context,
        health_states=health_states,
        trend_analysis=trend_analysis,
        ai_orchestration=ai_orchestration,
        protocol=protocol,
        safety_result=safety_result,
        cost_metadata=cost_metadata,
    )
    health_summary = {
        **(knowledge_report.get("summary") or {}),
        "what_was_found": knowledge_report.get("what_was_found") or {},
        "trend_overview": {
            "version": trend_analysis.get("version"),
            "available": trend_analysis.get("available"),
            "priority_changes": [
                {
                    "name": item.get("name"),
                    "direction": item.get("direction"),
                    "percent_change": item.get("percent_change"),
                    "interpretation": item.get("interpretation"),
                }
                for item in (trend_analysis.get("priority_changes") or [])[:5]
            ],
        },
        "health_state_overview": {
            "version": health_states.get("version"),
            "top_domains": [
                {
                    "domain": item.get("domain"),
                    "score": item.get("score"),
                    "risk_level": item.get("risk_level"),
                    "confidence": item.get("confidence"),
                }
                for item in (health_states.get("top_priorities") or [])[:5]
            ],
        },
    }
    version_provenance = {
        "pipeline_version": LAB_ANALYSIS_PIPELINE_VERSION,
        "kb_version": knowledge_report.get("version") or knowledge_evaluation.get("version"),
        "domain_registry_version": (
            (domain_definitions[0] or {}).get("registry_version")
            if domain_definitions
            else DOMAIN_REGISTRY_VERSION
        ),
        "nutrition_rules_version": (
            ((knowledge_evaluation.get("nutrition_context") or {}).get("version"))
            or NUTRITION_ALGORITHMS_VERSION
        ),
        "safety_engine_version": SAFETY_ENGINE_VERSION,
        "prompt_version": (ai_orchestration.get("metadata") or {}).get("prompt_version"),
        "model": (
            (ai_orchestration.get("metadata") or {}).get("model")
            or (ai_orchestration.get("metadata") or {}).get("llm_model")
            or getattr(settings, "active_llm_model", None)
        ),
        "locale": locale,
        "report_interpretation_version": REPORT_INTERPRETATION_VERSION,
        "analysis_input_quality_gate_version": analysis_input_quality_gate.get("version"),
        "clinical_data_integrity_version": clinical_integrity.get("version"),
        "evidence_gaps_version": evidence_gaps.get("version"),
    }

    result = {
        "analysis_id": analysis_id or "",
        "status": "completed",
        "health_summary": health_summary,
        "trend_analysis": trend_analysis,
        "health_states": health_states,
        "prioritized_biomarkers": prioritized,
        "risks_flags": _risk_flags(knowledge_report, prioritized),
        "recommendations": recommendations,
        "protocol": protocol,
        "ai_protocol": ai_protocol,
        "ai_orchestration": ai_orchestration,
        "shopping_links": shopping_links,
        "retest_suggestions": retest_suggestions,
        "doctor_summary": " ".join(knowledge_report.get("doctor_discussion") or [])[:2000],
        "knowledge_evaluation": output_knowledge_evaluation,
        "knowledge_report": knowledge_report,
        "interpreted_report": interpreted_report,
        "analysis_input_quality_gate": analysis_input_quality_gate,
        "clinical_data_integrity": clinical_integrity,
        "evidence_gaps": evidence_gaps,
        "safety_result": safety_result,
        "explainability": explainability,
        "disclaimer": (knowledge_report.get("summary") or {}).get("disclaimer") or DISCLAIMER,
        "normalized_biomarkers": normalized_biomarkers,
        "cost_metadata": cost_metadata,
        "quality_snapshot": quality_snapshot,
        "health_context": health_context,
        "metadata": {
            "source": source_metadata or {},
            "questionnaire_present": bool(questionnaire),
            "profile_present": bool(user_profile),
            "profile_context_fields": sorted([key for key, value in (user_profile or {}).items() if value not in (None, "", [])]),
            "health_context_version": health_context.get("version"),
            "health_context_readiness": health_context.get("readiness") or {},
            "ai_orchestration_version": ai_orchestration.get("version"),
            "ai_analysis_source": (ai_orchestration.get("metadata") or {}).get("analysis_source"),
            "quality_snapshot_version": quality_snapshot.get("version"),
            "biomarker_count": len(normalized_biomarkers),
            "analysis_core_version": LAB_ANALYSIS_PIPELINE_VERSION,
            "version_provenance": version_provenance,
        },
    }

    if persist_report_version and user_id and analysis_id:
        try:
            from app.services import supabase_service as supabase

            report_version = await supabase.save_report_version(
                user_id=user_id,
                upload_id=analysis_id,
                version="report_v1",
                locale=locale,
                input_snapshot={
                    "biomarkers": normalized_biomarkers,
                    "symptoms": normalized_symptoms,
                    "profile_context_fields": result["metadata"]["profile_context_fields"],
                    "source": source_metadata or {},
                    "health_context": health_context,
                    "analysis_input_quality_gate": analysis_input_quality_gate,
                    "clinical_data_integrity": clinical_integrity,
                    "health_states": health_states,
                    "trend_analysis": trend_analysis,
                    "evidence_gaps": evidence_gaps,
                    "version_provenance": version_provenance,
                    "ai_orchestration": ai_orchestration,
                    "quality_snapshot": quality_snapshot,
                    "cost_metadata": cost_metadata,
                    "knowledge_domain_definitions": {
                        "count": len(domain_definitions),
                        "registry_version": (domain_definitions[0] or {}).get("registry_version") if domain_definitions else None,
                        "domains": [item.get("key") for item in domain_definitions],
                    },
                },
                knowledge_report=knowledge_report,
                protocol=protocol,
                safety_result=safety_result,
                explainability={
                    **(explainability or {}),
                    "evidence_gaps": evidence_gaps,
                    "version_provenance": version_provenance,
                },
                interpreted_report=interpreted_report,
                status="completed" if safety_result.get("status") != "blocked" else "blocked",
            )
            result["report_version"] = report_version
            await supabase.save_safety_events(
                user_id=user_id,
                upload_id=analysis_id,
                report_version_id=report_version.get("id"),
                safety_events=safety_result.get("safety_events") or [],
            )
            try:
                result["analysis_intelligence_artifacts"] = await supabase.save_analysis_intelligence_artifacts(
                    user_id=user_id,
                    upload_id=analysis_id,
                    analysis_input_quality_gate=analysis_input_quality_gate,
                    clinical_data_integrity=clinical_integrity,
                    evidence_gaps=evidence_gaps,
                    health_states=health_states,
                )
            except Exception as exc:
                result["analysis_intelligence_artifacts"] = {
                    "persisted": False,
                    "error": type(exc).__name__,
                }
                try:
                    from app.services.ops_alerts import send_ops_alert

                    await send_ops_alert(
                        code="ANALYSIS_INTELLIGENCE_ARTIFACT_PERSISTENCE_FAILED",
                        title="Analysis intelligence artifact persistence failed",
                        severity="error",
                        source="backend.analysis",
                        details={
                            "user_id": user_id,
                            "upload_id": analysis_id,
                            "error_type": type(exc).__name__,
                            "error": str(exc)[:500],
                            "pipeline_version": LAB_ANALYSIS_PIPELINE_VERSION,
                            "quality_gate_decision": analysis_input_quality_gate.get("decision"),
                            "clinical_integrity_status": clinical_integrity.get("status"),
                            "evidence_gap_count": (evidence_gaps.get("summary") or {}).get("gap_count"),
                            "health_state_count": len(health_states.get("states") or []),
                        },
                    )
                except Exception:
                    pass
        except Exception:
            # Report-version persistence must not break the existing analysis flow.
            result["report_version"] = None
            try:
                from app.services.ops_alerts import send_ops_alert

                await send_ops_alert(
                    code="REPORT_VERSION_PERSISTENCE_FAILED",
                    title="Report version persistence failed",
                    severity="error",
                    source="backend.analysis",
                    details={
                        "user_id": user_id,
                        "upload_id": analysis_id,
                        "pipeline_version": LAB_ANALYSIS_PIPELINE_VERSION,
                    },
                )
            except Exception:
                pass

    source_value = result["metadata"].get("source") or {}
    record_analysis_cost(
        source=source_value.get("source") if isinstance(source_value, dict) else source_value,
        cost_metadata=cost_metadata,
        analysis_id=analysis_id,
        locale=locale,
    )
    _log_analysis_core_completion(result)
    return result
