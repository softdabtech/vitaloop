from app.services.knowledge.evaluator import evaluate_input_with_rules


def _rule(
    key: str,
    conditions: dict,
    recommendation_key: str,
    *,
    confidence: float = 0.7,
    requires_doctor: bool = False,
) -> dict:
    return {
        "id": f"{key}-id",
        "key": key,
        "name": key,
        "description": "rule",
        "active": True,
        "conditions": conditions,
        "outputs": {
            "risk": f"risk_{key}",
            "summary": "possible risk",
            "recommendation_keys": [recommendation_key],
        },
        "confidence": confidence,
        "severity": "moderate",
        "requires_doctor": requires_doctor,
        "explanation_template": "{{ferritin_value}} {{ferritin_unit}}",
        "source": "placeholder_source",
        "source_url": "https://example.org/source",
    }


def test_low_ferritin_with_fatigue_matches_rule() -> None:
    rules = [
        _rule(
            "low_ferritin_fatigue",
            {
                "all": [
                    {"lab_marker": "ferritin", "operator": "lt", "value": 30, "unit": "ng/mL"},
                    {"symptom": "fatigue"},
                ]
            },
            "iron_followup_discussion",
        )
    ]
    input_data = {
        "lab_results": {
            "ferritin": {"value": 18, "unit": "ng/mL"},
            "vitamin_d": {"value": 21, "unit": "ng/mL"},
        },
        "symptoms": ["fatigue"],
    }

    result = evaluate_input_with_rules(input_data, rules)

    assert len(result["matched_rules"]) == 1
    assert result["recommendation_keys"] == ["iron_followup_discussion"]
    assert result["requires_doctor"] is False
    assert result["max_confidence"] == 0.7


def test_low_vitamin_d_matches_rule() -> None:
    rules = [
        _rule(
            "low_vitamin_d",
            {
                "all": [
                    {"lab_marker": "vitamin_d", "operator": "lt", "value": 30, "unit": "ng/mL"},
                ]
            },
            "vitamin_d_lifestyle_and_followup",
        )
    ]
    input_data = {
        "lab_results": {
            "vitamin_d": {"value": 21, "unit": "ng/mL"},
        },
        "symptoms": [],
    }

    result = evaluate_input_with_rules(input_data, rules)

    assert len(result["matched_rules"]) == 1
    assert result["recommendation_keys"] == ["vitamin_d_lifestyle_and_followup"]


def test_high_hba1c_requires_doctor() -> None:
    rules = [
        _rule(
            "high_hba1c",
            {
                "all": [
                    {"lab_marker": "hba1c", "operator": "gte", "value": 5.7, "unit": "%"},
                ]
            },
            "hba1c_medical_review",
            confidence=0.82,
            requires_doctor=True,
        )
    ]
    input_data = {
        "lab_results": {
            "hba1c": {"value": 6.2, "unit": "%"},
        },
        "symptoms": [],
    }

    result = evaluate_input_with_rules(input_data, rules)

    assert len(result["matched_rules"]) == 1
    assert result["requires_doctor"] is True
    assert result["max_confidence"] == 0.82


def test_high_alt_or_ast_any_condition() -> None:
    rules = [
        _rule(
            "high_alt_or_ast",
            {
                "any": [
                    {"lab_marker": "alt", "operator": "gt", "value": 55, "unit": "U/L"},
                    {"lab_marker": "ast", "operator": "gt", "value": 48, "unit": "U/L"},
                ]
            },
            "liver_enzyme_medical_review",
            requires_doctor=True,
        )
    ]
    input_data = {
        "lab_results": {
            "ast": {"value": 60, "unit": "U/L"},
        },
        "symptoms": [],
    }

    result = evaluate_input_with_rules(input_data, rules)

    assert len(result["matched_rules"]) == 1
    assert result["recommendation_keys"] == ["liver_enzyme_medical_review"]


def test_high_ldl_matches_and_preserves_sources() -> None:
    rules = [
        _rule(
            "high_ldl",
            {
                "all": [
                    {"lab_marker": "ldl", "operator": "gte", "value": 130, "unit": "mg/dL"},
                ]
            },
            "ldl_risk_reduction_plan",
        )
    ]
    input_data = {
        "lab_results": {
            "ldl": {"value": 150, "unit": "mg/dL"},
        },
        "symptoms": [],
    }

    result = evaluate_input_with_rules(input_data, rules)

    assert len(result["matched_rules"]) == 1
    assert result["source_references"] == [
        {
            "source": "placeholder_source",
            "source_url": "https://example.org/source",
        }
    ]


def test_glucose_unit_conversion_mmol_to_mgdl_matches_rule() -> None:
    rules = [
        _rule(
            "glucose_high_mgdl",
            {
                "all": [
                    {"lab_marker": "glucose", "operator": "gte", "value": 100, "unit": "mg/dL"},
                ]
            },
            "glucose_followup",
        )
    ]

    input_data = {
        "lab_results": {
            "glucose": {"value": 6.0, "unit": "mmol/L"},
        },
        "symptoms": [],
    }

    result = evaluate_input_with_rules(input_data, rules)

    assert len(result["matched_rules"]) == 1
    assert result["recommendation_keys"] == ["glucose_followup"]
