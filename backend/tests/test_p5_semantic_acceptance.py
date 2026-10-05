from copy import deepcopy

from app.services.semantic_acceptance import (
    SEMANTIC_ACCEPTANCE_VERSION,
    build_semantic_acceptance,
)


EVIDENCE_ID = "biomarker:ferritin:observed"


def _contracts():
    narrative = {
        "version": "grounded_ai_narrative_v1",
        "source": "llm_selection",
        "personalized_summary": [
            {
                "statement_id": "summary-1",
                "text": "Ferritin is 9 ng/mL and deserves attention in this report.",
                "evidence_ids": [EVIDENCE_ID],
            }
        ],
        "key_connections": [],
        "symptom_lab_correlations": [],
        "ranked_explanations": [],
        "uncertainties": [],
        "next_actions": [
            {
                "statement_id": "action-1",
                "text": "Review the ferritin result with a qualified clinician.",
                "evidence_ids": [EVIDENCE_ID],
                "priority": "high",
                "timeframe": "this_week",
            }
        ],
        "clinician_questions": [],
        "retest_plan": [],
        "evidence_links": [
            {
                "evidence_id": EVIDENCE_ID,
                "type": "biomarker",
                "id": "ferritin",
                "label": "Ferritin",
                "availability": "observed",
                "value": 9,
                "unit": "ng/mL",
            }
        ],
        "grounding": {"fallback_used": False, "fallback_reason": None},
    }
    synthesis = {
        "version": "case_synthesis_v1",
        "main_conclusion": [],
        "what_was_found": [],
        "symptom_connections": [],
        "actions_now": [],
        "clinician_discussion": [],
        "missing_information": [],
    }
    return synthesis, narrative


def _evaluate(**overrides):
    synthesis, narrative = _contracts()
    inputs = {
        "case_synthesis": synthesis,
        "grounded_ai_narrative": narrative,
        "symptom_analysis": {"status": "no_symptom_snapshot"},
        "action_plan_by_role": {"buckets": {"urgent": [], "doctor": [], "practitioner": [], "self": []}},
        "safety_result": {"status": "approved", "urgent_review_required": False, "safety_events": []},
    }
    inputs.update(overrides)
    return build_semantic_acceptance(**inputs)


def test_complete_report_passes_meaning_level_dod():
    result = _evaluate()

    assert result["version"] == SEMANTIC_ACCEPTANCE_VERSION
    assert result["status"] == "passed"
    assert result["passes_dod"] is True
    assert result["failures"] == []
    assert result["summary"] == {
        "criteria_total": 8,
        "passed": 5,
        "failed": 0,
        "not_applicable": 3,
    }


def test_generic_conclusion_fails_even_when_json_shape_is_valid():
    synthesis, narrative = _contracts()
    narrative["personalized_summary"][0]["text"] = "Your results suggest an area worth watching."

    result = _evaluate(case_synthesis=synthesis, grounded_ai_narrative=narrative)

    assert result["criteria"]["report_specific_conclusion"]["code"] == "generic_conclusion"
    assert result["passes_dod"] is False


def test_concrete_value_link_is_required_not_just_an_evidence_id():
    synthesis, narrative = _contracts()
    narrative["evidence_links"][0].pop("value")

    result = _evaluate(case_synthesis=synthesis, grounded_ai_narrative=narrative)

    assert result["criteria"]["concrete_value_links"]["code"] == "no_concrete_value_links"


def test_completed_symptom_check_must_change_priority_or_explanation():
    result = _evaluate(
        symptom_analysis={
            "status": "applied",
            "conclusion_change": {"changed": False},
        }
    )

    assert result["criteria"]["symptom_check_effect"]["code"] == "symptom_check_no_result_effect"


def test_unmapped_legacy_text_is_not_a_failed_clinical_symptom_check():
    result = _evaluate(
        symptom_analysis={
            "status": "no_mapped_concepts",
            "concepts": [
                {
                    "concept_id": "unmapped_symptom_example",
                    "mapping_status": "unmapped",
                    "choice": "present",
                }
            ],
            "conclusion_change": {"changed": False},
        }
    )

    criterion = result["criteria"]["symptom_check_effect"]
    assert criterion["status"] == "not_applicable"
    assert criterion["code"] == "no_clinical_symptom_evidence"
    assert result["passes_dod"] is True


def test_mapped_symptom_without_report_effect_still_fails():
    result = _evaluate(
        symptom_analysis={
            "status": "no_matching_hypotheses",
            "concepts": [
                {
                    "concept_id": "joint_pain",
                    "mapping_status": "mapped",
                    "choice": "present",
                }
            ],
            "conclusion_change": {"changed": False},
        }
    )

    criterion = result["criteria"]["symptom_check_effect"]
    assert criterion["status"] == "fail"
    assert criterion["code"] == "symptom_check_no_result_effect"
    assert result["passes_dod"] is False


