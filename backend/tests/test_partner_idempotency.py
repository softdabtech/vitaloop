import pytest

from app.schemas.partners.results import PartnerResultIngestRequest
from app.services.partners.auth import PartnerPrincipal
from app.services.partners.gateway import ingest_partner_result
from app.services.partners.idempotency import is_duplicate_external_ids


def test_is_duplicate_external_ids():
    existing = {
        "external_result_id": "RES-1",
        "external_order_id": "ORD-1",
    }
    assert is_duplicate_external_ids(existing, external_result_id="RES-1", external_order_id="ORD-1") is True
    assert is_duplicate_external_ids(existing, external_result_id="RES-2", external_order_id="ORD-1") is False


@pytest.mark.asyncio
async def test_ingest_partner_result_returns_duplicate_without_reprocessing(monkeypatch):
    existing = {
        "id": "existing-result-id",
        "external_result_id": "RES-1",
        "external_order_id": "ORD-1",
    }

    async def fake_find_existing_partner_result(**_kwargs):
        return existing

    captured = {"events": 0}

    async def fake_track_partner_event(**_kwargs):
        captured["events"] += 1
        return {"id": "evt-1"}

    monkeypatch.setattr("app.services.partners.gateway.find_existing_partner_result", fake_find_existing_partner_result)
    monkeypatch.setattr("app.services.partners.gateway.track_partner_event", fake_track_partner_event)

    payload = PartnerResultIngestRequest(
        partner_slug="smartlab",
        external_patient_id="P-1",
        external_order_id="ORD-1",
        external_result_id="RES-1",
        lab_result={"biomarkers": []},
    )
    principal = PartnerPrincipal(partner_id="partner-1", partner_slug="smartlab", key_id="key-1", scopes=[])

    response = await ingest_partner_result(payload, principal)

    assert response["duplicate"] is True
    assert response["partner_lab_result_id"] == "existing-result-id"
    assert captured["events"] == 1


@pytest.mark.asyncio
async def test_ingest_partner_result_raises_when_insert_returns_no_id(monkeypatch):
    async def fake_find_existing_partner_result(**_kwargs):
        return None

    async def fake_upsert_partner_patient(*_args, **_kwargs):
        return {"id": "patient-1"}

    async def fake_insert_partner_lab_result(_payload):
        return {"status": "received"}

    monkeypatch.setattr("app.services.partners.gateway.find_existing_partner_result", fake_find_existing_partner_result)
    monkeypatch.setattr("app.services.partners.gateway._upsert_partner_patient", fake_upsert_partner_patient)
    monkeypatch.setattr("app.services.partners.gateway._insert_partner_lab_result", fake_insert_partner_lab_result)

    payload = PartnerResultIngestRequest(
        partner_slug="smartlab",
        external_patient_id="P-1",
        external_order_id="ORD-1",
        external_result_id="RES-1",
        lab_result={"biomarkers": []},
    )
    principal = PartnerPrincipal(partner_id="partner-1", partner_slug="smartlab", key_id="key-1", scopes=[])

    with pytest.raises(RuntimeError):
        await ingest_partner_result(payload, principal)
