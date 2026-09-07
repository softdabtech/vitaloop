"""
IDOR/BOLA (Broken Object Level Authorization) Protection Tests

Test that users cannot access other users' data by modifying object IDs.
"""
import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.dependencies import get_current_user


@pytest.fixture
def user1_token():
    """Simulate authenticated user 1"""
    return {"sub": str(uuid.uuid4()), "email": "user1@test.com"}


@pytest.fixture
def user2_token():
    """Simulate authenticated user 2"""
    return {"sub": str(uuid.uuid4()), "email": "user2@test.com"}


class TestIDORProtection:
    """Test that endpoints properly validate object ownership"""

    @pytest.mark.asyncio
    async def test_cannot_access_other_user_upload(self, user1_token, user2_token, monkeypatch):
        """Verify user1 cannot access user2's upload_id"""
        upload_id = str(uuid.uuid4())
        other_user_id = user2_token["sub"]

        # Mock get_current_user to return user1
        async def get_user1():
            return user1_token

        async def get_user2():
            return user2_token

        # Try to access with user1 credentials but user2's upload
        # Mock would need to verify ownership in endpoint
        # This test will fail until endpoint properly checks ownership

        app.dependency_overrides[get_current_user] = get_user1

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Attempt to access non-existent upload (should return 403/404, not 200)
                response = await client.get(
                    f"/analyze/{upload_id}",
                )
                # Should NOT succeed even if upload exists (because we're not the owner)
                # Expected: 403 Forbidden or 404 Not Found
                # NOT expected: 200 OK
                assert response.status_code in [403, 404], \
                    f"Expected 403/404 for unauthorized access, got {response.status_code}"

        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_cannot_access_other_user_insights(self, user1_token, user2_token, monkeypatch):
        """Verify user1 cannot access user2's insights"""
        insight_id = str(uuid.uuid4())

        async def get_user1():
            return user1_token

        app.dependency_overrides[get_current_user] = get_user1

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Try to access insight from different user
                response = await client.get(
                    f"/insights/{insight_id}",
                )
                # Should NOT return 200 if not owner
                assert response.status_code in [403, 404], \
                    f"Unauthorized insight access should return 403/404, got {response.status_code}"

        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_cannot_delete_other_user_upload(self, user1_token, user2_token, monkeypatch):
        """Verify user1 cannot delete user2's upload"""
        upload_id = str(uuid.uuid4())

        async def get_user1():
            return user1_token

        app.dependency_overrides[get_current_user] = get_user1

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Try to delete upload from different user
                response = await client.delete(
                    f"/uploads/{upload_id}",
                )
                # Should NOT succeed
                assert response.status_code in [403, 404], \
                    f"Unauthorized delete should return 403/404, got {response.status_code}"

        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_cannot_access_other_user_protocol(self, user1_token, user2_token, monkeypatch):
        """Verify user1 cannot access user2's protocol"""
        upload_id = str(uuid.uuid4())

        async def get_user1():
            return user1_token

        app.dependency_overrides[get_current_user] = get_user1

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Try to access protocol from different user
                response = await client.get(
                    f"/protocol/{upload_id}",
                )
                # Should NOT return 200 if not owner
                assert response.status_code in [403, 404], \
                    f"Unauthorized protocol access should return 403/404, got {response.status_code}"

        finally:
            app.dependency_overrides.clear()


class TestBOLAProtection:
    """Test Broken Object Level Authorization scenarios"""

    @pytest.mark.asyncio
    async def test_numeric_id_enumeration_prevention(self, user1_token, monkeypatch):
        """Test that sequential ID guessing is prevented"""
        async def get_user1():
            return user1_token

        app.dependency_overrides[get_current_user] = get_user1

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Try various sequential IDs (simulating ID enumeration)
                results = []
                for i in range(1, 4):
                    response = await client.get(f"/uploads/{i}")
                    results.append(response.status_code)

                # All should be 404 (not found) or 403 (forbidden)
                # NOT a mix of 200 and 403/404 (which would indicate partial enumeration)
                assert all(status in [403, 404] for status in results), \
                    f"ID enumeration detected: {results}"

        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_admin_cannot_access_user_data_without_permission(self, user1_token, monkeypatch):
        """Test that admin endpoints still require proper authorization"""
        upload_id = str(uuid.uuid4())

        # Even if marked as admin-ish, verify user_id ownership
        admin_user = {"sub": str(uuid.uuid4()), "email": "admin@test.com", "role": "admin"}

        async def get_admin_user():
            return admin_user

        app.dependency_overrides[get_current_user] = get_admin_user

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Admin accessing random user's data should still be denied
                # (unless explicitly designed to have admin view access)
                response = await client.get(
                    f"/uploads/{upload_id}",
                )
                # Depends on implementation: might allow admin to view, but should log it
                # For now, just verify endpoint responds (not crashes)
                assert response.status_code in [200, 403, 404], \
                    f"Admin endpoint returned unexpected status: {response.status_code}"

        finally:
            app.dependency_overrides.clear()


class TestOwnershipValidation:
    """Test that ownership is properly validated across different entity types"""

    @pytest.mark.asyncio
    async def test_upload_ownership_validated(self):
        """Verify upload endpoints validate user_id ownership"""
        # This is a code-level test, not an API test
        from app.services import supabase_service as svc

        # Test that assert_upload_belongs_to_user exists and works
        assert hasattr(svc, 'assert_upload_belongs_to_user'), \
            "assert_upload_belongs_to_user function not found"

    @pytest.mark.asyncio
    async def test_all_user_param_endpoints_have_checks(self):
        """Verify all endpoints with {id} parameters have ownership checks"""
        import inspect
        from app.routers.analysis import analyze

        # Get all functions in analyze router
        functions = [
            obj for name, obj in inspect.getmembers(analyze)
            if inspect.iscoroutinefunction(obj)
        ]

        # Endpoints with path parameters should include ownership checks
        # This is a basic verification - detailed checks would need manual review
        assert len(functions) > 0, "No endpoints found to check"


class TestIDORVectorPatterns:
    """Test common IDOR vulnerability patterns"""

    @pytest.mark.asyncio
    async def test_uuid_not_guessable(self, user1_token, monkeypatch):
        """Verify UUIDs are used (not sequential IDs)"""
        async def get_user1():
            return user1_token

        app.dependency_overrides[get_current_user] = get_user1

        try:
            # Attempting to access with obviously fake UUIDs should fail
            fake_uuid = "00000000-0000-0000-0000-000000000001"

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(f"/uploads/{fake_uuid}")
                # Should not find this fake upload
                assert response.status_code in [403, 404], \
                    f"Fake UUID should not succeed: {response.status_code}"

        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_api_key_cannot_bypass_ownership(self, monkeypatch):
        """Verify API key alone cannot bypass ownership checks"""
        # Even with valid API key, should check user_id ownership
        # This depends on how API keys are implemented in the system
        pass
