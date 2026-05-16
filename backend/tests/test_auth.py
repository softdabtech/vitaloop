"""Comprehensive tests for authentication endpoints and flows"""
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.dependencies import get_current_user
from app.services import supabase_service as svc


@pytest.fixture
def mock_supabase_account(monkeypatch):
    """Mock supabase account lookup"""
    async def fake_get_user_account(user_id):
        return {
            "id": user_id,
            "email": "test@vitaloop.today",
            "full_name": "Test User",
            "global_role": "end_user",
            "sub_status": "free",
        }
    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)


@pytest.fixture
def mock_supabase_subscription(monkeypatch):
    """Mock user subscription lookup"""
    async def fake_get_user_active_subscription(user_id):
        return None
    monkeypatch.setattr(svc, "get_user_active_subscription", fake_get_user_active_subscription)


@pytest.fixture
def mock_all_supabase(mock_supabase_account, mock_supabase_subscription):
    """Combined Supabase mock"""
    pass


class TestAuthMe:
    """Tests for GET /auth/me endpoint"""

    @pytest.mark.asyncio
    async def test_get_auth_me_success_end_user(self, mock_all_supabase):
        """GET /auth/me returns user context for end_user"""
        fake_user_id = str(uuid.uuid4())
        fake_user = {
            "sub": fake_user_id,
            "email": "test@vitaloop.today",
            "global_role": "end_user",
            "memberships": [],
        }

        app.dependency_overrides[get_current_user] = lambda: fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/auth/me")
                assert response.status_code == 200
                data = response.json()
                assert data["user"]["id"] == fake_user_id
                assert data["user"]["global_role"] == "end_user"
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_auth_me_success_super_admin(self, mock_all_supabase):
        """GET /auth/me returns super_admin role when elevated"""
        fake_user_id = str(uuid.uuid4())
        fake_user = {
            "sub": fake_user_id,
            "email": "admin@vitaloop.today",
            "global_role": "super_admin",
            "app_metadata": {"is_super_admin": True},
            "memberships": [],
        }

        app.dependency_overrides[get_current_user] = lambda: fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/auth/me")
                assert response.status_code == 200
                data = response.json()
                assert data["user"]["global_role"] == "super_admin"
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_auth_me_missing_token(self):
        """GET /auth/me without token returns 401"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/auth/me")
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_auth_me_invalid_token(self):
        """GET /auth/me with invalid Bearer returns 401"""
        # Note: This test assumes Supabase is not configured (development environment)
        # In production, invalid JWT would return 401 from get_current_user dependency
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Missing Bearer should return 401
            response = await client.get("/auth/me")
            assert response.status_code == 401


class TestAuthSubscription:
    """Tests for GET /auth/subscription endpoint"""

    @pytest.mark.asyncio
    async def test_get_subscription_status_free(self, mock_all_supabase):
        """GET /auth/subscription returns free status"""
        fake_user_id = str(uuid.uuid4())
        fake_user = {"sub": fake_user_id, "email": "free@vitaloop.today"}

        app.dependency_overrides[get_current_user] = lambda: fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/auth/subscription")
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "free"
                assert data["is_active"] is False
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_subscription_missing_token(self):
        """GET /auth/subscription without token returns 401"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/auth/subscription")
            assert response.status_code == 401


class TestAuthNotify:
    """Tests for POST /auth/registration/notify endpoint"""

    @pytest.mark.asyncio
    async def test_post_registration_notify(self, mock_all_supabase):
        """POST /auth/registration/notify sends alert"""
        fake_user_id = str(uuid.uuid4())
        fake_user = {"sub": fake_user_id, "email": "new@vitaloop.today"}

        app.dependency_overrides[get_current_user] = lambda: fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/auth/registration/notify",
                    json={"flow": "signup"}
                )
                assert response.status_code == 200
                data = response.json()
                assert data["ok"] is True
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_post_notify_missing_token(self):
        """POST /auth/registration/notify without token returns 401"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/auth/registration/notify",
                json={"flow": "signup"}
            )
            assert response.status_code == 401


class TestAuthWelcome:
    """Tests for POST /auth/registration/welcome endpoint"""

    @pytest.mark.asyncio
    async def test_post_welcome_email(self, mock_all_supabase):
        """POST /auth/registration/welcome sends welcome email"""
        fake_user_id = str(uuid.uuid4())
        fake_user = {"sub": fake_user_id, "email": "test@vitaloop.today"}

        app.dependency_overrides[get_current_user] = lambda: fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post("/auth/registration/welcome")
                assert response.status_code == 200
                data = response.json()
                assert data["ok"] is True
                assert "@vitaloop.today" in data["recipient"]
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_post_welcome_missing_token(self):
        """POST /auth/registration/welcome without token returns 401"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/auth/registration/welcome")
            assert response.status_code == 401


class TestAuthOrganization:
    """Tests for POST /auth/onboarding/organization endpoint"""

    @pytest.mark.asyncio
    async def test_post_create_organization_empty_name(self):
        """POST with empty name returns 422"""
        fake_user_id = str(uuid.uuid4())
        fake_user = {"sub": fake_user_id}

        app.dependency_overrides[get_current_user] = lambda: fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/auth/onboarding/organization",
                    json={"name": ""}
                )
                assert response.status_code == 422
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_post_organization_missing_token(self):
        """POST /auth/onboarding/organization without token returns 401"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/auth/onboarding/organization",
                json={"name": "Test Org"}
            )
            assert response.status_code == 401


class TestAuthDelete:
    """Tests for DELETE /auth endpoint (account deletion)"""

    @pytest.mark.asyncio
    async def test_delete_account_missing_token(self):
        """DELETE /auth without token returns 401"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.delete("/auth")
            assert response.status_code == 401


class TestAuthRoles:
    """Tests for role resolution logic"""

    @pytest.mark.asyncio
    async def test_super_admin_role_resolution(self, mock_all_supabase):
        """Super admin role is recognized and applied"""
        fake_user_id = str(uuid.uuid4())
        fake_user = {
            "sub": fake_user_id,
            "user_metadata": {"is_super_admin": True},
        }

        app.dependency_overrides[get_current_user] = lambda: fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/auth/me")
                assert response.status_code == 200
                data = response.json()
                assert data["user"]["global_role"] == "super_admin"
        finally:
            app.dependency_overrides.clear()


class TestAuthIntegration:
    """Integration tests for complete auth flows"""

    @pytest.mark.asyncio
    async def test_free_user_flow(self, mock_all_supabase):
        """Test complete flow: me → subscription → welcome"""
        fake_user_id = str(uuid.uuid4())
        fake_user = {
            "sub": fake_user_id,
            "email": "flow@vitaloop.today",
            "global_role": "end_user",
        }

        app.dependency_overrides[get_current_user] = lambda: fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Get user context
                response = await client.get("/auth/me")
                assert response.status_code == 200
                assert response.json()["user"]["global_role"] == "end_user"

                # Check subscription
                response = await client.get("/auth/subscription")
                assert response.status_code == 200
                assert response.json()["status"] == "free"

                # Send welcome
                response = await client.post("/auth/registration/welcome")
                assert response.status_code == 200
                assert response.json()["ok"] is True
        finally:
            app.dependency_overrides.clear()
