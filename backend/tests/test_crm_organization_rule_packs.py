"""P11 follow-up: GET/PATCH /admin/organizations/{org_id}/rule-packs
(app/routers/crm/crm.py::get_organization_rule_packs / update_organization_rule_pack).

Calls the route functions directly (bypassing HTTP/ASGI) with monkeypatched
_get_membership/_get_supabase/supabase_service, matching this suite's
existing pattern for CRM router unit tests without a live Supabase
connection (see test_crm_practitioner_clinical_summary.py).
"""

from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.routers.crm import crm as crm_router
from app.services import supabase_service as svc


async def _make_async(value):
    return value


def _current_user(sub="user-1"):
    return {"sub": sub, "app_metadata": {}}


@pytest.mark.asyncio
async def test_pack_with_no_org_override_defaults_to_enabled(monkeypatch):
    org_id = uuid4()

    async def fake_membership(_sb, _org_id, _user_id):
        return {"role": "org_owner"}

    async def fake_list_rules(**_kwargs):
        return [
            {
                "id": "r1",
                "key": "rule_a",
                "name": "Rule A",
                "input_entities": ["ldl"],
                "governance_status": "active",
                "source": "dr_smith_cardio_pack",
            }
        ]

    async def fake_get_settings(_org_id):
        return []  # no saved overrides at all

    monkeypatch.setattr(crm_router, "_get_membership", fake_membership)
    monkeypatch.setattr(crm_router, "_get_supabase", lambda: _make_async(object()))
    import app.services.knowledge as knowledge_pkg
    monkeypatch.setattr(knowledge_pkg, "list_rules", fake_list_rules)
    monkeypatch.setattr(svc, "get_organization_rule_pack_settings", fake_get_settings)

    result = await crm_router.get_organization_rule_packs(org_id, _current_user())

    pack = next(p for p in result["packs"] if p["pack_id"] == "dr_smith_cardio_pack")
    assert pack["enabled"] is True


@pytest.mark.asyncio
async def test_pack_with_saved_disabled_override_reflects_it(monkeypatch):
    org_id = uuid4()

    async def fake_membership(_sb, _org_id, _user_id):
        return {"role": "org_owner"}

    async def fake_list_rules(**_kwargs):
        return [
            {
                "id": "r1",
                "key": "rule_a",
                "name": "Rule A",
                "input_entities": ["ldl"],
                "governance_status": "active",
                "source": "dr_smith_cardio_pack",
            }
        ]

    async def fake_get_settings(_org_id):
        return [{"pack_id": "dr_smith_cardio_pack", "enabled": False}]

    monkeypatch.setattr(crm_router, "_get_membership", fake_membership)
    monkeypatch.setattr(crm_router, "_get_supabase", lambda: _make_async(object()))
    import app.services.knowledge as knowledge_pkg
    monkeypatch.setattr(knowledge_pkg, "list_rules", fake_list_rules)
    monkeypatch.setattr(svc, "get_organization_rule_pack_settings", fake_get_settings)

    result = await crm_router.get_organization_rule_packs(org_id, _current_user())

    pack = next(p for p in result["packs"] if p["pack_id"] == "dr_smith_cardio_pack")
    assert pack["enabled"] is False


@pytest.mark.asyncio
async def test_update_requires_org_owner_or_client_admin(monkeypatch):
    org_id = uuid4()

    async def fake_membership(_sb, _org_id, _user_id):
        return {"role": "manager"}  # not org_owner/client_admin

    monkeypatch.setattr(crm_router, "_get_membership", fake_membership)
    monkeypatch.setattr(crm_router, "_get_supabase", lambda: _make_async(object()))

    with pytest.raises(HTTPException) as exc_info:
        await crm_router.update_organization_rule_pack(
            org_id, "dr_smith_cardio_pack", {"enabled": False}, _current_user()
        )

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_update_rejects_missing_enabled_field(monkeypatch):
    org_id = uuid4()

    with pytest.raises(HTTPException) as exc_info:
        await crm_router.update_organization_rule_pack(org_id, "some_pack", {}, _current_user())

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_update_persists_toggle_and_returns_it(monkeypatch):
    org_id = uuid4()
    captured = {}

    async def fake_membership(_sb, _org_id, _user_id):
        return {"role": "org_owner"}

    async def fake_set_enabled(org_id_arg, pack_id_arg, enabled_arg, *, actor_user_id):
        captured["org_id"] = org_id_arg
        captured["pack_id"] = pack_id_arg
        captured["enabled"] = enabled_arg
        captured["actor_user_id"] = actor_user_id
        return {"organization_id": org_id_arg, "pack_id": pack_id_arg, "enabled": enabled_arg}

    monkeypatch.setattr(crm_router, "_get_membership", fake_membership)
    monkeypatch.setattr(crm_router, "_get_supabase", lambda: _make_async(object()))
    monkeypatch.setattr(svc, "set_organization_rule_pack_enabled", fake_set_enabled)

    result = await crm_router.update_organization_rule_pack(
        org_id, "dr_smith_cardio_pack", {"enabled": False}, _current_user(sub="owner-1")
    )

    assert result["enabled"] is False
    assert captured["pack_id"] == "dr_smith_cardio_pack"
    assert captured["actor_user_id"] == "owner-1"
