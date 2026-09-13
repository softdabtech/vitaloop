from __future__ import annotations

from typing import Any, Dict, List

from app.services.knowledge.domain_registry import list_domain_definitions


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

# Broad clinical pattern engine (2026-09-12 clinical analyzer audit item #3):
# the engine previously had exactly one specific pattern (reticulocyte
# indices) plus a generic "some markers are abnormal" fallback — a panel
# with obvious iron-deficiency, metabolic, cardiovascular, thyroid, liver,
# inflammation, micronutrient, or electrolyte/kidney signal produced no
# useful interpreted pattern at all, only the generic fallback. Each entry
# here is copy for one new pattern, added the same way the reticulocyte
# pattern's copy was: title/summary/meaning/what-it-doesn't-confirm/doctor
# questions, per locale.
PATTERN_COPY: Dict[str, Dict[str, Dict[str, Any]]] = {
    "iron_deficiency_anemia": {
        "en": {
            "title": "Iron deficiency / anemia pattern",
            "summary": "Low ferritin together with low hemoglobin or hematocrit is a recognized pattern consistent with iron-deficiency anemia. This is a context signal, not a diagnosis.",
            "meaning": "Reviewed together with CBC indices (MCV, MCH, RDW) and inflammation markers, this pattern helps clarify whether iron stores and red-cell production are affected.",
            "not_confirm": "This does not confirm the cause of iron deficiency (diet, blood loss, absorption) or rule out other causes of anemia without further workup.",
            "doctor_q": [
                "Should ferritin, transferrin saturation, serum iron, and CRP be reviewed together to confirm iron status?",
                "Is further workup needed to identify the cause of iron deficiency (diet, GI, menstrual, or other blood loss)?",
                "Should iron supplementation be considered, and at what dose and monitoring schedule?",
            ],
        },
        "uk": {
            "title": "Патерн дефіциту заліза / анемії",
            "summary": "Низький феритин разом зі зниженим гемоглобіном або гематокритом — визнаний патерн, характерний для залізодефіцитної анемії. Це сигнал для контексту, а не діагноз.",
            "meaning": "Разом із показниками ЗАК (MCV, MCH, RDW) і маркерами запалення цей патерн допомагає уточнити, чи порушені запаси заліза та утворення еритроцитів.",
            "not_confirm": "Це не підтверджує причину дефіциту заліза (харчування, крововтрата, всмоктування) і не виключає інші причини анемії без додаткового обстеження.",
            "doctor_q": [
                "Чи варто разом перевірити феритин, насичення трансферину, сироваткове залізо та CRP для підтвердження статусу заліза?",
                "Чи потрібне додаткове обстеження для встановлення причини дефіциту заліза?",
                "Чи варто розглянути прийом заліза, у якій дозі та з яким моніторингом?",
            ],
        },
    },
    "metabolic_risk": {
        "en": {
            "title": "Metabolic risk pattern",
            "summary": "Elevated glucose and/or HbA1c is a recognized signal for impaired glucose regulation. This is a context signal, not a diabetes diagnosis.",
            "meaning": "Reviewed together with insulin, weight trend, and symptoms, this pattern helps clarify insulin resistance or prediabetes risk.",
            "not_confirm": "This does not diagnose diabetes or prediabetes on its own — confirmation requires repeat testing and clinical criteria.",
            "doctor_q": [
                "Should HbA1c and fasting glucose be repeated to confirm this pattern?",
                "Is fasting insulin or HOMA-IR useful here to assess insulin resistance?",
                "Are lifestyle changes (nutrition, activity, sleep) appropriate first steps, or is medical review needed sooner?",
            ],
        },
        "uk": {
            "title": "Патерн метаболічного ризику",
            "summary": "Підвищена глюкоза та/або HbA1c — визнаний сигнал порушення регуляції глюкози. Це сигнал для контексту, а не діагноз діабету.",
            "meaning": "Разом з інсуліном, динамікою ваги та симптомами цей патерн допомагає уточнити інсулінорезистентність або ризик переддіабету.",
            "not_confirm": "Це не діагностує діабет або переддіабет самостійно — підтвердження потребує повторного тестування та клінічних критеріїв.",
            "doctor_q": [
                "Чи варто повторити HbA1c та глюкозу натще для підтвердження патерну?",
                "Чи корисно перевірити інсулін натще або HOMA-IR для оцінки інсулінорезистентності?",
                "Чи достатньо змін способу життя, чи потрібна консультація лікаря швидше?",
            ],
        },
    },
    "cardiovascular_risk": {
        "en": {
            "title": "Cardiovascular risk pattern",
            "summary": "Elevated LDL and/or low HDL and/or elevated triglycerides form a recognized cardiovascular risk pattern. This is a risk context, not a diagnosis.",
            "meaning": "Reviewed together with blood pressure, family history, smoking, and activity level, this pattern helps clarify overall cardiovascular risk.",
            "not_confirm": "This does not diagnose cardiovascular disease or determine medication needs on its own.",
            "doctor_q": [
                "Should ApoB or Lp(a) be added to refine cardiovascular risk assessment?",
                "Are nutrition and activity changes appropriate first, or is medical review needed sooner given the full risk profile?",
                "Should lipids be repeated after a defined lifestyle intervention period?",
            ],
        },
        "uk": {
            "title": "Патерн серцево-судинного ризику",
            "summary": "Підвищений LDL та/або знижений HDL та/або підвищені тригліцериди формують визнаний патерн серцево-судинного ризику. Це контекст ризику, а не діагноз.",
            "meaning": "Разом з артеріальним тиском, сімейним анамнезом, курінням і рівнем активності цей патерн допомагає уточнити загальний серцево-судинний ризик.",
            "not_confirm": "Це не діагностує серцево-судинне захворювання і не визначає потребу в медикаментах самостійно.",
            "doctor_q": [
                "Чи варто додати ApoB або Lp(a) для уточнення серцево-судинного ризику?",
                "Чи достатньо змін харчування й активності, чи потрібна консультація лікаря швидше з огляду на весь профіль ризику?",
                "Чи варто повторити ліпідограму після певного періоду змін способу життя?",
            ],
        },
    },
    "thyroid_dysfunction": {
        "en": {
            "title": "Thyroid function pattern",
            "summary": "An abnormal TSH, together with available free T3/T4, is a recognized signal of possible thyroid dysfunction. This is a context signal, not a diagnosis.",
            "meaning": "Reviewed together with symptoms (energy, weight, temperature tolerance, hair) and medication history, this pattern helps clarify whether thyroid function needs closer review.",
            "not_confirm": "This does not confirm hypothyroidism, hyperthyroidism, or an autoimmune thyroid condition without further testing (e.g. antibodies) and clinical review.",
            "doctor_q": [
                "Should free T4/free T3 and thyroid antibodies be checked to clarify this pattern?",
                "Do current medications or supplements affect thyroid results?",
                "Is this appropriate to monitor only, or should it be reviewed sooner because of symptoms?",
            ],
        },
        "uk": {
            "title": "Патерн функції щитоподібної залози",
            "summary": "Відхилення TSH разом із доступними вільними T3/T4 — визнаний сигнал можливої дисфункції щитоподібної залози. Це сигнал для контексту, а не діагноз.",
            "meaning": "Разом із симптомами (енергія, вага, переносимість температури, волосся) і прийомом ліків цей патерн допомагає уточнити, чи потрібен ретельніший перегляд функції щитоподібної залози.",
            "not_confirm": "Це не підтверджує гіпотиреоз, гіпертиреоз або автоімунне захворювання щитоподібної залози без додаткових аналізів (напр. антитіл) і консультації лікаря.",
            "doctor_q": [
                "Чи варто перевірити вільний T4/T3 та антитіла до щитоподібної залози для уточнення патерну?",
                "Чи впливають поточні ліки або добавки на результати щитоподібної залози?",
                "Це достатньо просто відстежувати, чи через симптоми варто переглянути швидше?",
            ],
        },
    },
    "liver_stress": {
        "en": {
            "title": "Liver stress pattern",
            "summary": "Elevated ALT and/or AST, with or without GGT or bilirubin changes, is a recognized signal of possible liver stress. This is a context signal, not a diagnosis.",
            "meaning": "Reviewed together with alcohol intake, medications, supplements, weight, and recent illness, this pattern helps clarify a likely cause.",
            "not_confirm": "This does not diagnose fatty liver disease, hepatitis, or another liver condition without further testing and clinical review.",
            "doctor_q": [
                "Should GGT, bilirubin fractions, or a liver ultrasound be considered to clarify this pattern?",
                "Do current medications, supplements, or alcohol intake explain this result?",
                "Should liver enzymes be repeated after reviewing these factors?",
            ],
        },
        "uk": {
            "title": "Патерн навантаження на печінку",
            "summary": "Підвищені ALT та/або AST, зі змінами GGT або білірубіну або без них, — визнаний сигнал можливого навантаження на печінку. Це сигнал для контексту, а не діагноз.",
            "meaning": "Разом із вживанням алкоголю, ліками, добавками, вагою та нещодавніми хворобами цей патерн допомагає уточнити ймовірну причину.",
            "not_confirm": "Це не діагностує жирову хворобу печінки, гепатит або інше захворювання печінки без додаткових аналізів і консультації лікаря.",
            "doctor_q": [
                "Чи варто перевірити GGT, фракції білірубіну або УЗД печінки для уточнення патерну?",
                "Чи можуть поточні ліки, добавки або алкоголь пояснювати цей результат?",
                "Чи варто повторити печінкові показники після перегляду цих факторів?",
            ],
        },
    },
    "inflammation": {
        "en": {
            "title": "Inflammation load pattern",
            "summary": "Elevated CRP and/or ESR is a recognized signal of an active inflammatory process. This is a context signal, not a diagnosis of any specific condition.",
            "meaning": "Reviewed together with recent illness, injury, heavy training, symptoms, and other markers, this pattern helps clarify a likely cause.",
            "not_confirm": "This does not identify the source of inflammation (infection, autoimmune, injury, or other) without further history and testing.",
            "doctor_q": [
                "Could recent illness, injury, or heavy training explain this result, and should it be repeated after recovery?",
                "Should additional markers be checked if the pattern persists?",
                "Is this appropriate to monitor only, or should it be reviewed sooner because of symptoms?",
            ],
        },
        "uk": {
            "title": "Патерн запального навантаження",
            "summary": "Підвищені CRP та/або ШОЕ — визнаний сигнал активного запального процесу. Це сигнал для контексту, а не діагноз конкретного стану.",
            "meaning": "Разом із нещодавньою хворобою, травмою, інтенсивними тренуваннями, симптомами та іншими показниками цей патерн допомагає уточнити ймовірну причину.",
            "not_confirm": "Це не визначає джерело запалення (інфекція, автоімунне, травма чи інше) без додаткового анамнезу й аналізів.",
            "doctor_q": [
                "Чи могла нещодавня хвороба, травма або інтенсивні тренування пояснити цей результат, і чи варто повторити аналіз після відновлення?",
                "Чи варто перевірити додаткові показники, якщо патерн зберігається?",
                "Це достатньо просто відстежувати, чи через симптоми варто переглянути швидше?",
            ],
        },
    },
    "micronutrient_deficiency_cluster": {
        "en": {
            "title": "Micronutrient deficiency cluster",
            "summary": "Multiple micronutrients (e.g. vitamin D, B12, folate, magnesium, zinc) below range together is a recognized pattern worth reviewing as a cluster, not marker by marker.",
            "meaning": "Reviewed together with diet pattern, symptoms (fatigue, brain fog), and absorption factors, this pattern helps prioritize which deficiency to address first and how.",
            "not_confirm": "This does not by itself explain symptoms or justify high-dose supplementation without individualized dosing guidance.",
            "doctor_q": [
                "Which of these should be prioritized for correction first, and at what dose?",
                "Could an absorption issue (e.g. GI condition, medication) explain multiple low results at once?",
                "When should these markers be retested after starting correction?",
            ],
        },
        "uk": {
            "title": "Кластер дефіциту мікронутрієнтів",
            "summary": "Кілька мікронутрієнтів (напр. вітамін D, B12, фолат, магній, цинк) нижче референсу одночасно — визнаний патерн, який варто розглядати як кластер, а не окремо.",
            "meaning": "Разом із раціоном, симптомами (втома, туман у голові) і факторами всмоктування цей патерн допомагає визначити пріоритет корекції та спосіб.",
            "not_confirm": "Це саме по собі не пояснює симптоми і не є підставою для високих доз добавок без індивідуального підбору дозування.",
            "doctor_q": [
                "Який з цих показників варто коригувати першим і в якій дозі?",
                "Чи може проблема всмоктування (напр. ШКТ, ліки) пояснювати кілька знижених результатів одночасно?",
                "Коли варто повторити ці показники після початку корекції?",
            ],
        },
    },
    "electrolyte_kidney_safety": {
        "en": {
            "title": "Electrolyte / kidney safety pattern",
            "summary": "An abnormal potassium or sodium, together with abnormal creatinine or eGFR, is a pattern that needs prompt medical attention rather than routine follow-up.",
            "meaning": "Electrolyte and kidney function markers moving together can reflect hydration, medication effects, or kidney function changes that should not wait for a routine retest cycle.",
            "not_confirm": "This does not identify the specific cause (medication, dehydration, kidney disease, or other) without prompt clinical review.",
            "doctor_q": [
                "Should this be reviewed promptly given the combination of electrolyte and kidney markers?",
                "Do current medications, supplements, or hydration status explain this result?",
                "How soon should these markers be rechecked?",
            ],
        },
        "uk": {
            "title": "Патерн електролітів / безпеки нирок",
            "summary": "Відхилення калію або натрію разом із відхиленням креатиніну або ШКФ — патерн, що потребує швидкої консультації лікаря, а не рутинного спостереження.",
            "meaning": "Одночасні зміни електролітів і показників функції нирок можуть відображати стан гідратації, вплив ліків або зміни функції нирок, які не варто відкладати до планового повторного аналізу.",
            "not_confirm": "Це не визначає конкретну причину (ліки, зневоднення, хвороба нирок чи інше) без швидкої консультації лікаря.",
            "doctor_q": [
                "Чи варто переглянути це швидко з огляду на поєднання електролітів і показників нирок?",
                "Чи можуть поточні ліки, добавки або стан гідратації пояснювати цей результат?",
                "Як швидко варто повторити ці показники?",
            ],
        },
    },
}


