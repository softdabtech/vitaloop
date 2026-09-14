"""P15: Clinical Contradiction Detector (app/services/clinical_contradictions.py).

Deterministic, no LLM. Covers the MVP rule set plus empty-state and
malformed-input tolerance.
"""

from app.services.clinical_contradictions import build_clinical_contradictions


def _marker(name, value, status, canonical_name=None):
    return {"name": name, "canonical_name": canonical_name or name.lower().replace(" ", "_"), "value": value, "status": status, "unit": "unit"}


def test_empty_state_returns_no_contradictions_for_empty_biomarkers():
    result = build_clinical_contradictions([])

    assert result["contradictions"] == []
    assert result["summary"]["count"] == 0


def test_empty_state_for_none_biomarkers():
    result = build_clinical_contradictions(None)

    assert result["contradictions"] == []


def test_ferritin_masked_by_inflammation():
    biomarkers = [
        _marker("Ferritin", 120, "OPTIMAL"),
        _marker("CRP", 8.0, "ELEVATED"),
    ]

    result = build_clinical_contradictions(biomarkers)

    ids = [c["id"] for c in result["contradictions"]]
    assert "ferritin_inflammation_context" in ids
    rule = next(c for c in result["contradictions"] if c["id"] == "ferritin_inflammation_context")
    assert rule["domain"] == "iron_anemia"
    assert rule["effect_on_confidence"] == "downgrade"
    assert "transferrin saturation" in rule["recommended_next_tests"]
    assert "you have" not in rule["message"].lower()


def test_ferritin_not_flagged_when_crp_normal():
    biomarkers = [
        _marker("Ferritin", 120, "OPTIMAL"),
        _marker("CRP", 1.0, "OPTIMAL"),
    ]

    result = build_clinical_contradictions(biomarkers)

    ids = [c["id"] for c in result["contradictions"]]
    assert "ferritin_inflammation_context" not in ids


def test_low_ferritin_normal_hemoglobin_nuance():
    biomarkers = [
        _marker("Ferritin", 8, "DEFICIENT"),
        _marker("Hemoglobin", 13.5, "OPTIMAL"),
    ]

    result = build_clinical_contradictions(biomarkers)

    ids = [c["id"] for c in result["contradictions"]]
    assert "low_ferritin_normal_hemoglobin" in ids
    rule = next(c for c in result["contradictions"] if c["id"] == "low_ferritin_normal_hemoglobin")
    assert rule["effect_on_confidence"] == "context_only"


def test_normal_glucose_high_insulin_rule():
    biomarkers = [
        _marker("Glucose", 88, "OPTIMAL"),
        _marker("Insulin", 22, "ELEVATED"),
    ]

    result = build_clinical_contradictions(biomarkers)

    ids = [c["id"] for c in result["contradictions"]]
    assert "normal_glucose_high_insulin" in ids


def test_tsh_elevated_normal_ft4_nuance():
    biomarkers = [
        _marker("TSH", 5.8, "ELEVATED"),
        _marker("Free T4", 1.2, "OPTIMAL", canonical_name="free_t4"),
    ]

    result = build_clinical_contradictions(biomarkers)

    ids = [c["id"] for c in result["contradictions"]]
    assert "tsh_ft4_subclinical_signal" in ids
    rule = next(c for c in result["contradictions"] if c["id"] == "tsh_ft4_subclinical_signal")
    assert rule["domain"] == "thyroid"


def test_missing_thyroid_context_rule_fires_with_symptoms():
    biomarkers = [_marker("TSH", 3.0, "OPTIMAL")]
    symptoms = ["fatigue", "hair_loss"]

    result = build_clinical_contradictions(biomarkers, symptoms=symptoms)

    ids = [c["id"] for c in result["contradictions"]]
    assert "thyroid_symptoms_missing_context" in ids
    rule = next(c for c in result["contradictions"] if c["id"] == "thyroid_symptoms_missing_context")
    assert "free T3" in rule["recommended_next_tests"]


def test_missing_thyroid_context_rule_does_not_fire_without_symptoms():
    biomarkers = [_marker("TSH", 3.0, "OPTIMAL")]

    result = build_clinical_contradictions(biomarkers, symptoms=[])

    ids = [c["id"] for c in result["contradictions"]]
    assert "thyroid_symptoms_missing_context" not in ids


