import pytest

from app.services import claude_service


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, payload):
        self._payload = payload

    async def post(self, *_args, **_kwargs):
        return _FakeResponse(self._payload)


@pytest.mark.asyncio
async def test_generate_questionnaire_followup_returns_none_when_llm_unconfigured(monkeypatch):
    monkeypatch.setattr(claude_service, "is_llm_configured", lambda: False)

    result = await claude_service.generate_questionnaire_followup(
        question_text="How stable is your energy?",
        dimension="energy",
        answer_value=3,
        answer_text="Very low in the afternoon",
    )

    assert result is None


@pytest.mark.asyncio
async def test_generate_questionnaire_followup_parses_json_payload(monkeypatch):
    monkeypatch.setattr(claude_service, "is_llm_configured", lambda: True)
    payload = {
        "choices": [
            {
                "message": {
                    "content": "```json\n{\"text\": \"What usually worsens your energy dip after lunch?\"}\n```"
                }
            }
        ]
    }
    monkeypatch.setattr(claude_service, "_get_client", lambda: _FakeClient(payload))

    result = await claude_service.generate_questionnaire_followup(
        question_text="How stable is your daytime energy?",
        dimension="energy",
        answer_value=2,
        answer_text="Crash at 3pm",
    )

    assert result == {
        "text": "What usually worsens your energy dip after lunch?",
        "dimension": "energy",
    }


@pytest.mark.asyncio
async def test_generate_questionnaire_followup_returns_none_on_bad_json(monkeypatch):
    monkeypatch.setattr(claude_service, "is_llm_configured", lambda: True)
    payload = {"choices": [{"message": {"content": "not-json"}}]}
    monkeypatch.setattr(claude_service, "_get_client", lambda: _FakeClient(payload))

    result = await claude_service.generate_questionnaire_followup(
        question_text="How restorative is your sleep?",
        dimension="sleep",
        answer_value=1,
        answer_text="Waking up at night",
    )

    assert result is None


@pytest.mark.asyncio
async def test_generate_questionnaire_summary_returns_none_when_llm_unconfigured(monkeypatch):
    monkeypatch.setattr(claude_service, "is_llm_configured", lambda: False)

    result = await claude_service.generate_questionnaire_summary(
        answers_text="- Sleep: 3/10",
        dimension_scores={"sleep": 30.0},
        completion_score=30.0,
    )

    assert result is None


@pytest.mark.asyncio
async def test_generate_questionnaire_summary_parses_summary(monkeypatch):
    monkeypatch.setattr(claude_service, "is_llm_configured", lambda: True)
    payload = {
        "choices": [
            {
                "message": {
                    "content": '{"summary": "Your recovery and focus are strong. Sleep remains your key limiter this week. Start with a fixed bedtime tonight and track how you feel tomorrow."}'
                }
            }
        ]
    }
    monkeypatch.setattr(claude_service, "_get_client", lambda: _FakeClient(payload))

    result = await claude_service.generate_questionnaire_summary(
        answers_text="- Sleep quality: 3/10",
        dimension_scores={"sleep": 30.0, "recovery": 80.0},
        completion_score=55.0,
    )

    assert isinstance(result, str)
    assert "Sleep remains your key limiter" in result


@pytest.mark.asyncio
async def test_generate_questionnaire_summary_returns_none_on_empty_summary(monkeypatch):
    monkeypatch.setattr(claude_service, "is_llm_configured", lambda: True)
    payload = {"choices": [{"message": {"content": '{"summary": ""}'}}]}
    monkeypatch.setattr(claude_service, "_get_client", lambda: _FakeClient(payload))

    result = await claude_service.generate_questionnaire_summary(
        answers_text="- Energy: 4/10",
        dimension_scores={"energy": 40.0},
        completion_score=40.0,
    )

    assert result is None