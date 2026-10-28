"""P28.1: LLM Usage Logging Coverage Fix.

Covers: PDF text/vision extraction and table extraction each persist a
usage event (reusing claude_service._persist_usage_event) when the
provider response includes usage metadata; a logging failure never fails
extraction (fail-open); missing/unknown token usage is logged explicitly
rather than guessed or silently skipped; and the fix touches no clinical
extraction/model/prompt/retry behavior.
"""

import inspect

import httpx
import pytest
import tenacity

from app.services import claude_service
from app.services.claude_pdf_analyzer import ImageAnalyzer, PDFTextAnalyzer
from app.services.table_analyzer import TableAnalyzer


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.text = "ok"

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("POST", "https://example.test/chat/completions")
            response = httpx.Response(self.status_code, request=request, text=self.text)
            raise httpx.HTTPStatusError("error", request=request, response=response)

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, *_args, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False

    async def post(self, *_args, **_kwargs):
        return _FakeAsyncClient._next_response


def _install_fake_http(monkeypatch, module, payload):
    _FakeAsyncClient._next_response = _FakeResponse(payload)
    monkeypatch.setattr(module.httpx, "AsyncClient", _FakeAsyncClient)


def _capture_persisted_events(monkeypatch):
    calls = []

    async def _fake_persist(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(claude_service, "_persist_usage_event", _fake_persist)
    return calls


_TEXT_PAYLOAD_WITH_USAGE = {
    "id": "resp-1",
    "model": "gpt-4o-mini",
    "choices": [{"message": {"content": '{"biomarkers": []}'}}],
    "usage": {"prompt_tokens": 120, "completion_tokens": 40, "total_tokens": 160},
}

_VISION_PAYLOAD_WITH_USAGE = {
    "id": "resp-2",
    "model": "gpt-4o",
    "choices": [{"message": {"content": '{"biomarkers": []}'}}],
    "usage": {"prompt_tokens": 900, "completion_tokens": 60, "total_tokens": 960},
}


@pytest.mark.asyncio
async def test_pdf_text_extraction_persists_usage_event_when_usage_present(monkeypatch):
    import app.services.claude_pdf_analyzer as module
    _install_fake_http(monkeypatch, module, _TEXT_PAYLOAD_WITH_USAGE)
    calls = _capture_persisted_events(monkeypatch)

    analyzer = PDFTextAnalyzer(api_key="test-key", user_id="user-1", upload_id="upload-1")
    content = await analyzer._send_text_completion_with_retry("extract biomarkers")

    assert content == '{"biomarkers": []}'
    assert len(calls) == 1
    call = calls[0]
    assert call["task_name"] == "pdf_text_extraction"
    assert call["provider"] == "openai"
    assert call["user_id"] == "user-1"
    assert call["upload_id"] == "upload-1"
    assert call["payload"] == _TEXT_PAYLOAD_WITH_USAGE


@pytest.mark.asyncio
async def test_pdf_vision_extraction_persists_usage_event_with_vision_provider(monkeypatch):
    import app.services.claude_pdf_analyzer as module
    _install_fake_http(monkeypatch, module, _VISION_PAYLOAD_WITH_USAGE)
    calls = _capture_persisted_events(monkeypatch)

    analyzer = ImageAnalyzer(api_key="test-key", user_id="user-2", upload_id="upload-2")
    content = await analyzer._send_vision_completion_with_retry("base64data", "extract biomarkers")

    assert content == '{"biomarkers": []}'
    assert len(calls) == 1
    call = calls[0]
    assert call["task_name"] == "pdf_vision_extraction"
    assert call["provider"] == "openai-vision"
    assert call["user_id"] == "user-2"
    assert call["upload_id"] == "upload-2"


@pytest.mark.asyncio
async def test_table_extraction_persists_usage_event_with_table_task_name(monkeypatch):
    import app.services.claude_pdf_analyzer as module
    _install_fake_http(monkeypatch, module, _TEXT_PAYLOAD_WITH_USAGE)
    calls = _capture_persisted_events(monkeypatch)

    analyzer = TableAnalyzer(api_key="test-key", user_id="user-3", upload_id="upload-3")
    content = await analyzer._send_text_completion_with_retry("extract from table")

    assert content == '{"biomarkers": []}'
    assert len(calls) == 1
    assert calls[0]["task_name"] == "table_extraction"
    assert calls[0]["provider"] == "openai"


@pytest.mark.asyncio
async def test_usage_logging_failure_does_not_fail_extraction(monkeypatch):
    """The core fail-open guarantee: a broken/raising usage logger must
    never turn a successful extraction into a failed one."""
    import app.services.claude_pdf_analyzer as module
    _install_fake_http(monkeypatch, module, _TEXT_PAYLOAD_WITH_USAGE)

    async def _broken_persist(**_kwargs):
        raise RuntimeError("supabase insert exploded")

    monkeypatch.setattr(claude_service, "_persist_usage_event", _broken_persist)

    analyzer = PDFTextAnalyzer(api_key="test-key", user_id="user-4", upload_id="upload-4")
    content = await analyzer._send_text_completion_with_retry("extract biomarkers")

    assert content == '{"biomarkers": []}'  # extraction still succeeds


@pytest.mark.asyncio
async def test_provider_call_failure_behavior_is_unchanged(monkeypatch):
    """A real provider failure (e.g. a 500) must still raise/propagate
    exactly as before -- usage logging must not swallow or alter that."""
    import app.services.claude_pdf_analyzer as module

    class _FailingClient(_FakeAsyncClient):
        async def post(self, *_a, **_kw):
            request = httpx.Request("POST", "https://example.test/chat/completions")
            response = httpx.Response(500, request=request, text="server error")
            raise httpx.HTTPStatusError("error", request=request, response=response)

    monkeypatch.setattr(module.httpx, "AsyncClient", _FailingClient)
    calls = _capture_persisted_events(monkeypatch)

    analyzer = PDFTextAnalyzer(api_key="test-key")
    # A 500 is normally retried up to 3x with exponential backoff (see
    # _is_retryable_api_error) -- that policy is untouched production
    # code, just reconfigured here to stop after 1 attempt so this test
    # doesn't spend several real seconds sleeping between retries.
    original_stop = analyzer._send_text_completion_with_retry.retry.stop
    analyzer._send_text_completion_with_retry.retry.stop = tenacity.stop_after_attempt(1)
    try:
        with pytest.raises(httpx.HTTPStatusError):
            await analyzer._send_text_completion_with_retry("prompt")
    finally:
        analyzer._send_text_completion_with_retry.retry.stop = original_stop

    assert calls == []  # no usage to log -- the call never got a response


@pytest.mark.asyncio
async def test_missing_usage_metadata_logged_as_explicit_unknown_not_guessed(monkeypatch):
    """Exercises the real claude_service._persist_usage_event (not
    mocked) with a payload that has no usage block at all -- proves the
    row is still written, with token counts at the schema's NOT NULL
    default (0) and an explicit meta.usage_reported=False flag, rather
    than silently skipping the row (the old behavior) or guessing a
    nonzero value."""
    inserted_rows = []

    class _FakeTable:
        def __init__(self, name):
            self.name = name

        def insert(self, row):
            inserted_rows.append(row)
            return self

        def execute(self):
            return None

    class _FakeSupabase:
        def table(self, name):
            return _FakeTable(name)

    from app.services import supabase_service as svc
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSupabase())

    payload_without_usage = {"id": "resp-no-usage", "model": "gpt-4o-mini", "choices": []}

    await claude_service._persist_usage_event(
        task_name="pdf_text_extraction",
        payload=payload_without_usage,
        user_id="user-5",
        upload_id="upload-5",
        provider="openai",
    )

    assert len(inserted_rows) == 1
    row = inserted_rows[0]
    assert row["prompt_tokens"] == 0
    assert row["completion_tokens"] == 0
    assert row["total_tokens"] == 0
    assert row["meta"]["usage_reported"] is False
    assert row["provider"] == "openai"


