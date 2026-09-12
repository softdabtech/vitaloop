"""Regression coverage for safety_state_resolver.py.

P1 fix (2026-09-12 clinical analyzer audit): resolve_biomarker_safety_state()
used to filter biomarkers by status in ("confirmed", "corrected") — those are
candidate-REVIEW statuses from before persistence. Every real caller passes
already-persisted canonical biomarkers, whose status is the clinical
classification (ELEVATED/DEFICIENT/BORDERLINE/OPTIMAL/...), so the filter
emptied the list every time and this "single source of truth for urgency"
always returned ROUTINE, disagreeing with the separate safety_engine.py which
correctly flagged the same data as urgent.
"""

import pytest

from app.services.safety_state_resolver import resolve_biomarker_safety_state
from app.models.safety_state import SafetyLevel


@pytest.mark.asyncio
async def test_critical_potassium_with_clinical_status_is_immediate_not_routine():
    """A canonical biomarker never carries status='confirmed' — it carries the
    clinical classification. Before the fix this always fell through to
    ROUTINE regardless of how critical the value was.
    """
    biomarkers = [
        {"name": "Potassium", "canonical_name": "potassium", "value": 2.1, "unit": "mmol/L", "status": "DEFICIENT"},
    ]
    state = await resolve_biomarker_safety_state(biomarkers, user_profile={})
    assert state.level == SafetyLevel.IMMEDIATE


@pytest.mark.asyncio
async def test_elevated_glucose_with_clinical_status_is_high_not_routine():
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 210, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    state = await resolve_biomarker_safety_state(biomarkers, user_profile={})
    assert state.level == SafetyLevel.HIGH


@pytest.mark.asyncio
async def test_optimal_values_are_routine():
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 90, "unit": "mg/dL", "status": "OPTIMAL"},
        {"name": "Potassium", "canonical_name": "potassium", "value": 4.2, "unit": "mmol/L", "status": "OPTIMAL"},
    ]
    state = await resolve_biomarker_safety_state(biomarkers, user_profile={})
    assert state.level == SafetyLevel.ROUTINE


@pytest.mark.asyncio
async def test_legacy_confirmed_status_value_still_scored_correctly():
    """The old candidate-review status strings must not be treated specially
    any more — they're just ignored now, and the numeric value drives scoring
    regardless of what's in `status`.
    """
    biomarkers = [
        {"name": "Potassium", "canonical_name": "potassium", "value": 2.1, "unit": "mmol/L", "status": "confirmed"},
    ]
    state = await resolve_biomarker_safety_state(biomarkers, user_profile={})
    assert state.level == SafetyLevel.IMMEDIATE
