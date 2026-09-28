"""Canonical validation for the required adult B2C clinical profile."""

from typing import Any, Mapping


REQUIRED_PROFILE_FIELDS = ("age", "sex", "height_cm", "weight_kg")
SUPPORTED_SEX_VALUES = {"male", "female"}


def _number_in_range(value: Any, minimum: float, maximum: float) -> bool:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    return minimum <= number <= maximum


def missing_required_profile_fields(profile: Mapping[str, Any] | None) -> list[str]:
    """Return fields missing from the supported adult clinical context.

    The same validator gates onboarding, cabinet state, and lab analysis so a
    client cannot obtain different answers from different endpoints.
    """
    profile = profile or {}
    missing: list[str] = []
    if not _number_in_range(profile.get("age"), 18, 120):
        missing.append("age")
    if str(profile.get("sex") or "").strip().lower() not in SUPPORTED_SEX_VALUES:
        missing.append("sex")
    if not _number_in_range(profile.get("height_cm"), 100, 250):
        missing.append("height_cm")
    if not _number_in_range(profile.get("weight_kg"), 30, 350):
        missing.append("weight_kg")
    return missing


def has_required_profile(profile: Mapping[str, Any] | None) -> bool:
    return not missing_required_profile_fields(profile)
