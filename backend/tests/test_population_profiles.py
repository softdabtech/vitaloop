"""P24: Population Profiles (app/services/population_profiles.py).

Deterministic overlay layer, no LLM. Two profiles:
- longevity_metabolic_optimization (P24.1)
- athlete_recovery (P24.2)

Covers priority-adjustment emphasis, contradiction downgrades,
evidence-gap context notes, next-test emphasis (including "already being
addressed" via intervention_memory/outcome attribution), velocity-drift
notes, practitioner prompts, cross-profile isolation, empty/malformed
input handling, and forbidden-wording absence.
"""

from app.services.population_profiles import (
    build_population_profile_overlays,
    ATHLETE_RECOVERY,
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


# ---------------------------------------------------------------------------
# P24.2: athlete_recovery
# ---------------------------------------------------------------------------

_ATHLETE_FOCUS_DOMAINS = ["iron_status", "micronutrients", "inflammation", "liver", "metabolic_health", "recovery"]


def test_athlete_recovery_not_active_by_default():
    """Backward compatibility: P24.1 shipped with only
    longevity_metabolic_optimization active by default. Adding
    athlete_recovery must not silently change that default."""
    result = build_population_profile_overlays()

    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION]


def test_athlete_recovery_can_be_requested_explicitly():
    result = build_population_profile_overlays(profile_ids=[ATHLETE_RECOVERY])

    assert result["active_profile_ids"] == [ATHLETE_RECOVERY]
    assert result["unknown_profile_ids"] == []
    profile = result["profiles"][0]
    assert profile["label"] == "Athlete / Recovery"
    assert profile["focus_domains"] == _ATHLETE_FOCUS_DOMAINS


def test_athlete_recovery_focus_domain_hypothesis_elevated():
    clinical_hypotheses = {"hypotheses": [_hypothesis("iron_status", calibrated_confidence="high")]}

    result = build_population_profile_overlays(profile_ids=[ATHLETE_RECOVERY], clinical_hypotheses=clinical_hypotheses)

    adjustment = result["profiles"][0]["priority_adjustments"][0]
    assert adjustment["profile_emphasis"] == "elevated"
    assert adjustment["domain"] == "iron_status"


def test_athlete_recovery_out_of_focus_domain_ignored():
    # cardiovascular is a longevity focus domain, not an athlete_recovery one.
    clinical_hypotheses = {"hypotheses": [_hypothesis("cardiovascular", calibrated_confidence="high")]}

    result = build_population_profile_overlays(profile_ids=[ATHLETE_RECOVERY], clinical_hypotheses=clinical_hypotheses)

    assert result["profiles"][0]["priority_adjustments"] == []


def test_athlete_recovery_low_confidence_not_elevated():
    clinical_hypotheses = {"hypotheses": [_hypothesis("liver", calibrated_confidence="low")]}

    result = build_population_profile_overlays(profile_ids=[ATHLETE_RECOVERY], clinical_hypotheses=clinical_hypotheses)

    adjustment = result["profiles"][0]["priority_adjustments"][0]
    assert adjustment["profile_emphasis"] == "standard"


def test_athlete_recovery_contradiction_downgrades_instead_of_elevating():
    clinical_hypotheses = {"hypotheses": [_hypothesis("liver", calibrated_confidence="high")]}
    clinical_contradictions = {"contradictions": [{"domain": "liver", "message": "Recent illness may confound this result."}]}

    result = build_population_profile_overlays(
        profile_ids=[ATHLETE_RECOVERY],
        clinical_hypotheses=clinical_hypotheses,
        clinical_contradictions=clinical_contradictions,
    )

    adjustment = result["profiles"][0]["priority_adjustments"][0]
    assert adjustment["profile_emphasis"] == "downgraded_due_to_contradiction"
    assert adjustment["contradiction_notes"] == ["Recent illness may confound this result."]


def test_athlete_recovery_evidence_debt_context_note_including_recovery_domain():
    evidence_debt = {
        "domain_debt": [
            {"domain": "iron_status", "debt_level": "blocked", "missing_markers": ["Ferritin"]},
            {"domain": "recovery", "debt_level": "high", "missing_markers": []},
            {"domain": "cardiovascular", "debt_level": "high", "missing_markers": ["LDL"]},  # out of focus
        ]
    }

    result = build_population_profile_overlays(profile_ids=[ATHLETE_RECOVERY], evidence_debt=evidence_debt)

    notes = result["profiles"][0]["context_notes"]
    domains_noted = {n["domain"] for n in notes}
    assert domains_noted == {"iron_status", "recovery"}


