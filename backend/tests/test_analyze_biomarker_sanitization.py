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
    assert result[0]["status"] == "NORMAL"

    assert result[1]["name"] == "Ferritin"
    assert result[1]["value"] == 18.0
    assert result[1]["status"] == "LOW"
