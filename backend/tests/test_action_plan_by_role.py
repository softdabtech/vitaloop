from app.services.action_plan_by_role import build_action_plan_by_role


def _trace(pattern_id, doctor_flag=False, safety_level="low_confidence", **extra):
    return {
        "pattern_id": pattern_id,
        "pattern_name": pattern_id.replace("_", " ").title(),
        "doctor_flag": doctor_flag,
        "safety_level": safety_level,
        "confidence": 0.6,
        "user_explanation": {"summary": f"Summary for {pattern_id}"},
        **extra,
    }


def test_urgent_bucket_requires_doctor_flag_and_high_confidence_urgent():
    traces = [_trace("electrolyte_kidney_safety", doctor_flag=True, safety_level="high_confidence_urgent")]
    result = build_action_plan_by_role(clinical_reasoning_traces=traces)

    assert len(result["buckets"]["urgent"]) == 1
    assert result["buckets"]["urgent"][0]["source_id"] == "electrolyte_kidney_safety"
    assert result["buckets"]["doctor"] == []


def test_doctor_bucket_for_doctor_flag_without_urgent_safety_level():
    traces = [_trace("thyroid_dysfunction", doctor_flag=True, safety_level="moderate_confidence")]
    result = build_action_plan_by_role(clinical_reasoning_traces=traces)

    assert len(result["buckets"]["doctor"]) == 1
    assert result["buckets"]["urgent"] == []


def test_doctor_bucket_for_safety_level_doctor_only_even_without_flag():
    traces = [_trace("iron_deficiency_anemia", doctor_flag=False, safety_level="doctor_only")]
    result = build_action_plan_by_role(clinical_reasoning_traces=traces)

    assert len(result["buckets"]["doctor"]) == 1


def test_practitioner_bucket_for_moderate_confidence_or_gaps():
    traces = [
        _trace("metabolic_risk", safety_level="moderate_confidence"),
        _trace("liver_stress", safety_level="low_confidence", evidence_gaps=[{"reason": "x"}]),
    ]
    result = build_action_plan_by_role(clinical_reasoning_traces=traces)

    assert len(result["buckets"]["practitioner"]) == 2


def test_self_bucket_for_low_confidence_pattern_with_no_gaps():
    traces = [_trace("micronutrient_deficiency_cluster", safety_level="low_confidence")]
    result = build_action_plan_by_role(clinical_reasoning_traces=traces)

    assert len(result["buckets"]["self"]) == 1


def test_protocol_actions_all_go_to_self_bucket():
    protocol = {
        "nutrition": [{"title": "Eat more iron-rich foods", "body": "Because ferritin is low."}],
        "supplements": [{"supplement": "Vitamin D", "rationale": "Low level detected."}],
    }
    result = build_action_plan_by_role(protocol=protocol)

    assert len(result["buckets"]["self"]) == 2
    titles = {item["title"] for item in result["buckets"]["self"]}
    assert titles == {"Eat more iron-rich foods", "Vitamin D"}


def test_next_best_tests_not_already_attached_to_a_pattern_go_to_practitioner():
    next_best_tests = {"recommended_tests": [{"marker": "ferritin", "reason": "Confirm iron status."}]}
    result = build_action_plan_by_role(next_best_tests=next_best_tests)

    assert len(result["buckets"]["practitioner"]) == 1
    assert result["buckets"]["practitioner"][0]["source"] == "next_best_tests"


def test_high_priority_evidence_gap_without_pattern_goes_to_practitioner():
    evidence_gaps = {"gaps": [{"missing_marker": "tsh", "priority": "high", "suggested_next_step": "Add TSH"}]}
    result = build_action_plan_by_role(evidence_gaps=evidence_gaps)

    assert len(result["buckets"]["practitioner"]) == 1
    assert result["buckets"]["practitioner"][0]["source"] == "evidence_gap"


def test_low_priority_evidence_gap_is_not_added():
    evidence_gaps = {"gaps": [{"missing_marker": "zinc", "priority": "medium"}]}
    result = build_action_plan_by_role(evidence_gaps=evidence_gaps)

    assert result["buckets"]["practitioner"] == []


def test_summary_counts_match_bucket_lengths():
    traces = [_trace("a", doctor_flag=True, safety_level="high_confidence_urgent"), _trace("b")]
    result = build_action_plan_by_role(clinical_reasoning_traces=traces)

    assert result["summary"]["urgent_count"] == 1
    assert result["summary"]["self_count"] == 1
    assert result["summary"]["doctor_count"] == 0
    assert result["summary"]["practitioner_count"] == 0
