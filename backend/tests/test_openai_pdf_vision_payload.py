import pytest

from app.services import claude_pdf_analyzer
from app.services.claude_pdf_analyzer import OpenAIPDFAnalyzer


class _FakeResponse:
    status_code = 200
    text = '{"ok":true}'

    def raise_for_status(self):
        return None

    def json(self):
        return {"choices": [{"message": {"content": '{"biomarkers":[]}'}}]}


class _FakeAsyncClient:
    captured_payload = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def post(self, _path, json=None, headers=None):
        _FakeAsyncClient.captured_payload = json
        return _FakeResponse()


@pytest.mark.asyncio
async def test_openai_vision_payload_uses_image_url(monkeypatch):
    monkeypatch.setattr(claude_pdf_analyzer.httpx, "AsyncClient", _FakeAsyncClient)

    analyzer = OpenAIPDFAnalyzer(api_key="test-key", model="gpt-4o-mini")
    await analyzer._send_vision_completion("abc123", "Read this lab report")

    content = _FakeAsyncClient.captured_payload["messages"][0]["content"]
    image_part = content[0]

    assert image_part["type"] == "image_url"
    assert image_part["image_url"]["url"] == "data:image/jpeg;base64,abc123"


def test_extraction_prompt_is_kb_aligned_and_extraction_only():
    prompt = OpenAIPDFAnalyzer._build_extraction_prompt(
        document_kind="lab report image",
        symptoms=["fatigue"],
        knowledge_context="\nKnown lab markers:\n- ferritin: Ferritin | units: ng/mL",
    )

    assert "marker_key" in prompt
    assert "source_name" in prompt
    assert "OPTIMAL, BORDERLINE, DEFICIENT, ELEVATED" in prompt
    assert "Do not diagnose" in prompt
    assert "Do not generate supplement plans" in prompt
    assert "ferritin: Ferritin" in prompt
    assert '"protocol"' not in prompt
