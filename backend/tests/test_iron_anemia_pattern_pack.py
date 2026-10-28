"""P1.1 Iron/Anemia Clinical Pattern Pack — reference domain pack tests.

Covers the spec agreed with the user/Codex: loosened required-marker gate
(ferritin OR CBC combo), supportive vs contradicting markers, CRP/B12-folate
exclusions, confidence tiers, severity, and doctor escalation rules
independent of the marker-only priority calculation.
"""

from app.services.report_interpretation import build_interpreted_report, detect_patterns


def _pattern(biomarkers, profile=None, symptoms=None):
    patterns = detect_patterns(biomarkers, profile=profile or {}, symptoms=symptoms, locale="en")
    return next((p for p in patterns if p["key"] == "iron_deficiency_anemia"), None)


def test_detected_from_cbc_combo_alone_without_ferritin():
    """Required-marker gate loosened: low Hb/Hct + low MCV should trigger the
    pattern even with no ferritin in the panel at all — the old detector
    required ferritin AND Hb/Hct together and stayed silent here."""
    biomarkers = [
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 10.5, "unit": "g/dL", "status": "DEFICIENT"},
        {"name": "MCV", "canonical_name": "mcv", "value": 72, "unit": "fL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern is not None
    assert pattern["confidence"] > 0


def test_not_detected_from_low_ferritin_alone_gives_lower_confidence_tier():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 9, "unit": "ng/mL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern is not None
    assert pattern["confidence"] < 0.6  # moderate/low tier, not the high tier


def test_supportive_markers_populated_from_mcv_mch_iron_tsat_rdw():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 10.2, "unit": "g/dL", "status": "DEFICIENT"},
        {"name": "MCH", "canonical_name": "mch", "value": 22, "unit": "pg", "status": "DEFICIENT"},
        {"name": "RDW", "canonical_name": "rdw", "value": 18, "unit": "%", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "mch" in supportive_names
    assert "rdw" in supportive_names


def test_normal_transferrin_saturation_is_contradicting_not_supportive():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 10.2, "unit": "g/dL", "status": "DEFICIENT"},
        {"name": "Transferrin Saturation", "canonical_name": "transferrin_saturation", "value": 30, "unit": "%", "status": "OPTIMAL"},
    ]
    pattern = _pattern(biomarkers)
    contradicting_names = {m["canonical_name"] for m in pattern["contradicting_markers"]}
    supportive_names = {m["canonical_name"] for m in pattern["supportive_markers"]}
    assert "transferrin_saturation" in contradicting_names
    assert "transferrin_saturation" not in supportive_names
    assert "transferrin_saturation_not_low_argues_against_pure_iron_deficiency" in pattern["confidence_reason"]


def test_high_crp_flags_ferritin_inflammation_confound():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 10.2, "unit": "g/dL", "status": "DEFICIENT"},
        {"name": "CRP", "canonical_name": "crp", "value": 15, "unit": "mg/L", "status": "ELEVATED"},
    ]
    pattern = _pattern(biomarkers)
    assert "inflammation_may_confound_ferritin" in pattern["confidence_reason"]
    assert any("inflammation" in m.lower() for m in pattern["missing_context"])


def test_low_b12_or_folate_flags_possible_mixed_anemia():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 10.2, "unit": "g/dL", "status": "DEFICIENT"},
        {"name": "Vitamin B12", "canonical_name": "b12", "value": 150, "unit": "pg/mL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert "possible_mixed_anemia_b12_folate" in pattern["confidence_reason"]


def test_severity_high_and_doctor_escalation_when_hemoglobin_very_low():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 5, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 7.2, "unit": "g/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers)
    assert pattern["severity"] == "high"
    assert pattern["doctor_escalation"]["triggered"] is True
    assert pattern["priority"] == "high"


def test_doctor_escalation_for_male_iron_deficiency():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 12.5, "unit": "g/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers, profile={"sex": "male", "age": 40})
    assert pattern["doctor_escalation"]["triggered"] is True
    assert pattern["priority"] == "high"


def test_doctor_escalation_for_postmenopausal_female_iron_deficiency():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 12.5, "unit": "g/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers, profile={"sex": "female", "age": 60})
    assert pattern["doctor_escalation"]["triggered"] is True


def test_no_escalation_for_young_female_mild_case():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 11.5, "unit": "g/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers, profile={"sex": "female", "age": 28})
    assert pattern["doctor_escalation"]["triggered"] is False
    assert pattern["priority"] == "medium"


def test_doctor_escalation_from_blood_loss_symptom():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 11.5, "unit": "g/dL", "status": "DEFICIENT"},
    ]
    pattern = _pattern(biomarkers, profile={"sex": "female", "age": 28}, symptoms=["dizziness"])
    assert pattern["doctor_escalation"]["triggered"] is True
    assert any("dizziness" in reason for reason in pattern["doctor_escalation"]["reasons"])


def test_frozen_snapshot_shape_still_works_end_to_end_through_build_interpreted_report():
    biomarkers = [
        {"name": "Ferritin", "canonical_name": "ferritin", "value": 8, "unit": "ng/mL", "status": "DEFICIENT"},
        {"name": "Hemoglobin", "canonical_name": "hemoglobin", "value": 10.2, "unit": "g/dL", "status": "DEFICIENT"},
    ]
    report = build_interpreted_report(biomarkers=biomarkers, profile={}, locale="en")
    iron = next(p for p in report["patterns"] if p["key"] == "iron_deficiency_anemia")
    assert "supportive_markers" in iron
    assert "contradicting_markers" in iron
    assert "severity" in iron
    assert "doctor_escalation" in iron
