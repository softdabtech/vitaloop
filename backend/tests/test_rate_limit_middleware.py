import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.middleware.security import PathRateLimitMiddleware, RateLimitRule


def _build_test_app(*, trust_forwarded_for: bool = False) -> FastAPI:
    app = FastAPI()

    @app.get("/analyze/ping")
    async def analyze_ping():
        return {"ok": True}

    @app.get("/auth/ping")
    async def auth_ping():
        return {"ok": True}

    @app.get("/protocol/ping")
    async def protocol_ping():
        return {"ok": True}

    app.add_middleware(
        PathRateLimitMiddleware,
        rules=[
            RateLimitRule(prefix="/analyze", max_requests=2, window_seconds=60),
            RateLimitRule(prefix="/auth", max_requests=1, window_seconds=60),
            RateLimitRule(prefix="/protocol", max_requests=1, window_seconds=60),
        ],
        trust_forwarded_for=trust_forwarded_for,
    )
    return app


@pytest.mark.asyncio
async def test_path_rate_limiter_blocks_after_limit() -> None:
    app = _build_test_app()

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
    app = _build_test_app()

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.get("/health")
        r2 = await client.get("/health")

    assert r1.status_code == 200
    assert r2.status_code == 200


@pytest.mark.asyncio
async def test_path_rate_limiter_applies_to_auth_and_protocol_prefixes() -> None:
    app = _build_test_app()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        auth_ok = await client.get("/auth/ping")
        auth_limited = await client.get("/auth/ping")
        protocol_ok = await client.get("/protocol/ping")
        protocol_limited = await client.get("/protocol/ping")

    assert auth_ok.status_code == 200
    assert auth_limited.status_code == 429
    assert protocol_ok.status_code == 200
    assert protocol_limited.status_code == 429


@pytest.mark.asyncio
async def test_path_rate_limiter_can_distinguish_ips_when_forwarded_for_is_trusted() -> None:
    app = _build_test_app(trust_forwarded_for=True)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.get("/auth/ping", headers={"X-Forwarded-For": "198.51.100.10"})
        r2 = await client.get("/auth/ping", headers={"X-Forwarded-For": "198.51.100.20"})

    assert r1.status_code == 200
    assert r2.status_code == 200


@pytest.mark.asyncio
async def test_path_rate_limiter_ignores_forwarded_for_when_not_trusted() -> None:
    app = _build_test_app(trust_forwarded_for=False)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.get("/auth/ping", headers={"X-Forwarded-For": "198.51.100.10"})
        r2 = await client.get("/auth/ping", headers={"X-Forwarded-For": "198.51.100.20"})

    assert r1.status_code == 200
    assert r2.status_code == 429
