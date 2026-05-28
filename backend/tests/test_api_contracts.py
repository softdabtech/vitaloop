import uuid
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.dependencies import get_current_user
from app.routers.analysis import dashboard as dashboard_router
from app.routers.billing import stripe_router as billing_router
from app.routers.identity import auth as auth_router
from app.routers.identity import onboarding as onboarding_router
from app.routers.protocol import questionnaire as questionnaire_router
from app.services import supabase_service as svc


@pytest.mark.asyncio
async def test_auth_me_contract_contains_entitlements(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_get_user_account(_user_id):
        return {
            "id": user_id,
            "email": "contract@example.com",
            "full_name": "Contract User",
            "global_role": "end_user",
            "sub_status": "free",
        }

    async def fake_get_user_profile(_user_id):
        return {"onboarding_complete": False}

    async def fake_entitlements(_user_id, _current_user):
        return {
            "is_premium": False,
            "billing_status": "free",
            "plan_key": "free",
            "has_active_subscription": False,
            "role": "end_user",
            "features": {"upload_limit": 1},
        }

    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(auth_router, "resolve_user_entitlements", fake_entitlements)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id, "email": "contract@example.com"}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/auth/me")
            assert response.status_code == 200
            data = response.json()
            assert "entitlements" in data
            assert isinstance(data["entitlements"].get("is_premium"), bool)
            assert "billing_status" in data["entitlements"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_auth_entitlements_contract(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_entitlements(_user_id, _current_user):
        return {
            "is_premium": True,
            "billing_status": "active",
            "plan_key": "personal",
            "has_active_subscription": True,
            "role": "end_user",
            "features": {"upload_limit": None},
        }

    monkeypatch.setattr(auth_router, "resolve_user_entitlements", fake_entitlements)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/auth/entitlements")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data.get("is_premium"), bool)
            assert "billing_status" in data
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_stripe_subscription_contract(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_entitlements(_user_id, _current_user):
        return {
            "billing_status": "active",
            "plan_key": "personal",
            "role": "end_user",
            "is_premium": True,
            "has_active_subscription": True,
            "cancel_at_period_end": False,
        }

    async def fake_upload_count(_user_id):
        return 2

    async def fake_active_sub(_user_id):
        return {
            "stripe_customer_id": "cus_123",
            "current_period_end": 9999999999,
        }

    monkeypatch.setattr(billing_router, "resolve_user_entitlements", fake_entitlements)
    monkeypatch.setattr(billing_router, "get_user_upload_count", fake_upload_count)
    monkeypatch.setattr(billing_router, "get_user_active_subscription", fake_active_sub)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/stripe/subscription")
            assert response.status_code == 200
            data = response.json()
            assert "sub_status" in data
            assert isinstance(data.get("is_premium"), bool)
            assert "upload_limit" in data
            assert "uploads_remaining" in data
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_questionnaire_session_contract(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_get_or_create(_user_id):
        return {"id": "sess_1", "status": "active", "session_metadata": {"active_concern": "energy"}}

    async def fake_answers(_session_id):
        return []

    monkeypatch.setattr(questionnaire_router, "_get_or_create_active_session", fake_get_or_create)
    monkeypatch.setattr(questionnaire_router, "_get_session_answers", fake_answers)
    async def fake_write_audit_log(**_kwargs):
        return None

    monkeypatch.setattr(svc, "write_audit_log", fake_write_audit_log)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/questionnaire/session")
            assert response.status_code == 200
            data = response.json()
            assert "session_context" in data
            assert "answered_count" in data
            assert "remaining_count" in data
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_questionnaire_session_context_patch_contract(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_get_or_create(_user_id):
        return {"id": "sess_2", "status": "active", "session_metadata": {}}

    async def fake_update(_session_id, _fields):
        return None

    monkeypatch.setattr(questionnaire_router, "_get_or_create_active_session", fake_get_or_create)
    monkeypatch.setattr(questionnaire_router, "_update_session", fake_update)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(
                "/questionnaire/session/context",
                json={"active_concern": "sleep", "summary": {"severity": 7}},
            )
            assert response.status_code == 200
            data = response.json()
            assert data.get("ok") is True
            assert "session_context" in data
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_dashboard_summary_contract(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_get_user_account(_user_id):
        return {
            "id": user_id,
            "email": "dashboard@example.com",
            "full_name": "Dash User",
            "global_role": "end_user",
        }

    async def fake_resolve_onboarding_state(_user_id, _current_user):
        return {
            "requires_onboarding": True,
            "current_stage": "profile",
            "current_stage_label": "Set up your profile",
            "checklist": {"onboarding_complete": False},
            "completion_pct": 0,
        }

    async def fake_get_progress(_user_id):
        return []

    async def fake_get_insights(_user_id):
        return []

    async def fake_health(_user_id):
        return None, 0, 0

    async def fake_assignments(_user_id, _role):
        return []

    async def fake_goals(_user_id):
        return 0

    async def fake_activity(_user_id):
        return None, None

    async def fake_upload_count(_user_id):
        return 0

    async def fake_entitlements(_user_id, _current_user):
        return {"billing_status": "free"}

    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(svc, "get_user_progress", fake_get_progress)
    monkeypatch.setattr(svc, "get_user_insights", fake_get_insights)
    monkeypatch.setattr(svc, "get_user_upload_count", fake_upload_count)
    monkeypatch.setattr(dashboard_router, "_resolve_onboarding_state", fake_resolve_onboarding_state)
    monkeypatch.setattr(dashboard_router, "_fetch_health_and_streak", fake_health)
    monkeypatch.setattr(dashboard_router, "_fetch_assignments", fake_assignments)
    monkeypatch.setattr(dashboard_router, "_fetch_user_goals", fake_goals)
    monkeypatch.setattr(dashboard_router, "_fetch_latest_activity", fake_activity)
    monkeypatch.setattr(dashboard_router, "resolve_user_entitlements", fake_entitlements)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id, "email": "dashboard@example.com"}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/dashboard/summary")
            assert response.status_code == 200
            data = response.json()
            assert "profile" in data
            assert "stats" in data
            assert "next_best_action" in data
            assert "subscription" in data["stats"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_onboarding_state_contract(monkeypatch):
    user_id = str(uuid.uuid4())

    async def fake_get_user_account(_user_id):
        return {"id": user_id, "global_role": "end_user"}

    async def fake_get_user_profile(_user_id):
        return {"onboarding_complete": False}

    async def fake_get_user_location(_user_id):
        return {}

    class _Q:
        def __init__(self, data):
            self._data = data

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(data=self._data)

    class _SB:
        def table(self, name):
            rows = {
                "recurring_complaints": [],
                "lab_uploads": [],
                "questionnaire_sessions": [],
            }
            return _Q(rows.get(name, []))

    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(svc, "get_user_location", fake_get_user_location)
    monkeypatch.setattr(svc, "_get_supabase", lambda: _SB())
    async def fake_write_audit_log(**_kwargs):
        return None

    monkeypatch.setattr(svc, "write_audit_log", fake_write_audit_log)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/auth/onboarding/state")
            assert response.status_code == 200
            data = response.json()
            assert "requires_onboarding" in data
            assert "current_stage" in data
            assert "checklist" in data
    finally:
        app.dependency_overrides.clear()