DOMAIN_LABELS_UK = {
    "iron_status": "Статус заліза",
    "metabolic_health": "Метаболічне здоровʼя",
    "cardiovascular": "Серцево-судинний профіль",
    "inflammation": "Запалення",
    "thyroid": "Щитоподібна залоза",
    "liver": "Печінка",
    "kidney": "Нирки",
    "micronutrients": "Мікронутрієнти",
    "recovery_energy": "Відновлення й енергія",
    "blood_count": "Загальний аналіз крові",
    "general": "Загальний контекст",
}


def _t(locale: str, key: str) -> str:
    return COPY[_locale(locale)][key]


def _localize_health_state(state: Dict[str, Any], locale: str) -> Dict[str, Any]:
    if _locale(locale) != "uk":
        return state
    domain = str(state.get("domain") or state.get("key") or "").strip()
    if not domain:
        return state
    label = DOMAIN_LABELS_UK.get(domain)
    return {**state, "label": label or state.get("label") or domain}


def _name(item: Dict[str, Any]) -> str:
    return str(item.get("name") or item.get("source_name") or item.get("canonical_name") or "").strip()


def _marker_key(item: Dict[str, Any]) -> str:
    return " ".join(str(item.get(key) or "") for key in ("name", "source_name", "canonical_name")).lower()


def _status(item: Dict[str, Any]) -> str:
    return str(item.get("status") or "").strip().upper()


def _is_low(item: Dict[str, Any]) -> bool:
    return _status(item) in {"DEFICIENT", "LOW", "L"}


def _is_high(item: Dict[str, Any]) -> bool:
    return _status(item) in {"ELEVATED", "HIGH", "H"}


def _is_abnormal(item: Dict[str, Any]) -> bool:
    return _status(item) in {"DEFICIENT", "LOW", "L", "ELEVATED", "HIGH", "H", "BORDERLINE"}


def _is_in_range(item: Dict[str, Any]) -> bool:
    return _status(item) in {"OPTIMAL", "NORMAL", "IN_RANGE", "IN RANGE"}


def _is_unevaluated(item: Dict[str, Any]) -> bool:
    """Check if marker has unverified reference range or no reference range."""
    return _status(item) in {"UNEVALUATED", "UNKNOWN"}


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


def _to_float_marker(item: Dict[str, Any]) -> float | None:
    try:
        value = item.get("value")
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


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


