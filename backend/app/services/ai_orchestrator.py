from __future__ import annotations

import time
from typing import Any, Awaitable, Callable, Dict, List

from app.services.ai.openai_service import generate_protocol, get_analysis_source, is_llm_configured

AI_ORCHESTRATION_VERSION = "ai_orchestration_v1"

ProtocolGenerator = Callable[..., Awaitable[List[Dict[str, Any]]]]


def build_ai_context_snapshot(
    *,
    health_context: Dict[str, Any],
    knowledge_report: Dict[str, Any],
    health_states: Dict[str, Any],
    trend_analysis: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "health_context_version": health_context.get("version"),
        "knowledge_report_version": knowledge_report.get("version"),
        "health_state_version": health_states.get("version"),
        "trend_version": trend_analysis.get("version"),
        "readiness": health_context.get("readiness") or {},
        "top_health_domains": [
            {
                "domain": item.get("domain"),
                "score": item.get("score"),
                "risk_level": item.get("risk_level"),
                "confidence": item.get("confidence"),
            }
            for item in (health_states.get("top_priorities") or [])[:5]
            if isinstance(item, dict)
        ],
        "priority_trends": [
            {
                "name": item.get("name"),
                "direction": item.get("direction"),
                "percent_change": item.get("percent_change"),
                "interpretation": item.get("interpretation"),
            }
            for item in (trend_analysis.get("priority_changes") or [])[:5]
            if isinstance(item, dict)
        ],
        "knowledge_rule_count": len(knowledge_report.get("why_it_matters") or []),
        "safety_alert_count": len(knowledge_report.get("safety_alerts") or []),
    }


async def generate_ai_protocol_orchestrated(
    *,
    biomarkers: List[Dict[str, Any]],
    symptoms: List[str],
    user_profile: Dict[str, Any] | None,
    user_id: str | None,
    upload_id: str | None,
    locale: str,
    health_context: Dict[str, Any],
    knowledge_report: Dict[str, Any],
    health_states: Dict[str, Any],
    trend_analysis: Dict[str, Any],
    clinical_context: Dict[str, Any] | None = None,
    generator: ProtocolGenerator = generate_protocol,
) -> Dict[str, Any]:
    started = time.perf_counter()
    context_snapshot = build_ai_context_snapshot(
        health_context=health_context,
        knowledge_report=knowledge_report,
        health_states=health_states,
        trend_analysis=trend_analysis,
    )
    # Pass clinical_context (from ClinicalAnalysisEngine.context_for_llm())
    # to the LLM generator so it sees the deterministic engine's output.
    items = await generator(
        biomarkers,
        symptoms,
        user_profile=user_profile,
        user_id=user_id,
        upload_id=upload_id,
        locale=locale,
        clinical_context=clinical_context,
    )
    source = get_analysis_source()
    return {
        "version": AI_ORCHESTRATION_VERSION,
        "status": "completed",
        "items": items,
        "metadata": {
            "llm_configured": is_llm_configured(),
            "analysis_source": source,
            "fallback_used": source == "fallback",
            "item_count": len(items or []),
            "duration_ms": int((time.perf_counter() - started) * 1000),
            "steps": [
                "context_snapshot",
                "protocol_generation",
                "pipeline_safety_validation",
                "protocol_enrichment",
            ],
            "context_snapshot": context_snapshot,
            "clinical_context_provided": clinical_context is not None,
        },
    }
