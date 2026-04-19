from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.config import settings
from app.services import supabase_service as svc
from app.services.email_service import send_registration_alert_email
from app.utils.roles import normalize_global_role as _normalize_global_role, as_bool as _as_bool

router = APIRouter()


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
    user_metadata = current_user.get("user_metadata") if isinstance(current_user.get("user_metadata"), dict) else {}

    is_super_admin = bool(
        user_metadata.get("is_super_admin")
        or app_metadata.get("is_super_admin")
    )

    if is_super_admin:
        global_role = "super_admin"
    else:
        global_role = _normalize_global_role(
            current_user.get("global_role"),
            account.get("global_role"),
            app_metadata.get("global_role"),
            user_metadata.get("role"),
            app_metadata.get("role"),
            current_user.get("role"),
        )

        org_role = str(
            user_metadata.get("org_role")
            or app_metadata.get("org_role")
            or ""
        ).strip().lower()
        if global_role == "end_user" and org_role == "admin":
            global_role = "org_admin"

    # Auto-assign end_user role for new users who have no explicit business role yet.
    # Use upsert to ensure the public.users row exists (FK-safe for protocol inserts).
    if (
        not is_super_admin
        and global_role == "end_user"
        and not account.get("global_role")
        and not app_metadata.get("global_role")
        and not current_user.get("global_role")
    ):
        global_role = "end_user"
        supabase = svc._get_supabase()
        email = account.get("email") or current_user.get("email") or ""
        await svc._run(
            lambda: supabase.table("users")
            .upsert(
                {
                    "id": user_id,
                    "email": email,
                    "global_role": "end_user",
                },
                on_conflict="id",
            )
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


@router.get("/subscription")
async def get_subscription(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    account = await svc.get_user_account(user_id)
    subscription_status = str(account.get("sub_status") or "free").lower()
    return {
        "status": subscription_status,
        "is_active": subscription_status == "active",
    }


class _OrgSetupRequest(BaseModel):
    name: str


class _RegistrationNotifyRequest(BaseModel):
    flow: str = "signup"


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


@router.post("/registration/notify")
async def notify_registration(
    body: _RegistrationNotifyRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    account = await svc.get_user_account(user_id)
    email = str(account.get("email") or current_user.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="User email not found")

    created_at_raw = str(account.get("created_at") or "").strip()
    if created_at_raw:
        try:
            created_at = datetime.fromisoformat(created_at_raw.replace("Z", "+00:00"))
            if created_at < (datetime.now(timezone.utc) - timedelta(hours=24)):
                return {"ok": True, "sent": False, "reason": "account_not_recent"}
        except ValueError:
            pass

    sent = await send_registration_alert_email(
        to_email=settings.registration_alert_email,
        registered_email=email,
        user_id=user_id,
        flow=body.flow,
        full_name=account.get("full_name"),
        created_at_iso=created_at_raw or None,
    )
    return {"ok": True, "sent": sent}
