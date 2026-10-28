"""P0 Cost-aware Architecture: GET /crm/ops/openai-usage's daily-spend
guard (app/routers/crm/crm_ops.py::get_openai_usage_metrics).
"""

from uuid import uuid4

import pytest

from app.config import settings
from app.dependencies_crm import UserContext
from app.routers.crm import crm_ops
from app.services import supabase_service as svc


class _UsageTable:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def gte(self, *_args, **_kwargs):
        return self

    def in_(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("Resp", (), {"data": self._rows})()


class _FakeClient:
    def __init__(self, rows):
        self._rows = rows

    def table(self, name):
        assert name == "llm_usage_events"
        return _UsageTable(self._rows)


async def _fake_run(fn):
    return fn()


def _super_admin_user():
    return UserContext(user_id=uuid4(), global_role="super_admin", jwt_payload={})


@pytest.mark.asyncio
async def test_over_threshold_flagged_when_avg_daily_cost_exceeds_setting(monkeypatch):
    # gpt-4o pricing ($5/$15 per 1M) with enough tokens to clearly exceed a
    # low threshold over a short window.
    rows = [
        {"task_name": "protocol", "model": "gpt-4o-2024-08-06", "prompt_tokens": 2_000_000, "completion_tokens": 500_000},
    ]
    monkeypatch.setattr(crm_ops.svc, "_get_supabase", lambda: _FakeClient(rows))
    monkeypatch.setattr(svc, "_run", _fake_run)
    monkeypatch.setattr(settings, "openai_daily_spend_alert_threshold_usd", 1.0)

    result = await crm_ops.get_openai_usage_metrics(days=1, user_context=_super_admin_user())

    assert result["cost"]["total_cost_usd"] > 1.0
    assert result["cost"]["over_daily_threshold"] is True
    assert result["cost"]["daily_spend_alert_threshold_usd"] == 1.0


@pytest.mark.asyncio
async def test_under_threshold_not_flagged(monkeypatch):
    rows = [
        {"task_name": "protocol", "model": "gpt-4o-mini", "prompt_tokens": 1000, "completion_tokens": 500},
    ]
    monkeypatch.setattr(crm_ops.svc, "_get_supabase", lambda: _FakeClient(rows))
    monkeypatch.setattr(svc, "_run", _fake_run)
    monkeypatch.setattr(settings, "openai_daily_spend_alert_threshold_usd", 5.0)

    result = await crm_ops.get_openai_usage_metrics(days=30, user_context=_super_admin_user())

    assert result["cost"]["over_daily_threshold"] is False


@pytest.mark.asyncio
async def test_avg_daily_cost_divides_by_window_days(monkeypatch):
    rows = [
        {"task_name": "protocol", "model": "gpt-4o-2024-08-06", "prompt_tokens": 1_000_000, "completion_tokens": 0},
    ]
    monkeypatch.setattr(crm_ops.svc, "_get_supabase", lambda: _FakeClient(rows))
    monkeypatch.setattr(svc, "_run", _fake_run)

    result = await crm_ops.get_openai_usage_metrics(days=10, user_context=_super_admin_user())

    # 1,000,000 prompt tokens at $5/1M = $5 total over a 10-day window.
    assert result["cost"]["total_cost_usd"] == pytest.approx(5.0)
    assert result["cost"]["avg_daily_cost_usd"] == pytest.approx(0.5)
