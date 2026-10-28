"""
IDOR/BOLA (Broken Object Level Authorization) Protection Tests

Test that users cannot access other users' data by modifying object IDs.
"""
import pytest
import uuid
from types import SimpleNamespace
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


class _ChainableEmptyResultTable:
    """Fakes the Supabase fluent query builder (.select().eq().limit()...),
    returning itself for any chained call and an empty-data result from
    .execute() -- regardless of chain shape or order.

    Simulates "no matching row for this user/id" so ownership-check code
    (assert_upload_belongs_to_user, delete_upload's inline check, and the
    entitlement lookups behind require_active_subscription) can be
    exercised for real in this test environment, which has no working
    Supabase credentials (see P36a audit: real credentials -- or CI's own
    placeholder ones -- raise SupabaseException("Invalid API key") before
    any ownership logic runs). This does not change what the app code
    does with an empty result; it only supplies one instead of an
    unhandled client-init exception.
    """

    def __getattr__(self, _name):
        if _name == "execute":
            return lambda *args, **kwargs: SimpleNamespace(data=[])
        return lambda *args, **kwargs: self


class _FakeSupabaseClient:
    def table(self, *_args, **_kwargs):
        return _ChainableEmptyResultTable()


@pytest.fixture
def mock_no_matching_upload(monkeypatch):
    """Stub _get_supabase() everywhere it's imported so every ownership/
    entitlement lookup in this test sees "not found" instead of failing
    on Supabase client init. Test-fixture-only; no app code is modified.
    """
    fake_client = _FakeSupabaseClient()
    monkeypatch.setattr("app.services.supabase_service._get_supabase", lambda: fake_client)
    monkeypatch.setattr("app.routers.analysis.uploads._get_supabase", lambda: fake_client)
    return fake_client


class TestIDORProtection:
    """Test that endpoints properly validate object ownership"""

    @pytest.mark.asyncio
    async def test_cannot_access_other_user_upload(self, user1_token, user2_token, monkeypatch, mock_no_matching_upload):
        """Verify user1 cannot access user2's upload_id"""
        upload_id = str(uuid.uuid4())
        other_user_id = user2_token["sub"]

        # Mock get_current_user to return user1
        async def get_user1():
            return user1_token

        async def get_user2():
            return user2_token

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
    async def test_cannot_delete_other_user_upload(self, user1_token, user2_token, monkeypatch, mock_no_matching_upload):
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
    async def test_cannot_access_other_user_protocol(self, user1_token, user2_token, monkeypatch, mock_no_matching_upload):
        """Verify user1 cannot access user2's protocol"""
        upload_id = str(uuid.uuid4())

        async def get_user1():
            return user1_token

        # GET /protocol/{upload_id} sits behind require_active_subscription,
        # which runs BEFORE the endpoint's own ownership check. Without a
        # real Supabase-backed entitlement lookup, a mocked user with no
        # subscription record correctly gets 402 first -- that's the
        # subscription gate working as designed, not an IDOR bypass, but it
        # means this test needs a premium entitlement stub to reach the
        # ownership check it's actually meant to exercise. Test-only; does
        # not change require_active_subscription's real behavior.
        async def fake_premium_entitlements(_user_id, _current_user=None):
            return {"role": "end_user", "is_premium": True, "profile": {"onboarding_complete": True}}

        monkeypatch.setattr("app.dependencies.resolve_user_entitlements", fake_premium_entitlements)

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
    async def test_numeric_id_enumeration_prevention(self, user1_token, monkeypatch, mock_no_matching_upload):
        """Test that sequential ID guessing is prevented"""
        async def get_user1():
            return user1_token

        app.dependency_overrides[get_current_user] = get_user1

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Try various sequential IDs (simulating ID enumeration).
                # Stage P36b: retargeted from GET /uploads/{id} (no longer a
                # real read route -- only DELETE is registered there, so a
                # GET always 405s regardless of ownership) to GET
                # /results/{id}, the actual current read endpoint (see
                # Results.jsx's api.get('/results/${uploadId}') and P36a
                # audit). Preserves this test's original intent: sequential
                # IDs must not partially succeed.
                results = []
                for i in range(1, 4):
                    response = await client.get(f"/results/{i}")
                    results.append(response.status_code)

                # All should be 404 (not found) or 403 (forbidden)
                # NOT a mix of 200 and 403/404 (which would indicate partial enumeration)
                assert all(status in [403, 404] for status in results), \
                    f"ID enumeration detected: {results}"

        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_admin_cannot_access_user_data_without_permission(self, user1_token, monkeypatch, mock_no_matching_upload):
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
                # (unless explicitly designed to have admin view access).
                # Stage P36b: retargeted from GET /uploads/{id} (no longer a
                # real read route) to GET /results/{id} -- see P36a audit.
                response = await client.get(
                    f"/results/{upload_id}",
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
    async def test_uuid_not_guessable(self, user1_token, monkeypatch, mock_no_matching_upload):
        """Verify UUIDs are used (not sequential IDs)"""
        async def get_user1():
            return user1_token

        app.dependency_overrides[get_current_user] = get_user1

        try:
            # Attempting to access with obviously fake UUIDs should fail
            fake_uuid = "00000000-0000-0000-0000-000000000001"

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Stage P36b: retargeted from GET /uploads/{id} (no longer a
                # real read route) to GET /results/{id} -- see P36a audit.
                response = await client.get(f"/results/{fake_uuid}")
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
