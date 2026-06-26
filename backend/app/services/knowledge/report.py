from __future__ import annotations

from typing import Any, Dict, List


STATUS_PRIORITY = {
    "DEFICIENT": 0,
    "ELEVATED": 1,
    "BORDERLINE": 2,
    "OPTIMAL": 3,
}

SEVERITY_PRIORITY = {
    "critical": 0,
    "high": 1,
    "moderate": 2,
    "low": 3,
}

CONFIDENCE_LABELS = {
    "en": {"high": "high", "moderate": "moderate", "limited": "limited", "not_estimated": "not_estimated"},
    "uk": {"high": "висока", "moderate": "помірна", "limited": "обмежена", "not_estimated": "не оцінено"},
}

STATUS_LABELS = {
    "en": {
        "DEFICIENT": "deficient",
        "ELEVATED": "elevated",
        "BORDERLINE": "borderline",
        "OPTIMAL": "in range",
    },
    "uk": {
        "DEFICIENT": "нижче референсу",
        "ELEVATED": "вище референсу",
        "BORDERLINE": "потребує спостереження",
        "OPTIMAL": "у межах референсу",
    },
}

REPORT_COPY = {
    "en": {
        "unknown_marker": "Unknown marker",
        "biomarkers_found": "{total} biomarkers found. {review} need review, {optimal} are currently in range.",
        "matched_pattern": "Matched health pattern",
        "discuss_pattern": "Discuss the pattern: {title}.",
        "ask_clinical_followup": "Ask whether this result requires clinical follow-up or additional diagnostic testing.",
        "review_marker": "Review {name} ({value}, {status}) in the context of symptoms, medications, and recent diet/training.",
        "timing_urgent": "as soon as clinically appropriate",
        "safety_review": "Safety alert requires medical review.",
        "trend_reason": "{name} is {status} and should be trended after intervention or clinical review.",
        "disclaimer": "This report is educational and is not a diagnosis. Discuss abnormal or concerning results with a qualified clinician.",
    },
    "uk": {
        "unknown_marker": "Невідомий показник",
        "biomarkers_found": "Знайдено {total} показників. {review} потребують перегляду, {optimal} зараз у межах референсу.",
        "matched_pattern": "Знайдений патерн здоровʼя",
        "discuss_pattern": "Обговоріть патерн: {title}.",
        "ask_clinical_followup": "Запитайте, чи потребує цей результат клінічного спостереження або додаткової діагностики.",
        "review_marker": "Перегляньте {name} ({value}, {status}) у контексті симптомів, ліків, харчування та навантаження останнім часом.",
        "timing_urgent": "якнайшвидше, коли це клінічно доречно",
        "safety_review": "Сигнал безпеки потребує медичного перегляду.",
        "trend_reason": "{name}: {status}. Показник варто відстежувати в динаміці після змін або консультації з лікарем.",
        "disclaimer": "Цей звіт має освітній характер і не є діагнозом. Обговоріть відхилення або тривожні результати з кваліфікованим лікарем.",
    },
}

RULE_TRANSLATIONS_UK = {
    "rule_low_ferritin_fatigue": {
        "title": "Низький феритин на фоні втоми",
        "summary": "Низький феритин разом із втомою може вказувати на можливий дефіцит запасів заліза.",
        "why_it_matters": "Феритин відображає запаси заліза. Якщо він низький і є втома, це варто обговорити з лікарем та розглянути додаткові показники заліза.",
    },
    "rule_vitamin_d_low": {
        "title": "Можлива недостатність вітаміну D",
        "summary": "Низький 25-OH вітамін D може бути повʼязаний із самопочуттям, імунною відповіддю та відновленням.",
        "why_it_matters": "Рівень вітаміну D краще оцінювати разом із симптомами, сезоном, способом життя і планом повторної перевірки.",
    },
    "rule_hba1c_elevated": {
        "title": "Підвищений HbA1c потребує медичного перегляду",
        "summary": "Підвищений HbA1c може вказувати на ризики, повʼязані з регуляцією глюкози.",
        "why_it_matters": "Цей показник потребує обговорення з лікарем, особливо якщо є симптоми, сімейна історія або інші метаболічні фактори.",
    },
    "rule_liver_enzymes_elevated": {
        "title": "Підвищені печінкові ферменти",
        "summary": "ALT/AST вище референсу можуть потребувати планового медичного перегляду.",
        "why_it_matters": "Печінкові ферменти варто оцінювати разом із ліками, алкоголем, тренуваннями, симптомами та повторною перевіркою.",
    },
    "rule_ldl_elevated": {
        "title": "LDL може потребувати кардіометаболічної уваги",
        "summary": "Підвищений LDL може бути одним із факторів серцево-судинного ризику.",
        "why_it_matters": "LDL варто обговорювати разом з іншими ліпідами, тиском, сімейною історією та загальним ризик-профілем.",
    },
}

