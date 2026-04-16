from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()

QUESTION_BANK = [
    {"id": "energy_daytime", "text": "How stable is your daytime energy?", "dimension": "energy"},
    {"id": "sleep_quality", "text": "How restorative is your sleep this week?", "dimension": "sleep"},
    {"id": "stress_level", "text": "How high has your stress level been recently?", "dimension": "stress"},
    {"id": "digestive_comfort", "text": "How comfortable is your digestion after meals?", "dimension": "digestion"},
    {"id": "focus_clarity", "text": "How clear and focused do you feel during work?", "dimension": "cognition"},
    {"id": "exercise_recovery", "text": "How quickly do you recover after physical activity?", "dimension": "recovery"},
    {"id": "mood_stability", "text": "How stable has your mood been recently?", "dimension": "mood"},
    {"id": "cravings_control", "text": "How well can you control sugar/carbohydrate cravings?", "dimension": "metabolic"},
    {"id": "inflammation_signs", "text": "How often do you notice inflammation-related discomfort?", "dimension": "inflammation"},
    {"id": "motivation_level", "text": "How motivated do you feel to maintain healthy routines?", "dimension": "behavior"},
]

QUESTION_INDEX = {q["id"]: q for q in QUESTION_BANK}


class QuestionnaireAnswerRequest(BaseModel):
    question_id: str
    answer_value: int = Field(..., ge=1, le=10)
    answer_text: Optional[str] = None


class QuestionnaireCompleteRequest(BaseModel):
    mark_onboarding_complete: bool = False


def _is_missing_questionnaire_tables(ex: Exception) -> bool:
    msg = str(ex)
    return "PGRST205" in msg and (
        "questionnaire_sessions" in msg or "questionnaire_answers" in msg
    )


def _normalize_next_question(answered_ids: set[str], answer_map: Dict[str, int]) -> Optional[Dict[str, Any]]:
    # Minimal adaptive ordering for v1: if sleep is low, surface stress/mood sooner.
    dynamic_order = [q["id"] for q in QUESTION_BANK]

    sleep_value = answer_map.get("sleep_quality")
    if sleep_value is not None and sleep_value <= 4:
        boosted = ["stress_level", "mood_stability", "energy_daytime"]
        dynamic_order = boosted + [qid for qid in dynamic_order if qid not in boosted]

    for qid in dynamic_order:
        if qid not in answered_ids:
            return QUESTION_INDEX[qid]
    return None