@pytest.mark.asyncio
async def test_present_usage_metadata_logged_with_usage_reported_true(monkeypatch):
    inserted_rows = []

    class _FakeTable:
        def insert(self, row):
            inserted_rows.append(row)
            return self

        def execute(self):
            return None

    class _FakeSupabase:
        def table(self, _name):
            return _FakeTable()

    from app.services import supabase_service as svc
    monkeypatch.setattr(svc, "_get_supabase", lambda: _FakeSupabase())

    await claude_service._persist_usage_event(
        task_name="pdf_vision_extraction",
        payload=_VISION_PAYLOAD_WITH_USAGE,
        user_id="user-6",
        upload_id="upload-6",
        provider="openai-vision",
    )

    row = inserted_rows[0]
    assert row["prompt_tokens"] == 900
    assert row["completion_tokens"] == 60
    assert row["total_tokens"] == 960
    assert row["meta"]["usage_reported"] is True
    assert row["provider"] == "openai-vision"


def test_default_provider_still_openai_for_backward_compatible_callers():
    """Existing callers (extract_biomarkers, generate_protocol, the
    questionnaire calls) never pass `provider` explicitly -- confirm the
    parameter default preserves their exact prior behavior."""
    signature = inspect.signature(claude_service._persist_usage_event)
    assert signature.parameters["provider"].default == "openai"


def test_analyzer_constructor_accepts_optional_identity_context_without_breaking_existing_construction():
    """Every pre-existing construction site calls e.g.
    PDFTextAnalyzer(api_key=...) with no user_id/upload_id -- must still
    work unchanged."""
    analyzer = PDFTextAnalyzer(api_key="test-key")
    assert analyzer.user_id is None
    assert analyzer.upload_id is None

    analyzer_with_context = PDFTextAnalyzer(api_key="test-key", user_id="u", upload_id="up")
    assert analyzer_with_context.user_id == "u"
    assert analyzer_with_context.upload_id == "up"
