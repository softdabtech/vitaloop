"""Split "no KB rule" markers into alias misses vs genuine knowledge gaps.

An alias miss is a code bug: the KB has a rule for the marker, but
to_canonical_name() produced a different key because the lab decorated the name
(parentheses, a synonym, a different word order). A knowledge gap is real: no
rule exists for that analyte in any spelling.
"""
from __future__ import annotations

import asyncio
import re
import sys
from collections import Counter, defaultdict
from typing import Any, Dict, List

sys.path.insert(0, ".")

from app.services import supabase_service as supabase  # noqa: E402
from app.services.knowledge.integration import biomarkers_to_knowledge_lab_results  # noqa: E402
from app.services.lab_analysis_pipeline import normalize_biomarkers  # noqa: E402


async def _select(table: str, columns: str, limit: int, order: str | None = None):
    client = supabase._get_supabase()

    def query():
        q = client.table(table).select(columns)
        if order:
            q = q.order(order, desc=True)
        return q.limit(limit).execute()

    return (await supabase._run(query)).data or []


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
    rules = asyncio.run(_select("knowledge_rules", "key,conditions,active,governance_status", 1000))
    active = [r for r in rules if r.get("active") and str(r.get("governance_status") or "active") == "active"]
    kb_markers = set()
    for rule in active:
        atoms: List[Dict[str, Any]] = []
        rule_atoms(rule.get("conditions"), atoms)
        for atom in atoms:
            kb_markers.add(str(atom.get("lab_marker")).strip().lower())

    uploads = asyncio.run(_select("report_versions", "upload_id,input_snapshot", 300, order="created_at"))

    observed: Dict[str, Counter] = defaultdict(Counter)
    seen = set()
    for row in uploads:
        snapshot = row.get("input_snapshot") or {}
        raw = snapshot.get("biomarkers") or []
        if not raw or row.get("upload_id") in seen:
            continue
        seen.add(row.get("upload_id"))
        for key, data in biomarkers_to_knowledge_lab_results(normalize_biomarkers(raw)).items():
            observed[key][str(data.get("source_name"))] += 1

    alias_miss = []
    gap = []
    for key, names in sorted(observed.items()):
        if key in kb_markers:
            continue
        # Strip parenthetical qualifiers and try the bare stem + the qualifier itself.
        stem = re.sub(r"_?\([^)]*\)", "", key).strip("_")
        paren = re.findall(r"\(([^)]*)\)", key)
        candidates = {stem, *[p.strip("_") for p in paren]}
        hit = sorted(c for c in candidates if c and c in kb_markers)
        row = (key, sum(names.values()), sorted(names))
        if hit:
            alias_miss.append((*row, hit[0], "parenthetical qualifier"))
        else:
            gap.append(row)

    print("=== ALIAS MISS: KB rule exists, canonical key does not match ===")
    for key, count, names, target, why in alias_miss:
        print(f"  {count:3d}  {key:42s} -> {target:22s} [{why}]  {names}")
    print(f"  subtotal marker instances lost: {sum(r[1] for r in alias_miss)}")

    print("\n=== NO MATCH by mechanical stemming (manual classification needed) ===")
    for key, count, names in gap:
        print(f"  {count:3d}  {key:42s}  {names}")

    print(f"\nKB markers with at least one active rule: {len(kb_markers)}")
    print(f"KB markers never seen in any upload: {sorted(kb_markers - set(observed))}")


if __name__ == "__main__":
    main()
