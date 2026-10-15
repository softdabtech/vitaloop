from app.services.knowledge.report import build_knowledge_report
from app.services.clinical_engine.normalizer import normalize_biomarkers


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


def test_build_knowledge_report_supports_ukrainian_locale():
    biomarkers = [
        {"name": "Феритин", "value": 12, "unit": "ng/mL", "status": "DEFICIENT", "category": "minerals", "ref_low": 30, "ref_high": 150},
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
            }
        ],
        "generated_recommendations": [
            {
                "key": "iron_followup_discussion",
                "title": "Discuss iron status follow-up",
                "body": "Discuss ferritin and iron panel follow-up with a qualified clinician.",
                "priority": "high",
                "requires_doctor": False,
                "evidence_level": "moderate",
            }
        ],
        "requires_doctor": False,
        "confidence": 0.71,
        "safety_alerts": [],
        "source_references": [],
    }

    report = build_knowledge_report(biomarkers=biomarkers, knowledge_evaluation=evaluation, locale="uk")

    assert report["locale"] == "uk"
    assert "Знайдено 2 показників" in report["summary"]["headline"]
    assert "освітній" in report["summary"]["disclaimer"]
    assert report["why_it_matters"][0]["title"] == "Низький феритин на фоні втоми"
    assert report["action_plan"][0]["title"] == "Обговоріть подальшу перевірку статусу заліза"
    assert report["doctor_discussion"][0].startswith("Обговоріть")
    assert report["retest_plan"][0]["marker"] == "Феритин"


def test_normalizer_requires_valid_support_for_optimal_and_preserves_one_sided_limits():
    cases = [
        ({"ref_low": 1, "ref_high": 10, "status": "OPTIMAL"}, "OPTIMAL"),
        ({"ref_low": 0, "ref_high": 10, "status": "OPTIMAL"}, "OPTIMAL"),
        ({"status": "OPTIMAL"}, "UNKNOWN"),
        ({"ref_low": "invalid", "ref_high": 10, "status": "OPTIMAL"}, "UNKNOWN"),
        ({"ref_low": "NaN", "ref_high": 10, "status": "OPTIMAL"}, "UNKNOWN"),
        ({"ref_low": 10, "ref_high": 1, "status": "OPTIMAL"}, "UNKNOWN"),
        ({"ref_low": 5, "status": "OPTIMAL", "value": 4}, "DEFICIENT"),
        ({"ref_low": 5, "status": "OPTIMAL", "value": 6}, "UNKNOWN"),
        ({"ref_high": 5, "status": "OPTIMAL", "value": 6}, "ELEVATED"),
        ({"ref_high": 5, "status": "OPTIMAL", "value": 4}, "UNKNOWN"),
        ({"ref_low": 1, "ref_high": 10, "status": "UNKNOWN"}, "UNKNOWN"),
        ({"ref_low": 1, "ref_high": 10, "status": "UNEVALUATED"}, "UNEVALUATED"),
        ({"ref_low": 1, "ref_high": 10, "status": "BORDERLINE"}, "BORDERLINE"),
    ]

    for index, (reference, expected_status) in enumerate(cases):
        result = normalize_biomarkers(
            [{
                "name": f"Unlisted analyte {index}",
                "value": reference.get("value", 5),
                "unit": "mg/L",
                **reference,
            }]
        )
        assert result[0]["status"] == expected_status


def test_report_counts_incomplete_reference_snapshots_as_unknown_not_in_range():
    biomarkers = [
        {"name": "Complete", "value": 5, "status": "OPTIMAL", "ref_low": 1, "ref_high": 10},
        {"name": "Missing", "value": 5, "status": "OPTIMAL"},
        {"name": "Invalid", "value": 5, "status": "OPTIMAL", "ref_low": "bad", "ref_high": 10},
        {"name": "One-sided", "value": 5, "status": "OPTIMAL", "ref_low": 1},
        {"name": "One-sided elevated", "value": 12, "status": "ELEVATED", "ref_high": 10},
        {"name": "Unknown", "value": 5, "status": "UNKNOWN", "ref_low": 1, "ref_high": 10},
        {"name": "Unevaluated", "value": 5, "status": "UNEVALUATED", "ref_low": 1, "ref_high": 10},
        {"name": "Borderline", "value": 5, "status": "BORDERLINE", "ref_low": 1, "ref_high": 10},
    ]

    report = build_knowledge_report(biomarkers=biomarkers, knowledge_evaluation={})

    assert report["what_was_found"]["counts"] == {
        "total": 8,
        "optimal": 1,
        "borderline": 1,
        "deficient": 0,
        "elevated": 1,
        "unknown": 5,
    }
