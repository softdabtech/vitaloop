from app.services.protocol_enrichment import enrich_protocol


def test_enrich_protocol_adds_explainability_safety_and_retest_fields():
    enriched = enrich_protocol(
        {
            "supplements": [
                {
                    "supplement": "Vitamin D3",
                    "dosage": "Confirm dose with clinician",
                    "rationale": "Vitamin D is low.",
                    "requires_doctor": True,
                }
            ],
            "nutrition": [],
            "lifestyle": [],
            "training_recovery": [],
        },
        biomarkers=[
            {
                "name": "Vitamin D",
                "canonical_name": "canonical_vitamin_d",
                "value": 18,
                "unit": "ng/mL",
                "status": "DEFICIENT",
            }
        ],
        prioritized=[
            {
                "name": "Vitamin D",
                "canonical_name": "canonical_vitamin_d",
                "status": "DEFICIENT",
            }
        ],
        safety_result={
            "safety_events": [
                {"key": "current_medications_context", "severity": "medium"},
                {"key": "known_allergies_context", "severity": "medium"},
            ]
        },
        health_states={
            "top_priorities": [
                {
                    "domain": "micronutrients",
                    "score": 54,
                    "risk_level": "needs_attention",
                    "confidence": "medium",
                }
            ]
        },
        trend_analysis={
            "priority_changes": [
                {
                    "name": "Vitamin D",
                    "direction": "falling",
                    "percent_change": -20,
                    "interpretation": "watch_closely",
                }
            ]
        },
        retest_suggestions=[{"marker": "Vitamin D", "timeframe": "8-12 weeks"}],
    )

    item = enriched["supplements"][0]
    assert item["title"] == "Vitamin D3"
    assert item["body"] == "Vitamin D is low."
    assert item["priority"] == "medium"
    assert item["evidence_level"] == "clinical_context"
    assert item["based_on"]["biomarkers"][0]["canonical_name"] == "canonical_vitamin_d"
    assert item["based_on"]["health_domains"][0]["domain"] == "micronutrients"
    assert item["based_on"]["trend_changes"][0]["direction"] == "falling"
    assert any("medication interactions" in note for note in item["safety_notes"])
    assert any("allergies" in note for note in item["safety_notes"])
    assert item["expected_timeline"]
    assert "Vitamin D" in item["retest_markers"]
    assert item["knowledge_domain_registry_version"] == "knowledge_domain_registry_v1"
    assert item["knowledge_domain_context"][0]["domain"] == "micronutrients"
    assert item["protocol_enrichment_version"] == "protocol_enrichment_v1"


def test_enrich_protocol_localizes_core_v2_artifacts_for_ukrainian_locale():
    enriched = enrich_protocol(
        {
            "nutrition": [
                {
                    "title": "Balance iron intake",
                    "body": "Pair iron-rich meals with vitamin C.",
                    "requires_doctor": True,
                }
            ],
            "supplements": [],
            "lifestyle": [],
            "training_recovery": [],
        },
        biomarkers=[{"name": "Ferritin", "canonical_name": "canonical_ferritin", "status": "LOW"}],
        prioritized=[{"name": "Ferritin", "canonical_name": "canonical_ferritin", "status": "LOW"}],
        safety_result={
            "safety_events": [
                {"key": "current_medications_context", "severity": "medium"},
                {"key": "known_allergies_context", "severity": "medium"},
            ]
        },
        health_states={
            "top_priorities": [
                {
                    "domain": "iron_status",
                    "score": 72,
                    "risk_level": "needs_attention",
                    "confidence": "medium",
                }
            ]
        },
        trend_analysis={"priority_changes": []},
        retest_suggestions=[{"marker": "Ferritin", "timeframe": "8-12 weeks"}],
        locale="uk",
    )

    item = enriched["nutrition"][0]
    assert "Обговоріть" in item["safety_notes"][0]
    assert any("ліками" in note for note in item["safety_notes"])
    assert "2-4 тижні" in item["expected_timeline"]
    assert item["knowledge_domain_context"][0]["label"] == "Статус заліза"
    assert "Review safety first" not in item["expected_timeline"]