RECOMMENDATION_TRANSLATIONS_UK = {
    "iron_followup_discussion": {
        "title": "Обговоріть подальшу перевірку статусу заліза",
        "body": "Низький феритин разом із втомою може вказувати на можливий дефіцит запасів заліза. Варто обговорити з лікарем розширені показники заліза та план повторної перевірки.",
    },
    "vitamin_d_lifestyle_and_followup": {
        "title": "Розберіть можливу недостатність вітаміну D",
        "body": "Рівень вітаміну D може вказувати на недостатність. Обговоріть із лікарем спосіб життя, можливу корекцію та термін повторного аналізу.",
    },
    "hba1c_medical_review": {
        "title": "Обговоріть підвищений HbA1c з лікарем",
        "body": "HbA1c може вказувати на підвищені метаболічні ризики і потребує медичного перегляду та, за потреби, підтверджувальних обстежень.",
    },
    "liver_enzyme_medical_review": {
        "title": "Перегляньте підвищені печінкові ферменти з лікарем",
        "body": "ALT/AST вище референсу можуть мати різні причини. Обговоріть можливі фактори, ліки, навантаження та повторну перевірку.",
    },
    "ldl_risk_reduction_plan": {
        "title": "Складіть план зниження кардіометаболічних ризиків",
        "body": "LDL може бути одним із факторів серцево-судинного ризику. Варто обговорити харчування, рух, інші показники ліпідів і подальший моніторинг.",
    },
}


def _locale(locale: str | None) -> str:
    normalized = str(locale or "en").strip().lower().replace("_", "-")
    return "uk" if normalized.startswith("uk") else "en"


def _copy(locale: str, key: str) -> str:
    normalized = _locale(locale)
    return REPORT_COPY[normalized].get(key, REPORT_COPY["en"][key])


def _status(value: Any) -> str:
    raw = str(value or "").strip().upper()
    if raw in {"LOW", "L"}:
        return "DEFICIENT"
    if raw in {"HIGH", "H"}:
        return "ELEVATED"
    if raw == "NORMAL":
        return "OPTIMAL"
    if raw in STATUS_PRIORITY:
        return raw
    return "BORDERLINE"


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_value(item: Dict[str, Any]) -> str:
    value = item.get("value")
    unit = str(item.get("unit") or "").strip()
    return f"{value:g} {unit}".strip() if isinstance(value, (int, float)) else f"{value} {unit}".strip()


def _marker_label(item: Dict[str, Any], locale: str = "en") -> str:
    fallback = _copy(locale, "unknown_marker")
    return str(item.get("name") or item.get("source_name") or fallback).strip()


def _sort_biomarkers(biomarkers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        biomarkers,
        key=lambda item: (
            STATUS_PRIORITY.get(_status(item.get("status")), 9),
            str(item.get("category") or ""),
            str(item.get("name") or ""),
        ),
    )


def _status_label(status: str, locale: str) -> str:
    normalized = _locale(locale)
    return STATUS_LABELS[normalized].get(status, status.lower())


def _confidence_label(confidence: Any, locale: str = "en") -> str:
    score = _number(confidence) or 0.0
    if score >= 0.8:
        key = "high"
    elif score >= 0.55:
        key = "moderate"
    elif score > 0:
        key = "limited"
    else:
        key = "not_estimated"
    return CONFIDENCE_LABELS[_locale(locale)].get(key, key)


def _localized_rule_text(rule: Dict[str, Any], field: str, fallback: str, locale: str) -> str:
    if _locale(locale) != "uk":
        return fallback
    translation = RULE_TRANSLATIONS_UK.get(str(rule.get("rule_key") or ""))
    if not translation:
        return fallback
    return translation.get(field) or fallback


