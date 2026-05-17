import pytest

from app.services import supabase_service as svc


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, data):
        self._data = data

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return _Resp(self._data)


class _Supabase:
    def __init__(self, data):
        self._data = data

    def table(self, _name):
        return _Query(self._data)


@pytest.mark.asyncio
async def test_assert_upload_belongs_to_user_returns_row(monkeypatch):
    expected = {"id": "upload-1", "user_id": "user-1"}

    monkeypatch.setattr(svc, "_get_supabase", lambda: _Supabase([expected]))

    async def fake_run(callable_):
        return callable_()

    monkeypatch.setattr(svc, "_run", fake_run)

    row = await svc.assert_upload_belongs_to_user("upload-1", "user-1")
    assert row == expected


@pytest.mark.asyncio
async def test_get_user_account_falls_back_when_plan_tier_missing(monkeypatch):
    calls = []

    async def fake_select(table, columns, user_id):
        calls.append(columns)
        if "plan_tier" in columns:
            return {}
        return {
            "id": user_id,
            "email": "user@example.com",
            "full_name": "User",
            "subscription_status": "free",
            "global_role": "end_user",
            "created_at": "2026-01-01T00:00:00Z",
        }

    monkeypatch.setattr(svc, "_select_first_by_id_with_fallback", fake_select)

    account = await svc.get_user_account("11111111-1111-1111-1111-111111111111")

    assert len(calls) == 2
    assert "plan_tier" in calls[0]
    assert "subscription_status" in calls[1]
    assert account.get("sub_status") == "free"


@pytest.mark.asyncio
async def test_get_user_account_returns_primary_when_available(monkeypatch):
    async def fake_select(_table, _columns, user_id):
        return {
            "id": user_id,
            "email": "user@example.com",
            "full_name": "User",
            "sub_status": "active",
            "plan_tier": "personal",
            "global_role": "end_user",
            "created_at": "2026-01-01T00:00:00Z",
        }

    monkeypatch.setattr(svc, "_select_first_by_id_with_fallback", fake_select)

    account = await svc.get_user_account("11111111-1111-1111-1111-111111111111")
    assert account.get("sub_status") == "active"
    assert account.get("plan_tier") == "personal"
