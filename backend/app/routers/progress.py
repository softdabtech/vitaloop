from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import get_current_user
from app.services.supabase_service import get_user_progress

router = APIRouter()


@router.get("/{user_id}")
async def get_progress(
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    # Users can only access their own progress
    if current_user.get("sub") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    data = await get_user_progress(user_id)
    if not data:
        raise HTTPException(status_code=404, detail="No progress data found.")
    return data
