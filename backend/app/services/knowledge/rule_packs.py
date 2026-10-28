"""Expert Rule Packs (P11 v1) — provenance-grouped view of knowledge rules.

2026-09-14 roadmap item P11, scoped per the user's own framing: a full
marketplace (public catalog, payments, revenue share) is deliberately out
of scope for v1. What v1 actually needs, and what this module builds:

  1. group existing knowledge_rules by their `source` field into named
     "packs" — no schema change, no new table. `source` already exists on
     every rule and already flows through evaluator.py's matched_rules
     into every response that shows "why" a recommendation fired;
  2. surface each pack's provenance: who reviewed which rules
     (medical_reviewed_by, already required by governance.py::approve_rule
     for every active rule), rule counts by governance_status, and which
     clinical domains it covers (reusing domain_registry.py, the same
     registry governance_coverage.py already classifies against).

Per-organization pack enable/disable (the "practitioner can turn a
specific pack on for their org" step) needs new persisted state that does
not exist yet and this session cannot create (no direct Postgres/DDL
access — a real migration would need the user's own Supabase SQL Editor,
the same constraint that applied to the stage-28 migration earlier in
this thread). v1 is therefore visibility/attribution only: every active
rule from every source still applies globally, exactly as it already
does — packs here are a provenance lens on existing data, not a gate.
"""

from __future__ import annotations

from typing import Any, Dict, List

from app.services.knowledge.governance_coverage import _domain_alias_map, _domains_for_rule

RULE_PACKS_VERSION = "rule_packs_v1"

_STATUS_KEYS = ("draft", "reviewed", "active", "deprecated")
_DEFAULT_PACK_KEY = "core_vitaloop"


def _pack_key_for_rule(rule: Dict[str, Any]) -> str:
    source = str(rule.get("source") or "").strip()
    return source or _DEFAULT_PACK_KEY


def _empty_pack(pack_key: str) -> Dict[str, Any]:
    return {
        "pack_id": pack_key,
        "status_counts": {status: 0 for status in _STATUS_KEYS},
        "domains": set(),
        "reviewers": set(),
        "rules": [],
    }


def build_rule_packs(rules: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    alias_map = _domain_alias_map()
    packs: Dict[str, Dict[str, Any]] = {}

    for rule in rules or []:
        if not isinstance(rule, dict):
            continue
        pack_key = _pack_key_for_rule(rule)
        bucket = packs.setdefault(pack_key, _empty_pack(pack_key))

        status = str(rule.get("governance_status") or "").strip().lower()
        if status not in _STATUS_KEYS:
            status = "active" if rule.get("active") else "draft"
        bucket["status_counts"][status] = bucket["status_counts"].get(status, 0) + 1

        matched_domains = _domains_for_rule(rule.get("input_entities") or [], alias_map)
        bucket["domains"].update(matched_domains)

        reviewer = rule.get("medical_reviewed_by")
        if reviewer:
            bucket["reviewers"].add(str(reviewer))

        bucket["rules"].append(
            {
                "id": rule.get("id"),
                "key": rule.get("key"),
                "name": rule.get("name"),
                "governance_status": status,
                "version": rule.get("version"),
                "medical_reviewed_by": rule.get("medical_reviewed_by"),
                "medical_reviewed_at": rule.get("medical_reviewed_at"),
            }
        )

    # Sets aren't JSON-serializable and dict ordering should be stable for
    # callers — convert once, here, rather than asking every consumer to
    # remember to do it.
    serializable_packs = {}
    for pack_key, bucket in packs.items():
        serializable_packs[pack_key] = {
            **bucket,
            "domains": sorted(bucket["domains"]),
            "reviewers": sorted(bucket["reviewers"]),
            "rule_count": len(bucket["rules"]),
        }

    return {
        "version": RULE_PACKS_VERSION,
        "packs": serializable_packs,
        "summary": {
            "pack_count": len(serializable_packs),
            "core_pack_rule_count": serializable_packs.get(_DEFAULT_PACK_KEY, {}).get("rule_count", 0),
            "expert_pack_count": len([k for k in serializable_packs if k != _DEFAULT_PACK_KEY]),
        },
    }