def test_athlete_recovery_velocity_worsening_note_for_focus_marker():
    velocity_signals = [
        {"domain": "liver", "marker": "alt", "status": "worsened_from_baseline", "confidence": "moderate"},
        {"domain": "cardiovascular", "marker": "ldl", "status": "worsened_from_baseline", "confidence": "moderate"},  # out of focus
    ]

    result = build_population_profile_overlays(profile_ids=[ATHLETE_RECOVERY], velocity_signals=velocity_signals)

    notes = result["profiles"][0]["velocity_notes"]
    assert len(notes) == 1
    assert notes[0]["domain"] == "liver"
    assert notes[0]["marker"] == "alt"


def test_athlete_recovery_recovery_domain_has_no_next_test_emphasis():
    """"recovery" has no lab markers of its own -- even if something ends
    up in next_test_funnel's panel under that key, it must never be
    emphasized as a next test (there is no lab test "for recovery")."""
    next_test_funnel = {"panel": {"recovery": [{"marker": "sleep_quality_survey", "priority": "medium"}]}}

    result = build_population_profile_overlays(profile_ids=[ATHLETE_RECOVERY], next_test_funnel=next_test_funnel)

    assert result["profiles"][0]["next_test_emphasis"] == []


def test_athlete_recovery_next_test_emphasis_marks_already_addressed_via_intervention():
    next_test_funnel = {"panel": {"iron_status": [{"marker": "ferritin", "priority": "high"}]}}
    intervention_memory = {"active_interventions": [{"type": "supplement", "label": "Iron supplement", "domains": ["iron_status"]}], "completed_interventions": []}

    result = build_population_profile_overlays(
        profile_ids=[ATHLETE_RECOVERY],
        next_test_funnel=next_test_funnel,
        intervention_memory=intervention_memory,
    )

    emphasis = result["profiles"][0]["next_test_emphasis"][0]
    assert emphasis["already_being_addressed"] is True


def test_athlete_recovery_next_test_emphasis_marks_already_addressed_via_outcome_attribution():
    next_test_funnel = {"panel": {"liver": [{"marker": "alt", "priority": "medium"}]}}
    outcome_attribution = {
        "attributions": [
            {
                "domain": "liver",
                "outcome_marker": "alt",
                "claim_strength": "possible_contributor",
                "possible_contributors": [{"event_id": "evt-1", "label": "Reduced alcohol intake"}],
            }
        ]
    }

    result = build_population_profile_overlays(
        profile_ids=[ATHLETE_RECOVERY],
        next_test_funnel=next_test_funnel,
        outcome_attribution=outcome_attribution,
    )

    emphasis = result["profiles"][0]["next_test_emphasis"][0]
    assert emphasis["already_being_addressed"] is True


def test_athlete_recovery_related_context_events_attached_for_matching_domain():
    clinical_hypotheses = {"hypotheses": [_hypothesis("liver", calibrated_confidence="high")]}
    intervention_memory = {
        "active_interventions": [{"type": "alcohol", "label": "Reduced alcohol intake", "domains": ["liver", "metabolic_health"]}],
        "completed_interventions": [],
    }

    result = build_population_profile_overlays(
        profile_ids=[ATHLETE_RECOVERY],
        clinical_hypotheses=clinical_hypotheses,
        intervention_memory=intervention_memory,
    )

    adjustment = result["profiles"][0]["priority_adjustments"][0]
    assert len(adjustment["related_context_events"]) == 1
    assert adjustment["related_context_events"][0]["label"] == "Reduced alcohol intake"
    assert adjustment["related_context_events"][0]["status"] == "active"


def test_athlete_recovery_practitioner_prompts_deduplicated_and_capped():
    clinical_hypotheses = {
        "hypotheses": [
            _hypothesis(domain, hypothesis_id=f"h-{domain}", label=f"{domain} pattern", calibrated_confidence="high")
            for domain in _ATHLETE_FOCUS_DOMAINS
        ]
    }
    evidence_debt = {
        "domain_debt": [{"domain": d, "debt_level": "high", "missing_markers": ["X"]} for d in _ATHLETE_FOCUS_DOMAINS]
    }

    result = build_population_profile_overlays(
        profile_ids=[ATHLETE_RECOVERY],
        clinical_hypotheses=clinical_hypotheses,
        evidence_debt=evidence_debt,
    )

    prompts = result["profiles"][0]["practitioner_prompts"]
    assert len(prompts) <= 8
    assert len(prompts) == len(set(prompts))


