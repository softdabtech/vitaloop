import pytest
from fastapi import HTTPException

from app.routers.analysis.analyze import _normalize_lab_text, _normalize_symptoms as normalize_analyze_symptoms
from app.routers.protocol.protocol import _normalize_symptoms as normalize_protocol_symptoms


def test_normalize_lab_text_removes_null_and_collapses_spacing():
    raw = "\x00  GLUCOSE   95  mg/dL\n\nHEMOGLOBIN   13.4  g/dL  "
    result = _normalize_lab_text(raw)

    assert "\x00" not in result
    assert "  " not in result
    assert "GLUCOSE 95 mg/dL" in result
    assert "HEMOGLOBIN 13.4 g/dL" in result


@pytest.mark.parametrize("normalizer", [normalize_analyze_symptoms, normalize_protocol_symptoms])
def test_normalize_symptoms_deduplicates_and_trims(normalizer):
    result = normalizer([" Fatigue ", "fatigue", " Headache ", "", "  "])
    assert result == ["fatigue", "headache"]


@pytest.mark.parametrize("normalizer", [normalize_analyze_symptoms, normalize_protocol_symptoms])
def test_normalize_symptoms_rejects_long_values(normalizer):
    too_long = "x" * 61
    with pytest.raises(HTTPException) as exc:
        normalizer([too_long])

    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "SYMPTOM_TOO_LONG"


@pytest.mark.parametrize("normalizer", [normalize_analyze_symptoms, normalize_protocol_symptoms])
def test_normalize_symptoms_rejects_too_many_items(normalizer):
    payload = [f"symptom-{i}" for i in range(21)]
    with pytest.raises(HTTPException) as exc:
        normalizer(payload)

    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "TOO_MANY_SYMPTOMS"
