from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Tuple

from app.services.biomarker_reference import BIOMARKER_DATABASE, get_all_biomarkers

_KNOWN_UNITS = {
    "%",
    "g/dL",
    "g/L",
    "mg/dL",
    "mmol/L",
    "ng/mL",
    "ug/L",
    "mcg/L",
    "U/L",
    "IU/L",
    "uIU/mL",
    "mIU/L",
    "pg/mL",
    "pg",
    "ng/dL",
    "x10^3/uL",
    "x10^3/µL",
    "x10^9/L",
    "x10^6/uL",
    "x10^6/µL",
    "x10^12/L",
    "mm/h",
}

_UNIT_ALIASES = {
    "г/л": "g/L",
    "г/дл": "g/dL",
    "мг/дл": "mg/dL",
    "ммоль/л": "mmol/L",
    "нг/мл": "ng/mL",
    "мкг/л": "ug/L",
    "од/л": "U/L",
    "мо/л": "IU/L",
    "фл": "fL",
    "пг": "pg",
    "мм/год": "mm/h",
    "10^9/л": "x10^9/L",
    "10^12/л": "x10^12/L",
}


def _reference_units() -> set[str]:
    return {
        unit
        for biomarker in BIOMARKER_DATABASE.values()
        for unit in (biomarker.get("units") or {})
    }


def _normalize_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9а-яіїєґ]+", " ", str(value or "").strip().lower()).strip()


def _known_names() -> set[str]:
    names: set[str] = set()
    for item in get_all_biomarkers():
        names.add(_normalize_text(item.get("id")))
        names.add(_normalize_text(item.get("name")))
    names.update(
        {
            "ferritin",
            "феритин",
            "ферритин",
            "vitamin d",
            "25 oh vitamin d",
            "вітамін d",
            "витамин d",
            "b12",
            "vitamin b12",
            "folate",
            "glucose",
            "глюкоза",
            "hba1c",
            "alt",
            "ast",
            "tsh",
            "t3",
            "t4",
            "ldl",
            "hdl",
            "triglycerides",
        }
    )
    return {name for name in names if name}


def _unit_recognized(unit: Any) -> bool:
    raw = str(unit or "").strip()
    if not raw:
        return False
    normalized = raw.replace("μ", "µ").replace("㎍", "µg").replace("㎎", "mg").replace("⁄", "/")
    normalized = _UNIT_ALIASES.get(normalized.lower(), normalized)
    normalized_lookup = re.sub(r"\s+", "", normalized).replace("²", "2")
    known_units = _KNOWN_UNITS | _reference_units()
    lowered = normalized.lower()
    return (
        normalized in known_units
        or lowered in {unit.lower() for unit in known_units}
        or normalized_lookup.lower() in {
            re.sub(r"\s+", "", unit.replace("μ", "µ")).replace("²", "2").lower()
            for unit in known_units
        }
        or bool(re.match(r"^(x10\^\d+)/(ul|µl|l)$", lowered))
    )


def _has_numeric(value: Any) -> bool:
    if isinstance(value, (int, float)):
        return True
    return bool(re.search(r"[-+]?\d+(?:[.,]\d+)?", str(value or "")))


def _has_reference(candidate: Dict[str, Any]) -> bool:
    if candidate.get("raw_reference_range") or candidate.get("reference_range"):
        return True
    return candidate.get("ref_low") not in (None, "") or candidate.get("ref_high") not in (None, "")


def _has_source_location(candidate: Dict[str, Any]) -> bool:
    return candidate.get("source_page") not in (None, "") or candidate.get("source_row") not in (None, "")


def score_biomarker_candidate(candidate: Dict[str, Any]) -> Dict[str, Any]:
    score = 0.0
    reasons: List[str] = []
    normalized_name = _normalize_text(candidate.get("raw_name") or candidate.get("name"))
    known_names = _known_names()

    if normalized_name in known_names or any(normalized_name and (normalized_name in known or known in normalized_name) for known in known_names):
        score += 0.25
        reasons.append("known_biomarker_name")

    if _has_numeric(candidate.get("parsed_value", candidate.get("raw_value", candidate.get("value")))):
        score += 0.20
        reasons.append("numeric_value")

    if _unit_recognized(candidate.get("raw_unit") or candidate.get("unit")):
        score += 0.15
        reasons.append("recognized_unit")

    if _has_reference(candidate):
        score += 0.15
        reasons.append("reference_range_present")

    if bool(candidate.get("deterministic_ai_agreement")):
        score += 0.15
        reasons.append("deterministic_ai_agreement")

    if _has_source_location(candidate):
        score += 0.10
        reasons.append("source_location_present")

    score = round(min(score, 1.0), 3)
    if score >= 0.80:
        label = "high"
    elif score >= 0.55:
        label = "medium"
    else:
        label = "low"

    return {"score": score, "label": label, "reasons": reasons}


