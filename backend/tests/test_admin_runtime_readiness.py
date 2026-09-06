import pytest

from app.routers.admin import admin


@pytest.mark.asyncio
async def test_rate_limiter_status_inmemory_is_ok(monkeypatch):
    monkeypatch.setattr(admin.settings, "rate_limit_backend", "inmemory")
    monkeypatch.setattr(admin.settings, "rate_limit_redis_url", "")

    status = await admin._get_rate_limiter_runtime_status()

    assert status["backend"] == "inmemory"
    assert status["ok"] is True
    assert status["redis"]["required"] is False
    assert status["redis"]["reachable"] is None


@pytest.mark.asyncio
async def test_rate_limiter_status_redis_requires_url(monkeypatch):
    monkeypatch.setattr(admin.settings, "rate_limit_backend", "redis")
    monkeypatch.setattr(admin.settings, "rate_limit_redis_url", "")

    status = await admin._get_rate_limiter_runtime_status()

    assert status["backend"] == "redis"
    assert status["ok"] is False
    assert status["redis"]["configured"] is False
    assert status["redis"]["reason"] == "missing_redis_url"


@pytest.mark.asyncio
async def test_rate_limiter_status_redis_uses_probe_result(monkeypatch):
    async def fake_probe(_redis_url: str, timeout_seconds: float = 1.5):
        return False, "redis_unreachable"

    monkeypatch.setattr(admin.settings, "rate_limit_backend", "redis")
    monkeypatch.setattr(admin.settings, "rate_limit_redis_url", "redis://localhost:6379/0")
    monkeypatch.setattr(admin, "_probe_redis_connectivity", fake_probe)

    status = await admin._get_rate_limiter_runtime_status()

    assert status["backend"] == "redis"
    assert status["ok"] is False
    assert status["redis"]["configured"] is True
    assert status["redis"]["reachable"] is False
    assert status["redis"]["reason"] == "redis_unreachable"


@pytest.mark.asyncio
async def test_runtime_readiness_marks_redis_url_as_missing_when_redis_backend(monkeypatch):
    async def fake_rate_limiter_status():
        return {
            "backend": "redis",
            "ok": False,
            "redis": {
                "required": True,
                "configured": False,
                "reachable": False,
                "reason": "missing_redis_url",
            },
        }

    monkeypatch.setattr(admin, "_get_rate_limiter_runtime_status", fake_rate_limiter_status)
    monkeypatch.setattr(admin.settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(admin.settings, "supabase_service_role_key", "service-role-key")
    monkeypatch.setattr(admin.settings, "resend_api_key", "resend-key")
    monkeypatch.setattr(admin.settings, "resend_from_email", "ops@example.com")
    monkeypatch.setattr(admin.settings, "sentry_dsn", "")
    monkeypatch.setattr(admin, "is_llm_configured", lambda: True)
    monkeypatch.setattr(admin.settings, "rate_limit_backend", "redis")

    payload = await admin._build_runtime_readiness_payload()

    assert payload["ok"] is False
    assert payload["checks"]["rate_limit_backend"] is True
    assert payload["checks"]["rate_limit_redis_url"] is False
    assert "rate_limit_redis_url" in payload["missing"]
    assert payload["rate_limiter"]["backend"] == "redis"
