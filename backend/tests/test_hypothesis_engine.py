"""P14: Clinical Hypothesis Engine (app/services/hypothesis_engine.py).

Tests deterministic ranking, missing-evidence handling, confidence
downgrade on contradictions, and the explicit empty state — no LLM
involved anywhere in this module.
"""

from app.services.hypothesis_engine import build_clinical_hypotheses
from app.services.report_interpretation import detect_patterns
from app.services.evidence_gaps import build_evidence_gaps
from app.services.next_best_test_engine import build_next_best_tests


def _iron_biomarkers():
    return [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 10.2, "unit": "g/dL", "status": "DEFICIENT"},
        {"name": "MCV", "canonical_name": "mcv", "value": 78, "unit": "fL", "status": "OPTIMAL"},
    ]


def _pattern(**overrides):
    base = {
        "pattern_id": "p1",
        "key": "p1",
        "pattern_name": "Test Pattern",
        "title": "Test Pattern",
        "domain": "iron_status",
        "confidence": 0.8,
        "priority": "medium",
        "triggered_biomarkers": ["ferritin"],
        "supportive_markers": [],
        "contradicting_markers": [],
        "missing_context": [],
        "severity": "moderate",
        "doctor_escalation": {"triggered": False, "reasons": []},
    }
    base.update(overrides)
    return base


def test_empty_state_when_no_patterns_detected():
    result = build_clinical_hypotheses([])

    assert result["hypotheses"] == []
    assert result["summary"]["count"] == 0
    assert result["empty_reason"] == "no_patterns_detected"


def test_empty_state_when_patterns_is_none():
    result = build_clinical_hypotheses(None)

    assert result["hypotheses"] == []
    assert result["empty_reason"] == "no_patterns_detected"


def test_ranking_orders_by_adjusted_confidence_descending():
    high = _pattern(pattern_id="high", confidence=0.9)
    low = _pattern(pattern_id="low", confidence=0.3)

    result = build_clinical_hypotheses([low, high])

    ids_in_order = [h["hypothesis_id"] for h in result["hypotheses"]]
    assert ids_in_order == ["high", "low"]
    assert result["hypotheses"][0]["rank"] == 1
    assert result["hypotheses"][1]["rank"] == 2
    assert result["summary"]["top_hypothesis_id"] == "high"


def test_contradicting_markers_downgrade_confidence_and_bucket():
    clean = _pattern(pattern_id="clean", confidence=0.9, contradicting_markers=[])
    contradicted = _pattern(
        pattern_id="contradicted",
        confidence=0.9,
        contradicting_markers=["crp_elevated", "tsat_normal", "extra_marker"],
    )

    result = build_clinical_hypotheses([clean, contradicted])
    by_id = {h["hypothesis_id"]: h for h in result["hypotheses"]}

    assert by_id["clean"]["confidence_score"] > by_id["contradicted"]["confidence_score"]
    assert by_id["clean"]["likelihood_bucket"] == "likely"
    # 3 contradictions * 0.08 = 0.24 penalty -> 0.66, but contradictions force
    # it out of "likely" regardless of the raw number, per
    # _likelihood_bucket's has_contradictions guard.
    assert by_id["contradicted"]["likelihood_bucket"] != "likely"
    assert by_id["contradicted"]["confidence_breakdown"]["contradiction_penalty"] > 0


def test_missing_context_and_evidence_gaps_reduce_confidence():
    biomarkers = _iron_biomarkers()
    patterns = detect_patterns(biomarkers, profile={}, locale="en")
    interpreted_report = {"patterns": patterns}
    gaps = build_evidence_gaps(biomarkers=biomarkers, interpreted_report=interpreted_report)
    tests = build_next_best_tests(evidence_gaps=gaps, patterns=patterns)

    result = build_clinical_hypotheses(patterns, evidence_gaps=gaps, next_best_tests=tests)

    iron_hypothesis = next(h for h in result["hypotheses"] if h["domain"] == "iron_status")
    assert iron_hypothesis["confidence_score"] <= iron_hypothesis["confidence_breakdown"]["base_confidence"]
    assert isinstance(iron_hypothesis["evidence_gaps"], list)
    assert isinstance(iron_hypothesis["what_would_confirm_or_rule_out"], list)
    assert isinstance(iron_hypothesis["reasoning_statement"], str) and iron_hypothesis["reasoning_statement"]


def test_confidence_floor_never_goes_below_minimum():
    pattern = _pattern(
        confidence=0.1,
        contradicting_markers=["a", "b", "c", "d", "e"],
        missing_context=["x", "y", "z", "w"],
    )

    result = build_clinical_hypotheses([pattern])

    assert result["hypotheses"][0]["confidence_score"] >= 0.05
    assert result["hypotheses"][0]["likelihood_bucket"] == "unlikely_but_flagged"


def test_summary_bucket_counts_match_hypotheses():
    patterns = [
        _pattern(pattern_id="a", confidence=0.9),
        _pattern(pattern_id="b", confidence=0.5, contradicting_markers=["x"]),
        _pattern(pattern_id="c", confidence=0.1),
    ]

    result = build_clinical_hypotheses(patterns)

    counts = result["summary"]
    total = counts["likely_count"] + counts["possible_count"] + counts["unlikely_but_flagged_count"]
    assert total == counts["count"] == 3


def test_deterministic_output_for_identical_input():
    patterns = [_pattern(pattern_id="a", confidence=0.7), _pattern(pattern_id="b", confidence=0.6)]

    result_1 = build_clinical_hypotheses(patterns)
    result_2 = build_clinical_hypotheses(patterns)

    assert result_1 == result_2


def test_non_dict_patterns_are_ignored_not_crashed_on():
    result = build_clinical_hypotheses([_pattern(pattern_id="ok"), "not_a_dict", None, 42])

    assert len(result["hypotheses"]) == 1
    assert result["hypotheses"][0]["hypothesis_id"] == "ok"
