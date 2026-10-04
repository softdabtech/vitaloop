"""Validate the frozen P2 symptom-to-analysis contract for one EN report.

The command is read-only and prints only an upload fingerprint and aggregate
counts. Pass an upload ID obtained through the authenticated user flow.

Examples:
    python scripts/audit_symptom_analysis.py --upload-id UUID --fail-on-gap
    python scripts/audit_symptom_analysis.py --upload-id UUID --json
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
from app.services.symptom_analysis import (  # noqa: E402
    SYMPTOM_ANALYSIS_VERSION,
    SYMPTOM_CONCEPT_MATRIX_VERSION,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upload-id", required=True, help="Audit the latest EN version for this upload.")
    parser.add_argument("--json", action="store_true", help="Print anonymized JSON.")
    parser.add_argument("--fail-on-gap", action="store_true", help="Exit non-zero when P2 validation fails.")
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


def build_p2_audit(report: Dict[str, Any]) -> Dict[str, Any]:
    snapshot = report.get("input_snapshot") if isinstance(report.get("input_snapshot"), dict) else {}
    analysis = snapshot.get("symptom_analysis") if isinstance(snapshot.get("symptom_analysis"), dict) else {}
    synthesis = snapshot.get("case_synthesis") if isinstance(snapshot.get("case_synthesis"), dict) else {}
    concepts = analysis.get("concepts") if isinstance(analysis.get("concepts"), list) else []
    matrix = analysis.get("matrix") if isinstance(analysis.get("matrix"), list) else []
    effects = analysis.get("priority_effects") if isinstance(analysis.get("priority_effects"), list) else []
    conclusion = analysis.get("conclusion_change") if isinstance(analysis.get("conclusion_change"), dict) else {}
    synthesis_impact = synthesis.get("symptom_impact") if isinstance(synthesis.get("symptom_impact"), dict) else {}
    failures: list[str] = []

    if analysis.get("version") != SYMPTOM_ANALYSIS_VERSION:
        failures.append("symptom_analysis_version_missing")
    if analysis.get("matrix_version") != SYMPTOM_CONCEPT_MATRIX_VERSION:
        failures.append("concept_matrix_version_missing")
    concept_ids = [str(item.get("concept_id") or "").strip() for item in concepts if isinstance(item, dict)]
    if any(not concept_id for concept_id in concept_ids):
        failures.append("empty_concept_id")
    matrix_ids = [str(item.get("symptom_concept_id") or "").strip() for item in matrix if isinstance(item, dict)]
    if sorted(matrix_ids) != sorted(concept_ids):
        failures.append("matrix_does_not_cover_concepts")

    confirming_marker_ids: set[str] = set()
    linked_hypothesis_ids: set[str] = set()
    for row in matrix:
        if not isinstance(row, dict):
            failures.append("invalid_matrix_row")
            continue
        for link in row.get("hypotheses") or []:
            if not isinstance(link, dict) or not link.get("hypothesis_id") or not link.get("domain"):
                failures.append("invalid_hypothesis_link")
                continue
            linked_hypothesis_ids.add(str(link["hypothesis_id"]))
            marker_ids = link.get("confirming_marker_ids")
            if not isinstance(marker_ids, list):
                failures.append("confirming_markers_not_structured")
            else:
                confirming_marker_ids.update(str(item) for item in marker_ids if item)

    if bool(conclusion.get("changed")) != bool(synthesis_impact.get("changed")):
        failures.append("case_synthesis_impact_mismatch")
    provenance = snapshot.get("version_provenance") or {}
    if provenance.get("symptom_analysis_version") != SYMPTOM_ANALYSIS_VERSION:
        failures.append("symptom_analysis_provenance_missing")

    mapped_count = sum(1 for item in concepts if isinstance(item, dict) and item.get("mapping_status") == "mapped")
    unmapped_count = sum(1 for item in concepts if isinstance(item, dict) and item.get("mapping_status") == "unmapped")
    return {
        "audit_version": "p2_symptom_analysis_audit_v1",
        "case_fingerprint": _fingerprint(report.get("upload_id")),
        "created_at": report.get("created_at"),
        "report_status": report.get("status"),
        "analysis_version": analysis.get("version"),
        "matrix_version": analysis.get("matrix_version"),
        "analysis_status": analysis.get("status"),
        "concept_count": len(concepts),
        "mapped_concept_count": mapped_count,
        "unmapped_concept_count": unmapped_count,
        "matrix_row_count": len(matrix),
        "linked_hypothesis_count": len(linked_hypothesis_ids),
        "confirming_marker_count": len(confirming_marker_ids),
        "priority_effect_count": len(effects),
        "conclusion_changed": bool(conclusion.get("changed")),
        "case_synthesis_impact_matches": bool(conclusion.get("changed")) == bool(synthesis_impact.get("changed")),
        "failures": sorted(set(failures)),
        "smoke_ok": not failures,
    }


def _print_table(audit: Dict[str, Any]) -> None:
    print(f"P2 symptom analysis audit {audit['case_fingerprint']} ({audit.get('created_at')})")
    print(
        f"analysis={audit.get('analysis_version')} matrix={audit.get('matrix_version')} "
        f"status={audit.get('analysis_status')}"
    )
    print(
        f"concepts={audit['concept_count']} mapped={audit['mapped_concept_count']} "
        f"unmapped={audit['unmapped_concept_count']} matrix_rows={audit['matrix_row_count']}"
    )
    print(
        f"linked_hypotheses={audit['linked_hypothesis_count']} "
        f"confirming_markers={audit['confirming_marker_count']} "
        f"priority_effects={audit['priority_effect_count']} "
        f"conclusion_changed={audit['conclusion_changed']}"
    )
    print(f"SMOKE {'PASS' if audit['smoke_ok'] else 'FAIL'}")


def main() -> None:
    args = _parser().parse_args()
    report = _latest_report(svc._get_supabase(), args.upload_id)
    audit = build_p2_audit(report)
    if args.json:
        print(json.dumps(audit, ensure_ascii=False, indent=2, default=str))
    else:
        _print_table(audit)
    if args.fail_on_gap and not audit["smoke_ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
