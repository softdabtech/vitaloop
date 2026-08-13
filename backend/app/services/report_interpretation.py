from __future__ import annotations

from typing import Any, Dict, List


REPORT_INTERPRETATION_VERSION = "interpreted_report_v1"


def _locale(locale: str | None) -> str:
    normalized = str(locale or "en").strip().lower().replace("_", "-")
    return "uk" if normalized.startswith("uk") else "en"


COPY = {
    "en": {
        "title_stable": "No strong abnormal pattern found",
        "summary_stable": "The available markers do not form a clear priority pattern. Keep this as a baseline and compare with future results.",
        "title_context": "Markers need context before interpretation",
        "summary_context": "Some markers are outside the provided reference range, but the result needs age, sex, symptoms, medication, nutrition, and related labs before stronger conclusions.",
        "retic_title": "Isolated low reticulocyte volume indices",
        "retic_summary": "Mean Reticulocyte Volume and Mean Spherical Cell Volume are below the lab reference range, while the available reticulocyte count and fractions are in range. This is a context signal, not a diagnosis.",
        "retic_meaning": "This pattern can be useful when reviewed together with CBC indices and iron/B12/folate context. By itself it does not explain symptoms or confirm deficiency.",
        "retic_not_confirm": "This does not confirm anemia, iron deficiency, B12/folate deficiency, inflammation, or a blood disorder without related markers and clinical context.",
        "profile_gap": "Complete age, sex, height, weight, medications, supplements, and important conditions for safer interpretation.",
        "pediatric_gap": "Pediatric interpretation should use age-appropriate context and clinician review when markers are outside range.",
        "nutrition_context": "Nutrition context matters here, but supplements should not be started from these indirect markers alone. First clarify iron status, B12, folate, CBC indices, symptoms, and diet pattern.",
        "doctor_q_1": "Do these reticulocyte volume indices matter when CBC, hemoglobin, MCV, MCH, MCHC, and RDW are reviewed together?",
        "doctor_q_2": "Should ferritin, transferrin saturation, serum iron, B12, folate, and CRP be checked to clarify the pattern?",
        "doctor_q_3": "Is this appropriate to monitor only, or should it be reviewed sooner because of symptoms or pediatric context?",
        "next_profile": "Complete profile context before relying on interpretation.",
        "next_review": "Review the result with CBC indices and iron/B12/folate context.",
        "next_food": "Keep nutrition stable: regular meals, protein, iron-rich foods, B12/folate sources, vegetables, and hydration.",
        "retest": "Repeat timing should be based on clinician review, symptoms, and whether additional tests are added; do not rely on a generic interval only.",
        "disclaimer": "Educational interpretation only. It does not diagnose or replace clinician review.",
    },
    "uk": {
        "title_stable": "Сильного патерну відхилень не знайдено",
        "summary_stable": "Доступні показники не формують чіткий пріоритетний патерн. Збережіть результат як базову точку й порівнюйте з наступними аналізами.",
        "title_context": "Показники потребують контексту перед інтерпретацією",
        "summary_context": "Деякі показники виходять за межі референсу, але для сильнішого висновку потрібні вік, стать, симптоми, ліки, харчування та пов’язані аналізи.",
        "retic_title": "Ізольовано знижені об’ємні індекси ретикулоцитів",
        "retic_summary": "Mean Reticulocyte Volume і Mean Spherical Cell Volume нижче референсу лабораторії, тоді як доступні кількість і фракції ретикулоцитів у межах референсу. Це сигнал для уточнення контексту, а не діагноз.",
        "retic_meaning": "Такий патерн має сенс розглядати разом із показниками загального аналізу крові та контекстом заліза, B12 і фолату. Сам по собі він не пояснює симптоми й не підтверджує дефіцит.",
        "retic_not_confirm": "Це не підтверджує анемію, дефіцит заліза, B12/фолату, запалення або гематологічне захворювання без пов’язаних показників і клінічного контексту.",
        "profile_gap": "Заповніть вік, стать, зріст, вагу, ліки, добавки й важливі стани для безпечнішої інтерпретації.",
        "pediatric_gap": "Для дитини інтерпретація має враховувати вік і контекст; відхилення краще переглядати з лікарем.",
        "nutrition_context": "Харчовий контекст тут важливий, але не варто починати добавки лише за непрямими маркерами. Спочатку уточніть статус заліза, B12, фолату, показники ЗАК, симптоми й раціон.",
        "doctor_q_1": "Чи мають значення ці індекси ретикулоцитів разом із гемоглобіном, MCV, MCH, MCHC і RDW?",
        "doctor_q_2": "Чи варто перевірити феритин, насичення трансферину, сироваткове залізо, B12, фолат і CRP для уточнення картини?",
        "doctor_q_3": "Це достатньо просто відстежувати, чи через симптоми або дитячий вік краще переглянути швидше?",
        "next_profile": "Заповніть профіль перед тим, як покладатися на інтерпретацію.",
        "next_review": "Перегляньте результат разом із показниками ЗАК та контекстом заліза, B12 і фолату.",
        "next_food": "Підтримуйте стабільне харчування: регулярні прийоми їжі, білок, джерела заліза, B12/фолату, овочі й достатню гідратацію.",
        "retest": "Термін повторної перевірки має залежати від консультації, симптомів і додаткових аналізів; не варто спиратися лише на загальний інтервал.",
        "disclaimer": "Освітня інтерпретація. Це не діагноз і не заміна консультації лікаря.",
    },
}


