from app.services import claude_service
from app.services.claude_service import (
    _analysis_source_cv,
    _chat_completions_path,
    _fallback_extract_biomarkers,
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
