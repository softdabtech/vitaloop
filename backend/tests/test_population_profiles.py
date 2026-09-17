"""P24: Population Profiles (app/services/population_profiles.py).

Deterministic overlay layer, no LLM. First and only profile in v1:
longevity_metabolic_optimization. Covers priority-adjustment emphasis,
contradiction downgrades, evidence-gap context notes, next-test emphasis
(including "already being addressed" via intervention_memory/outcome
attribution), velocity-drift notes, practitioner prompts, empty/malformed
input handling, and forbidden-wording absence.
"""

from app.services.population_profiles import (
    build_population_profile_overlays,
    LONGEVITY_METABOLIC_OPTIMIZATION,
    POPULATION_PROFILES_VERSION,
)


_FORBIDDEN_PHRASES = [
    "diagnosis", "you have", "disease", "ruled out", "guaranteed",
    "cured", "cure", "treatment", "treats", "prescri",
]


def _hypothesis(domain, hypothesis_id="h1", label="Test hypothesis", calibrated_confidence="high"):
    return {
        "hypothesis_id": hypothesis_id,
        "label": label,
        "domain": domain,
        "calibrated_confidence": calibrated_confidence,
    }


def test_version_and_default_profile_active_with_no_input():
    result = build_population_profile_overlays()

    assert result["version"] == POPULATION_PROFILES_VERSION
    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]
    assert result["unknown_profile_ids"] == []
    assert len(result["profiles"]) == 1
    profile = result["profiles"][0]
    assert profile["focus_domains"] == ["metabolic_health", "cardiovascular", "inflammation", "liver", "micronutrients"]
    assert profile["priority_adjustments"] == []
    assert profile["context_notes"] == []
    assert profile["next_test_emphasis"] == []
    assert profile["practitioner_prompts"] == []


def test_focus_domain_high_confidence_hypothesis_gets_elevated():
    clinical_hypotheses = {"hypotheses": [_hypothesis("metabolic_health")]}

    result = build_population_profile_overlays(clinical_hypotheses=clinical_hypotheses)

    profile = result["profiles"][0]
    assert len(profile["priority_adjustments"]) == 1
    adjustment = profile["priority_adjustments"][0]
    assert adjustment["profile_emphasis"] == "elevated"
    assert adjustment["domain"] == "metabolic_health"
    assert profile["summary"]["elevated_count"] == 1


def test_out_of_focus_domain_hypothesis_is_ignored():
    clinical_hypotheses = {"hypotheses": [_hypothesis("thyroid")]}

    result = build_population_profile_overlays(clinical_hypotheses=clinical_hypotheses)

    assert result["profiles"][0]["priority_adjustments"] == []


def test_low_confidence_hypothesis_not_elevated():
    clinical_hypotheses = {"hypotheses": [_hypothesis("liver", calibrated_confidence="low")]}

    result = build_population_profile_overlays(clinical_hypotheses=clinical_hypotheses)

    adjustment = result["profiles"][0]["priority_adjustments"][0]
    assert adjustment["profile_emphasis"] == "standard"


def test_contradiction_in_focus_domain_downgrades_instead_of_elevating():
    clinical_hypotheses = {"hypotheses": [_hypothesis("cardiovascular", calibrated_confidence="high")]}
    clinical_contradictions = {"contradictions": [{"domain": "cardiovascular", "message": "Inflammation may limit interpretation."}]}

    result = build_population_profile_overlays(
        clinical_hypotheses=clinical_hypotheses,
        clinical_contradictions=clinical_contradictions,
    )

    adjustment = result["profiles"][0]["priority_adjustments"][0]
    assert adjustment["profile_emphasis"] == "downgraded_due_to_contradiction"
    assert adjustment["contradiction_notes"] == ["Inflammation may limit interpretation."]
    assert result["profiles"][0]["summary"]["downgraded_count"] == 1
    assert result["profiles"][0]["summary"]["elevated_count"] == 0


def test_high_evidence_debt_in_focus_domain_produces_context_note():
    evidence_debt = {
        "domain_debt": [
            {"domain": "inflammation", "debt_level": "high", "missing_markers": ["CRP"]},
            {"domain": "thyroid", "debt_level": "high", "missing_markers": ["TSH"]},  # out of focus, must be excluded
        ]
    }

    result = build_population_profile_overlays(evidence_debt=evidence_debt)

    notes = result["profiles"][0]["context_notes"]
    assert len(notes) == 1
    assert notes[0]["domain"] == "inflammation"
    assert "CRP" in notes[0]["note"]


def test_low_evidence_debt_does_not_produce_context_note():
    evidence_debt = {"domain_debt": [{"domain": "liver", "debt_level": "low", "missing_markers": []}]}

    result = build_population_profile_overlays(evidence_debt=evidence_debt)

    assert result["profiles"][0]["context_notes"] == []


def test_next_test_emphasis_filters_to_focus_domain_and_marker():
    next_test_funnel = {
        "panel": {
            "metabolic_health": [{"marker": "hba1c", "priority": "high"}],
            "iron_status": [{"marker": "ferritin", "priority": "high"}],  # out of focus domain
            "cardiovascular": [{"marker": "vitamin_d", "priority": "medium"}],  # in focus domain, not a focus marker
        }
    }

    result = build_population_profile_overlays(next_test_funnel=next_test_funnel)

    emphasis = result["profiles"][0]["next_test_emphasis"]
    assert len(emphasis) == 1
    assert emphasis[0]["marker"] == "hba1c"
    assert emphasis[0]["domain"] == "metabolic_health"
    assert emphasis[0]["already_being_addressed"] is False


