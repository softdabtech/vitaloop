from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


class TimelineEventCreate(BaseModel):
    event_type: str
    summary: str
    source: Optional[str] = "frontend"
    metadata: Optional[Dict[str, Any]] = None


@router.get("")
async def get_timeline(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return await svc.get_user_timeline(user_id)


@router.post("/event")
async def create_timeline_event(body: TimelineEventCreate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    await svc.save_timeline_event(
        user_id=user_id,
        event_type=body.event_type,
        summary=body.summary,
        source=body.source or "frontend",
        metadata=body.metadata or {},
    )
    return {"ok": True}
