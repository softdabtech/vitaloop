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


# ---------------------------------------------------------------------------
# Cohort coverage — regression tests for the 2026-09-03 audit finding: teens
# 14-18 fell into child_9_13's numbers, under-4s and pregnancy/lactation fell
# through to a generic adult default with no dedicated RDA/UL at all.
# ---------------------------------------------------------------------------


def test_teen_male_uses_teen_band_not_child_9_13():
    result = build_nutrition_kb_context({"lab_results": {}, "profile": {"age": 16, "sex": "male"}})
    assert result["person_group"] == "teen_male_14_18"
    iron_row = next(row for row in result["nutrient_requirements"] if row["nutrient"] == "iron")
    assert iron_row["rda_or_ai"] == 11


def test_teen_female_iron_rda_higher_than_teen_male():
    result = build_nutrition_kb_context({"lab_results": {}, "profile": {"age": 16, "sex": "female"}})
    assert result["person_group"] == "teen_female_14_18"
    iron_row = next(row for row in result["nutrient_requirements"] if row["nutrient"] == "iron")
    # Menstruation onset — this is exactly the gap that made lumping all
    # teens into one band (or child_9_13's numbers) the wrong call.
    assert iron_row["rda_or_ai"] == 15


def test_under_4_gets_referral_not_a_silent_adult_default():
    result = build_nutrition_kb_context({"lab_results": {}, "profile": {"age": 2, "sex": "female"}})
    assert result["person_group"] == "needs_pediatric_referral"
    assert result["referral_required"] is True
    assert result["nutrient_requirements"] == []


def test_pregnant_adult_gets_pregnancy_band():
    result = build_nutrition_kb_context(
        {"lab_results": {}, "profile": {"age": 28, "sex": "female", "pregnancy_status": "pregnant"}}
    )
    assert result["person_group"] == "pregnant"
    assert result["referral_required"] is False
    iron_row = next(row for row in result["nutrient_requirements"] if row["nutrient"] == "iron")
    assert iron_row["rda_or_ai"] == 27


def test_breastfeeding_adult_gets_breastfeeding_band():
    result = build_nutrition_kb_context(
        {"lab_results": {}, "profile": {"age": 30, "sex": "female", "pregnancy_status": "breastfeeding"}}
    )
    assert result["person_group"] == "breastfeeding"
    folate_row = next(row for row in result["nutrient_requirements"] if row["nutrient"] == "folate")
    assert folate_row["rda_or_ai"] == 500


def test_pregnant_early_teen_gets_specialist_referral_not_generic_pregnancy_numbers():
    result = build_nutrition_kb_context(
        {"lab_results": {}, "profile": {"age": 13, "sex": "female", "pregnancy_status": "pregnant"}}
    )
    assert result["person_group"] == "needs_specialist_referral"
    assert result["referral_required"] is True
    assert result["nutrient_requirements"] == []


def test_pregnancy_with_unknown_age_still_routes_to_pregnancy_band():
    # Deidentified context: no age available at all, only pregnancy status.
    result = build_nutrition_kb_context(
        {"lab_results": {}, "context": {"person_avatar": {"pregnancy_status": "pregnant", "sex": "female"}}}
    )
    assert result["person_group"] == "pregnant"
