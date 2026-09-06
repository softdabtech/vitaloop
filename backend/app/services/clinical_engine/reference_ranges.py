"""Reference range lookup — thin façade over biomarker_reference.py.

Keeps BIOMARKER_DATABASE and resolve_status_bounds() in their original file
(it has 50+ entries and is imported by biomarker_service, analysis_candidates,
clinical_data_integrity).  This module adds the fallback helper that pipeline
uses and ensures the unit normalizer is the shared one from units.py.

Supports sex-specific and age-specific reference ranges from BIOMARKER_DATABASE.

⚠️  CRITICAL SAFETY: All fallback ranges currently UNVERIFIED.
    They lack documented source URL, version, or review date.
    Ranges must NOT produce clinical status until verified against authoritative
    documentation (LabCorp, Mayo Clinic, CLSI, etc.).
"""

from __future__ import annotations

from typing import Optional, Tuple

from app.services.biomarker_reference import BIOMARKER_DATABASE, resolve_status_bounds


# Sex-specific reference ranges for common markers
# Format: (biomarker_id, unit) → {"female": (min, max), "male": (min, max)}
# Note: biomarker_id is the canonical name with "canonical_" prefix removed (e.g., "hemoglobin", "rbc")
#
# ⚠️  STATUS: ALL entries are UNVERIFIED — no documented source URL or review date.
#     See CLINICAL_REFERENCE_INTERVALS.md for verification requirements.
_SEX_SPECIFIC_RANGES = {
    ("hemoglobin", "g/dL"): {"female": (12.0, 17.5), "male": (13.5, 17.5)},
    ("hemoglobin", "g/L"): {"female": (120, 175), "male": (135, 175)},
    ("hematocrit", "%"): {"female": (36, 46), "male": (41, 52)},
    ("rbc", "10^12/L"): {"female": (3.8, 5.1), "male": (4.3, 5.5)},
    ("rbc", "10^6/µL"): {"female": (3.8, 5.1), "male": (4.3, 5.5)},
}

# Fallback ranges that have been verified against authoritative sources.
# To add a range here, it MUST have:
#   - Exact source organization (LabCorp, Mayo Clinic, CLSI, etc.)
#   - Document URL or reference ID
#   - Review/publication date
#   - Applicable population (age/sex/status)
#   - Clinical staff sign-off
#
# Currently: EMPTY (all 72 existing fallback ranges lack sufficient provenance)
_VERIFIED_FALLBACK_RANGES: set[tuple[str, str]] = set()


def reference_range_fallback(
    canonical: str,
    unit: str,
    sex: Optional[str] = None,
    age: Optional[int] = None,
) -> Tuple[Optional[float], Optional[float], bool]:
    """Return (ref_low, ref_high, is_verified) from fallback sources.

    Returns (None, None, False) when marker/unit not found.

    ⚠️  CRITICAL: is_verified flag indicates whether the range has documented
        provenance (source URL, version, review date). UNVERIFIED ranges must NOT
        produce clinical status classification.

    Args:
        canonical: Canonical biomarker name (with or without "canonical_" prefix)
        unit: Normalized unit string
        sex: User sex ('male', 'female') — used to select sex-specific ranges
        age: User age in years — used to select age-specific ranges

    Returns:
        (ref_low, ref_high, is_verified) tuple
        - ref_low, ref_high: numeric bounds or None
        - is_verified: True if range has documented authoritative source

    Sex and age parameters allow selection of appropriate reference ranges
    from the BIOMARKER_DATABASE (e.g., hemoglobin differs by sex).
    """
    canonical_clean = str(canonical or "").removeprefix("canonical_")
    unit_clean = str(unit or "")
    range_key = (canonical_clean, unit_clean)

    # Check for sex-specific ranges in the sex-specific table first
    if sex:
        normalized_sex = sex.strip().lower()
        if normalized_sex in ("male", "female"):
            sex_ranges = _SEX_SPECIFIC_RANGES.get(range_key)
            if sex_ranges and normalized_sex in sex_ranges:
                low, high = sex_ranges[normalized_sex]
                # Check if this range is verified
                is_verified = range_key in _VERIFIED_FALLBACK_RANGES
                return (
                    float(low) if low is not None else None,
                    float(high) if high is not None else None,
                    is_verified,
                )

    # Fall back to general ranges from resolve_status_bounds
    bounds = resolve_status_bounds(
        canonical_clean,
        unit_clean,
        None,
        sex=sex,
        age=age,
    )
    if not bounds:
        return None, None, False

    ref_min, ref_max, _optimal_min, _optimal_max = bounds
    low = None if ref_min in (None, 0) else float(ref_min)
    high = None if ref_max in (None, float("inf")) else float(ref_max)

    # Check if this range is verified
    is_verified = range_key in _VERIFIED_FALLBACK_RANGES

    return low, high, is_verified
