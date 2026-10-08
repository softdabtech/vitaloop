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
    assert generated[0]["provenance"] == persisted["provenance"]
    assert generated[0]["next_action"] == persisted["next_action"]


@pytest.mark.asyncio
async def test_generation_skips_equivalent_dismissed_insight(monkeypatch):
    dismissed = {
        "insight_type": "adherence",
        "title": "Protocol adherence is slipping",
        "body": "Your latest weekly check-in shows low adherence. Tighten the routine before changing the protocol.",
        "priority": 3,
        "provenance": {
            "version": "insight_provenance_v1",
            "source_type": "weekly_checkin",
            "source_id": "checkin-1",
            "source_date": "2026-09-20",
            "evidence_status": "observed",
            "related": {"field": "protocol_adherence"},
        },
        "next_action": {
            "type": "review_checkin",
            "label": "Review weekly check-in",
            "route": "/check-ins",
            "safety_level": "routine",
        },
        "dismissed": True,
    }

    class _ExistingTable:
        def select(self, *_args):
            return self

        def eq(self, *_args):
            return self

        def execute(self):
            return _Response([dismissed])

    class _ExistingSupabase:
        def table(self, name):
            return _ExistingTable() if name == "insights" else _Table(name, [])

    async def fake_run(fn):
        return fn()

    async def empty_checkins(*_args, **_kwargs):
        return [{"id": "checkin-1", "week_start": "2026-09-20", "protocol_adherence": 3}]

    async def empty_symptom_summary(*_args, **_kwargs):
        return {"average_severity": 0}

    async def no_audit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(svc, "_get_supabase", lambda: _ExistingSupabase())
    monkeypatch.setattr(svc, "_run", fake_run)
    monkeypatch.setattr(svc, "get_user_symptom_summary", empty_symptom_summary)
    monkeypatch.setattr(svc, "get_weekly_checkins", empty_checkins)
    monkeypatch.setattr(svc, "_emit_timeline", no_audit)
    monkeypatch.setattr(svc, "_audit_medical_write", no_audit)

    assert await svc.generate_insights("user-1") == []


class _DismissTable:
    def __init__(self, rows):
        self.rows = rows
        self.operation = "select"
        self.filters = []
        self.update_payload = None

    def select(self, *_args):
        self.operation = "select"
        return self

    def update(self, payload):
        self.operation = "update"
        self.update_payload = payload
        return self

    def eq(self, field, value):
        self.filters.append((field, value))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        if self.operation == "update":
            for row in self.rows:
                if all(row.get(field) == value for field, value in self.filters):
                    row.update(self.update_payload or {})
            return _Response([])
        visible = [
            row for row in self.rows
            if all(row.get(field) == value for field, value in self.filters)
        ]
        return _Response(visible)


class _DismissSupabase:
    def __init__(self, rows):
        self.rows = rows
        self.last_table = None

    def table(self, _name):
        self.last_table = _DismissTable(self.rows)
        return self.last_table


@pytest.mark.asyncio
async def test_dismissal_persists_and_legacy_null_rows_are_filtered(monkeypatch):
    rows = [
        {
            "id": "legacy",
            "user_id": "user-1",
            "dismissed": False,
            "provenance": None,
            "next_action": None,
        },
    ]
    supabase = _DismissSupabase(rows)

    async def fake_run(fn):
        return fn()

    async def no_audit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(svc, "_get_supabase", lambda: supabase)
    monkeypatch.setattr(svc, "_run", fake_run)
    monkeypatch.setattr(svc, "_audit_medical_read", no_audit)
    monkeypatch.setattr(svc, "_audit_medical_write", no_audit)

    before = await svc.get_user_insights("user-1")
    assert before[0]["provenance"] is None

    await svc.dismiss_insight("user-1", "legacy")

    assert rows[0]["dismissed"] is True
    after = await svc.get_user_insights("user-1")
    assert after == []


@pytest.mark.asyncio
async def test_insight_state_keeps_dismissed_rows_for_eligibility(monkeypatch):
    rows = [
        {"id": "active", "user_id": "user-1", "dismissed": False},
        {"id": "dismissed", "user_id": "user-1", "dismissed": True},
    ]
    supabase = _DismissSupabase(rows)

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(svc, "_get_supabase", lambda: supabase)
    monkeypatch.setattr(svc, "_run", fake_run)
    async def empty_candidates(_user_id):
        return []

    monkeypatch.setattr(svc, "_resolve_insight_candidates", empty_candidates)

    state = await svc.get_user_insight_state("user-1")

    assert [row["id"] for row in state["active"]] == ["active"]
    assert [row["id"] for row in state["dismissed"]] == ["dismissed"]
    assert state["generation_allowed"] is False
    assert state["generation_reason"] == "no_current_candidate_or_equivalent_dismissal"

@pytest.mark.asyncio
async def test_insight_state_allows_current_candidate_when_only_legacy_dismissal_exists(monkeypatch):
    rows = [
        {
            "id": "old-dismissed",
            "user_id": "user-1",
            "dismissed": True,
            "provenance": None,
            "next_action": None,
        },
    ]
    supabase = _DismissSupabase(rows)

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(svc, "_get_supabase", lambda: supabase)
    monkeypatch.setattr(svc, "_run", fake_run)
    async def current_candidates(_user_id):
        return [{"title": "new"}]

    monkeypatch.setattr(svc, "_resolve_insight_candidates", current_candidates)

    state = await svc.get_user_insight_state("user-1")

    assert state["generation_allowed"] is True
    assert state["generation_reason"] == "current_candidate_not_dismissed"


@pytest.mark.asyncio
async def test_insight_state_blocks_active_structured_insight(monkeypatch):
    rows = [
        {
            "id": "active",
            "user_id": "user-1",
            "dismissed": False,
            "provenance": {"source_type": "weekly_checkin"},
            "next_action": {"type": "review_checkin"},
        },
    ]
    supabase = _DismissSupabase(rows)

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(svc, "_get_supabase", lambda: supabase)
    monkeypatch.setattr(svc, "_run", fake_run)
    async def current_candidates(_user_id):
        return [{"title": "new"}]

    monkeypatch.setattr(svc, "_resolve_insight_candidates", current_candidates)

    state = await svc.get_user_insight_state("user-1")

    assert state["generation_allowed"] is False
    assert state["generation_reason"] == "active_structured_insight"