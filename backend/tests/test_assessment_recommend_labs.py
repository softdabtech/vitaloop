"""Coverage for app.routers.assessment._recommend_labs.

2026-09-16: the pre-signup symptom-check modal's lab suggestions used to
come from a hand-maintained SYMPTOM_LAB_MAP covering only 5 of the 10
symptoms offered on the intake form (the rest silently fell back to a
generic default list). Replaced with a lookup driven by the same
domain->marker vocabulary the deterministic reasoning engine already uses
(negative_evidence.py's _DOMAIN_MARKERS), so every symptom maps to
canonical clinical domains and their required markers instead of a
separate, drift-prone list.
"""

from app.routers.assessment import (
    _recommend_labs,
    SYMPTOM_DOMAIN_MAP,
    DEFAULT_LABS,
)
from app.services.negative_evidence import _DOMAIN_MARKERS as _CLINICAL_DOMAIN_MARKERS


def test_every_intake_symptom_maps_to_a_known_clinical_domain():
    intake_symptoms = [
        "fatigue", "sleep_issues", "hair_loss", "brain_fog", "digestive_issues",
        "joint_pain", "anxiety", "cold_intolerance", "weight_change", "poor_immunity",
    ]
    for symptom in intake_symptoms:
        domains = SYMPTOM_DOMAIN_MAP.get(symptom)
        assert domains, f"{symptom} has no domain mapping"
        for domain in domains:
            assert domain in _CLINICAL_DOMAIN_MARKERS, f"{symptom} maps to unknown domain {domain}"


def test_previously_unmapped_symptom_no_longer_falls_back_to_default():
    # joint_pain, cold_intolerance, poor_immunity had no entry in the old
    # SYMPTOM_LAB_MAP and always fell back to DEFAULT_LABS.
    for symptom in ["joint_pain", "cold_intolerance", "poor_immunity"]:
        result = _recommend_labs([symptom])
        assert result, f"{symptom} produced no recommendations"
        result_keys = {lab["key"] for lab in result}
        default_keys = {lab["key"] for lab in DEFAULT_LABS}
        assert result_keys != default_keys, f"{symptom} still falls back to the generic default list"


def test_markers_come_from_canonical_domain_vocabulary():
    result = _recommend_labs(["fatigue"])
    keys = {lab["key"] for lab in result}
    assert keys == {"ferritin", "hemoglobin", "tsh", "vitamin_d", "b12"}


def test_multiple_symptoms_deduplicate_shared_markers():
    result = _recommend_labs(["fatigue", "hair_loss"])
    keys = [lab["key"] for lab in result]
    assert len(keys) == len(set(keys))


def test_unknown_symptom_falls_back_to_default_labs():
    result = _recommend_labs(["some_totally_unmapped_symptom"])
    assert {lab["key"] for lab in result} == {lab["key"] for lab in DEFAULT_LABS}


def test_recommendation_capped_at_six():
    result = _recommend_labs(["fatigue", "digestive_issues", "weight_change", "poor_immunity"])
    assert len(result) <= 6
