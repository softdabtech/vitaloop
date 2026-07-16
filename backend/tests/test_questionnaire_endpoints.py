"""
Endpoint tests for the questionnaire router (session / answer / complete / results).

Supabase is fully mocked: all calls to `_get_or_create_active_session`,
`_get_session_answers`, `_update_session`, `svc._run`, `svc.write_audit_log`,
`svc.save_timeline_event`, and `svc.upsert_user_profile` are replaced with
lightweight in-memory fakes, so no network access is required.
"""
import uuid
from typing import Any, Dict, List, Optional

import pytest
from fastapi import HTTPException

from app.routers.protocol import questionnaire as q
from app.services import claude_service


# ---------------------------------------------------------------------------
# Shared session fixture helpers
# ---------------------------------------------------------------------------

SESSION_ID = str(uuid.uuid4())
USER_ID = "user-test-001"

_ACTIVE_SESSION: Dict[str, Any] = {
    "id": SESSION_ID,
    "user_id": USER_ID,
    "status": "active",
    "started_at": "2026-04-17T00:00:00+00:00",
    "last_question_order": 0,
    "model_version": "v2",
    "pending_followups": [],
}


def _make_answer(
    question_id: str,
    answer_value: int,
    order: int,
    answer_text: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "session_id": SESSION_ID,
        "question_id": question_id,
        "answer_value": answer_value,
        "question_order": order,
        "answer_text": answer_text,
        "metadata": {},
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _stub_audit_and_timeline(monkeypatch):
    """Silence side-effectful svc functions for all tests in this module."""
    import app.services.supabase_service as svc

    async def noop(*_args, **_kwargs):
        return None

    monkeypatch.setattr(svc, "write_audit_log", noop)
    monkeypatch.setattr(svc, "save_timeline_event", noop)
    monkeypatch.setattr(svc, "upsert_user_profile", noop)


# ===========================================================================
# GET /questionnaire/session
# ===========================================================================

@pytest.mark.asyncio
async def test_get_session_returns_first_question(monkeypatch):
    monkeypatch.setattr(q, "_get_latest_session", lambda _uid: coro(_ACTIVE_SESSION))
    monkeypatch.setattr(q, "_get_or_create_active_session", lambda _uid: coro(_ACTIVE_SESSION))
    monkeypatch.setattr(q, "_get_session_answers", lambda _sid: coro([]))

    result = await q.get_questionnaire_session(current_user={"sub": USER_ID})

    assert result["session"]["id"] == SESSION_ID
    assert result["answered_count"] == 0
    assert result["completed"] is False
    assert result["next_question"] is not None
    assert result["next_question"]["id"] == "energy_daytime"


@pytest.mark.asyncio
async def test_get_session_reports_completed_when_all_answered(monkeypatch):
    all_answers = [
        _make_answer(qid, 7, i + 1)
        for i, qid in enumerate(q.QUESTION_INDEX)
    ]
    monkeypatch.setattr(q, "_get_latest_session", lambda _uid: coro(_ACTIVE_SESSION))
    monkeypatch.setattr(q, "_get_or_create_active_session", lambda _uid: coro(_ACTIVE_SESSION))
    monkeypatch.setattr(q, "_get_session_answers", lambda _sid: coro(all_answers))

    result = await q.get_questionnaire_session(current_user={"sub": USER_ID})

    assert result["completed"] is True
    assert result["next_question"] is None


@pytest.mark.asyncio
async def test_get_session_missing_tables_raises_503(monkeypatch):
    async def boom(_uid):
        raise Exception("PGRST205 relation questionnaire_sessions does not exist")

    monkeypatch.setattr(q, "_get_latest_session", boom)
    monkeypatch.setattr(q, "_get_or_create_active_session", boom)

    with pytest.raises(HTTPException) as exc:
        await q.get_questionnaire_session(current_user={"sub": USER_ID})

    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_get_session_does_not_create_new_session_when_latest_is_completed(monkeypatch):
    completed_session = {**_ACTIVE_SESSION, "status": "completed"}

    async def fail_create(_uid):
        raise AssertionError("completed session reads must not create a new active session")

    monkeypatch.setattr(q, "_get_latest_session", lambda _uid: coro(completed_session))
    monkeypatch.setattr(q, "_get_or_create_active_session", fail_create)
    monkeypatch.setattr(q, "_get_session_answers", lambda _sid: coro([]))

    result = await q.get_questionnaire_session(current_user={"sub": USER_ID})

    assert result["completed"] is True
    assert result["next_question"] is None


# ===========================================================================
# POST /questionnaire/answer
# ===========================================================================

@pytest.mark.asyncio
async def test_submit_answer_records_and_returns_next(monkeypatch):
    session = {**_ACTIVE_SESSION, "pending_followups": []}
    existing: List[Dict[str, Any]] = []

    async def fake_session(_uid):
        return session

    async def fake_answers(_sid):
        return list(existing)

    async def fake_run(fn):
        # Simulate insert by appending to existing
        result = fn()
        # result is a Supabase mock — we return a minimal stub
        return _Resp(None)

    async def fake_pending_resp(_sid):
        return _SessionResp({"pending_followups": []})

    monkeypatch.setattr(q, "_get_or_create_active_session", fake_session)
    monkeypatch.setattr(q, "_get_session_answers", fake_answers)
    monkeypatch.setattr(q, "_update_session", lambda _sid, _fields: coro(None))
    monkeypatch.setattr(claude_service, "generate_questionnaire_followup", lambda **_kw: coro(None))

    # Patch _run to do nothing (insert returns empty data)
    import app.services.supabase_service as svc
    original_run = svc._run

    async def fake_svc_run(fn):
        fn()
        return _Resp([])

    monkeypatch.setattr(svc, "_run", fake_svc_run)
    # Restore _get_supabase to avoid real DB call — patch only the table calls
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSB())

    body = q.QuestionnaireAnswerRequest(
        question_id="energy_daytime",
        answer_value=8,
        answer_text=None,
    )
    result = await q.submit_questionnaire_answer(body, current_user={"sub": USER_ID})

    assert result["ok"] is True
    assert result["answered_count"] == 0  # fake_answers still returns []
    assert result["next_question"] is not None


