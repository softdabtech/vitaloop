from __future__ import annotations

from typing import Any, Optional


_CANONICAL_MAP = {
    "vitamin d": "vitamin_d_25_oh",
    "vitamin d (25-oh)": "vitamin_d_25_oh",
    "25-oh vitamin d": "vitamin_d_25_oh",
    "25-oh-vitamin d": "vitamin_d_25_oh",
    "25 hydroxy vitamin d": "vitamin_d_25_oh",
    "25-hydroxy vitamin d": "vitamin_d_25_oh",
    "25-гідроксивітамін d": "vitamin_d_25_oh",
    "25-гидроксивитамин d": "vitamin_d_25_oh",
    "вітамін d": "vitamin_d_25_oh",
    "витамин d": "vitamin_d_25_oh",
    "ferritin": "ferritin",
    "феритин": "ferritin",
    "ферритин": "ferritin",
    "iron": "iron",
    "serum iron": "iron",
    "сироваткове залізо": "iron",
    "залізо сироваткове": "iron",
    "сывороточное железо": "iron",
    "железо сывороточное": "iron",
    "transferrin": "transferrin",
    "трансферин": "transferrin",
    "трансферрин": "transferrin",
    "transferrin saturation": "transferrin_saturation",
    "transferrin saturation %": "transferrin_saturation",
    "% transferrin saturation": "transferrin_saturation",
    "tsat": "transferrin_saturation",
    "насичення трансферину": "transferrin_saturation",
    "відсоток насичення трансферину": "transferrin_saturation",
    "коефіцієнт насичення трансферину": "transferrin_saturation",
    "насыщение трансферрина": "transferrin_saturation",
    "процент насыщения трансферрина": "transferrin_saturation",
    "hemoglobin": "hemoglobin",
    "hemoglobin concentration": "hemoglobin",
    "hgb": "hemoglobin",
    "hb": "hemoglobin",
    "гемоглобін": "hemoglobin",
    "гемоглобин": "hemoglobin",
    "hematocrit": "hematocrit",
    "hct": "hematocrit",
    "гематокрит": "hematocrit",
    "erythrocytes": "rbc",
    "red blood cells": "rbc",
    "rbc": "rbc",
    "еритроцити": "rbc",
    "эритроциты": "rbc",
    "leukocytes": "wbc",
    "white blood cells": "wbc",
    "wbc": "wbc",
    "лейкоцити": "wbc",
    "лейкоциты": "wbc",
    "platelets": "platelets",
    "plt": "platelets",
    "тромбоцити": "platelets",
    "тромбоциты": "platelets",
    "mcv": "mcv",
    "mean corpuscular volume": "mcv",
    "mch": "mch",
    "mean corpuscular hemoglobin": "mch",
    "mchc": "mchc",
    "mean corpuscular hemoglobin concentration": "mchc",
    "rdw": "rdw",
    "mean reticulocyte volume": "mean_reticulocyte_volume",
    "mrv": "mean_reticulocyte_volume",
    "mean spherical cell volume": "mean_spherical_cell_volume",
    "mscv": "mean_spherical_cell_volume",
    "reticulocytes": "reticulocytes",
    "ретикулоцити": "reticulocytes",
    "ретикулоциты": "reticulocytes",
    "reticulocytes (g/l)": "reticulocytes_absolute",
    "reticulocytes (г/л)": "reticulocytes_absolute",
    "ретикулоцити (г/л)": "reticulocytes_absolute",
    "ретикулоциты (г/л)": "reticulocytes_absolute",
    "immature reticulocytes": "immature_reticulocytes",
    "незрілі ретикулоцити": "immature_reticulocytes",
    "незрелые ретикулоциты": "immature_reticulocytes",
    "mature reticulocytes": "mature_reticulocytes",
    "зрілі ретикулоцити": "mature_reticulocytes",
    "зрелые ретикулоциты": "mature_reticulocytes",
    "reticulocyte distribution width": "reticulocyte_distribution_width",
    "glucose": "glucose",
    "glucose fasting": "glucose",
    "fasting glucose": "glucose",
    "глюкоза": "glucose",
    "глюкоза натще": "glucose",
    "hba1c": "hba1c",
    "hb a1c": "hba1c",
    "hemoglobin a1c": "hba1c",
    "глікований гемоглобін": "hba1c",
    "гликированный гемоглобин": "hba1c",
    "tsh": "tsh",
    "thyroid stimulating hormone": "tsh",
    "тиреотропний гормон": "tsh",
    "тиреотропный гормон": "tsh",
    "free t3": "free_t3",
    "ft3": "free_t3",
    "free t4": "free_t4",
    "ft4": "free_t4",
    "cortisol": "cortisol",
    "magnesium": "magnesium",
    "ldl": "ldl",
    "ldl cholesterol": "ldl",
    "low-density lipoprotein": "ldl",
    "hdl": "hdl",
    "hdl cholesterol": "hdl",
    "high-density lipoprotein": "hdl",
    "triglycerides": "triglycerides",
    "triglyceride": "triglycerides",
    "total cholesterol": "total_cholesterol",
    "cholesterol total": "total_cholesterol",
    "холестерин загальний": "total_cholesterol",
    "общий холестерин": "total_cholesterol",
    "apob": "apob",
    "apo b": "apob",
    "apolipoprotein b": "apob",
    "alt": "alt",
    "alanine aminotransferase": "alt",
    "алт": "alt",
    "аланінамінотрансфераза": "alt",
    "аланинаминотрансфераза": "alt",
    "ast": "ast",
    "aspartate aminotransferase": "ast",
    "аст": "ast",
    "аспартатамінотрансфераза": "ast",
    "аспартатаминотрансфераза": "ast",
    "ggt": "ggt",
    "gamma-glutamyl transferase": "ggt",
    "crp": "crp",
    "c-reactive protein": "crp",
    "с-реактивний білок": "crp",
    "с-реактивный белок": "crp",
    "срб": "crp",
    "insulin": "insulin",
    "fasting insulin": "insulin",
    "bilirubin total": "bilirubin_total",
    "total bilirubin": "bilirubin_total",
    "білірубін загальний": "bilirubin_total",
    "билирубин общий": "bilirubin_total",
    "білірубін прямий": "bilirubin_direct",
    "билирубин прямой": "bilirubin_direct",
    "direct bilirubin": "bilirubin_direct",
    "білірубін непрямий": "bilirubin_indirect",
    "билирубин непрямой": "bilirubin_indirect",
    "indirect bilirubin": "bilirubin_indirect",
    "creatinine": "creatinine",
    "креатинін": "creatinine",
    "креатинин": "creatinine",
    "egfr": "egfr",
    "e-gfr": "egfr",
    "urea": "urea",
    "сечовина": "urea",
    "мочевина": "urea",
    "vitamin b12": "vitamin_b12",
    "b12": "vitamin_b12",
    "вітамін b12": "vitamin_b12",
    "витамин b12": "vitamin_b12",
    "folate": "folate",
    "folic acid": "folate",
    "фолат": "folate",
    "фолієва кислота": "folate",
    "фолиевая кислота": "folate",
}


