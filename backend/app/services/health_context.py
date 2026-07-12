from __future__ import annotations

from typing import Any, Dict, Iterable, List

from app.services.knowledge.integration import (
    build_deidentified_person_avatar,
    build_deidentified_safety_context,
)

HEALTH_CONTEXT_VERSION = "health_context_v1"


def _clean_list(values: Iterable[Any] | None, *, limit: int = 50) -> List[str]:
    result: List[str] = []
    for value in values or []:
        text = str(value or "").strip().lower()
        if text:
            result.append(text)
        if len(result) >= limit:
            break
    return result


def _present_fields(payload: Dict[str, Any] | None) -> List[str]:
    payload = payload if isinstance(payload, dict) else {}
    return sorted([key for key, value in payload.items() if value not in (None, "", [], {})])


def _biomarker_category_summary(biomarkers: List[Dict[str, Any]]) -> Dict[str, Any]:
    categories: Dict[str, int] = {}
    abnormal_categories: Dict[str, int] = {}
    statuses: Dict[str, int] = {}
    for item in biomarkers or []:
        category = str(item.get("category") or "other").strip().lower() or "other"
        status = str(item.get("status") or "BORDERLINE").strip().upper()
        categories[category] = categories.get(category, 0) + 1
        statuses[status] = statuses.get(status, 0) + 1
        if status in {"DEFICIENT", "ELEVATED", "BORDERLINE"}:
            abnormal_categories[category] = abnormal_categories.get(category, 0) + 1
    return {
        "total": len(biomarkers or []),
        "categories": categories,
        "statuses": statuses,
        "abnormal_categories": abnormal_categories,
    }


def _questionnaire_summary(questionnaire: Dict[str, Any] | None) -> Dict[str, Any]:
    questionnaire = questionnaire if isinstance(questionnaire, dict) else {}
    if not questionnaire:
        return {"present": False, "fields": []}

    domain_scores: Dict[str, Any] = {}
    for key in ("domain_scores", "scores", "domains"):
        value = questionnaire.get(key)
        if isinstance(value, dict):
            domain_scores = {
                str(domain).strip().lower(): score
                for domain, score in value.items()
                if str(domain).strip()
            }
            break

    return {
        "present": True,
        "fields": _present_fields(questionnaire),
        "domain_scores": domain_scores,
    }


def build_health_context(
    *,
    biomarkers: List[Dict[str, Any]],
    symptoms: List[str] | None = None,
    questionnaire: Dict[str, Any] | None = None,
    user_profile: Dict[str, Any] | None = None,
    source_metadata: Dict[str, Any] | None = None,
    locale: str = "en",
) -> Dict[str, Any]:
    profile = user_profile if isinstance(user_profile, dict) else {}
    source = source_metadata if isinstance(source_metadata, dict) else {}
    normalized_symptoms = _clean_list(symptoms, limit=100)
    person_avatar = build_deidentified_person_avatar(profile)
    safety_context = build_deidentified_safety_context(profile)

    return {
        "version": HEALTH_CONTEXT_VERSION,
        "locale": str(locale or "en").lower(),
        "inputs": {
            "biomarkers": _biomarker_category_summary(biomarkers or []),
            "symptoms": {
                "present": bool(normalized_symptoms),
                "count": len(normalized_symptoms),
                "items": normalized_symptoms,
            },
            "questionnaire": _questionnaire_summary(questionnaire),
            "profile": {
                "present": bool(profile),
                "fields": _present_fields(profile),
                "person_avatar": person_avatar,
                "safety_context": safety_context,
            },
        },
        "source": {
            "type": source.get("source") or source.get("type") or "unknown",
            "api_version": source.get("api_version"),
            "partner_present": bool(source.get("partner_id") or source.get("partner_name")),
        },
        "readiness": {
            "has_biomarkers": bool(biomarkers),
            "has_symptoms": bool(normalized_symptoms),
            "has_questionnaire": bool(questionnaire),
            "has_profile": bool(profile),
            "has_safety_context": bool(safety_context),
        },
    }


def build_knowledge_context_from_health_context(health_context: Dict[str, Any] | None) -> Dict[str, Any]:
    context = health_context if isinstance(health_context, dict) else {}
    profile = ((context.get("inputs") or {}).get("profile") or {}) if isinstance(context.get("inputs"), dict) else {}
    return {
        "health_context_version": context.get("version"),
        "locale": context.get("locale"),
        "person_avatar": profile.get("person_avatar") or {},
        "safety_context": profile.get("safety_context") or {},
        "profile_context_fields": profile.get("fields") or [],
        "readiness": context.get("readiness") or {},
        "biomarker_summary": ((context.get("inputs") or {}).get("biomarkers") or {}),
        "questionnaire_summary": ((context.get("inputs") or {}).get("questionnaire") or {}),
    }