@pytest.mark.asyncio
async def test_submit_answer_rejects_duplicate(monkeypatch):
    already_answered = [_make_answer("energy_daytime", 8, 1)]
    monkeypatch.setattr(q, "_get_or_create_active_session", lambda _uid: coro({**_ACTIVE_SESSION, "pending_followups": []}))
    monkeypatch.setattr(q, "_get_session_answers", lambda _sid: coro(already_answered))

    import app.services.supabase_service as svc
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSB())

    body = q.QuestionnaireAnswerRequest(question_id="energy_daytime", answer_value=5)

    with pytest.raises(HTTPException) as exc:
        await q.submit_questionnaire_answer(body, current_user={"sub": USER_ID})

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_submit_answer_triggers_followup_on_low_score(monkeypatch):
    """When score <= FOLLOWUP_THRESHOLD, the LLM followup is requested."""
    followup_called = {"yes": False}

    async def fake_followup(**_kw):
        followup_called["yes"] = True
        return {"text": "What specifically drains your energy?", "dimension": "energy"}

    monkeypatch.setattr(q, "_get_or_create_active_session", lambda _uid: coro({**_ACTIVE_SESSION, "pending_followups": []}))
    monkeypatch.setattr(q, "_get_session_answers", lambda _sid: coro([]))
    monkeypatch.setattr(q, "_update_session", lambda _sid, _fields: coro(None))
    monkeypatch.setattr(claude_service, "generate_questionnaire_followup", fake_followup)

    import app.services.supabase_service as svc
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSB())
    monkeypatch.setattr(svc, "_run", lambda fn: coro_with_run(fn))

    body = q.QuestionnaireAnswerRequest(question_id="energy_daytime", answer_value=q.FOLLOWUP_THRESHOLD)
    await q.submit_questionnaire_answer(body, current_user={"sub": USER_ID})

    assert followup_called["yes"] is True


@pytest.mark.asyncio
async def test_submit_answer_missing_tables_raises_503(monkeypatch):
    async def boom(_uid):
        raise Exception("PGRST205 relation questionnaire_answers does not exist")

    monkeypatch.setattr(q, "_get_or_create_active_session", boom)

    import app.services.supabase_service as svc
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSB())

    body = q.QuestionnaireAnswerRequest(question_id="sleep_quality", answer_value=3)
    with pytest.raises(HTTPException) as exc:
        await q.submit_questionnaire_answer(body, current_user={"sub": USER_ID})

    assert exc.value.status_code == 503


