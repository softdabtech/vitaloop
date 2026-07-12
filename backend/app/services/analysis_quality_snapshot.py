from __future__ import annotations

from typing import Any, Dict

from app.services.knowledge.domain_registry import DOMAIN_REGISTRY_VERSION

ANALYSIS_QUALITY_SNAPSHOT_VERSION = "analysis_quality_snapshot_v1"


def _count_protocol_items(protocol: Dict[str, Any] | None) -> int:
    if not isinstance(protocol, dict):
        return 0
    return sum(len(items or []) for items in protocol.values() if isinstance(items, list))


def _top_domains(health_states: Dict[str, Any] | None) -> list[Dict[str, Any]]:
    return [
        {
            "domain": item.get("domain"),
            "score": item.get("score"),
            "risk_level": item.get("risk_level"),
            "confidence": item.get("confidence"),
        }
        for item in ((health_states or {}).get("top_priorities") or [])[:5]
        if isinstance(item, dict)
    ]


def _priority_trends(trend_analysis: Dict[str, Any] | None) -> list[Dict[str, Any]]:
    return [
        {
            "name": item.get("name"),
            "direction": item.get("direction"),
            "percent_change": item.get("percent_change"),
            "interpretation": item.get("interpretation"),
        }
        for item in ((trend_analysis or {}).get("priority_changes") or [])[:5]
        if isinstance(item, dict)
    ]


def build_analysis_quality_snapshot(
    *,
    health_context: Dict[str, Any] | None,
    health_states: Dict[str, Any] | None,
    trend_analysis: Dict[str, Any] | None,
    ai_orchestration: Dict[str, Any] | None,
    protocol: Dict[str, Any] | None,
    safety_result: Dict[str, Any] | None,
    cost_metadata: Dict[str, Any] | None,
) -> Dict[str, Any]:
    ai_metadata = (ai_orchestration or {}).get("metadata") or {}
    return {
        "version": ANALYSIS_QUALITY_SNAPSHOT_VERSION,
        "core_versions": {
            "health_context": (health_context or {}).get("version"),
            "health_states": (health_states or {}).get("version"),
            "trend_analysis": (trend_analysis or {}).get("version"),
            "ai_orchestration": (ai_orchestration or {}).get("version"),
            "knowledge_domain_registry": DOMAIN_REGISTRY_VERSION,
        },
        "readiness": (health_context or {}).get("readiness") or {},
        "coverage": {
            "protocol_item_count": _count_protocol_items(protocol),
            "health_state_count": len((health_states or {}).get("states") or []),
            "trend_available": bool((trend_analysis or {}).get("available")),
            "priority_trend_count": len((trend_analysis or {}).get("priority_changes") or []),
        },
        "top_health_domains": _top_domains(health_states),
        "priority_trends": _priority_trends(trend_analysis),
        "safety": {
            "status": (safety_result or {}).get("status"),
            "doctor_discussion_required": bool((safety_result or {}).get("doctor_discussion_required")),
            "event_count": len((safety_result or {}).get("safety_events") or []),
            "warning_count": len((safety_result or {}).get("warnings") or []),
        },
        "ai": {
            "status": (ai_orchestration or {}).get("status"),
            "analysis_source": ai_metadata.get("analysis_source"),
            "fallback_used": bool(ai_metadata.get("fallback_used")),
            "item_count": ai_metadata.get("item_count"),
        },
        "cost": {
            "estimated": bool((cost_metadata or {}).get("estimated", True)),
            "ai_total_tokens": int((cost_metadata or {}).get("ai_total_tokens") or 0),
            "estimated_cost_usd": float((cost_metadata or {}).get("estimated_cost_usd") or 0),
        },
    }
