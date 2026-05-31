import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.dependencies import get_current_user
from app.routers import knowledge
from app.services.knowledge import evaluator


@pytest.mark.asyncio
async def test_evaluate_health_input_adds_safety_alert_and_requires_doctor(monkeypatch):
    async def _fake_load_active_rules():
        return [
            {
                "id": "rule-1",
                "key": "rule_high_hba1c",
                "name": "High HbA1c",
                "description": "desc",
                "input_entities": ["hba1c"],
                "conditions": {"all": [{"lab_marker": "hba1c", "operator": "gte", "value": 5.7, "unit": "%"}]},
                "outputs": {
                    "risk": "possible_elevated_diabetes_risk",
                    "summary": "possible risk",
                    "recommendation_keys": ["hba1c_medical_review"],
                },
                "confidence": 0.8,
                "severity": "high",
                "requires_doctor": True,
                "explanation_template": "HbA1c may indicate possible risk",
                "source": "guideline",
                "source_url": "https://example.org/guideline",
                "active": True,
                "governance_status": "active",
            }
        ]

    async def _fake_load_recommendations(_keys):
        return {
            "hba1c_medical_review": {
                "key": "hba1c_medical_review",
                "title": "Medical review",
                "body": "May indicate elevated risk, requires medical review",
                "category": "metabolic",
                "priority": "high",
                "requires_doctor": True,
                "evidence_level": "high",
                "source": "guideline",
                "source_url": "https://example.org/guideline",
            }
        }

    async def _fake_persist(*_args, **_kwargs):
        return "eval-1"

    async def _fake_audit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(evaluator, "_load_active_rules", _fake_load_active_rules)
    monkeypatch.setattr(evaluator, "_load_recommendations", _fake_load_recommendations)
    monkeypatch.setattr(evaluator, "_persist_rule_evaluation", _fake_persist)
    monkeypatch.setattr(evaluator, "_audit_medical_output", _fake_audit)

    payload = {
        "lab_results": {
            "hba1c": {"value": 9.2, "unit": "%"},
            "glucose": {"value": 320, "unit": "mg/dL"},
        },
        "symptoms": [],
        "context": {"data_age_days": 10},
    }

    result = await evaluator.evaluate_health_input(payload, user_id="11111111-1111-1111-1111-111111111111", persist=True)

    assert result["requires_doctor"] is True
    assert result["safety_alerts"]
    assert result["confidence"] > 0
    assert result["rule_evaluation_ids"] == ["eval-1"]


@pytest.mark.asyncio
async def test_knowledge_evaluate_endpoint(monkeypatch):
    async def _fake_evaluate_health_input(_payload, *, user_id=None, persist=True):
        assert user_id == "11111111-1111-1111-1111-111111111111"
        assert persist is True
        return {
            "matched_rules": [],
            "generated_recommendations": [],
            "requires_doctor": False,
            "confidence": 0.0,
            "max_confidence": 0.0,
            "source_references": [],
            "safety_alerts": [],
            "rule_evaluation_ids": [],
        }

    app.dependency_overrides[get_current_user] = lambda: {"sub": "11111111-1111-1111-1111-111111111111"}
    monkeypatch.setattr(knowledge, "evaluate_health_input", _fake_evaluate_health_input)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(
            "/knowledge/evaluate",
            json={
                "lab_results": {"ferritin": {"value": 18, "unit": "ng/mL"}},
                "symptoms": ["fatigue"],
                "context": {"data_age_days": 10},
            },
        )

    app.dependency_overrides.clear()

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["requires_doctor"] is False
    assert payload["matched_rules"] == []
