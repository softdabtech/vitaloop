"""P1.8 Nutrient Deficiency Clinical Pattern Pack — eighth domain,
expanding the pre-existing cluster pattern
(report_interpretation.py::_micronutrient_deficiency_cluster_pattern).
"""

from app.services.report_interpretation import build_interpreted_report, detect_patterns


def _pattern(biomarkers, profile=None, symptoms=None):
    patterns = detect_patterns(biomarkers, profile=profile or {}, symptoms=symptoms, locale="en")
    return next((p for p in patterns if p["key"] == "micronutrient_deficiency_cluster"), None)


def test_ferritin_counts_toward_the_cluster():
    biomarkers = [
        {"name": "Vitamin D", "canonical_name": "vitamin_d", "value": 15, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 10, "unit": "ng/mL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern is not None
    triggered_names = {m["canonical_name"] for m in pattern["triggered_biomarkers"]}
    assert "ferritin" in triggered_names


def test_high_homocysteine_confirms_functional_b12_deficiency():
    biomarkers = [
        {"name": "Vitamin B12", "canonical_name": "b12", "value": 150, "unit": "pg/mL", "status": "DEFICIENT"},
        {"name": "Magnesium", "canonical_name": "magnesium", "value": 1.4, "unit": "mg/dL", "status": "DEFICIENT"},
        {"name": "Homocysteine", "canonical_name": "homocysteine", "value": 18, "unit": "umol/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "homocysteine" in supportive_names
    assert "homocysteine_or_mma_confirms_functional_b12_folate_deficiency" in pattern["confidence_reason"]


def test_normal_homocysteine_despite_low_b12_is_contradicting():
    biomarkers = [
        {"name": "Vitamin B12", "canonical_name": "b12", "value": 180, "unit": "pg/mL", "status": "DEFICIENT"},
        {"name": "Zinc", "canonical_name": "zinc", "value": 50, "unit": "ug/dL", "status": "DEFICIENT"},
        {"name": "Homocysteine", "canonical_name": "homocysteine", "value": 8, "unit": "umol/L", "status": "OPTIMAL"},
    ]
    pattern = _pattern(biomarkers)
    contradicting_names = {m["canonical_name"] for m in pattern["contradicting_markers"]}
    assert "homocysteine" in contradicting_names
    assert "normal_homocysteine_mma_despite_low_b12_folate_suggests_not_yet_functionally_significant" in pattern["confidence_reason"]


def test_severity_high_when_three_or_more_low_markers():
    biomarkers = [
        {"name": "Vitamin D", "canonical_name": "vitamin_d", "value": 15, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Vitamin B12", "canonical_name": "b12", "value": 150, "unit": "pg/mL", "status": "DEFICIENT"},
        {"name": "Magnesium", "canonical_name": "magnesium", "value": 1.4, "unit": "mg/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"


def test_severity_moderate_when_exactly_two_low_markers():
    biomarkers = [
        {"name": "Vitamin D", "canonical_name": "vitamin_d", "value": 15, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Zinc", "canonical_name": "zinc", "value": 50, "unit": "ug/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "moderate"
    assert pattern["doctor_escalation"]["triggered"] is False
    assert pattern["priority"] == "medium"


def test_doctor_escalation_from_neuro_symptoms_with_low_b12():
    biomarkers = [
        {"name": "Vitamin B12", "canonical_name": "b12", "value": 150, "unit": "pg/mL", "status": "DEFICIENT"},
        {"name": "Folate", "canonical_name": "folate", "value": 2, "unit": "ng/mL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers, symptoms=["numbness"])
    assert pattern["doctor_escalation"]["triggered"] is True
    assert any("numbness" in reason for reason in pattern["doctor_escalation"]["reasons"])
    assert pattern["priority"] == "high"


def test_no_escalation_from_neuro_symptoms_without_low_b12_or_folate():
    biomarkers = [
        {"name": "Vitamin D", "canonical_name": "vitamin_d", "value": 15, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Zinc", "canonical_name": "zinc", "value": 50, "unit": "ug/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers, symptoms=["numbness"])
    assert pattern["doctor_escalation"]["triggered"] is False


def test_functional_test_gap_flagged_when_b12_low_without_homocysteine_mma():
    biomarkers = [
        {"name": "Vitamin B12", "canonical_name": "b12", "value": 150, "unit": "pg/mL", "status": "DEFICIENT"},
        {"name": "Folate", "canonical_name": "folate", "value": 2, "unit": "ng/mL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert any("Homocysteine or MMA" in m for m in pattern["missing_context"])


def test_end_to_end_shape_through_build_interpreted_report():
    biomarkers = [
        {"name": "Vitamin D", "canonical_name": "vitamin_d", "value": 15, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Vitamin B12", "canonical_name": "b12", "value": 150, "unit": "pg/mL", "status": "DEFICIENT"},
    ]
    report = build_interpreted_report(biomarkers=biomarkers, profile={}, locale="en")
    cluster = next(p for p in report["patterns"] if p["key"] == "micronutrient_deficiency_cluster")
    assert "supportive_markers" in cluster
    assert "contradicting_markers" in cluster
    assert "severity" in cluster
    assert "doctor_escalation" in cluster
