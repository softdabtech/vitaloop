from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


@router.get("")
async def get_timeline(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return await svc.get_user_timeline(user_id)
