"""Regression coverage for the server-owned autonomous recovery process.

These tests never use a live database. SQL claim/lease behavior remains
covered by tests/db/test_finalize_lab_analysis_pg.py on an approved disposable
PostgreSQL target.
"""
import asyncio
import logging
import sys
from pathlib import Path

import pytest

from app.services import recovery_dispatcher as dispatcher
from app.services import supabase_service as svc
from app.workers import autonomous_recovery as worker


USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
REPORT_A = "33333333-3333-3333-3333-333333333333"
REPORT_B = "44444444-4444-4444-4444-444444444444"


def test_worker_configures_stdout_logging_from_log_level(monkeypatch):
    configured = {}

    def basic_config(**kwargs):
        configured.update(kwargs)

    monkeypatch.setenv("LOG_LEVEL", "debug")
    monkeypatch.setattr(worker.logging, "basicConfig", basic_config)

    worker.configure_logging()

    assert configured["level"] == logging.DEBUG
    assert configured["stream"] is sys.stdout
    assert configured["force"] is True
    assert "%(message)s" in configured["format"]


@pytest.mark.asyncio
async def test_worker_logs_empty_cycle_and_continues_until_graceful_shutdown(monkeypatch, caplog):
    stopped = asyncio.Event()
    cycles = []

    async def cycle():
        cycles.append(True)
        return {"discovered": 0, "processed": 0, "failed": 0}

    async def stop_after_first_cycle():
        while not cycles:
            await asyncio.sleep(0)
        await asyncio.sleep(0)
        stopped.set()

    monkeypatch.setattr(worker.settings, "recovery_worker_enabled", True)
    monkeypatch.setattr(worker, "run_recovery_cycle", cycle)
    with caplog.at_level(logging.INFO, logger=worker.logger.name):
        stopper = asyncio.create_task(stop_after_first_cycle())
        await worker.run_worker(stop_event=stopped)
        await stopper

    assert cycles == [True]
    assert "autonomous_recovery_worker_started" in caplog.messages
    assert "autonomous_recovery_cycle discovered=0 processed=0 failed=0" in caplog.messages
    assert "autonomous_recovery_worker_stopped" in caplog.messages


@pytest.mark.asyncio
async def test_worker_logs_safe_cycle_failure_and_shuts_down(monkeypatch, caplog):
    stopped = asyncio.Event()

    async def cycle():
        stopped.set()
        raise ValueError("report_id=secret-patient-identifier")

    monkeypatch.setattr(worker.settings, "recovery_worker_enabled", True)
    monkeypatch.setattr(worker, "run_recovery_cycle", cycle)
    with caplog.at_level(logging.INFO, logger=worker.logger.name):
        await worker.run_worker(stop_event=stopped)

    assert "autonomous_recovery_cycle_failed exception_type=ValueError" in caplog.messages
    assert "report_id=secret-patient-identifier" not in caplog.text
    assert "autonomous_recovery_worker_stopped" in caplog.messages


@pytest.mark.asyncio
async def test_global_worker_recovers_server_discovered_owners_without_a_request(monkeypatch):
    calls = []

    async def candidates(*, limit):
        assert limit == 8
        return [
            {"user_id": USER_A, "report_version_id": REPORT_A},
            {"user_id": USER_B, "report_version_id": REPORT_B},
        ]

    async def recover(*, authenticated_user_id, report_version_id):
        calls.append((authenticated_user_id, report_version_id))
        return {"timeline": "completed"}

    monkeypatch.setattr(svc, "list_global_recoverable_followup_reports", candidates)
    monkeypatch.setattr(dispatcher, "recover_report_followups", recover)

    result = await dispatcher.recover_global_pending_report_followups(max_reports=8, concurrency=2)

    assert result == {"discovered": 2, "processed": 2, "failed": 0}
    assert set(calls) == {(USER_A, REPORT_A), (USER_B, REPORT_B)}