def _t(locale: str, key: str) -> str:
    return COPY[_locale(locale)][key]


def _name(item: Dict[str, Any]) -> str:
    return str(item.get("name") or item.get("source_name") or item.get("canonical_name") or "").strip()


def _marker_key(item: Dict[str, Any]) -> str:
    return " ".join(str(item.get(key) or "") for key in ("name", "source_name", "canonical_name")).lower()


def _status(item: Dict[str, Any]) -> str:
    return str(item.get("status") or "").strip().upper()


def _is_low(item: Dict[str, Any]) -> bool:
    return _status(item) in {"DEFICIENT", "LOW", "L"}


def _is_in_range(item: Dict[str, Any]) -> bool:
    return _status(item) in {"OPTIMAL", "NORMAL", "IN_RANGE", "IN RANGE"}


def _format_marker(item: Dict[str, Any]) -> Dict[str, Any]:
    ref_low = item.get("ref_low")
    ref_high = item.get("ref_high")
    unit = str(item.get("unit") or "").strip()
    reference = None
    if ref_low is not None and ref_high is not None:
        reference = f"{ref_low} - {ref_high} {unit}".strip()
    return {
        "name": _name(item),
        "canonical_name": item.get("canonical_name"),
        "value": item.get("value"),
        "unit": item.get("unit"),
        "status": item.get("status"),
        "category": item.get("category"),
        "reference_range": item.get("reference_range") or reference,
    }


def _find_markers(biomarkers: List[Dict[str, Any]], aliases: List[str]) -> List[Dict[str, Any]]:
    return [item for item in biomarkers if any(alias in _marker_key(item) for alias in aliases)]


def _has_profile_field(profile: Dict[str, Any] | None, *keys: str) -> bool:
    payload = profile if isinstance(profile, dict) else {}
    return any(payload.get(key) not in (None, "", [], {}) for key in keys)


def _age(profile: Dict[str, Any] | None) -> float | None:
    payload = profile if isinstance(profile, dict) else {}
    for key in ("age", "age_years"):
        try:
            if payload.get(key) not in (None, ""):
                return float(payload.get(key))
        except (TypeError, ValueError):
            return None
    return None


def _missing_profile_context(profile: Dict[str, Any] | None) -> List[str]:
    payload = profile if isinstance(profile, dict) else {}
    required = ("age", "sex", "height_cm", "weight_kg")
    return [field for field in required if payload.get(field) in (None, "", [], {})]


