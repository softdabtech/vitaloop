from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import get_current_user
from app.services.progress_overview import build_progress_overview
from app.services.supabase_service import get_user_progress

router = APIRouter()


@router.get("/overview")
async def get_progress_overview(
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    data = await get_user_progress(user_id)
    return build_progress_overview(data)


@router.get("")
async def get_progress(
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    data = await get_user_progress(user_id)
    return data
