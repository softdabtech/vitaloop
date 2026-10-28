from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


@router.get("")
async def get_red_flags(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return await svc.get_user_red_flags(user_id)


@router.post("/{flag_id}/acknowledge")
async def acknowledge_flag(flag_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return await svc.acknowledge_red_flag(user_id, flag_id)
