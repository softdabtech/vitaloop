from types import SimpleNamespace

import pytest

from app.services.partners.events import normalize_event_type, track_partner_event


class _FakeQuery:
    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        return SimpleNamespace(data=[self.payload])


class _FakeClient:
    def table(self, _name):
        return _FakeQuery()


def test_normalize_event_type_strict_validation():
    assert normalize_event_type("order_completed") == "order_completed"
    with pytest.raises(ValueError):
        normalize_event_type("unexpected-event")


@pytest.mark.asyncio
async def test_track_partner_event_inserts_payload(monkeypatch):
    async def fake_run(fn):
        return fn()

    monkeypatch.setattr("app.services.partners.events.supabase._get_supabase", lambda: _FakeClient())
    monkeypatch.setattr("app.services.partners.events.supabase._run", fake_run)

    row = await track_partner_event(
        partner_id="partner-1",
        event_type="recommendation_clicked",
        partner_patient_id="patient-1",
        partner_lab_result_id="result-1",
        event_payload={"sku": "abc"},
    )

    assert row["partner_id"] == "partner-1"
    assert row["event_type"] == "recommendation_clicked"
    assert row["event_payload"]["sku"] == "abc"
