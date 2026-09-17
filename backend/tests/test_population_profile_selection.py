"""P24.3: Population Profile Selection / Targeting
(app/services/population_profile_selection.py).

Deterministic, no LLM. Decides which population profile(s)
population_profiles.py should compute for a report -- covers default
selection, explicit override (valid/invalid/both), athlete_recovery
inference from intervention_memory (training event, and sleep/stress/
illness events with/without athletic keywords), refusal to infer from lab
markers alone, and no mutation of inputs.
"""

from app.services.population_profile_selection import select_population_profiles
from app.services.population_profiles import ATHLETE_RECOVERY, LONGEVITY_METABOLIC_OPTIMIZATION


def _event(event_type, label, description=None, status="active"):
    return {"type": event_type, "label": label, "description": description}


def _intervention_memory(active=None, completed=None):
    return {"active_interventions": active or [], "completed_interventions": completed or []}


def test_default_selection_with_no_input():
    result = select_population_profiles()

    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]
    assert result["selection_source"] == "default"
    assert result["ignored_profile_ids"] == []
    assert result["selection_reasons"] == [
        {"profile_id": LONGEVITY_METABOLIC_OPTIMIZATION, "reason_code": "default_profile", "source": "default"}
    ]


def test_explicit_valid_profile_is_respected():
    result = select_population_profiles(source_metadata={"population_profile_ids": [ATHLETE_RECOVERY]})

    assert result["active_profile_ids"] == [ATHLETE_RECOVERY]
    assert result["selection_source"] == "explicit"
    assert result["ignored_profile_ids"] == []


def test_explicit_unknown_profile_id_is_ignored_and_falls_back_to_default():
    result = select_population_profiles(source_metadata={"population_profile_ids": ["not_a_real_profile"]})

    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]
    assert result["ignored_profile_ids"] == ["not_a_real_profile"]
    assert any(r["reason_code"] == "unknown_profile_id_ignored" for r in result["selection_reasons"])


def test_explicit_both_profiles_requested():
    result = select_population_profiles(
        source_metadata={"population_profile_ids": [LONGEVITY_METABOLIC_OPTIMIZATION, ATHLETE_RECOVERY]}
    )

    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION, ATHLETE_RECOVERY]
    assert result["selection_source"] == "explicit"


def test_explicit_mix_of_valid_and_invalid_ids():
    result = select_population_profiles(
        source_metadata={"population_profile_ids": [ATHLETE_RECOVERY, "bogus_profile"]}
    )

    assert result["active_profile_ids"] == [ATHLETE_RECOVERY]
    assert result["selection_source"] == "explicit"
    assert result["ignored_profile_ids"] == ["bogus_profile"]


def test_athlete_inferred_from_training_event_type():
    intervention_memory = _intervention_memory(active=[_event("training", "Marathon block")])

    result = select_population_profiles(intervention_memory=intervention_memory)

    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION, ATHLETE_RECOVERY]
    assert result["selection_source"] == "mixed"
    assert any(r["reason_code"] == "training_context_present" and r["source"] == "intervention_memory" for r in result["selection_reasons"])


def test_athlete_inferred_from_completed_training_event_too():
    intervention_memory = _intervention_memory(completed=[_event("training", "Half marathon prep")])

    result = select_population_profiles(intervention_memory=intervention_memory)

    assert ATHLETE_RECOVERY in result["active_profile_ids"]


def test_athlete_inferred_from_sleep_event_with_explicit_athletic_language():
    intervention_memory = _intervention_memory(
        active=[_event("sleep", "Disrupted sleep", description="During marathon training block")]
    )

    result = select_population_profiles(intervention_memory=intervention_memory)

    assert ATHLETE_RECOVERY in result["active_profile_ids"]


def test_generic_sleep_event_without_athletic_language_does_not_infer_athlete():
    intervention_memory = _intervention_memory(active=[_event("sleep", "Poor sleep quality")])

    result = select_population_profiles(intervention_memory=intervention_memory)

    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]
    assert result["selection_source"] == "default"


def test_generic_stress_and_illness_events_without_athletic_language_do_not_infer():
    intervention_memory = _intervention_memory(
        active=[_event("stress", "High work stress"), _event("illness", "Common cold")]
    )

    result = select_population_profiles(intervention_memory=intervention_memory)

    assert ATHLETE_RECOVERY not in result["active_profile_ids"]


def test_non_context_event_types_never_infer_athlete_even_with_keywords():
    """supplement/nutrition/medication/alcohol/weight_change/protocol_action
    events are not in the small "context event types that may carry
    athletic language" set -- only training (always) or sleep/stress/
    illness (with keyword) count, per the module's documented rule."""
    intervention_memory = _intervention_memory(active=[_event("supplement", "Marathon recovery supplement")])

    result = select_population_profiles(intervention_memory=intervention_memory)

    assert ATHLETE_RECOVERY not in result["active_profile_ids"]


def test_athlete_not_inferred_from_lab_markers_alone():
    """This selector takes no evidence_debt/clinical_hypotheses/velocity
    argument at all -- there is no code path by which a lab marker could
    ever influence selection. This test documents that boundary via the
    function signature itself: passing only intervention_memory with no
    athletic signal must never activate athlete_recovery, regardless of
    how "athletic" the underlying lab picture might look."""
    result = select_population_profiles(intervention_memory=_intervention_memory())

    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]


def test_malformed_intervention_memory_does_not_crash():
    result = select_population_profiles(
        intervention_memory={"active_interventions": "bad", "completed_interventions": None},
        source_metadata={"population_profile_ids": "not_a_list"},
    )

    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]


def test_does_not_mutate_inputs():
    intervention_memory = _intervention_memory(active=[_event("training", "Marathon block")])
    source_metadata = {"population_profile_ids": [ATHLETE_RECOVERY]}
    intervention_memory_copy = {
        "active_interventions": [dict(intervention_memory["active_interventions"][0])],
        "completed_interventions": [],
    }
    source_metadata_copy = {"population_profile_ids": [ATHLETE_RECOVERY]}

    select_population_profiles(intervention_memory=intervention_memory, source_metadata=source_metadata)

    assert intervention_memory == intervention_memory_copy
    assert source_metadata == source_metadata_copy


def test_version_field_present():
    result = select_population_profiles()
    assert result["version"] == "p24_3_v1"
