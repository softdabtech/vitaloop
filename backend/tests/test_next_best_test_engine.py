"""Coverage for next_best_test_engine.py.

2026-09-12 clinical analyzer audit, "not implemented yet" item #3.
"""

from app.services.next_best_test_engine import build_next_best_tests


def test_high_priority_evidence_gap_ranked_first():
    evidence_gaps = {
        "gaps": [
            {"missing_marker": "ferritin", "domain": "iron_status", "priority": "medium", "reason": "domain_expected_marker", "suggested_next_step": "Add ferritin."},
            {"missing_marker": "ldl", "domain": "knowledge_coverage", "priority": "high", "reason": "no_active_rule_for_marker"},
        ]
    }
    result = build_next_best_tests(evidence_gaps=evidence_gaps)
    assert result["recommended_tests"][0]["marker"] == "ldl"
    assert result["summary"]["high_priority_count"] == 1


def test_pattern_retest_plan_included_and_deduped_against_evidence_gaps():
    evidence_gaps = {"gaps": [{"missing_marker": "hemoglobin", "domain": "iron_status", "priority": "medium", "reason": "domain_expected_marker"}]}
    patterns = [
        {
            "key": "iron_deficiency_anemia",
            "domain": "iron_status",
            "title": "Iron deficiency / anemia pattern",
            "priority": "medium",
            "retest_plan": [
                {"marker": "hemoglobin", "priority": "medium", "reason": "duplicate, should not double up"},
                {"marker": "transferrin saturation", "priority": "medium", "reason": "Follow-up."},
            ],
        }
    ]
    result = build_next_best_tests(evidence_gaps=evidence_gaps, patterns=patterns)
    markers = [item["marker"] for item in result["recommended_tests"]]
    assert markers.count("hemoglobin") == 1
    assert "transferrin saturation" in markers


def test_empty_inputs_produce_empty_result():
    result = build_next_best_tests()
    assert result["recommended_tests"] == []
    assert result["summary"]["count"] == 0
