"""Нормализация имён и значений биомаркеров.

Делегирует каноническое имя в biomarker_mapping (единственный владелец
_CANONICAL_MAP и квалификаторной логики), а unit-нормализацию — в units.py.
Сюда вынесен normalize_biomarkers(), который раньше жил в pipeline.

Функции, экспортируемые наружу:
  - to_canonical_name (re-export из biomarker_mapping)
  - infer_category (re-export)
  - is_metadata_field (re-export)
  - normalize_biomarkers — чистая детерминированная нормализация списка биомаркеров
"""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from app.services.lab_normalization.biomarker_mapping import (
    infer_category,
    is_metadata_field,
    to_canonical_name,
)
from app.services.clinical_engine.units import display_unit, normalize_unit
from app.services.clinical_engine.reference_ranges import reference_range_fallback
from app.services.clinical_engine.biomarker_translator import (
    translate_biomarker_name,
    is_localized_name,
)


# ---------------------------------------------------------------------------
# Status constants
# ---------------------------------------------------------------------------

# ⚠️  NEW: UNEVALUATED status for markers with unverified reference ranges
# This prevents clinical status classification when no validated reference exists.
STATUS_PRIORITY = {
    "DEFICIENT": 0,
    "ELEVATED": 1,
    "BORDERLINE": 2,
    "UNKNOWN": 3,
    "UNEVALUATED": 3,  # Same priority as UNKNOWN, but tracks different reason
    "OPTIMAL": 4,
}

_STATUS_ALIASES = {
    "NORMAL": "OPTIMAL",
    "IN_RANGE": "OPTIMAL",
    "IN RANGE": "OPTIMAL",
    "LOW": "DEFICIENT",
    "HIGH": "ELEVATED",
    "CRITICAL": "ELEVATED",
}

_NAME_ALIASES = {
    "ферритин": "ferritin",
    "феритин": "ferritin",
    "vit d": "vitamin d",
    "25 oh vitamin d": "vitamin d",
}

