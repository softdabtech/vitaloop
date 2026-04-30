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