async def _get_or_create_active_session(user_id: str) -> Dict[str, Any]:
    sb = svc._get_supabase()

    active_resp = await svc._run(
        lambda: sb.table("questionnaire_sessions")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if active_resp.data:
        return active_resp.data[0]

    now = datetime.now(timezone.utc).isoformat()
    create_resp = await svc._run(
        lambda: sb.table("questionnaire_sessions")
        .insert(
            {
                "user_id": user_id,
                "status": "active",
                "started_at": now,
                "model_version": "v1",
                "last_question_order": 0,
            }
        )
        .execute()
    )
    if not create_resp.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to initialize questionnaire session")
    return create_resp.data[0]


async def _get_session_answers(session_id: str) -> list[Dict[str, Any]]:
    sb = svc._get_supabase()
    answers_resp = await svc._run(
        lambda: sb.table("questionnaire_answers")
        .select("*")
        .eq("session_id", session_id)
        .order("question_order", desc=False)
        .execute()
    )
    return answers_resp.data or []


@router.get("/session")
async def get_questionnaire_session(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    try:
        session = await _get_or_create_active_session(user_id)
        answers = await _get_session_answers(session["id"])

        answered_ids = {str(a.get("question_id")) for a in answers if a.get("question_id")}
        answer_map = {str(a.get("question_id")): int(a.get("answer_value") or 0) for a in answers if a.get("question_id")}
        next_question = _normalize_next_question(answered_ids, answer_map)

        await svc.write_audit_log(
            user_id=user_id,
            action="read",
            entity_type="questionnaire_session",
            entity_id=str(session.get("id") or ""),
            new_value={
                "scope": "medical",
                "answered_count": len(answers),
                "remaining_count": max(0, len(QUESTION_BANK) - len(answers)),
            },
        )

        return {
            "session": session,
            "answered_count": len(answers),
            "remaining_count": max(0, len(QUESTION_BANK) - len(answers)),
            "next_question": next_question,
            "completed": next_question is None,
        }
    except HTTPException:
        raise
    except Exception as ex:
        if _is_missing_questionnaire_tables(ex):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Questionnaire storage is not initialized. Apply backend/sql/stage-8-questionnaire.sql",
            )
        raise


@router.post("/answer")
async def submit_questionnaire_answer(
    body: QuestionnaireAnswerRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    if body.question_id not in QUESTION_INDEX:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown question_id")

    try:
        session = await _get_or_create_active_session(user_id)
        answers = await _get_session_answers(session["id"])

        answered_ids = {str(a.get("question_id")) for a in answers if a.get("question_id")}
        if body.question_id in answered_ids:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Question already answered in this session")

        question_order = len(answers) + 1
        sb = svc._get_supabase()
        now = datetime.now(timezone.utc).isoformat()

        await svc._run(
            lambda: sb.table("questionnaire_answers")
            .insert(
                {
                    "session_id": session["id"],
                    "user_id": user_id,
                    "question_id": body.question_id,
                    "question_order": question_order,
                    "answer_value": body.answer_value,
                    "answer_text": body.answer_text,
                    "answered_at": now,
                }
            )
            .execute()
        )

        await svc._run(
            lambda: sb.table("questionnaire_sessions")
            .update({"last_question_order": question_order, "updated_at": now})
            .eq("id", session["id"])
            .execute()
        )

        await svc.write_audit_log(
            user_id=user_id,
            action="create",
            entity_type="questionnaire_answer",
            entity_id=f"{session['id']}:{body.question_id}",
            new_value={
                "scope": "medical",
                "question_id": body.question_id,
                "answer_value": body.answer_value,
            },
        )

        updated_answers = await _get_session_answers(session["id"])
        updated_answered_ids = {str(a.get("question_id")) for a in updated_answers if a.get("question_id")}
        updated_answer_map = {
            str(a.get("question_id")): int(a.get("answer_value") or 0)
            for a in updated_answers
            if a.get("question_id")
        }
        next_question = _normalize_next_question(updated_answered_ids, updated_answer_map)

        return {
            "ok": True,
            "answered_count": len(updated_answers),
            "remaining_count": max(0, len(QUESTION_BANK) - len(updated_answers)),
            "next_question": next_question,
            "completed": next_question is None,
        }
    except HTTPException:
        raise
    except Exception as ex:
        if _is_missing_questionnaire_tables(ex):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Questionnaire storage is not initialized. Apply backend/sql/stage-8-questionnaire.sql",
            )
        raise


@router.post("/complete")
async def complete_questionnaire(
    body: QuestionnaireCompleteRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    try:
        session = await _get_or_create_active_session(user_id)
        now = datetime.now(timezone.utc).isoformat()
        sb = svc._get_supabase()

        completed_resp = await svc._run(
            lambda: sb.table("questionnaire_sessions")
            .update({"status": "completed", "completed_at": now, "updated_at": now})
            .eq("id", session["id"])
            .eq("user_id", user_id)
            .execute()
        )
        completed = completed_resp.data[0] if completed_resp.data else {"id": session["id"], "status": "completed"}

        if body.mark_onboarding_complete:
            await svc.upsert_user_profile(user_id, {"onboarding_complete": True})

        await svc.write_audit_log(
            user_id=user_id,
            action="update",
            entity_type="questionnaire_session",
            entity_id=str(session.get("id") or ""),
            new_value={"scope": "medical", "status": "completed"},
        )

        await svc.save_timeline_event(
            user_id=user_id,
            event_type="questionnaire_completed",
            summary="Adaptive questionnaire completed",
            source="questionnaire:v1",
            metadata={"session_id": session["id"], "model_version": "v1"},
        )

        return {"ok": True, "session": completed}
    except Exception as ex:
        if _is_missing_questionnaire_tables(ex):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Questionnaire storage is not initialized. Apply backend/sql/stage-8-questionnaire.sql",
            )
        raise
