"""P2 fix (Codex recheck, 2026-09-12): _persist_usage_event() logged every
failure at warning level, including the expected foreign-key rejection that
happens whenever a no-persist direct-service probe uses a synthetic,
never-persisted upload_id — the only way this constraint is hit in
practice, since every real production caller already has a genuine
lab_uploads row before the LLM runs.
"""

import logging

import pytest

from app.services import claude_service


class _FakeTable:
    def __init__(self, exc):
        self._exc = exc

    def insert(self, row):
        return self

    def execute(self):
        raise self._exc


class _FakeSupabase:
    def __init__(self, exc):
        self._exc = exc

    def table(self, name):
        return _FakeTable(self._exc)


@pytest.mark.asyncio
async def test_foreign_key_violation_logs_debug_not_warning(monkeypatch, caplog):
    from app.services import supabase_service as svc

    exc = RuntimeError('insert or update on table "llm_usage_events" violates foreign key constraint "llm_usage_events_upload_id_fkey"')
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSupabase(exc))

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(svc, "_run", fake_run)

    with caplog.at_level(logging.DEBUG, logger="uvicorn.error"):
        await claude_service._persist_usage_event(
            task_name="generate_protocol",
            payload={"usage": {"total_tokens": 42}},
            user_id=None,
            upload_id="00000000-0000-0000-0000-000000000000",
        )

    assert not any(record.levelno == logging.WARNING for record in caplog.records)
    assert any("llm_usage_event_skipped_unknown_upload" in record.message for record in caplog.records)


@pytest.mark.asyncio
async def test_other_failures_still_logged_as_warning(monkeypatch, caplog):
    from app.services import supabase_service as svc

    exc = RuntimeError("connection reset by peer")
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSupabase(exc))

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(svc, "_run", fake_run)

    with caplog.at_level(logging.DEBUG, logger="uvicorn.error"):
        await claude_service._persist_usage_event(
            task_name="generate_protocol",
            payload={"usage": {"total_tokens": 42}},
            user_id=None,
            upload_id="some-upload",
        )

    assert any(record.levelno == logging.WARNING and "llm_usage_event_failed" in record.message for record in caplog.records)
