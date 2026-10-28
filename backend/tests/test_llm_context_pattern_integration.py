"""Full evidence_gaps/patterns integration into the LLM context.

2026-09-12 clinical analyzer audit follow-up: clinical_context previously
only carried counts (marker_coverage_summary) and raw matched_rules/
risk_flags — never the pattern engine's detected patterns nor evidence_gaps.
Both are pure functions of data already available before the LLM call, so
lab_analysis_pipeline.py now computes them once, early, and folds them into
clinical_context before generate_ai_protocol_orchestrated() runs.
"""

import pytest

from app.services import lab_analysis_pipeline
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline


PROFILE = {"age": 45, "sex": "male", "height_cm": 178, "weight_kg": 82}


@pytest.mark.asyncio
async def test_clinical_context_carries_detected_patterns_and_evidence_gaps(monkeypatch):
    captured = {}

    async def fake_orchestrate(**kwargs):
        captured["clinical_context"] = kwargs.get("clinical_context")
        return {"version": "ai_orchestration_v1", "status": "skipped", "items": [], "metadata": {}}

    async def fake_knowledge_evaluation(**kwargs):
        # No live Supabase/knowledge_rules table in this test environment —
        # simulate a real evaluation result with zinc correctly showing up
        # as no_matching_rule, the way it does against the real table (see
        # test_evidence_gaps_surfaces_marker_coverage_no_matching_rule_and_unit_blocked
        # for the equivalent unit-level coverage).
        return {
            "matched_rules": [],
            "generated_recommendations": [],
            "requires_doctor": False,
            "confidence": 0.0,
            "safety_alerts": [],
            "source_references": [],
            "unevaluated_markers": [],
            "marker_coverage": {"evaluated": [], "fired": [], "no_matching_rule": ["zinc"], "unit_blocked": []},
        }

    monkeypatch.setattr(lab_analysis_pipeline, "generate_ai_protocol_orchestrated", fake_orchestrate)
    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_biomarkers_with_knowledge", fake_knowledge_evaluation)

    biomarkers = [
        {"name": "LDL", "value": 210, "unit": "mg/dL", "ref_low": 0, "ref_high": 100, "status": "ELEVATED"},
        {"name": "HDL", "value": 32, "unit": "mg/dL", "ref_low": 40, "ref_high": 90, "status": "DEFICIENT"},
        {"name": "Zinc", "value": 50, "unit": "umol/L", "ref_low": 10, "ref_high": 18, "status": "ELEVATED"},
    ]
    candidates = [{"confidence_score": 0.95, "status": "pending"} for _ in biomarkers]

    await run_lab_analysis_pipeline(
        biomarkers=biomarkers,
        symptoms=[],
        questionnaire={"completed": True},
        user_profile=PROFILE,
        user_id=None,
        analysis_id="llm-context-integration-smoke",
        source_metadata={"source": "integration_smoke_fixture", "candidates": candidates},
        persist_knowledge=False,
        persist_report_version=False,
        generate_ai_protocol=True,
        locale="en",
    )

    clinical_context = captured["clinical_context"]
    assert clinical_context is not None

    pattern_keys = {p["key"] for p in clinical_context["detected_patterns"]}
    assert "cardiovascular_risk" in pattern_keys

    assert "gap_count" in clinical_context["evidence_gaps_summary"]
    gap_markers = {g["missing_marker"] for g in clinical_context["evidence_gaps_preview"]}
    # Zinc has no active rule in this test's (empty/placeholder) knowledge
    # base, so it should surface as an evidence gap the LLM is warned about.
    assert "zinc" in gap_markers
