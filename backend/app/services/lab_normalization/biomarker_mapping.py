from __future__ import annotations

from typing import Optional


_CANONICAL_MAP = {
    "vitamin d": "vitamin_d_25_oh",
    "vitamin d (25-oh)": "vitamin_d_25_oh",
    "ferritin": "ferritin",
    "hemoglobin": "hemoglobin",
    "glucose": "glucose",
    "hba1c": "hba1c",
    "tsh": "tsh",
    "free t3": "free_t3",
    "free t4": "free_t4",
    "cortisol": "cortisol",
    "magnesium": "magnesium",
}


def to_canonical_name(display_name: str) -> str:
    key = (display_name or "").strip().lower()
    if key in _CANONICAL_MAP:
        return _CANONICAL_MAP[key]
    normalized = key.replace("%", "pct").replace("/", "_")
    normalized = "_".join(part for part in normalized.replace("-", " ").split() if part)
    return normalized or "unknown_biomarker"


def infer_category(name: str) -> Optional[str]:
    lowered = (name or "").lower()
    if "vitamin" in lowered or "ferritin" in lowered:
        return "nutrients"
    if lowered in {"glucose", "hba1c"}:
        return "metabolic"
    if lowered in {"tsh", "free_t3", "free_t4", "cortisol"}:
        return "hormonal"
    if lowered in {"hemoglobin"}:
        return "hematology"
    return None
