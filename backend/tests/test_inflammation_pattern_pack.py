"""P1.4 Inflammation Clinical Pattern Pack — fourth domain on the reference
template (report_interpretation.py::_inflammation_pattern).
"""

from app.services.report_interpretation import build_interpreted_report, detect_patterns


def _pattern(biomarkers, profile=None, symptoms=None):
    patterns = detect_patterns(biomarkers, profile=profile or {}, symptoms=symptoms, locale="en")
    return next((p for p in patterns if p["key"] == "inflammation"), None)


def test_high_wbc_supports_acute_pattern():
    biomarkers = [
        {"name": "CRP", "canonical_name": "crp", "value": 40, "unit": "mg/L", "status": "ELEVATED"},
        {"name": "WBC", "canonical_name": "wbc", "value": 14, "unit": "10^3/uL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern is not None
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "wbc" in supportive_names
    assert "wbc_neutrophils_support_acute_pattern" in pattern["confidence_reason"]


def test_isolated_crp_with_normal_wbc_is_contradicting_for_acute_process():
    biomarkers = [
        {"name": "CRP", "canonical_name": "crp", "value": 12, "unit": "mg/L", "status": "ELEVATED"},
        {"name": "WBC", "canonical_name": "wbc", "value": 6, "unit": "10^3/uL", "status": "OPTIMAL"},
    ]
    pattern = _pattern(biomarkers)
    contradicting_names = {m["canonical_name"] for m in pattern["contradicting_markers"]}
    assert "wbc" in contradicting_names
    assert "normal_wbc_suggests_chronic_or_nonacute_process_not_acute_infection" in pattern["confidence_reason"]
    assert pattern["confidence"] < 0.6


def test_high_ferritin_flagged_as_acute_phase_modifier_not_iron_overload():
    biomarkers = [
        {"name": "CRP", "canonical_name": "crp", "value": 20, "unit": "mg/L", "status": "ELEVATED"},
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 600, "unit": "ng/mL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert "ferritin_elevated_as_acute_phase_reactant_not_necessarily_iron_overload" in pattern["confidence_reason"]


def test_high_platelets_flagged_as_reactive_thrombocytosis():
    biomarkers = [
        {"name": "CRP", "canonical_name": "crp", "value": 20, "unit": "mg/L", "status": "ELEVATED"},
        {"name": "Platelets", "canonical_name": "platelets", "value": 480, "unit": "10^3/uL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "platelets" in supportive_names
    assert "reactive_thrombocytosis_consistent_with_inflammation" in pattern["confidence_reason"]


def test_severity_high_and_escalation_for_markedly_elevated_crp():
    biomarkers = [
        {"name": "CRP", "canonical_name": "crp", "value": 150, "unit": "mg/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert pattern["doctor_escalation"]["triggered"] is True
    assert pattern["priority"] == "high"


def test_severity_high_for_markedly_elevated_wbc():
    biomarkers = [
        {"name": "ESR", "canonical_name": "esr", "value": 60, "unit": "mm/hr", "status": "ELEVATED"},
        {"name": "WBC", "canonical_name": "wbc", "value": 18, "unit": "10^3/uL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"


def test_no_escalation_for_mild_isolated_crp():
    biomarkers = [
        {"name": "CRP", "canonical_name": "crp", "value": 8, "unit": "mg/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["doctor_escalation"]["triggered"] is False
    assert pattern["priority"] == "medium"


def test_doctor_escalation_from_sepsis_like_symptoms_with_acute_pattern():
    biomarkers = [
        {"name": "CRP", "canonical_name": "crp", "value": 40, "unit": "mg/L", "status": "ELEVATED"},
        {"name": "WBC", "canonical_name": "wbc", "value": 14, "unit": "10^3/uL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers, symptoms=["high fever"])
    assert pattern["doctor_escalation"]["triggered"] is True
    assert any("high fever" in reason for reason in pattern["doctor_escalation"]["reasons"])


def test_no_escalation_from_symptoms_without_acute_wbc_pattern():
    """Sepsis-like symptoms alone, without an acute WBC/neutrophil pattern,
    should not trigger escalation from this rule — the combination is
    what's clinically informative here."""
    biomarkers = [
        {"name": "CRP", "canonical_name": "crp", "value": 12, "unit": "mg/L", "status": "ELEVATED"},
        {"name": "WBC", "canonical_name": "wbc", "value": 6, "unit": "10^3/uL", "status": "OPTIMAL"},
    ]
    pattern = _pattern(biomarkers, symptoms=["high fever"])
    assert pattern["doctor_escalation"]["triggered"] is False


def test_end_to_end_shape_through_build_interpreted_report():
    biomarkers = [
        {"name": "CRP", "canonical_name": "crp", "value": 40, "unit": "mg/L", "status": "ELEVATED"},
        {"name": "WBC", "canonical_name": "wbc", "value": 14, "unit": "10^3/uL", "status": "ELEVATED"},
    ]
    report = build_interpreted_report(biomarkers=biomarkers, profile={}, locale="en")
    inflammation = next(p for p in report["patterns"] if p["key"] == "inflammation")
    assert "supportive_markers" in inflammation
    assert "contradicting_markers" in inflammation
    assert "severity" in inflammation
    assert "doctor_escalation" in inflammation
