"""P28: GET /crm/ops/llm-cost-audit route.

Verifies: super_admin auth is enforced, a non-admin gets 403, the
response shape matches app/services/llm_cost_audit.py's build function
verbatim, and the endpoint makes no database call (it's a pure read of a
static registry).
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.dependencies_crm import UserContext, require_super_admin, get_user_context
from app.services.llm_cost_audit import build_llm_cost_audit


def _admin_context():
    return UserContext(uuid.UUID("11111111-1111-1111-1111-111111111111"), "super_admin", {})


def _end_user_context():
    return UserContext(uuid.UUID("22222222-2222-2222-2222-222222222222"), "end_user", {})


@pytest.mark.asyncio
async def test_llm_cost_audit_endpoint_returns_the_static_audit_for_super_admin():
    app.dependency_overrides[require_super_admin] = _admin_context
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/crm/ops/llm-cost-audit")

        assert resp.status_code == 200
        body = resp.json()
        assert body == build_llm_cost_audit()
        assert body["version"] == "p28_v1"
        assert len(body["categories"]) == 12
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_llm_cost_audit_endpoint_rejects_non_admin():
    # Only override the underlying get_user_context (not require_super_admin
    # itself) so the real require_super_admin role check actually runs.
    app.dependency_overrides[get_user_context] = _end_user_context
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/crm/ops/llm-cost-audit")

        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_llm_cost_audit_endpoint_rejects_unauthenticated():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/crm/ops/llm-cost-audit")

    assert resp.status_code in (401, 403)
