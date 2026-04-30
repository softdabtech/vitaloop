import asyncio
import os
import uuid
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature",
)

from httpx import AsyncClient, ASGITransport

from app.main import app
from app.dependencies import get_current_user, require_freemium_analyze, require_active_subscription
from app.routers.analysis import analyze as analyze_router
from app.routers.protocol import protocol as protocol_router


async def run() -> None:
    fake_user_id = "22222222-2222-2222-2222-222222222222"
    state = {
        "biomarkers": {},
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
        state.setdefault("uploads", {})[upload_id] = {
            "id": upload_id,
            "user_id": user_id,
            "analyze_prompt_version": analyze_prompt_version,
        }
        return {"id": upload_id}

    async def fake_extract_biomarkers(text, symptoms):
        state["extract_calls"] = state.get("extract_calls", 0) + 1
        return [
            {
                "name": "Vitamin D (25-OH)",
                "value": 20.0,
                "unit": "ng/mL",
                "ref_low": 30.0,
                "ref_high": 100.0,
                "status": "DEFICIENT",
                "category": "vitamins",
            }
        ]

    async def fake_save_biomarkers(upload_id, user_id, biomarkers):
        rows = [{"id": str(uuid.uuid4()), "upload_id": upload_id, "user_id": user_id, **b} for b in biomarkers]
        state["biomarkers"][upload_id] = rows
        return rows

    async def fake_save_timeline_event(user_id, event_type, summary, metadata=None, source=None):
        state.setdefault("timeline", []).append(
            {
                "user_id": user_id,
                "event_type": event_type,
                "summary": summary,
                "metadata": metadata or {},
                "source": source,
            }
        )
        return {"ok": True}

    async def fake_assert_upload_belongs_to_user(upload_id, user_id):
        upload = state.get("uploads", {}).get(upload_id)
        if not upload or upload["user_id"] != user_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail={"detail": "Upload not found", "code": "UPLOAD_NOT_FOUND"})
        return upload

    async def fake_get_biomarkers_by_upload(upload_id, user_id):
        return state["biomarkers"].get(upload_id, [])

    async def fake_get_protocol_by_upload(user_id, upload_id):
        return None

    async def fake_generate_protocol(biomarkers, symptoms):
        return [
            {
                "supplement": "Vitamin D3",
                "dosage": "5000 IU",
                "timing": "morning_with_food",
                "priority": "HIGH",
                "rationale": "Low vitamin D.",
                "iherb_search": "Vitamin D3 5000 IU",
            }
        ]

    async def fake_save_protocol(user_id, upload_id, recommendations, prompt_version=None):
        return {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "upload_id": upload_id,
            "recommendations": recommendations,
        }

    def fake_iherb_url(query):
        return f"https://www.iherb.com/search?kw={query}&rcode=E2E"

    analyze_router.save_lab_upload = fake_save_lab_upload
    analyze_router.extract_biomarkers = fake_extract_biomarkers
    analyze_router.save_biomarkers = fake_save_biomarkers
    analyze_router.save_timeline_event = fake_save_timeline_event
    analyze_router.is_llm_configured = lambda: True

    protocol_router.get_biomarkers_by_upload = fake_get_biomarkers_by_upload
    protocol_router.get_protocol_by_upload = fake_get_protocol_by_upload
    protocol_router.generate_protocol = fake_generate_protocol
    protocol_router.save_protocol = fake_save_protocol
    protocol_router.build_iherb_url = fake_iherb_url
    protocol_router.assert_upload_belongs_to_user = fake_assert_upload_belongs_to_user
    protocol_router.is_llm_configured = lambda: True

    fake_user = {"sub": fake_user_id, "email": "smoke@vitaloop.test"}
    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[require_freemium_analyze] = lambda: fake_user
    app.dependency_overrides[require_active_subscription] = lambda: fake_user

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="https://test") as client:
            health_response = await client.get("/health")
            health_response.raise_for_status()
            required_headers = [
                "x-request-id",
                "x-content-type-options",
                "x-frame-options",
                "referrer-policy",
                "permissions-policy",
                "cache-control",
                "strict-transport-security",
            ]
            for header_name in required_headers:
                assert header_name in health_response.headers, f"missing header: {header_name}"

            idem_key = "smoke-idem-key-001"
            analyze_response = await client.post(
                "/analyze",
                json={
                    "extracted_text": "Lab report text with Vitamin D result and basic panel data...",
                    "lab_name": "LabCorp",
                    "symptoms": ["fatigue"],
                },
                headers={"X-Idempotency-Key": idem_key},
            )
            analyze_response.raise_for_status()
            upload_id = analyze_response.json()["upload_id"]

            analyze_cached_response = await client.post(
                "/analyze",
                json={
                    "extracted_text": "Lab report text with Vitamin D result and basic panel data...",
                    "lab_name": "LabCorp",
                    "symptoms": ["fatigue"],
                },
                headers={"X-Idempotency-Key": idem_key},
            )
            analyze_cached_response.raise_for_status()
            cached_upload_id = analyze_cached_response.json()["upload_id"]
            assert cached_upload_id == upload_id
            assert state.get("extract_calls") == 1

            conflict_response = await client.post(
                "/analyze",
                json={
                    "extracted_text": "Lab report text with a DIFFERENT payload and values...",
                    "lab_name": "LabCorp",
                    "symptoms": ["fatigue"],
                },
                headers={"X-Idempotency-Key": idem_key},
            )
            assert conflict_response.status_code == 409

            protocol_response = await client.post(
                "/protocol",
                json={"upload_id": upload_id, "symptoms": ["fatigue"]},
            )
            protocol_response.raise_for_status()
            protocol = protocol_response.json()

            print("E2E smoke OK")
            print(f"upload_id={upload_id}")
            print(f"supplements={len(protocol['recommendations'])}")
            print(f"extract_calls={state.get('extract_calls', 0)}")
    finally:
        app.dependency_overrides.clear()


if __name__ == "__main__":
    asyncio.run(run())
