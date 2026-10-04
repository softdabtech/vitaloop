from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
QUESTIONNAIRE = (REPO_ROOT / "frontend/src/pages/Questionnaire.jsx").read_text(encoding="utf-8")
RESULTS = (REPO_ROOT / "frontend/src/pages/Results.jsx").read_text(encoding="utf-8")


def test_completed_symptom_check_offers_real_report_regeneration_action():
    assert "completeResp?.data?.report_update" in QUESTIONNAIRE
    assert "await api.post(offer.action.endpoint)" in QUESTIONNAIRE
    assert "Your latest report does not include these answers yet" in QUESTIONNAIRE
    assert "Update latest report" in QUESTIONNAIRE


def test_results_explain_which_answers_changed_the_conclusion():
    assert "function SymptomImpactNotice" in RESULTS
    assert "What changed because of your answers" in RESULTS
    assert "impact?.changed" in RESULTS
    assert "item.symptom_concept_ids" in RESULTS
