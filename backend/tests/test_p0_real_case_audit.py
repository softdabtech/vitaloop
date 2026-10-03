import pytest

from app.services.knowledge.integration import evaluate_biomarkers_with_knowledge
from app.services.real_case_audit import build_real_case_audit
from app.services.report_history import assemble_frozen_response


def _report_version():
    return {
        "id": "report-1",
        "upload_id": "upload-1",
        "user_id": "user-1",
        "created_at": "2026-09-29T10:46:56Z",
        "locale": "en",
        "status": "completed",
        "input_snapshot": {
            "biomarkers": [
                {
                    "name": "Creatinine",
                    "canonical_name": "canonical_creatinine",
                    "value": 70,
                    "unit": "umol/L",
                    "status": "OPTIMAL",
                    "reference_source": "lab_report",
                },
                {
                    "name": "TSH (Thyroid Stimulating Hormone)",
                    "canonical_name": "canonical_tsh",
                    "value": 5.1,
                    "unit": "mIU/L",
                    "status": "ELEVATED",
                    "reference_source": "lab_report",
                },
            ],
            "symptom_snapshot": {
                "session_id": "session-1",
                "completed_at": "2026-09-29T09:00:00Z",
                "evidence": [{"vitaloop_concept_id": "fatigue", "choice_id": "present"}],
                "assessment": {"severity": 6, "urgent_warning": "absent"},
            },
            "health_context": {"version": "health_context_v1", "readiness": {"has_profile": True}},
            "health_states": {"version": "health_state_engine_v1", "states": []},
            "trend_analysis": {"version": "trend_engine_v1", "available": False},
            "quality_snapshot": {"version": "analysis_quality_snapshot_v1"},
            "ai_orchestration": {"status": "skipped", "metadata": {"reason": "generate_ai_protocol_disabled"}},
            "cost_metadata": {"ai_total_tokens": 0},
            "clinical_hypotheses": {
                "hypotheses": [{"label": "Thyroid function pattern"}],
            },
            "case_synthesis": {
                "version": "case_synthesis_v1",
                "main_conclusion": [
                    {
                        "text": "TSH needs review.",
                        "evidence": [{"type": "biomarker", "id": "canonical_tsh"}],
                    }
                ],
            },
            "version_provenance": {"pipeline_version": "lab_analysis_pipeline_v2"},
        },
        "knowledge_report": {
            "interpreted_report": {"patterns": [{"id": "thyroid_dysfunction"}]},
        },
        "protocol": {},
        "safety_result": {"status": "approved"},
        "explainability": {
            "knowledge_evaluation": {
                "matched_rules": [],
                "marker_coverage": {
                    "evaluated": ["tsh"],
                    "no_matching_rule": [],
                    "unit_blocked": [],
                    "fired": [],
                },
            }
        },
    }


def test_p0_audit_traces_complete_frozen_case_without_identifiers():
    report = _report_version()
    response = assemble_frozen_response(
        upload_id="upload-1",
        biomarkers=[{"name": "legacy row without canonical id"}],
        protocol_recommendations=[],
        report_version=report,
        user_profile={},
        locale="en",
    )
    audit = build_real_case_audit(
        report_version=report,
        api_response=response,
        extraction_candidates=[{"status": "corrected"}, {"status": "corrected"}],
    )

    assert audit["smoke_ok"] is True
    assert audit["case_fingerprint"] != "upload-1"
    assert "user_id" not in audit
    assert audit["recognized_markers"]["persisted_count"] == 2
    assert all(row["consistent_with_engine_mapping"] for row in audit["recognized_markers"]["markers"])
    assert audit["knowledge_rules"]["eligible_marker_count"] == 1
    assert audit["knowledge_rules"]["excluded_marker_count"] == 1
    assert audit["symptom_snapshot"]["api_exposed"] is True
    assert audit["reasoning"]["pattern_ids"] == ["thyroid_dysfunction"]
    assert audit["ai"]["reason"] == "generate_ai_protocol_disabled"
    assert audit["lost_fields"] == []
    assert response["final_analysis"]["quality_snapshot"]["version"] == "analysis_quality_snapshot_v1"
    assert response["final_analysis"]["biomarkers"][1]["canonical_name"] == "canonical_tsh"
    assert response["case_synthesis"] == report["input_snapshot"]["case_synthesis"]
    assert response["final_analysis"]["case_synthesis"] == response["case_synthesis"]
    assert "final_analysis" not in response["final_analysis"]


def test_p0_audit_fails_when_persisted_engine_output_is_missing_from_api():
    report = _report_version()
    audit = build_real_case_audit(
        report_version=report,
        api_response={"biomarkers": report["input_snapshot"]["biomarkers"]},
        extraction_candidates=[],
    )

    assert audit["smoke_ok"] is False
    assert "quality_snapshot" in audit["lost_fields"]
    assert audit["stages"]["backend_api_ui_transfer"]["status"] == "FAIL"


@pytest.mark.asyncio
async def test_all_normal_markers_return_explicit_kb_exclusions():
    result = await evaluate_biomarkers_with_knowledge(
        biomarkers=[
            {
                "name": "Creatinine",
                "canonical_name": "canonical_creatinine",
                "value": 70,
                "unit": "umol/L",
                "status": "OPTIMAL",
            }
        ],
        symptoms=[],
        user_id=None,
        upload_id=None,
        persist=False,
    )

    assert result is not None
    assert result["marker_coverage"]["excluded"] == ["creatinine"]
    assert result["ineligible_markers"][0]["reason"] == "status=OPTIMAL"
