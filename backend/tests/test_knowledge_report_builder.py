from app.services.knowledge.report import build_knowledge_report


def test_build_knowledge_report_creates_user_facing_sections():
    biomarkers = [
        {"name": "Ferritin", "value": 12, "unit": "ng/mL", "status": "DEFICIENT", "category": "minerals", "ref_low": 30, "ref_high": 150},
        {"name": "Vitamin D", "value": 24, "unit": "ng/mL", "status": "DEFICIENT", "category": "vitamins", "ref_low": 30, "ref_high": 100},
        {"name": "ALT", "value": 22, "unit": "U/L", "status": "OPTIMAL", "category": "liver", "ref_low": 7, "ref_high": 56},
    ]
    evaluation = {
        "matched_rules": [
            {
                "rule_key": "rule_low_ferritin_fatigue",
                "name": "Low ferritin with fatigue",
                "summary": "Low ferritin pattern",
                "risk": "possible iron status issue",
                "explanation": "Ferritin at 12 ng/mL may contribute to fatigue and should be reviewed.",
                "severity": "moderate",
                "confidence": 0.72,
                "requires_doctor": False,
                "source": "clinical_guideline_placeholder",
                "source_url": "https://example.org/iron",
            }
        ],
        "generated_recommendations": [
            {
                "key": "iron_followup_discussion",
                "title": "Discuss iron status follow-up",
                "body": "Discuss ferritin and iron panel follow-up with a qualified clinician.",
                "category": "minerals",
                "priority": "high",
                "requires_doctor": False,
                "evidence_level": "moderate",
            }
        ],
        "requires_doctor": False,
        "confidence": 0.71,
        "safety_alerts": [],
        "source_references": [{"source": "clinical_guideline_placeholder", "source_url": "https://example.org/iron"}],
    }

    report = build_knowledge_report(biomarkers=biomarkers, knowledge_evaluation=evaluation)

    assert report["version"] == "knowledge_report_v1"
    assert report["summary"]["risk_level"] == "needs_attention"
    assert report["what_was_found"]["counts"]["total"] == 3
    assert report["what_was_found"]["counts"]["deficient"] == 2
    assert report["why_it_matters"][0]["title"] == "Low ferritin with fatigue"
    assert report["action_plan"][0]["key"] == "iron_followup_discussion"
    assert report["doctor_discussion"]
    assert report["retest_plan"][0]["marker"] == "Ferritin"
