"""P1.2 Thyroid Clinical Pattern Pack — second domain built on the
iron/anemia reference template (report_interpretation.py::_thyroid_dysfunction_pattern).
"""

from app.services.report_interpretation import build_interpreted_report, detect_patterns


def _pattern(biomarkers, profile=None, symptoms=None):
    patterns = detect_patterns(biomarkers, profile=profile or {}, symptoms=symptoms, locale="en")
    return next((p for p in patterns if p["key"] == "thyroid_dysfunction"), None)


def test_high_tsh_with_low_free_t4_is_supportive_overt_hypothyroid():
    biomarkers = [
        {"name": "TSH", "canonical_name": "tsh", "value": 12, "unit": "mIU/L", "status": "ELEVATED"},
        {"name": "Free T4", "canonical_name": "free_t4", "value": 0.5, "unit": "ng/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern is not None
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "free_t4" in supportive_names
    assert "free_t3_t4_confirms_tsh_direction" in pattern["confidence_reason"]


def test_high_tsh_with_high_free_t4_is_contradicting():
    """Free T4 moving AGAINST TSH's implied direction argues against an
    overt hypothyroid picture and must not be counted as supportive."""
    biomarkers = [
        {"name": "TSH", "canonical_name": "tsh", "value": 6.5, "unit": "mIU/L", "status": "ELEVATED"},
        {"name": "Free T4", "canonical_name": "free_t4", "value": 2.5, "unit": "ng/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    contradicting_names = {m["canonical_name"] for m in pattern["contradicting_markers"]}
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "free_t4" in contradicting_names
    assert "free_t4" not in supportive_names


def test_normal_free_t4_with_abnormal_tsh_is_subclinical_and_contradicting():
    biomarkers = [
        {"name": "TSH", "canonical_name": "tsh", "value": 6.0, "unit": "mIU/L", "status": "ELEVATED"},
        {"name": "Free T4", "canonical_name": "free_t4", "value": 1.2, "unit": "ng/dL", "status": "OPTIMAL"},
    ]
    pattern = _pattern(biomarkers)
    contradicting_names = {m["canonical_name"] for m in pattern["contradicting_markers"]}
    assert "free_t4" in contradicting_names
    assert "free_t3_t4_in_range_suggests_subclinical_picture" in pattern["confidence_reason"]
    assert pattern["confidence"] < 0.6


def test_biotin_interference_flagged_for_every_case():
    biomarkers = [
        {"name": "TSH", "canonical_name": "tsh", "value": 6.0, "unit": "mIU/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert "biotin_supplement_interference_not_ruled_out" in pattern["confidence_reason"]
    assert any("biotin" in m.lower() for m in pattern["missing_context"])


def test_severity_high_and_doctor_escalation_for_markedly_elevated_tsh():
    biomarkers = [
        {"name": "TSH", "canonical_name": "tsh", "value": 15, "unit": "mIU/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert pattern["doctor_escalation"]["triggered"] is True
    assert pattern["priority"] == "high"


def test_severity_high_and_doctor_escalation_for_suppressed_tsh():
    biomarkers = [
        {"name": "TSH", "canonical_name": "tsh", "value": 0.05, "unit": "mIU/L", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert pattern["doctor_escalation"]["triggered"] is True


def test_no_escalation_for_mild_isolated_tsh_shift():
    biomarkers = [
        {"name": "TSH", "canonical_name": "tsh", "value": 5.2, "unit": "mIU/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers, profile={"age": 30})
    assert pattern["doctor_escalation"]["triggered"] is False
    assert pattern["priority"] == "medium"


def test_doctor_escalation_from_storm_symptoms_with_overt_picture():
    biomarkers = [
        {"name": "TSH", "canonical_name": "tsh", "value": 0.2, "unit": "mIU/L", "status": "DEFICIENT"},
        {"name": "Free T4", "canonical_name": "free_t4", "value": 2.8, "unit": "ng/dL", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers, symptoms=["palpitations"])
    assert pattern["doctor_escalation"]["triggered"] is True
    assert any("palpitations" in reason for reason in pattern["doctor_escalation"]["reasons"])


def test_doctor_escalation_for_older_adult_with_overt_picture():
    biomarkers = [
        {"name": "TSH", "canonical_name": "tsh", "value": 8.0, "unit": "mIU/L", "status": "ELEVATED"},
        {"name": "Free T4", "canonical_name": "free_t4", "value": 0.6, "unit": "ng/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers, profile={"age": 65})
    assert pattern["doctor_escalation"]["triggered"] is True


def test_end_to_end_shape_through_build_interpreted_report():
    biomarkers = [
        {"name": "TSH", "canonical_name": "tsh", "value": 12, "unit": "mIU/L", "status": "ELEVATED"},
        {"name": "Free T4", "canonical_name": "free_t4", "value": 0.5, "unit": "ng/dL", "status": "DEFICIENT"},
    ]
    report = build_interpreted_report(biomarkers=biomarkers, profile={}, locale="en")
    thyroid = next(p for p in report["patterns"] if p["key"] == "thyroid_dysfunction")
    assert "supportive_markers" in thyroid
    assert "contradicting_markers" in thyroid
    assert "severity" in thyroid
    assert "doctor_escalation" in thyroid
