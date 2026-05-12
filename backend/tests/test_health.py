import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.routers import health


@pytest.mark.asyncio
async def test_health_includes_build_metadata():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/health")

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "ok"
    assert payload["build"]["service"] == "vitaloop-api"
    assert payload["build"]["app_version"] == app.version
    assert payload["build"]["release_version"]


@pytest.mark.asyncio
async def test_llm_health_unconfigured(monkeypatch):
    monkeypatch.setattr(health.settings, "routellm_base_url", "")
    monkeypatch.setattr(health.settings, "routellm_api_key", "")
    monkeypatch.setattr(health.settings, "routellm_model", "")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/ops/llm/health")

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["component"] == "llm"
    assert payload["ok"] is False
    assert payload["probe"]["configured"] is False
    assert payload["probe"]["reason"] == "missing_llm_configuration"


@pytest.mark.asyncio
async def test_llm_health_reachable_via_chat_fallback(monkeypatch):
    monkeypatch.setattr(health.settings, "routellm_base_url", "http://llm.local/v1")
    monkeypatch.setattr(health.settings, "routellm_api_key", "test-key")
    monkeypatch.setattr(health.settings, "routellm_model", "test-model")

    class _FakeResponse:
        def __init__(self, status_code: int):
            self.status_code = status_code
            self.is_success = 200 <= status_code < 300

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, path: str):
            assert path == "models"
            return _FakeResponse(404)

        async def post(self, path: str, json: dict):
            assert path == "chat/completions"
            assert json["model"] == "test-model"
            return _FakeResponse(200)

    monkeypatch.setattr(health.httpx, "AsyncClient", _FakeClient)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/ops/llm/health")

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert payload["probe"]["configured"] is True
    assert payload["probe"]["name"] == "chat_completions"
    assert payload["probe"]["reachable"] is True


@pytest.mark.asyncio
async def test_detailed_health_marks_stripe_configured_with_new_price_ids(monkeypatch):
    monkeypatch.setattr(health.settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(health.settings, "supabase_service_role_key", "service-role-key")
    monkeypatch.setattr(health.settings, "resend_api_key", "resend-key")
    monkeypatch.setattr(health.settings, "sentry_dsn", "")
    monkeypatch.setattr(health.settings, "stripe_secret_key", "stripe-secret")
    monkeypatch.setattr(health.settings, "stripe_webhook_secret", "stripe-wh")
    monkeypatch.setattr(health.settings, "stripe_price_id", "")
    monkeypatch.setattr(health.settings, "stripe_price_id_personal", "")
    monkeypatch.setattr(health.settings, "stripe_price_id_personal_monthly", "price_personal_monthly")
    monkeypatch.setattr(health.settings, "stripe_price_id_personal_yearly", "price_personal_yearly")
    monkeypatch.setattr(health.settings, "stripe_price_id_practitioner", "")
    monkeypatch.setattr(health.settings, "stripe_price_id_practitioner_monthly", "price_practitioner_monthly")
    monkeypatch.setattr(health.settings, "stripe_price_id_practitioner_yearly", "price_practitioner_yearly")

    async def _fake_run(*_args, **_kwargs):
        return None

    monkeypatch.setattr(health.svc, "_run", _fake_run)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/health/detailed")

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "ok"
    assert payload["services"]["stripe"]["status"] == "ok"