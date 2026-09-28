from app.services.symptom_metrics import (
    _reset_symptom_metrics_for_tests,
    record_provider_call,
    record_provider_error,
    record_mapping_miss,
    record_lab_analysis_snapshot,
    record_session_terminal,
    render_symptom_metrics,
)


def test_symptom_metrics_are_low_cardinality_and_contain_no_medical_content():
    _reset_symptom_metrics_for_tests()
    record_provider_call(endpoint="diagnosis", status=200, duration_seconds=0.25)
    record_provider_error(error_type="InfermedicaUnavailableError")
    record_session_terminal(
        status="completed",
        locale="en",
        safety_level="clinician_review",
        question_count=4,
    )
    record_mapping_miss(model="infermedica-en")
    record_lab_analysis_snapshot(
        source="b2c_file",
        snapshot={
            "evidence": {
                "present": [{"vitaloop_concept_id": "must-not-be-rendered"}],
                "absent": [],
                "unknown": [{}],
            }
        },
    )

    rendered = render_symptom_metrics()

    assert 'infermedica_requests_total{endpoint="diagnosis",status="200"} 1' in rendered
    assert 'infermedica_errors_total{type="InfermedicaUnavailableError"} 1' in rendered
    assert 'symptom_check_sessions_total{locale="en",status="completed"} 1' in rendered
    assert 'symptom_check_questions_count_bucket{le="5",locale="en"} 1' in rendered
    assert 'symptom_check_completion_rate{locale="en"} 1.000000' in rendered
    assert 'symptom_mapping_miss_total{model="infermedica-en"} 1' in rendered
    assert 'lab_analyses_with_symptom_snapshot_total{present="true",source="b2c_file"} 1' in rendered
    assert 'symptom_snapshot_evidence_count_sum{choice="present"} 1' in rendered
    assert "fatigue" not in rendered.lower()
    assert "shortness of breath" not in rendered.lower()
    assert "provider_concept_id" not in rendered.lower()
    assert "must-not-be-rendered" not in rendered.lower()
