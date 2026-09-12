"""Coverage for clinical_priority_planner.py.

2026-09-12 clinical analyzer audit, "not implemented yet" items #2 (clinical
priority planner) and #6 (cohesive clinical_story object).
"""

from app.services.clinical_priority_planner import build_clinical_priority_planner, build_clinical_story


HIGH_PATTERN = {
    "key": "electrolyte_kidney_safety",
    "domain": "kidney",
    "title": "Electrolyte / kidney safety pattern",
    "summary": "Needs prompt review.",
    "priority": "high",
    "confidence": 0.7,
}
MEDIUM_PATTERN = {
    "key": "iron_deficiency_anemia",
    "domain": "iron_status",
    "title": "Iron deficiency / anemia pattern",
    "summary": "Context signal.",
    "priority": "medium",
    "confidence": 0.65,
}


def test_high_priority_pattern_goes_to_urgent_review():
    planner = build_clinical_priority_planner(patterns=[HIGH_PATTERN, MEDIUM_PATTERN])
    urgent_keys = {item["key"] for item in planner["buckets"]["urgent_review"]}
    review_keys = {item["key"] for item in planner["buckets"]["review_soon"]}
    assert "electrolyte_kidney_safety" in urgent_keys
    assert "iron_deficiency_anemia" in review_keys
    assert planner["summary"]["urgent_review_count"] == 1
    assert planner["summary"]["review_soon_count"] == 1


def test_safety_engine_urgent_flag_populates_urgent_review_even_without_high_pattern():
    planner = build_clinical_priority_planner(
        patterns=[MEDIUM_PATTERN],
        safety_result={"risk_level": "urgent_review", "status": "approved_with_warnings"},
    )
    assert planner["summary"]["urgent_review_count"] == 1
    assert planner["buckets"]["urgent_review"][0]["key"] == "safety_engine_flag"


def test_health_states_bucketed_by_risk_level():
    planner = build_clinical_priority_planner(
        health_states={
            "states": [
                {"domain": "thyroid", "risk_level": "high_attention", "label": "Thyroid"},
                {"domain": "liver", "risk_level": "stable", "label": "Liver"},
            ]
        }
    )
    assert planner["buckets"]["review_soon"][0]["domain"] == "thyroid"
    assert planner["buckets"]["monitor_only"][0]["domain"] == "liver"


def test_high_priority_evidence_gaps_become_lifestyle_opportunities():
    planner = build_clinical_priority_planner(
        evidence_gaps={"gaps": [{"missing_marker": "ldl", "domain": "knowledge_coverage", "priority": "high", "reason": "no_active_rule_for_marker"}]}
    )
    assert planner["buckets"]["lifestyle_opportunities"][0]["title"] == "ldl"


def test_symptom_drivers_bucket_is_present_but_empty():
    """Documented deferred scope — no symptom-to-marker linking exists yet."""
    planner = build_clinical_priority_planner()
    assert planner["buckets"]["symptom_drivers"] == []
    assert planner["summary"]["symptom_driver_count"] == 0


def test_clinical_story_composes_all_pieces():
    interpreted_report = {
        "summary": {"headline": "Needs prompt review", "body": "...", "disclaimer": "Educational only."},
        "patterns": [HIGH_PATTERN, MEDIUM_PATTERN],
    }
    safety_result = {"status": "approved_with_warnings", "risk_level": "urgent_review", "urgent_review_required": True}
    evidence_gaps = {"summary": {"gap_count": 3, "high_priority_count": 1, "domains": ["knowledge_coverage"]}}
    planner = build_clinical_priority_planner(
        patterns=interpreted_report["patterns"], safety_result=safety_result, evidence_gaps=evidence_gaps
    )

    story = build_clinical_story(
        interpreted_report=interpreted_report,
        safety_result=safety_result,
        priority_planner=planner,
        evidence_gaps=evidence_gaps,
        retest_suggestions=[{"marker": "Potassium", "timing": "promptly"}],
    )

    assert story["headline"] == "Needs prompt review"
    assert story["top_patterns"][0]["key"] == "electrolyte_kidney_safety"
    assert story["safety_constraints"]["requires_doctor"] is True
    assert story["prioritized_actions"]["urgent_review"][0]["key"] == "electrolyte_kidney_safety"
    assert story["retest_plan"] == [{"marker": "Potassium", "timing": "promptly"}]
    assert story["uncertainty"]["gap_count"] == 3
    assert story["uncertainty"]["high_priority_gap_count"] == 1
    assert story["disclaimer"] == "Educational only."


def test_clinical_story_reads_doctor_discussion_required_not_requires_doctor():
    """P1 fix (Codex recheck, 2026-09-12): safety_engine.py's real field is
    doctor_discussion_required — requires_doctor does not exist on
    safety_result's actual shape. This reproduces the exact real-world shape
    (doctor_discussion_required=True, urgent_review_required=False) that
    previously fell through to False, silently understating the need for
    clinician discussion even though the safety engine had already flagged
    it.
    """
    safety_result = {
        "status": "approved_with_warnings",
        "risk_level": "medical_review",
        "urgent_review_required": False,
        "doctor_discussion_required": True,
    }
    story = build_clinical_story(
        interpreted_report={"summary": {}, "patterns": []},
        safety_result=safety_result,
        priority_planner=build_clinical_priority_planner(safety_result=safety_result),
    )
    assert story["safety_constraints"]["requires_doctor"] is True
