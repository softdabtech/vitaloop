from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.services.supabase_service import get_admin_overview

router = APIRouter()


def _require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    user_meta = current_user.get("user_metadata") or {}
    app_meta = current_user.get("app_metadata") or {}
    is_super_admin = user_meta.get("is_super_admin") or app_meta.get("is_super_admin")
    if not is_super_admin:
        raise HTTPException(
            status_code=403,
            detail={"detail": "Access denied", "code": "ACCESS_DENIED"},
        )
    return current_user


@router.get("/overview")
async def admin_overview(current_user: dict = Depends(_require_super_admin)):
    return await get_admin_overview()
