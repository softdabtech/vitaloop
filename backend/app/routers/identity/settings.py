from fastapi import APIRouter, Depends, HTTPException
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
