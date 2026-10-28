import json
from copy import deepcopy
from pathlib import Path

import pytest

from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline
from app.services.reference_scenario_audit import (
    evaluate_reference_scenario,
    prepare_reference_biomarkers,
    summarize_reference_matrix,
)


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "p6_reference_scenarios.json"


def _fixture():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _source_metadata(scenario):
    return {
        "source": "p6_reference_matrix",
        "scenario_id": scenario["id"],
        "candidates": [
            {"confidence_score": 0.99, "status": "confirmed"}
            for _ in scenario.get("biomarkers") or []
        ],
    }


@pytest.mark.asyncio
async def test_twenty_fixed_reference_scenarios_match_expected_meaning(monkeypatch):
    from app.services import lab_analysis_pipeline

    fixture = _fixture()
    assert fixture["scenario_count"] == 20
    assert len(fixture["scenarios"]) == fixture["scenario_count"]
    assert len({case["id"] for case in fixture["scenarios"]}) == fixture["scenario_count"]
    assert all(case.get("expected_meaning") for case in fixture["scenarios"])

    audits = []
    for scenario in fixture["scenarios"]:
        history = deepcopy(scenario.get("historical_biomarkers") or [])

        async def load_history(_user_id, rows=history):
            return deepcopy(rows)

        monkeypatch.setattr(lab_analysis_pipeline, "_load_historical_biomarkers", load_history)
        result = await run_lab_analysis_pipeline(
            biomarkers=prepare_reference_biomarkers(fixture, scenario),
            symptoms=[],
            symptom_snapshot=deepcopy(scenario.get("symptom_snapshot")),
            questionnaire={"completed": True},
            user_profile={"age": 38, "sex": "female", "height_cm": 168, "weight_kg": 62},
            user_id=None,
            analysis_id=None,
            source_metadata=_source_metadata(scenario),
            persist_knowledge=False,
            persist_report_version=False,
            generate_ai_protocol=False,
            generate_ai_narrative=False,
            locale="en",
        )
        audits.append(evaluate_reference_scenario(scenario, result))

    summary = summarize_reference_matrix(audits)
    assert summary["scenario_count"] == 20
    assert summary["passed"], json.dumps(
        {
            "summary": summary,
            "failures": {
                audit["scenario_id"]: audit["failures"]
                for audit in audits
                if not audit["passed"]
            },
        },
        indent=2,
        sort_keys=True,
    )
