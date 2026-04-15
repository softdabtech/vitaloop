from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

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

    # Auto-assign end_user role for new users who have no role yet.
    if not global_role:
        global_role = "end_user"
        supabase = svc._get_supabase()
        await svc._run(
            lambda: supabase.table("users")
            .update({"global_role": "end_user"})
            .eq("id", user_id)
            .execute()
        )

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


class _OrgSetupRequest(BaseModel):
    name: str


@router.post("/onboarding/organization", status_code=201)
async def onboarding_create_organization(
    req: _OrgSetupRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Called during new-user onboarding. Creates an organisation owned by the
    current user, adds them as org_owner, and elevates their global_role to
    org_admin.  No super_admin privilege required.
    """
    user_id = current_user.get("sub")
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Organization name is required.")

    supabase = svc._get_supabase()

    # Build a URL-safe slug from the name.
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60]
    if not slug:
        slug = "org"

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    org_resp = await svc._run(
        lambda: supabase.table("organizations")
        .insert({
            "name": name,
            "slug": slug,
            "status": "active",
            "owner_id": user_id,
            "created_at": now,
            "updated_at": now,
        })
        .execute()
    )
    if not org_resp.data:
        raise HTTPException(status_code=500, detail="Failed to create organization.")

    org = org_resp.data[0]
    org_id = org["id"]

    # Create org membership for the owner.
    await svc._run(
        lambda: supabase.table("organization_memberships")
        .upsert(
            {
                "organization_id": org_id,
                "user_id": user_id,
                "role": "org_owner",
                "status": "active",
                "joined_at": now,
                "updated_at": now,
            },
            on_conflict="organization_id,user_id",
        )
        .execute()
    )

    # Elevate user to org_admin so they can access CRM.
    await svc._run(
        lambda: supabase.table("users")
        .update({"global_role": "org_admin"})
        .eq("id", user_id)
        .execute()
    )

    return {"id": org_id, "name": org["name"], "slug": org.get("slug")}
