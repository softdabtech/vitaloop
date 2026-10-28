from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest


class _Query:
    def __init__(self, db: dict[str, list[dict]], table: str):
        self.db = db
        self.table = table
        self.filters: list[tuple[str, str, object]] = []
        self.update_payload: dict | None = None
        self.delete_requested = False
        self._limit: int | None = None
        self._count: str | None = None
        self._select: str | None = None
        self.not_ = _NotFilter(self)

    def select(self, columns="*", count=None):
        self._select = columns
        self._count = count
        return self

    def eq(self, column, value):
        self.filters.append((column, "eq", value))
        return self

    def lt(self, column, value):
        self.filters.append((column, "lt", value))
        return self

    def in_(self, column, values):
        self.filters.append((column, "in", set(values)))
        return self

    def filter(self, column, operator, value):
        self.filters.append((column, operator, value))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, value):
        self._limit = value
        return self

    def update(self, payload):
        self.update_payload = payload
        return self

    def delete(self):
        self.delete_requested = True
        return self

    def execute(self):
        rows = [row for row in self.db.get(self.table, []) if self._matches(row)]
        if self.delete_requested:
            ids = {id(row) for row in rows}
            self.db[self.table] = [row for row in self.db.get(self.table, []) if id(row) not in ids]
            return SimpleNamespace(data=rows, count=len(rows))
        if self.update_payload is not None:
            for row in rows:
                row.update(self.update_payload)
            return SimpleNamespace(data=rows, count=len(rows))
        if self._limit is not None:
            rows = rows[: self._limit]
        return SimpleNamespace(data=rows, count=len(rows) if self._count == "exact" else None)

    def _matches(self, row: dict) -> bool:
        for column, operator, value in self.filters:
            current = _nested_get(row, column)
            if operator == "eq" and current != value:
                return False
            if operator == "lt" and str(current) >= str(value):
                return False
            if operator == "in" and current not in value:
                return False
            if operator == "is" and value == "null" and current is not None:
                return False
            if operator == "not.is" and value == "null" and current is None:
                return False
        return True


class _NotFilter:
    def __init__(self, query: _Query):
        self.query = query

    def is_(self, column, value):
        self.query.filters.append((column, "not.is", value))
        return self.query


class _Client:
    def __init__(self, db: dict[str, list[dict]]):
        self.db = db

    def table(self, table: str):
        return _Query(self.db, table)


def _nested_get(row: dict, column: str):
    if column == "metadata->>upload_id":
        metadata = row.get("metadata") or {}
        return metadata.get("upload_id")
    return row.get(column)


async def _run_sync(fn):
    return fn()


@pytest.mark.asyncio
async def test_retention_179_days_is_not_redacted(monkeypatch):
    from app.config import settings
    from app.services import analysis_queue_service as queue
    from app.services import supabase_service as svc

    now = datetime.now(timezone.utc)
    db = {
        "lab_uploads": [
            {
                "id": "upload-179",
                "created_at": (now - timedelta(days=179)).isoformat(),
                "extracted_text": "keep me",
            }
        ]
    }

    monkeypatch.setattr(settings, "lab_upload_raw_retention_days", 180)
    monkeypatch.setattr(settings, "lab_upload_retention_batch_size", 500)
    monkeypatch.setattr(svc, "_get_supabase", lambda: _Client(db))
    monkeypatch.setattr(svc, "_run", _run_sync)

    result = await queue.run_retention_cleanup_once()

    assert result["redacted"] == 0
    assert db["lab_uploads"][0]["extracted_text"] == "keep me"


@pytest.mark.asyncio
async def test_retention_181_days_is_redacted_and_preserves_derived_data(monkeypatch):
    from app.config import settings
    from app.services import analysis_queue_service as queue
    from app.services import supabase_service as svc

    now = datetime.now(timezone.utc)
    db = {
        "lab_uploads": [
            {
                "id": "upload-181",
                "created_at": (now - timedelta(days=181)).isoformat(),
                "extracted_text": "redact me",
            }
        ],
        "biomarkers": [{"upload_id": "upload-181", "name": "Ferritin"}],
        "protocols": [{"upload_id": "upload-181", "title": "Plan"}],
    }

    monkeypatch.setattr(settings, "lab_upload_raw_retention_days", 180)
    monkeypatch.setattr(settings, "lab_upload_retention_batch_size", 500)
    monkeypatch.setattr(svc, "_get_supabase", lambda: _Client(db))
    monkeypatch.setattr(svc, "_run", _run_sync)

    result = await queue.run_retention_cleanup_once()

    assert result["redacted"] == 1
    assert db["lab_uploads"][0]["extracted_text"] is None
    assert db["biomarkers"] == [{"upload_id": "upload-181", "name": "Ferritin"}]
    assert db["protocols"] == [{"upload_id": "upload-181", "title": "Plan"}]