def _localized_recommendation_text(rec: Dict[str, Any], field: str, fallback: str, locale: str) -> str:
    if _locale(locale) != "uk":
        return fallback
    translation = RECOMMENDATION_TRANSLATIONS_UK.get(str(rec.get("key") or ""))
    if not translation:
        return fallback
    return translation.get(field) or fallback


def _what_found(biomarkers: List[Dict[str, Any]], locale: str = "en") -> Dict[str, Any]:
    locale = _locale(locale)
    counts = {"total": len(biomarkers), "optimal": 0, "borderline": 0, "deficient": 0, "elevated": 0}
    flagged: List[Dict[str, Any]] = []

    for item in _sort_biomarkers(biomarkers):
        status = _status(item.get("status"))
        if status == "OPTIMAL":
            counts["optimal"] += 1
        elif status == "BORDERLINE":
            counts["borderline"] += 1
        elif status == "DEFICIENT":
            counts["deficient"] += 1
        elif status == "ELEVATED":
            counts["elevated"] += 1

        if status != "OPTIMAL":
            flagged.append(
                {
                    "name": _marker_label(item, locale),
                    "value": item.get("value"),
                    "unit": item.get("unit"),
                    "formatted_value": _format_value(item),
                    "status": status,
                    "status_label": _status_label(status, locale),
                    "category": item.get("category") or "other",
                    "reference_range": (
                        f"{item.get('ref_low')} - {item.get('ref_high')} {item.get('unit') or ''}".strip()
                        if item.get("ref_low") is not None and item.get("ref_high") is not None
                        else None
                    ),
                }
            )

    headline = _copy(locale, "biomarkers_found").format(
        total=counts["total"],
        review=counts["deficient"] + counts["elevated"] + counts["borderline"],
        optimal=counts["optimal"],
    )
    return {"headline": headline, "counts": counts, "flagged_markers": flagged[:8]}


def _rule_priority(rule: Dict[str, Any]) -> tuple[int, float]:
    severity = str(rule.get("severity") or "").strip().lower()
    confidence = _number(rule.get("confidence")) or 0.0
    return (SEVERITY_PRIORITY.get(severity, 9), -confidence)


def _interpretation(knowledge_evaluation: Dict[str, Any], locale: str = "en") -> List[Dict[str, Any]]:
    locale = _locale(locale)
    rules = knowledge_evaluation.get("matched_rules") if isinstance(knowledge_evaluation, dict) else []
    if not isinstance(rules, list):
        return []

    items: List[Dict[str, Any]] = []
    for rule in sorted((r for r in rules if isinstance(r, dict)), key=_rule_priority):
        title = rule.get("name") or rule.get("summary") or _copy(locale, "matched_pattern")
        summary = rule.get("summary") or rule.get("description") or ""
        why = rule.get("explanation") or rule.get("risk") or ""
        items.append(
            {
                "rule_key": rule.get("rule_key"),
                "title": _localized_rule_text(rule, "title", title, locale),
                "summary": _localized_rule_text(rule, "summary", summary, locale),
                "why_it_matters": _localized_rule_text(rule, "why_it_matters", why, locale),
                "risk": rule.get("risk"),
                "severity": rule.get("severity") or "moderate",
                "confidence": rule.get("confidence"),
                "requires_doctor": bool(rule.get("requires_doctor")),
                "source": rule.get("source"),
                "source_url": rule.get("source_url"),
            }
        )
    return items[:8]


def _discussion_points(knowledge_evaluation: Dict[str, Any], flagged_markers: List[Dict[str, Any]], locale: str = "en") -> List[str]:
    locale = _locale(locale)
    points: List[str] = []
    for rule in knowledge_evaluation.get("matched_rules") or []:
        if not isinstance(rule, dict):
            continue
        fallback_title = str(rule.get("name") or rule.get("summary") or "").strip()
        title = str(_localized_rule_text(rule, "title", fallback_title, locale)).strip()
        if title:
            points.append(_copy(locale, "discuss_pattern").format(title=title))
        if rule.get("requires_doctor"):
            points.append(_copy(locale, "ask_clinical_followup"))

    for marker in flagged_markers[:4]:
        status = marker.get("status_label") or _status_label(str(marker.get("status") or ""), locale)
        points.append(
            _copy(locale, "review_marker").format(
                name=marker["name"],
                value=marker["formatted_value"],
                status=status,
            )
        )

    return list(dict.fromkeys(points))[:8]


