from app.services.report_interpretation import build_interpreted_report
from app.services.knowledge.evaluator import evaluate_input_with_rules
from app.services.knowledge.integration import biomarkers_to_knowledge_lab_results


RETICULOCYTE_PANEL = [
    {
        "name": "Mean Reticulocyte Volume",
        "value": 91.9,
        "unit": "fl",
        "ref_low": 92.7,
        "ref_high": 112.1,
        "status": "DEFICIENT",
        "category": "blood_count",
    },
    {
        "name": "Mean Spherical Cell Volume",
        "value": 66.6,
        "unit": "fl",
        "ref_low": 72.8,
        "ref_high": 87.3,
        "status": "DEFICIENT",
        "category": "blood_count",
    },
    {
        "name": "Reticulocytes",
        "value": 1.22,
        "unit": "%",
        "ref_low": 0.5,
        "ref_high": 2.2,
        "status": "OPTIMAL",
        "category": "blood_count",
    },
    {
        "name": "Reticulocytes (T/l)",
        "value": 59.8,
        "unit": "T/l",
        "ref_low": 30,
        "ref_high": 105,
        "status": "OPTIMAL",
        "category": "blood_count",
    },
    {
        "name": "Immature Reticulocytes",
        "value": 0.34,
        "unit": "%",
        "ref_low": 0.2,
        "ref_high": 0.42,
        "status": "OPTIMAL",
        "category": "blood_count",
    },
    {
        "name": "Mature Reticulocytes",
        "value": 0.41,
        "unit": "%",
        "ref_low": 0.15,
        "ref_high": 0.73,
        "status": "OPTIMAL",
        "category": "blood_count",
    },
    {
        "name": "Reticulocyte Distribution Width",
        "value": 25.4,
        "unit": "%",
        "ref_low": 22.9,
        "ref_high": 31.2,
        "status": "OPTIMAL",
        "category": "blood_count",
    },
]


def test_interpreted_report_detects_isolated_low_reticulocyte_indices_uk():
    report = build_interpreted_report(
        biomarkers=RETICULOCYTE_PANEL,
        knowledge_report={"version": "knowledge_report_v1", "why_it_matters": []},
        health_states={"version": "health_state_engine_v1", "states": []},
        explainability={"version": "explainability_v1"},
        safety_result={"status": "approved"},
        profile={"age": 8, "sex": "male", "height_cm": 140, "weight_kg": 35},
        locale="uk",
    )

    assert report["version"] == "interpreted_report_v1"
    assert report["locale"] == "uk"
    assert report["summary"]["headline"] == "Ізольовано знижені об’ємні індекси ретикулоцитів"
    assert report["facts"]["total_biomarkers"] == 7
    assert report["facts"]["flagged_count"] == 2
    assert report["facts"]["stable_count"] == 5
    assert report["patterns"][0]["key"] == "isolated_low_reticulocyte_volume_indices"
    assert len(report["patterns"][0]["triggered_biomarkers"]) == 2
    assert len(report["patterns"][0]["normal_context"]) >= 4
    assert any("ЗАК" in item or "CBC" in item for item in report["patterns"][0]["missing_context"])
    assert any("дитини" in item.lower() for item in report["patterns"][0]["missing_context"])
    assert len(report["doctor_questions"]) == 3
    assert report["informativeness"]["score"] >= 90


def test_interpreted_report_does_not_prescribe_supplement_dosages():
    report = build_interpreted_report(
        biomarkers=RETICULOCYTE_PANEL,
        profile={"age": 8, "sex": "male", "height_cm": 140, "weight_kg": 35},
        locale="uk",
    )

    rendered = str(report).lower()
    assert "мг" not in rendered
    assert " iu" not in rendered
    assert "5000" not in rendered
    assert "1000" not in rendered
    assert "доза" not in rendered
    assert "не варто починати добавки" in rendered


def test_interpreted_report_hides_unknown_zero_health_domains():
    report = build_interpreted_report(
        biomarkers=RETICULOCYTE_PANEL,
        health_states={
            "version": "health_state_engine_v1",
            "states": [
                {"domain": "iron", "score": 0, "risk_level": "unknown"},
                {"domain": "blood_count", "score": 72, "risk_level": "watch"},
            ],
        },
        profile={"age": 8, "sex": "male", "height_cm": 140, "weight_kg": 35},
        locale="uk",
    )

    domains = [item["domain"] for item in report["health_domains"]]
    assert domains == ["blood_count"]