def _reticulocyte_pattern(
    biomarkers: List[Dict[str, Any]],
    *,
    profile: Dict[str, Any] | None,
    locale: str,
) -> Dict[str, Any] | None:
    mean_retic_volume = _find_markers(biomarkers, ["mean reticulocyte volume", "mrv", "reticulocyte volume"])
    mean_spherical_volume = _find_markers(biomarkers, ["mean spherical cell volume", "spherical cell volume", "mscv"])
    retic_counts = _find_markers(
        biomarkers,
        [
            "reticulocytes",
            "immature reticulocytes",
            "mature reticulocytes",
            "reticulocyte distribution width",
        ],
    )

    low_volume_markers = [item for item in [*mean_retic_volume, *mean_spherical_volume] if _is_low(item)]
    if len(low_volume_markers) < 2:
        return None

    in_range_context = [
        item for item in retic_counts
        if _is_in_range(item) and item not in low_volume_markers
    ]
    missing_context = [
        "CBC: hemoglobin, RBC, hematocrit, MCV, MCH, MCHC, RDW",
        "Ferritin + transferrin saturation + serum iron",
        "Vitamin B12 + folate",
        "CRP or inflammation context when relevant",
    ]
    missing_profile = _missing_profile_context(profile)
    if missing_profile:
        missing_context.append(_t(locale, "profile_gap"))

    age = _age(profile)
    if age is not None and age < 18:
        missing_context.append(_t(locale, "pediatric_gap"))

    confidence = 0.72 if in_range_context else 0.62
    if missing_profile:
        confidence -= 0.08
    if age is not None and age < 18:
        confidence -= 0.03
    confidence = max(0.35, min(confidence, 0.82))

    return {
        "key": "isolated_low_reticulocyte_volume_indices",
        "domain": "blood_count",
        "status": "context_required",
        "priority": "medium",
        "confidence": round(confidence, 2),
        "title": _t(locale, "retic_title"),
        "summary": _t(locale, "retic_summary"),
        "what_this_means": [_t(locale, "retic_meaning")],
        "what_this_does_not_confirm": [_t(locale, "retic_not_confirm")],
        "triggered_biomarkers": [_format_marker(item) for item in low_volume_markers],
        "normal_context": [_format_marker(item) for item in in_range_context[:6]],
        "missing_context": missing_context,
        "nutrition_context": {
            "title": "Nutrition context" if _locale(locale) == "en" else "Харчовий контекст",
            "body": _t(locale, "nutrition_context"),
            "safe_boundaries": [
                "No supplement dose recommendation without confirmatory markers.",
                "No diagnosis from indirect reticulocyte indices alone.",
            ],
        },
        "next_best_steps": [
            {"key": "complete_profile", "timeframe": "today", "text": _t(locale, "next_profile"), "priority": "high"},
            {"key": "review_context", "timeframe": "next", "text": _t(locale, "next_review"), "priority": "high"},
            {"key": "nutrition_foundation", "timeframe": "this_week", "text": _t(locale, "next_food"), "priority": "medium"},
        ],
        "doctor_questions": [_t(locale, "doctor_q_1"), _t(locale, "doctor_q_2"), _t(locale, "doctor_q_3")],
        "retest_plan": [
            {
                "marker": "Mean Reticulocyte Volume / Mean Spherical Cell Volume",
                "timing": "context-based",
                "reason": _t(locale, "retest"),
                "priority": "medium",
            }
        ],
        "evidence": {
            "source": "vitaloop_pattern_engine",
            "matched_rule_key": "pattern_reticulocyte_indices_context",
            "evidence_level": "contextual_lab_pattern",
        },
    }


def _generic_pattern(
    biomarkers: List[Dict[str, Any]],
    *,
    profile: Dict[str, Any] | None,
    locale: str,
) -> Dict[str, Any] | None:
    flagged = [item for item in biomarkers if _status(item) in {"DEFICIENT", "ELEVATED", "BORDERLINE"}]
    if not flagged:
        return None
    missing_context = []
    if _missing_profile_context(profile):
        missing_context.append(_t(locale, "profile_gap"))
    return {
        "key": "generic_abnormal_markers_context_required",
        "domain": "general",
        "status": "context_required",
        "priority": "medium",
        "confidence": 0.45,
        "title": _t(locale, "title_context"),
        "summary": _t(locale, "summary_context"),
        "what_this_means": [],
        "what_this_does_not_confirm": [],
        "triggered_biomarkers": [_format_marker(item) for item in flagged[:6]],
        "normal_context": [],
        "missing_context": missing_context,
        "nutrition_context": None,
        "next_best_steps": [
            {"key": "complete_profile", "timeframe": "today", "text": _t(locale, "next_profile"), "priority": "high"},
            {"key": "review_context", "timeframe": "next", "text": _t(locale, "next_review"), "priority": "medium"},
        ],
        "doctor_questions": [],
        "retest_plan": [],
        "evidence": {"source": "vitaloop_pattern_engine", "evidence_level": "fallback"},
    }


def _informativeness_score(patterns: List[Dict[str, Any]], biomarkers: List[Dict[str, Any]], profile: Dict[str, Any] | None) -> Dict[str, Any]:
    score = 0
    reasons: List[str] = []
    if biomarkers:
        score += 20
        reasons.append("biomarkers_extracted")
    if patterns and patterns[0].get("key") != "generic_abnormal_markers_context_required":
        score += 25
        reasons.append("specific_pattern_detected")
    elif patterns:
        score += 10
        reasons.append("fallback_pattern_only")
    if patterns and patterns[0].get("missing_context"):
        score += 15
        reasons.append("missing_context_declared")
    if patterns and patterns[0].get("doctor_questions"):
        score += 15
        reasons.append("doctor_questions_specific")
    if patterns and patterns[0].get("next_best_steps"):
        score += 15
        reasons.append("next_steps_available")
    if not _missing_profile_context(profile):
        score += 10
        reasons.append("profile_context_present")
    return {"score": min(score, 100), "reasons": reasons}


