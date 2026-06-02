import pytest

from app.services.biomarker_service import BiomarkerService


@pytest.mark.asyncio
async def test_check_freemium_biomarker_quota_uses_resolved_premium_entitlements(monkeypatch):
    async def fake_resolve_user_entitlements(user_id):
        assert user_id == "premium-user"
        return {"is_premium": True}

    monkeypatch.setattr(
        "app.services.biomarker_service.resolve_user_entitlements",
        fake_resolve_user_entitlements,
    )

    allowed, message, used_by = await BiomarkerService().check_freemium_biomarker_quota(
        "premium-user",
        "pdf",
    )

    assert allowed is True
    assert "Premium user" in message
    assert used_by is None