@pytest.mark.asyncio
async def test_global_worker_bounds_concurrency_and_isolates_failures(monkeypatch):
    active = 0
    maximum_active = 0

    async def candidates(*, limit):
        return [
            {"user_id": USER_A, "report_version_id": REPORT_A},
            {"user_id": USER_B, "report_version_id": REPORT_B},
        ]

    async def recover(*, authenticated_user_id, report_version_id):
        nonlocal active, maximum_active
        active += 1
        maximum_active = max(maximum_active, active)
        await asyncio.sleep(0)
        active -= 1
        if report_version_id == REPORT_B:
            raise RuntimeError("transient failure")
        return {}

    monkeypatch.setattr(svc, "list_global_recoverable_followup_reports", candidates)
    monkeypatch.setattr(dispatcher, "recover_report_followups", recover)

    result = await dispatcher.recover_global_pending_report_followups(max_reports=2, concurrency=1)

    assert result == {"discovered": 2, "processed": 1, "failed": 1}
    assert maximum_active == 1


@pytest.mark.asyncio
async def test_worker_shutdown_keeps_durable_work_for_the_next_start(monkeypatch):
    stopped = asyncio.Event()
    cycles = []

    async def cycle():
        cycles.append(True)
        stopped.set()
        return {"discovered": 1, "processed": 0, "failed": 1}

    monkeypatch.setattr(worker.settings, "recovery_worker_enabled", True)
    monkeypatch.setattr(worker, "run_recovery_cycle", cycle)

    await worker.run_worker(stop_event=stopped)

    assert cycles == [True]


@pytest.mark.asyncio
async def test_worker_refuses_to_run_when_not_explicitly_enabled(monkeypatch):
    monkeypatch.setattr(worker.settings, "recovery_worker_enabled", False)
    with pytest.raises(RuntimeError, match="recovery_worker_disabled"):
        await worker.run_worker(stop_event=asyncio.Event())


class _Response:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self):
        self.or_clause = None
        self.limit_value = None

    def select(self, *_args): return self
    def or_(self, value): self.or_clause = value; return self
    def order(self, *_args): return self
    def limit(self, value): self.limit_value = value; return self
    def execute(self):
        return _Response([
            {"user_id": USER_A, "report_version_id": REPORT_A},
            {"user_id": USER_A, "report_version_id": REPORT_A},
        ])


@pytest.mark.asyncio
async def test_global_discovery_queries_only_pending_retryable_or_expired_leases(monkeypatch):
    query = _Query()

    class Client:
        def table(self, name):
            assert name == "analysis_followup_work"
            return query

    async def inline(call):
        return call()

    monkeypatch.setattr(svc, "_get_supabase", lambda: Client())
    monkeypatch.setattr(svc, "_run", inline)

    result = await svc.list_global_recoverable_followup_reports(limit=2)

    assert result == [{"user_id": USER_A, "report_version_id": REPORT_A}]
    assert "status.in.(pending,retryable)" in query.or_clause
    assert "status.eq.processing" in query.or_clause
    assert "lease_expires_at.lte." in query.or_clause
    assert query.limit_value == 16


def test_worker_is_separate_from_uvicorn_and_never_rebuilds_clinical_output():
    root = Path(__file__).resolve().parents[2]
    worker_source = (root / "backend/app/workers/autonomous_recovery.py").read_text()
    dispatcher_source = (root / "backend/app/services/recovery_dispatcher.py").read_text()
    compose = (root / "docker-compose.prod.yml").read_text()

    assert "lab_analysis_pipeline" not in worker_source
    assert "openai" not in worker_source.lower()
    assert "recover_global_pending_report_followups" in worker_source
    assert "recovery-worker:" in compose
    assert "command: python -m app.workers.autonomous_recovery" in compose
    assert "command: uvicorn" in compose
    assert "claim_frozen_followup_work" in dispatcher_source
    assert "load_frozen_followup_payload" in dispatcher_source