@pytest.mark.asyncio
async def test_retention_idempotency(monkeypatch):
    from app.config import settings
    from app.services import analysis_queue_service as queue
    from app.services import supabase_service as svc

    now = datetime.now(timezone.utc)
    db = {
        "lab_uploads": [
            {
                "id": "upload-old",
                "created_at": (now - timedelta(days=181)).isoformat(),
                "extracted_text": "redact once",
            }
        ]
    }

    monkeypatch.setattr(settings, "lab_upload_raw_retention_days", 180)
    monkeypatch.setattr(settings, "lab_upload_retention_batch_size", 500)
    monkeypatch.setattr(svc, "_get_supabase", lambda: _Client(db))
    monkeypatch.setattr(svc, "_run", _run_sync)

    first = await queue.run_retention_cleanup_once()
    second = await queue.run_retention_cleanup_once()

    assert first["redacted"] == 1
    assert second["redacted"] == 0
    assert db["lab_uploads"][0]["extracted_text"] is None


def test_retention_scheduler_callable_executes_async_body(monkeypatch):
    from app.services import analysis_queue_service as queue

    called = {"value": False}

    async def fake_once():
        called["value"] = True
        return {"redacted": 0}

    monkeypatch.setattr(queue, "run_retention_cleanup_once", fake_once)

    assert queue.run_retention_cleanup_job() == {"redacted": 0}
    assert called["value"] is True


@pytest.mark.asyncio
async def test_upload_delete_refreshes_current_state_without_deleting_history(monkeypatch):
    from app.routers.analysis import dashboard as dashboard_router
    from app.routers.analysis import uploads as uploads_router

    user_id = "user-1"
    upload_a = "upload-a-old"
    upload_b = "upload-b-new"
    db = {
        "lab_uploads": [
            {"id": upload_a, "user_id": user_id, "created_at": "2026-08-01T00:00:00+00:00"},
            {"id": upload_b, "user_id": user_id, "created_at": "2026-09-01T00:00:00+00:00"},
        ],
        "timeline_events": [
            {"user_id": user_id, "metadata": {"upload_id": upload_b}, "summary": "B uploaded"},
            {"user_id": user_id, "metadata": {"upload_id": upload_a}, "summary": "A uploaded"},
        ],
        "insights": [
            {"id": "insight-b", "user_id": user_id, "dismissed": False, "title": "stale"},
        ],
        "health_scores": [{"user_id": user_id, "score": 10}],
    }
    calls = {"score": 0, "cache": 0}

    async def fake_score(refresh_user_id):
        calls["score"] += 1
        assert refresh_user_id == user_id
        db["health_scores"].append({"user_id": user_id, "score": 80})
        return {"score": 80}

    monkeypatch.setattr(uploads_router, "_get_supabase", lambda: _Client(db))
    monkeypatch.setattr(uploads_router, "_run", _run_sync)
    monkeypatch.setattr(uploads_router.svc, "calculate_health_score", fake_score)
    monkeypatch.setattr(dashboard_router, "invalidate_summary_cache", lambda uid: calls.__setitem__("cache", calls["cache"] + 1))

    result = await uploads_router.delete_upload(upload_b, {"sub": user_id})

    assert result["ok"] is True
    assert db["lab_uploads"] == [{"id": upload_a, "user_id": user_id, "created_at": "2026-08-01T00:00:00+00:00"}]
    assert db["timeline_events"] == [{"user_id": user_id, "metadata": {"upload_id": upload_a}, "summary": "A uploaded"}]
    assert db["insights"][0]["dismissed"] is True
    assert calls == {"score": 1, "cache": 1}
