import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.routers.monitoring import router as monitoring_router
from app.services import ops_alerts


def test_ops_alert_daily_limit(monkeypatch, tmp_path):
    state_file = tmp_path / "ops_alerts.json"
    monkeypatch.setattr(ops_alerts.settings, "ops_alerts_enabled", True)
    monkeypatch.setattr(ops_alerts.settings, "ops_alert_email", "info@softdab.tech")
    monkeypatch.setattr(ops_alerts.settings, "ops_alerts_max_emails_per_day", 2)
    monkeypatch.setattr(ops_alerts.settings, "ops_alert_state_file", str(state_file))

    assert ops_alerts.can_send_ops_alert() is True
    assert ops_alerts._record_sent() == 1
    assert ops_alerts.can_send_ops_alert() is True
    assert ops_alerts._record_sent() == 2
    assert ops_alerts.can_send_ops_alert() is False


@pytest.mark.asyncio
async def test_send_ops_alert_suppressed_after_limit(monkeypatch, tmp_path):
    state_file = tmp_path / "ops_alerts.json"
    monkeypatch.setattr(ops_alerts.settings, "ops_alerts_enabled", True)
    monkeypatch.setattr(ops_alerts.settings, "ops_alert_email", "info@softdab.tech")
    monkeypatch.setattr(ops_alerts.settings, "ops_alerts_max_emails_per_day", 1)
    monkeypatch.setattr(ops_alerts.settings, "ops_alert_state_file", str(state_file))

    with patch("app.services.ops_alerts._deliver_html_email", new_callable=AsyncMock) as deliver:
        deliver.return_value = True
        first = await ops_alerts.send_ops_alert(code="TEST", title="Test alert")
        second = await ops_alerts.send_ops_alert(code="TEST_2", title="Second alert")

    assert first is True
    assert second is False
    deliver.assert_called_once()


def test_frontend_event_endpoint_logs_without_email():
    app = FastAPI()
    app.include_router(monitoring_router)
    client = TestClient(app)

    with patch("app.routers.monitoring.send_ops_alert", new_callable=AsyncMock) as send_alert:
        response = client.post(
            "/monitoring/frontend-event",
            json={"type": "route_view", "route": "/dashboard", "locale": "en"},
        )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    send_alert.assert_not_called()


def test_frontend_api_500_error_triggers_email_alert():
    app = FastAPI()
    app.include_router(monitoring_router)
    client = TestClient(app)

    with patch("app.routers.monitoring.send_ops_alert", new_callable=AsyncMock) as send_alert:
        send_alert.return_value = True
        response = client.post(
            "/monitoring/frontend-error",
            json={
                "type": "api_error",
                "severity": "error",
                "code": "API_500",
                "message": "Request failed",
                "route": "/upload",
                "endpoint": "/analyze/pdf",
                "method": "POST",
                "status": 500,
            },
        )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    send_alert.assert_awaited_once()


def test_frontend_api_402_error_is_logged_without_email():
    app = FastAPI()
    app.include_router(monitoring_router)
    client = TestClient(app)

    with patch("app.routers.monitoring.send_ops_alert", new_callable=AsyncMock) as send_alert:
        response = client.post(
            "/monitoring/frontend-error",
            json={
                "type": "api_error",
                "severity": "warning",
                "code": "BIOMARKER_QUOTA_EXCEEDED",
                "message": "Quota exceeded",
                "route": "/upload",
                "endpoint": "/analyze/pdf",
                "method": "POST",
                "status": 402,
            },
        )

    assert response.status_code == 200
    send_alert.assert_not_called()
