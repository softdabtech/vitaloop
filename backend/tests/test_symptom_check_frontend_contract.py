from pathlib import Path


ROOT = Path(__file__).parents[2]
PAGE = (ROOT / "frontend/src/pages/SymptomCheck.jsx").read_text(encoding="utf-8")
API = (ROOT / "frontend/src/api/symptomCheck.js").read_text(encoding="utf-8")
APP = (ROOT / "frontend/src/App.jsx").read_text(encoding="utf-8")


def test_en_route_uses_new_server_owned_three_stage_symptom_flow():
    assert "import('./pages/SymptomCheck.jsx')" in APP
    assert "Current state" in PAGE
    assert "Main signals" in PAGE
    assert "Adaptive detail" in PAGE
    assert "getCurrentSymptomSession" in PAGE
    assert "submitInitialSymptomEvidence" in PAGE
    assert "submitSymptomAnswers" in PAGE


def test_medical_inputs_are_controlled_dropdowns_without_free_text():
    lower = PAGE.lower()
    assert "<select" in lower
    assert "<textarea" not in lower
    assert "contenteditable" not in lower
    assert "medical_details" not in lower
    assert "choice_id: answers[item.id]" in PAGE


def test_answer_api_requires_idempotency_header_and_has_resume_skip_abandon_paths():
    assert "'X-Idempotency-Key': idempotencyKey" in API
    assert "/symptom-check/sessions/current" in API
    assert "/initial-evidence" in API
    assert "/answers" in API
    assert "/skip" in API
    assert "/abandon" in API


def test_emergency_state_is_blocking_non_diagnostic_candidate_copy():
    assert 'role={emergency ? \'alert\' : \'status\'}' in PAGE
    assert "aria-live={emergency ? 'assertive' : 'polite'}" in PAGE
    assert "Get emergency help now" in PAGE
    assert "may indicate a serious medical emergency" in PAGE
    assert "This symptom check cannot determine the cause" in PAGE
    assert "Do not drive yourself" in PAGE
    assert "cannot continue this interview" in PAGE
    assert "probability" not in PAGE.lower()
    assert "diagnosis" in PAGE.lower()
