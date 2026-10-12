import pytest
from fastapi import HTTPException

from app.routers import lab_plan as router


def _user(sub="user-1"):
    return {"sub": sub}


@pytest.mark.asyncio
async def test_list_lab_plan_items_scopes_to_current_user(monkeypatch):
    captured = {}

    async def fake_list(user_id):
        captured["user_id"] = user_id
        return [{"user_id": user_id}]

    monkeypatch.setattr(router.svc, "get_lab_plan_items", fake_list)

    result = await router.list_lab_plan_items(_user("user-1"))

    assert captured["user_id"] == "user-1"
    assert result == [{"user_id": "user-1"}]


@pytest.mark.asyncio
async def test_create_lab_plan_item_derives_fields_server_side(monkeypatch):
    captured = {}

    async def fake_create(**kwargs):
        captured.update(kwargs)
        return {"id": "item-1", "test_type": "retest", "reason": "Repeat it"}

    monkeypatch.setattr(router.svc, "create_lab_plan_item", fake_create)

    body = router.LabPlanItemCreate(
        source_report_version_id="11111111-1111-1111-1111-111111111111",
        test_name="Ferritin",
    )
    result = await router.create_lab_plan_item(body, _user("user-1"))

    assert captured == {
        "user_id": "user-1",
        "report_version_id": "11111111-1111-1111-1111-111111111111",
        "test_name": "Ferritin",
        "source_recommendation_id": None,
    }
    assert result["test_type"] == "retest"


@pytest.mark.asyncio
async def test_create_lab_plan_item_rejects_unknown_or_foreign_report(monkeypatch):
    async def fake_create(**_kwargs):
        raise ValueError("Report version not found")

    monkeypatch.setattr(router.svc, "create_lab_plan_item", fake_create)
    body = router.LabPlanItemCreate(
        source_report_version_id="11111111-1111-1111-1111-111111111111",
        test_name="Unknown",
    )

    with pytest.raises(HTTPException) as exc_info:
        await router.create_lab_plan_item(body, _user("user-1"))

    assert exc_info.value.status_code == 404
