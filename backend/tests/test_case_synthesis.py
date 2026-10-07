from copy import deepcopy

from app.services.case_synthesis import (
    CASE_SYNTHESIS_SECTIONS,
    _find_marker,
    _marker_index,
    build_case_synthesis,
)


BIOMARKERS = [
    {
        "name": "Ferritin",
        "canonical_name": "canonical_ferritin",
        "value": 10,
        "unit": "ng/mL",
        "status": "DEFICIENT",
    },
    {
        "name": "Hemoglobin",
        "canonical_name": "canonical_hemoglobin",
        "value": 11.1,
        "unit": "g/dL",
        "status": "LOW",
    },
    {
        "name": "CRP",
        "canonical_name": "canonical_crp",
        "value": 12,
        "unit": "mg/L",
        "status": "ELEVATED",
    },
]

IRON_PATTERN = {
    "pattern_id": "iron_deficiency_pattern",
    "pattern_name": "Iron deficiency pattern",
    "domain": "iron_status",
    "triggered_biomarkers": [BIOMARKERS[0], BIOMARKERS[1]],
    "supportive_markers": [],
    "normal_context": [],
    "symptom_signal": ["fatigue"],
    "next_best_steps": [
        {
            "key": "review_context",
            "timeframe": "this_week",
            "text": "Review the iron findings and symptom context together.",
            "priority": "high",
        }
    ],
    "doctor_questions": [
        "Could the ferritin and hemoglobin findings explain the reported fatigue?"
    ],
}


def _synthesis():
    return build_case_synthesis(
        biomarkers=BIOMARKERS,
        symptoms=["fatigue"],
        user_profile={"age": 42, "sex": "female"},
        interpreted_report={"patterns": [IRON_PATTERN]},
        clinical_hypotheses={
            "hypotheses": [
                {
                    "hypothesis_id": "iron_deficiency_pattern",
                    "label": "Iron deficiency pattern",
                    "rank": 1,
                    "likelihood_bucket": "likely",
                    "calibrated_confidence": "moderate",
                    "supporting_evidence": [BIOMARKERS[0], BIOMARKERS[1]],
                    "weakening_evidence": {"contradicting_markers": []},
                }
            ]
        },
        clinical_contradictions={
            "contradictions": [
                {
                    "rule_id": "ferritin_crp_masking",
                    "message": "Elevated CRP can limit interpretation of ferritin.",
                    "markers": ["ferritin", "crp"],
                }
            ]
        },
        evidence_gaps={
            "gaps": [
                {
                    "domain": "iron_status",
                    "missing_marker": "transferrin_saturation",
                    "priority": "high",
                    "suggested_next_step": "Add this marker to clarify circulating iron availability.",
                }
            ]
        },
        action_plan_by_role={
            "buckets": {
                "urgent": [],
                "doctor": [],
                "practitioner": [
                    {
                        "source_id": "iron_deficiency_pattern",
                        "title": "Review iron context",
                        "reason": "Review the linked iron findings with a clinician.",
                    }
                ],
                "self": [],
            }
        },
        retest_suggestions=[
            {
                "marker": "Ferritin",
                "timing": "8-12 weeks",
                "reason": "Track the response after the plan is reviewed.",
                "priority": "high",
            }
        ],
        next_best_tests={
            "recommended_tests": [
                {
                    "marker": "transferrin_saturation",
                    "priority": "high",
                    "reason": "This would reduce uncertainty in iron status.",
                }
            ]
        },
        safety_result={"status": "approved", "urgent_review_required": False},
        locale="en",
    )


def test_case_synthesis_has_all_nine_sections_and_two_to_four_main_conclusions():
    result = _synthesis()

    assert result["version"] == "case_synthesis_v1"
    assert result["status"] == "complete"
    assert set(CASE_SYNTHESIS_SECTIONS).issubset(result)
    assert 2 <= len(result["main_conclusion"]) <= 4