def _build_pattern(
    *,
    pattern_key: str,
    domain: str,
    priority: str,
    base_confidence: float,
    triggered: List[Dict[str, Any]],
    normal_context: List[Dict[str, Any]],
    profile: Dict[str, Any] | None,
    locale: str,
    retest_marker: str,
    matched_rule_key: str,
    extra_missing_context: List[str] | None = None,
    supportive_markers: List[Dict[str, Any]] | None = None,
    contradicting_markers: List[Dict[str, Any]] | None = None,
    severity: str | None = None,
    doctor_escalation: Dict[str, Any] | None = None,
    extra_confidence_reasons: List[str] | None = None,
) -> Dict[str, Any]:
    """Shared assembly for every pattern in PATTERN_COPY.

    Same output shape as _reticulocyte_pattern — this is what "broad clinical
    pattern engine" (2026-09-12 audit item #3) factors out so each new
    pattern detector only needs to decide WHICH markers triggered it, not
    reinvent the response shape, confidence adjustment, or missing-context
    logic each time.

    2026-09-13 clinical_reasoning_trace groundwork (P1.1 iron/anemia pack,
    the reference template every later domain pack copies): confidence used
    to be a single number with the *reasons* for its adjustments only ever
    applied silently, never surfaced — `confidence_reason` is one of the
    fields the reasoning-trace contract needs and there was nowhere to read
    it from. `supportive_markers` (corroborating but not pattern-defining)
    and `contradicting_markers` (available data that argues against the
    pattern, e.g. normal transferrin saturation) also didn't exist as a
    concept — every pattern only ever had triggered_biomarkers/normal_context,
    which conflates "in range" with "actually argues against this pattern".
    `severity` and `doctor_escalation` are new, optional, additive fields —
    every existing pattern detector's call site is unaffected by their
    absence (all default to None so `.get()` on old snapshots stays safe).
    """
    copy = PATTERN_COPY[pattern_key][_locale(locale)]
    missing_context = list(extra_missing_context or [])
    missing_profile = _missing_profile_context(profile)
    confidence_reasons = list(extra_confidence_reasons or [])
    if missing_profile:
        missing_context.append(_t(locale, "profile_gap"))
        confidence_reasons.append("profile_context_incomplete")

    age = _age(profile)
    if age is not None and age < 18:
        missing_context.append(_t(locale, "pediatric_gap"))
        confidence_reasons.append("pediatric_context_requires_review")

    if normal_context:
        confidence_reasons.append("corroborating_markers_in_range")
    if supportive_markers:
        confidence_reasons.append("supportive_markers_present")

    confidence = base_confidence + (0.06 if normal_context else 0.0)
    if missing_profile:
        confidence -= 0.08
    if age is not None and age < 18:
        confidence -= 0.03
    confidence = max(0.35, min(confidence, 0.85))

    pattern: Dict[str, Any] = {
        "key": pattern_key,
        "pattern_id": pattern_key,
        "pattern_name": copy["title"],
        "domain": domain,
        "status": "context_required" if priority != "high" else "review_recommended",
        "priority": priority,
        "confidence": round(confidence, 2),
        "confidence_reason": confidence_reasons,
        "severity": severity,
        "title": copy["title"],
        "summary": copy["summary"],
        "what_this_means": [copy["meaning"]],
        "what_this_does_not_confirm": [copy["not_confirm"]],
        "triggered_biomarkers": [_format_marker(item) for item in triggered],
        "normal_context": [_format_marker(item) for item in normal_context[:6]],
        "supportive_markers": [_format_marker(item) for item in (supportive_markers or [])[:8]],
        "contradicting_markers": [_format_marker(item) for item in (contradicting_markers or [])[:8]],
        "missing_context": missing_context,
        "nutrition_context": None,
        "next_best_steps": [
            {"key": "complete_profile", "timeframe": "today", "text": _t(locale, "next_profile"), "priority": "high"},
            {"key": "review_context", "timeframe": "next", "text": _t(locale, "next_review"), "priority": "high" if priority == "high" else "medium"},
        ],
        "doctor_questions": copy["doctor_q"],
        "doctor_escalation": doctor_escalation or {"triggered": False, "reasons": []},
        "retest_plan": [
            {
                "marker": retest_marker,
                "timing": "context-based" if priority != "high" else "promptly",
                "reason": _t(locale, "retest"),
                "priority": priority,
            }
        ],
        "evidence": {
            "source": "vitaloop_pattern_engine",
            "matched_rule_key": matched_rule_key,
            "evidence_level": "contextual_lab_pattern",
        },
    }
    if (doctor_escalation or {}).get("triggered"):
        # An escalation rule (e.g. very low hemoglobin, male/postmenopausal
        # iron deficiency, symptoms of active blood loss) overrides the
        # detector's own priority bucket — it must land in urgent_review via
        # clinical_priority_planner.py regardless of what the marker-only
        # priority calculation above produced.
        pattern["priority"] = "high"
        pattern["status"] = "review_recommended"
    return pattern


_IRON_BLOOD_LOSS_SYMPTOM_ALIASES = (
    "dizziness", "shortness of breath", "chest pain", "fainting", "black stool",
    "blood in stool", "heavy periods", "heavy menstrual bleeding",
)


def _iron_deficiency_anemia_pattern(
    biomarkers: List[Dict[str, Any]],
    *,
    profile: Dict[str, Any] | None,
    locale: str,
    symptoms: List[str] | None = None,
) -> Dict[str, Any] | None:
    """Iron/anemia pattern pack — the reference template for every later
    domain pack (P1.1, 2026-09-13). Structure per the agreed spec:
    required_markers (loosened to ferritin OR hemoglobin/hematocrit+MCV, not
    an AND-only gate), supportive_markers, exclusions/modifiers (CRP
    confound, B12/folate mixed-anemia flag), confidence tiers, severity, and
    a doctor_escalation rule independent of the marker-only priority.
    """
    ferritin = _find_markers(biomarkers, ["ferritin"])
    hemoglobin = _find_markers(biomarkers, ["hemoglobin", "hgb"])
    hematocrit = _find_markers(biomarkers, ["hematocrit", "hct"])
    mcv = _find_markers(biomarkers, ["mcv", "mean corpuscular volume"])
    mch = _find_markers(biomarkers, ["mch", "mean corpuscular hemoglobin"])
    rdw = _find_markers(biomarkers, ["rdw", "red cell distribution width"])
    serum_iron = _find_markers(biomarkers, ["serum iron", "iron,"]) or _find_markers(biomarkers, [" iron "])
    transferrin_sat = _find_markers(biomarkers, ["transferrin saturation", "tsat", "% saturation"])
    crp = _find_markers(biomarkers, ["crp", "c-reactive protein", "c reactive protein"])
    b12 = _find_markers(biomarkers, ["b12", "vitamin b12", "cobalamin"])
    folate = _find_markers(biomarkers, ["folate", "folic acid"])

    low_ferritin = [item for item in ferritin if _is_low(item)]
    low_red_cell = [item for item in [*hemoglobin, *hematocrit] if _is_low(item)]
    low_mcv = [item for item in mcv if _is_low(item)]

    # Required markers: ferritin low, OR the CBC combo (low Hb/Hct + low MCV)
    # on its own — a panel without ferritin should still surface this
    # pattern from CBC alone rather than staying silent (the old detector
    # required BOTH low ferritin AND low Hb/Hct, missing this case entirely).
    if not low_ferritin and not (low_red_cell and low_mcv):
        return None

    supportive = [
        *[item for item in mcv if _is_low(item)],
        *[item for item in mch if _is_low(item)],
        *[item for item in serum_iron if _is_low(item)],
        *[item for item in transferrin_sat if _is_low(item)],
        *[item for item in rdw if _is_high(item)],
    ]

    # Exclusion/modifier #1: ferritin is an acute-phase reactant — a high CRP
    # alongside low-looking ferritin can mean ferritin is falsely elevated by
    # inflammation, not that iron stores are fine; conversely a NORMAL/HIGH
    # transferrin saturation alongside low ferritin argues against true iron
    # deficiency and belongs in contradicting_markers, not supportive.
    contradicting = [item for item in transferrin_sat if _is_in_range(item) or _is_high(item)]
    inflammation_confound = [item for item in crp if _is_high(item)]

    # Exclusion/modifier #2: low B12/folate alongside low ferritin/Hb points
    # to a possible MIXED anemia (iron + B12/folate), not pure iron
    # deficiency — surfaced as missing/confound context, not a separate
    # pattern, since this detector's job is iron-deficiency specifically.
    low_b12_or_folate = [item for item in [*b12, *folate] if _is_low(item)]

    extra_missing = [
        "Transferrin saturation + serum iron",
        "CRP or inflammation context (ferritin rises with inflammation)",
        "Recent or ongoing blood loss history",
    ]
    confidence_reasons: List[str] = []
    if inflammation_confound:
        extra_missing.append(
            "Ferritin may be falsely elevated by inflammation (CRP is high) — repeat once inflammation resolves."
        )
        confidence_reasons.append("inflammation_may_confound_ferritin")
    if low_b12_or_folate:
        extra_missing.append("Low B12/folate alongside this pattern raises possible mixed anemia — review together.")
        confidence_reasons.append("possible_mixed_anemia_b12_folate")
    if contradicting:
        confidence_reasons.append("transferrin_saturation_not_low_argues_against_pure_iron_deficiency")

    # Confidence tiers per the agreed spec: high (ferritin low + CBC/TSAT
    # corroboration), moderate (ferritin low alone, no CBC confirmation),
    # low (CBC combo without ferritin — indirect signal only).
    if low_ferritin and (low_red_cell or supportive):
        base_confidence = 0.72
    elif low_ferritin:
        base_confidence = 0.58
    else:
        base_confidence = 0.5
    if contradicting:
        base_confidence -= 0.1

    # Severity by hemoglobin depth — informs both display and escalation.
    hemoglobin_values = [_to_float_marker(item) for item in hemoglobin]
    hemoglobin_values = [v for v in hemoglobin_values if v is not None]
    lowest_hemoglobin = min(hemoglobin_values) if hemoglobin_values else None
    if lowest_hemoglobin is not None and lowest_hemoglobin < 8:
        severity = "high"
    elif lowest_hemoglobin is not None and lowest_hemoglobin < 10:
        severity = "moderate"
    elif low_ferritin or low_red_cell:
        severity = "mild"
    else:
        severity = None

    # Doctor escalation rule — independent of the marker-only priority:
    # very low hemoglobin, male sex (iron deficiency in men is not
    # explained by menstruation and needs a cause), postmenopausal-age
    # female, or symptoms suggesting active blood loss.
    sex = str((profile or {}).get("sex") or "").strip().lower()
    age = _age(profile)
    reported_symptoms = [str(s).strip().lower() for s in (symptoms or [])]
    blood_loss_symptoms = [
        s for s in reported_symptoms
        if any(alias in s or s in alias for alias in _IRON_BLOOD_LOSS_SYMPTOM_ALIASES)
    ]
    escalation_reasons: List[str] = []
    if lowest_hemoglobin is not None and lowest_hemoglobin < 8:
        escalation_reasons.append("Hemoglobin is very low (<8 g/dL) — prompt medical review, not routine follow-up.")
    if sex == "male" and (low_ferritin or low_red_cell):
        escalation_reasons.append("Iron deficiency in a male is not explained by menstruation and needs a cause investigated.")
    if sex == "female" and age is not None and age >= 55 and (low_ferritin or low_red_cell):
        escalation_reasons.append("Iron deficiency in a postmenopausal woman needs a cause investigated (e.g. GI source).")
    if blood_loss_symptoms:
        escalation_reasons.append(
            f"Reported symptom(s) ({', '.join(blood_loss_symptoms)}) can indicate active blood loss — discuss promptly."
        )
    doctor_escalation = {"triggered": bool(escalation_reasons), "reasons": escalation_reasons}

    priority = "high" if severity == "high" or doctor_escalation["triggered"] else "medium"

    return _build_pattern(
        pattern_key="iron_deficiency_anemia",
        domain="iron_status",
        priority=priority,
        base_confidence=base_confidence,
        triggered=[*low_ferritin, *low_red_cell, *low_mcv],
        normal_context=[item for item in mcv if _is_in_range(item)],
        supportive_markers=supportive,
        contradicting_markers=contradicting,
        severity=severity,
        doctor_escalation=doctor_escalation,
        extra_confidence_reasons=confidence_reasons,
        profile=profile,
        locale=locale,
        retest_marker="Ferritin, hemoglobin/hematocrit, transferrin saturation",
        matched_rule_key="pattern_iron_deficiency_anemia",
        extra_missing_context=extra_missing,
    )


