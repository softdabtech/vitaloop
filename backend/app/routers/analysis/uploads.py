from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.services.supabase_service import _get_supabase, _run

router = APIRouter()


@router.get("/uploads/recent")
async def get_recent_uploads(
    current_user: dict = Depends(get_current_user),
):
    """Get most recent lab upload (for freemium users limited to 1 result)"""
    user_id = current_user.get("sub")
    supabase = _get_supabase()

    uploads = await _run(
        lambda: supabase.table("lab_uploads")
        .select("id, created_at, lab_name, test_date, collected_at, reported_at, date_source, date_confidence")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    return uploads.data or []
