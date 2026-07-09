from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from app.config import settings
from app.services.claude_service import generate_protocol, is_llm_configured
from app.services.knowledge.integration import evaluate_biomarkers_with_knowledge
from app.services.knowledge.report import build_knowledge_report
from app.services.lab_normalization.biomarker_mapping import infer_category, to_canonical_name


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
    locale: str = "en",
    biomarker_name_aliases: Optional[Dict[str, str]] = None,
    generate_ai_protocol: bool = True,
) -> Dict[str, Any]:
    normalized_biomarkers = normalize_biomarkers(biomarkers, name_aliases=biomarker_name_aliases)
    normalized_symptoms = [str(item).strip().lower() for item in (symptoms or []) if str(item).strip()]

    knowledge_evaluation = await evaluate_biomarkers_with_knowledge(
        biomarkers=normalized_biomarkers,
        symptoms=normalized_symptoms,
        user_id=user_id,
        upload_id=analysis_id,
        persist=persist_knowledge,
    )
    knowledge_report = build_knowledge_report(
        biomarkers=normalized_biomarkers,
        knowledge_evaluation=knowledge_evaluation,
        locale=locale,
    )
    prioritized = _prioritize_biomarkers(normalized_biomarkers)
    rule_recommendations = knowledge_report.get("action_plan") or []
    ai_protocol = []
    if generate_ai_protocol:
        ai_protocol = await generate_protocol(
            normalized_biomarkers,
            normalized_symptoms,
            user_profile=user_profile,
            user_id=user_id,
            upload_id=analysis_id,
        )
    recommendations = [
        *rule_recommendations,
        *[{**item, "source": item.get("source") or "ai_protocol"} for item in ai_protocol if isinstance(item, dict)],
    ]
    protocol = _protocol_sections_from_ai_and_rules(rule_actions=rule_recommendations, ai_protocol=ai_protocol)
    cost_metadata = _cost_metadata(
        biomarkers=normalized_biomarkers,
        symptoms=normalized_symptoms,
        ai_protocol=ai_protocol,
        used_llm=is_llm_configured(),
    )
    health_summary = {
        **(knowledge_report.get("summary") or {}),
        "what_was_found": knowledge_report.get("what_was_found") or {},
    }

    return {
        "analysis_id": analysis_id or "",
        "status": "completed",
        "health_summary": health_summary,
        "prioritized_biomarkers": prioritized,
        "risks_flags": _risk_flags(knowledge_report, prioritized),
        "recommendations": recommendations,
        "protocol": protocol,
        "ai_protocol": ai_protocol,
        "retest_suggestions": knowledge_report.get("retest_plan") or [],
        "doctor_summary": " ".join(knowledge_report.get("doctor_discussion") or [])[:2000],
        "knowledge_evaluation": knowledge_evaluation,
        "knowledge_report": knowledge_report,
        "disclaimer": (knowledge_report.get("summary") or {}).get("disclaimer") or DISCLAIMER,
        "normalized_biomarkers": normalized_biomarkers,
        "cost_metadata": cost_metadata,
        "metadata": {
            "source": source_metadata or {},
            "questionnaire_present": bool(questionnaire),
            "profile_present": bool(user_profile),
            "profile_context_fields": sorted([key for key, value in (user_profile or {}).items() if value not in (None, "", [])]),
            "biomarker_count": len(normalized_biomarkers),
            "analysis_core_version": "lab_analysis_pipeline_v1",
        },
    }
