"""P5 Progress Intelligence: supabase_service.get_previous_report_version_for_user
and lab_analysis_pipeline's history-loading wrapper around it.
"""

import pytest

from app.services import supabase_service
from app.services.lab_analysis_pipeline import _load_previous_clinical_reasoning_traces


class _FakeTable:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("Resp", (), {"data": self._rows})()


class _FakeClient:
    def __init__(self, rows):
        self._rows = rows

    def table(self, name):
        assert name == "report_versions"
        return _FakeTable(self._rows)


async def _fake_run(fn):
    return fn()


@pytest.mark.asyncio
async def test_returns_none_when_no_rows_exist(monkeypatch):
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: _FakeClient([]))
    monkeypatch.setattr(supabase_service, "_run", _fake_run)

    result = await supabase_service.get_previous_report_version_for_user("user-1", exclude_upload_id="upload-2")

    assert result is None


@pytest.mark.asyncio
async def test_excludes_the_current_upload_even_if_it_is_the_newest_row(monkeypatch):
    """A user who just regenerated the current upload's report has that
    upload's own row as the newest — it must never be returned as "the
    previous upload", or Progress Intelligence would diff a report against
    itself and show meaningless zero-change noise."""
    rows = [
        {"upload_id": "upload-current", "created_at": "2026-09-13T10:00:00Z", "input_snapshot": {}},
        {"upload_id": "upload-previous", "created_at": "2026-09-01T10:00:00Z", "input_snapshot": {"clinical_reasoning_traces": [{"pattern_id": "x"}]}},
    ]
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: _FakeClient(rows))
    monkeypatch.setattr(supabase_service, "_run", _fake_run)

    result = await supabase_service.get_previous_report_version_for_user("user-1", exclude_upload_id="upload-current")

    assert result["upload_id"] == "upload-previous"


@pytest.mark.asyncio
async def test_pipeline_wrapper_returns_empty_when_user_id_is_none():
    traces, upload_id, measured_at = await _load_previous_clinical_reasoning_traces(None, "upload-1")

    assert traces == []
    assert upload_id is None
    assert measured_at is None


@pytest.mark.asyncio
async def test_pipeline_wrapper_extracts_traces_from_previous_snapshot(monkeypatch):
    rows = [
        {
            "upload_id": "upload-previous",
            "created_at": "2026-09-01T10:00:00Z",
            "input_snapshot": {"clinical_reasoning_traces": [{"pattern_id": "iron_deficiency_anemia", "confidence": 0.6}]},
        },
    ]
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: _FakeClient(rows))
    monkeypatch.setattr(supabase_service, "_run", _fake_run)

    traces, upload_id, measured_at = await _load_previous_clinical_reasoning_traces("user-1", "upload-current")

    assert traces == [{"pattern_id": "iron_deficiency_anemia", "confidence": 0.6}]
    assert upload_id == "upload-previous"
    assert measured_at == "2026-09-01T10:00:00Z"


@pytest.mark.asyncio
async def test_pipeline_wrapper_fails_open_on_lookup_error(monkeypatch):
    def _boom():
        raise RuntimeError("db unavailable")

    monkeypatch.setattr(supabase_service, "_get_supabase", _boom)

    traces, upload_id, measured_at = await _load_previous_clinical_reasoning_traces("user-1", "upload-current")

    assert traces == []
    assert upload_id is None
    assert measured_at is None
