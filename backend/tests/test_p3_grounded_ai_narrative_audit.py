from scripts.audit_grounded_ai_narrative import build_p3_audit


def test_p3_audit_accepts_complete_grounded_contract():
    narrative = {
        "version": "grounded_ai_narrative_v1",
        "status": "complete",
        "source": "llm_selection",
        "prompt_version": "grounded_narrative_selection_v1",
        "personalized_summary": [
            {
                "text": "Ferritin is 9 ng/mL.",
                "evidence_ids": ["biomarker:canonical_ferritin:observed"],
            }
        ],
        "key_connections": [],
        "symptom_lab_correlations": [],
        "ranked_explanations": [],
        "uncertainties": [],
        "next_actions": [],
        "clinician_questions": [],
        "retest_plan": [],
        "evidence_links": [
            {
                "evidence_id": "biomarker:canonical_ferritin:observed",
                "type": "biomarker",
                "id": "canonical_ferritin",
            }
        ],
        "grounding": {"all_statements_grounded": True, "fallback_used": False},
    }
    report = {
        "upload_id": "upload-p3",
        "created_at": "2026-10-04T10:00:00+00:00",
        "status": "completed",
        "input_snapshot": {
            "grounded_ai_narrative": narrative,
            "version_provenance": {
                "grounded_ai_narrative_version": "grounded_ai_narrative_v1"
            },
        },
    }

    audit = build_p3_audit(report)

    assert audit["smoke_ok"] is True
    assert audit["statement_count"] == 1
    assert audit["evidence_count"] == 1
    assert audit["source"] == "llm_selection"


def test_p3_audit_rejects_missing_contract_and_unlinked_evidence():
    report = {
        "upload_id": "upload-p3",
        "input_snapshot": {
            "grounded_ai_narrative": {
                "version": "wrong",
                "personalized_summary": [{"text": "Unsupported", "evidence_ids": ["missing"]}],
                "key_connections": [],
                "symptom_lab_correlations": [],
                "ranked_explanations": [],
                "uncertainties": [],
                "next_actions": [],
                "clinician_questions": [],
                "retest_plan": [],
                "evidence_links": [],
                "grounding": {"all_statements_grounded": False},
            }
        },
    }

    audit = build_p3_audit(report)

    assert audit["smoke_ok"] is False
    assert "grounded_ai_narrative_version_missing" in audit["failures"]
    assert "evidence_registry_mismatch" in audit["failures"]
    assert "grounding_not_confirmed" in audit["failures"]
