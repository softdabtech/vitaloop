import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from httpx import ASGITransport, AsyncClient

from app.config import settings


def test_origins_list_includes_production_fallbacks_when_env_empty(monkeypatch):
    monkeypatch.setattr(settings, "allowed_origins", "")

    origins = settings.origins_list

    assert "https://vitaloop.today" in origins
    assert "https://www.vitaloop.today" in origins
    assert "https://crm.vitaloop.today" in origins
    assert "http://localhost:5173" in origins
    assert "http://127.0.0.1:5173" in origins


def test_origins_list_deduplicates_and_keeps_custom_origins(monkeypatch):
    monkeypatch.setattr(
        settings,
        "allowed_origins",
        " https://preview.vitaloop.today, https://vitaloop.today,https://preview.vitaloop.today ",
    )

    origins = settings.origins_list

    assert "https://preview.vitaloop.today" in origins
    assert origins.count("https://preview.vitaloop.today") == 1
    assert origins.count("https://vitaloop.today") == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "origin",
    [
        "https://vitaloop.today",
        "https://www.vitaloop.today",
        "https://crm.vitaloop.today",
    ],
)
async def test_cors_preflight_allows_production_origins_even_when_env_missing(monkeypatch, origin):
    monkeypatch.setattr(settings, "allowed_origins", "")

    app = FastAPI()

    @app.get("/auth/me")
    async def auth_me():
        return {"ok": True}

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/auth/me",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin
    assert response.headers.get("access-control-allow-credentials") == "true"