_HYPERGLYCEMIA_SYMPTOM_ALIASES = (
    "excessive thirst", "frequent urination", "blurred vision", "unexplained weight loss",
    "increased hunger", "slow healing",
)


def _metabolic_risk_pattern(
    biomarkers: List[Dict[str, Any]],
    *,
    profile: Dict[str, Any] | None,
    locale: str,
    symptoms: List[str] | None = None,
) -> Dict[str, Any] | None:
    """Glucose/insulin resistance pattern pack (P1.3) — third domain on the
    reference template. Required-marker gate loosened to also trigger on
    fasting insulin ALONE (the discordant case: normal glucose/HbA1c but
    high insulin is itself an early insulin-resistance signal that the old
    detector, gated on glucose/HbA1c only, silently missed).
    """
    glucose = _find_markers(biomarkers, ["glucose"])
    hba1c = _find_markers(biomarkers, ["hba1c", "glycated hemoglobin", "a1c"])
    insulin = _find_markers(biomarkers, ["insulin"])
    triglycerides = _find_markers(biomarkers, ["triglyceride"])
    hdl = _find_markers(biomarkers, ["hdl"])
    alt = _find_markers(biomarkers, ["alt", "alanine aminotransferase"])

    high_glucose = [item for item in glucose if _is_high(item)]
    high_hba1c = [item for item in hba1c if _is_high(item)]
    high_insulin = [item for item in insulin if _is_high(item)]
    glucose_hba1c_triggered = [*high_glucose, *high_hba1c]
    if not glucose_hba1c_triggered and not high_insulin:
        return None

    # Supportive: metabolic-syndrome-adjacent markers moving the same
    # direction (high triglycerides, low HDL) or a metabolic-liver modifier
    # (elevated ALT can accompany insulin resistance / fatty liver).
    supportive = [
        *[item for item in triglycerides if _is_high(item)],
        *[item for item in hdl if _is_low(item)],
        *[item for item in alt if _is_high(item)],
        *([item for item in high_insulin if glucose_hba1c_triggered] if glucose_hba1c_triggered else []),
    ]
    # Contradicting: normal/low insulin alongside elevated glucose/HbA1c
    # argues against insulin resistance specifically being the driver (could
    # be a different mechanism, e.g. beta-cell insufficiency) — surfaced,
    # not silently folded into "normal".
    contradicting = (
        [item for item in insulin if _is_in_range(item) or _is_low(item)]
        if glucose_hba1c_triggered
        else []
    )

    confidence_reasons: List[str] = []
    discordant_insulin_only = bool(high_insulin and not glucose_hba1c_triggered)
    if discordant_insulin_only:
        base_confidence = 0.55
        confidence_reasons.append("elevated_insulin_with_normal_glucose_and_hba1c_early_signal")
    elif high_insulin and glucose_hba1c_triggered:
        base_confidence = 0.72
        confidence_reasons.append("insulin_corroborates_glucose_hba1c")
    else:
        base_confidence = 0.62
    if contradicting:
        confidence_reasons.append("insulin_not_elevated_argues_against_insulin_resistance_as_driver")
        base_confidence -= 0.08
    if supportive and not discordant_insulin_only:
        confidence_reasons.append("metabolic_syndrome_adjacent_markers_present")

    # Severity from glucose/HbA1c values against widely-used clinical
    # thresholds (ADA prediabetes/diabetes ranges) — approximate, since the
    # panel does not distinguish fasting vs random glucose; flagged as a gap.
    glucose_values = [v for v in (_to_float_marker(item) for item in high_glucose) if v is not None]
    hba1c_values = [v for v in (_to_float_marker(item) for item in high_hba1c) if v is not None]
    diabetic_range = (glucose_values and max(glucose_values) >= 126) or (hba1c_values and max(hba1c_values) >= 6.5)
    prediabetic_range = (glucose_values and max(glucose_values) >= 100) or (hba1c_values and max(hba1c_values) >= 5.7)
    if diabetic_range:
        severity = "high"
    elif prediabetic_range or high_insulin:
        severity = "moderate"
    else:
        severity = "mild"

    reported_symptoms = [str(s).strip().lower() for s in (symptoms or [])]
    hyperglycemia_symptoms = [
        s for s in reported_symptoms
        if any(alias in s or s in alias for alias in _HYPERGLYCEMIA_SYMPTOM_ALIASES)
    ]
    escalation_reasons: List[str] = []
    if diabetic_range:
        escalation_reasons.append("Glucose/HbA1c is in the diabetes-range threshold — prompt medical review rather than routine follow-up.")
    if hyperglycemia_symptoms:
        escalation_reasons.append(
            f"Reported symptom(s) ({', '.join(hyperglycemia_symptoms)}) alongside elevated glucose/HbA1c can indicate uncontrolled hyperglycemia — discuss promptly."
        )
    doctor_escalation = {"triggered": bool(escalation_reasons), "reasons": escalation_reasons}

    priority = "high" if severity == "high" or doctor_escalation["triggered"] else "medium"

    extra_missing = ["Weight trend and activity pattern"]
    if not insulin:
        extra_missing.insert(0, "Fasting insulin or HOMA-IR")
    extra_missing.append("Fasting vs random glucose timing was not distinguished — confirm testing conditions before acting on severity.")

    return _build_pattern(
        pattern_key="metabolic_risk",
        domain="metabolic_health",
        priority=priority,
        base_confidence=base_confidence,
        triggered=[*glucose_hba1c_triggered, *high_insulin],
        normal_context=[],
        supportive_markers=supportive,
        contradicting_markers=contradicting,
        severity=severity,
        doctor_escalation=doctor_escalation,
        extra_confidence_reasons=confidence_reasons,
        profile=profile,
        locale=locale,
        retest_marker="Fasting glucose, HbA1c",
        matched_rule_key="pattern_metabolic_risk",
        extra_missing_context=extra_missing,
    )


