import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.routers import knowledge
from app.services.knowledge.evaluator import evaluate_input_with_rules


class _FakeAdminContext:
    def __init__(self):
        self.user_id = "11111111-1111-1111-1111-111111111111"


def _base_create_payload() -> dict:
    return {
        "key": "rule_test_key",
        "name": "Rule test",
        "conditions": {"all": [{"lab_marker": "ferritin", "operator": "lt", "value": 30, "unit": "ng/mL"}]},
        "outputs": {
            "risk": "possible_iron_deficiency_risk",
            "summary": "possible risk",
            "recommendation_keys": ["iron_followup_discussion"],
        },
        "explanation_template": "Ferritin may indicate possible risk",
        "source": "placeholder_source",
        "source_url": "https://example.org/source",
        "last_modified_by": "11111111-1111-1111-1111-111111111111",
        "change_note": "initial draft",
    }


@pytest.mark.asyncio
async def test_cannot_create_active_rule_directly():
    app.dependency_overrides[knowledge.require_super_admin] = lambda: _FakeAdminContext()

    payload = _base_create_payload()
    payload["governance_status"] = "active"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/knowledge/rules", json=payload)

    app.dependency_overrides.clear()

    assert resp.status_code == 400
    assert "draft" in str(resp.json()).lower()


@pytest.mark.asyncio
async def test_cannot_update_rule_without_change_note():
    app.dependency_overrides[knowledge.require_super_admin] = lambda: _FakeAdminContext()

    payload = {
        "name": "updated",
        "last_modified_by": "11111111-1111-1111-1111-111111111111",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.patch("/knowledge/rules/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", json=payload)

    app.dependency_overrides.clear()

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_cannot_approve_without_medical_reviewed_by():
    app.dependency_overrides[knowledge.require_super_admin] = lambda: _FakeAdminContext()

    payload = {
        "medical_reviewed_at": "2026-05-31T15:00:00Z",
        "change_note": "approved",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/knowledge/rules/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/approve", json=payload)

    app.dependency_overrides.clear()

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_approve_makes_rule_active(monkeypatch):
    app.dependency_overrides[knowledge.require_super_admin] = lambda: _FakeAdminContext()

    async def _fake_approve_rule(rule_id, payload, *, actor_user_id):
        assert rule_id == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        assert actor_user_id == "11111111-1111-1111-1111-111111111111"
        return {
            "id": rule_id,
            "key": "rule_key",
            "name": "Rule",
            "description": "desc",
            "input_entities": ["hba1c"],
            "conditions": {"all": [{"lab_marker": "hba1c", "operator": "gte", "value": 5.7, "unit": "%"}]},
            "outputs": {"risk": "possible_elevated_diabetes_risk"},
            "confidence": 0.8,
            "severity": "high",
            "requires_doctor": True,
            "explanation_template": "may indicate possible risk",
            "source": "placeholder",
            "source_url": "https://example.org/source",
            "governance_status": "active",
            "last_modified_by": "11111111-1111-1111-1111-111111111111",
            "medical_reviewed_by": payload["medical_reviewed_by"],
            "medical_reviewed_at": payload["medical_reviewed_at"],
            "change_note": payload["change_note"],
            "auto_update_allowed": False,
            "version": "v1",
            "active": True,
            "created_at": "2026-05-31T12:00:00Z",
            "updated_at": "2026-05-31T15:00:00Z",
        }

    monkeypatch.setattr(knowledge, "approve_rule", _fake_approve_rule)

    payload = {
        "medical_reviewed_by": "11111111-1111-1111-1111-111111111111",
        "medical_reviewed_at": "2026-05-31T15:00:00Z",
        "change_note": "approved",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/knowledge/rules/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/approve", json=payload)

    app.dependency_overrides.clear()

    assert resp.status_code == 200
    body = resp.json()
    assert body["governance_status"] == "active"
    assert body["active"] is True


def test_evaluator_uses_only_governance_active_rules():
    rules = [
        {
            "id": "rule-active",
            "key": "rule_active",
            "name": "Active rule",
            "description": "desc",
            "active": True,
            "governance_status": "active",
            "conditions": {"all": [{"lab_marker": "ferritin", "operator": "lt", "value": 30, "unit": "ng/mL"}]},
            "outputs": {"risk": "possible_risk", "summary": "possible risk", "recommendation_keys": ["rec1"]},
            "confidence": 0.7,
            "severity": "moderate",
            "requires_doctor": False,
            "explanation_template": "possible risk",
            "source": "placeholder",
            "source_url": "https://example.org/source",
        },
        {
            "id": "rule-reviewed",
            "key": "rule_reviewed",
            "name": "Reviewed rule",
            "description": "desc",
            "active": True,
            "governance_status": "reviewed",
            "conditions": {"all": [{"lab_marker": "ferritin", "operator": "lt", "value": 30, "unit": "ng/mL"}]},
            "outputs": {"risk": "possible_risk", "summary": "possible risk", "recommendation_keys": ["rec2"]},
            "confidence": 0.7,
            "severity": "moderate",
            "requires_doctor": False,
            "explanation_template": "possible risk",
            "source": "placeholder",
            "source_url": "https://example.org/source",
        },
    ]

    result = evaluate_input_with_rules(
        {
            "lab_results": {"ferritin": {"value": 18, "unit": "ng/mL"}},
            "symptoms": [],
        },
        rules,
    )

    assert len(result["matched_rules"]) == 1
    assert result["matched_rules"][0]["rule_key"] == "rule_active"


@pytest.mark.asyncio
async def test_create_rejects_confirmed_diagnosis_wording():
    app.dependency_overrides[knowledge.require_super_admin] = lambda: _FakeAdminContext()

    payload = _base_create_payload()
    payload["explanation_template"] = "Confirmed diagnosis of iron deficiency"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/knowledge/rules", json=payload)

    app.dependency_overrides.clear()

    assert resp.status_code == 400
    assert "confirmed diagnosis" in str(resp.json()).lower()
