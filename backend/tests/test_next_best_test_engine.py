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


def test_comma_joined_retest_marker_split_and_deduped_against_ids():
    """Regression (2026-09-16 QA follow-up): the thyroid pattern's retest_plan
    used a single comma-joined marker string ("TSH, free T4, free T3")
    instead of one entry per marker. Combined with evidence_gaps' individual
    snake_case ids (e.g. "free_t4"), this produced a near-duplicate,
    inconsistently-cased "What could reduce uncertainty" list on the Results
    page reasoning map (e.g. "free_t4, free_t3, tsh, free t4, free t3")."""
    evidence_gaps = {
        "gaps": [
            {"missing_marker": "free_t4", "domain": "thyroid", "priority": "high", "reason": "domain_expected_marker"},
        ]
    }
    patterns = [
        {
            "key": "thyroid_function_pattern",
            "domain": "thyroid",
            "title": "Thyroid function pattern",
            "priority": "medium",
            "retest_plan": [
                {"marker": "TSH, free T4, free T3", "priority": "medium", "reason": "Follow-up."},
            ],
        }
    ]

    result = build_next_best_tests(evidence_gaps=evidence_gaps, patterns=patterns)

    markers = [item["marker"] for item in result["recommended_tests"]]
    # free_t4 came from evidence_gaps first, so the joined "free t4" part
    # (same marker, different casing/spelling) must be dropped, not duplicated.
    assert markers.count("free_t4") == 1
    assert not any("," in m for m in markers), f"a comma-joined marker string leaked through: {markers}"
    assert "tsh" in markers
    assert "free t3" in markers
