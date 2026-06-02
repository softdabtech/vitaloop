from app.routers.analysis import analyze as analyze_router


def test_sanitize_extracted_biomarkers_filters_invalid_and_defaults_status():
    raw = [
        {"name": "Vitamin D", "value": "24.5", "unit": "ng/mL"},
        {"display_name": "Ferritin", "value": 18, "unit": "ng/mL", "status": "low"},
        {"name": "", "value": 10, "unit": "mg/dL"},
        {"name": "CRP", "value": None, "unit": "mg/L"},
        {"name": "TSH", "value": "n/a", "unit": "mIU/L"},
        "not-a-dict",
    ]

    result = analyze_router._sanitize_extracted_biomarkers(raw)

    assert len(result) == 2

    assert result[0]["name"] == "Vitamin D"
    assert result[0]["value"] == 24.5
    assert result[0]["status"] == "OPTIMAL"
    assert result[0]["category"] == "vitamins"

    assert result[1]["name"] == "Ferritin"
    assert result[1]["value"] == 18.0
    assert result[1]["status"] == "DEFICIENT"


def test_sanitize_extracted_biomarkers_accepts_openai_result_shapes():
    raw = [
        {"name": "Glucose", "value": "126 mg/dL", "reference_range": "70-99 mg/dL"},
        {"name": "HbA1c", "result": 5.8, "unit": "%", "reference_range": "4.8-5.6"},
        {"name": "Ferritin", "result": "12", "unit": "ng/mL", "reference_range": "30-150"},
    ]

    result = analyze_router._sanitize_extracted_biomarkers(raw)

    assert len(result) == 3
    assert result[0]["name"] == "Glucose"
    assert result[0]["value"] == 126.0
    assert result[0]["unit"] == "mg/dL"
    assert result[0]["ref_low"] == 70.0
    assert result[0]["ref_high"] == 99.0
    assert result[0]["status"] == "ELEVATED"
    assert result[1]["value"] == 5.8
    assert result[1]["unit"] == "%"
    assert result[2]["value"] == 12.0


def test_sanitize_extracted_biomarkers_maps_statuses_to_db_allowed_values():
    raw = [
        {"name": "LDL", "value": 142, "unit": "mg/dL", "status": "high"},
        {"name": "Glucose", "value": 95, "unit": "mg/dL", "status": "in range"},
        {"name": "CRP", "value": 12, "unit": "mg/L", "status": "unknown"},
    ]

    result = analyze_router._sanitize_extracted_biomarkers(raw)

    assert [item["status"] for item in result] == ["ELEVATED", "OPTIMAL", "OPTIMAL"]


def test_sanitize_extracted_biomarkers_recalculates_status_from_reference_range():
    raw = [
        {"name": "Ferritin", "value": 12, "unit": "ng/mL", "reference_range": "30-150 ng/mL", "status": "normal"},
        {"name": "LDL Cholesterol", "value": 142, "unit": "mg/dL", "ref_low": 0, "ref_high": 99, "status": "optimal", "category": "lipids"},
    ]

    result = analyze_router._sanitize_extracted_biomarkers(raw)

    assert result[0]["status"] == "DEFICIENT"
    assert result[0]["ref_low"] == 30.0
    assert result[0]["ref_high"] == 150.0
    assert result[0]["category"] == "minerals"
    assert result[1]["status"] == "ELEVATED"