def build_candidate_payloads(
    *,
    biomarkers: Iterable[Dict[str, Any]],
    source: str,
    source_page: int | None = None,
) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    for index, biomarker in enumerate(biomarkers or []):
        reference_range = biomarker.get("reference_range")
        if not reference_range and (biomarker.get("ref_low") not in (None, "") or biomarker.get("ref_high") not in (None, "")):
            low = "" if biomarker.get("ref_low") in (None, "") else str(biomarker.get("ref_low"))
            high = "" if biomarker.get("ref_high") in (None, "") else str(biomarker.get("ref_high"))
            reference_range = f"{low}-{high}".strip("-")
        candidate = {
            "source": source,
            "raw_name": biomarker.get("name") or biomarker.get("display_name"),
            "raw_value": biomarker.get("value"),
            "raw_unit": biomarker.get("unit"),
            "raw_reference_range": reference_range,
            "parsed_value": biomarker.get("value"),
            "source_page": source_page,
            "source_row": biomarker.get("source_row") or index,
            "status": "pending",
        }
        if source == "manual":
            candidate["status"] = "confirmed"
            candidate["deterministic_ai_agreement"] = True
        scored = score_biomarker_candidate(candidate)
        if source == "manual" and scored["score"] >= 0.75:
            scored = {
                "score": 1.0,
                "label": "high",
                "reasons": [*scored["reasons"], "manual_user_confirmed"],
            }
        candidate["confidence_score"] = scored["score"]
        candidate["confidence_label"] = scored["label"]
        candidate["confidence_reasons"] = scored["reasons"]
        candidates.append(candidate)
    return candidates


def enrich_candidates_from_biomarkers(
    candidates: Iterable[Dict[str, Any]],
    biomarkers: Iterable[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Restore metadata that the candidate persistence schema does not carry.

    Candidate confirmation replaces biomarker rows, so existing laboratory
    bounds and statuses must be merged before that destructive save occurs.
    """

    by_name = {
        _normalize_text(item.get("name") or item.get("display_name")): item
        for item in biomarkers or []
        if _normalize_text(item.get("name") or item.get("display_name"))
    }
    enriched: List[Dict[str, Any]] = []
    for candidate in candidates or []:
        merged = dict(candidate)
        existing = by_name.get(_normalize_text(candidate.get("raw_name") or candidate.get("name"))) or {}
        if not merged.get("raw_reference_range"):
            low = existing.get("ref_low")
            high = existing.get("ref_high")
            if low not in (None, "") or high not in (None, ""):
                merged["raw_reference_range"] = f"{'' if low in (None, '') else low}-{'' if high in (None, '') else high}".strip("-")
        merged.setdefault("ref_low", existing.get("ref_low"))
        merged.setdefault("ref_high", existing.get("ref_high"))
        merged.setdefault("status_hint", existing.get("status"))
        merged.setdefault("category", existing.get("category"))
        enriched.append(merged)
    return enriched


def candidate_to_biomarker(candidate: Dict[str, Any]) -> Dict[str, Any] | None:
    name = str(candidate.get("raw_name") or candidate.get("name") or "").strip()
    unit = str(candidate.get("raw_unit") or candidate.get("unit") or "").strip()
    value = candidate.get("parsed_value", candidate.get("raw_value", candidate.get("value")))
    if not name or not unit or value in (None, ""):
        return None
    try:
        numeric_value = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        match = re.search(r"[-+]?\d+(?:[.,]\d+)?", str(value))
        if not match:
            return None
        numeric_value = float(match.group(0).replace(",", "."))

    reference_range = candidate.get("raw_reference_range") or candidate.get("reference_range")
    ref_low = candidate.get("ref_low")
    ref_high = candidate.get("ref_high")
    if ref_low in (None, "") or ref_high in (None, ""):
        range_values = re.findall(r"(?<!\d)[-+]?\d+(?:[.,]\d+)?", str(reference_range or ""))
        if len(range_values) >= 2:
            ref_low = ref_low if ref_low not in (None, "") else float(range_values[0].replace(",", "."))
            ref_high = ref_high if ref_high not in (None, "") else float(range_values[1].replace(",", "."))
    try:
        ref_low = float(str(ref_low).replace(",", ".")) if ref_low not in (None, "") else None
        ref_high = float(str(ref_high).replace(",", ".")) if ref_high not in (None, "") else None
    except (TypeError, ValueError):
        ref_low, ref_high = None, None

    raw_status = str(candidate.get("biomarker_status") or candidate.get("status_hint") or "").strip().upper()
    if ref_low is not None and numeric_value < ref_low:
        status = "DEFICIENT"
    elif ref_high is not None and numeric_value > ref_high:
        status = "ELEVATED"
    elif ref_low is not None or ref_high is not None:
        status = "OPTIMAL"
    else:
        status = raw_status if raw_status in {"OPTIMAL", "BORDERLINE", "DEFICIENT", "ELEVATED"} else "BORDERLINE"
    return {
        "name": name,
        "value": numeric_value,
        "unit": unit,
        "ref_low": ref_low,
        "ref_high": ref_high,
        "reference_range": reference_range,
        "status": status,
        "category": candidate.get("category") or "other",
    }
