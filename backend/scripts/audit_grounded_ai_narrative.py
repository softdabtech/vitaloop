"""Validate the frozen P3 grounded-narrative contract for one EN report.

The command is read-only and prints only an upload fingerprint, contract
metadata, and aggregate grounding counts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services import supabase_service as svc  # noqa: E402
from app.services.grounded_ai_narrative import (  # noqa: E402
    GROUNDED_AI_NARRATIVE_FIELDS,
    GROUNDED_AI_NARRATIVE_VERSION,
    NARRATIVE_FIELDS,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upload-id", required=True, help="Audit the latest EN version for this upload.")
    parser.add_argument("--json", action="store_true", help="Print anonymized JSON.")
    parser.add_argument("--fail-on-gap", action="store_true", help="Exit non-zero when P3 validation fails.")
    return parser


def _fingerprint(upload_id: Any) -> str:
    return hashlib.sha256(str(upload_id or "missing").encode("utf-8")).hexdigest()[:12]


def _latest_report(client: Any, upload_id: str) -> Dict[str, Any]:
    rows = (
        client.table("report_versions")
        .select("*")
        .eq("upload_id", upload_id)
        .eq("locale", "en")
        .in_("status", ["completed", "blocked"])
        .order("created_at", desc=True)
        .order("id", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise SystemExit("No completed EN report version found for this upload.")
    return rows[0]


def build_p3_audit(report: Dict[str, Any]) -> Dict[str, Any]:
    snapshot = report.get("input_snapshot") if isinstance(report.get("input_snapshot"), dict) else {}
    narrative = snapshot.get("grounded_ai_narrative")
    narrative = narrative if isinstance(narrative, dict) else {}
    failures: list[str] = []

    if narrative.get("version") != GROUNDED_AI_NARRATIVE_VERSION:
        failures.append("grounded_ai_narrative_version_missing")
    provenance = snapshot.get("version_provenance") or {}
    if provenance.get("grounded_ai_narrative_version") != GROUNDED_AI_NARRATIVE_VERSION:
        failures.append("grounded_ai_narrative_provenance_missing")
    missing_fields = [field for field in GROUNDED_AI_NARRATIVE_FIELDS if field not in narrative]
    if missing_fields:
        failures.append("required_contract_fields_missing")

    used_evidence: set[str] = set()
    statement_count = 0
    for field in NARRATIVE_FIELDS:
        items = narrative.get(field)
        if not isinstance(items, list):
            failures.append(f"{field}_not_list")
            continue
        for item in items:
            statement_count += 1
            if not isinstance(item, dict) or not str(item.get("text") or "").strip():
                failures.append("invalid_narrative_statement")
                continue
            evidence_ids = item.get("evidence_ids")
            if not isinstance(evidence_ids, list) or not evidence_ids:
                failures.append("statement_without_evidence")
                continue
            used_evidence.update(str(value) for value in evidence_ids if value)

    registry = narrative.get("evidence_links")
    registry = registry if isinstance(registry, list) else []
    registry_ids = [
        str(item.get("evidence_id") or "")
        for item in registry
        if isinstance(item, dict)
    ]
    if any(not value for value in registry_ids) or len(registry_ids) != len(set(registry_ids)):
        failures.append("invalid_evidence_registry")
    if used_evidence != set(registry_ids):
        failures.append("evidence_registry_mismatch")
    grounding = narrative.get("grounding") if isinstance(narrative.get("grounding"), dict) else {}
    if grounding.get("all_statements_grounded") is not True:
        failures.append("grounding_not_confirmed")
    if statement_count and not registry_ids:
        failures.append("empty_evidence_registry")

    return {
        "audit_version": "p3_grounded_ai_narrative_audit_v1",
        "case_fingerprint": _fingerprint(report.get("upload_id")),
        "created_at": report.get("created_at"),
        "report_status": report.get("status"),
        "narrative_version": narrative.get("version"),
        "narrative_status": narrative.get("status"),
        "source": narrative.get("source"),
        "prompt_version": narrative.get("prompt_version"),
        "statement_count": statement_count,
        "evidence_count": len(registry_ids),
        "all_statements_grounded": grounding.get("all_statements_grounded") is True,
        "fallback_used": bool(grounding.get("fallback_used")),
        "failures": sorted(set(failures)),
        "smoke_ok": not failures,
    }


def _print_table(audit: Dict[str, Any]) -> None:
    print(f"P3 grounded narrative audit {audit['case_fingerprint']} ({audit.get('created_at')})")
    print(
        f"version={audit.get('narrative_version')} status={audit.get('narrative_status')} "
        f"source={audit.get('source')} prompt={audit.get('prompt_version')}"
    )
    print(
        f"statements={audit['statement_count']} evidence={audit['evidence_count']} "
        f"grounded={audit['all_statements_grounded']} fallback={audit['fallback_used']}"
    )
    print(f"SMOKE {'PASS' if audit['smoke_ok'] else 'FAIL'}")


def main() -> None:
    args = _parser().parse_args()
    report = _latest_report(svc._get_supabase(), args.upload_id)
    audit = build_p3_audit(report)
    if args.json:
        print(json.dumps(audit, ensure_ascii=False, indent=2, default=str))
    else:
        _print_table(audit)
    if args.fail_on_gap and not audit["smoke_ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
