"""
Tests for OCRService — engine selection, text scoring, mock data, edge cases.
Does NOT require Tesseract/CV2 at import time; uses mocking for heavy deps.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.ocr_service import OCRService


@pytest.fixture
def ocr():
    return OCRService()


# ── Initialisation ───────────────────────────────────────────────────────────

def test_ocr_service_initialises(ocr):
    assert ocr is not None


# ── Text signal scoring ──────────────────────────────────────────────────────

def test_text_signal_score_empty(ocr):
    score = ocr._text_signal_score("")
    assert score == pytest.approx(0.0)


def test_text_signal_score_numbers(ocr):
    score = ocr._text_signal_score("Glucose 85 mg/dL\nHemoglobin 14.2")
    assert score > 0.0


def test_text_signal_score_garbage(ocr):
    garbage = "###@@@@!!!###@@@!!!"
    score = ocr._text_signal_score(garbage)
    assert score < ocr._text_signal_score("Glucose 85 mg/dL")


def test_text_signal_score_long_real_text(ocr):
    real = (
        "Patient: John Doe\nDate: 2026-01-15\n"
        "Glucose: 92 mg/dL (ref: 70-99)\n"
        "Hemoglobin: 14.1 g/dL\n"
        "WBC: 6.5 x10^3/uL\n"
        "Platelets: 250 x10^3/uL"
    )
    score = ocr._text_signal_score(real)
    assert score > 0.5


# ── Mock lab data (fallback path) ────────────────────────────────────────────

def test_get_mock_lab_data_returns_string(ocr):
    mock_data = ocr._get_mock_lab_data()
    assert isinstance(mock_data, str)
    assert len(mock_data) > 0


# ── Engine order ─────────────────────────────────────────────────────────────

def test_engine_order_returns_list(ocr):
    order = ocr._engine_order_for_request("test-key-123")
    assert isinstance(order, list)


def test_engine_order_consistent_for_same_key(ocr):
    key = "stable-key-abc"
    order1 = ocr._engine_order_for_request(key)
    order2 = ocr._engine_order_for_request(key)
    assert [e.name for e in order1] == [e.name for e in order2]


# ── extract_text (async, mocked heavy deps) ──────────────────────────────────

@pytest.mark.asyncio
async def test_extract_text_from_pdf_mocked(ocr):
    """extract_text with PDF input uses _extract_text_from_pdf internally."""
    fake_text = "Glucose: 92 mg/dL"
    with patch.object(ocr, "_extract_text_from_pdf", return_value=fake_text):
        result = await ocr.extract_text(b"%PDF-mock-bytes", "lab.pdf")
    assert result == fake_text


@pytest.mark.asyncio
async def test_extract_text_from_image_mocked(ocr):
    fake_text = "Hemoglobin: 14.1 g/dL"
    with patch.object(ocr, "_extract_text_from_image", return_value=fake_text):
        result = await ocr.extract_text(b"\x89PNG\r\nfake", "lab.png")
    assert result == fake_text


@pytest.mark.asyncio
async def test_extract_text_empty_bytes_returns_string(ocr):
    with patch.object(ocr, "_extract_text_from_image", return_value=""):
        result = await ocr.extract_text(b"", "empty.jpg")
    assert isinstance(result, str)


# ── Router-level (analyze/text endpoint via TestClient) ──────────────────────

def test_analyze_text_endpoint_returns_200():
    """POST /api/v1/analyze/text with valid text returns 200 and biomarkers list."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services.medical_analyzer import MedicalAnalyzer

    fake_biomarkers = [{"name": "Glucose", "value": 92.0, "status": "normal", "unit": "mg/dL"}]

    with patch.object(MedicalAnalyzer, "analyze_biomarkers", new_callable=AsyncMock, return_value=fake_biomarkers), \
         patch.object(MedicalAnalyzer, "generate_recommendations", return_value=["Stay hydrated"]):
        client = TestClient(app)
        response = client.post("/api/v1/analyze/text", data={"text": "Glucose: 92 mg/dL"})

    assert response.status_code == 200
    body = response.json()
    assert "biomarkers" in body
    assert isinstance(body["biomarkers"], list)
