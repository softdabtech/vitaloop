"""P26: GET /knowledge/rules/pack-quality route.

Verifies: super_admin auth is enforced, a non-admin gets 403, the
response shape matches app/services/knowledge/rule_pack_quality.py's
build function, and -- the important structural check -- this route is
registered BEFORE /knowledge/rules/{rule_id} so "pack-quality" is never
swallowed as a rule id (the same shape conflict /rules/packs and
/rules/governance-coverage already avoid).
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.dependencies_crm import UserContext, require_super_admin, get_user_context
from app.services.knowledge import list_rules as real_list_rules
import app.routers.knowledge as knowledge_router


def _admin_context():
    return UserContext(uuid.UUID("11111111-1111-1111-1111-111111111111"), "super_admin", {})


def _end_user_context():
    return UserContext(uuid.UUID("22222222-2222-2222-2222-222222222222"), "end_user", {})


@pytest.mark.asyncio
async def test_rule_pack_quality_endpoint_returns_shape_for_super_admin(monkeypatch):
    async def _fake_list_rules(**_kwargs):
        return [
            {
                "id": "r1", "key": "r1", "name": "Rule 1", "source": "core_vitaloop",
                "governance_status": "active", "medical_reviewed_by": "dr_a",
                "medical_reviewed_at": "2026-08-01T00:00:00Z", "updated_at": "2026-08-01T00:00:00Z",
                "input_entities": ["ferritin"],
            }
        ]

    monkeypatch.setattr(knowledge_router, "list_rules", _fake_list_rules)
    app.dependency_overrides[require_super_admin] = _admin_context
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/knowledge/rules/pack-quality")

        assert resp.status_code == 200
        body = resp.json()
        assert body["version"] == "rule_pack_quality_v1"
        assert "core_vitaloop" in body["packs"]
        assert "methodology" in body
        assert "summary" in body
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_rule_pack_quality_endpoint_rejects_non_admin():
    app.dependency_overrides[get_user_context] = _end_user_context
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/knowledge/rules/pack-quality")

        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_rule_pack_quality_endpoint_rejects_unauthenticated():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/knowledge/rules/pack-quality")

    assert resp.status_code in (401, 403)


def test_rule_pack_quality_route_registered_before_rule_id_route():
    """Structural proof: /rules/pack-quality has the exact same single-
    segment shape as /rules/{rule_id} -- if it were declared AFTER the
    dynamic route, "pack-quality" would be swallowed as a rule id and this
    endpoint would never be reachable. Same ordering requirement as the
    pre-existing /rules/packs and /rules/governance-coverage routes."""
    path_order = [route.path for route in app.routes if getattr(route, "path", "").startswith("/knowledge/rules")]

    quality_index = path_order.index("/knowledge/rules/pack-quality")
    rule_id_index = path_order.index("/knowledge/rules/{rule_id}")

    assert quality_index < rule_id_index, (
        "GET /knowledge/rules/pack-quality must be registered before /knowledge/rules/{rule_id} "
        "or it will be matched as a rule id lookup instead."
    )


@pytest.mark.asyncio
async def test_rule_pack_quality_endpoint_not_shadowed_by_rule_id_route(monkeypatch):
    """End-to-end proof of the ordering test above: calling the real path
    must return the quality payload, not attempt (and fail/404) a rule
    lookup for a rule literally named "pack-quality"."""
    async def _fake_list_rules(**_kwargs):
        return []

    async def _fail_get_rule(rule_id):
        raise AssertionError(f"get_rule should never be called with rule_id={rule_id!r}")

    monkeypatch.setattr(knowledge_router, "list_rules", _fake_list_rules)
    monkeypatch.setattr(knowledge_router, "get_rule", _fail_get_rule)
    app.dependency_overrides[require_super_admin] = _admin_context
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/knowledge/rules/pack-quality")

        assert resp.status_code == 200
        assert resp.json()["version"] == "rule_pack_quality_v1"
    finally:
        app.dependency_overrides.clear()
