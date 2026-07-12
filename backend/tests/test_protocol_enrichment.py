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
    assert item["retest_markers"] == ["Vitamin D"]
    assert item["protocol_enrichment_version"] == "protocol_enrichment_v1"
