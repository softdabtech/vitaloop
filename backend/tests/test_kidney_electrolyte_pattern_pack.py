"""P1.7 Kidney/Electrolyte Clinical Pattern Pack — seventh domain,
expanding the pre-existing safety pattern
(report_interpretation.py::_electrolyte_kidney_safety_pattern).
"""

from app.services.report_interpretation import build_interpreted_report, detect_patterns


def _pattern(biomarkers, profile=None, symptoms=None):
    patterns = detect_patterns(biomarkers, profile=profile or {}, symptoms=symptoms, locale="en")
    return next((p for p in patterns if p["key"] == "electrolyte_kidney_safety"), None)


def test_abnormal_bun_corroborates_kidney_involvement():
    biomarkers = [
        {"name": "Potassium", "canonical_name": "potassium", "value": 5.8, "unit": "mmol/L", "status": "ELEVATED"},
        {"name": "Creatinine", "canonical_name": "creatinine", "value": 2.1, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "BUN", "canonical_name": "bun", "value": 45, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern is not None
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "bun" in supportive_names
    assert "bun_corroborates_kidney_involvement" in pattern["confidence_reason"]


def test_normal_bun_despite_abnormal_creatinine_is_contradicting():
    biomarkers = [
        {"name": "Potassium", "canonical_name": "potassium", "value": 5.8, "unit": "mmol/L", "status": "ELEVATED"},
        {"name": "Creatinine", "canonical_name": "creatinine", "value": 2.1, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "BUN", "canonical_name": "bun", "value": 16, "unit": "mg/dL", "status": "OPTIMAL"},
    ]
    pattern = _pattern(biomarkers)
    contradicting_names = {m["canonical_name"] for m in pattern["contradicting_markers"]}
    assert "bun" in contradicting_names
    assert "normal_bun_suggests_acute_or_isolated_change_rather_than_established_ckd" in pattern["confidence_reason"]


def test_severity_high_for_critical_potassium():
    biomarkers = [
        {"name": "Potassium", "canonical_name": "potassium", "value": 6.8, "unit": "mmol/L", "status": "ELEVATED"},
        {"name": "Creatinine", "canonical_name": "creatinine", "value": 1.8, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert any("critical range" in reason for reason in pattern["doctor_escalation"]["reasons"])


def test_severity_high_for_kidney_failure_range_egfr():
    biomarkers = [
        {"name": "Sodium", "canonical_name": "sodium", "value": 128, "unit": "mmol/L", "status": "DEFICIENT"},
        {"name": "eGFR", "canonical_name": "egfr", "value": 12, "unit": "mL/min", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert any("kidney-failure range" in reason for reason in pattern["doctor_escalation"]["reasons"])


def test_severity_moderate_for_severe_but_not_failure_egfr():
    biomarkers = [
        {"name": "Sodium", "canonical_name": "sodium", "value": 128, "unit": "mmol/L", "status": "DEFICIENT"},
        {"name": "eGFR", "canonical_name": "egfr", "value": 25, "unit": "mL/min", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "moderate"


def test_severity_mild_when_abnormal_but_not_extreme():
    biomarkers = [
        {"name": "Sodium", "canonical_name": "sodium", "value": 132, "unit": "mmol/L", "status": "DEFICIENT"},
        {"name": "Creatinine", "canonical_name": "creatinine", "value": 1.4, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "mild"


def test_doctor_escalation_always_triggered_for_this_safety_pattern():
    """This pattern only fires when BOTH an electrolyte and a kidney marker
    are abnormal together — it is a safety-tier pattern by design and must
    always escalate, regardless of how mild each individual marker is."""
    biomarkers = [
        {"name": "Sodium", "canonical_name": "sodium", "value": 132, "unit": "mmol/L", "status": "DEFICIENT"},
        {"name": "Creatinine", "canonical_name": "creatinine", "value": 1.4, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["doctor_escalation"]["triggered"] is True
    assert pattern["priority"] == "high"


def test_symptom_reinforces_escalation_reasons():
    biomarkers = [
        {"name": "Potassium", "canonical_name": "potassium", "value": 5.8, "unit": "mmol/L", "status": "ELEVATED"},
        {"name": "Creatinine", "canonical_name": "creatinine", "value": 2.0, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers, symptoms=["confusion"])
    assert any("confusion" in reason for reason in pattern["doctor_escalation"]["reasons"])


def test_urine_context_added_to_missing_context():
    biomarkers = [
        {"name": "Sodium", "canonical_name": "sodium", "value": 132, "unit": "mmol/L", "status": "DEFICIENT"},
        {"name": "Creatinine", "canonical_name": "creatinine", "value": 1.4, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert any("urine" in m.lower() for m in pattern["missing_context"])


def test_end_to_end_shape_through_build_interpreted_report():
    biomarkers = [
        {"name": "Potassium", "canonical_name": "potassium", "value": 6.8, "unit": "mmol/L", "status": "ELEVATED"},
        {"name": "Creatinine", "canonical_name": "creatinine", "value": 2.4, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    report = build_interpreted_report(biomarkers=biomarkers, profile={}, locale="en")
    kidney = next(p for p in report["patterns"] if p["key"] == "electrolyte_kidney_safety")
    assert "supportive_markers" in kidney
    assert "contradicting_markers" in kidney
    assert "severity" in kidney
    assert kidney["doctor_escalation"]["triggered"] is True
