from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SYMPTOM_CHECK = (REPO_ROOT / "frontend/src/pages/SymptomCheck.jsx").read_text(encoding="utf-8")
SYMPTOM_API = (REPO_ROOT / "frontend/src/api/symptomCheck.js").read_text(encoding="utf-8")
RESULTS = (REPO_ROOT / "frontend/src/pages/Results.jsx").read_text(encoding="utf-8")


def test_completed_symptom_check_offers_real_report_regeneration_action():
    assert "setReportUpdate(data.report_update || null)" in SYMPTOM_CHECK
    assert "regenerateSymptomLinkedReport(reportUpdate.action.endpoint)" in SYMPTOM_CHECK
    assert "Your latest report does not include these answers yet" in SYMPTOM_CHECK
    assert "Update latest report" in SYMPTOM_CHECK
    assert "api.post(endpoint)" in SYMPTOM_API


def test_results_explain_which_answers_changed_the_conclusion():
    assert "function SymptomImpactNotice" in RESULTS
    assert "What changed because of your answers" in RESULTS
    assert "impact?.changed" in RESULTS
    assert "item.symptom_concept_ids" in RESULTS