_CARDIAC_SYMPTOM_ALIASES = (
    "chest pain", "shortness of breath", "palpitations", "leg swelling", "calf pain",
)


def _cardiovascular_risk_pattern(
    biomarkers: List[Dict[str, Any]],
    *,
    profile: Dict[str, Any] | None,
    locale: str,
    symptoms: List[str] | None = None,
) -> Dict[str, Any] | None:
    """Lipid/cardiometabolic pattern pack (P1.5) — fifth domain on the
    reference template. Adds non-HDL/ApoB/Lp(a) as supportive corroboration
    (or, for ApoB, a discordance check against LDL) and CRP/glucose as
    cardiometabolic modifiers, plus severity/escalation thresholds for
    severe hypercholesterolemia and pancreatitis-risk triglycerides.
    """
    ldl = _find_markers(biomarkers, ["ldl"])
    hdl = _find_markers(biomarkers, ["hdl"])
    triglycerides = _find_markers(biomarkers, ["triglyceride"])
    total_cholesterol = _find_markers(biomarkers, ["total cholesterol", "cholesterol total"])
    non_hdl = _find_markers(biomarkers, ["non-hdl", "non hdl"])
    apob = _find_markers(biomarkers, ["apob", "apo b"])
    lp_a = _find_markers(biomarkers, ["lp(a)", "lipoprotein(a)", "lpa"])
    crp = _find_markers(biomarkers, ["crp", "hs-crp", "hs crp", "c-reactive protein"])
    glucose_hba1c = _find_markers(biomarkers, ["glucose", "hba1c", "a1c"])

    high_ldl = [item for item in ldl if _is_high(item)]
    low_hdl = [item for item in hdl if _is_low(item)]
    high_trig = [item for item in triglycerides if _is_high(item)]
    high_chol = [item for item in total_cholesterol if _is_high(item)]
    triggered = [*high_ldl, *low_hdl, *high_trig, *high_chol]
    if not triggered:
        return None

    high_non_hdl = [item for item in non_hdl if _is_high(item)]
    high_apob = [item for item in apob if _is_high(item)]
    high_lp_a = [item for item in lp_a if _is_high(item)]
    high_crp = [item for item in crp if _is_high(item)]
    high_metabolic_modifier = [item for item in glucose_hba1c if _is_high(item)]

    supportive = [*high_non_hdl, *high_apob, *high_lp_a, *high_crp, *high_metabolic_modifier]
    # Discordance check: a NORMAL/LOW ApoB despite high LDL-C argues that
    # the actual atherogenic particle burden may be lower than the LDL-C
    # number alone implies (LDL-C and ApoB can disagree, especially with
    # high triglycerides) — surfaced as contradicting, not silently ignored.
    contradicting = [item for item in apob if (_is_in_range(item) or _is_low(item)) and high_ldl]

    confidence_reasons: List[str] = []
    base_confidence = 0.68 if (high_ldl and low_hdl) or (high_ldl and high_trig) else 0.6
    if high_apob or high_non_hdl:
        base_confidence += 0.05
        confidence_reasons.append("apob_or_non_hdl_corroborates_atherogenic_burden")
    if high_lp_a:
        confidence_reasons.append("lp_a_adds_independent_genetic_risk_signal")
    if high_crp:
        confidence_reasons.append("hs_crp_adds_cardiometabolic_inflammatory_context")
    if high_metabolic_modifier:
        confidence_reasons.append("glucose_hba1c_elevation_compounds_cardiometabolic_risk")
    if contradicting:
        confidence_reasons.append("apob_not_elevated_despite_high_ldl_suggests_lower_particle_burden_than_ldl_c_implies")
        base_confidence -= 0.08
    base_confidence = max(0.35, min(base_confidence, 0.85))

    ldl_values = [v for v in (_to_float_marker(item) for item in high_ldl) if v is not None]
    trig_values = [v for v in (_to_float_marker(item) for item in high_trig) if v is not None]
    severe_ldl = bool(ldl_values and max(ldl_values) >= 190)
    pancreatitis_risk_trig = bool(trig_values and max(trig_values) >= 500)
    if severe_ldl or pancreatitis_risk_trig:
        severity = "high"
    elif (high_ldl and low_hdl) or (high_ldl and high_trig) or high_apob:
        severity = "moderate"
    else:
        severity = "mild"

    reported_symptoms = [str(s).strip().lower() for s in (symptoms or [])]
    cardiac_symptoms = [
        s for s in reported_symptoms
        if any(alias in s or s in alias for alias in _CARDIAC_SYMPTOM_ALIASES)
    ]
    escalation_reasons: List[str] = []
    if severe_ldl:
        escalation_reasons.append("LDL is in the severe hypercholesterolemia range (≥190 mg/dL) — discuss promptly, including possible familial hypercholesterolemia.")
    if pancreatitis_risk_trig:
        escalation_reasons.append("Triglycerides are in the pancreatitis-risk range (≥500 mg/dL) — prompt medical review rather than routine follow-up.")
    if cardiac_symptoms:
        escalation_reasons.append(
            f"Reported symptom(s) ({', '.join(cardiac_symptoms)}) alongside an atherogenic lipid pattern should be discussed promptly, not deferred to a routine retest."
        )
    doctor_escalation = {"triggered": bool(escalation_reasons), "reasons": escalation_reasons}
    priority = "high" if severity == "high" or doctor_escalation["triggered"] else ("high" if (high_ldl and low_hdl) or (high_ldl and high_trig) else "medium")

    return _build_pattern(
        pattern_key="cardiovascular_risk",
        domain="cardiovascular",
        priority=priority,
        base_confidence=base_confidence,
        triggered=triggered,
        normal_context=[],
        supportive_markers=supportive,
        contradicting_markers=contradicting,
        severity=severity,
        doctor_escalation=doctor_escalation,
        extra_confidence_reasons=confidence_reasons,
        profile=profile,
        locale=locale,
        retest_marker="Lipid panel (LDL, HDL, triglycerides)",
        matched_rule_key="pattern_cardiovascular_risk",
        extra_missing_context=["Blood pressure, family history, smoking status", "ApoB or Lp(a) if available"],
    )


_THYROID_STORM_MYXEDEMA_SYMPTOM_ALIASES = (
    "palpitations", "rapid heartbeat", "racing heart", "high fever",
    "confusion", "severe fatigue", "hypothermia", "feeling very cold",
)


