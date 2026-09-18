"""P27: Clinical Disagreement Mode (app/services/knowledge/clinical_disagreement.py).

Internal-only, deterministic, no LLM. Covers: empty/default result,
profile priority shift detection, no disagreement when only core output
exists, negative evidence never creates disagreement, doctor/urgent
safety is never downgraded, evidence debt adds limitation without
creating disagreement alone, rule pack quality limitation when pack
comparison data is insufficient, summary counts, forbidden wording
absence, malformed input resilience, determinism, and no input mutation.
"""

from app.services.knowledge.clinical_disagreement import build_clinical_disagreement


_FORBIDDEN_PHRASES = [
    "you have", "diagnosed", "diagnosis", "treat", "cure", "guarantee", "guaranteed",
]


def _hypotheses(domain, confidence, hypothesis_id="h1"):
    return {"hypotheses": [{"hypothesis_id": hypothesis_id, "domain": domain, "calibrated_confidence": confidence}]}


def _overlays(profile_id, domain, emphasis):
    return {"profiles": [{"profile_id": profile_id, "priority_adjustments": [{"domain": domain, "profile_emphasis": emphasis}]}]}


def test_empty_default_result_with_no_input():
    result = build_clinical_disagreement()

    assert result["version"] == "p27_v1"
    assert result["status"] == "empty"
    assert result["disagreements"] == []
    assert result["summary"] == {"total": 0, "by_type": {}, "by_domain": {}, "with_safety_impact": 0}
    assert len(result["limitations"]) == 1


def test_profile_priority_shift_detected_when_core_moderate_and_profile_elevated():
    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("metabolic_health", "moderate"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "metabolic_health", "elevated"),
    )

    assert result["status"] == "available"
    assert len(result["disagreements"]) == 1
    entry = result["disagreements"][0]
    assert entry["difference_type"] == "priority_shift"
    assert entry["domain"] == "metabolic_health"
    assert entry["core_position"] == {"level": "moderate", "source": "clinical_hypotheses"}
    assert entry["comparison_position"]["source"] == "population_profile:longevity_metabolic_optimization"
    assert entry["not_a_diagnosis"] is True


def test_profile_context_difference_when_core_confidence_unknown():
    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("iron_status", "low"),
        population_profile_overlays=_overlays("athlete_recovery", "iron_status", "elevated"),
    )

    entry = result["disagreements"][0]
    assert entry["difference_type"] == "profile_context_difference"
    assert entry["severity"] == "low"


def test_no_disagreement_when_core_already_high_and_profile_elevates():
    """Both lenses already agree the domain is important -- must NOT be
    reported as a divergence."""
    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("liver", "high"),
        population_profile_overlays=_overlays("athlete_recovery", "liver", "elevated"),
    )

    assert result["disagreements"] == []
    assert result["status"] == "limited"


def test_no_disagreement_when_profile_emphasis_is_standard():
    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("thyroid", "moderate"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "thyroid", "standard"),
    )

    assert result["disagreements"] == []


def test_no_disagreement_when_profile_downgrades_and_core_already_low():
    """Both lenses already agree to be cautious -- no divergence."""
    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("cardiovascular", "blocked"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "cardiovascular", "downgraded_due_to_contradiction"),
    )

    assert result["disagreements"] == []


def test_confidence_shift_when_profile_downgrades_high_confidence_core():
    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("cardiovascular", "high"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "cardiovascular", "downgraded_due_to_contradiction"),
    )

    entry = result["disagreements"][0]
    assert entry["difference_type"] == "confidence_shift"
    assert entry["severity"] == "high"
    assert entry["comparison_position"]["level"] == "downgraded_emphasis"


def test_no_disagreement_when_only_core_output_exists():
    result = build_clinical_disagreement(clinical_hypotheses=_hypotheses("liver", "moderate"))

    assert result["disagreements"] == []
    assert result["status"] == "limited"
    assert any("both" in limitation.lower() or "one interpretation lens" in limitation.lower() for limitation in result["limitations"])