_NAME_CATEGORY_KEYWORDS = {
    "blood_count": [
        "reticulocyte", "erythrocyte", "hemoglobin", "hematocrit",
        "spherical cell", "cell volume", "mcv", "mch", "rdw", "rbc", "wbc", "platelet",
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


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_reference_range(raw: Any) -> tuple[float | None, float | None]:
    if raw in (None, ""):
        return None, None
    values = re.findall(r"(?<!\d)[-+]?\d+(?:[.,]\d+)?", str(raw))
    if len(values) < 2:
        return None, None
    return float(values[0].replace(",", ".")), float(values[1].replace(",", "."))


def _normalize_name(raw_name: str, name_aliases: Optional[Dict[str, str]] = None) -> tuple[str, str]:
    display_name = re.sub(r"\s+", " ", str(raw_name or "").strip())
    alias_key = display_name.lower()
    aliases = {
        **_NAME_ALIASES,
        **{str(k).strip().lower(): str(v).strip() for k, v in (name_aliases or {}).items() if str(k).strip() and str(v).strip()},
    }
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


def _normalize_value_unit(name: str, value: float, unit: str) -> tuple[float, str]:
    """Display-level unit normalization + vitamin D nmol/L → ng/mL conversion."""
    canonical = to_canonical_name(name)
    normalized_unit = display_unit(unit)
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


def _status_for_value(
    value: float,
    ref_low: float | None,
    ref_high: float | None,
    raw_status: Any = None,
    *,
    has_reference: bool = True,
    is_verified_fallback: bool = True,
) -> str:
    """Compute status for a biomarker value.

    Args:
        value: Numeric biomarker value
        ref_low, ref_high: Reference bounds (or None)
        raw_status: Raw status from source
        has_reference: Whether ANY reference range exists (lab or fallback)
        is_verified_fallback: Whether fallback range is from verified source
            (only relevant when has_reference=True AND source is fallback)

    Returns:
        Status string: DEFICIENT, ELEVATED, OPTIMAL, BORDERLINE, UNKNOWN, UNEVALUATED

    ⚠️  When has_reference=True but is_verified_fallback=False:
        Returns UNEVALUATED (not OPTIMAL) to signal unverified reference range.
        This prevents clinical classification without proper provenance.
    """
    # If using an unverified fallback range, return UNEVALUATED regardless of value
    if has_reference and not is_verified_fallback:
        return "UNEVALUATED"

    # Normal status computation when reference is lab-provided or verified
    if ref_low is not None and value < ref_low:
        return "DEFICIENT"
    if ref_high is not None and value > ref_high:
        return "ELEVATED"
    if ref_low is not None or ref_high is not None:
        return "OPTIMAL"

    # No reference range at all
    if not has_reference:
        # Try to map from raw status if provided
        status = str(raw_status or "").strip().upper()
        mapped = _STATUS_ALIASES.get(status)
        if mapped:
            return mapped
        if status in STATUS_PRIORITY:
            return status
        return "UNKNOWN"

    # Legacy path: has_reference=True but both bounds are None
    status = str(raw_status or "").strip().upper()
    return _STATUS_ALIASES.get(status, status if status in STATUS_PRIORITY else "BORDERLINE")


def _iso_or_none(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def normalize_biomarkers(
    raw_biomarkers: Iterable[Dict[str, Any]],
    *,
    name_aliases: Optional[Dict[str, str]] = None,
    sex: Optional[str] = None,
    age: Optional[int] = None,
    weight: Optional[float] = None,
    height: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """Нормализовать список сырых биомаркеров в каноническую форму.

    Чистая детерминированная функция: нет I/O, нет Supabase, нет LLM.
    Возвращает список словарей с полями: name, canonical_name, value, unit,
    ref_low, ref_high, reference_source, status, category, ...

    Новое: статус UNKNOWN вместо ложного BORDERLINE для маркеров без референса.

    Args:
        raw_biomarkers: Iterable of biomarker dicts
        name_aliases: Custom name mappings
        sex: User sex ('male', 'female') — affects reference ranges
        age: User age in years — affects reference ranges
        weight: User weight in kg — for BMI/context
        height: User height in cm — for BMI/context
    """
    normalized: List[Dict[str, Any]] = []
    seen: set[str] = set()

    for item in raw_biomarkers or []:
        if not isinstance(item, dict):
            continue

        name = item.get("name") or item.get("display_name") or item.get("canonical_name")
        if not name:
            continue

        if is_metadata_field(
            str(name),
            value=item.get("value"),
            ref_low=item.get("ref_low") or item.get("reference_low"),
            ref_high=item.get("ref_high") or item.get("reference_high"),
        ):
            continue

        value = item.get("value")
        unit = item.get("unit")
        if value in (None, "") or not unit:
            continue

        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            continue

        # Translate Ukrainian/Russian biomarker names to English
        name_str = str(name)
        if is_localized_name(name_str):
            name_str = translate_biomarker_name(name_str)

        display_name, canonical = _normalize_name(name_str, name_aliases=name_aliases)
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
        reference_source = "lab_report" if (ref_low is not None or ref_high is not None) else None
        is_verified_fallback = True  # Default: lab ranges are always verified
        if reference_source is None:
            ref_low, ref_high, is_verified_fallback = reference_range_fallback(canonical, normalized_unit, sex=sex, age=age)
            if ref_low is not None or ref_high is not None:
                # Fallback range found, but track whether it's verified
                reference_source = "vitaloop_reference_table"
                # is_verified_fallback is already set from reference_range_fallback()
        has_reference = reference_source is not None
        status = _status_for_value(
            numeric_value, ref_low, ref_high, item.get("status"),
            has_reference=has_reference,
            is_verified_fallback=is_verified_fallback,
        )

        unique_key = canonical
        if unique_key in seen:
            unique_key = f"{canonical}_{len(seen) + 1}"
        seen.add(unique_key)

        # Build output record
        record = {
            "name": display_name,
            "canonical_name": canonical,
            "value": numeric_value,
            "unit": normalized_unit,
            "assay_qualifier": item.get("assay_qualifier"),  # Preserve assay qualifier (FEU/DDU, etc.)
            "ref_low": ref_low,
            "ref_high": ref_high,
            "reference_source": reference_source,
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

        # Add unevaluated_reason for UNEVALUATED status
        if status == "UNEVALUATED" and reference_source == "vitaloop_reference_table" and not is_verified_fallback:
            record["unevaluated_reason"] = "unverified_reference_interval"

        normalized.append(record)

    return normalized
