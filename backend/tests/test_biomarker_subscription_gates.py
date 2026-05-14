import types

import pytest

from app.services.biomarker_service import BiomarkerService
from app.services import supabase_service as svc


@pytest.mark.asyncio
async def test_check_freemium_limit_treats_sub_status_active_as_premium(monkeypatch):
    service = BiomarkerService()

    async def fake_get_user_account(_user_id):
        return {"sub_status": "active", "global_role": "end_user"}

    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)

    can_proceed, message = await service.check_freemium_limit("u-1")

    assert can_proceed is True
    assert "Premium user" in message


@pytest.mark.asyncio
async def test_check_freemium_quota_treats_sub_status_active_as_premium(monkeypatch):
    service = BiomarkerService()

    async def fake_get_user_account(_user_id):
        return {"sub_status": "active", "global_role": "end_user"}

    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)

    can_proceed, message, used_by = await service.check_freemium_biomarker_quota("u-1", "pdf")

    assert can_proceed is True
    assert "Premium user" in message
    assert used_by is None


@pytest.mark.asyncio
async def test_check_freemium_quota_blocks_second_method_for_free_user(monkeypatch):
    service = BiomarkerService()

    async def fake_get_user_account(_user_id):
        return {"sub_status": "free", "global_role": "end_user"}

    async def fake_run(_callable):
        return types.SimpleNamespace(data=[{"id": "up-1", "analyze_prompt_version": "manual_v1"}])

    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(svc, "_get_supabase", lambda: object())
    monkeypatch.setattr(svc, "_run", fake_run)

    can_proceed, message, used_by = await service.check_freemium_biomarker_quota("u-1", "pdf")

    assert can_proceed is False
    assert used_by == "manual"
    assert "Upgrade to Premium" in message


@pytest.mark.asyncio
async def test_check_freemium_quota_non_end_user_bypasses_limits(monkeypatch):
    service = BiomarkerService()

    async def fake_get_user_account(_user_id):
        return {"sub_status": "free", "global_role": "practitioner"}

    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)

    can_proceed, message, used_by = await service.check_freemium_biomarker_quota("u-1", "pdf")

    assert can_proceed is True
    assert "Premium user" in message
    assert used_by is None
