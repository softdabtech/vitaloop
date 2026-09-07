"""Tests for GDPR user deletion cascade functionality."""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.dependencies import get_current_user
from app.services import supabase_service as svc


@pytest.mark.asyncio
async def test_delete_user_cascade_removes_all_data(monkeypatch):
    """Verify that delete_user_cascade removes user and all associated data."""
    user_id = str(uuid.uuid4())

    # Mock Supabase client
    class MockTable:
        def __init__(self, table_name):
            self.table_name = table_name
            self.deleted_records = []

        def delete(self):
            return self

        def eq(self, field, value):
            # Simulate deleting records where field == value
            if field == "user_id" and value == user_id:
                self.deleted_records.append(self.table_name)
            return self

        def execute(self):
            class Result:
                def __init__(self, table_name):
                    self.data = [{"id": "record_1"}, {"id": "record_2"}]
                    self.table_name = table_name
            return Result(self.table_name)

    class MockSupabase:
        def __init__(self):
            self.deleted_tables = []

        def table(self, table_name):
            self.deleted_tables.append(table_name)
            return MockTable(table_name)

    mock_supabase = MockSupabase()
    deleted_tables = []

    # Track which tables get deleted (must be sync, not async)
    def fake_get_supabase():
        return mock_supabase

    # Mock write_audit_log to avoid it trying to insert
    async def fake_write_audit_log(**kwargs):
        pass

    monkeypatch.setattr(svc, "_get_supabase", fake_get_supabase)
    monkeypatch.setattr(svc, "write_audit_log", fake_write_audit_log)

    # Run the deletion
    await svc.delete_user_cascade(user_id)

    # Verify all expected tables were targeted for deletion
    expected_tables = [
        "insights",
        "recommendations",
        "biomarkers",
        "lab_uploads",
        "weekly_checkins",
        "protocols",
        "audit_logs",
        "user_preferences",
        "notification_preferences",
        "users",
    ]

    assert mock_supabase.deleted_tables == expected_tables, \
        f"Expected to delete from {expected_tables}, got {mock_supabase.deleted_tables}"


@pytest.mark.asyncio
async def test_delete_account_endpoint_requires_confirmation(monkeypatch):
    """Verify that DELETE /settings/delete-account requires explicit confirmation."""
    user_id = str(uuid.uuid4())

    # Override dependency
    async def fake_get_current_user():
        return {"sub": user_id, "user_metadata": {}}

    app.dependency_overrides[get_current_user] = fake_get_current_user

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Test with wrong confirmation text
            response = await client.post(
                "/settings/delete-account",
                json={"confirmation": "WRONG TEXT"},
            )
            assert response.status_code == 400
            assert "must be exactly" in response.json()["detail"].lower()

            # Test with correct confirmation (should still fail since we're mocking)
            # This is fine - we're just testing that the endpoint validates input

    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_delete_account_endpoint_requires_auth(monkeypatch):
    """Verify that DELETE /settings/delete-account requires authentication."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Call without auth header
        response = await client.post(
            "/settings/delete-account",
            json={"confirmation": "DELETE MY ACCOUNT"},
        )
        # Should be 401 (Unauthorized) or 403 (Forbidden)
        assert response.status_code in [401, 403]


@pytest.mark.asyncio
async def test_delete_cascade_audit_log_created(monkeypatch):
    """Verify that audit log is created during user deletion."""
    user_id = str(uuid.uuid4())
    audit_log_created = {"called": False, "data": None}

    # Mock write_audit_log
    original_audit = svc.write_audit_log
    async def fake_write_audit_log(**kwargs):
        audit_log_created["called"] = True
        audit_log_created["data"] = kwargs

    # Mock delete operation
    class MockTable:
        def delete(self):
            return self
        def eq(self, field, value):
            return self
        def execute(self):
            class Result:
                data = []
            return Result()

    class MockSupabase:
        def table(self, table_name):
            return MockTable()

    def fake_get_supabase():
        return MockSupabase()

    monkeypatch.setattr(svc, "write_audit_log", fake_write_audit_log)
    monkeypatch.setattr(svc, "_get_supabase", fake_get_supabase)

    # Run deletion
    await svc.delete_user_cascade(user_id)

    # Verify audit log was created
    assert audit_log_created["called"], "Audit log should be created"
    assert audit_log_created["data"]["action"] == "delete"
    assert audit_log_created["data"]["entity_type"] == "user_account"
    assert audit_log_created["data"]["user_id"] == user_id
