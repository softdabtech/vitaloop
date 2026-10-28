"""End-to-end signal trace on stored uploads: input marker -> what the user gets.

No LLM call and no persistence; the deterministic chain only.
Run: ./.venv/bin/python scripts/audit_end_to_end.py
"""
from __future__ import annotations

import asyncio
import sys
from collections import Counter

sys.path.insert(0, ".")

from app.services import supabase_service as supabase  # noqa: E402
from app.services.knowledge.evaluator import evaluate_input_with_rules  # noqa: E402
from app.services.knowledge.integration import biomarkers_to_knowledge_lab_results  # noqa: E402
from app.services.knowledge.report import build_knowledge_report  # noqa: E402
from app.services.lab_analysis_pipeline import _prioritize_biomarkers, _risk_flags, normalize_biomarkers  # noqa: E402


async def _select(table, columns, limit, order=None):
    client = supabase._get_supabase()

    def query():
        q = client.table(table).select(columns)
        if order:
            q = q.order(order, desc=True)
        return q.limit(limit).execute()

    return (await supabase._run(query)).data or []


def main() -> None:
    rules = asyncio.run(_select("knowledge_rules", "id,key,name,input_entities,conditions,outputs,severity,confidence,requires_doctor,active,governance_status", 1000))
    active = [r for r in rules if r.get("active") and str(r.get("governance_status") or "active") == "active"]
    uploads = asyncio.run(_select("report_versions", "upload_id,input_snapshot", 300, order="created_at"))

    totals = Counter()
    seen = set()
    for row in uploads:
        snapshot = row.get("input_snapshot") or {}
        raw = snapshot.get("biomarkers") or []
        if not raw or row["upload_id"] in seen:
            continue
        seen.add(row["upload_id"])

        normalized = normalize_biomarkers(raw)
        lab_results = biomarkers_to_knowledge_lab_results(normalized)
        evaluation = evaluate_input_with_rules({"lab_results": lab_results, "symptoms": snapshot.get("symptoms") or []}, active)
        coverage = evaluation["marker_coverage"]
        report = build_knowledge_report(
            biomarkers=normalized,
            knowledge_evaluation={**evaluation, "generated_recommendations": [], "safety_alerts": []},
        )
        prioritized = _prioritize_biomarkers(normalized)
        flags = _risk_flags(report, prioritized)

        accounted = set(coverage["evaluated"]) | set(coverage["no_matching_rule"]) | set(coverage["unit_blocked"])
        missing = set(lab_results) - accounted
        totals["uploads"] += 1
        totals["input_markers"] += len(lab_results)
        totals["EVALUATED_FINDING"] += len(coverage["fired"])
        totals["EVALUATED_NORMAL"] += len(set(coverage["evaluated"]) - set(coverage["fired"]))
        totals["EVALUATED_NO_KB_RULE"] += len(coverage["no_matching_rule"])
        totals["UNEVALUATED_WITH_REASON"] += len(coverage["unit_blocked"])
        totals["SILENTLY_DISAPPEARED"] += len(missing)
        totals["fired_rules"] += len(evaluation["matched_rules"])
        totals["report_visible_findings"] += len(report["why_it_matters"])
        totals["report_flagged_markers"] += len(report["what_was_found"]["flagged_markers"])
        totals["risk_flags"] += len(flags)
        non_optimal = len([b for b in normalized if str(b.get("status")) != "OPTIMAL"])
        totals["non_optimal_markers"] += non_optimal
        totals["prioritized_shown"] += len(prioritized)
        if missing:
            print(f"  !! {row['upload_id']}: unaccounted {sorted(missing)}")

    print("--- END-TO-END SIGNAL TRACE ---")
    for key in (
        "uploads", "input_markers", "EVALUATED_FINDING", "EVALUATED_NORMAL",
        "EVALUATED_NO_KB_RULE", "UNEVALUATED_WITH_REASON", "SILENTLY_DISAPPEARED",
        "fired_rules", "report_visible_findings", "non_optimal_markers",
        "report_flagged_markers", "prioritized_shown", "risk_flags",
    ):
        print(f"{key} = {totals[key]}")


if __name__ == "__main__":
    main()
