from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID

from app.dependencies import get_current_user
from app.services.supabase_service import save_symptoms

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

    result = await save_symptoms(
        user_id=user_id,
        upload_id=str(request.upload_id) if request.upload_id else None,
        tags=request.tags,
        severity=request.severity,
    )
    return result
