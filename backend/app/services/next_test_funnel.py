"""Next-Test Funnel (P12) — turns next_best_tests/evidence_gaps into a
grouped, trackable "what to test next" panel.

2026-09-14 roadmap item P12. Per the user's own scoping: this session has
no real lab-partner credentials or checkout integration to wire up, and
fabricating one would misrepresent a live commerce feature that doesn't
exist (the same "don't fabricate what isn't real" boundary this thread
held to for the knowledge-governance medical-reviewer identity). What IS
genuinely buildable and valuable without any partner integration:

  1. group the already-ranked next_best_tests by clinical domain (reusing
     domain_registry.py, the same registry governance_coverage.py and
     health_state_engine.py already classify against) into a shareable
     panel instead of a flat list;
  2. track which PREVIOUSLY suggested tests have since been completed —
     the actual "how do I know this funnel works" signal, computed by
     checking whether a test recommended last time now has a value in
     this run's biomarkers.

Partner checkout/ordering is intentionally out of scope here — the funnel
is checkout-ready data (domain, marker, priority, reason), not a fake
"Order Now" button with nowhere real to send it.
"""

from __future__ import annotations

from typing import Any, Dict, List

from app.services.knowledge.domain_registry import list_domain_definitions

NEXT_TEST_FUNNEL_VERSION = "next_test_funnel_v1"

_PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


def _domain_alias_map() -> Dict[str, set[str]]:
    return {
        str(item.get("key") or "").strip(): {
            str(alias).strip().lower() for alias in item.get("marker_aliases") or [] if str(alias).strip()
        }
        for item in list_domain_definitions()
        if item.get("key")
    }


def _domain_for_marker(marker: str, alias_map: Dict[str, set[str]]) -> str:
    marker_lower = str(marker or "").strip().lower()
    for domain_key, aliases in alias_map.items():
        if any(alias in marker_lower or marker_lower in alias for alias in aliases):
            return domain_key
    return "general"


def _current_marker_keys(biomarkers: List[Dict[str, Any]]) -> set[str]:
    keys: set[str] = set()
    for item in biomarkers or []:
        for field in ("canonical_name", "name", "source_name"):
            value = str(item.get(field) or "").strip().lower()
            if value:
                keys.add(value)
    return keys


def _marker_fulfilled(marker: str, current_marker_keys: set[str]) -> bool:
    marker_lower = str(marker or "").strip().lower()
    if not marker_lower:
        return False
    return any(marker_lower in key or key in marker_lower for key in current_marker_keys)


def build_next_test_funnel(
    *,
    next_best_tests: Dict[str, Any] | None = None,
    previous_next_best_tests: Dict[str, Any] | None = None,
    current_biomarkers: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    alias_map = _domain_alias_map()
    current_marker_keys = _current_marker_keys(current_biomarkers)

    pending = [
        item
        for item in (next_best_tests or {}).get("recommended_tests") or []
        if isinstance(item, dict) and item.get("marker")
    ]
    pending_sorted = sorted(pending, key=lambda item: _PRIORITY_RANK.get(str(item.get("priority") or "medium").lower(), 1))

    panel: Dict[str, List[Dict[str, Any]]] = {}
    for item in pending_sorted:
        marker = str(item.get("marker") or "").strip()
        domain_key = item.get("domain") or _domain_for_marker(marker, alias_map)
        panel.setdefault(domain_key, []).append(
            {
                "marker": marker,
                "priority": item.get("priority") or "medium",
                "reason": item.get("reason"),
            }
        )

    completed_since_last: List[Dict[str, Any]] = []
    for item in (previous_next_best_tests or {}).get("recommended_tests") or []:
        if not isinstance(item, dict):
            continue
        marker = str(item.get("marker") or "").strip()
        if marker and _marker_fulfilled(marker, current_marker_keys):
            completed_since_last.append({"marker": marker, "domain": item.get("domain")})

    return {
        "version": NEXT_TEST_FUNNEL_VERSION,
        "available": bool(pending_sorted) or bool(completed_since_last),
        "panel": panel,
        "completed_since_last_upload": completed_since_last,
        "summary": {
            "total_pending": len(pending_sorted),
            "high_priority_pending": len([i for i in pending_sorted if str(i.get("priority") or "").lower() == "high"]),
            "domains_with_pending_tests": sorted(panel.keys()),
            "completed_since_last_upload_count": len(completed_since_last),
        },
    }
