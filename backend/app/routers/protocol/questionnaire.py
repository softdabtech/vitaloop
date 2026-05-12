from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.services import claude_service

router = APIRouter()

FOLLOWUP_THRESHOLD = 4

QUESTION_BANK: List[Dict[str, Any]] = [
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

QUESTION_INDEX: Dict[str, Dict[str, Any]] = {q["id"]: q for q in QUESTION_BANK}

# Error message constants (S1192 - reduce string duplication)
_INIT_QUESTIONNAIRE_FAILED = "Failed to initialize questionnaire session"
_STORAGE_NOT_INITIALIZED = "Questionnaire storage not initialized."
_INVALID_QUESTION_ID = "Invalid question_id"
_ALREADY_ANSWERED = "Question already answered in this session"
_STORAGE_MIGRATION_NEEDED = "Questionnaire storage not initialized. Apply stage-8 + stage-10 SQL migrations."


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _compute_dimension_scores(answers: List[Dict[str, Any]]) -> Dict[str, float]:
    buckets: Dict[str, List[int]] = {}
    for a in answers:
        qid = str(a.get("question_id", ""))
        val = int(a.get("answer_value") or 0)
        q = QUESTION_INDEX.get(qid)
        if not q or not val:
            continue
        buckets.setdefault(q["dimension"], []).append(val)
    return {dim: round((sum(vals) / len(vals)) * 10, 1) for dim, vals in buckets.items()}


def _compute_completion_score(dimension_scores: Dict[str, float]) -> float:
    WEIGHTS = {
        "energy": 1.2, "sleep": 1.3, "stress": 1.1, "digestion": 1.0,
        "cognition": 1.0, "recovery": 0.9, "mood": 1.1,
        "metabolic": 1.0, "inflammation": 1.1, "behavior": 0.8,
    }
    total_w, weighted = 0.0, 0.0
    for dim, score in dimension_scores.items():
        w = WEIGHTS.get(dim, 1.0)
        weighted += score * w
        total_w += w
    return round(weighted / total_w, 1) if total_w else 0.0


# ---------------------------------------------------------------------------
# Adaptive ordering
# ---------------------------------------------------------------------------

def _next_core_question(answered_ids: set, answer_map: Dict[str, int]) -> Optional[Dict[str, Any]]:
    order = [q["id"] for q in QUESTION_BANK]
    sleep_val = answer_map.get("sleep_quality")
    if sleep_val is not None and sleep_val <= FOLLOWUP_THRESHOLD:
        boosted = ["stress_level", "mood_stability", "energy_daytime"]
        order = boosted + [qid for qid in order if qid not in boosted]
    for qid in order:
        if qid not in answered_ids:
            return QUESTION_INDEX[qid]
    return None


def _next_followup_question(pending: List[Dict[str, Any]], answered_ids: set) -> Optional[Dict[str, Any]]:
    for fq in pending:
        fq_id = fq.get("id") or fq.get("text", "")[:40]
        if fq_id not in answered_ids:
            return {**fq, "_is_followup": True}
    return None


def _get_next_question(answered_ids: set, answer_map: Dict[str, int], pending_followups: List) -> Optional[Dict[str, Any]]:
    fq = _next_followup_question(pending_followups, answered_ids)
    if fq:
        return fq
    return _next_core_question(answered_ids, answer_map)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class QuestionnaireAnswerRequest(BaseModel):
    question_id: str
    answer_value: int = Field(..., ge=1, le=10)
    answer_text: Optional[str] = None


class QuestionnaireCompleteRequest(BaseModel):
    mark_onboarding_complete: bool = False


class QuestionnaireCreateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    questions: Optional[List[Dict[str, Any]]] = None


def _is_missing_questionnaire_tables(ex: Exception) -> bool:
    msg = str(ex)
    return "PGRST205" in msg and (
        "questionnaire_sessions" in msg or "questionnaire_answers" in msg
    )


async def _get_or_create_active_session(user_id: str) -> Dict[str, Any]:
    sb = svc._get_supabase()
    resp = await svc._run(
        lambda: sb.table("questionnaire_sessions")
        .select("*").eq("user_id", user_id).eq("status", "active")
        .order("created_at", desc=True).limit(1).execute()
    )
    if resp.data:
        return resp.data[0]
    now = datetime.now(timezone.utc).isoformat()
    create = await svc._run(
        lambda: sb.table("questionnaire_sessions")
        .insert({"user_id": user_id, "status": "active", "started_at": now,
                 "model_version": "v2", "last_question_order": 0})
        .execute()
    )
    if not create.data:
        raise HTTPException(status_code=500, detail=_INIT_QUESTIONNAIRE_FAILED)
    return create.data[0]


async def _get_session_answers(session_id: str) -> List[Dict[str, Any]]:
    sb = svc._get_supabase()
    resp = await svc._run(
        lambda: sb.table("questionnaire_answers").select("*")
        .eq("session_id", session_id).order("question_order", desc=False).execute()
    )
    return resp.data or []


async def _update_session(session_id: str, fields: Dict[str, Any]) -> None:
    sb = svc._get_supabase()
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await svc._run(lambda: sb.table("questionnaire_sessions").update(fields).eq("id", session_id).execute())


@router.get("")
async def list_questionnaires(current_user: dict = Depends(get_current_user)):
    """Backward-compatible list endpoint returning the user's questionnaire sessions."""
    user_id = current_user.get("sub")
    try:
        sb = svc._get_supabase()
        resp = await svc._run(
            lambda: sb.table("questionnaire_sessions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(25)
            .execute()
        )
        items = resp.data or []
        return {"questionnaires": items, "total": len(items)}
    except Exception as ex:
        if _is_missing_questionnaire_tables(ex):
            raise HTTPException(status_code=503, detail=_STORAGE_NOT_INITIALIZED)
        raise


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_questionnaire(
    _body: QuestionnaireCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Backward-compatible create endpoint that initializes/returns an active session."""
    user_id = current_user.get("sub")
    try:
        session = await _get_or_create_active_session(user_id)
        return {
            "id": session.get("id"),
            "status": session.get("status"),
            "session": session,
        }
    except Exception as ex:
        if _is_missing_questionnaire_tables(ex):
            raise HTTPException(status_code=503, detail=_STORAGE_NOT_INITIALIZED)
        raise


@router.get("/session")
async def get_questionnaire_session(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    try:
        session = await _get_or_create_active_session(user_id)
        answers = await _get_session_answers(session["id"])
        answered_ids = {str(a.get("question_id")) for a in answers if a.get("question_id")}
        answer_map = {str(a.get("question_id")): int(a.get("answer_value") or 0) for a in answers}
        pending_followups = session.get("pending_followups") or []
        next_question = _get_next_question(answered_ids, answer_map, pending_followups)
        total = len(QUESTION_BANK) + len(pending_followups)
        answered_count = len(answers)
        await svc.write_audit_log(
            user_id=user_id, action="read", entity_type="questionnaire_session",
            entity_id=str(session.get("id") or ""),
            new_value={"scope": "medical", "answered_count": answered_count},
        )
        return {
            "session": session,
            "answered_count": answered_count,
            "remaining_count": max(0, total - answered_count),
            "next_question": next_question,
            "completed": next_question is None,
        }
    except HTTPException:
        raise
    except Exception as ex:
        if _is_missing_questionnaire_tables(ex):
            raise HTTPException(status_code=503, detail=_STORAGE_MIGRATION_NEEDED)
        raise


@router.post("/answer")
async def submit_questionnaire_answer(
    body: QuestionnaireAnswerRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    is_core = body.question_id in QUESTION_INDEX
    if not is_core and len(body.question_id) > 100:
        raise HTTPException(status_code=422, detail=_INVALID_QUESTION_ID)
    try:
        session = await _get_or_create_active_session(user_id)
        answers = await _get_session_answers(session["id"])
        answered_ids = {str(a.get("question_id")) for a in answers if a.get("question_id")}
        if body.question_id in answered_ids:
            raise HTTPException(status_code=409, detail=_ALREADY_ANSWERED)

        question_order = len(answers) + 1
        q_meta = QUESTION_INDEX.get(body.question_id) or {}
        question_text = q_meta.get("text", body.question_id)
        dimension = q_meta.get("dimension", "other")
        now = datetime.now(timezone.utc).isoformat()
        sb = svc._get_supabase()

        await svc._run(
            lambda: sb.table("questionnaire_answers")
            .insert({
                "session_id": session["id"], "user_id": user_id,
                "question_id": body.question_id, "question_order": question_order,
                "answer_value": body.answer_value, "answer_text": body.answer_text,
                "answered_at": now,
                "metadata": {"dimension": dimension, "is_followup": not is_core},
            })
            .execute()
        )

        pending_followups: List[Dict[str, Any]] = list(session.get("pending_followups") or [])
        session_updates: Dict[str, Any] = {"last_question_order": question_order}

        if is_core and body.answer_value <= FOLLOWUP_THRESHOLD:
            followup = await claude_service.generate_questionnaire_followup(
                question_text=question_text, dimension=dimension,
                answer_value=body.answer_value, answer_text=body.answer_text,
            )
            if followup:
                fq_id = f"fq_{body.question_id}_{question_order}"
                pending_followups.append({"id": fq_id, "text": followup["text"],
                                          "dimension": followup["dimension"], "_is_followup": True})
                session_updates["pending_followups"] = pending_followups

        await _update_session(session["id"], session_updates)

        await svc.write_audit_log(
            user_id=user_id, action="create", entity_type="questionnaire_answer",
            entity_id=f"{session['id']}:{body.question_id}",
            new_value={"scope": "medical", "question_id": body.question_id, "answer_value": body.answer_value},
        )

        updated_answers = await _get_session_answers(session["id"])
        updated_ids = {str(a.get("question_id")) for a in updated_answers}
        updated_map = {str(a.get("question_id")): int(a.get("answer_value") or 0) for a in updated_answers}
        session_resp = await svc._run(
            lambda: sb.table("questionnaire_sessions").select("pending_followups")
            .eq("id", session["id"]).single().execute()
        )
        updated_pending = (session_resp.data or {}).get("pending_followups") or []
        next_question = _get_next_question(updated_ids, updated_map, updated_pending)
        total = len(QUESTION_BANK) + len(updated_pending)

        return {
            "ok": True,
            "answered_count": len(updated_answers),
            "remaining_count": max(0, total - len(updated_answers)),
            "next_question": next_question,
            "completed": next_question is None,
        }
    except HTTPException:
        raise
    except Exception as ex:
        if _is_missing_questionnaire_tables(ex):
            raise HTTPException(status_code=503, detail=_STORAGE_NOT_INITIALIZED)
        raise


@router.post("/complete")
async def complete_questionnaire(
    body: QuestionnaireCompleteRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    try:
        session = await _get_or_create_active_session(user_id)
        answers = await _get_session_answers(session["id"])
        now = datetime.now(timezone.utc).isoformat()
        sb = svc._get_supabase()

        dimension_scores = _compute_dimension_scores(answers)
        completion_score = _compute_completion_score(dimension_scores)

        def _fmt_answer(a: Dict[str, Any]) -> str:
            qid = str(a.get("question_id", ""))
            q = QUESTION_INDEX.get(qid)
            label = q["text"] if q else qid
            comment = f' ("{a["answer_text"]}")' if a.get("answer_text") else ""
            return f"- {label}: {a['answer_value']}/10{comment}"

        answers_text = "\n".join(_fmt_answer(a) for a in answers) or "(no answers)"

        llm_summary = await claude_service.generate_questionnaire_summary(
            answers_text=answers_text,
            dimension_scores=dimension_scores,
            completion_score=completion_score,
        )

        completed_resp = await svc._run(
            lambda: sb.table("questionnaire_sessions")
            .update({
                "status": "completed", "completed_at": now, "updated_at": now,
                "completion_score": completion_score,
                "dimension_scores": dimension_scores,
                "llm_summary": llm_summary,
            })
            .eq("id", session["id"]).eq("user_id", user_id)
            .execute()
        )
        completed = completed_resp.data[0] if completed_resp.data else {
            "id": session["id"], "status": "completed",
            "completion_score": completion_score,
            "dimension_scores": dimension_scores,
            "llm_summary": llm_summary,
        }

        if body.mark_onboarding_complete:
            await svc.upsert_user_profile(user_id, {"onboarding_complete": True})

        await svc.write_audit_log(
            user_id=user_id, action="update", entity_type="questionnaire_session",
            entity_id=str(session.get("id") or ""),
            new_value={"scope": "medical", "status": "completed", "completion_score": completion_score},
        )

        await svc.save_timeline_event(
            user_id=user_id, event_type="questionnaire_completed",
            summary=f"Adaptive questionnaire completed — score {completion_score:.0f}/100",
            source="questionnaire:v2",
            metadata={"session_id": session["id"], "model_version": "v2",
                      "completion_score": completion_score, "dimension_scores": dimension_scores},
        )

        return {"ok": True, "session": completed}
    except HTTPException:
        raise
    except Exception as ex:
        if _is_missing_questionnaire_tables(ex):
            raise HTTPException(status_code=503, detail="Questionnaire storage not initialized.")
        raise


@router.get("/results")
async def get_questionnaire_results(current_user: dict = Depends(get_current_user)):
    """Return most recent completed session with scores and LLM summary."""
    user_id = current_user.get("sub")
    try:
        sb = svc._get_supabase()
        resp = await svc._run(
            lambda: sb.table("questionnaire_sessions")
            .select("*").eq("user_id", user_id).eq("status", "completed")
            .order("completed_at", desc=True).limit(1).execute()
        )
        if not resp.data:
            return {"session": None, "answers": []}
        session = resp.data[0]
        answers = await _get_session_answers(session["id"])
        await svc.write_audit_log(
            user_id=user_id, action="read", entity_type="questionnaire_results",
            entity_id=str(session.get("id") or ""),
            new_value={"scope": "medical"},
        )
        return {"session": session, "answers": answers}
    except HTTPException:
        raise
    except Exception as ex:
        if _is_missing_questionnaire_tables(ex):
            raise HTTPException(status_code=503, detail=_STORAGE_NOT_INITIALIZED)
        raise
