import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user, require_freemium_analyze
from app.main import app
from app.routers.analysis import analyze as analyze_router


@pytest.mark.asyncio
async def test_analyze_accepts_legacy_multipart_payload(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_quota_check(_user_id, _entry_type):
        return True, "ok", None

    async def fake_pdf_analyze(_temp_path, symptoms=None):
        return {
            "success": True,
            "analysis_method": "claude_pdf",
            "analysis_time": 0.1,
            "summary": {},
            "top_priority": [],
            "retest_schedule": [],
            "protocol": [],
            "biomarkers": [
                {
                    "name": "Ferritin",
                    "value": 22.0,
                    "unit": "ng/mL",
                    "ref_low": 30.0,
                    "ref_high": 300.0,
                    "status": "BORDERLINE",
                    "category": "minerals",
                }
            ],
        }

    async def fake_save_lab_upload(**_kwargs):
        return {"id": str(uuid.uuid4())}

    async def fake_save_biomarkers(upload_id, user_id, biomarkers):
        return [
            {
                "id": str(uuid.uuid4()),
                "upload_id": upload_id,
                "user_id": user_id,
                **biomarkers[0],
            }
        ]

    async def fake_save_timeline_event(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        analyze_router.biomarker_service,
        "check_freemium_biomarker_quota",
        fake_quota_check,
    )
    monkeypatch.setattr(analyze_router.pdf_analyzer, "analyze_lab_pdf", fake_pdf_analyze)
    monkeypatch.setattr(analyze_router, "save_lab_upload", fake_save_lab_upload)
    monkeypatch.setattr(analyze_router, "save_biomarkers", fake_save_biomarkers)
    monkeypatch.setattr(analyze_router, "save_timeline_event", fake_save_timeline_event)

    fake_user = {"sub": user_id, "email": "legacy@test.local"}
    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[require_freemium_analyze] = lambda: fake_user

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/analyze",
                files={"file": ("report.pdf", b"%PDF-1.4 test", "application/pdf")},
                data={"lab_name": "Quest", "symptoms": "fatigue"},
            )

        assert response.status_code == 200
        body = response.json()
        assert body.get("upload_id")
        assert len(body.get("biomarkers", [])) == 1
    finally:
        app.dependency_overrides.clear()
