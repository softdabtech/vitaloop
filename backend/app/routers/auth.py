from typing import Any

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes"}
    if isinstance(value, (int, float)):
        return value != 0
    return False


@router.get("/me")
async def get_auth_me(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")

    account = await svc.get_user_account(user_id)
    profile = await svc.get_user_profile(user_id)

    memberships = current_user.get("memberships")
    if not isinstance(memberships, list):
        memberships = []

    pending_invite = current_user.get("pending_invite")
    if pending_invite is None:
        pending_invite = current_user.get("pendingInvite")

    onboarding_completed = profile.get("onboarding_complete")
    if onboarding_completed is None:
        onboarding_completed = current_user.get("onboarding_completed")

    app_metadata = current_user.get("app_metadata") if isinstance(current_user.get("app_metadata"), dict) else {}

    global_role = current_user.get("global_role")
    if global_role is None:
        global_role = account.get("global_role")
    if global_role is None:
        global_role = app_metadata.get("global_role")
    if global_role is None:
        global_role = current_user.get("role")

    subscription_status = account.get("sub_status")
    has_active_subscription = str(subscription_status or "").lower() == "active"

    return {
        "user": {
            "id": user_id,
            "email": account.get("email") or current_user.get("email"),
            "full_name": account.get("full_name"),
            "global_role": global_role,
            "onboarding_completed": _as_bool(onboarding_completed),
        },
        "memberships": memberships,
        "has_active_subscription": has_active_subscription,
        "pending_invitation": pending_invite,
        # Backward-compatible fields expected by CRM user-context parser.
        "onboarding_completed": _as_bool(onboarding_completed),
        "global_role": global_role,
        "subscription_active": has_active_subscription,
        "subscription_status": subscription_status,
        "pending_invite": pending_invite,
    }
