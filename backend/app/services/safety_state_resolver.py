"""Resolve unified safety state for biomarkers across all views.

This service ensures consistent urgency messaging in:
- Results page (after confirmation)
- Today dashboard (what needs attention)
- Protocol (recommended action timing)
- Retest intervals (follow-up schedule)
"""

from typing import Any, Dict, List, Optional
from app.models.safety_state import SafetyState, SafetyLevel, resolve_safety_state


async def resolve_biomarker_safety_state(
    biomarkers: List[Dict[str, Any]],
    user_profile: Optional[Dict[str, Any]] = None,
) -> SafetyState:
    """Resolve unified safety state from confirmed biomarkers.

    Called after biomarkers are confirmed to determine:
    - Whether results need "prompt medical review" (IMMEDIATE)
    - Whether they need "medical review within 1-2 weeks" (HIGH)
    - Whether they're routine monitoring (ROUTINE)

    Args:
        biomarkers: List of confirmed biomarker dicts with value/unit/canonical_name
        user_profile: User demographics (age, sex, etc.)

    Returns:
        SafetyState with consistent urgency level for all views
    """

    # Filter to confirmed biomarkers only
    confirmed = [b for b in (biomarkers or []) if b.get("status") in ("confirmed", "corrected")]

    return resolve_safety_state(confirmed, user_profile)


async def augment_biomarkers_with_safety(
    biomarkers: List[Dict[str, Any]],
    user_profile: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Add unified safety_state to each biomarker for UI rendering.

    Each biomarker gets both:
    - Individual assessment (if it's critical, elevated, etc.)
    - Unified safety state (how urgent the overall result is)

    Args:
        biomarkers: List of confirmed biomarker dicts
        user_profile: User demographics

    Returns:
        List of biomarker dicts with added safety_state field
    """

    unified_state = await resolve_biomarker_safety_state(biomarkers, user_profile)

    # Add unified state to each biomarker
    augmented = []
    for biomarker in (biomarkers or []):
        item = dict(biomarker)  # shallow copy
        item["safety_state"] = {
            "level": unified_state.level,
            "message": unified_state.message,
            "recommended_interval_days": unified_state.recommended_interval_days,
        }
        augmented.append(item)

    return augmented


def format_safety_state_for_response(safety_state: SafetyState) -> Dict[str, Any]:
    """Format SafetyState for JSON response.

    Used by Results, Today, Protocol, and Retest endpoints.
    """

    return {
        "level": safety_state.level.value,
        "message": safety_state.message,
        "recommended_interval_days": safety_state.recommended_interval_days,
        "rationale": safety_state.rationale,
    }
