from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


class ComplaintCreate(BaseModel):
    complaint: str
    duration_description: Optional[str] = None
    tried_interventions: Optional[str] = None


@router.get("")
async def list_complaints(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return await svc.get_complaints(user_id)


@router.post("")
async def create_complaint(body: ComplaintCreate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return await svc.add_complaint(user_id, body.complaint, body.duration_description, body.tried_interventions)


@router.delete("/{complaint_id}")
async def remove_complaint(complaint_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    await svc.delete_complaint(user_id, complaint_id)
    return {"ok": True}
