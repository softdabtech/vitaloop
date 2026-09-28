"""Authenticated API for the server-owned structured symptom check."""

from typing import Literal

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import get_current_user
from app.schemas.symptom_check import (
    CreateSymptomSessionRequest,
    InitialEvidenceRequest,
    SubmitSymptomAnswersRequest,
)
from app.services import symptom_check_service as symptom_service


router = APIRouter(prefix="/symptom-check", tags=["symptom-check"])


def _user_id(current_user: dict) -> str:
    return str(current_user["sub"])


@router.get("/catalog/root-concerns")
async def get_root_concerns(
    locale: Literal["en", "uk"] = "en",
    current_user: dict = Depends(get_current_user),
):
    user_id = _user_id(current_user)
    symptom_service.require_symptom_engine_access(user_id)
    return await symptom_service.get_root_concern_catalog(locale=locale)


@router.post("/sessions")
async def create_session(
    request: CreateSymptomSessionRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = _user_id(current_user)
    symptom_service.require_symptom_engine_access(user_id)
    return await symptom_service.create_or_resume_session(user_id=user_id, request=request)


@router.get("/sessions/current")
async def get_current_session(current_user: dict = Depends(get_current_user)):
    user_id = _user_id(current_user)
    symptom_service.require_symptom_engine_access(user_id)
    return await symptom_service.get_current_session(user_id=user_id)


@router.get("/sessions/{session_id}/summary")
async def get_session_summary(session_id: str, current_user: dict = Depends(get_current_user)):
    user_id = _user_id(current_user)
    symptom_service.require_symptom_engine_access(user_id)
    return await symptom_service.get_session_summary(user_id=user_id, session_id=session_id)


@router.get("/history")
async def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    user_id = _user_id(current_user)
    symptom_service.require_symptom_engine_access(user_id)
    return await symptom_service.get_session_history(user_id=user_id, limit=limit)


@router.post("/sessions/{session_id}/initial-evidence")
async def submit_initial_evidence(
    session_id: str,
    request: InitialEvidenceRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = _user_id(current_user)
    symptom_service.require_symptom_engine_access(user_id)
    return await symptom_service.submit_initial_evidence(
        user_id=user_id, session_id=session_id, request=request
    )


@router.post("/sessions/{session_id}/answers")
async def submit_answers(
    session_id: str,
    request: SubmitSymptomAnswersRequest,
    idempotency_key: str = Header(..., alias="X-Idempotency-Key", min_length=8, max_length=200),
    current_user: dict = Depends(get_current_user),
):
    user_id = _user_id(current_user)
    symptom_service.require_symptom_engine_access(user_id)
    return await symptom_service.submit_answers(
        user_id=user_id,
        session_id=session_id,
        request=request,
        idempotency_key=idempotency_key,
    )


@router.post("/sessions/{session_id}/skip")
async def skip_session(session_id: str, current_user: dict = Depends(get_current_user)):
    user_id = _user_id(current_user)
    symptom_service.require_symptom_engine_access(user_id)
    return await symptom_service.skip_session(user_id=user_id, session_id=session_id)


@router.post("/sessions/{session_id}/abandon")
async def abandon_session(session_id: str, current_user: dict = Depends(get_current_user)):
    user_id = _user_id(current_user)
    symptom_service.require_symptom_engine_access(user_id)
    return await symptom_service.abandon_session(user_id=user_id, session_id=session_id)
