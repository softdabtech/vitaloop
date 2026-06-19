from types import SimpleNamespace

import pytest

from app.services import claude_pdf_analyzer
from app.services.claude_pdf_analyzer import PDFTextAnalyzer


class _FakeMarkItDown:
    def __init__(self, enable_plugins=False):
        assert enable_plugins is False

    def convert_local(self, pdf_path):
        assert pdf_path.endswith(".pdf")
        return SimpleNamespace(
            text_content="# Lab Results\n\n| Marker | Value |\n|---|---:|\n| Ferritin | 18 ng/mL |"
        )


def test_markitdown_pdf_content_is_preferred(monkeypatch, tmp_path):
    pdf_path = tmp_path / "labs.pdf"
    pdf_path.write_bytes(b"%PDF-1.4")

    monkeypatch.setattr(claude_pdf_analyzer, "MarkItDown", _FakeMarkItDown)
    monkeypatch.setattr(
        PDFTextAnalyzer,
        "_extract_pdf_text_with_pypdf",
        lambda *_args, **_kwargs: pytest.fail("pypdf fallback should not run"),
    )

    text, parser = PDFTextAnalyzer._extract_pdf_content(str(pdf_path))

    assert parser == "markitdown"
    assert "| Ferritin | 18 ng/mL |" in text


def test_markitdown_failure_falls_back_to_pypdf(monkeypatch, tmp_path):
    class _BrokenMarkItDown:
        def __init__(self, enable_plugins=False):
            pass

        def convert_local(self, _pdf_path):
            raise RuntimeError("conversion failed")

    pdf_path = tmp_path / "labs.pdf"
    pdf_path.write_bytes(b"%PDF-1.4")

    monkeypatch.setattr(claude_pdf_analyzer, "MarkItDown", _BrokenMarkItDown)
    monkeypatch.setattr(
        PDFTextAnalyzer,
        "_extract_pdf_text_with_pypdf",
        lambda *_args, **_kwargs: "Ferritin 18 ng/mL reference 30-150",
    )

    text, parser = PDFTextAnalyzer._extract_pdf_content(str(pdf_path))

    assert parser == "pypdf"
    assert text == "Ferritin 18 ng/mL reference 30-150"


@pytest.mark.asyncio
async def test_pdf_analysis_reports_markitdown_method(monkeypatch, tmp_path):
    pdf_path = tmp_path / "labs.pdf"
    pdf_path.write_bytes(b"%PDF-1.4")
    analyzer = PDFTextAnalyzer(api_key="test-key")

    monkeypatch.setattr(
        analyzer,
        "_extract_pdf_content",
        lambda *_args, **_kwargs: (
            "# Lab Results\n\n| Marker | Value | Range |\n|---|---:|---:|\n| Ferritin | 18 | 30-150 |",
            "markitdown",
        ),
    )
    monkeypatch.setattr(analyzer, "_knowledge_context", _empty_knowledge_context)
    monkeypatch.setattr(
        analyzer,
        "_send_text_completion",
        _successful_completion,
    )

    result = await analyzer.analyze(str(pdf_path))

    assert result["success"] is True
    assert result["analysis_method"] == "openai_pdf_text_markitdown"
    assert result["document_parser"] == "markitdown"
    assert result["document_input_chars"] > 50
    assert result["document_chunks"] == 1


def test_chunk_document_text_and_merge_payloads_deduplicate_markers():
    text = "\n".join(f"Ferritin row {index}" for index in range(1000))
    chunks = PDFTextAnalyzer._chunk_document_text(text, max_chars=500)

    assert len(chunks) > 1
    assert all(len(chunk) <= 520 for chunk in chunks)

    merged = PDFTextAnalyzer._merge_extraction_payloads(
        [
            {
                "biomarkers": [
                    {"marker_key": "ferritin", "name": "Ferritin", "value": 10.06, "unit": "ng/mL"},
                ]
            },
            {
                "biomarkers": [
                    {"marker_key": "ferritin", "name": "Ferritin", "value": 10.06, "unit": "ng/mL"},
                    {"marker_key": "vitamin_b12", "name": "Vitamin B12", "value": 1177, "unit": "pg/mL"},
                ]
            },
        ]
    )

    assert len(merged["biomarkers"]) == 2
    assert merged["summary"]["text_chunks_analyzed"] == 2


async def _empty_knowledge_context():
    return ""


async def _successful_completion(_prompt):
    return '{"biomarkers":[{"name":"Ferritin","value":18}],"summary":{}}'
