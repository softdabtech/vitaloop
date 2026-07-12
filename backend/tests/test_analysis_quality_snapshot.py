from app.services.analysis_quality_snapshot import build_analysis_quality_snapshot


def test_build_analysis_quality_snapshot_compacts_core_artifacts():
    snapshot = build_analysis_quality_snapshot(
        health_context={"version": "health_context_v1", "readiness": {"has_profile": True}},
        health_states={
            "version": "health_state_engine_v1",
            "states": [{"domain": "iron_status"}],
            "top_priorities": [{"domain": "iron_status", "score": 56, "risk_level": "needs_attention", "confidence": "high"}],
        },
        trend_analysis={
            "version": "trend_engine_v1",
            "available": True,
            "priority_changes": [{"name": "Ferritin", "direction": "falling", "percent_change": -20, "interpretation": "watch_closely"}],
        },
        ai_orchestration={
            "version": "ai_orchestration_v1",
            "status": "completed",
            "metadata": {"analysis_source": "llm", "fallback_used": False, "item_count": 2},
        },
        protocol={"nutrition": [{"key": "n1"}], "supplements": [{"key": "s1"}]},
        safety_result={"status": "approved_with_warnings", "doctor_discussion_required": True, "safety_events": [{}], "warnings": []},
        cost_metadata={"estimated": True, "ai_total_tokens": 123, "estimated_cost_usd": 0.001},
    )

    assert snapshot["version"] == "analysis_quality_snapshot_v1"
    assert snapshot["core_versions"]["health_context"] == "health_context_v1"
    assert snapshot["coverage"]["protocol_item_count"] == 2
    assert snapshot["coverage"]["trend_available"] is True
    assert snapshot["top_health_domains"][0]["domain"] == "iron_status"
    assert snapshot["priority_trends"][0]["name"] == "Ferritin"
    assert snapshot["safety"]["doctor_discussion_required"] is True
    assert snapshot["ai"]["analysis_source"] == "llm"
    assert snapshot["cost"]["ai_total_tokens"] == 123
