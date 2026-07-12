from app.services.health_state_engine import evaluate_health_states


def test_evaluate_health_states_prioritizes_domains_from_biomarkers_and_symptoms():
    result = evaluate_health_states(
        biomarkers=[
            {
                "name": "Ferritin",
                "canonical_name": "canonical_ferritin",
                "value": 12,
                "unit": "ng/mL",
                "status": "DEFICIENT",
                "category": "minerals",
            },
            {
                "name": "Hemoglobin",
                "canonical_name": "canonical_hemoglobin",
                "value": 11.8,
                "unit": "g/dL",
                "status": "DEFICIENT",
                "category": "blood_count",
            },
            {
                "name": "Glucose",
                "canonical_name": "canonical_glucose",
                "value": 92,
                "unit": "mg/dL",
                "status": "OPTIMAL",
                "category": "metabolic",
            },
        ],
        symptoms=["fatigue", "brain fog"],
        health_context={"readiness": {"has_profile": True}},
        knowledge_report={"why_it_matters": [{"key": "rule_low_ferritin"}]},
    )

    assert result["version"] == "health_state_engine_v1"
    iron = next(item for item in result["states"] if item["domain"] == "iron_status")
    metabolic = next(item for item in result["states"] if item["domain"] == "metabolic_health")

    assert iron["score"] < metabolic["score"]
    assert iron["risk_level"] == "needs_attention"
    assert iron["confidence"] == "high"
    assert iron["symptom_signals"] == ["fatigue"]
    assert result["top_priorities"][0]["domain"] == "iron_status"
    assert result["context_readiness"]["has_profile"] is True
    assert result["knowledge_rule_count"] == 1


def test_evaluate_health_states_marks_unknown_when_no_domain_signal():
    result = evaluate_health_states(
        biomarkers=[],
        symptoms=[],
        health_context={},
        knowledge_report={},
    )

    assert all(item["risk_level"] == "unknown" for item in result["states"])
    assert result["top_priorities"] == []
