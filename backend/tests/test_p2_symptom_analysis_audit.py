from scripts.audit_symptom_analysis import build_p2_audit


def test_frozen_p2_audit_validates_versions_matrix_and_synthesis_parity():
    report = {
        "upload_id": "upload-1",
        "created_at": "2026-10-04T10:00:00+00:00",
        "status": "completed",
        "input_snapshot": {
            "version_provenance": {"symptom_analysis_version": "symptom_analysis_v1"},
            "symptom_analysis": {
                "version": "symptom_analysis_v1",
                "matrix_version": "symptom_concept_matrix_v1",
                "status": "applied",
                "concepts": [{"concept_id": "fatigue", "mapping_status": "mapped"}],
                "matrix": [{
                    "symptom_concept_id": "fatigue",
                    "hypotheses": [{
                        "hypothesis_id": "iron_status_context",
                        "domain": "iron_status",
                        "confirming_marker_ids": ["ferritin"],
                    }],
                }],
                "priority_effects": [{"hypothesis_id": "iron_status_context"}],
                "conclusion_change": {"changed": True},
            },
            "case_synthesis": {"symptom_impact": {"changed": True}},
        },
    }

    audit = build_p2_audit(report)

    assert audit["smoke_ok"] is True
    assert audit["mapped_concept_count"] == 1
    assert audit["linked_hypothesis_count"] == 1
    assert audit["confirming_marker_count"] == 1


def test_frozen_p2_audit_rejects_missing_contract():
    audit = build_p2_audit({"upload_id": "upload-1", "input_snapshot": {}})
    assert audit["smoke_ok"] is False
    assert "symptom_analysis_version_missing" in audit["failures"]
    assert "concept_matrix_version_missing" in audit["failures"]
