from app.services.safety.symptom_report_contract import effective_report_safety


def _snapshot(level):
    return {"safety": {"final_level": level}}


def test_symptom_levels_map_to_report_levels():
    expected = {
        "emergency": "immediate",
        "urgent_24h": "high",
        "clinician_review": "medical_review",
        "insufficient_data": "insufficient_data",
        "provider_outage": "insufficient_data",
        "routine": "routine",
    }
    for symptom_level, report_level in expected.items():
        assert effective_report_safety(symptom_snapshot=_snapshot(symptom_level))["risk_level"] == report_level


def test_report_safety_is_monotonic_and_legacy_aliases_are_normalized():
    result = effective_report_safety(
        {"risk_level": "urgent_review"},
        _snapshot("routine"),
    )
    assert result["risk_level"] == "high"

    result = effective_report_safety(
        {"risk_level": "medical_review"},
        _snapshot("urgent_24h"),
    )
    assert result["risk_level"] == "high"

    result = effective_report_safety(
        {"risk_level": "routine"},
        _snapshot("emergency"),
    )
    assert result["risk_level"] == "immediate"