def test_changed_symptom_check_passes_when_connection_is_evidence_linked():
    synthesis, narrative = _contracts()
    narrative["symptom_lab_correlations"] = [
        {
            "statement_id": "connection-1",
            "text": "Reported fatigue raises the priority of the ferritin finding.",
            "evidence_ids": [EVIDENCE_ID],
        }
    ]
    result = _evaluate(
        case_synthesis=synthesis,
        grounded_ai_narrative=narrative,
        symptom_analysis={"status": "applied", "conclusion_change": {"changed": True}},
    )

    assert result["criteria"]["symptom_check_effect"]["status"] == "pass"


def test_only_generic_wellness_advice_fails():
    synthesis, narrative = _contracts()
    narrative["next_actions"] = [
        {"text": "Stay hydrated and get enough sleep.", "evidence_ids": [EVIDENCE_ID], "priority": "medium"}
    ]

    result = _evaluate(case_synthesis=synthesis, grounded_ai_narrative=narrative)

    assert result["criteria"]["report_specific_actions"]["code"] == "generic_or_missing_actions"


def test_action_priority_requires_priority_timing_or_role_context():
    synthesis, narrative = _contracts()
    narrative["next_actions"][0].pop("priority")
    narrative["next_actions"][0].pop("timeframe")

    result = _evaluate(case_synthesis=synthesis, grounded_ai_narrative=narrative)

    assert result["criteria"]["action_priority_clarity"]["code"] == "action_priority_unclear"


def test_role_bucket_can_make_action_priority_clear():
    synthesis, narrative = _contracts()
    narrative["next_actions"][0].pop("priority")
    narrative["next_actions"][0].pop("timeframe")

    result = _evaluate(
        case_synthesis=synthesis,
        grounded_ai_narrative=narrative,
        action_plan_by_role={"buckets": {"doctor": [{"title": "Review ferritin"}]}},
    )

    assert result["criteria"]["action_priority_clarity"]["status"] == "pass"


def test_internal_engine_terms_fail_user_facing_language():
    synthesis, narrative = _contracts()
    narrative["key_connections"] = [
        {"text": "confidence_calibration selected this output.", "evidence_ids": [EVIDENCE_ID]}
    ]

    result = _evaluate(case_synthesis=synthesis, grounded_ai_narrative=narrative)

    criterion = result["criteria"]["user_facing_language"]
    assert criterion["code"] == "internal_module_language_exposed"
    assert "confidence_calibration" in criterion["evidence"]["terms"]


def test_deterministic_fallback_must_be_explicitly_marked_with_reason():
    synthesis, narrative = _contracts()
    narrative["source"] = "deterministic_fallback"
    narrative["grounding"] = {"fallback_used": True, "fallback_reason": "llm_not_configured"}

    result = _evaluate(case_synthesis=synthesis, grounded_ai_narrative=narrative)

    assert result["criteria"]["ai_fallback_disclosure"]["status"] == "pass"


def test_unmarked_deterministic_fallback_fails():
    synthesis, narrative = _contracts()
    narrative["source"] = "deterministic_fallback"
    narrative["grounding"] = {"fallback_used": False, "fallback_reason": None}

    result = _evaluate(case_synthesis=synthesis, grounded_ai_narrative=narrative)

    assert result["criteria"]["ai_fallback_disclosure"]["code"] == "ai_fallback_not_disclosed"


def test_safety_warning_without_specific_event_fails():
    result = _evaluate(
        safety_result={
            "status": "approved_with_warnings",
            "urgent_review_required": True,
            "prominent_user_warning": "Seek medical review.",
            "safety_events": [],
        }
    )

    assert result["criteria"]["safety_reason_specificity"]["code"] == "safety_reason_missing"


def test_safety_event_with_marker_and_reason_passes():
    result = _evaluate(
        safety_result={
            "status": "approved_with_warnings",
            "urgent_review_required": True,
            "prominent_user_warning": "Seek prompt medical review.",
            "safety_events": [
                {
                    "key": "critical_potassium",
                    "severity": "critical",
                    "message": "Very low potassium requires prompt medical review.",
                    "item": {"name": "Potassium", "value": 2.4, "unit": "mmol/L"},
                }
            ],
        }
    )

    assert result["criteria"]["safety_reason_specificity"]["status"] == "pass"


def test_builder_is_deterministic_and_does_not_mutate_inputs():
    synthesis, narrative = _contracts()
    original = deepcopy(narrative)

    first = _evaluate(case_synthesis=synthesis, grounded_ai_narrative=narrative)
    second = _evaluate(case_synthesis=synthesis, grounded_ai_narrative=narrative)

    assert first == second
    assert narrative == original