def _nutrition_context(knowledge_report: Dict[str, Any] | None) -> Dict[str, Any]:
    report = knowledge_report if isinstance(knowledge_report, dict) else {}
    embedded = report.get("nutrition_context")
    if isinstance(embedded, dict):
        return embedded
    evaluation = report.get("knowledge_evaluation")
    if isinstance(evaluation, dict) and isinstance(evaluation.get("nutrition_context"), dict):
        return evaluation["nutrition_context"]
    return {}


def build_interpreted_report(
    *,
    biomarkers: List[Dict[str, Any]],
    knowledge_report: Dict[str, Any] | None = None,
    health_states: Dict[str, Any] | None = None,
    explainability: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
    health_context: Dict[str, Any] | None = None,
    profile: Dict[str, Any] | None = None,
    locale: str = "en",
) -> Dict[str, Any]:
    locale = _locale(locale)
    profile = profile if isinstance(profile, dict) else {}
    patterns = [
        item
        for item in [
            _reticulocyte_pattern(biomarkers or [], profile=profile, locale=locale),
            _generic_pattern(biomarkers or [], profile=profile, locale=locale),
        ]
        if item
    ]
    if patterns and patterns[0].get("key") != "generic_abnormal_markers_context_required":
        patterns = [patterns[0]]
    elif patterns:
        patterns = [patterns[-1]]

    flagged = [item for item in biomarkers or [] if _status(item) in {"DEFICIENT", "ELEVATED", "BORDERLINE"}]
    stable = [item for item in biomarkers or [] if _is_in_range(item)]
    primary = patterns[0] if patterns else None
    if primary:
        headline = primary["title"]
        summary = primary["summary"]
        next_steps = primary.get("next_best_steps") or []
        doctor_questions = primary.get("doctor_questions") or []
        retest_plan = primary.get("retest_plan") or []
    else:
        headline = _t(locale, "title_stable")
        summary = _t(locale, "summary_stable")
        next_steps = []
        doctor_questions = []
        retest_plan = []

    useful_states = []
    for state in (health_states or {}).get("states") or []:
        if not isinstance(state, dict):
            continue
        if state.get("risk_level") == "unknown" or state.get("score") in (None, 0):
            continue
        useful_states.append(state)

    nutrition_context = _nutrition_context(knowledge_report)
    nutrition_signals = [
        item
        for item in (nutrition_context.get("nutrition_signals") or [])
        if isinstance(item, dict)
    ]

    return {
        "version": REPORT_INTERPRETATION_VERSION,
        "locale": locale,
        "summary": {
            "headline": headline,
            "body": summary,
            "status": primary.get("status") if primary else "stable",
            "priority": primary.get("priority") if primary else "low",
            "confidence": primary.get("confidence") if primary else 0.5,
            "disclaimer": _t(locale, "disclaimer"),
        },
        "facts": {
            "total_biomarkers": len(biomarkers or []),
            "flagged_count": len(flagged),
            "stable_count": len(stable),
            "flagged_biomarkers": [_format_marker(item) for item in flagged],
            "stable_biomarkers": [_format_marker(item) for item in stable[:12]],
        },
        "patterns": patterns,
        "health_domains": useful_states[:6],
        "nutrition_context": {
            "version": nutrition_context.get("version"),
            "person_group": nutrition_context.get("person_group"),
            "signals": nutrition_signals[:8],
            "nutrient_requirements": (nutrition_context.get("nutrient_requirements") or [])[:12],
            "source_basis": nutrition_context.get("source_basis") or [],
        },
        "next_best_steps": next_steps,
        "doctor_questions": doctor_questions,
        "retest_plan": retest_plan,
        "knowledge_trace": {
            "knowledge_report_version": (knowledge_report or {}).get("version"),
            "knowledge_rule_count": len((knowledge_report or {}).get("why_it_matters") or []),
            "health_state_version": (health_states or {}).get("version"),
            "explainability_version": (explainability or {}).get("version"),
            "safety_status": (safety_result or {}).get("status"),
            "context_readiness": (health_context or {}).get("readiness") or {},
            "nutrition_algorithm_version": nutrition_context.get("version"),
        },
        "informativeness": _informativeness_score(patterns, biomarkers or [], profile),
    }
