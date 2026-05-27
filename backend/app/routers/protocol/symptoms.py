from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID

from app.dependencies import get_current_user
from app.services.supabase_service import (
    save_symptoms,
    assert_upload_belongs_to_user,
    get_user_symptom_summary,
    get_platform_symptom_summary,
)
from app.services import supabase_service as svc

router = APIRouter()


class SymptomsRequest(BaseModel):
    upload_id: Optional[UUID] = None
    tags: List[str] = Field(..., min_length=1)
    severity: int = Field(default=5, ge=1, le=10)


@router.post("")
async def record_symptoms(
    request: SymptomsRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id: str = current_user["sub"]
    upload_id = str(request.upload_id) if request.upload_id else None

    if upload_id:
        await assert_upload_belongs_to_user(upload_id, user_id)

    result = await save_symptoms(
        user_id=user_id,
        upload_id=upload_id,
        tags=request.tags,
        severity=request.severity,
    )
    return result


@router.get("/summary")
async def symptom_summary(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
):
    safe_days = max(1, min(days, 365))
    user_id: str = current_user["sub"]
    return await get_user_symptom_summary(user_id=user_id, days=safe_days)


@router.get("/summary/all")
async def platform_symptom_summary(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
):
    app_meta = current_user.get("app_metadata") or {}
    is_super_admin = bool(app_meta.get("is_super_admin") or app_meta.get("global_role") == "super_admin")

    if not is_super_admin:
        try:
            account = await svc.get_user_account(current_user.get("sub"))
            is_super_admin = bool(account and account.get("global_role") == "super_admin")
        except Exception:
            is_super_admin = False

    if not is_super_admin:
        raise HTTPException(status_code=403, detail={"detail": "Access denied", "code": "ACCESS_DENIED"})

    safe_days = max(1, min(days, 365))
    return await get_platform_symptom_summary(days=safe_days)