# ===========================================================================
# POST /questionnaire/complete
# ===========================================================================

@pytest.mark.asyncio
async def test_complete_builds_session_result(monkeypatch):
    answers = [
        _make_answer("sleep_quality", 4, 1),
        _make_answer("energy_daytime", 7, 2),
    ]

    async def fake_summary(**_kw):
        return "You sleep lightly, but your energy looks good. Focus on consistent sleep timing tonight."

    monkeypatch.setattr(q, "_get_or_create_active_session", lambda _uid: coro(_ACTIVE_SESSION))
    monkeypatch.setattr(q, "_get_session_answers", lambda _sid: coro(answers))
    monkeypatch.setattr(claude_service, "generate_questionnaire_summary", fake_summary)

    import app.services.supabase_service as svc
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSB())
    monkeypatch.setattr(svc, "_run", lambda fn: coro_completed_session(fn))

    body = q.QuestionnaireCompleteRequest(mark_onboarding_complete=False)
    result = await q.complete_questionnaire(body, current_user={"sub": USER_ID})

    assert result["ok"] is True
    assert "session" in result
    completed = result["session"]
    assert "completion_score" in completed
    assert isinstance(completed["completion_score"], float)
    assert "dimension_scores" in completed


@pytest.mark.asyncio
async def test_complete_missing_tables_raises_503(monkeypatch):
    async def boom(_uid):
        raise Exception("PGRST205 relation questionnaire_sessions does not exist")

    monkeypatch.setattr(q, "_get_or_create_active_session", boom)

    import app.services.supabase_service as svc
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSB())

    body = q.QuestionnaireCompleteRequest()
    with pytest.raises(HTTPException) as exc:
        await q.complete_questionnaire(body, current_user={"sub": USER_ID})

    assert exc.value.status_code == 503


# ===========================================================================
# GET /questionnaire/results
# ===========================================================================

@pytest.mark.asyncio
async def test_get_results_returns_latest_completed(monkeypatch):
    completed_session = {**_ACTIVE_SESSION, "status": "completed",
                         "completion_score": 72.5,
                         "dimension_scores": {"sleep": 40.0, "energy": 70.0},
                         "llm_summary": "Great energy, improve sleep."}
    answers = [_make_answer("sleep_quality", 4, 1), _make_answer("energy_daytime", 7, 2)]

    import app.services.supabase_service as svc
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSB())
    monkeypatch.setattr(svc, "_run", lambda fn: coro_results_resp(fn, completed_session))
    monkeypatch.setattr(q, "_get_session_answers", lambda _sid: coro(answers))

    result = await q.get_questionnaire_results(current_user={"sub": USER_ID})

    assert result["session"]["completion_score"] == 72.5
    assert len(result["answers"]) == 2


@pytest.mark.asyncio
async def test_get_results_empty_when_no_completed_session(monkeypatch):
    import app.services.supabase_service as svc
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSB())
    monkeypatch.setattr(svc, "_run", lambda fn: coro(_Resp([])))

    result = await q.get_questionnaire_results(current_user={"sub": USER_ID})

    assert result["session"] is None
    assert result["answers"] == []


# ===========================================================================
# Minimal Supabase stub helpers
# ===========================================================================

class _Resp:
    def __init__(self, data):
        self.data = data


class _SessionResp:
    def __init__(self, data):
        self.data = data


class _TableStub:
    def select(self, *_a):   return self
    def insert(self, *_a):   return self
    def update(self, *_a):   return self
    def eq(self, *_a):       return self
    def order(self, *_a):    return self
    def limit(self, *_a):    return self
    def single(self):        return self
    def execute(self):       return _Resp([])


class _FakeSB:
    def table(self, _name):
        return _TableStub()


# ---------------------------------------------------------------------------
# Async helpers
# ---------------------------------------------------------------------------

async def coro(value):
    return value


async def coro_with_run(fn):
    fn()
    return _Resp([])


async def coro_completed_session(fn):
    fn()
    return _Resp([{
        "id": SESSION_ID,
        "status": "completed",
        "completion_score": 0.0,
        "dimension_scores": {},
        "llm_summary": None,
    }])


async def coro_results_resp(fn, completed_session):
    return _Resp([completed_session])
