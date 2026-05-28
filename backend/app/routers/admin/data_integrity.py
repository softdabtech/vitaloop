from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.services.data_integrity import get_data_integrity_report

router = APIRouter()


@router.get("/data-integrity")
async def admin_data_integrity(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    account = await svc.get_user_account(user_id)
    role = str(account.get("global_role") or current_user.get("global_role") or "end_user").lower()
    if role != "super_admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return await get_data_integrity_report()
