from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


class LabPlanItemCreate(BaseModel):
    source_report_version_id: UUID
    test_name: str = Field(min_length=1, max_length=200)


@router.get("/items")
async def list_lab_plan_items(current_user: dict = Depends(get_current_user)):
    return await svc.get_lab_plan_items(current_user["sub"])


@router.post("/items", status_code=201)
async def create_lab_plan_item(
    body: LabPlanItemCreate,
    current_user: dict = Depends(get_current_user),
):
    try:
        return await svc.create_lab_plan_item(
            user_id=current_user["sub"],
            report_version_id=str(body.source_report_version_id),
            test_name=body.test_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
