import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.dependencies import get_current_user
from app.routers.analysis import analyze as analyze_router


@pytest.mark.asyncio
async def test_manual_entry_then_results_flow(monkeypatch):
    fake_user_id = "22222222-2222-2222-2222-222222222222"
    fake_upload_id = str(uuid.uuid4())
    state = {
        "saved_protocol": None,
        "saved_candidates": None,
        "saved_biomarkers": [
            {
                "id": str(uuid.uuid4()),
                "upload_id": fake_upload_id,
                "user_id": fake_user_id,
                "name": "Vitamin D (25-OH)",
                "value": 18.0,
                "unit": "ng/mL",
                "ref_low": 30.0,
                "ref_high": 100.0,
                "status": "DEFICIENT",
                "category": "vitamins",
            },
            {
                "id": str(uuid.uuid4()),
                "upload_id": fake_upload_id,
                "user_id": fake_user_id,
                "name": "Ferritin",
                "value": 22.0,
                "unit": "ng/mL",
                "ref_low": 30.0,
                "ref_high": 300.0,
                "status": "BORDERLINE",
                "category": "minerals",
            },
        ],
    }

    async def fake_check_quota(_user_id, _entry_type):
        return True, "", None

    def fake_validate_entries(entries):
        return entries, []

    def fake_convert_to_standard_units(entries):
        return entries

    def fake_format_for_claude_analysis(entries):
        assert len(entries) == 2
        return "Vitamin D 18 ng/mL; Ferritin 22 ng/mL"

    async def fake_create_upload_from_manual_entries(user_id, entries, lab_name=None, test_date=None, notes=None):
        assert user_id == fake_user_id
        assert len(entries) == 2
        assert lab_name == "Home Test"
        return {
            "upload_id": fake_upload_id,
            "biomarkers": state["saved_biomarkers"],
        }

    async def fake_extract_biomarkers(**kwargs):
        assert kwargs.get("lab_name") == "Home Test"
        return {
            "recommendations": [
                {
                    "supplement": "Vitamin D3",
                    "dosage": "5000 IU",
                    "timing": "morning_with_food",
                    "priority": "HIGH",
                    "rationale": "Vitamin D is below reference range.",
                    "iherb_search": "Vitamin D3 5000 IU",
                }
            ]
        }

    async def fake_save_protocol_for_upload(user_id, upload_id, recommendations):
        state["saved_protocol"] = {
            "user_id": user_id,
            "upload_id": upload_id,
            "recommendations": recommendations,
        }

    async def fake_save_biomarker_extraction_candidates(upload_id, user_id, candidates):
        state["saved_candidates"] = candidates
        return candidates

    async def fake_assert_upload_belongs_to_user(upload_id, user_id):
        if upload_id != fake_upload_id or user_id != fake_user_id:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail={"detail": "Upload not found", "code": "UPLOAD_NOT_FOUND"})

    async def fake_get_biomarkers_by_upload(upload_id, user_id):
        if upload_id == fake_upload_id and user_id == fake_user_id:
            return state["saved_biomarkers"]
        return []

    async def fake_get_protocol_by_upload(user_id, upload_id):
        saved = state["saved_protocol"]
        if saved and saved["user_id"] == user_id and saved["upload_id"] == upload_id:
            return saved
        return None

    async def fake_write_audit_log(**_kwargs):
        return None

    async def fake_run_lab_analysis_pipeline(**kwargs):
        if kwargs["source_metadata"]["source"] == "b2c_manual":
            assert kwargs["source_metadata"]["candidates"][0]["status"] == "confirmed"
            assert kwargs["source_metadata"]["candidates"][0]["confidence_score"] == 1.0
        return {
            "knowledge_evaluation": {"matched_rules": []},
            "knowledge_report": {"summary": {}},
            "interpreted_report": {"summary": {}},
            "analysis_input_quality_gate": {
                "decision": "auto_continue",
                "requires_confirmation": False,
                "candidate_summary": {"count": len(kwargs["source_metadata"].get("candidates") or [])},
            },
            "clinical_data_integrity": {"status": "pass"},
            "evidence_gaps": {"gaps": []},
            "protocol": {"nutrition": []},
            "recommendations": [{"title": "Review nutrition basics"}],
            "shopping_links": [],
            "retest_suggestions": [],
            "health_summary": {},
            "safety_result": {"status": "approved"},
            "explainability": {"version": "test"},
            "report_version": {"id": "report-1"},
        }

    monkeypatch.setattr(analyze_router.biomarker_service, "check_freemium_biomarker_quota", fake_check_quota)
    monkeypatch.setattr(analyze_router.biomarker_service, "validate_entries", fake_validate_entries)
    monkeypatch.setattr(analyze_router.biomarker_service, "convert_to_standard_units", fake_convert_to_standard_units)
    monkeypatch.setattr(analyze_router.biomarker_service, "format_for_claude_analysis", fake_format_for_claude_analysis)
    monkeypatch.setattr(analyze_router.biomarker_service, "create_upload_from_manual_entries", fake_create_upload_from_manual_entries)

    monkeypatch.setattr(analyze_router, "is_llm_configured", lambda: True)
    monkeypatch.setattr(analyze_router, "extract_biomarkers", fake_extract_biomarkers)
    monkeypatch.setattr(analyze_router, "save_protocol_for_upload", fake_save_protocol_for_upload)
    monkeypatch.setattr(analyze_router, "save_biomarker_extraction_candidates", fake_save_biomarker_extraction_candidates)
    monkeypatch.setattr(analyze_router, "run_lab_analysis_pipeline", fake_run_lab_analysis_pipeline)
    monkeypatch.setattr(analyze_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(analyze_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(analyze_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(analyze_router, "write_audit_log", fake_write_audit_log)

    fake_user = {"sub": fake_user_id, "email": "manual@vitaloop.test"}
    app.dependency_overrides[get_current_user] = lambda: fake_user

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            manual_resp = await client.post(
                "/analyze/manual",
                json={
                    "lab_name": "Home Test",
                    "biomarkers": [
                        {"biomarker_id": "vitamin_d_25_oh", "value": 18.0, "unit": "ng/mL"},
                        {"biomarker_id": "ferritin", "value": 22.0, "unit": "ng/mL"},
                    ],
                },
            )

            assert manual_resp.status_code == 201
            manual_json = manual_resp.json()
            assert manual_json["upload_id"] == fake_upload_id
            assert len(manual_json["biomarkers"]) == 2
            assert manual_json["analysis_input_quality_gate"]["requires_confirmation"] is False
            assert state["saved_candidates"] is not None
            assert state["saved_candidates"][0]["status"] == "confirmed"
            assert state["saved_protocol"] is not None
            assert len(state["saved_protocol"]["recommendations"]) == 1

            results_resp = await client.get(f"/analyze/{fake_upload_id}")
            assert results_resp.status_code == 200
            results_json = results_resp.json()
            assert len(results_json["biomarkers"]) == 2
            assert len(results_json["protocol"]) == 1
            assert results_json["protocol"][0]["supplement"] == "Vitamin D3"
    finally:
        app.dependency_overrides.clear()