def to_canonical_name(display_name: str) -> str:
    key = (display_name or "").strip().lower()
    if key in _CANONICAL_MAP:
        return _CANONICAL_MAP[key]
    normalized = key.replace("%", "pct").replace("/", "_")
    normalized = "_".join(part for part in normalized.replace("-", " ").split() if part)
    return normalized or "unknown_biomarker"


def infer_category(name: str) -> Optional[str]:
    lowered = to_canonical_name(name)
    if lowered in {
        "vitamin_d_25_oh",
        "vitamin_b12",
        "folate",
        "ferritin",
        "iron",
        "transferrin",
        "transferrin_saturation",
        "magnesium",
    }:
        return "nutrients"
    if lowered in {"glucose", "hba1c", "insulin", "total_cholesterol", "ldl", "hdl", "triglycerides", "apob"}:
        return "metabolic"
    if lowered in {"tsh", "free_t3", "free_t4", "cortisol"}:
        return "hormonal"
    if lowered in {
        "hemoglobin",
        "hematocrit",
        "rbc",
        "wbc",
        "platelets",
        "mcv",
        "mch",
        "mchc",
        "rdw",
        "reticulocytes",
        "reticulocytes_absolute",
        "immature_reticulocytes",
        "mature_reticulocytes",
        "mean_reticulocyte_volume",
        "mean_spherical_cell_volume",
        "reticulocyte_distribution_width",
    }:
        return "hematology"
    if lowered in {"alt", "ast", "ggt", "bilirubin_total", "bilirubin_direct", "bilirubin_indirect"}:
        return "liver"
    if lowered in {"creatinine", "egfr", "urea"}:
        return "kidney"
    if lowered in {"crp"}:
        return "inflammation"
    return None


