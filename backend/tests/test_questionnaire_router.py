import pytest
from fastapi import HTTPException

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


@pytest.mark.asyncio
async def test_submit_questionnaire_answer_rejects_too_long_custom_question_id():
    body = q.QuestionnaireAnswerRequest(question_id="x" * 101, answer_value=7, answer_text=None)

    with pytest.raises(HTTPException) as exc:
        await q.submit_questionnaire_answer(body, current_user={"sub": "user-1"})

    assert exc.value.status_code == 422
    assert exc.value.detail == "Invalid question_id"