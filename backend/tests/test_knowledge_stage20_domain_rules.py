from app.services.knowledge.evaluator import evaluate_input_with_rules


def _rule(key: str, conditions: dict, recommendation_keys: list[str], *, confidence=0.75, severity="moderate", requires_doctor=False):
    return {
        "id": f"{key}-id",
        "key": key,
        "name": key,
        "description": "stage20 rule",
        "active": True,
        "governance_status": "active",
        "input_entities": [],
        "conditions": conditions,
        "outputs": {
            "risk": f"risk_{key}",
            "summary": f"summary_{key}",
            "recommendation_keys": recommendation_keys,
        },
        "confidence": confidence,
        "severity": severity,
        "requires_doctor": requires_doctor,
        "explanation_template": f"{key} matched",
        "source": "placeholder_source",
        "source_url": "https://example.org/source",
    }


def test_stage20_very_low_ferritin_rule_requires_review():
    result = evaluate_input_with_rules(
        {
            "lab_results": {"ferritin": {"value": 12, "unit": "ng/mL"}},
            "symptoms": [],
        },
        [
            _rule(
                "rule_very_low_ferritin",
                {"all": [{"lab_marker": "ferritin", "operator": "lt", "value": 15, "unit": "ng/mL"}]},
                ["very_low_ferritin_medical_review", "iron_panel_context_review"],
                severity="high",
                requires_doctor=True,
            )
        ],
    )

    assert result["requires_doctor"] is True
    assert result["recommendation_keys"] == ["very_low_ferritin_medical_review", "iron_panel_context_review"]


def test_stage20_hba1c_glucose_combined_rule_matches():
    result = evaluate_input_with_rules(
        {
            "lab_results": {
                "hba1c": {"value": 5.8, "unit": "%"},
                "glucose": {"value": 6.2, "unit": "mmol/L"},
            },
            "symptoms": [],
        },
        [
            _rule(
                "rule_hba1c_glucose_combined",
                {
                    "all": [
                        {"lab_marker": "hba1c", "operator": "gte", "value": 5.7, "unit": "%"},
                        {"lab_marker": "glucose", "operator": "gte", "value": 100, "unit": "mg/dL"},
                    ]
                },
                ["glucose_regulation_followup", "hba1c_medical_review"],
                confidence=0.86,
                severity="high",
                requires_doctor=True,
            )
        ],
    )

    assert len(result["matched_rules"]) == 1
    assert result["max_confidence"] == 0.86


def test_stage20_triglyceride_hdl_combined_rule_matches_with_unit_conversion():
    result = evaluate_input_with_rules(
        {
            "lab_results": {
                "triglycerides": {"value": 2.0, "unit": "mmol/L"},
                "hdl": {"value": 0.9, "unit": "mmol/L"},
            },
            "symptoms": [],
        },
        [
            _rule(
                "rule_high_triglycerides_low_hdl",
                {
                    "all": [
                        {"lab_marker": "triglycerides", "operator": "gte", "value": 150, "unit": "mg/dL"},
                        {"lab_marker": "hdl", "operator": "lt", "value": 40, "unit": "mg/dL"},
                    ]
                },
                ["triglyceride_hdl_metabolic_review", "lipid_pattern_context_review"],
                severity="high",
                requires_doctor=True,
            )
        ],
    )

    assert len(result["matched_rules"]) == 1
    assert result["recommendation_keys"] == ["triglyceride_hdl_metabolic_review", "lipid_pattern_context_review"]


def test_stage20_alt_ast_combined_rule_matches():
    result = evaluate_input_with_rules(
        {
            "lab_results": {
                "alt": {"value": 75, "unit": "U/L"},
                "ast": {"value": 60, "unit": "U/L"},
            },
            "symptoms": [],
        },
        [
            _rule(
                "rule_alt_ast_both_elevated",
                {
                    "all": [
                        {"lab_marker": "alt", "operator": "gt", "value": 55, "unit": "U/L"},
                        {"lab_marker": "ast", "operator": "gt", "value": 48, "unit": "U/L"},
                    ]
                },
                ["liver_pattern_context_review", "liver_enzyme_medical_review"],
                severity="high",
                requires_doctor=True,
            )
        ],
    )

    assert len(result["matched_rules"]) == 1


def test_stage20_tsh_rule_accepts_miu_l_unit_alias():
    result = evaluate_input_with_rules(
        {
            "lab_results": {"tsh": {"value": 5.4, "unit": "mIU/L"}},
            "symptoms": [],
        },
        [
            _rule(
                "rule_high_tsh",
                {"all": [{"lab_marker": "tsh", "operator": "gte", "value": 4.5, "unit": "uIU/mL"}]},
                ["thyroid_axis_followup"],
                requires_doctor=True,
            )
        ],
    )

    assert len(result["matched_rules"]) == 1
    assert result["recommendation_keys"] == ["thyroid_axis_followup"]
