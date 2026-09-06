from __future__ import annotations

import re
from typing import Any, Dict, List

from app.services.knowledge.domain_registry import DOMAIN_REGISTRY_VERSION, get_domain_definition

PROTOCOL_ENRICHMENT_VERSION = "protocol_enrichment_v1"


def _public_evidence_level(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return "clinical_context"
    if "placeholder" in raw:
        return "clinical_guideline_context"
    return raw

_SECTION_DEFAULT_TIMELINES = {
    "nutrition": "Start this week; reassess consistency after 2-4 weeks.",
    "supplements": "Confirm safety first; reassess after the recommended retest interval.",
    "lifestyle": "Start with small daily changes; reassess after 2-4 weeks.",
    "training_recovery": "Adjust immediately if symptoms are present; reassess weekly.",
}

_SECTION_DEFAULT_TIMELINES_UK = {
    "nutrition": "Почніть цього тижня; оцініть сталість змін через 2-4 тижні.",
    "supplements": "Спочатку підтвердьте безпечність; повторно оцініть після рекомендованого інтервалу контролю.",
    "lifestyle": "Почніть з невеликих щоденних змін; оцініть динаміку через 2-4 тижні.",
    "training_recovery": "Коригуйте одразу, якщо є симптоми; оцінюйте самопочуття щотижня.",
}

_SECTION_RETEST_MARKERS = {
    "nutrition": ["Ferritin", "Glucose", "Vitamin D"],
    "supplements": ["Ferritin", "Vitamin D", "B12", "Magnesium"],
    "lifestyle": ["Glucose", "HbA1c", "CRP"],
    "training_recovery": ["Ferritin", "CRP", "TSH"],
}

_SAFETY_HINTS = {
    "current_medications_context": "Review medication interactions before changing supplements or training intensity.",
    "current_supplements_context": "Check the current supplement stack before adding overlapping products.",
    "known_allergies_context": "Screen ingredients and excipients against known allergies.",
    "prior_diagnoses_context": "Interpret this recommendation in the context of prior diagnoses.",
    "pregnancy_context": "Use clinician-first guidance during pregnancy, planning, or lactation.",
    "pediatric_context": "Use pediatric clinician guidance before applying this recommendation.",
}

_SAFETY_HINTS_UK = {
    "current_medications_context": "Перевірте можливі взаємодії з ліками перед зміною добавок або інтенсивності тренувань.",
    "current_supplements_context": "Перевірте поточний набір добавок, щоб не дублювати активні речовини.",
    "known_allergies_context": "Звірте інгредієнти та допоміжні речовини з відомими алергіями.",
    "prior_diagnoses_context": "Інтерпретуйте цю рекомендацію з урахуванням попередніх діагнозів.",
    "pregnancy_context": "Під час вагітності, планування або лактації спочатку узгодьте дії з лікарем.",
    "pediatric_context": "Для дітей застосовуйте цю рекомендацію лише після консультації з педіатричним спеціалістом.",
}

_DOMAIN_LABELS_UK = {
    "iron_status": "Статус заліза",
    "metabolic_health": "Метаболічне здоров'я",
    "cardiovascular": "Серцево-судинний ризик",
    "inflammation": "Запальне навантаження",
    "thyroid": "Контекст щитоподібної залози",
    "liver": "Навантаження на печінку",
    "kidney": "Функція нирок",
    "micronutrients": "Статус мікронутрієнтів",
    "recovery_energy": "Відновлення та енергія",
}

_EXPECTED_TIMELINES_UK = {
    "iron_status": "Спочатку перевірте безпечність; оцініть симптоми через 2-4 тижні, а лабораторні показники - у рекомендований інтервал повторного тестування.",
    "metabolic_health": "Почніть з режиму харчування, руху, сну та медичного супроводу за потреби; оцініть тренди через 8-12 тижнів.",
    "cardiovascular": "Розглядайте це як патерн ризику, а не діагноз; узгодьте харчування, активність і медичний огляд з повторною ліпідограмою.",
    "inflammation": "Зменшіть керовані стресори та повторіть аналізи після гострої хвороби, важких тренувань або за планом лікаря.",
    "thyroid": "Інтерпретуйте разом із симптомами, ліками, контекстом вагітності та рекомендаціями лікаря перед змінами добавок.",
    "liver": "Перегляньте алкоголь, ліки, добавки, хвороби та тренувальне навантаження; повторіть аналізи за рекомендацією лікаря.",
    "kidney": "Перевірте гідратацію, ліки, добавки, білкове навантаження та рекомендації лікаря перед зміною протоколів.",
    "micronutrients": "Підтвердьте дозування і безпечність, потім повторіть відповідні маркери після рекомендованого інтервалу.",
    "recovery_energy": "Використовуйте симптоми та тренувальне навантаження для негайної корекції відновлення; підтверджуйте зміни повторними маркерами за потреби.",
}


def _text(item: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = str(item.get(key) or "").strip()
        if value:
            return value
    return ""


def _priority(item: Dict[str, Any], section: str) -> str:
    value = str(item.get("priority") or "").strip().lower()
    if value in {"critical", "high", "medium", "low"}:
        return value
    if section == "supplements":
        return "medium"
    return "low"


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug[:80] or "protocol_item"


def _matched_biomarkers(item: Dict[str, Any], biomarkers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    haystack = " ".join(str(item.get(key) or "") for key in ("key", "title", "body", "supplement", "rationale")).lower()
    matched: List[Dict[str, Any]] = []
    for biomarker in biomarkers or []:
        name = str(biomarker.get("name") or "").lower()
        canonical = str(biomarker.get("canonical_name") or "").replace("canonical_", "").replace("_", " ").lower()
        if (name and name in haystack) or (canonical and canonical in haystack):
            matched.append(
                {
                    "name": biomarker.get("name"),
                    "canonical_name": biomarker.get("canonical_name"),
                    "status": biomarker.get("status"),
                }
            )
    return matched[:5]


def _fallback_based_on(
    *,
    section: str,
    item: Dict[str, Any],
    biomarkers: List[Dict[str, Any]],
    prioritized: List[Dict[str, Any]],
    health_states: Dict[str, Any],
    trend_analysis: Dict[str, Any],
) -> Dict[str, Any]:
    matched_biomarkers = _matched_biomarkers(item, biomarkers) or [
        {
            "name": biomarker.get("name"),
            "canonical_name": biomarker.get("canonical_name"),
            "status": biomarker.get("status"),
        }
        for biomarker in (prioritized or [])[:3]
    ]
    domains = [
        {
            "domain": state.get("domain"),
            "score": state.get("score"),
            "risk_level": state.get("risk_level"),
            "confidence": state.get("confidence"),
        }
        for state in (health_states.get("top_priorities") or [])[:3]
        if isinstance(state, dict)
    ]
    trend_changes = [
        {
            "name": trend.get("name"),
            "direction": trend.get("direction"),
            "percent_change": trend.get("percent_change"),
            "interpretation": trend.get("interpretation"),
        }
        for trend in (trend_analysis.get("priority_changes") or [])[:3]
        if isinstance(trend, dict)
    ]
    return {
        "section": section,
        "biomarkers": matched_biomarkers,
        "health_domains": domains,
        "trend_changes": trend_changes,
    }


def _is_uk(locale: str | None) -> bool:
    return str(locale or "").lower().startswith("uk")


def _safety_notes(item: Dict[str, Any], safety_result: Dict[str, Any], *, locale: str = "en") -> List[str]:
    notes: List[str] = []
    if item.get("requires_doctor"):
        notes.append(
            "Обговоріть цю рекомендацію з кваліфікованим лікарем перед впровадженням."
            if _is_uk(locale)
            else "Discuss this recommendation with a qualified clinician before implementation."
        )
    for event in safety_result.get("safety_events") or []:
        if not isinstance(event, dict):
            continue
        hints = _SAFETY_HINTS_UK if _is_uk(locale) else _SAFETY_HINTS
        hint = hints.get(str(event.get("key") or ""))
        if hint and hint not in notes:
            notes.append(hint)
    return notes[:6]


def _retest_markers(section: str, item: Dict[str, Any], retest_suggestions: List[Dict[str, Any]]) -> List[str]:
    markers = [
        str(row.get("marker") or row.get("name") or "").strip()
        for row in retest_suggestions or []
        if isinstance(row, dict) and str(row.get("marker") or row.get("name") or "").strip()
    ]
    if not markers:
        markers = _SECTION_RETEST_MARKERS.get(section, [])
    text_blob = str(item).lower()
    prioritized = [marker for marker in markers if marker.lower() in text_blob]
    return (prioritized or markers)[:4]


def _domain_context(
    health_states: Dict[str, Any],
    domain_definitions: List[Dict[str, Any]] | None = None,
    *,
    locale: str = "en",
) -> List[Dict[str, Any]]:
    definitions_by_key = {
        str(item.get("key") or ""): item
        for item in (domain_definitions or [])
        if isinstance(item, dict) and str(item.get("key") or "")
    }
    contexts: List[Dict[str, Any]] = []
    for state in (health_states.get("top_priorities") or [])[:3]:
        if not isinstance(state, dict):
            continue
        definition = definitions_by_key.get(str(state.get("domain") or "")) or get_domain_definition(str(state.get("domain") or ""))
        if not definition:
            continue
        domain = str(state.get("domain") or "")
        contexts.append(
            {
                "domain": domain,
                "label": _DOMAIN_LABELS_UK.get(domain, definition.get("label")) if _is_uk(locale) else definition.get("label"),
                "evidence_level": _public_evidence_level(definition.get("evidence_level")),
                "expected_timeline": _EXPECTED_TIMELINES_UK.get(domain, definition.get("expected_timeline"))
                if _is_uk(locale)
                else definition.get("expected_timeline"),
                "retest_markers": definition.get("retest_markers") or [],
                "protocol_sections": definition.get("protocol_sections") or [],
                "requires_doctor_if_flagged": bool(definition.get("requires_doctor_if_flagged")),
            }
        )
    return contexts


def _expected_timeline(section: str, domain_contexts: List[Dict[str, Any]], *, locale: str = "en") -> str:
    for context in domain_contexts:
        if section in (context.get("protocol_sections") or []) and context.get("expected_timeline"):
            return str(context["expected_timeline"])
    if _is_uk(locale):
        return _SECTION_DEFAULT_TIMELINES_UK.get(section, "Оцініть динаміку через 2-4 тижні.")
    return _SECTION_DEFAULT_TIMELINES.get(section, "Reassess after 2-4 weeks.")


def _domain_retest_markers(section: str, domain_contexts: List[Dict[str, Any]]) -> List[str]:
    markers: List[str] = []
    for context in domain_contexts:
        if section not in (context.get("protocol_sections") or []):
            continue
        for marker in context.get("retest_markers") or []:
            text = str(marker or "").strip()
            if text and text not in markers:
                markers.append(text)
    return markers[:4]


def enrich_protocol(
    protocol: Dict[str, List[Dict[str, Any]]],
    *,
    biomarkers: List[Dict[str, Any]],
    prioritized: List[Dict[str, Any]],
    safety_result: Dict[str, Any],
    health_states: Dict[str, Any],
    trend_analysis: Dict[str, Any],
    retest_suggestions: List[Dict[str, Any]],
    domain_definitions: List[Dict[str, Any]] | None = None,
    locale: str = "en",
) -> Dict[str, List[Dict[str, Any]]]:
    enriched: Dict[str, List[Dict[str, Any]]] = {}
    domain_contexts = _domain_context(health_states, domain_definitions=domain_definitions, locale=locale)
    for section, items in (protocol or {}).items():
        enriched_items: List[Dict[str, Any]] = []
        for index, raw_item in enumerate(items or []):
            if not isinstance(raw_item, dict):
                continue
            title = _text(raw_item, "title", "supplement", "key") or f"{section.replace('_', ' ').title()} step"
            body = _text(raw_item, "body", "rationale", "reason", "dosage") or "Use this as educational guidance and personalize with clinical context."
            key = _text(raw_item, "key") or f"{section}_{_slug(title)}_{index + 1}"
            enriched_items.append(
                {
                    **raw_item,
                    "key": key,
                    "title": title,
                    "body": body,
                    "category": raw_item.get("category") or section,
                    "priority": _priority(raw_item, section),
                    "source": raw_item.get("source") or "vitaloop_analysis_core",
                    "evidence_level": _public_evidence_level(raw_item.get("evidence_level")),
                    "based_on": raw_item.get("based_on")
                    or _fallback_based_on(
                        section=section,
                        item=raw_item,
                        biomarkers=biomarkers,
                        prioritized=prioritized,
                        health_states=health_states,
                        trend_analysis=trend_analysis,
                    ),
                    "safety_notes": raw_item.get("safety_notes") or _safety_notes(raw_item, safety_result, locale=locale),
                    "expected_timeline": raw_item.get("expected_timeline") or _expected_timeline(section, domain_contexts, locale=locale),
                    "retest_markers": raw_item.get("retest_markers")
                    or _domain_retest_markers(section, domain_contexts)
                    or _retest_markers(section, raw_item, retest_suggestions),
                    "knowledge_domain_context": domain_contexts,
                    "knowledge_domain_registry_version": DOMAIN_REGISTRY_VERSION,
                    "protocol_enrichment_version": PROTOCOL_ENRICHMENT_VERSION,
                }
            )
        enriched[section] = enriched_items
    return enriched
