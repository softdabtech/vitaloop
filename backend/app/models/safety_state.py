"""Safety state model for unified urgency across all views.

One source of truth for how urgent a biomarker or result set is.
Used by Results, Today, Protocol, and Retest endpoints.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SafetyLevel(str, Enum):
    """Urgency levels for biomarkers and results."""

    IMMEDIATE = "immediate"  # Prompt medical review needed (red alert)
    HIGH = "high"            # Within 1-2 weeks (amber alert)
    ROUTINE = "routine"      # Baseline/monitoring (green)


class SafetyState(BaseModel):
    """Unified safety state for a biomarker or result set.

    Used to ensure consistent urgency messaging across:
    - Results page (critical values)
    - Today dashboard (what needs attention)
    - Protocol (recommended action timing)
    - Retest intervals (follow-up schedule)
    """

    level: SafetyLevel = Field(..., description="Urgency level: immediate/high/routine")
    message: str = Field(..., description="User-facing message (e.g., 'Prompt medical review')")
    recommended_interval_days: int = Field(..., description="Suggested follow-up days")
    rationale: Optional[str] = Field(None, description="Why this level (internal use)")

    class Config:
        json_schema_extra = {
            "example": {
                "level": "immediate",
                "message": "Prompt medical review",
                "recommended_interval_days": 1,
                "rationale": "Critical potassium level (K < 2.5)"
            }
        }


def resolve_safety_state(
    biomarker_values: List[Dict[str, Any]],
    user_profile: Optional[Dict[str, Any]] = None,
) -> SafetyState:
    """Resolve safety state from biomarker values.

    Single source of truth for urgency calculation.
    Called by Results, Today, Protocol, and Retest endpoints.

    Args:
        biomarker_values: List of confirmed biomarker dicts with value/unit/canonical_name
        user_profile: User demographics (age, sex, etc.)

    Returns:
        SafetyState with consistent urgency level and messaging
    """

    # Check for IMMEDIATE level indicators
    immediate_markers = []
    high_markers = []

    for marker in biomarker_values or []:
        canonical = (marker.get("canonical_name") or marker.get("name") or "").lower()
        value = _to_float(marker.get("value"))

        if value is None:
            continue

        # Critical potassium (K < 2.5 or K > 7.0)
        if "potassium" in canonical or "k" == canonical:
            if value < 2.5 or value > 7.0:
                immediate_markers.append(f"K = {value}")
            elif value < 3.0 or value > 6.5:
                high_markers.append(f"K = {value}")

        # Critical calcium (Ca < 6.5 or Ca > 13.0)
        elif "calcium" in canonical or "ca" == canonical:
            if value < 6.5 or value > 13.0:
                immediate_markers.append(f"Ca = {value}")
            elif value < 7.0 or value > 12.5:
                high_markers.append(f"Ca = {value}")

        # Critical glucose (< 70 fasting or > 500)
        elif "glucose" in canonical:
            if value < 70 or value > 500:
                immediate_markers.append(f"Glucose = {value}")
            elif value < 85 or value > 200:
                high_markers.append(f"Glucose = {value}")

        # Critical hemoglobin (< 7 or > 20)
        elif "hemoglobin" in canonical or "hgb" == canonical:
            if value < 7 or value > 20:
                immediate_markers.append(f"Hgb = {value}")
            elif value < 8 or value > 18:
                high_markers.append(f"Hgb = {value}")

    # Resolve to appropriate level
    if immediate_markers:
        return SafetyState(
            level=SafetyLevel.IMMEDIATE,
            message="Prompt medical review",
            recommended_interval_days=1,
            rationale=f"Critical value(s): {', '.join(immediate_markers)}"
        )

    if high_markers:
        return SafetyState(
            level=SafetyLevel.HIGH,
            message="Medical review recommended within 1-2 weeks",
            recommended_interval_days=14,
            rationale=f"Elevated value(s): {', '.join(high_markers)}"
        )

    # Routine: normal range
    return SafetyState(
        level=SafetyLevel.ROUTINE,
        message="Routine follow-up per lab schedule",
        recommended_interval_days=90,
        rationale="All values within normal ranges"
    )


def _to_float(value: Any) -> Optional[float]:
    """Safely convert value to float."""
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


# Mapping of safety levels to UI colors/styling
SAFETY_LEVEL_COLORS = {
    SafetyLevel.IMMEDIATE: "red",
    SafetyLevel.HIGH: "amber",
    SafetyLevel.ROUTINE: "green",
}

SAFETY_LEVEL_ICONS = {
    SafetyLevel.IMMEDIATE: "⚠️",
    SafetyLevel.HIGH: "⚡",
    SafetyLevel.ROUTINE: "✅",
}
