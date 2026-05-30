from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services.partners.embedded_sessions import (
    create_embedded_session_token,
    resolve_embedded_token,
    resolve_partner_patient_id,
)


class _FakeQuery:
    def __init__(self, rows=None):
        self._rows = rows or []

    def insert(self, _payload):
        return self

    def select(self, _fields):
        return self

    def eq(self, *_args):
        return self

    def limit(self, _value):
        return self

    def execute(self):
        return SimpleNamespace(data=self._rows)


class _FakeClient:
    def __init__(self, rows):
        self.rows = rows

    def table(self, _name):
        return _FakeQuery(self.rows)


class _GuardQuery:
    def __init__(self):
        self._last_field = None

    def select(self, _fields):
        return self

    def eq(self, field, value):
        if field == "id":
            raise AssertionError(f"id lookup should be skipped for non-uuid value: {value}")
        self._last_field = field
        return self

    def limit(self, _value):
        return self

    def execute(self):
        # Return row for external_patient_id path.
        return SimpleNamespace(data=[{"id": "resolved-patient-id"}])


class _GuardClient:
    def table(self, _name):
        return _GuardQuery()


@pytest.mark.asyncio
async def test_create_and_resolve_embedded_token(monkeypatch):
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    stored_rows = [
        {
            "id": "sess-1",
            "partner_id": "partner-1",
            "partner_patient_id": "patient-1",
            "partner_lab_result_id": "result-1",
            "expires_at": expires_at,
            "consumed_at": None,
        }
    ]

    fake_client = _FakeClient(stored_rows)

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr("app.services.partners.embedded_sessions.supabase._get_supabase", lambda: fake_client)
    monkeypatch.setattr("app.services.partners.embedded_sessions.supabase._run", fake_run)

    created = await create_embedded_session_token(
        partner_id="partner-1",
        partner_patient_id="patient-1",
        partner_lab_result_id="result-1",
        ttl_seconds=600,
    )

    assert created["token"].startswith("ptk_")

    resolved = await resolve_embedded_token(created["token"])
    assert resolved is not None
    assert resolved.partner_id == "partner-1"
    assert resolved.partner_lab_result_id == "result-1"


@pytest.mark.asyncio
async def test_resolve_partner_patient_id_handles_non_uuid_external_id(monkeypatch):
    async def fake_run(fn):
        return fn()

    monkeypatch.setattr("app.services.partners.embedded_sessions.supabase._get_supabase", lambda: _GuardClient())
    monkeypatch.setattr("app.services.partners.embedded_sessions.supabase._run", fake_run)

    patient_id = await resolve_partner_patient_id("partner-1", "SMOKE-PAT-123")
    assert patient_id == "resolved-patient-id"
