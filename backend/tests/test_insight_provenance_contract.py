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


class _CandidateTable:
    def __init__(self, name, sessions, insights, inserted):
        self.name = name
        self.sessions = sessions
        self.insights = insights
        self.inserted = inserted
        self.operation = "select"

    def select(self, *_args):
        self.operation = "select"
        return self

    def eq(self, *_args):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args):
        return self

    def insert(self, rows):
        self.operation = "insert"
        self.inserted.extend(rows)
        return self

    def execute(self):
        if self.name == "questionnaire_sessions":
            return _Response(self.sessions)
        if self.name == "insights":
            if self.operation == "insert":
                return _Response(self.inserted)
            return _Response(self.insights)
        return _Response([])


class _CandidateSupabase:
    def __init__(self, sessions=None, insights=None):
        self.sessions = sessions or []
        self.insights = insights or []
        self.inserted = []

    def table(self, name):
        return _CandidateTable(name, self.sessions, self.insights, self.inserted)


def _questionnaire_session(session_id, severity=3, signal="Brain fog", completed_at="2026-10-08T20:32:39+00:00"):
    return {
        "id": session_id,
        "status": "completed",
        "completed_at": completed_at,
        "updated_at": completed_at,
        "created_at": completed_at,
        "session_metadata": {
            "summary": {
                "severity": severity,
                "primary_signal": signal,
                "overall_wellbeing": "mostly_good",
                "duration_bucket": "months_1_3",
                "symptom_pattern": "stable",
                "functional_impact": "mild",
                "domain_detail": "present",
            }
        },
    }


async def _empty_checkins(*_args, **_kwargs):
    return []


async def _no_audit(*_args, **_kwargs):
    return None


def _patch_candidate_dependencies(monkeypatch, supabase):
    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(svc, "_get_supabase", lambda: supabase)
    monkeypatch.setattr(svc, "_run", fake_run)
    monkeypatch.setattr(svc, "get_weekly_checkins", _empty_checkins)
    monkeypatch.setattr(svc, "_emit_timeline", _no_audit)
    monkeypatch.setattr(svc, "_audit_medical_write", _no_audit)


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


@pytest.mark.asyncio
async def test_questionnaire_without_legacy_symptoms_produces_truthful_candidate(monkeypatch):
    supabase = _CandidateSupabase(sessions=[_questionnaire_session("session-new")])
    _patch_candidate_dependencies(monkeypatch, supabase)

    async def empty_summary(*_args, **_kwargs):
        return {"average_severity": 0, "recent_logs": []}

    monkeypatch.setattr(svc, "get_user_symptom_summary", empty_summary)

    generated = await svc.generate_insights("user-1")
    candidate = next(item for item in generated if item["provenance"]["source_type"] == "questionnaire_session")

    assert candidate["provenance"]["source_id"] == "session-new"
    assert candidate["provenance"]["source_date"] == "2026-10-08T20:32:39+00:00"
    assert candidate["next_action"]["route"] == "/questionnaire"
    assert supabase.inserted


@pytest.mark.asyncio
async def test_questionnaire_comparison_uses_previous_session_and_keeps_provenance(monkeypatch):
    sessions = [
        _questionnaire_session("session-new", severity=9),
        _questionnaire_session("session-old", severity=3, completed_at="2026-09-20T00:00:00+00:00"),
    ]
    supabase = _CandidateSupabase(sessions=sessions)
    _patch_candidate_dependencies(monkeypatch, supabase)

    generated = await svc.generate_insights("user-1")
    candidate = next(item for item in generated if item["insight_type"] == "symptom_trend")

    assert candidate["title"] == "Symptom severity increasing"
    assert candidate["provenance"]["source_type"] == "questionnaire_session"
    assert candidate["provenance"]["source_id"] == "session-new"
    assert candidate["provenance"]["related"]["delta"] == 6.0


