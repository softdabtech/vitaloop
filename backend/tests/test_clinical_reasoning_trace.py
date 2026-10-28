from app.services.clinical_reasoning_trace import (
    build_clinical_reasoning_trace,
    build_clinical_reasoning_traces,
)
from app.services.report_interpretation import detect_patterns
from app.services.evidence_gaps import build_evidence_gaps
from app.services.next_best_test_engine import build_next_best_tests


def _iron_biomarkers():
    return [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 10.2, "unit": "g/dL", "status": "DEFICIENT"},
        {"name": "MCV", "canonical_name": "mcv", "value": 78, "unit": "fL", "status": "OPTIMAL"},
    ]


def test_trace_assembles_core_fields_from_pattern():
    patterns = detect_patterns(_iron_biomarkers(), profile={}, locale="en")
    iron_pattern = next(p for p in patterns if p["key"] == "iron_deficiency_anemia")

    trace = build_clinical_reasoning_trace(iron_pattern)

    assert trace["pattern_id"] == "iron_deficiency_anemia"
    assert trace["pattern_name"] == iron_pattern["title"]
    assert trace["domain"] == "iron_status"
    assert trace["matched_biomarkers"] == iron_pattern["triggered_biomarkers"]
    assert trace["confidence"] == iron_pattern["confidence"]
    assert isinstance(trace["confidence_reason"], list)
    assert isinstance(trace["contradicting_markers"], list)
    assert isinstance(trace["evidence_gaps"], list)
    assert isinstance(trace["next_best_tests"], list)


def test_trace_links_evidence_gaps_and_next_best_tests_by_domain():
    biomarkers = _iron_biomarkers()
    patterns = detect_patterns(biomarkers, profile={}, locale="en")
    interpreted_report = {"patterns": patterns}
    gaps = build_evidence_gaps(biomarkers=biomarkers, interpreted_report=interpreted_report)
    tests = build_next_best_tests(evidence_gaps=gaps, patterns=patterns)

    iron_pattern = next(p for p in patterns if p["key"] == "iron_deficiency_anemia")
    trace = build_clinical_reasoning_trace(iron_pattern, evidence_gaps=gaps, next_best_tests=tests)

    # Every linked gap/test must actually belong to this pattern's domain —
    # this is the whole point of P1.0: no cross-domain leakage into a trace.
    assert all(gap["domain"] == "iron_status" for gap in trace["evidence_gaps"])
    assert all(test["domain"] == "iron_status" for test in trace["next_best_tests"])
    assert len(trace["evidence_gaps"]) > 0


def test_doctor_flag_true_when_safety_result_requires_doctor_discussion():
    patterns = detect_patterns(_iron_biomarkers(), profile={}, locale="en")
    iron_pattern = next(p for p in patterns if p["key"] == "iron_deficiency_anemia")
    safety_result = {"doctor_discussion_required": True}

    trace = build_clinical_reasoning_trace(iron_pattern, safety_result=safety_result)

    assert trace["doctor_flag"] is True


def test_doctor_flag_false_by_default():
    patterns = detect_patterns(_iron_biomarkers(), profile={}, locale="en")
    iron_pattern = next(p for p in patterns if p["key"] == "iron_deficiency_anemia")

    trace = build_clinical_reasoning_trace(iron_pattern)

    assert trace["doctor_flag"] is False


def test_build_clinical_reasoning_traces_returns_one_per_pattern_in_order():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 10.2, "unit": "g/dL", "status": "DEFICIENT"},
        {"name": "TSH", "canonical_name": "tsh", "value": 9.1, "unit": "mIU/L", "status": "ELEVATED"},
    ]
    patterns = detect_patterns(biomarkers, profile={}, locale="en")

    traces = build_clinical_reasoning_traces(patterns)

    assert len(traces) == len(patterns)
    assert [t["pattern_id"] for t in traces] == [p["key"] for p in patterns]


def test_trace_is_stable_across_a_frozen_replay_of_the_same_inputs():
    """A trace built once, then rebuilt from the exact same persisted
    pattern/evidence_gaps/next_best_tests/safety_result (as a frozen replay
    would pass in) must be identical — the assembler must not recompute or
    depend on anything outside its explicit inputs (e.g. current time,
    random ordering).
    """
    biomarkers = _iron_biomarkers()
    patterns = detect_patterns(biomarkers, profile={}, locale="en")
    gaps = build_evidence_gaps(biomarkers=biomarkers, interpreted_report={"patterns": patterns})
    tests = build_next_best_tests(evidence_gaps=gaps, patterns=patterns)
    safety_result = {"doctor_discussion_required": False, "risk_level": "routine"}

    first = build_clinical_reasoning_traces(
        patterns, evidence_gaps=gaps, next_best_tests=tests, safety_result=safety_result
    )
    second = build_clinical_reasoning_traces(
        patterns, evidence_gaps=gaps, next_best_tests=tests, safety_result=safety_result
    )

    assert first == second


def test_trace_handles_pattern_with_no_gaps_or_tests_gracefully():
    trace = build_clinical_reasoning_trace({"key": "generic_abnormal_markers_context_required", "domain": "general"})

    assert trace["evidence_gaps"] == []
    assert trace["next_best_tests"] == []
    assert trace["contradicting_markers"] == []
    assert trace["practitioner_explanation"] is None
