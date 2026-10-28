import pytest
from fastapi import HTTPException

from app.services.partners import auth
from app.services.partners.auth import hash_partner_api_key, require_scope, resolve_partner_from_api_key


def test_hash_partner_api_key_stable():
    value = "secret-key"
    assert hash_partner_api_key(value) == hash_partner_api_key(value)


@pytest.mark.asyncio
async def test_partner_key_lookup_falls_back_when_optional_columns_missing(monkeypatch):
    calls = []

    class _Query:
        def __init__(self, table_name):
            self.table_name = table_name
            self.selected = ""

        def select(self, selected):
            self.selected = selected
            calls.append(selected)
            return self

        def eq(self, *_args):
            return self

        def limit(self, *_args):
            return self

        def execute(self):
            if "key_prefix" in self.selected:
                raise RuntimeError({"code": "42703", "message": "column partner_api_keys.key_prefix does not exist"})
            return type("Resp", (), {"data": [{"id": "key-id", "partner_id": "partner-id", "scopes": ["labs:analyze"], "expires_at": None}]})()

    class _Client:
        def table(self, name):
            return _Query(name)

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(auth.supabase, "_get_supabase", lambda: _Client())
    monkeypatch.setattr(auth.supabase, "_run", fake_run)

    row = await auth._fetch_partner_key_record(hash_partner_api_key("k_live_123"))
    assert row["id"] == "key-id"
    assert calls[0] == "id,partner_id,key_hash,key_prefix,key_label,status,expires_at,scopes"
    assert calls[1] == "id,partner_id,key_hash,status,expires_at,scopes"


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
