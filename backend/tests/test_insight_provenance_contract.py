import pytest

from app.services import supabase_service as svc


class _Response:
    def __init__(self, data=None):
        self.data = data or []


class _Table:
    def __init__(self, name, inserted):
        self.name = name
        self.inserted = inserted

    def select(self, *_args):
        return self

    def eq(self, *_args):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args):
        return self

    def insert(self, rows):
        self.inserted.extend(rows)
        return self

    def execute(self):
        return _Response(self.inserted if self.name == "insights" else [])


class _Supabase:
    def __init__(self):
        self.inserted = []

    def table(self, name):
        return _Table(name, self.inserted)


def test_insight_provenance_keeps_unknown_source_explicit():
    provenance = svc._unknown_insight_provenance("No source row was available.")

    assert provenance["source_type"] == "unknown"
    assert provenance["source_id"] is None
    assert provenance["evidence_status"] == "unknown"
    assert provenance["reason"] == "No source row was available."


def test_safety_action_is_clinician_facing():
    action = svc._insight_action(
        "clinician_review",
        "Discuss with a clinician",
        "/check-ins",
        safety_level="clinician_review",
    )

    assert action == {
        "type": "clinician_review",
        "label": "Discuss with a clinician",
        "route": "/check-ins",
        "safety_level": "clinician_review",
    }


@pytest.mark.asyncio
async def test_generated_insight_persists_provenance_and_next_action(monkeypatch):
    supabase = _Supabase()

    async def fake_run(fn):
        return fn()

    async def no_audit(*_args, **_kwargs):
        return None

    async def empty_symptom_summary(*_args, **_kwargs):
        return {"average_severity": 0}

    async def empty_checkins(*_args, **_kwargs):
        return []

    monkeypatch.setattr(svc, "_get_supabase", lambda: supabase)
    monkeypatch.setattr(svc, "_run", fake_run)
    monkeypatch.setattr(svc, "get_user_symptom_summary", empty_symptom_summary)
    monkeypatch.setattr(svc, "get_weekly_checkins", empty_checkins)
    monkeypatch.setattr(svc, "_emit_timeline", no_audit)
    monkeypatch.setattr(svc, "_audit_medical_write", no_audit)

    generated = await svc.generate_insights("user-1")

    assert generated
    persisted = supabase.inserted[0]
    assert persisted["provenance"]["source_type"] == "unknown"
    assert persisted["provenance"]["evidence_status"] == "unknown"
    assert persisted["next_action"]["route"] == "/check-ins"
    assert persisted["next_action"]["label"]