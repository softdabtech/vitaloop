"""P20: /interventions CRUD router (app/routers/interventions.py).

Calls the route functions directly (bypassing HTTP/ASGI) with a
monkeypatched supabase_service, matching this suite's existing pattern
for router unit tests (see test_checkins.py). Every service function is
already scoped to (id, user_id) — these tests confirm the router wires
current_user["sub"] through on every call and never lets another user's
id leak in, and that PATCH/DELETE surface a 404 rather than silently
succeeding when supabase_service reports no row matched.
"""

import pytest
from fastapi import HTTPException

from app.routers import interventions as router


def _user(sub="user-1"):
    return {"sub": sub}


@pytest.mark.asyncio
async def test_list_interventions_scopes_to_current_user(monkeypatch):
    captured = {}

    async def fake_get(user_id):
        captured["user_id"] = user_id
        return [{"id": "e1", "user_id": user_id}]

    monkeypatch.setattr(router.svc, "get_intervention_events", fake_get)

    result = await router.list_interventions(_user("user-1"))

    assert captured["user_id"] == "user-1"
    assert result == [{"id": "e1", "user_id": "user-1"}]


@pytest.mark.asyncio
async def test_create_intervention_forces_source_user(monkeypatch):
    captured = {}

    async def fake_create(user_id, data):
        captured["user_id"] = user_id
        captured["data"] = data
        return {"id": "e1", **data}

    monkeypatch.setattr(router.svc, "create_intervention_event", fake_create)

    body = router.InterventionEventCreate(event_type="supplement", label="Iron", source="practitioner")

    result = await router.create_intervention(body, _user("user-1"))

    # source isn't even a field on InterventionEventCreate, so a client
    # can't inject it — the router always writes "user".
    assert captured["data"]["source"] == "user"
    assert captured["user_id"] == "user-1"
    assert result["label"] == "Iron"


@pytest.mark.asyncio
async def test_update_intervention_returns_404_when_not_found(monkeypatch):
    async def fake_update(user_id, event_id, data):
        return None

    monkeypatch.setattr(router.svc, "update_intervention_event", fake_update)

    body = router.InterventionEventUpdate(label="New label")

    with pytest.raises(HTTPException) as exc_info:
        await router.update_intervention("missing-id", body, _user("user-1"))

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_update_intervention_rejects_empty_body(monkeypatch):
    body = router.InterventionEventUpdate()

    with pytest.raises(HTTPException) as exc_info:
        await router.update_intervention("e1", body, _user("user-1"))

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_update_intervention_scopes_to_current_user(monkeypatch):
    captured = {}

    async def fake_update(user_id, event_id, data):
        captured["user_id"] = user_id
        captured["event_id"] = event_id
        return {"id": event_id, **data}

    monkeypatch.setattr(router.svc, "update_intervention_event", fake_update)

    body = router.InterventionEventUpdate(adherence="high")
    result = await router.update_intervention("e1", body, _user("user-2"))

    assert captured["user_id"] == "user-2"
    assert captured["event_id"] == "e1"
    assert result["adherence"] == "high"


@pytest.mark.asyncio
async def test_delete_intervention_returns_404_when_not_found(monkeypatch):
    async def fake_delete(user_id, event_id):
        return False

    monkeypatch.setattr(router.svc, "delete_intervention_event", fake_delete)

    with pytest.raises(HTTPException) as exc_info:
        await router.delete_intervention("missing-id", _user("user-1"))

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_intervention_succeeds_when_found(monkeypatch):
    captured = {}

    async def fake_delete(user_id, event_id):
        captured["user_id"] = user_id
        captured["event_id"] = event_id
        return True

    monkeypatch.setattr(router.svc, "delete_intervention_event", fake_delete)

    result = await router.delete_intervention("e1", _user("user-3"))

    assert result is None
    assert captured == {"user_id": "user-3", "event_id": "e1"}


def test_create_model_rejects_invalid_event_type():
    with pytest.raises(Exception):
        router.InterventionEventCreate(event_type="not_a_real_type", label="X")


def test_create_model_rejects_empty_label():
    with pytest.raises(Exception):
        router.InterventionEventCreate(event_type="supplement", label="")
