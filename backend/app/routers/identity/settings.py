from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from datetime import datetime, timezone
import logging
from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()
logger = logging.getLogger(__name__)

_UNAUTHORIZED_DETAIL = "Unauthorized"


class NotificationPreferencesUpdate(BaseModel):
    weekly_checkin: bool = None
    assignment_due: bool = None
    retest_reminder: bool = None
    streak_reminder: bool = None
    insight_published: bool = None
    weekly_digest: bool = None
    achievement_unlock: bool = None
    biomarker_alert: bool = None
    push_enabled: bool = None


@router.patch("/notifications")
async def update_notification_preferences(
    body: NotificationPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail=_UNAUTHORIZED_DETAIL)

    supabase = svc._get_supabase()

    # Build the update payload with only provided fields
    update_data = {}
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value

    if not update_data:
        return {"ok": True}

    # Update user metadata with notification preferences
    await svc._run(
        lambda: supabase.auth.admin.update_user_by_id(
            user_id,
            {
                "user_metadata": {
                    **current_user.get("user_metadata", {}),
                    **update_data,
                }
            },
        )
    )

    try:
        await svc._run(
            lambda: supabase.table("user_notification_preferences")
            .upsert(
                {
                    "user_id": user_id,
                    **update_data,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="user_id",
            )
            .execute()
        )
    except Exception as exc:
        logger.warning("notification_preferences_table_unavailable user_id=%s error=%s", user_id, repr(exc))

    return {"ok": True, "preferences": update_data}


@router.post("/delete-account")
async def delete_account(
    current_user: dict = Depends(get_current_user),
    confirmation: str = Body(..., embed=True),
):
    """
    Permanently delete user account and all associated data (GDPR right to be forgotten).

    This action is IRREVERSIBLE. All data including lab uploads, biomarkers, insights,
    protocols, and preferences will be permanently deleted.

    Args:
        confirmation: Must be the exact string "DELETE MY ACCOUNT" for safety

    Returns:
        Success message with timestamp
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail=_UNAUTHORIZED_DETAIL)

    # Require explicit confirmation to prevent accidental deletion
    if confirmation != "DELETE MY ACCOUNT":
        raise HTTPException(
            status_code=400,
            detail="Confirmation text must be exactly 'DELETE MY ACCOUNT'",
        )

    try:
        logger.info(f"delete_account_start user_id={user_id}")

        # Delete all user data
        await svc.delete_user_cascade(user_id)

        # Delete from Supabase Auth (sign out from all sessions)
        try:
            supabase = svc._get_supabase()
            await svc._run(
                lambda: supabase.auth.admin.delete_user(user_id)
            )
        except Exception as e:
            logger.error(f"delete_account_auth_failed user_id={user_id} error={str(e)}")
            # Continue even if auth deletion fails

        logger.info(f"delete_account_complete user_id={user_id}")

        return {
            "status": "deleted",
            "message": "Your account and all associated data have been permanently deleted",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"delete_account_failed user_id={user_id} error={str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Account deletion failed: {str(e)}",
        )
