import pytest
from fastapi import HTTPException

from app.services.partners.auth import hash_partner_api_key, require_scope, resolve_partner_from_api_key


def test_hash_partner_api_key_stable():
    value = "secret-key"
    assert hash_partner_api_key(value) == hash_partner_api_key(value)


@pytest.mark.asyncio
async def test_resolve_partner_from_api_key_success(monkeypatch):
    key_hash = hash_partner_api_key("k_live_123")

    async def fake_key_record(_key_hash):
        assert _key_hash == key_hash
        return {
            "id": "key-id",
            "partner_id": "partner-id",
            "status": "active",
            "scopes": ["results:write"],
            "expires_at": None,
        }

    async def fake_partner(_partner_id):
        assert _partner_id == "partner-id"
        return {"id": "partner-id", "slug": "smartlab", "status": "active"}

    monkeypatch.setattr("app.services.partners.auth._fetch_partner_key_record", fake_key_record)
    monkeypatch.setattr("app.services.partners.auth._fetch_partner", fake_partner)

    principal = await resolve_partner_from_api_key("k_live_123")
    assert principal.partner_slug == "smartlab"
    assert principal.partner_id == "partner-id"


@pytest.mark.asyncio
async def test_resolve_partner_from_api_key_rejects_missing_key():
    with pytest.raises(HTTPException) as exc:
        await resolve_partner_from_api_key("")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_resolve_partner_from_api_key_rejects_unsupported_scope(monkeypatch):
    key_hash = hash_partner_api_key("k_live_123")

    async def fake_key_record(_key_hash):
        assert _key_hash == key_hash
        return {
            "id": "key-id",
            "partner_id": "partner-id",
            "status": "active",
            "scopes": ["unknown:scope"],
            "expires_at": None,
        }

    async def fake_partner(_partner_id):
        return {"id": "partner-id", "slug": "smartlab", "status": "active"}

    monkeypatch.setattr("app.services.partners.auth._fetch_partner_key_record", fake_key_record)
    monkeypatch.setattr("app.services.partners.auth._fetch_partner", fake_partner)

    with pytest.raises(HTTPException) as exc:
        await resolve_partner_from_api_key("k_live_123")
    assert exc.value.status_code == 403


def test_require_scope_blocks_missing_scope():
    principal = type("P", (), {"has_scope": lambda self, s: False})()
    with pytest.raises(HTTPException) as exc:
        require_scope(principal, "results:write")
    assert exc.value.status_code == 403
