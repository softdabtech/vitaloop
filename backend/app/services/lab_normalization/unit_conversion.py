from __future__ import annotations

from typing import Tuple


def normalize_value_unit(value: float, unit: str) -> Tuple[float, str]:
    normalized_unit = (unit or "").strip() or "unit"
    # Keep explicit hook for future conversions; MVP keeps source unit.
    return float(value), normalized_unit
