from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.services import symptom_check_service as service


@pytest.mark.asyncio
async def test_fastapi_symptom_interview_contract_and_safe_read_models(monkeypatch):
    user_id = str(uuid4())
    session_id = str(uuid4())
    calls = []

    monkeypatch.setattr(service, "require_symptom_engine_access", lambda _user_id: None)

    async def create_session(*, user_id, request):
        calls.append(("create", user_id, request.primary_concern_id))
        return {
            "created": True,
            "session": {
                "id": session_id,
                "status": "active",
                "stage": 1,
                "initial_options": [{"id": "fatigue", "label": "Fatigue"}],
            },
        }

    async def initial_evidence(*, user_id, session_id, request):
        calls.append(("initial", user_id, session_id, request.primary_concept_id))
        return {
            "session": {
                "id": session_id,
                "status": "active",
                "stage": 2,
                "question": {
                    "id": "q-1",
                    "source": "diagnosis",
                    "items": [{"id": "s_1", "choices": [{"id": "present"}]}],
                },
            }
        }

    async def answer(*, user_id, session_id, request, idempotency_key):
        calls.append(("answer", user_id, session_id, idempotency_key, request.question_id))
        return {
            "session": {
                "id": session_id,
                "status": "completed",
                "stage": 3,
                "question": None,
                "safety": {"level": "clinician_review", "interrupt": False},
            }
        }

    async def summary(*, user_id, session_id):
        calls.append(("summary", user_id, session_id))
        return {
            "summary": {
                "session_id": session_id,
                "status": "completed",
                "evidence": {
                    "present": [{"id": "fatigue", "label": "Fatigue", "choice": "present"}],
                    "absent": [],
                    "unknown": [],
                },
                "safety": {"level": "clinician_review", "interrupt": False},
            }
        }

    async def history(*, user_id, limit):
        calls.append(("history", user_id, limit))
        return {"items": [{"session_id": session_id, "status": "completed"}]}

    monkeypatch.setattr(service, "create_or_resume_session", create_session)
    monkeypatch.setattr(service, "submit_initial_evidence", initial_evidence)
    monkeypatch.setattr(service, "submit_answers", answer)
    monkeypatch.setattr(service, "get_session_summary", summary)
    monkeypatch.setattr(service, "get_session_history", history)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            created = await client.post(
                "/symptom-check/sessions",
                json={
                    "overall_wellbeing": "reduced",
                    "primary_concern_id": "fatigue_low_energy",
                    "locale": "en",
                },
            )
            initial = await client.post(
                f"/symptom-check/sessions/{session_id}/initial-evidence",
                json={"primary_concept_id": "fatigue", "duration_bucket": "weeks_1_4"},
            )
            missing_key = await client.post(
                f"/symptom-check/sessions/{session_id}/answers",
                json={
                    "question_id": "q-1",
                    "answers": [{"item_id": "s_1", "choice_id": "present"}],
                },
            )
            answered = await client.post(
                f"/symptom-check/sessions/{session_id}/answers",
                headers={"X-Idempotency-Key": "request-key-123"},
                json={
                    "question_id": "q-1",
                    "answers": [{"item_id": "s_1", "choice_id": "present"}],
                },
            )
            summary_response = await client.get(
                f"/symptom-check/sessions/{session_id}/summary"
            )
            history_response = await client.get("/symptom-check/history?limit=10")
    finally:
        app.dependency_overrides.clear()

    assert created.status_code == 200
    assert initial.status_code == 200
    assert missing_key.status_code == 422
    assert answered.status_code == 200
    assert summary_response.status_code == 200
    assert history_response.status_code == 200
    combined = summary_response.text + history_response.text
    assert "condition_candidates" not in combined
    assert "probability" not in combined
    assert ("answer", user_id, session_id, "request-key-123", "q-1") in calls
    assert ("history", user_id, 10) in calls


@pytest.mark.asyncio
async def test_fastapi_rejects_free_text_medical_fields(monkeypatch):
    monkeypatch.setattr(service, "require_symptom_engine_access", lambda _user_id: None)
    app.dependency_overrides[get_current_user] = lambda: {"sub": str(uuid4())}
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/symptom-check/sessions",
                json={
                    "overall_wellbeing": "reduced",
                    "primary_concern_id": "fatigue_low_energy",
                    "locale": "en",
                    "medical_details": "arbitrary free text",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
