from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
RESULTS = (REPO_ROOT / "frontend/src/pages/Results.jsx").read_text(encoding="utf-8")
ADAPTER = (REPO_ROOT / "frontend/src/lib/resultOverview.js").read_text(encoding="utf-8")


def test_deterministic_ai_fallback_has_explicit_user_facing_disclosure():
    assert 'data-testid="p5-fallback-disclosure"' in RESULTS
    assert "AI fallback: verified report data" in RESULTS
    assert "fallbackUsed: Boolean(groundedNarrative?.grounding?.fallback_used)" in ADAPTER
    assert "fallbackReason: groundedNarrative?.grounding?.fallback_reason" in ADAPTER


def test_safety_warning_prefers_specific_event_reason_and_value():
    assert "function safetyReasonItems" in ADAPTER
    assert "safetyResult?.safety_events" in ADAPTER
    assert "marker.value" in ADAPTER
    assert "...safetyReasons" in ADAPTER


def test_internal_modules_remain_inside_technical_disclosure():
    disclosure_start = RESULTS.index("function TechnicalReasoningDisclosure")
    disclosure_end = RESULTS.index("export default function Results", disclosure_start)
    disclosure = RESULTS[disclosure_start:disclosure_end]
    page_render = RESULTS[RESULTS.index("export default function Results"):]

    for component in (
        "AnalysisCoreV2Panel",
        "ClinicalReasoningMapSection",
        "EvidenceGapsSection",
        "ReasoningTraceSection",
    ):
        assert f"<{component}" in disclosure
        assert f"<{component}" not in page_render
    assert "<TechnicalReasoningDisclosure" in page_render