def _thyroid_dysfunction_pattern(
    biomarkers: List[Dict[str, Any]],
    *,
    profile: Dict[str, Any] | None,
    locale: str,
    symptoms: List[str] | None = None,
) -> Dict[str, Any] | None:
    """Thyroid pattern pack (P1.2) — second domain built on the iron/anemia
    reference template: required TSH, supportive/contradicting free T4/T3
    depending on whether they move WITH or AGAINST TSH's direction,
    biotin/medication exclusion, severity from how far TSH is out of range,
    and doctor escalation for suppressed/very high TSH or thyroid-storm /
    myxedema symptoms.
    """
    tsh = _find_markers(biomarkers, ["tsh", "thyroid stimulating hormone"])
    free_t3 = _find_markers(biomarkers, ["free t3", "ft3"])
    free_t4 = _find_markers(biomarkers, ["free t4", "ft4"])

    abnormal_tsh = [item for item in tsh if _is_abnormal(item)]
    if not abnormal_tsh:
        return None

    tsh_direction = "high" if any(_is_high(item) for item in abnormal_tsh) else "low"
    t3_t4_items = [*free_t3, *free_t4]

    # Supportive: free T4/T3 abnormal in the SAME direction TSH implies
    # thyroid failure (low TSH + high fT4/fT3 = hyperthyroid picture; high
    # TSH + low fT4/fT3 = hypothyroid picture) — this corroborates an overt
    # disorder, not just an isolated TSH shift.
    if tsh_direction == "high":
        supportive = [item for item in t3_t4_items if _is_low(item)]
        contradicting = [item for item in t3_t4_items if _is_high(item)]
    else:
        supportive = [item for item in t3_t4_items if _is_high(item)]
        contradicting = [item for item in t3_t4_items if _is_low(item)]
    # Free T4/T3 IN RANGE while TSH is abnormal is the classic subclinical
    # picture — informative, but it argues against an OVERT disorder, so it
    # belongs in contradicting_markers rather than "normal_context" being
    # silently neutral about it.
    normal_t3_t4 = [item for item in t3_t4_items if _is_in_range(item)]
    contradicting = [*contradicting, *normal_t3_t4]

    confidence_reasons: List[str] = []
    base_confidence = 0.62
    if supportive:
        base_confidence = 0.72
        confidence_reasons.append("free_t3_t4_confirms_tsh_direction")
    elif normal_t3_t4:
        base_confidence = 0.55
        confidence_reasons.append("free_t3_t4_in_range_suggests_subclinical_picture")

    # Exclusion/modifier: biotin (a common supplement) is a well-known
    # immunoassay interferent that can produce falsely abnormal thyroid
    # results — flagged as missing context to confirm, not assumed away.
    extra_missing = ["Thyroid antibodies (anti-TPO, anti-Tg)", "Medication history affecting thyroid results"]
    extra_missing.append("Biotin/supplement use in the last 48 hours can falsely skew thyroid immunoassays — confirm before acting on this result.")
    confidence_reasons.append("biotin_supplement_interference_not_ruled_out")

    # Severity by how far TSH is out of range — informs escalation.
    tsh_values = [v for v in (_to_float_marker(item) for item in abnormal_tsh) if v is not None]
    extreme_tsh = tsh_direction == "high" and tsh_values and max(tsh_values) >= 10
    suppressed_tsh = tsh_direction == "low" and tsh_values and min(tsh_values) <= 0.1
    if extreme_tsh or suppressed_tsh:
        severity = "high"
    elif supportive:
        severity = "moderate"
    else:
        severity = "mild"

    reported_symptoms = [str(s).strip().lower() for s in (symptoms or [])]
    storm_symptoms = [
        s for s in reported_symptoms
        if any(alias in s or s in alias for alias in _THYROID_STORM_MYXEDEMA_SYMPTOM_ALIASES)
    ]
    escalation_reasons: List[str] = []
    if extreme_tsh:
        escalation_reasons.append("TSH is markedly elevated (≥10) — prompt medical review rather than routine follow-up.")
    if suppressed_tsh:
        escalation_reasons.append("TSH is fully suppressed (≤0.1) — prompt medical review rather than routine follow-up.")
    if storm_symptoms and supportive:
        escalation_reasons.append(
            f"Reported symptom(s) ({', '.join(storm_symptoms)}) alongside an overt thyroid picture can indicate thyroid storm or myxedema — discuss promptly."
        )
    age = _age(profile)
    if age is not None and age >= 60 and supportive:
        escalation_reasons.append("Age 60+ with an overt thyroid picture carries added cardiac risk — discuss sooner rather than monitoring only.")
    doctor_escalation = {"triggered": bool(escalation_reasons), "reasons": escalation_reasons}

    priority = "high" if severity == "high" or doctor_escalation["triggered"] else "medium"

    return _build_pattern(
        pattern_key="thyroid_dysfunction",
        domain="thyroid",
        priority=priority,
        base_confidence=base_confidence,
        triggered=[*abnormal_tsh, *supportive],
        normal_context=[],
        supportive_markers=supportive,
        contradicting_markers=contradicting,
        severity=severity,
        doctor_escalation=doctor_escalation,
        extra_confidence_reasons=confidence_reasons,
        profile=profile,
        locale=locale,
        retest_marker="TSH, free T4, free T3",
        matched_rule_key="pattern_thyroid_dysfunction",
        extra_missing_context=extra_missing,
    )


_LIVER_ALARM_SYMPTOM_ALIASES = (
    "jaundice", "yellowing of skin", "yellowing of eyes", "dark urine", "abdominal pain",
    "easy bruising", "swelling", "confusion",
)


def _liver_stress_pattern(
    biomarkers: List[Dict[str, Any]],
    *,
    profile: Dict[str, Any] | None,
    locale: str,
    symptoms: List[str] | None = None,
) -> Dict[str, Any] | None:
    """Liver pattern pack (P1.6) — sixth domain on the reference template.
    Adds ALP/albumin/platelets to distinguish a cholestatic component and a
    synthetic-function/portal-hypertension signal from isolated
    hepatocellular enzyme elevation, plus severity/escalation thresholds for
    marked transaminitis or bilirubin elevation.
    """
    alt = _find_markers(biomarkers, ["alt", "alanine aminotransferase"])
    ast = _find_markers(biomarkers, ["ast", "aspartate aminotransferase"])
    ggt = _find_markers(biomarkers, ["ggt", "gamma-glutamyl"])
    alp = _find_markers(biomarkers, ["alp", "alkaline phosphatase"])
    bilirubin = _find_markers(biomarkers, ["bilirubin"])
    albumin = _find_markers(biomarkers, ["albumin"])
    platelets = _find_markers(biomarkers, ["platelet"])

    high_alt_ast = [item for item in [*alt, *ast] if _is_high(item)]
    if not high_alt_ast:
        return None

    high_ggt_alp_bili = [item for item in [*ggt, *alp, *bilirubin] if _is_high(item)]
    low_albumin = [item for item in albumin if _is_low(item)]
    low_platelets = [item for item in platelets if _is_low(item)]
    normal_albumin = [item for item in albumin if _is_in_range(item)]
    normal_platelets = [item for item in platelets if _is_in_range(item)]

    supportive = [*high_ggt_alp_bili, *low_albumin, *low_platelets]
    # Normal albumin/platelets alongside elevated transaminases argue
    # against advanced/synthetic liver dysfunction (cirrhosis, portal
    # hypertension) — a reassuring signal worth surfacing explicitly rather
    # than leaving the reader to assume the worst from ALT/AST alone.
    contradicting = [*normal_albumin, *normal_platelets]

    high_alp_or_bili = [item for item in [*alp, *bilirubin] if _is_high(item)]
    cholestatic_component = bool(high_alp_or_bili)

    confidence_reasons: List[str] = []
    base_confidence = 0.63
    if cholestatic_component:
        confidence_reasons.append("cholestatic_component_present_alongside_hepatocellular_enzymes")
        base_confidence += 0.03
    else:
        confidence_reasons.append("hepatocellular_pattern_without_cholestatic_component")
    if low_albumin or low_platelets:
        confidence_reasons.append("synthetic_function_or_portal_hypertension_signal_present")
        base_confidence += 0.05
    if normal_albumin and normal_platelets:
        confidence_reasons.append("normal_albumin_platelets_argue_against_advanced_liver_disease")
    base_confidence = max(0.35, min(base_confidence, 0.85))

    alt_ast_values = [v for v in (_to_float_marker(item) for item in high_alt_ast) if v is not None]
    bilirubin_values = [v for v in (_to_float_marker(item) for item in bilirubin if _is_high(item)) if v is not None]
    marked_transaminitis = bool(alt_ast_values and max(alt_ast_values) >= 500)
    high_bilirubin = bool(bilirubin_values and max(bilirubin_values) >= 3)
    if marked_transaminitis or high_bilirubin:
        severity = "high"
    elif alt_ast_values and max(alt_ast_values) >= 200:
        severity = "moderate"
    else:
        severity = "mild"

    reported_symptoms = [str(s).strip().lower() for s in (symptoms or [])]
    liver_alarm_symptoms = [
        s for s in reported_symptoms
        if any(alias in s or s in alias for alias in _LIVER_ALARM_SYMPTOM_ALIASES)
    ]
    escalation_reasons: List[str] = []
    if marked_transaminitis:
        escalation_reasons.append("ALT/AST is markedly elevated (≥500 U/L) — prompt medical review rather than routine follow-up.")
    if high_bilirubin:
        escalation_reasons.append("Bilirubin is elevated enough to suggest jaundice risk — prompt medical review rather than routine follow-up.")
    if liver_alarm_symptoms:
        escalation_reasons.append(
            f"Reported symptom(s) ({', '.join(liver_alarm_symptoms)}) alongside elevated liver enzymes should be discussed promptly, not deferred to a routine retest."
        )
    doctor_escalation = {"triggered": bool(escalation_reasons), "reasons": escalation_reasons}
    priority = "high" if severity == "high" or doctor_escalation["triggered"] else "medium"

    return _build_pattern(
        pattern_key="liver_stress",
        domain="liver",
        priority=priority,
        base_confidence=base_confidence,
        triggered=[*high_alt_ast, *high_ggt_alp_bili],
        normal_context=[],
        supportive_markers=supportive,
        contradicting_markers=contradicting,
        severity=severity,
        doctor_escalation=doctor_escalation,
        extra_confidence_reasons=confidence_reasons,
        profile=profile,
        locale=locale,
        retest_marker="ALT, AST, GGT, bilirubin",
        matched_rule_key="pattern_liver_stress",
        extra_missing_context=["Alcohol intake, medications, and supplements", "Recent illness or significant weight change"],
    )


_SEPSIS_LIKE_SYMPTOM_ALIASES = (
    "high fever", "confusion", "rapid heartbeat", "racing heart", "severe pain",
    "difficulty breathing", "shortness of breath",
)