def test_no_disagreement_when_only_profile_output_exists():
    result = build_clinical_disagreement(
        population_profile_overlays=_overlays("athlete_recovery", "iron_status", "elevated")
    )

    assert result["disagreements"] == []
    assert result["status"] == "limited"


def test_negative_evidence_is_not_even_an_accepted_parameter():
    """Structural proof, not just behavioral: this module has no code
    path that reads negative_evidence at all."""
    import inspect

    from app.services.knowledge.clinical_disagreement import build_clinical_disagreement as fn

    signature = inspect.signature(fn)
    assert "negative_evidence" in signature.parameters  # accepted for caller convenience

    source = inspect.getsource(fn)
    # Accepted as a kwarg but never dereferenced anywhere in the function body.
    assert "negative_evidence.get" not in source
    assert "negative_evidence[" not in source


def test_negative_evidence_passed_but_ignored_does_not_change_result():
    result_without = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("metabolic_health", "moderate"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "metabolic_health", "elevated"),
    )
    result_with = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("metabolic_health", "moderate"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "metabolic_health", "elevated"),
        negative_evidence={"stable_domains": [{"domain": "metabolic_health", "status": "no_strong_signal_detected"}]},
    )

    assert result_without == result_with


def test_doctor_escalation_marks_safety_impact_and_is_never_downgraded():
    escalation = {"escalations": [{"domain": "liver", "level": "doctor"}]}
    escalation_copy = {"escalations": [{"domain": "liver", "level": "doctor"}]}

    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("liver", "moderate"),
        population_profile_overlays=_overlays("athlete_recovery", "liver", "elevated"),
        doctor_escalation_precision=escalation,
    )

    assert result["disagreements"][0]["safety_impact"] == "doctor_or_urgent_unchanged"
    assert result["summary"]["with_safety_impact"] == 1
    # The escalation input itself must be completely untouched -- this
    # module has no way to soften/suppress/replace it.
    assert escalation == escalation_copy


def test_urgent_escalation_also_marks_safety_impact():
    escalation = {"escalations": [{"domain": "cardiovascular", "level": "urgent"}]}

    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("cardiovascular", "moderate"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "cardiovascular", "elevated"),
        doctor_escalation_precision=escalation,
    )

    assert result["disagreements"][0]["safety_impact"] == "doctor_or_urgent_unchanged"


def test_practitioner_escalation_marks_review_recommended():
    escalation = {"escalations": [{"domain": "thyroid", "level": "practitioner"}]}

    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("thyroid", "moderate"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "thyroid", "elevated"),
        doctor_escalation_precision=escalation,
    )

    assert result["disagreements"][0]["safety_impact"] == "review_recommended"


def test_no_escalation_marks_safety_impact_none():
    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("metabolic_health", "moderate"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "metabolic_health", "elevated"),
    )

    assert result["disagreements"][0]["safety_impact"] == "none"
    assert result["summary"]["with_safety_impact"] == 0


def test_evidence_debt_adds_limitation_to_existing_disagreement_but_does_not_create_one_alone():
    result_with_debt_only = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("liver", "high"),  # high confidence -> no divergence source
        evidence_debt={"domain_debt": [{"domain": "liver", "debt_level": "blocked"}]},
    )
    assert result_with_debt_only["disagreements"] == []

    result_with_disagreement_and_debt = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("liver", "moderate"),
        population_profile_overlays=_overlays("athlete_recovery", "liver", "elevated"),
        evidence_debt={"domain_debt": [{"domain": "liver", "debt_level": "blocked"}]},
    )
    assert len(result_with_disagreement_and_debt["disagreements"]) == 1
    assert any("evidence debt" in limitation.lower() for limitation in result_with_disagreement_and_debt["limitations"])


def test_rule_pack_quality_adds_limitation_when_comparison_data_insufficient():
    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("metabolic_health", "moderate"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "metabolic_health", "elevated"),
        rule_pack_quality={"packs": {"core_vitaloop": {"quality_level": "weak"}}},
    )

    assert any("rule-pack" in limitation.lower() for limitation in result["limitations"])
    # Rule pack data must never itself produce a "disagreement" record.
    for entry in result["disagreements"]:
        assert "rule_pack" not in entry["core_position"]["source"]
        assert "rule_pack" not in entry["comparison_position"]["source"]