def _retest_plan(biomarkers: List[Dict[str, Any]], knowledge_evaluation: Dict[str, Any], locale: str = "en") -> List[Dict[str, Any]]:
    locale = _locale(locale)
    plan: List[Dict[str, Any]] = []
    safety_alerts = knowledge_evaluation.get("safety_alerts") if isinstance(knowledge_evaluation, dict) else []

    for alert in safety_alerts or []:
        if not isinstance(alert, dict):
            continue
        marker = str(alert.get("marker") or "").strip()
        if marker:
            plan.append(
                {
                    "marker": marker,
                    "timing": _copy(locale, "timing_urgent"),
                    "reason": alert.get("message") or _copy(locale, "safety_review"),
                    "priority": "urgent",
                }
            )

    for item in _sort_biomarkers(biomarkers):
        status = _status(item.get("status"))
        if status == "OPTIMAL":
            continue
        category = str(item.get("category") or "other").lower()
        if category in {"vitamins", "minerals", "metabolic", "lipids"}:
            timing = "8-12 weeks" if locale == "en" else "8-12 тижнів"
        elif category in {"liver", "kidney", "thyroid", "hormones"}:
            timing = "4-8 weeks" if locale == "en" else "4-8 тижнів"
        else:
            timing = "6-12 weeks" if locale == "en" else "6-12 тижнів"
        marker_name = _marker_label(item, locale)
        plan.append(
            {
                "marker": marker_name,
                "timing": timing,
                "reason": _copy(locale, "trend_reason").format(
                    name=marker_name,
                    status=_status_label(status, locale),
                ),
                "priority": "high" if status in {"DEFICIENT", "ELEVATED"} else "medium",
            }
        )

    deduped: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for row in plan:
        key = str(row.get("marker") or "").lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped[:8]


def _action_plan(knowledge_evaluation: Dict[str, Any], locale: str = "en") -> List[Dict[str, Any]]:
    locale = _locale(locale)
    recommendations = knowledge_evaluation.get("generated_recommendations") if isinstance(knowledge_evaluation, dict) else []
    actions: List[Dict[str, Any]] = []
    for rec in recommendations or []:
        if not isinstance(rec, dict):
            continue
        title = rec.get("title")
        body = rec.get("body")
        actions.append(
            {
                "key": rec.get("key"),
                "title": _localized_recommendation_text(rec, "title", title, locale),
                "body": _localized_recommendation_text(rec, "body", body, locale),
                "category": rec.get("category"),
                "priority": rec.get("priority") or "medium",
                "requires_doctor": bool(rec.get("requires_doctor")),
                "evidence_level": rec.get("evidence_level"),
            }
        )
    return actions[:8]


def build_knowledge_report(
    *,
    biomarkers: List[Dict[str, Any]],
    knowledge_evaluation: Dict[str, Any] | None,
    locale: str = "en",
) -> Dict[str, Any]:
    locale = _locale(locale)
    evaluation = knowledge_evaluation if isinstance(knowledge_evaluation, dict) else {}
    found = _what_found(biomarkers, locale=locale)
    interpretation = _interpretation(evaluation, locale=locale)
    actions = _action_plan(evaluation, locale=locale)
    safety_alerts = evaluation.get("safety_alerts") if isinstance(evaluation.get("safety_alerts"), list) else []
    requires_doctor = bool(evaluation.get("requires_doctor")) or bool(safety_alerts)

    return {
        "version": "knowledge_report_v1",
        "locale": locale,
        "summary": {
            "headline": found["headline"],
            "risk_level": "medical_review" if requires_doctor else ("needs_attention" if found["flagged_markers"] else "stable"),
            "confidence": evaluation.get("confidence", 0.0),
            "confidence_label": _confidence_label(evaluation.get("confidence"), locale=locale),
            "requires_doctor": requires_doctor,
            "disclaimer": _copy(locale, "disclaimer"),
        },
        "what_was_found": found,
        "why_it_matters": interpretation,
        "action_plan": actions,
        "doctor_discussion": _discussion_points(evaluation, found["flagged_markers"], locale=locale),
        "retest_plan": _retest_plan(biomarkers, evaluation, locale=locale),
        "safety_alerts": safety_alerts,
        "source_references": evaluation.get("source_references") if isinstance(evaluation.get("source_references"), list) else [],
    }
