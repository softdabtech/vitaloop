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
) -> Dict[str, Any]:
    """Shared assembly for every pattern in PATTERN_COPY.

    Same output shape as _reticulocyte_pattern — this is what "broad clinical
    pattern engine" (2026-09-12 audit item #3) factors out so each new
    pattern detector only needs to decide WHICH markers triggered it, not
    reinvent the response shape, confidence adjustment, or missing-context
    logic each time.
    """
    copy = PATTERN_COPY[pattern_key][_locale(locale)]
    missing_context = list(extra_missing_context or [])
    missing_profile = _missing_profile_context(profile)
    if missing_profile:
        missing_context.append(_t(locale, "profile_gap"))

    age = _age(profile)
    if age is not None and age < 18:
        missing_context.append(_t(locale, "pediatric_gap"))

    confidence = base_confidence + (0.06 if normal_context else 0.0)
    if missing_profile:
        confidence -= 0.08
    if age is not None and age < 18:
        confidence -= 0.03
    confidence = max(0.35, min(confidence, 0.85))

    return {
        "key": pattern_key,
        "domain": domain,
        "status": "context_required" if priority != "high" else "review_recommended",
        "priority": priority,
        "confidence": round(confidence, 2),
        "title": copy["title"],
        "summary": copy["summary"],
        "what_this_means": [copy["meaning"]],
        "what_this_does_not_confirm": [copy["not_confirm"]],
        "triggered_biomarkers": [_format_marker(item) for item in triggered],
        "normal_context": [_format_marker(item) for item in normal_context[:6]],
        "missing_context": missing_context,
        "nutrition_context": None,
        "next_best_steps": [
            {"key": "complete_profile", "timeframe": "today", "text": _t(locale, "next_profile"), "priority": "high"},
            {"key": "review_context", "timeframe": "next", "text": _t(locale, "next_review"), "priority": "high" if priority == "high" else "medium"},
        ],
        "doctor_questions": copy["doctor_q"],
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


def _iron_deficiency_anemia_pattern(
    biomarkers: List[Dict[str, Any]], *, profile: Dict[str, Any] | None, locale: str
) -> Dict[str, Any] | None:
    ferritin = _find_markers(biomarkers, ["ferritin"])
    hemoglobin = _find_markers(biomarkers, ["hemoglobin", "hgb"])
    hematocrit = _find_markers(biomarkers, ["hematocrit", "hct"])
    mcv = _find_markers(biomarkers, ["mcv", "mean corpuscular volume"])

    low_ferritin = [item for item in ferritin if _is_low(item)]
    low_red_cell = [item for item in [*hemoglobin, *hematocrit] if _is_low(item)]
    if not low_ferritin or not low_red_cell:
        return None

    normal_context = [item for item in mcv if _is_in_range(item)]
    return _build_pattern(
        pattern_key="iron_deficiency_anemia",
        domain="iron_status",
        priority="medium",
        base_confidence=0.68,
        triggered=[*low_ferritin, *low_red_cell],
        normal_context=normal_context,
        profile=profile,
        locale=locale,
        retest_marker="Ferritin, hemoglobin/hematocrit, transferrin saturation",
        matched_rule_key="pattern_iron_deficiency_anemia",
        extra_missing_context=[
            "Transferrin saturation + serum iron",
            "CRP or inflammation context (ferritin rises with inflammation)",
            "Recent or ongoing blood loss history",
        ],
    )


def _metabolic_risk_pattern(
    biomarkers: List[Dict[str, Any]], *, profile: Dict[str, Any] | None, locale: str
) -> Dict[str, Any] | None:
    glucose = _find_markers(biomarkers, ["glucose"])
    hba1c = _find_markers(biomarkers, ["hba1c", "glycated hemoglobin", "a1c"])
    insulin = _find_markers(biomarkers, ["insulin"])

    high_glucose = [item for item in glucose if _is_high(item)]
    high_hba1c = [item for item in hba1c if _is_high(item)]
    triggered = [*high_glucose, *high_hba1c]
    if not triggered:
        return None

    normal_context = [item for item in insulin if _is_in_range(item)]
    return _build_pattern(
        pattern_key="metabolic_risk",
        domain="metabolic_health",
        priority="medium",
        base_confidence=0.65,
        triggered=triggered,
        normal_context=normal_context,
        profile=profile,
        locale=locale,
        retest_marker="Fasting glucose, HbA1c",
        matched_rule_key="pattern_metabolic_risk",
        extra_missing_context=["Fasting insulin or HOMA-IR", "Weight trend and activity pattern"],
    )


def _cardiovascular_risk_pattern(
    biomarkers: List[Dict[str, Any]], *, profile: Dict[str, Any] | None, locale: str
) -> Dict[str, Any] | None:
    ldl = _find_markers(biomarkers, ["ldl"])
    hdl = _find_markers(biomarkers, ["hdl"])
    triglycerides = _find_markers(biomarkers, ["triglyceride"])
    total_cholesterol = _find_markers(biomarkers, ["total cholesterol", "cholesterol total"])

    high_ldl = [item for item in ldl if _is_high(item)]
    low_hdl = [item for item in hdl if _is_low(item)]
    high_trig = [item for item in triglycerides if _is_high(item)]
    high_chol = [item for item in total_cholesterol if _is_high(item)]
    triggered = [*high_ldl, *low_hdl, *high_trig, *high_chol]
    if not triggered:
        return None

    priority = "high" if (high_ldl and low_hdl) or (high_ldl and high_trig) else "medium"
    return _build_pattern(
        pattern_key="cardiovascular_risk",
        domain="cardiovascular",
        priority=priority,
        base_confidence=0.68 if priority == "high" else 0.6,
        triggered=triggered,
        normal_context=[],
        profile=profile,
        locale=locale,
        retest_marker="Lipid panel (LDL, HDL, triglycerides)",
        matched_rule_key="pattern_cardiovascular_risk",
        extra_missing_context=["Blood pressure, family history, smoking status", "ApoB or Lp(a) if available"],
    )


def _thyroid_dysfunction_pattern(
    biomarkers: List[Dict[str, Any]], *, profile: Dict[str, Any] | None, locale: str
) -> Dict[str, Any] | None:
    tsh = _find_markers(biomarkers, ["tsh", "thyroid stimulating hormone"])
    free_t3 = _find_markers(biomarkers, ["free t3", "ft3"])
    free_t4 = _find_markers(biomarkers, ["free t4", "ft4"])

    abnormal_tsh = [item for item in tsh if _is_abnormal(item)]
    if not abnormal_tsh:
        return None

    abnormal_t3_t4 = [item for item in [*free_t3, *free_t4] if _is_abnormal(item)]
    normal_context = [item for item in [*free_t3, *free_t4] if _is_in_range(item)]
    return _build_pattern(
        pattern_key="thyroid_dysfunction",
        domain="thyroid",
        priority="medium",
        base_confidence=0.62,
        triggered=[*abnormal_tsh, *abnormal_t3_t4],
        normal_context=normal_context,
        profile=profile,
        locale=locale,
        retest_marker="TSH, free T4, free T3",
        matched_rule_key="pattern_thyroid_dysfunction",
        extra_missing_context=["Thyroid antibodies (anti-TPO, anti-Tg)", "Medication history affecting thyroid results"],
    )


def _liver_stress_pattern(
    biomarkers: List[Dict[str, Any]], *, profile: Dict[str, Any] | None, locale: str
) -> Dict[str, Any] | None:
    alt = _find_markers(biomarkers, ["alt", "alanine aminotransferase"])
    ast = _find_markers(biomarkers, ["ast", "aspartate aminotransferase"])
    ggt = _find_markers(biomarkers, ["ggt", "gamma-glutamyl"])
    bilirubin = _find_markers(biomarkers, ["bilirubin"])

    high_alt_ast = [item for item in [*alt, *ast] if _is_high(item)]
    if not high_alt_ast:
        return None

    high_ggt_bili = [item for item in [*ggt, *bilirubin] if _is_high(item)]
    return _build_pattern(
        pattern_key="liver_stress",
        domain="liver",
        priority="medium",
        base_confidence=0.63,
        triggered=[*high_alt_ast, *high_ggt_bili],
        normal_context=[],
        profile=profile,
        locale=locale,
        retest_marker="ALT, AST, GGT, bilirubin",
        matched_rule_key="pattern_liver_stress",
        extra_missing_context=["Alcohol intake, medications, and supplements", "Recent illness or significant weight change"],
    )


def _inflammation_pattern(
    biomarkers: List[Dict[str, Any]], *, profile: Dict[str, Any] | None, locale: str
) -> Dict[str, Any] | None:
    crp = _find_markers(biomarkers, ["crp", "c-reactive protein", "c reactive protein"])
    esr = _find_markers(biomarkers, ["esr", "sed rate", "erythrocyte sedimentation"])

    triggered = [item for item in [*crp, *esr] if _is_high(item)]
    if not triggered:
        return None

    return _build_pattern(
        pattern_key="inflammation",
        domain="inflammation",
        priority="medium",
        base_confidence=0.58,
        triggered=triggered,
        normal_context=[],
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


def _electrolyte_kidney_safety_pattern(
    biomarkers: List[Dict[str, Any]], *, profile: Dict[str, Any] | None, locale: str
) -> Dict[str, Any] | None:
    potassium = _find_markers(biomarkers, ["potassium"])
    sodium = _find_markers(biomarkers, ["sodium"])
    creatinine = _find_markers(biomarkers, ["creatinine"])
    egfr = _find_markers(biomarkers, ["egfr", "gfr"])

    abnormal_electrolyte = [item for item in [*potassium, *sodium] if _is_abnormal(item)]
    abnormal_kidney = [item for item in [*creatinine, *egfr] if _is_abnormal(item)]
    if not abnormal_electrolyte or not abnormal_kidney:
        return None

    return _build_pattern(
        pattern_key="electrolyte_kidney_safety",
        domain="kidney",
        priority="high",
        base_confidence=0.7,
        triggered=[*abnormal_electrolyte, *abnormal_kidney],
        normal_context=[],
        profile=profile,
        locale=locale,
        retest_marker="Potassium, sodium, creatinine, eGFR",
        matched_rule_key="pattern_electrolyte_kidney_safety",
        extra_missing_context=["Current medications affecting electrolytes or kidney function", "Hydration status"],
    )


_PATTERN_PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


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

    # Broad clinical pattern engine (2026-09-12 audit item #3): run every
    # specific detector and keep every one that matched, ranked by priority
    # then confidence — a panel can legitimately show more than one pattern
    # at once (e.g. iron-deficiency anemia AND a lipid pattern together).
    # Only fall back to the generic "some markers are abnormal" message when
    # NOT ONE specific detector matched anything.
    specific_patterns = [
        item
        for item in [
            _electrolyte_kidney_safety_pattern(biomarkers or [], profile=profile, locale=locale),
            _reticulocyte_pattern(biomarkers or [], profile=profile, locale=locale),
            _iron_deficiency_anemia_pattern(biomarkers or [], profile=profile, locale=locale),
            _cardiovascular_risk_pattern(biomarkers or [], profile=profile, locale=locale),
            _metabolic_risk_pattern(biomarkers or [], profile=profile, locale=locale),
            _thyroid_dysfunction_pattern(biomarkers or [], profile=profile, locale=locale),
            _liver_stress_pattern(biomarkers or [], profile=profile, locale=locale),
            _inflammation_pattern(biomarkers or [], profile=profile, locale=locale),
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
