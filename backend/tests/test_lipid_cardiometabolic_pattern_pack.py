"""P1.5 Lipid/Cardiometabolic Clinical Pattern Pack — fifth domain on the
reference template (report_interpretation.py::_cardiovascular_risk_pattern).
"""

from app.services.report_interpretation import build_interpreted_report, detect_patterns


def _pattern(biomarkers, profile=None, symptoms=None):
    patterns = detect_patterns(biomarkers, profile=profile or {}, symptoms=symptoms, locale="en")
    return next((p for p in patterns if p["key"] == "cardiovascular_risk"), None)


def test_high_apob_and_non_hdl_are_supportive():
    biomarkers = [
        {"name": "LDL", "canonical_name": "ldl", "value": 170, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "ApoB", "canonical_name": "apob", "value": 140, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "Non-HDL", "canonical_name": "non_hdl", "value": 190, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert {"apob", "non_hdl"} <= supportive_names
    assert "apob_or_non_hdl_corroborates_atherogenic_burden" in pattern["confidence_reason"]


def test_lp_a_adds_independent_risk_signal():
    biomarkers = [
        {"name": "LDL", "canonical_name": "ldl", "value": 170, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "Lp(a)", "canonical_name": "lp_a", "value": 120, "unit": "nmol/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert "lp_a_adds_independent_genetic_risk_signal" in pattern["confidence_reason"]


def test_normal_apob_despite_high_ldl_is_contradicting():
    biomarkers = [
        {"name": "LDL", "canonical_name": "ldl", "value": 175, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "ApoB", "canonical_name": "apob", "value": 85, "unit": "mg/dL", "status": "OPTIMAL"},
    ]
    pattern = _pattern(biomarkers)
    contradicting_names = {m["canonical_name"] for m in pattern["contradicting_markers"]}
    assert "apob" in contradicting_names
    assert "apob_not_elevated_despite_high_ldl_suggests_lower_particle_burden_than_ldl_c_implies" in pattern["confidence_reason"]


def test_hs_crp_and_glucose_add_cardiometabolic_context():
    biomarkers = [
        {"name": "LDL", "canonical_name": "ldl", "value": 170, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "hs-CRP", "canonical_name": "crp", "value": 5, "unit": "mg/L", "status": "ELEVATED"},
        {"name": "Glucose", "canonical_name": "glucose", "value": 115, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert "hs_crp_adds_cardiometabolic_inflammatory_context" in pattern["confidence_reason"]
    assert "glucose_hba1c_elevation_compounds_cardiometabolic_risk" in pattern["confidence_reason"]


def test_severity_high_and_escalation_for_severe_ldl():
    biomarkers = [
        {"name": "LDL", "canonical_name": "ldl", "value": 210, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert pattern["doctor_escalation"]["triggered"] is True
    assert pattern["priority"] == "high"


def test_severity_high_and_escalation_for_pancreatitis_risk_triglycerides():
    biomarkers = [
        {"name": "Triglycerides", "canonical_name": "triglycerides", "value": 600, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert pattern["doctor_escalation"]["triggered"] is True
    assert any("pancreatitis" in reason for reason in pattern["doctor_escalation"]["reasons"])


def test_no_escalation_for_mild_isolated_ldl_elevation():
    biomarkers = [
        {"name": "LDL", "canonical_name": "ldl", "value": 145, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["doctor_escalation"]["triggered"] is False
    assert pattern["severity"] == "mild"


def test_doctor_escalation_from_cardiac_symptoms():
    biomarkers = [
        {"name": "LDL", "canonical_name": "ldl", "value": 170, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "HDL", "canonical_name": "hdl", "value": 32, "unit": "mg/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers, symptoms=["chest pain"])
    assert pattern["doctor_escalation"]["triggered"] is True
    assert any("chest pain" in reason for reason in pattern["doctor_escalation"]["reasons"])


def test_existing_high_priority_rule_for_ldl_and_hdl_combo_preserved():
    """Regression guard: the pre-existing high_ldl + low_hdl -> priority high
    rule must survive the P1.5 rewrite."""
    biomarkers = [
        {"name": "LDL", "canonical_name": "ldl", "value": 170, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "HDL", "canonical_name": "hdl", "value": 32, "unit": "mg/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["priority"] == "high"


def test_end_to_end_shape_through_build_interpreted_report():
    biomarkers = [
        {"name": "LDL", "canonical_name": "ldl", "value": 170, "unit": "mg/dL", "status": "ELEVATED"},
        {"name": "ApoB", "canonical_name": "apob", "value": 140, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    report = build_interpreted_report(biomarkers=biomarkers, profile={}, locale="en")
    cardio = next(p for p in report["patterns"] if p["key"] == "cardiovascular_risk")
    assert "supportive_markers" in cardio
    assert "contradicting_markers" in cardio
    assert "severity" in cardio
    assert "doctor_escalation" in cardio
