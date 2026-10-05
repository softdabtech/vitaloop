from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
RESULTS_PATH = REPO_ROOT / "frontend/src/pages/Results.jsx"
ADAPTER_PATH = REPO_ROOT / "frontend/src/lib/resultOverview.js"
RESULTS = RESULTS_PATH.read_text(encoding="utf-8")
ADAPTER = ADAPTER_PATH.read_text(encoding="utf-8")


def test_p4_first_result_layer_has_all_five_user_questions_in_both_locales():
    english = (
        "What your results show",
        "How this may connect to how you feel",
        "Three priority actions",
        "What information is missing",
        "When to seek clinical advice",
    )
    ukrainian = (
        "Що показують ваші результати",
        "Як це може бути пов’язано з вашим самопочуттям",
        "Три пріоритетні дії",
        "Яких даних не вистачає",
        "Коли потрібна консультація",
    )

    for label in (*english, *ukrainian):
        assert label in RESULTS
    assert 'data-testid="p4-result-overview"' in RESULTS


def test_p4_overview_uses_grounded_contract_and_caps_actions_at_three():
    assert "import { buildResultOverview }" in RESULTS
    assert "groundedNarrative: finalAnalysis?.grounded_ai_narrative" in RESULTS
    assert "caseSynthesis: finalAnalysis?.case_synthesis" in RESULTS
    assert "actions: dedupeItems" in ADAPTER
    assert ").slice(0, 3)" in ADAPTER
    assert "evidence_links" in ADAPTER


def test_p4_technical_engine_blocks_live_inside_one_disclosure():
    start = RESULTS.index("function TechnicalReasoningDisclosure")
    end = RESULTS.index("export default function Results", start)
    disclosure = RESULTS[start:end]

    assert "<details" in disclosure
    assert "Why the system reached this conclusion" in RESULTS
    assert "Чому система зробила такий висновок" in RESULTS
    assert "finalAnalysis?.evidence_debt" in disclosure
    assert "finalAnalysis?.confidence_calibration" in disclosure
    assert "<AnalysisCoreV2Panel" in disclosure
    assert "<ClinicalReasoningMapSection" in disclosure
    assert "<EvidenceGapsSection" in disclosure
    assert "<ReasoningTraceSection" in disclosure


def test_p4_keeps_p2_symptom_impact_inside_user_connection_block():
    start = RESULTS.index("function ResultOverviewPanel")
    end = RESULTS.index("function localizeDomainLabel", start)
    overview = RESULTS[start:end]

    assert "copy.overviewConnectionsTitle" in overview
    assert "<SymptomImpactNotice" in overview
    assert "What changed because of your answers" in RESULTS
