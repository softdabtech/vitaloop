import json
from pathlib import Path

import pytest

from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline


@pytest.mark.asyncio
async def test_child_reticulocyte_panel_runs_core_pipeline_without_external_ai():
    fixture_path = Path(__file__).parent / "fixtures" / "reticulocyte_child_panel.json"
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))

    # Stage 2B: this smoke test targets the fully-completed pipeline shape, which
    # now requires the quality gate to resolve to auto_continue. The bare fixture
    # (no candidate confidence, no questionnaire) legitimately scores "confirm"
    # under the pre-existing gate logic (analysis_quality_gate.py) — that scoring
    # was never wired to anything before Stage 2B. Providing high-confidence
    # candidates (one per fixture biomarker) and a completed questionnaire are
    # realistic extraction-time inputs that raise the score to auto_continue,
    # without changing the gate's scoring logic itself.
    candidates = [{"confidence_score": 0.95, "status": "pending"} for _ in fixture["biomarkers"]]
    result = await run_lab_analysis_pipeline(
        biomarkers=fixture["biomarkers"],
        symptoms=fixture["symptoms"],
        questionnaire={"completed": True},
        user_profile=fixture["profile"],
        user_id=None,
        analysis_id="reticulocyte-child-smoke",
        source_metadata={"source": "integration_smoke_fixture", "candidates": candidates},
        persist_knowledge=False,
        persist_report_version=False,
        generate_ai_protocol=False,
        locale="uk",
    )

    assert result["analysis_input_quality_gate"]["decision"] == "auto_continue", result["analysis_input_quality_gate"]
    assert result["status"] == "completed"
    assert len(result["normalized_biomarkers"]) == 7
    assert result["metadata"]["analysis_core_version"] == "lab_analysis_pipeline_v2"
    assert result["metadata"]["version_provenance"]["locale"] == "uk"
    assert result["metadata"]["version_provenance"]["pipeline_version"] == "lab_analysis_pipeline_v2"
    assert result["clinical_data_integrity"]["version"] == "clinical_data_integrity_v1"
    assert result["analysis_input_quality_gate"]["version"] == "analysis_input_quality_gate_v1"
    assert result["evidence_gaps"]["version"] == "evidence_gaps_v1"
    assert result["safety_result"]["status"] in {"approved", "approved_with_warnings"}
    assert result["metadata"]["version_provenance"]["kb_version"]

    headline = (result.get("interpreted_report") or {}).get("summary", {}).get("headline", "")
    assert "ретикулоцит" in headline.lower()

    out_of_range = [
        item for item in result["normalized_biomarkers"] if item.get("status") in {"DEFICIENT", "ELEVATED"}
    ]
    assert len(out_of_range) == 2

    gap_markers = {str(item.get("missing_marker") or "").lower() for item in result["evidence_gaps"]["gaps"]}
    assert {"hemoglobin", "ferritin"} & gap_markers
