"""Audit one immutable production report without regenerating or writing data.

Examples:
    python scripts/audit_real_user_case.py --require-symptom
    python scripts/audit_real_user_case.py --upload-id UUID --json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services import supabase_service as svc  # noqa: E402
from app.services.real_case_audit import build_real_case_audit  # noqa: E402
from app.services.report_history import assemble_frozen_response  # noqa: E402


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upload-id", help="Audit the latest EN version for this upload.")
    parser.add_argument(
        "--require-symptom",
        action="store_true",
        help="Select the latest completed EN report containing a symptom snapshot.",
    )
    parser.add_argument("--json", action="store_true", help="Print JSON instead of the concise stage table.")
    parser.add_argument("--fail-on-gap", action="store_true", help="Exit non-zero when a P0 stage is not green.")
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


async def _build(args: argparse.Namespace) -> dict:
    client = svc._get_supabase()
    report = _latest_report(client, upload_id=args.upload_id, require_symptom=args.require_symptom)
    user_id = report["user_id"]
    upload_id = report["upload_id"]
    biomarkers, candidates, protocol, profile = await asyncio.gather(
        svc.get_biomarkers_by_upload(upload_id, user_id),
        svc.get_biomarker_extraction_candidates(upload_id, user_id),
        svc.get_protocol_by_upload(user_id, upload_id),
        svc.get_user_profile(user_id),
    )
    response = assemble_frozen_response(
        upload_id=upload_id,
        biomarkers=biomarkers,
        protocol_recommendations=(protocol or {}).get("recommendations", []),
        report_version=report,
        user_profile=profile or {},
        locale="en",
    )
    return build_real_case_audit(
        report_version=report,
        api_response=response,
        extraction_candidates=candidates,
    )


def _print_table(audit: dict) -> None:
    print(f"P0 real-case audit {audit['case_fingerprint']} ({audit.get('created_at')})")
    for name, stage in audit["stages"].items():
        print(f"{stage['status']:14} {name:28} {stage['evidence']}")
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

