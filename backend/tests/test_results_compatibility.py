import uuid

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.protocol import compatibility as compatibility_router


@pytest.mark.asyncio
async def test_results_by_upload_success(monkeypatch):
    fake_user_id = "11111111-1111-1111-1111-111111111111"
    upload_id = str(uuid.uuid4())

    async def fake_assert_upload_belongs_to_user(request_upload_id, user_id):
        assert request_upload_id == upload_id
        assert user_id == fake_user_id
        return {"id": upload_id, "user_id": user_id}

    async def fake_get_biomarkers_by_upload(request_upload_id, user_id):
        assert request_upload_id == upload_id
        assert user_id == fake_user_id
        return [
            {
                "name": "Vitamin D",
                "value": 22,
                "unit": "ng/mL",
                "status": "DEFICIENT",
                "ref_low": 30,
                "ref_high": 100,
            }
        ]

    async def fake_get_protocol_by_upload(user_id, request_upload_id):
        assert request_upload_id == upload_id
        assert user_id == fake_user_id
        return {
            "id": str(uuid.uuid4()),
            "upload_id": upload_id,
            "recommendations": [
                {
                    "supplement": "Vitamin D3",
                    "dosage": "5000 IU",
                    "priority": "HIGH",
                }
            ],
        }

    async def fake_get_user_profile(user_id):
        assert user_id == fake_user_id
        return {"height_cm": 178, "weight_kg": 74}

    async def fake_run_lab_analysis_pipeline(**kwargs):
        assert len(kwargs["biomarkers"]) == 1
        assert kwargs["symptoms"] == []
        assert kwargs["user_id"] == fake_user_id
        assert kwargs["analysis_id"] == upload_id
        assert kwargs["persist_knowledge"] is False
        assert kwargs["generate_ai_protocol"] is False
        return {
            "recommendations": [],
            "shopping_links": [{"label": "Vitamin D3", "url": "https://www.iherb.com/search?kw=vitamin+d3"}],
            "knowledge_evaluation": {
                "matched_rules": [
                    {
                        "rule_key": "rule_low_vitamin_d",
                        "name": "Low vitamin D",
                        "explanation": "Vitamin D may require follow-up.",
                        "severity": "moderate",
                        "confidence": 0.7,
                        "requires_doctor": False,
                    }
                ],
                "generated_recommendations": [],
                "requires_doctor": False,
                "confidence": 0.7,
                "safety_alerts": [],
                "source_references": [],
            },
            "knowledge_report": {
                "summary": {"risk_level": "needs_attention"},
                "why_it_matters": [{"title": "Low vitamin D", "source_url": None}],
                "action_plan": [],
                "doctor_discussion": [],
                "retest_plan": [],
                "safety_alerts": [],
            },
        }

    async def fake_get_latest_report_version(_upload_id, _user_id, _locale):
        # Stage 2G: this is the legacy-fallback case — no persisted
        # report_versions row exists yet, so the endpoint must fall back to
        # the live pipeline exactly as it did before this stage.
        return None

    async def fake_has_any_report_version(_upload_id, _user_id):
        return False

    monkeypatch.setattr(compatibility_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(compatibility_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(compatibility_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(compatibility_router, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(compatibility_router, "run_lab_analysis_pipeline", fake_run_lab_analysis_pipeline)
    monkeypatch.setattr(compatibility_router, "get_latest_report_version", fake_get_latest_report_version)
    monkeypatch.setattr(compatibility_router, "has_any_report_version", fake_has_any_report_version)

    fake_user = {"sub": fake_user_id, "email": "results@vitaloop.test"}
    app.dependency_overrides[get_current_user] = lambda: fake_user

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/results/{upload_id}")

        assert response.status_code == 200
        payload = response.json()
        assert payload["upload_id"] == upload_id
        assert len(payload["biomarkers"]) == 1
        assert payload["biomarkers"][0]["name"] == "Vitamin D"
        assert len(payload["protocol"]) == 1
        assert payload["protocol"][0]["supplement"] == "Vitamin D3"
        assert payload["knowledge_report"]["summary"]["risk_level"] == "needs_attention"
        assert payload["knowledge_report"]["why_it_matters"][0]["title"] == "Low vitamin D"
        assert payload["knowledge_report"]["why_it_matters"][0]["source_url"] is None
        assert payload["shopping_links"][0]["label"] == "Vitamin D3"
        assert payload["report_source"] == "legacy_fallback"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_results_by_upload_rejects_foreign_upload(monkeypatch):
    fake_user_id = "11111111-1111-1111-1111-111111111111"
    upload_id = str(uuid.uuid4())

    async def fake_assert_upload_belongs_to_user(request_upload_id, user_id):
        assert request_upload_id == upload_id
        assert user_id == fake_user_id
        raise HTTPException(status_code=404, detail={"detail": "Upload not found", "code": "UPLOAD_NOT_FOUND"})

    monkeypatch.setattr(compatibility_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)

    fake_user = {"sub": fake_user_id, "email": "results@vitaloop.test"}
    app.dependency_overrides[get_current_user] = lambda: fake_user

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/results/{upload_id}")

        assert response.status_code == 404
        payload = response.json()
        assert payload["code"] == "UPLOAD_NOT_FOUND"
        assert payload["detail"] == "Upload not found"
    finally:
        app.dependency_overrides.clear()
