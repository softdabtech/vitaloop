from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


class CheckinCreate(BaseModel):
    week_start: str  # ISO date e.g. "2026-04-07"
    energy_score: Optional[int] = Field(default=None, ge=1, le=10)
    sleep_quality: Optional[int] = Field(default=None, ge=1, le=10)
    mood_score: Optional[int] = Field(default=None, ge=1, le=10)
    symptom_changes: Optional[str] = None
    protocol_adherence: Optional[int] = Field(default=None, ge=1, le=10)
    new_complaints: Optional[str] = None
    notes: Optional[str] = None


@router.post("")
async def submit_checkin(body: CheckinCreate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    return await svc.submit_weekly_checkin(user_id, data)


@router.get("/history")
async def checkin_history(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return await svc.get_weekly_checkins(user_id)