def _inflammation_pattern(
    biomarkers: List[Dict[str, Any]],
    *,
    profile: Dict[str, Any] | None,
    locale: str,
    symptoms: List[str] | None = None,
) -> Dict[str, Any] | None:
    """Inflammation pattern pack (P1.4) — fourth domain on the reference
    template. Distinguishes an acute-pattern (CRP/ESR + high WBC/neutrophils)
    from an isolated/chronic-pattern (CRP/ESR elevated with WBC/neutrophils
    in range), and adds platelets as a reactive-thrombocytosis modifier.
    """
    crp = _find_markers(biomarkers, ["crp", "c-reactive protein", "c reactive protein"])
    esr = _find_markers(biomarkers, ["esr", "sed rate", "erythrocyte sedimentation"])
    wbc = _find_markers(biomarkers, ["wbc", "white blood cell", "leukocyte"])
    neutrophils = _find_markers(biomarkers, ["neutrophil"])
    lymphocytes = _find_markers(biomarkers, ["lymphocyte"])
    ferritin = _find_markers(biomarkers, ["ferritin"])
    platelets = _find_markers(biomarkers, ["platelet"])

    high_crp_esr = [item for item in [*crp, *esr] if _is_high(item)]
    if not high_crp_esr:
        return None

    high_wbc_neutrophils = [item for item in [*wbc, *neutrophils] if _is_high(item)]
    normal_wbc_neutrophils = [item for item in [*wbc, *neutrophils] if _is_in_range(item)]
    high_platelets = [item for item in platelets if _is_high(item)]
    high_ferritin = [item for item in ferritin if _is_high(item)]
    low_lymphocytes = [item for item in lymphocytes if _is_low(item)]

    supportive = [*high_wbc_neutrophils, *high_platelets, *low_lymphocytes]
    # Isolated CRP/ESR elevation WITH a normal WBC/neutrophil count argues
    # against an acute infectious process specifically (chronic/low-grade
    # inflammation, or a non-infectious driver, is more likely) — this does
    # not contradict "inflammation is present", only the acute-infection
    # framing, so it is flagged in confidence_reason, not treated as
    # disproving the pattern.
    contradicting = normal_wbc_neutrophils if not high_wbc_neutrophils else []

    confidence_reasons: List[str] = []
    if high_wbc_neutrophils:
        base_confidence = 0.68
        confidence_reasons.append("wbc_neutrophils_support_acute_pattern")
    elif normal_wbc_neutrophils:
        base_confidence = 0.5
        confidence_reasons.append("normal_wbc_suggests_chronic_or_nonacute_process_not_acute_infection")
    else:
        base_confidence = 0.55
    if high_ferritin:
        confidence_reasons.append("ferritin_elevated_as_acute_phase_reactant_not_necessarily_iron_overload")
    if high_platelets:
        confidence_reasons.append("reactive_thrombocytosis_consistent_with_inflammation")

    crp_values = [v for v in (_to_float_marker(item) for item in crp if _is_high(item)) if v is not None]
    wbc_values = [v for v in (_to_float_marker(item) for item in wbc if _is_high(item)) if v is not None]
    marked_elevation = (crp_values and max(crp_values) >= 100) or (wbc_values and max(wbc_values) >= 15)
    if marked_elevation:
        severity = "high"
    elif high_wbc_neutrophils:
        severity = "moderate"
    else:
        severity = "mild"

    reported_symptoms = [str(s).strip().lower() for s in (symptoms or [])]
    sepsis_like_symptoms = [
        s for s in reported_symptoms
        if any(alias in s or s in alias for alias in _SEPSIS_LIKE_SYMPTOM_ALIASES)
    ]
    escalation_reasons: List[str] = []
    if marked_elevation:
        escalation_reasons.append("CRP/WBC is markedly elevated — prompt medical review rather than routine follow-up.")
    if sepsis_like_symptoms and high_wbc_neutrophils:
        escalation_reasons.append(
            f"Reported symptom(s) ({', '.join(sepsis_like_symptoms)}) alongside an acute inflammatory pattern can indicate a serious infection — discuss promptly, do not wait for a routine retest."
        )
    doctor_escalation = {"triggered": bool(escalation_reasons), "reasons": escalation_reasons}
    priority = "high" if severity == "high" or doctor_escalation["triggered"] else "medium"

    return _build_pattern(
        pattern_key="inflammation",
        domain="inflammation",
        priority=priority,
        base_confidence=base_confidence,
        triggered=[*high_crp_esr, *high_wbc_neutrophils],
        normal_context=[],
        supportive_markers=supportive,
        contradicting_markers=contradicting,
        severity=severity,
        doctor_escalation=doctor_escalation,
        extra_confidence_reasons=confidence_reasons,
        profile=profile,
        locale=locale,
        retest_marker="CRP, ESR",
        matched_rule_key="pattern_inflammation_load",
        extra_missing_context=["Recent illness, injury, or heavy training history", "Symptoms (pain, fatigue, fever)"],
    )


def _micronutrient_deficiency_cluster_pattern(
    biomarkers: List[Dict[str, Any]], *, profile: Dict[str, Any] | None, locale: str
) -> Dict[str, Any] | None:
    vitamin_d = _find_markers(biomarkers, ["vitamin d", "25-oh", "25(oh)"])
    b12 = _find_markers(biomarkers, ["b12", "vitamin b12", "cobalamin"])
    folate = _find_markers(biomarkers, ["folate", "folic acid"])
    magnesium = _find_markers(biomarkers, ["magnesium"])
    zinc = _find_markers(biomarkers, ["zinc"])

    low_by_group = [
        [item for item in group if _is_low(item)]
        for group in (vitamin_d, b12, folate, magnesium, zinc)
    ]
    low_groups_hit = [group for group in low_by_group if group]
    # Cluster pattern needs >=2 distinct low micronutrients — a single low
    # marker is better served by the knowledge-rule layer, not this pattern.
    if len(low_groups_hit) < 2:
        return None

    triggered = [item for group in low_groups_hit for item in group]
    return _build_pattern(
        pattern_key="micronutrient_deficiency_cluster",
        domain="micronutrients",
        priority="medium",
        base_confidence=0.6,
        triggered=triggered,
        normal_context=[],
        profile=profile,
        locale=locale,
        retest_marker="Vitamin D, B12, folate, magnesium, zinc (whichever are low)",
        matched_rule_key="pattern_micronutrient_deficiency_cluster",
        extra_missing_context=["Diet pattern and supplement history", "GI/absorption conditions or medications affecting absorption"],
    )


_RENAL_ALARM_SYMPTOM_ALIASES = (
    "muscle weakness", "confusion", "decreased urination", "palpitations",
    "swelling", "shortness of breath",
)


