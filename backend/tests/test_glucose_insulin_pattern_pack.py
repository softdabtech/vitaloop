"""P1.3 Glucose/Insulin Resistance Pattern Pack — third domain on the
reference template (report_interpretation.py::_metabolic_risk_pattern).
"""

from app.services.report_interpretation import build_interpreted_report, detect_patterns


def _pattern(biomarkers, profile=None, symptoms=None):
    patterns = detect_patterns(biomarkers, profile=profile or {}, symptoms=symptoms, locale="en")
    return next((p for p in patterns if p["key"] == "metabolic_risk"), None)


def test_discordant_high_insulin_alone_triggers_pattern():
    """Normal glucose/HbA1c but high insulin is itself an early
    insulin-resistance signal — the old detector, gated on glucose/HbA1c
    only, missed this case entirely."""
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 90, "unit": "mg/dL", "status": "OPTIMAL"},
        {"name": "Insulin", "canonical_name": "insulin", "value": 28, "unit": "uIU/mL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern is not None
    assert "elevated_insulin_with_normal_glucose_and_hba1c_early_signal" in pattern["confidence_reason"]
    assert pattern["confidence"] < 0.6


def test_insulin_corroborating_glucose_gives_higher_confidence():
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 115, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "Insulin", "canonical_name": "insulin", "value": 28, "unit": "uIU/mL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert "insulin_corroborates_glucose_hba1c" in pattern["confidence_reason"]
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "insulin" in supportive_names


def test_normal_insulin_with_elevated_glucose_is_contradicting():
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 115, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "Insulin", "canonical_name": "insulin", "value": 8, "unit": "uIU/mL", "status": "OPTIMAL"},
    ]
    pattern = _pattern(biomarkers)
    contradicting_names = {m["canonical_name"] for m in pattern["contradicting_markers"]}
    assert "insulin" in contradicting_names
    assert "insulin_not_elevated_argues_against_insulin_resistance_as_driver" in pattern["confidence_reason"]


def test_supportive_markers_from_triglycerides_hdl_alt():
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 115, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "Triglycerides", "canonical_name": "triglycerides", "value": 220, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "HDL", "canonical_name": "hdl", "value": 32, "unit": "mg/dL", "status": "DEFICIENT"},
        {"name": "ALT", "canonical_name": "alt", "value": 60, "unit": "U/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert {"triglycerides", "hdl", "alt"} <= supportive_names
    assert "metabolic_syndrome_adjacent_markers_present" in pattern["confidence_reason"]


def test_severity_high_and_escalation_for_diabetic_range_glucose():
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 140, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert pattern["doctor_escalation"]["triggered"] is True
    assert pattern["priority"] == "high"


def test_severity_high_for_diabetic_range_hba1c():
    biomarkers = [
        {"name": "HbA1c", "canonical_name": "hba1c", "value": 7.2, "unit": "%", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"


def test_severity_moderate_for_prediabetic_range():
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 108, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "moderate"
    assert pattern["doctor_escalation"]["triggered"] is False
    assert pattern["priority"] == "medium"


def test_doctor_escalation_from_hyperglycemia_symptoms():
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 118, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers, symptoms=["excessive thirst"])
    assert pattern["doctor_escalation"]["triggered"] is True
    assert any("excessive thirst" in reason for reason in pattern["doctor_escalation"]["reasons"])


def test_fasting_insulin_gap_only_flagged_when_insulin_missing():
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 115, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert any("Fasting insulin" in m for m in pattern["missing_context"])


def test_end_to_end_shape_through_build_interpreted_report():
    biomarkers = [
        {"name": "Glucose", "canonical_name": "glucose", "value": 140, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "Insulin", "canonical_name": "insulin", "value": 28, "unit": "uIU/mL", "status": "ELEVATED"},
    ]
    report = build_interpreted_report(biomarkers=biomarkers, profile={}, locale="en")
    metabolic = next(p for p in report["patterns"] if p["key"] == "metabolic_risk")
    assert "supportive_markers" in metabolic
    assert "contradicting_markers" in metabolic
    assert "severity" in metabolic
    assert "doctor_escalation" in metabolic
