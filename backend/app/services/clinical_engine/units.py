"""Единый модуль нормализации и конверсии единиц измерения.

Раньше unit-логика жила в трёх местах:
  - lab_analysis_pipeline._normalize_unit()  — простая замена при normalize_biomarkers
  - knowledge/evaluator._normalize_unit() + _UNIT_SYNONYMS + _CONVERSION_FACTORS — полная
    конверсия при сравнении с правилами KB
  - biomarker_reference.resolve_status_bounds() — fallback-поиск по нормализованному юниту

Теперь все три импортируют отсюда.

ПРАВИЛА:
  - _UNIT_SYNONYMS содержит ТОЛЬКО размерно-идентичные записи (10^9 cells/L == 10^9/L).
  - mEq/L НЕ входит в синонимы (= mmol/L только для моновалентных ионов); он
    обрабатывается per-marker в _CONVERSION_FACTORS (Ca/Mg — двухвалентные, фактор 0.5).
  - Процент (%) НИКОГДА не конвертируется в абсолютный счёт — это разные величины.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple


# ---------------------------------------------------------------------------
# 1. Транслитерация кириллицы
# ---------------------------------------------------------------------------

_UNIT_TRANSLITERATION = str.maketrans(
    {
        "а": "a", "б": "b", "в": "v", "г": "g", "ґ": "g", "д": "d", "е": "e",
        "є": "e", "ж": "zh", "з": "z", "и": "i", "і": "i", "ї": "i", "й": "y",
        "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
        "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch",
        "ш": "sh", "щ": "sch", "ы": "y", "э": "e", "ю": "yu", "я": "ya",
        "ь": "", "ъ": "",
    }
)


# ---------------------------------------------------------------------------
# 2. Синонимы (ТОЛЬКО размерно-тождественные)
# ---------------------------------------------------------------------------

_UNIT_SYNONYMS: Dict[str, str] = {
    "10^9cells/l": "10^9/l",
    "x10^3/ul": "10^9/l",
    "10^3/ul": "10^9/l",
    "10^12cells/l": "10^12/l",
    "x10^6/ul": "10^12/l",
    "10^6/ul": "10^12/l",
    "mm/god": "mm/h",
    "mm/hr": "mm/h",
    "mkmol/l": "umol/l",
    "mkg/l": "ug/l",
    "mkg/dl": "ug/dl",
    "mked/ml": "uiu/ml",
    "od/l": "u/l",
    "ed/l": "u/l",
    "miu/l": "uiu/ml",
    "mu/l": "uiu/ml",
}


# ---------------------------------------------------------------------------
# 3. normalize_unit — каноническая форма unit-строки
# ---------------------------------------------------------------------------

def normalize_unit(value: str | None) -> str:
    """Каноническая нижнерегистровая форма единицы.

    Применяет кириллическую транслитерацию, схлопывает пробелы, μ/µ → u,
    затем ищет в синонимах.  Результат стабилен при повторном вызове:
    ``normalize_unit(normalize_unit(x)) == normalize_unit(x)``.
    """
    raw = str(value or "").strip().lower().replace("μ", "u").replace("µ", "u")
    raw = raw.translate(_UNIT_TRANSLITERATION).replace(" ", "")
    return _UNIT_SYNONYMS.get(raw, raw)


def unit_matches(actual: str | None, expected: str | None) -> bool:
    """Являются ли два юнита одной и той же единицей после нормализации?"""
    if not expected:
        return True
    if not actual:
        return False
    return normalize_unit(actual) == normalize_unit(expected)


# ---------------------------------------------------------------------------
# 4. Pipeline-level display normalization (для ответа пользователю)
# ---------------------------------------------------------------------------

_DISPLAY_ALIASES: Dict[str, str] = {
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


def display_unit(raw_unit: str) -> str:
    """Human-friendly форма юнита для API-ответа.

    В отличие от normalize_unit() (который даёт нижнерегистровый ключ для
    сравнений), это — отображаемая форма с правильным регистром.
    """
    unit = str(raw_unit or "").strip()
    normalized = unit.lower().replace("μ", "u").replace("µ", "u")
    return _DISPLAY_ALIASES.get(normalized, unit)


# ---------------------------------------------------------------------------
# 5. Конверсия значений между единицами (per-marker)
# ---------------------------------------------------------------------------

# (marker, from_unit, to_unit) → multiplier.  Применяется ПОСЛЕ normalize_unit().
# Молярные факторы — из молекулярной массы каждого аналита, поэтому строго
# per-marker.  Обратное направление выводится автоматически в convert_value().
# Процент (%) НИКОГДА не появляется здесь.
_CONVERSION_FACTORS: Dict[Tuple[str, str, str], float] = {
    ("hemoglobin", "g/dl", "g/l"): 10.0,
    ("mchc", "g/dl", "g/l"): 10.0,
    ("albumin", "g/dl", "g/l"): 10.0,
    ("total_protein", "g/dl", "g/l"): 10.0,
    ("calcium", "mg/dl", "mmol/l"): 0.2495,
    ("calcium", "meq/l", "mmol/l"): 0.5,
    ("magnesium", "mg/dl", "mmol/l"): 0.4114,
    ("magnesium", "meq/l", "mmol/l"): 0.5,
    ("sodium", "meq/l", "mmol/l"): 1.0,
    ("potassium", "meq/l", "mmol/l"): 1.0,
    ("phosphorus", "mg/dl", "mmol/l"): 0.3229,
    ("creatinine", "mg/dl", "umol/l"): 88.4,
    ("uric_acid", "mg/dl", "umol/l"): 59.48,
    ("bun", "mg/dl", "mmol/l"): 0.357,
    ("total_cholesterol", "mg/dl", "mmol/l"): 0.02586,
    ("non_hdl", "mg/dl", "mmol/l"): 0.02586,
    ("vitamin_b12", "pg/ml", "pmol/l"): 0.7378,
    ("folate", "ng/ml", "nmol/l"): 2.266,
    ("free_t4", "ng/dl", "pmol/l"): 12.87,
    ("free_t3", "pg/ml", "pmol/l"): 1.536,
    ("iron", "ug/dl", "umol/l"): 0.1791,
    ("bilirubin_total", "mg/dl", "umol/l"): 17.1,
    ("bilirubin_direct", "mg/dl", "umol/l"): 17.1,
    ("testosterone", "ng/dl", "nmol/l"): 0.03467,
    ("estradiol", "pg/ml", "pmol/l"): 3.671,
    ("cortisol", "ug/dl", "nmol/l"): 27.59,
    ("homocysteine", "mg/l", "umol/l"): 7.397,
    ("insulin", "uiu/ml", "pmol/l"): 6.945,
    # Dimensional equivalence: D-dimer μg/L ↔ ng/mL (1:1 numeric ratio)
    # NOTE: FEU/DDU distinction exists clinically but is NOT tracked in data model
    # Both assay types use same unit conventions; numeric factor is 1.0
    ("d_dimer", "ug/l", "ng/ml"): 1.0,
    ("d_dimer", "ng/ml", "ug/l"): 1.0,
}

# Маркеры с inline-специфичными конверсиями (не табличными)
_INLINE_CONVERSIONS: Dict[str, Dict[Tuple[str, str], float]] = {
    "glucose": {("mmol/l", "mg/dl"): 18.0, ("mg/dl", "mmol/l"): 1 / 18.0},
    "ldl": {("mmol/l", "mg/dl"): 38.67, ("mg/dl", "mmol/l"): 1 / 38.67},
    "hdl": {("mmol/l", "mg/dl"): 38.67, ("mg/dl", "mmol/l"): 1 / 38.67},
    "triglycerides": {("mmol/l", "mg/dl"): 88.57, ("mg/dl", "mmol/l"): 1 / 88.57},
    "vitamin_d": {("nmol/l", "ng/ml"): 1 / 2.5, ("ng/ml", "nmol/l"): 2.5},
    "ferritin": {("ng/ml", "ug/l"): 1.0, ("ug/l", "ng/ml"): 1.0},
}


def convert_value(marker_key: str, value: float, from_unit: str, to_unit: str) -> float | None:
    """Конвертировать значение маркера из одной единицы в другую.

    Возвращает None, если конверсия невозможна (неизвестная пара).
    Процент → абсолютный счёт: всегда None (это разные величины).
    """
    marker = str(marker_key).strip().lower()
    src = normalize_unit(from_unit)
    dst = normalize_unit(to_unit)
    if src == dst:
        return value

    # Табличный фактор
    factor = _CONVERSION_FACTORS.get((marker, src, dst))
    if factor is not None:
        return value * factor
    inverse = _CONVERSION_FACTORS.get((marker, dst, src))
    if inverse:
        return value / inverse

    # Inline-специфичные конверсии
    inline = _INLINE_CONVERSIONS.get(marker)
    if inline:
        factor = inline.get((src, dst))
        if factor is not None:
            return value * factor

    return None


# ---------------------------------------------------------------------------
# 6. Утилиты для проверки типа единицы
# ---------------------------------------------------------------------------

def is_percentage_unit(unit: str) -> bool:
    """Является ли единица процентом?"""
    return str(unit or "").strip().replace(" ", "") in {"%", "％", "pct", "percent"}
