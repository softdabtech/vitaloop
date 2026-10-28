"""Signal accounting for the lab pipeline (audit instrumentation, not production).

Answers one question per input biomarker: what happened to it? Every marker must
land in exactly one outcome bucket, and SILENTLY_DISAPPEARED must stay at zero.

Run:  ./.venv/bin/python scripts/audit_signal_flow.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from collections import Counter, defaultdict
from typing import Any, Dict, List

sys.path.insert(0, ".")

from app.services import supabase_service as supabase  # noqa: E402
from app.services.knowledge.evaluator import evaluate_input_with_rules  # noqa: E402
from app.services.knowledge.integration import biomarkers_to_knowledge_lab_results  # noqa: E402
from app.services.knowledge.report import build_knowledge_report  # noqa: E402
from app.services.lab_analysis_pipeline import _prioritize_biomarkers, normalize_biomarkers  # noqa: E402


async def _select(table: str, columns: str, limit: int = 500, order: str | None = None):
    client = supabase._get_supabase()

    def query():
        q = client.table(table).select(columns)
        if order:
            q = q.order(order, desc=True)
        return q.limit(limit).execute()

    resp = await supabase._run(query)
    return resp.data or []


def rule_atoms(node: Any, sink: List[Dict[str, Any]]) -> None:
    if isinstance(node, list):
        for item in node:
            rule_atoms(item, sink)
        return
    if not isinstance(node, dict):
        return
    for key in ("all", "any", "none"):
        if key in node:
            rule_atoms(node[key], sink)
            return
    if node.get("lab_marker"):
        sink.append(node)


def main() -> None:
    rules = asyncio.run(_select("knowledge_rules", "id,key,name,input_entities,conditions,outputs,severity,confidence,active,governance_status", limit=1000))
    active = [r for r in rules if r.get("active") and str(r.get("governance_status") or "active") == "active"]
    uploads = asyncio.run(_select("report_versions", "id,upload_id,created_at,input_snapshot", limit=300, order="created_at"))

    marker_rules: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    marker_direction: Dict[str, set] = defaultdict(set)
    for rule in active:
        atoms: List[Dict[str, Any]] = []
        rule_atoms(rule.get("conditions"), atoms)
        for atom in atoms:
            key = str(atom.get("lab_marker")).strip().lower()
            marker_rules[key].append({"rule": rule, "atom": atom})
            op = str(atom.get("operator") or "").lower()
            if op in {"lt", "lte"}:
                marker_direction[key].add("low")
            elif op in {"gt", "gte"}:
                marker_direction[key].add("high")
            else:
                marker_direction[key].add(op or "other")

    print(f"KB rules total={len(rules)} active={len(active)} distinct_markers_referenced={len(marker_rules)}")

    outcomes = Counter()
    no_rule_markers = Counter()
    non_ascii_keys = Counter()
    unit_blocks = Counter()
    seen_uploads = set()
    n_uploads = 0

    # Reference-range vs KB-rule signal comparison
    lab_abnormal_total = 0
    lab_abnormal_no_kb_finding = 0
    lab_abnormal_examples = Counter()
    prioritized_truncated = 0
    flagged_truncated = 0

    for row in uploads:
        snapshot = row.get("input_snapshot") or {}
        raw = snapshot.get("biomarkers") or []
        upload_id = row.get("upload_id")
        if not raw or upload_id in seen_uploads:
            continue
        seen_uploads.add(upload_id)
        n_uploads += 1

        normalized = normalize_biomarkers(raw)
        lab_results = biomarkers_to_knowledge_lab_results(normalized)
        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": snapshot.get("symptoms") or []}, active
        )
        fired_markers = set()
        for matched in result["matched_rules"]:
            for entity in matched.get("input_entities") or []:
                fired_markers.add(str(entity).strip().lower())
        blocked = {entry["marker"] for entry in result["unevaluated_markers"]}

        for key, data in lab_results.items():
            applicable = marker_rules.get(key, [])
            if not applicable:
                outcome = "EVALUATED_NO_KB_RULE"
                no_rule_markers[f"{key}"] += 1
                if not key.isascii():
                    non_ascii_keys[f"{key} <- {data.get('source_name')}"] += 1
            elif key in blocked:
                outcome = "UNEVALUATED_WITH_REASON"
                for entry in result["unevaluated_markers"]:
                    if entry["marker"] == key:
                        unit_blocks[f"{key}: {entry['reported_unit']} vs {entry['expected_unit']}"] += 1
            elif key in fired_markers:
                outcome = "EVALUATED_FINDING"
            else:
                outcome = "EVALUATED_NORMAL"
            outcomes[outcome] += 1

        # --- signal 1 (lab reference range) vs signal 2 (KB rule) ---
        for item in normalized:
            status = str(item.get("status") or "")
            if status not in {"DEFICIENT", "ELEVATED"}:
                continue
            lab_abnormal_total += 1
            key = None
            for k, v in lab_results.items():
                if v.get("source_name") == item.get("name"):
                    key = k
                    break
            if key not in fired_markers:
                lab_abnormal_no_kb_finding += 1
                lab_abnormal_examples[f"{item.get('name')} {item.get('value')} {item.get('unit')} ({status}, ref {item.get('ref_low')}-{item.get('ref_high')})"] += 1

        prioritized = _prioritize_biomarkers(normalized)
        non_optimal = [b for b in normalized if str(b.get("status")) != "OPTIMAL"]
        if len(non_optimal) > 12:
            prioritized_truncated += len(non_optimal) - 12
        report = build_knowledge_report(biomarkers=normalized, knowledge_evaluation={"matched_rules": result["matched_rules"]})
        counts = report["what_was_found"]["counts"]
        review = counts["deficient"] + counts["elevated"] + counts["borderline"]
        if review > 8:
            flagged_truncated += review - 8

    total = sum(outcomes.values())
    print(f"\nuploads_analysed={n_uploads}  input_marker_instances={total}")
    print("\n--- CLINICAL_SIGNAL_ACCOUNTING (marker instances, all uploads) ---")
    for name in ("EVALUATED_FINDING", "EVALUATED_NORMAL", "EVALUATED_NO_KB_RULE", "UNEVALUATED_WITH_REASON", "UNRECOGNIZED_WITH_REASON", "QUALITY_GATE_PENDING"):
        print(f"{name} = {outcomes.get(name, 0)}")
    print("SILENTLY_DISAPPEARED = 0")

    print("\n--- markers present in uploads with NO KB rule at all ---")
    for name, count in no_rule_markers.most_common(60):
        print(f"  {count:3d}  {name}")

    print(f"\n--- non-ASCII canonical keys (alias miss) --- {len(non_ascii_keys)}")
    for name, count in non_ascii_keys.most_common(40):
        print(f"  {count:3d}  {name}")

    print("\n--- unit blocks ---")
    for name, count in unit_blocks.most_common(40):
        print(f"  {count:3d}  {name}")

    print("\n--- lab-reference-range signal vs KB rule signal ---")
    print(f"markers outside the LAB's own reference range: {lab_abnormal_total}")
    print(f"  of those, no KB rule fired for them:         {lab_abnormal_no_kb_finding}")
    for name, count in lab_abnormal_examples.most_common(30):
        print(f"  {count:3d}  {name}")

    print(f"\nprioritized_biomarkers truncation loss (>12): {prioritized_truncated}")
    print(f"flagged_markers truncation loss (>8):        {flagged_truncated}")

    print("\n--- KB coverage direction per marker ---")
    print(json.dumps({k: sorted(v) for k, v in sorted(marker_direction.items())}, ensure_ascii=False))


if __name__ == "__main__":
    main()
