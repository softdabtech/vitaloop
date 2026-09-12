"""Regression coverage for explainability/engine.py.

P2 fix (2026-09-12 clinical analyzer audit): build_recommendation_explanations()
used to attribute EVERY abnormal marker's explanation to matched_rules[0] —
whichever rule happened to fire first in the whole evaluation — regardless of
whether that rule had anything to do with the marker being explained. Same
bug for recommendation_explanations' triggered_biomarker, which always used
marker_explanations[0]. With more than one matched rule for different
markers, most explanations pointed at the wrong evidence.
"""

from app.services.explainability.engine import build_recommendation_explanations


def test_each_marker_is_explained_by_the_rule_that_actually_evaluates_it():
    biomarkers = [
        {"name": "LDL", "canonical_name": "ldl", "value": 210, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "TSH", "canonical_name": "tsh", "value": 8.5, "unit": "mIU/L", "status": "ELEVATED"},
    ]
    knowledge_evaluation = {
        "matched_rules": [
            {
                "rule_key": "rule_high_ldl",
                "confidence": 0.9,
                "source": "guideline_a",
                "input_entities": ["ldl"],
                "recommendation_keys": ["rec_lipid_review"],
            },
            {
                "rule_key": "rule_high_tsh",
                "confidence": 0.7,
                "source": "guideline_b",
                "input_entities": ["tsh"],
                "recommendation_keys": ["rec_thyroid_review"],
            },
        ],
        "generated_recommendations": [
            {"key": "rec_lipid_review", "evidence_level": "clinical_context"},
            {"key": "rec_thyroid_review", "evidence_level": "clinical_context"},
        ],
    }

    result = build_recommendation_explanations(
        biomarkers=biomarkers,
        symptoms=[],
        profile={"age": 40, "sex": "female", "height_cm": 165, "weight_kg": 60},
        knowledge_evaluation=knowledge_evaluation,
    )

    by_name = {item["triggered_biomarker"]["name"]: item for item in result["marker_explanations"]}
    assert by_name["LDL"]["matched_rule_key"] == "rule_high_ldl"
    assert by_name["LDL"]["confidence"] == 0.9
    assert by_name["TSH"]["matched_rule_key"] == "rule_high_tsh"
    assert by_name["TSH"]["confidence"] == 0.7

    recs_by_key = {item["recommendation_key"]: item for item in result["recommendation_explanations"]}
    assert recs_by_key["rec_lipid_review"]["matched_rule_key"] == "rule_high_ldl"
    assert recs_by_key["rec_lipid_review"]["triggered_biomarker"]["name"] == "LDL"
    assert recs_by_key["rec_thyroid_review"]["matched_rule_key"] == "rule_high_tsh"
    assert recs_by_key["rec_thyroid_review"]["triggered_biomarker"]["name"] == "TSH"


def test_marker_with_no_matching_rule_gets_no_rule_attribution():
    biomarkers = [
        {"name": "Zinc", "canonical_name": "zinc", "value": 50, "unit": "umol/L", "status": "ELEVATED"},
    ]
    knowledge_evaluation = {
        "matched_rules": [
            {"rule_key": "rule_high_ldl", "confidence": 0.9, "input_entities": ["ldl"], "recommendation_keys": []},
        ],
    }

    result = build_recommendation_explanations(
        biomarkers=biomarkers,
        knowledge_evaluation=knowledge_evaluation,
    )

    explanation = result["marker_explanations"][0]
    assert explanation["matched_rule_key"] is None
    assert explanation["confidence"] is None
