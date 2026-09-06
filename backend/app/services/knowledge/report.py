from __future__ import annotations

from typing import Any, Dict, List


STATUS_PRIORITY = {
    "DEFICIENT": 0,
    "ELEVATED": 1,
    "BORDERLINE": 2,
    "UNKNOWN": 3,
    "OPTIMAL": 4,
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
        "UNKNOWN": "no reference range",
        "OPTIMAL": "in range",
    },
    "uk": {
        "DEFICIENT": "нижче референсу",
        "ELEVATED": "вище референсу",
        "BORDERLINE": "потребує спостереження",
        "UNKNOWN": "референс невідомий",
        "OPTIMAL": "у межах референсу",
    },
}

MARKER_LABELS_UK = {
    "ferritin": "Феритин",
    "glucose": "Глюкоза",
    "glucose (fasting)": "Глюкоза натще",
    "hemoglobin": "Гемоглобін",
    "hemoglobin a1c": "HbA1c",
    "total cholesterol": "Загальний холестерин",
    "ldl cholesterol": "LDL холестерин",
    "hdl cholesterol": "HDL холестерин",
    "tsh": "ТТГ",
    "tsh (thyroid stimulating hormone)": "ТТГ",
    "vitamin d": "Вітамін D",
    "vitamin b12": "Вітамін B12",
    "white blood cells (wbc)": "Лейкоцити",
    "red blood cells (rbc)": "Еритроцити",
    "platelets": "Тромбоцити",
    "hematocrit": "Гематокрит",
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
        "fallback_pattern_title": "This marker needs context, not an isolated conclusion",
        "fallback_pattern_summary": "A lab marker is outside the provided reference range, but symptoms, age, sex, weight, height, medications, and history are needed for a reliable interpretation.",
        "fallback_pattern_why": "Vitaloop uses this marker as a prioritization signal: connect it with how you feel, nutrition, medications, training load, and follow-up labs when appropriate.",
        "nutrition_title": "Support nutrition basics before conclusions",
        "nutrition_body": "Until this is clarified, prioritize regular meals with protein, iron/B12/folate food sources, vegetables, and hydration. This is not treatment; it supports clearer trend interpretation.",
        "supplement_title": "Use supplements only after deficiency is confirmed",
        "supplement_body": "Do not start iron, B12, folate, or high-dose vitamin D from one indirect marker alone. Discuss confirmatory tests and safe ranges for your age, sex, and context.",
        "profile_title": "Complete anthropometrics for a more precise analysis",
        "profile_body": "Add age, sex, height, weight, medications/supplements, and important conditions. Pediatric and adult reference interpretation can differ, so missing context limits the result.",
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
        "fallback_pattern_title": "Показник потребує контексту, а не ізольованого висновку",
        "fallback_pattern_summary": "Є відхилення у лабораторному показнику, але без симптомів, віку, статі, ваги, зросту й історії не можна коректно оцінити його значення.",
        "fallback_pattern_why": "Vitaloop використовує цей маркер як пріоритет для уточнення: зіставити з самопочуттям, харчуванням, ліками, навантаженням і, за потреби, додатковими аналізами.",
        "nutrition_title": "Підтримайте базу харчування перед висновками",
        "nutrition_body": "До консультації сфокусуйтеся на регулярних прийомах їжі з білком, джерелами заліза, B12/фолату, овочами та достатньою гідратацією. Це не лікування, а база для коректної інтерпретації динаміки.",
        "supplement_title": "БАДи лише після підтвердження дефіциту",
        "supplement_body": "Не починайте залізо, B12, фолат або високі дози вітаміну D тільки за одним непрямим маркером. Обговоріть із лікарем підтверджувальні аналізи й безпечні діапазони саме для вашого віку, статі та стану.",
        "profile_title": "Заповніть антропометрію для точнішого аналізу",
        "profile_body": "Вкажіть вік, стать, зріст, вагу, поточні ліки/БАДи й важливі стани. Дитячі й дорослі референси можуть відрізнятися, тому без цих даних висновок обмежений.",
        "disclaimer": "Цей звіт має освітній характер і не є діагнозом. Обговоріть відхилення або тривожні результати з кваліфікованим лікарем.",
    },
}