def test_athlete_recovery_forbidden_wording_absent():
    clinical_hypotheses = {"hypotheses": [_hypothesis("iron_status", calibrated_confidence="high")]}
    clinical_contradictions = {"contradictions": [{"domain": "iron_status", "message": "Recent illness may confound this."}]}
    evidence_debt = {"domain_debt": [{"domain": "recovery", "debt_level": "blocked", "missing_markers": []}]}
    velocity_signals = [{"domain": "liver", "marker": "alt", "status": "worsened_from_baseline", "confidence": "low"}]
    intervention_memory = {"active_interventions": [{"type": "training", "label": "Increased training load", "domains": ["recovery"]}], "completed_interventions": []}

    result = build_population_profile_overlays(
        profile_ids=[ATHLETE_RECOVERY],
        clinical_hypotheses=clinical_hypotheses,
        clinical_contradictions=clinical_contradictions,
        evidence_debt=evidence_debt,
        velocity_signals=velocity_signals,
        intervention_memory=intervention_memory,
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


def test_athlete_recovery_malformed_input_does_not_crash():
    result = build_population_profile_overlays(
        profile_ids=[ATHLETE_RECOVERY],
        clinical_hypotheses={"hypotheses": ["bad", None, 42, {}]},
        clinical_contradictions={"contradictions": "bad"},
        velocity_signals=["bad", None],
        intervention_memory={"active_interventions": None, "completed_interventions": "bad"},
        outcome_attribution={"attributions": "bad"},
        evidence_debt={"domain_debt": ["bad", None, {}]},
        next_test_funnel={"panel": "bad"},
    )

    assert result["profiles"][0]["priority_adjustments"] == []


def test_athlete_recovery_does_not_mutate_source_inputs():
    hypothesis = _hypothesis("iron_status", calibrated_confidence="high")
    clinical_hypotheses = {"hypotheses": [hypothesis]}
    debt_entry = {"domain": "recovery", "debt_level": "high", "missing_markers": []}
    evidence_debt = {"domain_debt": [debt_entry]}

    build_population_profile_overlays(
        profile_ids=[ATHLETE_RECOVERY], clinical_hypotheses=clinical_hypotheses, evidence_debt=evidence_debt,
    )

    assert hypothesis == _hypothesis("iron_status", calibrated_confidence="high")
    assert debt_entry == {"domain": "recovery", "debt_level": "high", "missing_markers": []}


def test_both_profiles_active_together_stay_isolated_per_profile():
    """A hypothesis in a domain shared by both profiles (metabolic_health)
    must be evaluated independently in each profile's own
    priority_adjustments -- one profile's list must never leak into or
    affect the other's."""
    clinical_hypotheses = {
        "hypotheses": [
            _hypothesis("metabolic_health", hypothesis_id="shared", label="Metabolic pattern", calibrated_confidence="high"),
            _hypothesis("iron_status", hypothesis_id="athlete-only", label="Iron pattern", calibrated_confidence="high"),
            _hypothesis("cardiovascular", hypothesis_id="longevity-only", label="Cardio pattern", calibrated_confidence="high"),
        ]
    }

    result = build_population_profile_overlays(
        profile_ids=[LONGEVITY_METABOLIC_OPTIMIZATION, ATHLETE_RECOVERY],
        clinical_hypotheses=clinical_hypotheses,
    )

    assert result["active_profile_ids"] == [LONGEVITY_METABOLIC_OPTIMIZATION, ATHLETE_RECOVERY]
    longevity_profile = next(p for p in result["profiles"] if p["profile_id"] == LONGEVITY_METABOLIC_OPTIMIZATION)
    athlete_profile = next(p for p in result["profiles"] if p["profile_id"] == ATHLETE_RECOVERY)

    longevity_ids = {a["hypothesis_id"] for a in longevity_profile["priority_adjustments"]}
    athlete_ids = {a["hypothesis_id"] for a in athlete_profile["priority_adjustments"]}

    assert longevity_ids == {"shared", "longevity-only"}
    assert athlete_ids == {"shared", "athlete-only"}
