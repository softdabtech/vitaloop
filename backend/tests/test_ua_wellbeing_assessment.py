import pytest

from app.routers import assessment


class _Resp:
    def __init__(self, data=None):
        self.data = data or []


class _FakeTable:
    def __init__(self, name):
        self.name = name
        self.payload = None

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        if self.name == "symptom_assessments":
            return _Resp([{**(self.payload or {}), "id": "ua-assessment-1"}])
        return _Resp([])


class _FakeSupabase:
    def table(self, name):
        return _FakeTable(name)


class _FakeRequest:
    headers = {"user-agent": "pytest", "referer": "https://ua.vitaloop.today/"}


@pytest.mark.asyncio
async def test_ua_wellbeing_endpoint_returns_fallback_when_llm_unavailable(monkeypatch):
    async def no_llm(**_kwargs):
        return None

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(assessment, "generate_ua_wellbeing_assessment", no_llm)
    monkeypatch.setattr(assessment.svc, "_get_supabase", lambda: _FakeSupabase())
    monkeypatch.setattr(assessment.svc, "_run", fake_run)

    body = assessment.UaWellbeingAssessmentRequest(
        session_id="session-ua-123",
        symptoms=["Втома", "Поганий сон"],
        duration="2-8 тижнів",
        intensity=4,
        context="Гірше вранці",
        age_range="30-44",
        family_context="Для себе",
    )

    result = await assessment.submit_ua_wellbeing_assessment(body, _FakeRequest())

    assert result["assessment_id"] == "ua-assessment-1"
    assert result["stored"] is True
    assert result["result"]["priority_level"] == "attention"
    assert result["result"]["headline"].startswith("Є карта уваги")
    assert result["result"]["lab_directions"]
    assert "діагноз" in result["result"]["disclaimer"]


def test_ua_wellbeing_sanitizer_rejects_unknown_priority_level():
    body = assessment.UaWellbeingAssessmentRequest(
        session_id="session-ua-456",
        symptoms=["Втома"],
        duration="до 2 тижнів",
        intensity=2,
    )

    result = assessment._sanitize_ua_wellbeing_result(
        {
            "headline": "Тест",
            "priority_level": "diagnosis",
            "summary": "Короткий освітній опис.",
            "possible_links": ["звʼязок"],
            "lab_directions": [{"name": "ЗАК", "reason": "контекст"}],
            "doctor_questions": ["питання"],
            "next_steps": ["крок"],
            "disclaimer": "не діагноз",
        },
        body,
    )

    assert result["priority_level"] == "stable"