RULE_TRANSLATIONS_UK = {
    "rule_low_ferritin_fatigue": {
        "title": "Низький феритин на фоні втоми",
        "summary": "Низький феритин разом із втомою може вказувати на можливий дефіцит запасів заліза.",
        "why_it_matters": "Феритин відображає запаси заліза. Якщо він низький і є втома, це варто обговорити з лікарем та розглянути додаткові показники заліза.",
    },
    "rule_low_ferritin_without_symptom": {
        "title": "Низький феритин",
        "summary": "Феритин може вказувати на знижені запаси заліза й потребує перегляду в клінічному контексті.",
        "why_it_matters": "Феритин нижче референсу може вказувати на знижені запаси заліза. Оцінюйте його разом із загальним аналізом крові, показниками заліза, CRP, симптомами та клінічним контекстом.",
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
    "iron_panel_context_review": {
        "title": "Перегляньте статус заліза в контексті",
        "body": "Низький феритин варто інтерпретувати разом із загальним аналізом крові, сироватковим залізом, насиченням трансферину, CRP, симптомами, харчуванням, ризиком крововтрати та ліками. Обговоріть, чи потрібні додаткові показники заліза або консультація лікаря.",
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
    return "UNKNOWN"


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
    label = str(item.get("name") or item.get("source_name") or fallback).strip()
    if _locale(locale) == "uk":
        return MARKER_LABELS_UK.get(label.lower(), label)
    return label


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
    counts = {"total": len(biomarkers), "optimal": 0, "borderline": 0, "deficient": 0, "elevated": 0, "unknown": 0}
    flagged: List[Dict[str, Any]] = []

    for item in _sort_biomarkers(biomarkers):
        status = _status(item.get("status"))
        if status == "OPTIMAL":
            counts["optimal"] += 1
        elif status == "UNKNOWN":
            counts["unknown"] += 1
        elif status == "BORDERLINE":
            counts["borderline"] += 1
        elif status == "DEFICIENT":
            counts["deficient"] += 1
        elif status == "ELEVATED":
            counts["elevated"] += 1

        if status not in ("OPTIMAL", "UNKNOWN"):
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
    # The cap used to be 8 while `counts` reported the true total, so a
    # comprehensive panel produced "17 need review" above a list of 8 -- 104
    # flagged marker instances were dropped across the 15 stored uploads. The
    # list stays sorted worst-first; 24 covers a full metabolic panel with a
    # differential without reinstating that silent gap.
    return {"headline": headline, "counts": counts, "flagged_markers": flagged[:24]}


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
    # Findings, not actions: a cut here loses a rule that actually fired (34 of 95
    # across the 15 stored uploads). Ordered worst-first by severity/confidence.
    return items[:24]


def _fallback_interpretation(flagged_markers: List[Dict[str, Any]], locale: str = "en") -> List[Dict[str, Any]]:
    if not flagged_markers:
        return []
    if _locale(locale) == "uk":
        return [
            {
                "rule_key": "fallback_context_required",
                "title": _copy(locale, "fallback_pattern_title"),
                "summary": _copy(locale, "fallback_pattern_summary"),
                "why_it_matters": _copy(locale, "fallback_pattern_why"),
                "severity": "moderate",
                "confidence": 0.45,
                "requires_doctor": False,
                "source": "vitaloop_context_engine",
            }
        ]
    first = flagged_markers[0]
    return [
        {
            "rule_key": "fallback_context_required",
            "title": "This marker needs context, not an isolated conclusion",
            "summary": f"{first.get('name') or 'A marker'} is outside the provided reference range, but age, sex, symptoms, medications, and recent lifestyle matter.",
            "why_it_matters": "VITALOOP uses this as a prioritization signal for follow-up questions, clinician discussion, and retesting rather than a diagnosis.",
            "severity": "moderate",
            "confidence": 0.45,
            "requires_doctor": False,
            "source": "vitaloop_context_engine",
        }
    ]


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


def _profile_context_complete(user_profile: Dict[str, Any] | None) -> bool:
    profile = user_profile if isinstance(user_profile, dict) else {}
    return all(profile.get(key) not in (None, "", [], {}) for key in ("age", "sex", "height_cm", "weight_kg"))


def _fallback_action_plan(
    flagged_markers: List[Dict[str, Any]],
    locale: str = "en",
    user_profile: Dict[str, Any] | None = None,
) -> List[Dict[str, Any]]:
    if not flagged_markers:
        return []
    if _locale(locale) == "uk":
        actions = [
            *([] if _profile_context_complete(user_profile) else [{
                "key": "profile_required",
                "title": _copy(locale, "profile_title"),
                "body": _copy(locale, "profile_body"),
                "category": "profile",
                "priority": "high",
                "requires_doctor": False,
                "evidence_level": "context_required",
            }]),
            {
                "key": "nutrition_foundation",
                "title": _copy(locale, "nutrition_title"),
                "body": _copy(locale, "nutrition_body"),
                "category": "nutrition",
                "priority": "medium",
                "requires_doctor": False,
                "evidence_level": "best_practice",
            },
            {
                "key": "supplements_confirm_first",
                "title": _copy(locale, "supplement_title"),
                "body": _copy(locale, "supplement_body"),
                "category": "supplement_safety",
                "priority": "medium",
                "requires_doctor": True,
                "evidence_level": "safety",
            },
        ]
        return actions
    return [
        *([] if _profile_context_complete(user_profile) else [{
            "key": "profile_required",
            "title": "Complete anthropometrics before final interpretation",
            "body": "Add age, sex, height, weight, current medications and supplements. Pediatric and adult reference interpretation can differ.",
            "category": "profile",
            "priority": "high",
            "requires_doctor": False,
            "evidence_level": "context_required",
        }]),
        {
            "key": "nutrition_foundation",
            "title": "Stabilize nutrition basics before over-interpreting",
            "body": "Prioritize regular meals with protein, iron/B12/folate food sources, vegetables, and hydration while you clarify the result.",
            "category": "nutrition",
            "priority": "medium",
            "requires_doctor": False,
            "evidence_level": "best_practice",
        },
        {
            "key": "supplements_confirm_first",
            "title": "Confirm deficiencies before supplements",
            "body": "Do not start iron, B12, folate, or high-dose vitamin D from one indirect marker alone. Discuss confirmatory labs and safe ranges.",
            "category": "supplement_safety",
            "priority": "medium",
            "requires_doctor": True,
            "evidence_level": "safety",
        },
    ]


def build_knowledge_report(
    *,
    biomarkers: List[Dict[str, Any]],
    knowledge_evaluation: Dict[str, Any] | None,
    locale: str = "en",
    user_profile: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    locale = _locale(locale)
    evaluation = knowledge_evaluation if isinstance(knowledge_evaluation, dict) else {}
    found = _what_found(biomarkers, locale=locale)
    interpretation = _interpretation(evaluation, locale=locale)
    if not interpretation:
        interpretation = _fallback_interpretation(found["flagged_markers"], locale=locale)
    actions = _action_plan(evaluation, locale=locale)
    if not actions:
        actions = _fallback_action_plan(found["flagged_markers"], locale=locale, user_profile=user_profile)
    safety_alerts = evaluation.get("safety_alerts") if isinstance(evaluation.get("safety_alerts"), list) else []
    requires_doctor = bool(evaluation.get("requires_doctor")) or bool(safety_alerts)
    # Per-marker outcome accounting travelled only inside knowledge_evaluation, so
    # nothing that renders a report could tell the reader which of their markers
    # the knowledge base actually looked at. Carried here unchanged (no new text,
    # no interpretation) so a report surface can state it.
    marker_coverage = evaluation.get("marker_coverage") if isinstance(evaluation.get("marker_coverage"), dict) else {}
    unevaluated_markers = evaluation.get("unevaluated_markers") if isinstance(evaluation.get("unevaluated_markers"), list) else []

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
        "marker_coverage": marker_coverage,
        "unevaluated_markers": unevaluated_markers,
        "why_it_matters": interpretation,
        "action_plan": actions,
        "doctor_discussion": _discussion_points(evaluation, found["flagged_markers"], locale=locale),
        "retest_plan": _retest_plan(biomarkers, evaluation, locale=locale),
        "safety_alerts": safety_alerts,
        "nutrition_context": evaluation.get("nutrition_context") if isinstance(evaluation.get("nutrition_context"), dict) else {},
        "source_references": evaluation.get("source_references") if isinstance(evaluation.get("source_references"), list) else [],
    }
