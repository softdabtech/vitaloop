"""Build and validate P1 Case Synthesis from one frozen production report.

This command is read-only: it reads the immutable report version and profile,
assembles the deterministic synthesis, and prints only anonymized counts plus
an upload fingerprint.

Examples:
    python scripts/audit_case_synthesis.py --require-symptom --fail-on-gap
    python scripts/audit_case_synthesis.py --upload-id UUID --json
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services import supabase_service as svc  # noqa: E402
from app.services.case_synthesis import (  # noqa: E402
    CASE_SYNTHESIS_SECTIONS,
    build_case_synthesis,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upload-id", help="Audit the latest EN version for this upload.")
    parser.add_argument(
        "--require-symptom",
        action="store_true",
        help="Select the latest completed EN report containing a symptom snapshot.",
    )
    parser.add_argument("--json", action="store_true", help="Print the anonymized JSON audit.")
    parser.add_argument("--fail-on-gap", action="store_true", help="Exit non-zero when P1 validation fails.")
    return parser


def _latest_report(client, *, upload_id: str | None, require_symptom: bool) -> dict:
    query = (
        client.table("report_versions")
        .select("*")
        .eq("locale", "en")
        .in_("status", ["completed", "blocked"])
        .order("created_at", desc=True)
    )
    if upload_id:
        query = query.eq("upload_id", upload_id)
    rows = query.limit(100).execute().data or []
    if require_symptom:
        rows = [row for row in rows if (row.get("input_snapshot") or {}).get("symptom_snapshot")]
    if not rows:
        raise SystemExit("No matching completed EN report version found.")
    return rows[0]


def _fingerprint(upload_id: object) -> str:
    return hashlib.sha256(str(upload_id or "missing").encode("utf-8")).hexdigest()[:12]


async def _build(args: argparse.Namespace) -> dict:
    report = _latest_report(
        svc._get_supabase(),
        upload_id=args.upload_id,
        require_symptom=args.require_symptom,
    )
    snapshot = report.get("input_snapshot") or {}
    knowledge_report = report.get("knowledge_report") or {}
    interpreted_report = knowledge_report.get("interpreted_report") or {}
    profile = await svc.get_user_profile(report["user_id"])
    synthesis = build_case_synthesis(
        biomarkers=snapshot.get("biomarkers") or [],
        symptoms=snapshot.get("symptoms") or [],
        user_profile=profile or {},
        interpreted_report=interpreted_report,
        clinical_hypotheses=snapshot.get("clinical_hypotheses") or {},
        clinical_contradictions=snapshot.get("clinical_contradictions") or {},
        evidence_gaps=snapshot.get("evidence_gaps") or {},
        action_plan_by_role=snapshot.get("action_plan_by_role") or {},
        retest_suggestions=knowledge_report.get("retest_plan") or [],
        next_best_tests=snapshot.get("next_best_tests") or {},
        safety_result=report.get("safety_result") or {},
        symptom_analysis=snapshot.get("symptom_analysis") or {},
        locale="en",
    )
    section_counts = {section: len(synthesis.get(section) or []) for section in CASE_SYNTHESIS_SECTIONS}
    grounding = synthesis.get("grounding") or {}
    failures: list[str] = []
    if synthesis.get("status") != "complete":
        failures.append("status_not_complete")
    if not 2 <= section_counts["main_conclusion"] <= 4:
        failures.append("main_conclusion_count_out_of_range")
    if not grounding.get("all_statements_grounded"):
        failures.append("ungrounded_statements_present")
    if grounding.get("ungrounded_statement_count") != 0:
        failures.append("ungrounded_statement_count_nonzero")

    return {
        "audit_version": "p1_case_synthesis_audit_v1",
        "case_fingerprint": _fingerprint(report.get("upload_id")),
        "created_at": report.get("created_at"),
        "report_status": report.get("status"),
        "synthesis_version": synthesis.get("version"),
        "synthesis_status": synthesis.get("status"),
        "section_counts": section_counts,
        "statement_count": grounding.get("statement_count"),
        "ungrounded_statement_count": grounding.get("ungrounded_statement_count"),
        "all_statements_grounded": grounding.get("all_statements_grounded"),
        "failures": failures,
        "smoke_ok": not failures,
    }


def _print_table(audit: dict) -> None:
    print(f"P1 Case Synthesis audit {audit['case_fingerprint']} ({audit.get('created_at')})")
    print(f"synthesis={audit.get('synthesis_version')} status={audit.get('synthesis_status')}")
    for section, count in audit["section_counts"].items():
        print(f"{section:28} {count}")
    print(
        "grounding"
        f" statements={audit.get('statement_count')}"
        f" ungrounded={audit.get('ungrounded_statement_count')}"
    )
    print(f"SMOKE {'PASS' if audit['smoke_ok'] else 'FAIL'}")


def main() -> None:
    args = _parser().parse_args()
    audit = asyncio.run(_build(args))
    if args.json:
        print(json.dumps(audit, ensure_ascii=False, indent=2, default=str))
    else:
        _print_table(audit)
    if args.fail_on_gap and not audit["smoke_ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
