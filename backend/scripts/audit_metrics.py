"""The exact coverage metrics quoted in the bottleneck audit report.

Run in a clean worktree at HEAD for BEFORE, and in the working copy for AFTER.
"""
from __future__ import annotations
import asyncio, sys
from collections import Counter
sys.path.insert(0, ".")
from app.services import supabase_service as supabase
from app.services.knowledge.evaluator import evaluate_input_with_rules
from app.services.knowledge.integration import biomarkers_to_knowledge_lab_results
from app.services.knowledge.report import build_knowledge_report
from app.services.lab_analysis_pipeline import _prioritize_biomarkers, _risk_flags, normalize_biomarkers


async def _sel(table, cols, limit, order=None):
    c = supabase._get_supabase()
    def q():
        b = c.table(table).select(cols)
        if order:
            b = b.order(order, desc=True)
        return b.limit(limit).execute()
    return (await supabase._run(q)).data or []


def main() -> None:
    rules = asyncio.run(_sel("knowledge_rules", "id,key,name,input_entities,conditions,outputs,severity,confidence,requires_doctor,active,governance_status", 1000))
    active = [r for r in rules if r.get("active") and str(r.get("governance_status") or "active") == "active"]
    uploads = asyncio.run(_sel("report_versions", "upload_id,input_snapshot", 300, order="created_at"))

    t = Counter()
    seen = set()
    for row in uploads:
        snap = row.get("input_snapshot") or {}
        raw = snap.get("biomarkers") or []
        if not raw or row["upload_id"] in seen:
            continue
        seen.add(row["upload_id"])

        normalized = normalize_biomarkers(raw)
        lab = biomarkers_to_knowledge_lab_results(normalized)
        ev = evaluate_input_with_rules({"lab_results": lab, "symptoms": snap.get("symptoms") or []}, active)
        report = build_knowledge_report(biomarkers=normalized, knowledge_evaluation={**ev, "generated_recommendations": [], "safety_alerts": []})
        prioritized = _prioritize_biomarkers(normalized)

        t["input_markers"] += len(lab)
        t["fired_rules"] += len(ev["matched_rules"])
        t["findings_in_report"] += len(report["why_it_matters"])
        t["risk_flags"] += len(_risk_flags(report, prioritized))

        non_optimal = [b for b in normalized if str(b.get("status")) != "OPTIMAL"]
        t["non_optimal"] += len(non_optimal)
        t["flagged_shown"] += len(report["what_was_found"]["flagged_markers"])
        t["prioritized_shown"] += len(prioritized)

        for b in normalized:
            has_range = b.get("ref_low") is not None or b.get("ref_high") is not None
            if not has_range:
                t["no_reference_anywhere"] += 1
                if str(b.get("status")) == "BORDERLINE":
                    t["borderline_by_default"] += 1
            elif str(b.get("status")) in {"DEFICIENT", "ELEVATED"}:
                t["outside_reference_range"] += 1

    t["findings_lost_to_cap"] = max(0, t["fired_rules"] - t["findings_in_report"])
    t["flagged_lost_to_cap"] = t["non_optimal"] - t["flagged_shown"]
    t["prioritized_lost_to_cap"] = t["non_optimal"] - t["prioritized_shown"]

    for key in ("input_markers", "fired_rules", "findings_in_report", "findings_lost_to_cap",
                "non_optimal", "flagged_shown", "flagged_lost_to_cap",
                "prioritized_shown", "prioritized_lost_to_cap",
                "risk_flags", "outside_reference_range",
                "no_reference_anywhere", "borderline_by_default"):
        print(f"{key} = {t[key]}")


if __name__ == "__main__":
    main()
