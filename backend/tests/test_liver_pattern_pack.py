"""P1.6 Liver Clinical Pattern Pack — sixth domain on the reference
template (report_interpretation.py::_liver_stress_pattern).
"""

from app.services.report_interpretation import build_interpreted_report, detect_patterns


def _pattern(biomarkers, profile=None, symptoms=None):
    patterns = detect_patterns(biomarkers, profile=profile or {}, symptoms=symptoms, locale="en")
    return next((p for p in patterns if p["key"] == "liver_stress"), None)


def test_cholestatic_component_flagged_when_alp_or_bilirubin_elevated():
    biomarkers = [
        {"name": "ALT", "canonical_name": "alt", "value": 90, "unit": "U/L", "status": "ELEVATED"},
        {"name": "ALP", "canonical_name": "alp", "value": 180, "unit": "U/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern is not None
    assert "cholestatic_component_present_alongside_hepatocellular_enzymes" in pattern["confidence_reason"]
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "alp" in supportive_names


def test_hepatocellular_only_when_no_cholestatic_markers():
    biomarkers = [
        {"name": "ALT", "canonical_name": "alt", "value": 90, "unit": "U/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert "hepatocellular_pattern_without_cholestatic_component" in pattern["confidence_reason"]


def test_low_albumin_or_platelets_flags_synthetic_function_signal():
    biomarkers = [
        {"name": "AST", "canonical_name": "ast", "value": 95, "unit": "U/L", "status": "ELEVATED"},
        {"name": "Albumin", "canonical_name": "albumin", "value": 2.8, "unit": "g/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert "synthetic_function_or_portal_hypertension_signal_present" in pattern["confidence_reason"]
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "albumin" in supportive_names


def test_normal_albumin_and_platelets_are_contradicting_and_reassuring():
    biomarkers = [
        {"name": "ALT", "canonical_name": "alt", "value": 95, "unit": "U/L", "status": "ELEVATED"},
        {"name": "Albumin", "canonical_name": "albumin", "value": 4.2, "unit": "g/dL", "status": "OPTIMAL"},
        {"name": "Platelets", "canonical_name": "platelets", "value": 250, "unit": "10^3/uL", "status": "OPTIMAL"},
    ]
    pattern = _pattern(biomarkers)
    contradicting_names = {m["canonical_name"] for m in pattern["contradicting_markers"]}
    assert {"albumin", "platelets"} <= contradicting_names
    assert "normal_albumin_platelets_argue_against_advanced_liver_disease" in pattern["confidence_reason"]


def test_severity_high_and_escalation_for_marked_transaminitis():
    biomarkers = [
        {"name": "ALT", "canonical_name": "alt", "value": 650, "unit": "U/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert pattern["doctor_escalation"]["triggered"] is True
    assert pattern["priority"] == "high"


def test_severity_high_and_escalation_for_elevated_bilirubin():
    biomarkers = [
        {"name": "AST", "canonical_name": "ast", "value": 90, "unit": "U/L", "status": "ELEVATED"},
        {"name": "Bilirubin", "canonical_name": "bilirubin", "value": 4.5, "unit": "mg/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert pattern["doctor_escalation"]["triggered"] is True


def test_severity_moderate_for_mid_range_transaminitis():
    biomarkers = [
        {"name": "ALT", "canonical_name": "alt", "value": 250, "unit": "U/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "moderate"
    assert pattern["doctor_escalation"]["triggered"] is False
    assert pattern["priority"] == "medium"


def test_no_escalation_for_mild_isolated_alt_elevation():
    biomarkers = [
        {"name": "ALT", "canonical_name": "alt", "value": 70, "unit": "U/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "mild"
    assert pattern["doctor_escalation"]["triggered"] is False


def test_doctor_escalation_from_liver_alarm_symptoms():
    biomarkers = [
        {"name": "ALT", "canonical_name": "alt", "value": 90, "unit": "U/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers, symptoms=["jaundice"])
    assert pattern["doctor_escalation"]["triggered"] is True
    assert any("jaundice" in reason for reason in pattern["doctor_escalation"]["reasons"])


def test_end_to_end_shape_through_build_interpreted_report():
    biomarkers = [
        {"name": "ALT", "canonical_name": "alt", "value": 90, "unit": "U/L", "status": "ELEVATED"},
        {"name": "ALP", "canonical_name": "alp", "value": 180, "unit": "U/L", "status": "ELEVATED"},
    ]
    report = build_interpreted_report(biomarkers=biomarkers, profile={}, locale="en")
    liver = next(p for p in report["patterns"] if p["key"] == "liver_stress")
    assert "supportive_markers" in liver
    assert "contradicting_markers" in liver
    assert "severity" in liver
    assert "doctor_escalation" in liver