def test_missing_thyroid_context_rule_does_not_fire_when_panel_complete():
    biomarkers = [
        _marker("TSH", 3.0, "OPTIMAL"),
        _marker("Free T3", 3.1, "OPTIMAL", canonical_name="free_t3"),
        _marker("TPO Antibodies", 10, "OPTIMAL", canonical_name="tpo_antibodies"),
        _marker("TgAb", 5, "OPTIMAL", canonical_name="thyroglobulin_antibodies"),
    ]

    result = build_clinical_contradictions(biomarkers, symptoms=["fatigue", "hair_loss"])

    ids = [c["id"] for c in result["contradictions"]]
    assert "thyroid_symptoms_missing_context" not in ids


def test_ldl_apob_mismatch():
    biomarkers = [
        _marker("LDL", 95, "OPTIMAL", canonical_name="ldl"),
        _marker("ApoB", 130, "ELEVATED", canonical_name="apob"),
    ]

    result = build_clinical_contradictions(biomarkers)

    ids = [c["id"] for c in result["contradictions"]]
    assert "ldl_apob_mismatch" in ids


def test_triglycerides_low_hdl_pattern():
    biomarkers = [
        _marker("Triglycerides", 220, "ELEVATED"),
        _marker("HDL", 32, "DEFICIENT"),
        _marker("Total Cholesterol", 180, "OPTIMAL", canonical_name="total_cholesterol"),
    ]

    result = build_clinical_contradictions(biomarkers)

    ids = [c["id"] for c in result["contradictions"]]
    assert "high_triglycerides_low_hdl" in ids


def test_liver_markers_with_supplement_context_flags_doctor():
    biomarkers = [
        _marker("ALT", 80, "ELEVATED"),
        _marker("AST", 75, "ELEVATED"),
    ]

    result = build_clinical_contradictions(biomarkers, supplement_context=["milk thistle"])

    rule = next(c for c in result["contradictions"] if c["id"] == "elevated_liver_markers_supplement_context")
    assert rule["doctor_flag"] is True
    assert result["summary"]["doctor_flagged_count"] >= 1


def test_crp_with_multiple_nonspecific_symptoms():
    biomarkers = [_marker("CRP", 9.5, "ELEVATED")]
    symptoms = ["fatigue", "joint_pain", "brain_fog"]

    result = build_clinical_contradictions(biomarkers, symptoms=symptoms)

    ids = [c["id"] for c in result["contradictions"]]
    assert "crp_elevated_nonspecific_symptoms" in ids


def test_related_patterns_and_hypotheses_are_cross_referenced_by_domain():
    biomarkers = [
        _marker("Ferritin", 120, "OPTIMAL"),
        _marker("CRP", 8.0, "ELEVATED"),
    ]
    patterns = [{"pattern_id": "iron_availability_pattern", "domain": "iron_anemia"}]
    hypotheses = [{"hypothesis_id": "possible_functional_iron_deficiency", "domain": "iron_anemia"}]

    result = build_clinical_contradictions(biomarkers, patterns=patterns, hypotheses=hypotheses)

    rule = next(c for c in result["contradictions"] if c["id"] == "ferritin_inflammation_context")
    assert rule["related_patterns"] == ["iron_availability_pattern"]
    assert rule["related_hypotheses"] == ["possible_functional_iron_deficiency"]


def test_malformed_marker_values_do_not_crash():
    biomarkers = [
        {"name": "Ferritin", "value": "not_a_number", "status": "OPTIMAL"},
        {"name": "CRP", "value": None, "status": "ELEVATED"},
        "not_a_dict",
        None,
        42,
        {},
    ]

    result = build_clinical_contradictions(biomarkers)

    assert isinstance(result["contradictions"], list)


def test_summary_domains_are_deduped_and_sorted():
    biomarkers = [
        _marker("Ferritin", 120, "OPTIMAL"),
        _marker("CRP", 8.0, "ELEVATED"),
        _marker("TSH", 5.8, "ELEVATED"),
        _marker("Free T4", 1.2, "OPTIMAL", canonical_name="free_t4"),
    ]

    result = build_clinical_contradictions(biomarkers)

    assert result["summary"]["domains"] == sorted(result["summary"]["domains"])
    assert len(result["summary"]["domains"]) == len(set(result["summary"]["domains"]))