def test_every_case_synthesis_statement_has_allowed_concrete_evidence():
    result = _synthesis()

    statements = [
        item
        for section in CASE_SYNTHESIS_SECTIONS
        for item in result[section]
    ]
    assert statements
    assert result["grounding"]["statement_count"] == len(statements)
    assert result["grounding"]["ungrounded_statement_count"] == 0
    assert result["grounding"]["all_statements_grounded"] is True
    for item in statements:
        assert item["text"].strip()
        assert item["evidence"]
        assert {ref["type"] for ref in item["evidence"]} <= {
            "biomarker",
            "symptom",
            "profile",
        }
        assert all(ref.get("id") and ref.get("label") for ref in item["evidence"])


def test_case_synthesis_preserves_specific_values_symptom_links_limits_and_timing():
    result = _synthesis()

    ferritin_finding = next(
        item for item in result["what_was_found"]
        if item["evidence"][0]["id"] == "canonical_ferritin"
    )
    assert ferritin_finding["evidence"][0]["value"] == 10
    assert ferritin_finding["evidence"][0]["unit"] == "ng/mL"

    symptom_link = result["symptom_connections"][0]
    assert {ref["type"] for ref in symptom_link["evidence"]} == {"symptom", "biomarker"}
    assert any(ref["id"] == "fatigue" for ref in symptom_link["evidence"])

    explanation = result["likely_explanations"][0]
    assert explanation["confidence"] == "moderate"
    assert "rather than a diagnosis" in explanation["text"]

    limitation = result["contradictions_and_limits"][0]
    assert {ref["id"] for ref in limitation["evidence"]} == {
        "canonical_ferritin",
        "canonical_crp",
    }

    missing = result["missing_information"][0]
    assert missing["evidence"][0]["id"] == "transferrin_saturation"
    assert missing["evidence"][0]["availability"] == "missing"

    ferritin_retest = next(item for item in result["retest_plan"] if item["marker"] == "Ferritin")
    assert ferritin_retest["timing"] == "8-12 weeks"
    assert "8-12 weeks" in ferritin_retest["text"]


def test_case_synthesis_is_deterministic_and_does_not_mutate_inputs():
    biomarkers = deepcopy(BIOMARKERS)
    original = deepcopy(biomarkers)

    first = build_case_synthesis(biomarkers=biomarkers)
    second = build_case_synthesis(biomarkers=biomarkers)

    assert first == second
    assert biomarkers == original
    assert first["status"] == "complete"
    assert len(first["main_conclusion"]) == 2


def test_case_synthesis_does_not_fabricate_statements_without_evidence():
    result = build_case_synthesis(
        biomarkers=[],
        symptoms=[],
        user_profile={},
        interpreted_report={"patterns": [{"pattern_id": "unbacked", "pattern_name": "Unbacked"}]},
        clinical_hypotheses={
            "hypotheses": [
                {
                    "hypothesis_id": "unbacked",
                    "label": "Unbacked explanation",
                    "likelihood_bucket": "likely",
                }
            ]
        },
    )

    assert result["status"] == "insufficient_data"
    assert result["main_conclusion"] == []
    assert result["likely_explanations"] == []
    assert result["grounding"]["all_statements_grounded"] is True


def test_partial_marker_alias_is_rejected_when_multiple_markers_match():
    markers = [
        {"name": "Free T4", "canonical_name": "canonical_free_t4", "value": 1.0},
        {"name": "Total T4", "canonical_name": "canonical_total_t4", "value": 8.0},
    ]

    assert _find_marker("T4", _marker_index(markers)) is None


def test_partial_marker_alias_resolves_when_it_has_one_candidate():
    marker = {"name": "Free T4", "canonical_name": "canonical_free_t4", "value": 1.0}

    assert _find_marker("T4", _marker_index([marker])) is marker


def test_missing_evidence_is_also_exposed_as_a_conclusion_limit():
    result = build_case_synthesis(
        biomarkers=BIOMARKERS,
        clinical_contradictions={"contradictions": []},
        evidence_gaps={
            "gaps": [
                {
                    "domain": "iron_status",
                    "missing_marker": "transferrin_saturation",
                    "priority": "high",
                    "suggested_next_step": "Add this marker.",
                }
            ]
        },
    )

    limits = result["contradictions_and_limits"]
    assert len(limits) == 1
    assert limits[0]["kind"] == "evidence_limit"
    assert limits[0]["evidence"] == [
        {
            "type": "biomarker",
            "id": "transferrin_saturation",
            "label": "transferrin_saturation",
            "availability": "missing",
        }
    ]
