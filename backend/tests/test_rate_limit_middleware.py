import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.middleware.security import PathRateLimitMiddleware, RateLimitRule


@pytest.mark.asyncio
async def test_path_rate_limiter_blocks_after_limit() -> None:
    app = FastAPI()

    @app.get("/analyze/ping")
    async def analyze_ping():
        return {"ok": True}

    app.add_middleware(
        PathRateLimitMiddleware,
        rules=[RateLimitRule(prefix="/analyze", max_requests=2, window_seconds=60)],
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.get("/analyze/ping")
        r2 = await client.get("/analyze/ping")
        r3 = await client.get("/analyze/ping")

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r3.status_code == 429
    assert r3.json().get("code") == "RATE_LIMITED"
    assert "Retry-After" in r3.headers


@pytest.mark.asyncio
async def test_path_rate_limiter_does_not_affect_other_prefixes() -> None:
    app = FastAPI()

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    app.add_middleware(
        PathRateLimitMiddleware,
        rules=[RateLimitRule(prefix="/analyze", max_requests=1, window_seconds=60)],
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.get("/health")
        r2 = await client.get("/health")

    assert r1.status_code == 200
    assert r2.status_code == 200
