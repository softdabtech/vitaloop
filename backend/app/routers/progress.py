from fastapi import APIRouter, HTTPException
from app.services.supabase_service import get_user_progress

router = APIRouter()


@router.get("/{user_id}")
async def get_progress(user_id: str):
    data = await get_user_progress(user_id)
    if not data:
        raise HTTPException(status_code=404, detail="No progress data found.")
    return data