def test_interpreted_report_localizes_uk_health_domain_labels():
    report = build_interpreted_report(
        biomarkers=RETICULOCYTE_PANEL,
        health_states={
            "version": "health_state_engine_v1",
            "states": [
                {"domain": "iron_status", "label": "Iron status", "score": 42, "risk_level": "high_attention"},
                {"domain": "cardiovascular", "label": "Cardiovascular risk context", "score": 61, "risk_level": "needs_attention"},
            ],
        },
        profile={"age": 8, "sex": "male", "height_cm": 140, "weight_kg": 35},
        locale="uk",
    )

    labels = [item["label"] for item in report["health_domains"]]
    assert labels == ["Статус заліза", "Серцево-судинний профіль"]


def test_interpreted_report_exposes_nutrition_context_from_kb():
    report = build_interpreted_report(
        biomarkers=RETICULOCYTE_PANEL,
        knowledge_report={
            "version": "knowledge_report_v1",
            "nutrition_context": {
                "version": "nutrition_algorithms_v1",
                "person_group": "child_9_13",
                "nutrition_signals": [
                    {
                        "key": "low_ferritin_food_and_context",
                        "nutrient": "iron",
                        "food_sources": ["beans"],
                    }
                ],
                "nutrient_requirements": [{"nutrient": "iron", "rda_or_ai": 8, "upper_limit": 40}],
                "source_basis": [{"source": "USDA / National Agricultural Library DRI Calculator"}],
            },
        },
        profile={"age": 8, "sex": "male", "height_cm": 140, "weight_kg": 35},
        locale="uk",
    )

    assert report["nutrition_context"]["version"] == "nutrition_algorithms_v1"
    assert report["nutrition_context"]["signals"][0]["nutrient"] == "iron"
    assert report["knowledge_trace"]["nutrition_algorithm_version"] == "nutrition_algorithms_v1"


def test_interpreted_report_uses_generic_context_fallback_for_unknown_marker():
    report = build_interpreted_report(
        biomarkers=[
            {
                "name": "Unmapped marker",
                "value": 10,
                "unit": "x",
                "status": "DEFICIENT",
                "category": "other",
            }
        ],
        profile={},
        locale="en",
    )

    assert report["patterns"][0]["key"] == "generic_abnormal_markers_context_required"
    assert report["informativeness"]["score"] < 80
    assert report["doctor_questions"] == []


def test_reticulocyte_markers_map_to_knowledge_and_match_rule():
    lab_results = biomarkers_to_knowledge_lab_results(RETICULOCYTE_PANEL)

    assert lab_results["mean_reticulocyte_volume"]["value"] == 91.9
    assert lab_results["mean_spherical_cell_volume"]["value"] == 66.6

    evaluation = evaluate_input_with_rules(
        {"lab_results": lab_results, "symptoms": []},
        [
            {
                "key": "rule_low_reticulocyte_volume_indices_context",
                "name": "Low Reticulocyte Volume Indices — Context Required",
                "active": True,
                "governance_status": "active",
                "conditions": {
                    "all": [
                        {"lab_marker": "mean_reticulocyte_volume", "operator": "lt", "value": 92.7, "unit": "fL"},
                        {"lab_marker": "mean_spherical_cell_volume", "operator": "lt", "value": 72.8, "unit": "fL"},
                    ]
                },
                "outputs": {
                    "risk": "reticulocyte_indices_context_required",
                    "summary": "Reticulocyte volume indices are low; interpret with CBC and nutrient context.",
                    "recommendation_keys": ["anemia_workup", "serum_iron_tibc_recheck"],
                },
                "confidence": 0.66,
                "severity": "moderate",
                "requires_doctor": False,
                "explanation_template": "Mean Reticulocyte Volume and Mean Spherical Cell Volume are below reference.",
            }
        ],
    )

    assert evaluation["matched_rules"][0]["rule_key"] == "rule_low_reticulocyte_volume_indices_context"
    assert evaluation["recommendation_keys"] == ["anemia_workup", "serum_iron_tibc_recheck"]