def _electrolyte_kidney_safety_pattern(
    biomarkers: List[Dict[str, Any]],
    *,
    profile: Dict[str, Any] | None,
    locale: str,
    symptoms: List[str] | None = None,
) -> Dict[str, Any] | None:
    """Kidney/electrolyte pattern pack (P1.7) — seventh domain on the
    reference template, expanding the existing safety pattern. Adds BUN and
    chloride/CO2 as supportive corroboration or an acute-vs-established
    contradicting signal, and severity/escalation thresholds anchored to
    well-established clinical cutoffs (critical potassium, eGFR kidney-
    failure range) rather than only the generic abnormal/normal status.
    """
    potassium = _find_markers(biomarkers, ["potassium"])
    sodium = _find_markers(biomarkers, ["sodium"])
    creatinine = _find_markers(biomarkers, ["creatinine"])
    egfr = _find_markers(biomarkers, ["egfr", "gfr"])
    bun = _find_markers(biomarkers, ["bun", "blood urea nitrogen", "urea"])
    chloride = _find_markers(biomarkers, ["chloride"])
    co2 = _find_markers(biomarkers, ["co2", "bicarbonate"])

    abnormal_electrolyte = [item for item in [*potassium, *sodium] if _is_abnormal(item)]
    abnormal_kidney = [item for item in [*creatinine, *egfr] if _is_abnormal(item)]
    if not abnormal_electrolyte or not abnormal_kidney:
        return None

    abnormal_bun = [item for item in bun if _is_abnormal(item)]
    abnormal_acid_base = [item for item in [*chloride, *co2] if _is_abnormal(item)]
    normal_bun = [item for item in bun if _is_in_range(item)]

    supportive = [*abnormal_bun, *abnormal_acid_base]
    # A normal BUN despite abnormal creatinine/eGFR can point to a more
    # acute or isolated change rather than established, longer-standing
    # kidney dysfunction (BUN and creatinine can rise at different rates) —
    # surfaced explicitly rather than assumed away.
    contradicting = normal_bun

    confidence_reasons: List[str] = []
    base_confidence = 0.7
    if abnormal_bun:
        confidence_reasons.append("bun_corroborates_kidney_involvement")
        base_confidence += 0.05
    if abnormal_acid_base:
        confidence_reasons.append("acid_base_markers_add_context")
    if normal_bun:
        confidence_reasons.append("normal_bun_suggests_acute_or_isolated_change_rather_than_established_ckd")
    base_confidence = min(base_confidence, 0.9)

    potassium_values = [v for v in (_to_float_marker(item) for item in potassium) if v is not None]
    egfr_values = [v for v in (_to_float_marker(item) for item in egfr) if v is not None]
    critical_potassium = bool(potassium_values and (min(potassium_values) < 2.5 or max(potassium_values) > 6.5))
    kidney_failure_range = bool(egfr_values and min(egfr_values) < 15)
    severe_egfr = bool(egfr_values and min(egfr_values) < 30)
    if critical_potassium or kidney_failure_range:
        severity = "high"
    elif severe_egfr:
        severity = "moderate"
    else:
        severity = "mild"

    reported_symptoms = [str(s).strip().lower() for s in (symptoms or [])]
    renal_alarm_symptoms = [
        s for s in reported_symptoms
        if any(alias in s or s in alias for alias in _RENAL_ALARM_SYMPTOM_ALIASES)
    ]
    # This is already a safety-tier pattern by design (abnormal electrolyte
    # AND abnormal kidney marker together) — doctor_escalation is triggered
    # by default here, with reasons specific to what makes it urgent.
    escalation_reasons: List[str] = ["Abnormal electrolyte and kidney markers together need prompt review, not a routine retest cycle."]
    if critical_potassium:
        escalation_reasons.append("Potassium is in the critical range (<2.5 or >6.5 mmol/L) — urgent, not routine.")
    if kidney_failure_range:
        escalation_reasons.append("eGFR is in the kidney-failure range (<15) — urgent, not routine.")
    if renal_alarm_symptoms:
        escalation_reasons.append(f"Reported symptom(s) ({', '.join(renal_alarm_symptoms)}) reinforce the need for prompt review.")
    doctor_escalation = {"triggered": True, "reasons": escalation_reasons}

    return _build_pattern(
        pattern_key="electrolyte_kidney_safety",
        domain="kidney",
        priority="high",
        base_confidence=base_confidence,
        triggered=[*abnormal_electrolyte, *abnormal_kidney],
        normal_context=[],
        supportive_markers=supportive,
        contradicting_markers=contradicting,
        severity=severity,
        doctor_escalation=doctor_escalation,
        extra_confidence_reasons=confidence_reasons,
        profile=profile,
        locale=locale,
        retest_marker="Potassium, sodium, creatinine, eGFR",
        matched_rule_key="pattern_electrolyte_kidney_safety",
        extra_missing_context=[
            "Current medications affecting electrolytes or kidney function",
            "Hydration status",
            "Urine albumin/creatinine ratio or urinalysis, if not already drawn",
        ],
    )


_PATTERN_PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


def _domain_symptom_aliases() -> Dict[str, List[str]]:
    """Static domain->symptom_aliases map (domain_registry.py's built-in
    registry — the managed/Supabase override is intentionally not consulted
    here: this is a lightweight, synchronous lookup used inside a pattern's
    construction, and list_domain_definitions() already reflects any
    override at the layer that resolves domains, e.g. health_state_engine).
    """
    return {
        item["key"]: [str(alias).strip().lower() for alias in item.get("symptom_aliases") or []]
        for item in list_domain_definitions()
    }


def _symptoms_for_domain(domain: str, symptoms: List[str], alias_map: Dict[str, List[str]]) -> List[str]:
    aliases = alias_map.get(domain) or []
    if not aliases or not symptoms:
        return []
    matched = []
    for symptom in symptoms:
        symptom_lower = str(symptom).strip().lower()
        if not symptom_lower:
            continue
        if any(alias in symptom_lower or symptom_lower in alias for alias in aliases):
            matched.append(symptom_lower)
    return matched


def _attach_symptom_links(patterns: List[Dict[str, Any]], symptoms: List[str]) -> List[Dict[str, Any]]:
    """Symptom-lab cluster linking (2026-09-12 audit, deferred item under
    'not implemented yet' #1 / clinical_priority_planner's symptom_drivers
    bucket): each detected pattern already carries a domain
    (iron_status/cardiovascular/thyroid/...) that matches a key in
    domain_registry.py's static registry, which already maintains a
    symptom_aliases list per domain for exactly this kind of matching
    (health_state_engine.py already consumes it the same way). Wiring
    reported symptoms against that existing list — instead of inventing a
    second, separate symptom taxonomy — lets a pattern say "the user also
    reported fatigue, which is a recognized symptom for this domain" without
    any new clinical judgment: it's set membership against data that already
    exists, not diagnostic reasoning.
    """
    if not symptoms:
        return [{**pattern, "symptom_signal": []} for pattern in patterns]
    alias_map = _domain_symptom_aliases()
    linked = []
    for pattern in patterns:
        domain = str(pattern.get("domain") or "").strip().lower()
        matched_symptoms = _symptoms_for_domain(domain, symptoms, alias_map)
        linked.append({**pattern, "symptom_signal": matched_symptoms})
    return linked


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


def detect_patterns(
    biomarkers: List[Dict[str, Any]],
    *,
    profile: Dict[str, Any] | None = None,
    symptoms: List[str] | None = None,
    locale: str = "en",
) -> List[Dict[str, Any]]:
    """Run every pattern detector and return the matched/ranked/symptom-linked list.

    Extracted out of build_interpreted_report() (2026-09-12 audit follow-up,
    "full evidence_gaps/patterns integration into the LLM context") so the
    pipeline can compute the SAME pattern list once, early — before the LLM
    call — and feed it into clinical_context, instead of the LLM prompt only
    ever seeing raw matched_rules/risk_flags and the patterns themselves
    being computed only after the LLM already ran.
    """
    locale = _locale(locale)
    profile = profile if isinstance(profile, dict) else {}
    normalized_symptoms = [str(item).strip().lower() for item in (symptoms or []) if str(item).strip()]

    # Run every specific detector and keep every one that matched, ranked by
    # priority then confidence — a panel can legitimately show more than one
    # pattern at once (e.g. iron-deficiency anemia AND a lipid pattern
    # together). Only fall back to the generic "some markers are abnormal"
    # message when NOT ONE specific detector matched anything.
    specific_patterns = [
        item
        for item in [
            _electrolyte_kidney_safety_pattern(
                biomarkers or [], profile=profile, locale=locale, symptoms=normalized_symptoms
            ),
            _reticulocyte_pattern(biomarkers or [], profile=profile, locale=locale),
            _iron_deficiency_anemia_pattern(
                biomarkers or [], profile=profile, locale=locale, symptoms=normalized_symptoms
            ),
            _cardiovascular_risk_pattern(
                biomarkers or [], profile=profile, locale=locale, symptoms=normalized_symptoms
            ),
            _metabolic_risk_pattern(
                biomarkers or [], profile=profile, locale=locale, symptoms=normalized_symptoms
            ),
            _thyroid_dysfunction_pattern(
                biomarkers or [], profile=profile, locale=locale, symptoms=normalized_symptoms
            ),
            _liver_stress_pattern(
                biomarkers or [], profile=profile, locale=locale, symptoms=normalized_symptoms
            ),
            _inflammation_pattern(
                biomarkers or [], profile=profile, locale=locale, symptoms=normalized_symptoms
            ),
            _micronutrient_deficiency_cluster_pattern(biomarkers or [], profile=profile, locale=locale),
        ]
        if item
    ]
    specific_patterns.sort(
        key=lambda item: (_PATTERN_PRIORITY_RANK.get(item.get("priority"), 1), -float(item.get("confidence") or 0))
    )

    if specific_patterns:
        patterns = specific_patterns[:5]
    else:
        generic = _generic_pattern(biomarkers or [], profile=profile, locale=locale)
        patterns = [generic] if generic else []

    return _attach_symptom_links(patterns, normalized_symptoms)


def build_interpreted_report(
    *,
    biomarkers: List[Dict[str, Any]],
    knowledge_report: Dict[str, Any] | None = None,
    health_states: Dict[str, Any] | None = None,
    explainability: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
    health_context: Dict[str, Any] | None = None,
    profile: Dict[str, Any] | None = None,
    symptoms: List[str] | None = None,
    locale: str = "en",
) -> Dict[str, Any]:
    locale = _locale(locale)
    profile = profile if isinstance(profile, dict) else {}
    patterns = detect_patterns(biomarkers or [], profile=profile, symptoms=symptoms, locale=locale)

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
        "health_domains": [_localize_health_state(item, locale) for item in useful_states[:6]],
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