@pytest.mark.asyncio
async def test_single_questionnaire_does_not_invent_previous_baseline(monkeypatch):
    supabase = _CandidateSupabase(sessions=[_questionnaire_session("session-only")])
    _patch_candidate_dependencies(monkeypatch, supabase)

    generated = await svc.generate_insights("user-1")
    candidates = [item for item in generated if item["provenance"]["source_type"] == "questionnaire_session"]

    assert len(candidates) == 1
    assert candidates[0]["insight_type"] == "general"
    assert "delta" not in candidates[0]["provenance"]["related"]


@pytest.mark.asyncio
async def test_empty_questionnaire_falls_back_without_fabricated_candidate(monkeypatch):
    empty_session = _questionnaire_session("session-empty")
    empty_session["session_metadata"]["summary"] = {}
    supabase = _CandidateSupabase(sessions=[empty_session])
    _patch_candidate_dependencies(monkeypatch, supabase)

    async def empty_summary(*_args, **_kwargs):
        return {"average_severity": 0, "recent_logs": []}

    monkeypatch.setattr(svc, "get_user_symptom_summary", empty_summary)

    generated = await svc.generate_insights("user-1")

    assert not [item for item in generated if item["provenance"]["source_type"] == "questionnaire_session"]


@pytest.mark.asyncio
async def test_legacy_symptom_fallback_remains_supported(monkeypatch):
    supabase = _CandidateSupabase()
    _patch_candidate_dependencies(monkeypatch, supabase)
    summaries = iter([
        {
            "average_severity": 7,
            "recent_logs": [{"id": "symptom-new", "created_at": "2026-10-08T00:00:00+00:00"}],
            "top_symptoms": [{"tag": "brain_fog"}],
            "window_days": 30,
        },
        {"average_severity": 5, "recent_logs": [], "top_symptoms": [], "window_days": 60},
    ])

    async def legacy_summary(*_args, **_kwargs):
        return next(summaries)

    monkeypatch.setattr(svc, "get_user_symptom_summary", legacy_summary)

    generated = await svc.generate_insights("user-1")
    candidate = next(item for item in generated if item["insight_type"] == "symptom_trend")

    assert candidate["provenance"]["source_type"] == "symptom_log"
    assert candidate["provenance"]["source_id"] == "symptom-new"


@pytest.mark.asyncio
async def test_equivalent_dismissed_questionnaire_candidate_blocks_regeneration(monkeypatch):
    session = _questionnaire_session("session-same")
    supabase = _CandidateSupabase(sessions=[session])
    _patch_candidate_dependencies(monkeypatch, supabase)
    generated = await svc.generate_insights("user-1")
    dismissed = next(item for item in generated if item["provenance"]["source_type"] == "questionnaire_session")
    dismissed["dismissed"] = True
    supabase.insights = [dismissed]
    supabase.inserted = []

    regenerated = await svc.generate_insights("user-1")

    assert not [item for item in regenerated if item["provenance"]["source_type"] == "questionnaire_session"]


@pytest.mark.asyncio
async def test_newer_questionnaire_state_is_not_blocked_by_older_dismissal(monkeypatch):
    old = _questionnaire_session("session-old", completed_at="2026-09-20T00:00:00+00:00")
    new = _questionnaire_session("session-new", severity=9)
    supabase = _CandidateSupabase(sessions=[old])
    _patch_candidate_dependencies(monkeypatch, supabase)
    first = await svc.generate_insights("user-1")
    dismissed = next(item for item in first if item["provenance"]["source_type"] == "questionnaire_session")
    dismissed["dismissed"] = True
    supabase.insights = [dismissed]
    supabase.sessions = [new, old]
    supabase.inserted = []

    regenerated = await svc.generate_insights("user-1")
    candidate = next(item for item in regenerated if item["provenance"]["source_type"] == "questionnaire_session")

    assert candidate["provenance"]["source_id"] == "session-new"