# --- Stage 2A: document-metadata exclusion (F04) -----------------------------
#
# Document metadata (dates, identifiers, contact/administrative fields) must never
# be persisted as a biomarker candidate. This denylist + narrow structural check is
# intentionally the ONLY new logic added for Stage 2A — see
# docs/audit/VITALOOP_STAGE2_IMPLEMENTATION_PLAN.md, Stage 2A. It must never reject
# an unrecognized-but-plausible marker name; those continue to fall through to
# to_canonical_name()'s existing slugify path unchanged.

_METADATA_FIELD_TERMS = {
    # Dates
    "report date", "reported date", "date reported", "collection date",
    "collected date", "date collected", "order date", "ordered date",
    "date of birth", "dob", "birth date",
    # Identifiers
    "patient id", "patient name", "specimen id", "specimen number", "sample id",
    "sample number", "accession number", "accession no", "lab number", "lab no",
    "reference number", "requisition number", "mrn", "medical record number",
    "page", "page number",
    # Contact / administrative
    "phone", "phone number", "fax", "address", "provider", "ordering provider",
    "physician", "doctor", "referring physician",
    # UA / RU equivalents (mirrors the bilingual alias convention used above)
    "дата звіту", "дата взяття", "дата забору", "дата народження",
    "ід пацієнта", "номер зразка", "номер направлення", "лікар", "адреса", "телефон",
    "дата отчета", "дата взятия", "дата рождения",
    "ид пациента", "номер образца", "номер направления", "врач", "адрес",
}


def is_metadata_field(
    raw_name: str,
    value: Any = None,
    ref_low: Any = None,
    ref_high: Any = None,
) -> bool:
    """Return True when a candidate extraction row looks like document metadata
    (a date, identifier, or contact/administrative field) rather than an actual
    lab analyte result.

    Two layers, both conservative by design:
    1. Denylist match (exact or substring) against known metadata-field labels.
    2. A narrow structural check: a year-like value (1900-2100) combined with a
       reference range shaped like a calendar bound (a day-of-month or
       month-of-year span) — catches denylist misses without needing an
       exhaustive string list, and without touching genuine physiological
       plausibility logic (which stays in clinical_data_integrity.py, unchanged).
    """
    name = (raw_name or "").strip().lower()
    if name:
        if name in _METADATA_FIELD_TERMS:
            return True
        if any(term in name for term in _METADATA_FIELD_TERMS):
            return True

    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        numeric_value = None

    if numeric_value is not None and 1900 <= numeric_value <= 2100:
        try:
            low = float(ref_low) if ref_low not in (None, "") else None
            high = float(ref_high) if ref_high not in (None, "") else None
        except (TypeError, ValueError):
            low = high = None
        if low is not None and high is not None:
            calendar_like_span = (1 <= low <= 31 and 1 <= high <= 31) or (
                1 <= low <= 12 and 1 <= high <= 12
            )
            if calendar_like_span:
                return True

    return False
