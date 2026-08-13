from app.services.knowledge.evaluator import evaluate_input_with_rules
from app.services.knowledge.nutrition_algorithms import build_nutrition_kb_context


def test_nutrition_context_detects_child_low_ferritin_without_supplement_dose():
    result = build_nutrition_kb_context(
        {
            "lab_results": {
                "ferritin": {"value": 12, "unit": "ng/mL", "source_name": "Ferritin", "status": "DEFICIENT"},
            },
            "context": {
                "person_avatar": {
                    "age_band": "under_18",
                    "sex": "male",
                }
            },
        }
    )

    assert result["version"] == "nutrition_algorithms_v1"
    assert result["person_group"] == "child_9_13"
    assert any(row["nutrient"] == "iron" and row["upper_limit"] == 40 for row in result["nutrient_requirements"])
    assert result["nutrition_signals"][0]["key"] == "low_ferritin_food_and_context"
    assert "CBC" in result["nutrition_signals"][0]["missing_context"]
    assert "beans" in result["nutrition_signals"][0]["food_sources"]
    rendered = str(result).lower()
    assert "ferrous sulfate" not in rendered
    assert "325 mg" not in rendered
    assert "tid" not in rendered


def test_nutrition_context_uses_top_level_profile_age_for_child_group():
    result = build_nutrition_kb_context(
        {
            "lab_results": {},
            "profile": {
                "age": 8,
                "sex": "male",
                "height_cm": 140,
                "weight_kg": 35,
            },
        }
    )

    assert result["person_group"] == "child_4_8"
    assert any(row["nutrient"] == "iron" and row["rda_or_ai"] == 10 for row in result["nutrient_requirements"])


def test_nutrition_context_detects_vitamin_d_and_adds_safe_recommendation():
    result = build_nutrition_kb_context(
        {
            "lab_results": {
                "vitamin_d": {"value": 42, "unit": "nmol/L", "source_name": "Vitamin D", "status": "DEFICIENT"},
            },
            "context": {
                "person_avatar": {
                    "age_band": "30_39",
                    "sex": "female",
                }
            },
        }
    )

    signal = result["nutrition_signals"][0]
    assert signal["key"] == "low_vitamin_d_food_and_followup"
    assert signal["priority"] == "high"
    assert "season/sun exposure" in signal["missing_context"]
    assert result["generated_recommendations"][0]["requires_doctor"] is True


def test_evaluator_merges_nutrition_context_with_rule_output():
    rule_result = evaluate_input_with_rules(
        {
            "lab_results": {
                "ferritin": {"value": 12, "unit": "ng/mL", "source_name": "Ferritin", "status": "DEFICIENT"},
            },
            "symptoms": [],
            "context": {"person_avatar": {"age_band": "under_18", "sex": "male"}},
        },
        [],
    )
    nutrition = build_nutrition_kb_context(
        {
            "lab_results": {
                "ferritin": {"value": 12, "unit": "ng/mL", "source_name": "Ferritin", "status": "DEFICIENT"},
            },
            "context": {"person_avatar": {"age_band": "under_18", "sex": "male"}},
        }
    )

    # Sync path should not require a Supabase recommendation row to produce nutrition context.
    assert rule_result["matched_rules"] == []
    assert rule_result["recommendation_keys"] == []
    assert nutrition["nutrition_signals"][0]["nutrient"] == "iron"