def test_next_test_emphasis_marks_already_addressed_via_active_intervention():
    next_test_funnel = {"panel": {"metabolic_health": [{"marker": "glucose", "priority": "high"}]}}
    intervention_memory = {"active_interventions": [{"domains": ["metabolic_health"]}], "completed_interventions": []}

    result = build_population_profile_overlays(
        next_test_funnel=next_test_funnel,
        intervention_memory=intervention_memory,
    )

    emphasis = result["profiles"][0]["next_test_emphasis"][0]
    assert emphasis["already_being_addressed"] is True


def test_velocity_worsened_signal_in_focus_domain_produces_note_and_prompt():
    velocity_signals = [
        {"domain": "liver", "marker": "alt", "status": "worsened_from_baseline", "confidence": "moderate"},
        {"domain": "liver", "marker": "alt", "status": "improved_toward_baseline", "confidence": "moderate"},
        {"domain": "thyroid", "marker": "tsh", "status": "worsened_from_baseline", "confidence": "moderate"},  # out of focus
    ]

    result = build_population_profile_overlays(velocity_signals=velocity_signals)

    notes = result["profiles"][0]["velocity_notes"]
    assert len(notes) == 1
    assert notes[0]["domain"] == "liver"
    assert notes[0]["marker"] == "alt"
    prompts_text = " ".join(result["profiles"][0]["practitioner_prompts"])
    assert "alt" in prompts_text.lower()


def test_practitioner_prompts_deduplicated_and_capped():
    clinical_hypotheses = {
        "hypotheses": [
            _hypothesis("metabolic_health", hypothesis_id="h1", label="Metabolic pattern"),
            _hypothesis("cardiovascular", hypothesis_id="h2", label="Cardiovascular pattern"),
            _hypothesis("inflammation", hypothesis_id="h3", label="Inflammation pattern"),
            _hypothesis("liver", hypothesis_id="h4", label="Liver pattern"),
            _hypothesis("micronutrients", hypothesis_id="h5", label="Micronutrient pattern"),
        ]
    }
    evidence_debt = {
        "domain_debt": [
            {"domain": d, "debt_level": "high", "missing_markers": ["X"]}
            for d in ["metabolic_health", "cardiovascular", "inflammation", "liver", "micronutrients"]
        ]
    }

    result = build_population_profile_overlays(clinical_hypotheses=clinical_hypotheses, evidence_debt=evidence_debt)

    prompts = result["profiles"][0]["practitioner_prompts"]
    assert len(prompts) <= 8
    assert len(prompts) == len(set(prompts))


def test_unknown_profile_id_is_reported_not_silently_dropped():
    result = build_population_profile_overlays(profile_ids=["some_future_profile"])

    assert result["profiles"] == []
    assert result["unknown_profile_ids"] == ["some_future_profile"]


def test_requesting_known_and_unknown_profile_ids_together():
    result = build_population_profile_overlays(profile_ids=[LONGEVITY_METABOLIC_OPTIMIZATION, "other"])

    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]
    assert result["unknown_profile_ids"] == ["other"]


def test_malformed_input_does_not_crash():
    result = build_population_profile_overlays(
        clinical_hypotheses={"hypotheses": ["bad", None, 42, {}]},
        clinical_contradictions={"contradictions": "bad"},
        velocity_signals=["bad", None],
        intervention_memory={"active_interventions": None, "completed_interventions": "bad"},
        outcome_attribution={"attributions": "bad"},
        evidence_debt={"domain_debt": ["bad", None, {}]},
        next_test_funnel={"panel": "bad"},
    )

    assert isinstance(result["profiles"], list)
    assert result["profiles"][0]["priority_adjustments"] == []


def test_forbidden_wording_absent_from_generated_text():
    clinical_hypotheses = {
        "hypotheses": [
            _hypothesis("metabolic_health", hypothesis_id="h1", label="Metabolic pattern"),
            _hypothesis("cardiovascular", hypothesis_id="h2", label="Cardiovascular pattern", calibrated_confidence="high"),
        ]
    }
    clinical_contradictions = {"contradictions": [{"domain": "cardiovascular", "message": "Inflammation context needed."}]}
    evidence_debt = {"domain_debt": [{"domain": "liver", "debt_level": "blocked", "missing_markers": ["ALT"]}]}
    velocity_signals = [{"domain": "micronutrients", "marker": "vitamin_d", "status": "worsened_from_baseline", "confidence": "low"}]

    result = build_population_profile_overlays(
        clinical_hypotheses=clinical_hypotheses,
        clinical_contradictions=clinical_contradictions,
        evidence_debt=evidence_debt,
        velocity_signals=velocity_signals,
    )

    profile = result["profiles"][0]
    text_blob = " ".join(
        profile["practitioner_prompts"]
        + [n["note"] for n in profile["context_notes"]]
        + [a["reason"] for a in profile["priority_adjustments"]]
        + profile["limitations"]
    ).lower()

    for phrase in _FORBIDDEN_PHRASES:
        assert phrase not in text_blob, f"forbidden phrase found: {phrase}"


def test_does_not_mutate_input_hypotheses_or_evidence_debt():
    """Overlay must never alter the source data it reads -- only annotate
    alongside it. calibrated_confidence/confidence_score on the hypothesis
    itself, and debt_level on evidence_debt, must be untouched."""
    hypothesis = _hypothesis("metabolic_health", calibrated_confidence="high")
    clinical_hypotheses = {"hypotheses": [hypothesis]}
    debt_entry = {"domain": "liver", "debt_level": "high", "missing_markers": ["ALT"]}
    evidence_debt = {"domain_debt": [debt_entry]}

    build_population_profile_overlays(clinical_hypotheses=clinical_hypotheses, evidence_debt=evidence_debt)

    assert hypothesis == _hypothesis("metabolic_health", calibrated_confidence="high")
    assert debt_entry == {"domain": "liver", "debt_level": "high", "missing_markers": ["ALT"]}
