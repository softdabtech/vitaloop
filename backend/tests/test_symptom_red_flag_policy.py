from app.services.symptom_red_flag_policy import RedFlagRule, evaluate_internal_red_flags
from app.services.symptom_safety_policy import SymptomSafetyLevel


def _evidence(*present_ids: str):
    return [
        {"vitaloop_concept_id": concept_id, "choice_id": "present"}
        for concept_id in present_ids
    ]


def test_only_clinically_approved_rules_can_affect_safety():
    draft = RedFlagRule(
        id="draft_emergency",
        required_present_ids={"signal_a"},
        safety_level="emergency",
        review_status="draft",
        evidence_reference="clinical-review-item-a",
    )
    decision = evaluate_internal_red_flags(_evidence("signal_a"), rules=[draft])
    assert decision.level == SymptomSafetyLevel.ROUTINE
    assert decision.interrupt is False
    assert decision.evaluated_approved_rule_count == 0


def test_approved_combination_rule_requires_every_exact_present_id():
    rule = RedFlagRule(
        id="approved_pair",
        required_present_ids={"signal_a", "signal_b"},
        safety_level="urgent_24h",
        review_status="approved",
        evidence_reference="clinical-review-item-b",
    )
    incomplete = evaluate_internal_red_flags(_evidence("signal_a"), rules=[rule])
    assert incomplete.level == SymptomSafetyLevel.ROUTINE

    matched = evaluate_internal_red_flags(_evidence("signal_a", "signal_b"), rules=[rule])
    assert matched.level == SymptomSafetyLevel.URGENT_24H
    assert matched.matched_rule_ids == ["approved_pair"]


def test_unknown_and_absent_answers_never_trigger_rule():
    rule = RedFlagRule(
        id="approved_single",
        required_present_ids={"signal_a"},
        safety_level="emergency",
        review_status="approved",
        evidence_reference="clinical-review-item-c",
    )
    decision = evaluate_internal_red_flags(
        [
            {"vitaloop_concept_id": "signal_a", "choice_id": "unknown"},
            {"vitaloop_concept_id": "signal_a", "choice_id": "absent"},
        ],
        rules=[rule],
    )
    assert decision.level == SymptomSafetyLevel.ROUTINE
    assert decision.interrupt is False


def test_most_conservative_approved_rule_wins_deterministically():
    rules = [
        RedFlagRule(
            id="review_rule",
            required_present_ids={"signal_a"},
            safety_level="clinician_review",
            review_status="approved",
            evidence_reference="clinical-review-item-d",
        ),
        RedFlagRule(
            id="emergency_rule",
            required_present_ids={"signal_a", "signal_b"},
            safety_level="emergency",
            review_status="approved",
            evidence_reference="clinical-review-item-e",
        ),
    ]
    decision = evaluate_internal_red_flags(_evidence("signal_a", "signal_b"), rules=rules)
    assert decision.level == SymptomSafetyLevel.EMERGENCY
    assert decision.interrupt is True
    assert decision.matched_rule_ids == ["emergency_rule", "review_rule"]