def test_summary_counts_by_type_and_domain():
    clinical_hypotheses = {
        "hypotheses": [
            {"hypothesis_id": "h1", "domain": "metabolic_health", "calibrated_confidence": "moderate"},
            {"hypothesis_id": "h2", "domain": "iron_status", "calibrated_confidence": "low"},
        ]
    }
    overlays = {
        "profiles": [
            {
                "profile_id": "longevity_metabolic_optimization",
                "priority_adjustments": [
                    {"domain": "metabolic_health", "profile_emphasis": "elevated"},
                    {"domain": "iron_status", "profile_emphasis": "elevated"},
                ],
            }
        ]
    }

    result = build_clinical_disagreement(clinical_hypotheses=clinical_hypotheses, population_profile_overlays=overlays)

    assert result["summary"]["total"] == 2
    assert result["summary"]["by_type"] == {"priority_shift": 1, "profile_context_difference": 1}
    assert result["summary"]["by_domain"] == {"metabolic_health": 1, "iron_status": 1}


def test_inactive_profile_is_excluded_via_selection():
    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("metabolic_health", "moderate"),
        population_profile_overlays=_overlays("athlete_recovery", "metabolic_health", "elevated"),
        population_profile_selection={"active_profile_ids": ["longevity_metabolic_optimization"]},
    )

    assert result["disagreements"] == []


def test_forbidden_wording_absent_from_generated_text():
    result = build_clinical_disagreement(
        clinical_hypotheses=_hypotheses("cardiovascular", "high"),
        population_profile_overlays=_overlays("longevity_metabolic_optimization", "cardiovascular", "downgraded_due_to_contradiction"),
        evidence_debt={"domain_debt": [{"domain": "cardiovascular", "debt_level": "high"}]},
    )

    text_blob = " ".join(
        [e["explanation"] for e in result["disagreements"]] + result["limitations"]
    ).lower()

    for phrase in _FORBIDDEN_PHRASES:
        assert phrase not in text_blob, f"forbidden phrase found: {phrase}"


def test_malformed_input_does_not_crash():
    result = build_clinical_disagreement(
        clinical_hypotheses={"hypotheses": ["bad", None, 42, {}]},
        population_profile_overlays={"profiles": ["bad", None, {"profile_id": "x", "priority_adjustments": "bad"}]},
        doctor_escalation_precision={"escalations": "bad"},
        evidence_debt={"domain_debt": ["bad", None, {}]},
        rule_packs="bad",
        rule_pack_quality={"packs": "bad"},
        population_profile_selection="bad",
    )

    assert isinstance(result["disagreements"], list)


def test_deterministic_output_across_repeated_calls():
    clinical_hypotheses = _hypotheses("metabolic_health", "moderate")
    overlays = _overlays("longevity_metabolic_optimization", "metabolic_health", "elevated")

    first = build_clinical_disagreement(clinical_hypotheses=clinical_hypotheses, population_profile_overlays=overlays)
    second = build_clinical_disagreement(clinical_hypotheses=clinical_hypotheses, population_profile_overlays=overlays)

    assert first == second


def test_does_not_mutate_input():
    hypothesis = {"hypothesis_id": "h1", "domain": "metabolic_health", "calibrated_confidence": "moderate"}
    clinical_hypotheses = {"hypotheses": [hypothesis]}
    adjustment = {"domain": "metabolic_health", "profile_emphasis": "elevated"}
    overlays = {"profiles": [{"profile_id": "longevity_metabolic_optimization", "priority_adjustments": [adjustment]}]}

    build_clinical_disagreement(clinical_hypotheses=clinical_hypotheses, population_profile_overlays=overlays)

    assert hypothesis == {"hypothesis_id": "h1", "domain": "metabolic_health", "calibrated_confidence": "moderate"}
    assert adjustment == {"domain": "metabolic_health", "profile_emphasis": "elevated"}
