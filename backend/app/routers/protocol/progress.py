from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import get_current_user
from app.services.supabase_service import get_user_progress

router = APIRouter()


@router.get("")
async def get_progress(
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    data = await get_user_progress(user_id)
    return data
