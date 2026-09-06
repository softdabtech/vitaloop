import logging

from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.services.supabase_service import _get_supabase, _run

logger = logging.getLogger(__name__)

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


@router.delete("/uploads/{upload_id}")
async def delete_upload(
    upload_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a lab upload and all associated clinical data.

    Removes:
    - lab_uploads row
    - Biomarkers extracted from this upload (cascade)
    - Protocols generated from this upload (cascade)
    - Symptoms linked to this upload (cascade)
    - Timeline events linked to this upload

    Requires ownership verification.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    supabase = _get_supabase()

    # STEP 1: Verify ownership
    upload_result = await _run(
        lambda: supabase.table("lab_uploads")
        .select("id, user_id")
        .eq("id", upload_id)
        .execute()
    )

    uploads = upload_result.data if upload_result else []
    if not uploads or uploads[0].get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Upload not found or access denied")

    # STEP 2: Delete from database
    # ForeignKey CASCADE will handle:
    # - biomarkers (upload_id FK)
    # - protocols (upload_id FK)
    # - symptoms (upload_id FK)
    await _run(
        lambda: supabase.table("lab_uploads")
        .delete()
        .eq("id", upload_id)
        .eq("user_id", user_id)
        .execute()
    )

    # STEP 3: Clean up derived current state that can otherwise outlive the
    # deleted source upload and continue to drive dashboard/current insights.
    try:
        await _run(
            lambda: supabase.table("timeline_events")
            .delete()
            .eq("user_id", user_id)
            .filter("metadata->>upload_id", "eq", upload_id)
            .execute()
        )
    except Exception as e:
        logger.warning("Timeline cleanup warning for upload %s: %s", upload_id, e.__class__.__name__)

    try:
        await _run(
            lambda: supabase.table("insights")
            .update({"dismissed": True})
            .eq("user_id", user_id)
            .eq("dismissed", False)
            .execute()
        )
    except Exception as e:
        logger.warning("Insight dismissal warning after upload delete %s: %s", upload_id, e.__class__.__name__)

    try:
        await svc.calculate_health_score(user_id)
    except Exception as e:
        logger.warning("Health score refresh warning after upload delete %s: %s", upload_id, e.__class__.__name__)

    try:
        from app.routers.analysis.dashboard import invalidate_summary_cache

        invalidate_summary_cache(user_id)
    except Exception as e:
        logger.warning("Dashboard cache invalidation warning after upload delete %s: %s", upload_id, e.__class__.__name__)

    return {"ok": True, "message": f"Upload {upload_id} and all associated data deleted successfully"}
