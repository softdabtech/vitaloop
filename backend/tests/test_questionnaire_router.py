import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.routers.protocol import questionnaire as q


def test_compute_dimension_scores_groups_by_dimension():
    answers = [
        {"question_id": "sleep_quality", "answer_value": 3},
        {"question_id": "energy_daytime", "answer_value": 8},
        {"question_id": "sleep_quality", "answer_value": 5},
        {"question_id": "unknown", "answer_value": 9},
    ]

    scores = q._compute_dimension_scores(answers)

    assert scores["sleep"] == 40.0
    assert scores["energy"] == 80.0
    assert "unknown" not in scores


def test_compute_completion_score_returns_weighted_average():
    dimension_scores = {
        "sleep": 30.0,
        "energy": 80.0,
        "mood": 70.0,
    }

    score = q._compute_completion_score(dimension_scores)

    assert score == pytest.approx(58.9, abs=0.1)


def test_next_core_question_boosts_stress_and_mood_when_sleep_low():
    answered_ids = {"sleep_quality"}
    answer_map = {"sleep_quality": q.FOLLOWUP_THRESHOLD}

    next_q = q._next_core_question(answered_ids, answer_map)

    assert next_q is not None
    assert next_q["id"] == "stress_level"


def test_next_followup_question_marks_flag_and_skips_answered():
    pending = [
        {"id": "fq_sleep_1", "text": "What wakes you up?", "dimension": "sleep"},
        {"id": "fq_stress_2", "text": "What triggers stress spikes?", "dimension": "stress"},
    ]

    next_q = q._next_followup_question(pending, answered_ids={"fq_sleep_1"})

    assert next_q is not None
    assert next_q["id"] == "fq_stress_2"
    assert next_q["_is_followup"] is True


def test_get_next_question_prioritizes_followup_over_core():
    pending = [{"id": "fq_energy_1", "text": "When is your energy dip?", "dimension": "energy"}]

    next_q = q._get_next_question(answered_ids=set(), answer_map={}, pending_followups=pending)

    assert next_q["id"] == "fq_energy_1"
    assert next_q["_is_followup"] is True


def test_missing_questionnaire_tables_detection():
    ex = Exception("PGRST205 relation questionnaire_sessions does not exist")
    assert q._is_missing_questionnaire_tables(ex) is True


def test_controlled_summary_requires_every_engine_input():
    with pytest.raises(HTTPException) as exc:
        q._validate_controlled_summary({"schema_version": "controlled_symptom_fallback_v1"})
    assert exc.value.status_code == 422
    assert "overall_wellbeing" in exc.value.detail["missing"]


def test_controlled_summary_accepts_closed_complete_payload():
    q._validate_controlled_summary({
        "schema_version": "controlled_symptom_fallback_v1",
        "overall_wellbeing": "reduced", "primary_concern_id": "energy",
        "primary_concept_id": "fatigue", "primary_signal": "Fatigue",
        "duration_bucket": "weeks_1_4", "severity": 6,
        "symptom_pattern": "stable", "functional_impact": "mild",
        "domain_detail": "absent", "urgent_warning": "absent",
        "controlled_answers": {"severity": "moderate", "trajectory": "stable", "functional_impact": "mild", "domain_detail": "absent", "urgent_warning": "absent"},
    })


def test_controlled_summary_rejects_unknown_values_and_concepts():
    payload = {
        "schema_version": "controlled_symptom_fallback_v1",
        "overall_wellbeing": "reduced", "primary_concern_id": "energy",
        "primary_concept_id": "made_up", "primary_signal": "Anything typed by a client",
        "related_symptoms": [], "duration_bucket": "weeks_1_4", "severity": 6,
        "symptom_pattern": "stable", "functional_impact": "mild",
        "domain_detail": "absent", "urgent_warning": "absent",
        "controlled_answers": {"severity": "moderate", "trajectory": "stable", "functional_impact": "mild", "domain_detail": "absent", "urgent_warning": "absent"},
    }
    with pytest.raises(HTTPException) as exc:
        q._validate_controlled_summary(payload)
    assert exc.value.status_code == 422
    assert exc.value.detail == "Invalid controlled symptom concept"


@pytest.mark.asyncio
async def test_controlled_context_completion_is_persisted_atomically(monkeypatch):
    captured = {}
    summary = {
        "schema_version": "controlled_symptom_fallback_v1",
        "overall_wellbeing": "reduced", "primary_concern_id": "energy",
        "primary_concept_id": "fatigue", "primary_signal": "Fatigue",
        "related_symptoms": ["Low stamina"], "duration_bucket": "weeks_1_4", "severity": 6,
        "symptom_pattern": "stable", "functional_impact": "mild",
        "domain_detail": "absent", "urgent_warning": "absent",
        "controlled_answers": {"severity": "moderate", "trajectory": "stable", "functional_impact": "mild", "domain_detail": "absent", "urgent_warning": "absent"},
    }

    async def fake_session(_user_id):
        return {"id": "session-controlled", "status": "active", "session_metadata": {}}

    async def fake_update(_session_id, fields):
        captured.update(fields)

    async def noop(**_kwargs):
        return None

    async def fake_report_update(**_kwargs):
        return {"status": "update_available", "update_available": True}

    monkeypatch.setattr(q, "_get_or_create_active_session", fake_session)
    monkeypatch.setattr(q, "_update_session", fake_update)
    monkeypatch.setattr(q.svc, "write_audit_log", noop)
    monkeypatch.setattr(q.svc, "save_timeline_event", noop)
    monkeypatch.setattr(q, "resolve_report_update_offer", fake_report_update)
    request = Request({"type": "http", "method": "PATCH", "path": "/questionnaire/session/context", "headers": []})
    response = await q.update_questionnaire_context(
        q.QuestionnaireContextRequest(active_concern="Fatigue, Low stamina", summary=summary, complete=True),
        request,
        current_user={"sub": "user-1"},
    )
    assert response["completed"] is True
    assert captured["status"] == "completed"
    assert captured["completed_at"]
    assert captured["session_metadata"]["summary"]["urgency_source"] == "backend"
    assert response["report_update"] == {"status": "update_available", "update_available": True}


@pytest.mark.asyncio
async def test_submit_questionnaire_answer_rejects_too_long_custom_question_id():
    body = q.QuestionnaireAnswerRequest(question_id="x" * 101, answer_value=7, answer_text=None)

    with pytest.raises(HTTPException) as exc:
        await q.submit_questionnaire_answer(body, current_user={"sub": "user-1"})

    assert exc.value.status_code == 422
    assert exc.value.detail == "Invalid question_id"
