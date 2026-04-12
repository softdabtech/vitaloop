import asyncio
import uuid
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from httpx import AsyncClient, ASGITransport

from app.main import app
from app.dependencies import get_current_user
from app.routers import analyze as analyze_router
from app.routers import protocol as protocol_router


async def run() -> None:
    fake_user_id = "22222222-2222-2222-2222-222222222222"
    state = {
        "biomarkers": {},
    }

    async def fake_save_lab_upload(user_id, extracted_text, lab_name=None, test_date=None, ocr_confidence=None):
        return {"id": str(uuid.uuid4())}

    async def fake_extract_biomarkers(text, symptoms):
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

    async def fake_get_biomarkers_by_upload(upload_id):
        return state["biomarkers"].get(upload_id, [])

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

    async def fake_save_protocol(user_id, upload_id, recommendations):
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

    protocol_router.get_biomarkers_by_upload = fake_get_biomarkers_by_upload
    protocol_router.generate_protocol = fake_generate_protocol
    protocol_router.save_protocol = fake_save_protocol
    protocol_router.build_iherb_url = fake_iherb_url

    app.dependency_overrides[get_current_user] = lambda: {"sub": fake_user_id, "email": "smoke@vitaloop.test"}

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            analyze_response = await client.post(
                "/analyze",
                json={
                    "extracted_text": "Lab report text with Vitamin D result and basic panel data...",
                    "lab_name": "LabCorp",
                    "symptoms": ["fatigue"],
                },
            )
            analyze_response.raise_for_status()
            upload_id = analyze_response.json()["upload_id"]

            protocol_response = await client.post(
                "/protocol",
                json={"upload_id": upload_id, "symptoms": ["fatigue"]},
            )
            protocol_response.raise_for_status()
            protocol = protocol_response.json()

            print("E2E smoke OK")
            print(f"upload_id={upload_id}")
            print(f"supplements={len(protocol['recommendations'])}")
    finally:
        app.dependency_overrides.clear()


if __name__ == "__main__":
    asyncio.run(run())
