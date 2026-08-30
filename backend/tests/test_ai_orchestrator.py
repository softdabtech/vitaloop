import pytest

from app.services.ai_orchestrator import (
    build_ai_context_snapshot,
    generate_ai_protocol_orchestrated,
)


def test_build_ai_context_snapshot_is_compact_and_structured():
    snapshot = build_ai_context_snapshot(
        health_context={"version": "health_context_v1", "readiness": {"has_profile": True}},
        knowledge_report={"version": "knowledge_report_v1", "why_it_matters": [{"key": "r1"}], "safety_alerts": []},
        health_states={
            "version": "health_state_engine_v1",
            "top_priorities": [{"domain": "iron_status", "score": 56, "risk_level": "needs_attention", "confidence": "high"}],
        },
        trend_analysis={
            "version": "trend_engine_v1",
            "priority_changes": [{"name": "Ferritin", "direction": "falling", "percent_change": -30, "interpretation": "watch_closely"}],
        },
    )

    assert snapshot["health_context_version"] == "health_context_v1"
    assert snapshot["readiness"]["has_profile"] is True
    assert snapshot["top_health_domains"][0]["domain"] == "iron_status"
    assert snapshot["priority_trends"][0]["name"] == "Ferritin"
    assert snapshot["knowledge_rule_count"] == 1


@pytest.mark.asyncio
async def test_generate_ai_protocol_orchestrated_returns_items_and_metadata(monkeypatch):
    async def fake_generator(*_args, **_kwargs):
        return [{"supplement": "Vitamin D3", "priority": "medium"}]

    monkeypatch.setattr("app.services.ai_orchestrator.get_analysis_source", lambda: "llm")
    monkeypatch.setattr("app.services.ai_orchestrator.is_llm_configured", lambda: True)

    result = await generate_ai_protocol_orchestrated(
        biomarkers=[],
        symptoms=[],
        user_profile={},
        user_id="user-1",
        upload_id="upload-1",
        locale="en",
        health_context={"version": "health_context_v1", "readiness": {}},
        knowledge_report={"version": "knowledge_report_v1"},
        health_states={"version": "health_state_engine_v1"},
        trend_analysis={"version": "trend_engine_v1"},
        generator=fake_generator,
    )

    assert result["version"] == "ai_orchestration_v1"
    assert result["status"] == "completed"
    assert result["items"][0]["supplement"] == "Vitamin D3"
    assert result["metadata"]["analysis_source"] == "llm"
    assert result["metadata"]["fallback_used"] is False
    assert "context_snapshot" in result["metadata"]
