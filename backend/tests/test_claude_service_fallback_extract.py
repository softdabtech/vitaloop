import httpx
import pytest

from app.services import claude_service
from app.services.claude_service import (
    _analysis_source_cv,
    _chat_completion,
    _chat_completions_path,
    _fallback_extract_biomarkers,
    _is_retryable_llm_error,
    get_analysis_source,
)


def test_fallback_extract_supports_cyrillic_lines():
    text = """
    Гемоглобин 136 г/л 120-160
    Ферритин: 18 нг/мл (30-150)
    Vitamin D 25.4 ng/mL 30-100
    """.strip()

    rows = _fallback_extract_biomarkers(text)
    names = {row["name"] for row in rows}

    assert "Гемоглобин" in names
    assert "Ферритин" in names
    assert "Vitamin D" in names

    ferritin = next(row for row in rows if row["name"] == "Ферритин")
    assert ferritin["value"] == 18.0
    assert ferritin["ref_low"] == 30.0
    assert ferritin["ref_high"] == 150.0


# ---------------------------------------------------------------------------
# Direct OpenAI routing tests
# ---------------------------------------------------------------------------

def test_path_uses_direct_openai_chat_completions():
    """The backend only uses the direct OpenAI-compatible endpoint."""
    path = _chat_completions_path()
    assert path == "chat/completions"


# ---------------------------------------------------------------------------
# get_analysis_source / _analysis_source_cv tests
# ---------------------------------------------------------------------------

def test_analysis_source_default_is_unknown():
    token = _analysis_source_cv.set("unknown")
    try:
        assert get_analysis_source() == "unknown"
    finally:
        _analysis_source_cv.reset(token)


def test_analysis_source_can_be_set_to_fallback():
    token = _analysis_source_cv.set("fallback")
    try:
        assert get_analysis_source() == "fallback"
    finally:
        _analysis_source_cv.reset(token)


def test_analysis_source_can_be_set_to_llm():
    token = _analysis_source_cv.set("llm")
    try:
        assert get_analysis_source() == "llm"
    finally:
        _analysis_source_cv.reset(token)


# ---------------------------------------------------------------------------
# _chat_completion retry behavior (regression: found 2026-09-03 that
# extract_biomarkers/generate_protocol's own @retry never fired — both wrap
# _chat_completion in a try/except that swallows every exception into a
# local fallback before @retry ever sees a failure. Retry now lives on
# _chat_completion itself, and only for errors a retry can plausibly fix.)
# ---------------------------------------------------------------------------


def _fake_request() -> httpx.Request:
    return httpx.Request("POST", "https://api.openai.com/v1/chat/completions")


def _status_response(status: int) -> httpx.Response:
    request = _fake_request()
    return httpx.Response(status_code=status, request=request, json={"error": "boom"})


def _ok_response() -> httpx.Response:
    request = _fake_request()
    return httpx.Response(
        status_code=200,
        request=request,
        json={"id": "resp_1", "choices": [{"message": {"content": "ok"}}]},
    )


class _FakeClient:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = 0

    async def post(self, *_args, **_kwargs):
        self.calls += 1
        if not self._responses:
            raise AssertionError("no more fake responses queued")
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


async def _fake_persist_usage_event(**_kwargs):
    return None


@pytest.mark.asyncio
async def test_chat_completion_retries_on_transient_5xx_then_succeeds(monkeypatch):
    client = _FakeClient([_status_response(500), _ok_response()])
    monkeypatch.setattr(claude_service, "_get_client", lambda: client)
    monkeypatch.setattr(claude_service, "_persist_usage_event", _fake_persist_usage_event)

    content = await _chat_completion("prompt", task_name="extract_biomarkers")

    assert content == "ok"
    assert client.calls == 2  # one failure, one retry that succeeded


@pytest.mark.asyncio
async def test_chat_completion_does_not_retry_on_4xx(monkeypatch):
    client = _FakeClient([_status_response(400), _ok_response()])
    monkeypatch.setattr(claude_service, "_get_client", lambda: client)
    monkeypatch.setattr(claude_service, "_persist_usage_event", _fake_persist_usage_event)

    with pytest.raises(httpx.HTTPStatusError):
        await _chat_completion("prompt", task_name="extract_biomarkers")

    assert client.calls == 1  # no retry burned on a non-retryable error


def test_is_retryable_llm_error_classification():
    assert _is_retryable_llm_error(httpx.ConnectError("down")) is True
    assert _is_retryable_llm_error(httpx.ReadTimeout("slow")) is True

    request = _fake_request()
    rate_limited = httpx.HTTPStatusError("429", request=request, response=_status_response(429))
    server_error = httpx.HTTPStatusError("503", request=request, response=_status_response(503))
    bad_request = httpx.HTTPStatusError("400", request=request, response=_status_response(400))

    assert _is_retryable_llm_error(rate_limited) is True
    assert _is_retryable_llm_error(server_error) is True
    assert _is_retryable_llm_error(bad_request) is False
