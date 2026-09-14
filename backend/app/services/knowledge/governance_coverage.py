"""Governance Coverage (P10) — which pattern-engine domains actually have
knowledge-rule backing, and at what review status.

2026-09-14 roadmap item P10: after P1-P9 made a lot of clinical reasoning
visible to users and practitioners, the rule-governance side needs the same
"coverage" framing rather than just a flat, unfiltered rule list — which
domains (iron/anemia, thyroid, glucose/insulin, ...) have zero active rules
behind them, which have only drafts, and which rules don't map to any known
domain at all (worth a second look — either the domain registry needs a new
alias, or the rule targets something the registry doesn't know about yet).

Deliberately pure composition: reuses domain_registry.py's existing
marker_aliases (the same list health_state_engine.py already matches
biomarkers against) to classify each knowledge_rule by its input_entities,
rather than inventing a second, possibly-inconsistent domain taxonomy or
requiring a new "domain" column on knowledge_rules.
"""

from __future__ import annotations

from typing import Any, Dict, List

from app.services.knowledge.domain_registry import list_domain_definitions

GOVERNANCE_COVERAGE_VERSION = "governance_coverage_v1"

_STATUS_KEYS = ("draft", "reviewed", "active", "deprecated")
_UNMAPPED_KEY = "unmapped"


def _domain_alias_map() -> Dict[str, set[str]]:
    return {
        str(item.get("key") or "").strip(): {
            str(alias).strip().lower() for alias in item.get("marker_aliases") or [] if str(alias).strip()
        }
        for item in list_domain_definitions()
        if item.get("key")
    }


def _matches_alias(entity: str, alias: str) -> bool:
    return alias in entity or entity in alias


def _domains_for_rule(entities: List[Any], alias_map: Dict[str, set[str]]) -> set[str]:
    matched: set[str] = set()
    for raw_entity in entities or []:
        entity = str(raw_entity or "").strip().lower()
        if not entity:
            continue
        for domain_key, aliases in alias_map.items():
            if any(_matches_alias(entity, alias) for alias in aliases):
                matched.add(domain_key)
    return matched


def _empty_bucket() -> Dict[str, Any]:
    return {status: 0 for status in _STATUS_KEYS} | {"rules": []}


def build_governance_coverage(rules: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    alias_map = _domain_alias_map()
    coverage: Dict[str, Dict[str, Any]] = {domain_key: _empty_bucket() for domain_key in alias_map}
    coverage[_UNMAPPED_KEY] = _empty_bucket()

    for rule in rules or []:
        if not isinstance(rule, dict):
            continue
        status = str(rule.get("governance_status") or "").strip().lower()
        if status not in _STATUS_KEYS:
            # A rule predating the governance_status column, or with
            # active=true and no explicit status, still needs to be
            # counted somewhere — fall back to the active flag rather than
            # silently dropping it from coverage.
            status = "active" if rule.get("active") else "draft"

        matched_domains = _domains_for_rule(rule.get("input_entities") or [], alias_map) or {_UNMAPPED_KEY}
        rule_summary = {
            "id": rule.get("id"),
            "key": rule.get("key"),
            "name": rule.get("name"),
            "governance_status": status,
            "confidence": rule.get("confidence"),
            "severity": rule.get("severity"),
            "version": rule.get("version"),
            "source": rule.get("source"),
        }
        for domain_key in matched_domains:
            bucket = coverage.setdefault(domain_key, _empty_bucket())
            bucket[status] = bucket.get(status, 0) + 1
            bucket["rules"].append(rule_summary)

    domains_without_active_coverage = sorted(
        domain_key
        for domain_key, bucket in coverage.items()
        if domain_key != _UNMAPPED_KEY and bucket["active"] == 0
    )

    return {
        "version": GOVERNANCE_COVERAGE_VERSION,
        "domains": coverage,
        "summary": {
            "total_domains": len(alias_map),
            "domains_without_active_coverage": domains_without_active_coverage,
            "domains_without_active_coverage_count": len(domains_without_active_coverage),
            "unmapped_rule_count": len(coverage[_UNMAPPED_KEY]["rules"]),
        },
    }
