import uuid

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.dependencies import get_current_user, require_freemium_analyze, require_active_subscription
from app.routers.analysis import analyze as analyze_router
from app.routers.protocol import protocol as protocol_router


@pytest.mark.asyncio
async def test_e2e_upload_analyze_protocol(monkeypatch):
    fake_user_id = "11111111-1111-1111-1111-111111111111"
    state = {
        "uploads": {},
        "biomarkers": {},
        "protocols": [],
        "protocol_calls": 0,
    }

    async def fake_save_lab_upload(
        user_id,
        extracted_text,
        lab_name=None,
        test_date=None,
        ocr_confidence=None,
        analyze_prompt_version=None,
    ):
        upload_id = str(uuid.uuid4())
        state["uploads"][upload_id] = {
            "id": upload_id,
            "user_id": user_id,
            "extracted_text": extracted_text,
            "lab_name": lab_name,
            "test_date": test_date,
            "ocr_confidence": ocr_confidence,
            "analyze_prompt_version": analyze_prompt_version,
        }
        return {"id": upload_id}

    async def fake_extract_biomarkers(text, symptoms):
        return [
            {
                "name": "Vitamin D (25-OH)",
                "value": 18.0,
                "unit": "ng/mL",
                "ref_low": 30.0,
                "ref_high": 100.0,
                "status": "DEFICIENT",
                "category": "vitamins",
            },
            {
                "name": "Ferritin",
                "value": 22.0,
                "unit": "ng/mL",
                "ref_low": 30.0,
                "ref_high": 300.0,
                "status": "BORDERLINE",
                "category": "minerals",
            },
        ]

    async def fake_save_biomarkers(upload_id, user_id, biomarkers):
        rows = []
        for item in biomarkers:
            row = {
                "id": str(uuid.uuid4()),
                "upload_id": upload_id,
                "user_id": user_id,
                **item,
            }
            rows.append(row)
        state["biomarkers"][upload_id] = rows
        return rows

    async def fake_get_biomarkers_by_upload(upload_id, user_id):
        return state["biomarkers"].get(upload_id, [])

    async def fake_get_protocol_by_upload(user_id, upload_id):
        for protocol in state["protocols"]:
            if protocol["user_id"] == user_id and protocol["upload_id"] == upload_id:
                return protocol
        return None

    async def fake_generate_protocol(biomarkers, symptoms):
        state["protocol_calls"] += 1
        assert len(biomarkers) > 0
        return [
            {
                "supplement": "Vitamin D3",
                "dosage": "5000 IU",
                "timing": "morning_with_food",
                "priority": "HIGH",
                "rationale": "Vitamin D is below reference range.",
                "iherb_search": "Vitamin D3 5000 IU",
            }
        ]

    async def fake_save_protocol(user_id, upload_id, recommendations, prompt_version=None):
        existing = [p for p in state["protocols"] if p["user_id"] == user_id and p["upload_id"] == upload_id]
        if existing:
            existing[0]["recommendations"] = recommendations
            return existing[0]

        protocol = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "upload_id": upload_id,
            "recommendations": recommendations,
        }
        state["protocols"].append(protocol)
        return protocol

    async def fake_assert_upload_belongs_to_user(upload_id, user_id):
        upload = state["uploads"].get(upload_id)
        if not upload or upload["user_id"] != user_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail={"detail": "Upload not found", "code": "UPLOAD_NOT_FOUND"})
        return upload

    def fake_iherb_url(query):
        return f"https://www.iherb.com/search?kw={query}&rcode=TEST"

    async def fake_save_timeline_event(user_id, event_type, summary, metadata=None):
        return {
            "user_id": user_id,
            "event_type": event_type,
            "summary": summary,
            "metadata": metadata or {},
        }

    monkeypatch.setattr(analyze_router, "save_lab_upload", fake_save_lab_upload)
    monkeypatch.setattr(analyze_router, "extract_biomarkers", fake_extract_biomarkers)
    monkeypatch.setattr(analyze_router, "save_biomarkers", fake_save_biomarkers)
    monkeypatch.setattr(analyze_router, "save_timeline_event", fake_save_timeline_event)

    monkeypatch.setattr(protocol_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(protocol_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(protocol_router, "generate_protocol", fake_generate_protocol)
    monkeypatch.setattr(protocol_router, "save_protocol", fake_save_protocol)
    monkeypatch.setattr(protocol_router, "build_iherb_url", fake_iherb_url)
    monkeypatch.setattr(protocol_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)

    fake_user = {
        "sub": fake_user_id,
        "email": "e2e@vitaloop.test",
    }

    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[require_freemium_analyze] = lambda: fake_user
    app.dependency_overrides[require_active_subscription] = lambda: fake_user

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            analyze_response = await client.post(
                "/analyze",
                json={
                    "extracted_text": "Quest Diagnostics report text ... Vitamin D 18 ng/mL Ferritin 22 ng/mL",
                    "lab_name": "Quest",
                    "symptoms": ["fatigue"],
                },
            )

            assert analyze_response.status_code == 200
            analyze_json = analyze_response.json()
            assert "upload_id" in analyze_json
            assert len(analyze_json["biomarkers"]) == 2

            protocol_response = await client.post(
                "/protocol",
                json={
                    "upload_id": analyze_json["upload_id"],
                    "symptoms": ["fatigue"],
                },
            )

            assert protocol_response.status_code == 200
            protocol_json = protocol_response.json()
            assert protocol_json["user_id"] == fake_user_id
            assert protocol_json["upload_id"] == analyze_json["upload_id"]
            assert len(protocol_json["recommendations"]) == 1
            assert "iherb_url" in protocol_json["recommendations"][0]

            protocol_second_response = await client.post(
                "/protocol",
                json={
                    "upload_id": analyze_json["upload_id"],
                    "symptoms": ["fatigue"],
                },
            )

            assert protocol_second_response.status_code == 200
            protocol_second_json = protocol_second_response.json()
            assert protocol_second_json == protocol_json
            assert state["protocol_calls"] == 1

            # DoD check: valid token but чужой upload_id -> denied
            foreign_upload_id = str(uuid.uuid4())
            protocol_forbidden = await client.post(
                "/protocol",
                json={"upload_id": foreign_upload_id, "symptoms": ["fatigue"]},
            )
            assert protocol_forbidden.status_code == 404
            forbidden_json = protocol_forbidden.json()
            assert forbidden_json["code"] == "UPLOAD_NOT_FOUND"
    finally:
        app.dependency_overrides.clear()
