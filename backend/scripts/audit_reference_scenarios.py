"""Run the P6 fixed reference matrix through the complete local pipeline."""

from __future__ import annotations

import argparse
import asyncio
from copy import deepcopy
import json
from pathlib import Path
from typing import Any, Dict
from unittest.mock import patch

from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline
from app.services.reference_scenario_audit import (
    evaluate_reference_scenario,
    prepare_reference_biomarkers,
    summarize_reference_matrix,
)


DEFAULT_FIXTURE = Path(__file__).parents[1] / "tests" / "fixtures" / "p6_reference_scenarios.json"


async def run_matrix(fixture: Dict[str, Any]) -> Dict[str, Any]:
    audits = []
    for scenario in fixture.get("scenarios") or []:
        history = deepcopy(scenario.get("historical_biomarkers") or [])

        async def load_history(_user_id, rows=history):
            return deepcopy(rows)

        with patch("app.services.lab_analysis_pipeline._load_historical_biomarkers", load_history):
            result = await run_lab_analysis_pipeline(
                biomarkers=prepare_reference_biomarkers(fixture, scenario),
                symptoms=[],
                symptom_snapshot=deepcopy(scenario.get("symptom_snapshot")),
                questionnaire={"completed": True},
                user_profile={"age": 38, "sex": "female", "height_cm": 168, "weight_kg": 62},
                user_id=None,
                analysis_id=None,
                source_metadata={
                    "source": "p6_reference_matrix",
                    "scenario_id": scenario.get("id"),
                    "candidates": [
                        {"confidence_score": 0.99, "status": "confirmed"}
                        for _ in scenario.get("biomarkers") or []
                    ],
                },
                persist_knowledge=False,
                persist_report_version=False,
                generate_ai_protocol=False,
                generate_ai_narrative=False,
                locale="en",
            )
        audits.append(evaluate_reference_scenario(scenario, result))
    return {"summary": summarize_reference_matrix(audits), "scenarios": audits}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    parser.add_argument("--json-out", type=Path)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    fixture = json.loads(args.fixture.read_text(encoding="utf-8"))
    result = asyncio.run(run_matrix(fixture))
    if args.json_out:
        args.json_out.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    summary = result["summary"]
    print(json.dumps(summary, indent=2, sort_keys=True))
    if args.verbose:
        for audit in result["scenarios"]:
            print(f'{audit["scenario_id"]}: {"PASS" if audit["passed"] else "FAIL"}')
            for failure in audit["failures"]:
                print(f'  {failure["key"]}: expected={failure["expected"]!r} actual={failure["actual"]!r}')
    return 0 if summary["passed"] and summary["scenario_count"] == 20 else 1


if __name__ == "__main__":
    raise SystemExit(main())
