"""Read-only P5 semantic acceptance audit for one API response JSON."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict

from app.services.semantic_acceptance import (
    SEMANTIC_ACCEPTANCE_VERSION,
    build_semantic_acceptance,
)


EXPECTED_CRITERIA = {
    "report_specific_conclusion",
    "symptom_check_effect",
    "concrete_value_links",
    "report_specific_actions",
    "action_priority_clarity",
    "user_facing_language",
    "ai_fallback_disclosure",
    "safety_reason_specificity",
}


def build_p5_audit(payload: Dict[str, Any]) -> Dict[str, Any]:
    final = payload.get("final_analysis") if isinstance(payload.get("final_analysis"), dict) else payload
    stored = final.get("semantic_acceptance") if isinstance(final, dict) else None
    failures = []

    if not isinstance(stored, dict):
        return {
            "version": "p5_semantic_acceptance_audit_v1",
            "passed": False,
            "failures": ["semantic_acceptance_missing"],
            "acceptance_status": None,
            "acceptance_failures": [],
        }

    if stored.get("version") != SEMANTIC_ACCEPTANCE_VERSION:
        failures.append("semantic_acceptance_version_invalid")
    criteria = stored.get("criteria") if isinstance(stored.get("criteria"), dict) else {}
    if set(criteria) != EXPECTED_CRITERIA:
        failures.append("criteria_contract_incomplete")
    if any(item.get("status") not in {"pass", "fail", "not_applicable"} for item in criteria.values() if isinstance(item, dict)):
        failures.append("criterion_status_invalid")

    acceptance_failures = stored.get("failures") if isinstance(stored.get("failures"), list) else []
    failed_criteria = sorted(key for key, item in criteria.items() if isinstance(item, dict) and item.get("status") == "fail")
    listed_criteria = sorted(str(item.get("criterion")) for item in acceptance_failures if isinstance(item, dict))
    if failed_criteria != listed_criteria:
        failures.append("failure_list_mismatch")
    should_pass = not failed_criteria
    if stored.get("passes_dod") is not should_pass:
        failures.append("passes_dod_mismatch")
    if stored.get("status") != ("passed" if should_pass else "failed"):
        failures.append("acceptance_status_mismatch")

    recomputed = build_semantic_acceptance(
        case_synthesis=final.get("case_synthesis"),
        grounded_ai_narrative=final.get("grounded_ai_narrative"),
        symptom_analysis=final.get("symptom_analysis"),
        action_plan_by_role=final.get("action_plan_by_role"),
        safety_result=final.get("safety_result"),
    )
    if recomputed != stored:
        failures.append("frozen_acceptance_not_reproducible")

    return {
        "version": "p5_semantic_acceptance_audit_v1",
        "passed": not failures and bool(stored.get("passes_dod")),
        "failures": failures,
        "acceptance_status": stored.get("status"),
        "acceptance_failures": acceptance_failures,
        "criteria_summary": stored.get("summary"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("response_json", type=Path)
    args = parser.parse_args()
    audit = build_p5_audit(json.loads(args.response_json.read_text(encoding="utf-8")))
    print(json.dumps(audit, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if audit["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
