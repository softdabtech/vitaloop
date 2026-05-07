from datetime import datetime, timedelta, timezone
import secrets
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.config import settings
from app.dependencies import get_current_user
from app.models.crm import OrganizationMemberCreate
from app.models.organization import OrganizationCreate, OrganizationUpdate
from app.services import supabase_service as svc
from app.services.email_service import send_invitation_accepted_email, send_invitation_email, send_welcome_email, send_ops_alert_email


router = APIRouter()

_ALLOWED_ORG_ROLES = {"org_owner", "client_admin", "manager", "practitioner", "support", "member"}


async def _write_audit_log(
    sb,
    *,
    actor_user_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    old_value: Optional[dict[str, Any]] = None,
    new_value: Optional[dict[str, Any]] = None,
    organization_id: Optional[str] = None,
) -> None:
    try:
        await svc._run(
            lambda: sb.table("audit_logs")
            .insert({
                "user_id": actor_user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "old_value": old_value or {},
                "new_value": new_value or {},
                "organization_id": organization_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            .execute()
        )
    except Exception:
        # Audit should never break business operations.
        return


def _as_text(value: Any, fallback: str = "") -> str:
    return str(value) if value is not None else fallback


def _is_missing_table_error(ex: Exception, table_name: str) -> bool:
    msg = str(ex)
    return "PGRST205" in msg and table_name in msg


def _raise_missing_table_http(table_name: str) -> None:
    raise HTTPException(
        status_code=503,
        detail=(
            f"Storage table '{table_name}' is not available. "
            "Apply supabase_migrations.sql and reload PostgREST schema cache."
        ),
    )


async def _run_invitations_query(query_fn):
    try:
        return await svc._run(query_fn)
    except Exception as ex:
        if _is_missing_table_error(ex, "invitations"):
            _raise_missing_table_http("invitations")
        raise


async def _is_super_admin(current_user: dict) -> bool:
    user_meta = current_user.get("user_metadata") or {}
    app_meta = current_user.get("app_metadata") or {}
    global_role = current_user.get("global_role") or app_meta.get("global_role") or user_meta.get("global_role")
    is_super_admin = bool(
        user_meta.get("is_super_admin")
        or app_meta.get("is_super_admin")
        or str(global_role or "").lower() == "super_admin"
    )
    if is_super_admin:
        return True

    user_id = current_user.get("sub")
    if not user_id:
        return False

    try:
        account = await svc.get_user_account(user_id)
        return str((account or {}).get("global_role") or "").lower() == "super_admin"
    except Exception:
        return False


def _display_name(user: Optional[dict], fallback_email: str = "") -> str:
    if not user:
        return fallback_email
    return user.get("full_name") or user.get("name") or user.get("email") or fallback_email


async def _get_supabase():
    return svc._get_supabase()


async def _require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not await _is_super_admin(current_user):
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user


async def _get_membership(sb, org_id: UUID, user_id: str) -> Optional[dict]:
    resp = await svc._run(
        lambda: sb.table("organization_members")
        .select("*")
        .eq("organization_id", str(org_id))
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


async def _require_org_access(sb, org_id: UUID, current_user: dict) -> Optional[dict]:
    if await _is_super_admin(current_user):
        return None

    membership = await _get_membership(sb, org_id, current_user["sub"])
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied")
    return membership


async def _require_org_role(sb, org_id: UUID, current_user: dict, allowed_roles: set[str]) -> Optional[dict]:
    if await _is_super_admin(current_user):
        return None

    membership = await _get_membership(sb, org_id, current_user["sub"])
    role = str((membership or {}).get("role") or "").lower()
    if not membership or role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Organization admin access required")
    return membership


async def _load_users_by_ids(sb, user_ids: list[str]) -> dict[str, dict]:
    ids = [value for value in {str(user_id) for user_id in user_ids if user_id}]
    if not ids:
        return {}

    resp = await svc._run(
        lambda: sb.table("users")
        .select("id, email, full_name, age, sex, sub_status")
        .in_("id", ids)
        .execute()
    )
    return {row["id"]: row for row in (resp.data or [])}


def _serialize_organization(row: dict, owner: Optional[dict] = None) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "slug": row.get("slug"),
        "status": row.get("status") or "active",
        "owner_name": row.get("owner_name") or _display_name(owner),
    }


def _serialize_member(row: dict, user: Optional[dict]) -> dict[str, Any]:
    return {
        "user_id": row.get("user_id"),
        "email": (user or {}).get("email") or "",
        "full_name": _display_name(user),
        "age": (user or {}).get("age"),
        "sex": (user or {}).get("sex"),
        "global_role": (user or {}).get("global_role") or "end_user",
        "org_role": row.get("role") or "member",
        "membership_status": row.get("status") or "active",
        "subscription_active": str((user or {}).get("sub_status") or "").lower() == "active",
        "subscription_status": (user or {}).get("sub_status") or "inactive",
    }


def _serialize_assignment(row: dict, users_by_id: dict[str, dict]) -> dict[str, Any]:
    practitioner = users_by_id.get(str(row.get("practitioner_id")))
    client = users_by_id.get(str(row.get("client_id")))
    return {
        "id": row.get("id"),
        "organization_id": row.get("organization_id"),
        "client_id": row.get("client_id"),
        "client_name": _display_name(client),
        "practitioner_id": row.get("practitioner_id"),
        "practitioner_name": _display_name(practitioner),
        "status": row.get("status") or "active",
        "notes": row.get("notes") or "",
        "updated_at": row.get("updated_at") or row.get("assigned_at"),
    }


def _serialize_invitation(row: dict) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "email": row.get("email") or "",
        "role": row.get("role") or "member",
        "status": row.get("status") or "sent",
        "expires_at": row.get("expires_at"),
        "created_at": row.get("created_at") or row.get("invited_at"),
    }


async def _load_fallback_owner(sb) -> Optional[dict]:
    """Return first super_admin user for use as org owner fallback when owner_id column is absent."""
    try:
        resp = await svc._run(
            lambda: sb.table("users")
            .select("id, email, full_name")
            .eq("global_role", "super_admin")
            .order("created_at")
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def _resolve_owner(row: dict, owners: dict, fallback: Optional[dict]) -> Optional[dict]:
    """Resolve the owner dict for an org row, using fallback when owner_id column is absent."""
    owner_id = row.get("owner_id")
    if owner_id:
        return owners.get(str(owner_id))
    # owner_id column doesn't exist on this DB schema – use fallback
    return fallback if not row.get("owner_name") else None


@router.get("/organizations")
async def list_organizations(current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()

    if await _is_super_admin(current_user):
        org_resp = await svc._run(lambda: sb.table("organizations").select("*").order("created_at").execute())
        owner_ids = [row.get("owner_id") for row in (org_resp.data or []) if row.get("owner_id")]
        owners = await _load_users_by_ids(sb, owner_ids) if owner_ids else {}
        fallback = await _load_fallback_owner(sb) if not owners else None
        return [_serialize_organization(row, _resolve_owner(row, owners, fallback)) for row in (org_resp.data or [])]

    membership_resp = await svc._run(
        lambda: sb.table("organization_members")
        .select("organization_id")
        .eq("user_id", current_user["sub"])
        .in_("status", ["active", "pending"])
        .execute()
    )
    org_ids = [row.get("organization_id") for row in (membership_resp.data or []) if row.get("organization_id")]
    if not org_ids:
        return []

    org_resp = await svc._run(
        lambda: sb.table("organizations")
        .select("*")
        .in_("id", org_ids)
        .order("created_at")
        .execute()
    )
    owner_ids = [row.get("owner_id") for row in (org_resp.data or []) if row.get("owner_id")]
    owners = await _load_users_by_ids(sb, owner_ids) if owner_ids else {}
    fallback = await _load_fallback_owner(sb) if not owners else None
    return [_serialize_organization(row, _resolve_owner(row, owners, fallback)) for row in (org_resp.data or [])]


@router.get("/organizations/{org_id}")
async def get_organization(org_id: UUID, current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_access(sb, org_id, current_user)

    resp = await svc._run(
        lambda: sb.table("organizations")
        .select("*")
        .eq("id", str(org_id))
        .limit(1)
        .execute()
    )
    row = resp.data[0] if resp.data else None
    if not row:
        raise HTTPException(status_code=404, detail="Organization not found")

    owner_id = row.get("owner_id")
    owners = await _load_users_by_ids(sb, [owner_id]) if owner_id else {}
    fallback = await _load_fallback_owner(sb) if not owners else None
    return _serialize_organization(row, _resolve_owner(row, owners, fallback))


@router.get("/organizations/{org_id}/settings")
async def get_organization_settings(org_id: UUID, current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_access(sb, org_id, current_user)
    org = await get_organization(org_id, current_user)
    return {
        "organization_id": org["id"],
        "name": org["name"],
        "time_zone": "UTC",
        "billing_email": "",
        "support_email": "",
        "is_locked": str(org.get("status") or "active").lower() != "active",
    }


@router.post("/organizations")
async def create_organization(req: OrganizationCreate, current_user: dict = Depends(_require_super_admin)):
    sb = await _get_supabase()
    owner_map = await _load_users_by_ids(sb, [str(req.owner_id)])
    owner = owner_map.get(str(req.owner_id))

    org_resp = await svc._run(
        lambda: sb.table("organizations")
        .insert({
            "name": req.name,
            "slug": req.slug,
            "status": req.status,
            "owner_id": str(req.owner_id),
            "owner_name": _display_name(owner, owner.get("email", "") if owner else ""),
            "description": req.description,
            "logo_url": req.logo_url,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .execute()
    )
    if not org_resp.data:
        raise HTTPException(status_code=400, detail="Failed to create organization")

    created = org_resp.data[0]
    await svc._run(
        lambda: sb.table("organization_members")
        .upsert({
            "organization_id": created["id"],
            "user_id": str(req.owner_id),
            "role": "org_owner",
            "status": "active",
            "joined_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="organization_id,user_id")
        .execute()
    )

    await _write_audit_log(
        sb,
        actor_user_id=current_user["sub"],
        action="create",
        entity_type="organization",
        entity_id=_as_text(created.get("id")),
        new_value=created,
        organization_id=_as_text(created.get("id")),
    )

    return _serialize_organization(created, owner)


@router.put("/organizations/{org_id}")
@router.patch("/organizations/{org_id}")
async def update_organization(org_id: UUID, req: OrganizationUpdate, current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    update_data = {key: value for key, value in req.model_dump().items() if value is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No organization fields provided")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    old_resp = await svc._run(
        lambda: sb.table("organizations")
        .select("*")
        .eq("id", str(org_id))
        .limit(1)
        .execute()
    )
    old_row = old_resp.data[0] if old_resp.data else None

    resp = await svc._run(
        lambda: sb.table("organizations")
        .update(update_data)
        .eq("id", str(org_id))
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Organization not found")

    row = resp.data[0]
    await _write_audit_log(
        sb,
        actor_user_id=current_user["sub"],
        action="update",
        entity_type="organization",
        entity_id=str(org_id),
        old_value=old_row,
        new_value=row,
        organization_id=str(org_id),
    )

    owner_id = row.get("owner_id")
    owners = await _load_users_by_ids(sb, [owner_id]) if owner_id else {}
    fallback = await _load_fallback_owner(sb) if not owners else None
    return _serialize_organization(row, _resolve_owner(row, owners, fallback))


@router.get("/members")
async def list_members(org_id: UUID = Query(...), current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_access(sb, org_id, current_user)

    members_resp = await svc._run(
        lambda: sb.table("organization_members")
        .select("*")
        .eq("organization_id", str(org_id))
        .execute()
    )
    user_ids = [row.get("user_id") for row in (members_resp.data or [])]
    users_by_id = await _load_users_by_ids(sb, user_ids)
    return [_serialize_member(row, users_by_id.get(str(row.get("user_id")))) for row in (members_resp.data or [])]


@router.post("/organizations/{org_id}/members")
async def add_member(org_id: UUID, req: OrganizationMemberCreate, current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    resp = await svc._run(
        lambda: sb.table("organization_members")
        .upsert({
            "organization_id": str(org_id),
            "user_id": str(req.user_id),
            "role": req.role,
            "status": req.status,
            "invited_by": current_user["sub"],
            "invited_at": datetime.now(timezone.utc).isoformat(),
            "joined_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="organization_id,user_id")
        .execute()
    )
    row = resp.data[0] if resp.data else None
    if not row:
        raise HTTPException(status_code=400, detail="Failed to add member")

    users = await _load_users_by_ids(sb, [str(req.user_id)])
    await _write_audit_log(
        sb,
        actor_user_id=current_user["sub"],
        action="create",
        entity_type="organization_member",
        entity_id=f"{org_id}:{req.user_id}",
        new_value=row,
        organization_id=str(org_id),
    )
    return _serialize_member(row, users.get(str(req.user_id)))


@router.patch("/members/{user_id}/role")
async def change_member_role(
    user_id: UUID,
    org_id: UUID = Body(...),
    role: str = Body(...),
    current_user: dict = Depends(get_current_user),
):
    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    old_resp = await svc._run(
        lambda: sb.table("organization_members")
        .select("*")
        .eq("organization_id", str(org_id))
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    old_row = old_resp.data[0] if old_resp.data else None

    resp = await svc._run(
        lambda: sb.table("organization_members")
        .update({"role": role, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("organization_id", str(org_id))
        .eq("user_id", str(user_id))
        .execute()
    )
    row = resp.data[0] if resp.data else None
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")

    await _write_audit_log(
        sb,
        actor_user_id=current_user["sub"],
        action="update",
        entity_type="organization_member",
        entity_id=f"{org_id}:{user_id}",
        old_value=old_row,
        new_value=row,
        organization_id=str(org_id),
    )

    users = await _load_users_by_ids(sb, [str(user_id)])
    return _serialize_member(row, users.get(str(user_id)))


@router.patch("/members/{user_id}/profile")
async def update_member_profile(
    user_id: UUID,
    body: dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
):
    org_id_raw = body.get("org_id") or body.get("organization_id")
    if not org_id_raw:
        raise HTTPException(status_code=400, detail="org_id is required")
    org_id = UUID(str(org_id_raw))

    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin", "manager"})

    profile_update: dict[str, Any] = {}
    if "full_name" in body:
        profile_update["full_name"] = str(body.get("full_name") or "").strip()
    if "age" in body and body.get("age") is not None:
        profile_update["age"] = body.get("age")
    if "sex" in body:
        profile_update["sex"] = str(body.get("sex") or "").strip().lower()
    if "sub_status" in body:
        profile_update["sub_status"] = str(body.get("sub_status") or "").strip().lower()

    if profile_update:
        await svc._run(
            lambda: sb.table("users")
            .update(profile_update)
            .eq("id", str(user_id))
            .execute()
        )

    member_resp = await svc._run(
        lambda: sb.table("organization_members")
        .select("*")
        .eq("organization_id", str(org_id))
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    row = member_resp.data[0] if member_resp.data else None
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")

    users = await _load_users_by_ids(sb, [str(user_id)])
    return _serialize_member(row, users.get(str(user_id)))


@router.delete("/members/{user_id}")
async def remove_member(user_id: UUID, org_id: UUID = Query(...), current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    old_resp = await svc._run(
        lambda: sb.table("organization_members")
        .select("*")
        .eq("organization_id", str(org_id))
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    old_row = old_resp.data[0] if old_resp.data else None

    resp = await svc._run(
        lambda: sb.table("organization_members")
        .update({"status": "removed", "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("organization_id", str(org_id))
        .eq("user_id", str(user_id))
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Member not found")

    await _write_audit_log(
        sb,
        actor_user_id=current_user["sub"],
        action="delete",
        entity_type="organization_member",
        entity_id=f"{org_id}:{user_id}",
        old_value=old_row,
        new_value=resp.data[0],
        organization_id=str(org_id),
    )

    return {"ok": True}


@router.get("/invitations")
async def list_invitations(org_id: UUID = Query(...), current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    resp = await _run_invitations_query(
        lambda: sb.table("invitations")
        .select("*")
        .eq("organization_id", str(org_id))
        .order("created_at", desc=True)
        .execute()
    )
    return [_serialize_invitation(row) for row in (resp.data or [])]


@router.post("/invitations")
async def create_invitation(body: dict[str, Any] = Body(...), current_user: dict = Depends(get_current_user)):
    org_id_raw = body.get("org_id") or body.get("organization_id")
    email = str(body.get("email") or "").strip().lower()
    role = str(body.get("role") or "member").strip() or "member"
    if not org_id_raw:
        raise HTTPException(status_code=400, detail="org_id is required")
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    if role not in _ALLOWED_ORG_ROLES:
        raise HTTPException(status_code=422, detail=f"Unsupported role '{role}'")
    org_id = UUID(str(org_id_raw))

    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    org_resp = await svc._run(
        lambda: sb.table("organizations")
        .select("id,name")
        .eq("id", str(org_id))
        .limit(1)
        .execute()
    )
    org_row = org_resp.data[0] if org_resp.data else None

    resp = await _run_invitations_query(
        lambda: sb.table("invitations")
        .insert({
            "organization_id": str(org_id),
            "email": email,
            "role": role,
            "status": "sent",
            "invited_by": current_user["sub"],
            "invited_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "token": secrets.token_urlsafe(32),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        .execute()
    )
    row = resp.data[0] if resp.data else None
    if not row:
        raise HTTPException(status_code=400, detail="Failed to create invitation")

    invitation_accept_url = f"{settings.crm_base_url.rstrip('/')}/invitations/accept?token={row['token']}"
    inviter_name = current_user.get("email") or "Team Admin"
    await send_invitation_email(
        to_email=email,
        organization_name=(org_row or {}).get("name") or "VITALOOP Team",
        role=role,
        inviter_name=inviter_name,
        invitation_url=invitation_accept_url,
        expires_at_iso=row.get("expires_at"),
    )

    await _write_audit_log(
        sb,
        actor_user_id=current_user["sub"],
        action="create",
        entity_type="invitation",
        entity_id=_as_text(row.get("id")),
        new_value=row,
        organization_id=str(org_id),
    )

    return _serialize_invitation(row)


@router.delete("/invitations/{invitation_id}")
async def revoke_invitation(invitation_id: UUID, org_id: UUID = Query(...), current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    old_resp = await _run_invitations_query(
        lambda: sb.table("invitations")
        .select("*")
        .eq("id", str(invitation_id))
        .eq("organization_id", str(org_id))
        .limit(1)
        .execute()
    )
    old_row = old_resp.data[0] if old_resp.data else None

    resp = await _run_invitations_query(
        lambda: sb.table("invitations")
        .update({"status": "revoked"})
        .eq("id", str(invitation_id))
        .eq("organization_id", str(org_id))
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Invitation not found")

    await _write_audit_log(
        sb,
        actor_user_id=current_user["sub"],
        action="update",
        entity_type="invitation",
        entity_id=str(invitation_id),
        old_value=old_row,
        new_value=resp.data[0],
        organization_id=str(org_id),
    )

    return {"ok": True}


@router.post("/invitations/accept")
async def accept_invitation(
    body: dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
):
    token = str(body.get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token is required")

    sb = await _get_supabase()
    invite_resp = await _run_invitations_query(
        lambda: sb.table("invitations")
        .select("*")
        .eq("token", token)
        .limit(1)
        .execute()
    )
    invitation = invite_resp.data[0] if invite_resp.data else None
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    status = str(invitation.get("status") or "sent").lower()
    if status != "sent":
        raise HTTPException(status_code=400, detail="Invitation is no longer valid")

    expires_at = invitation.get("expires_at")
    if expires_at:
        try:
            if datetime.fromisoformat(str(expires_at).replace("Z", "+00:00")) < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Invitation expired")
        except HTTPException:
            raise
        except Exception:
            pass

    invite_email = str(invitation.get("email") or "").strip().lower()
    current_email = str(current_user.get("email") or "").strip().lower()
    if invite_email and current_email and invite_email != current_email:
        raise HTTPException(status_code=403, detail="Invitation email does not match current account")

    org_id = _as_text(invitation.get("organization_id"))
    member_resp = await svc._run(
        lambda: sb.table("organization_members")
        .upsert(
            {
                "organization_id": org_id,
                "user_id": current_user["sub"],
                "role": invitation.get("role") or "member",
                "status": "active",
                "invited_by": invitation.get("invited_by"),
                "invited_at": invitation.get("invited_at") or datetime.now(timezone.utc).isoformat(),
                "joined_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="organization_id,user_id",
        )
        .execute()
    )

    updated_invite_resp = await _run_invitations_query(
        lambda: sb.table("invitations")
        .update(
            {
                "status": "accepted",
                "accepted_by_user_id": current_user["sub"],
                "accepted_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", str(invitation.get("id")))
        .execute()
    )

    await _write_audit_log(
        sb,
        actor_user_id=current_user["sub"],
        action="accept",
        entity_type="invitation",
        entity_id=_as_text(invitation.get("id")),
        old_value=invitation,
        new_value=(updated_invite_resp.data[0] if updated_invite_resp.data else invitation),
        organization_id=org_id,
    )

    membership = member_resp.data[0] if member_resp.data else None

    # Best-effort notification: do not block acceptance if email sending fails.
    try:
        inviter_id = _as_text(invitation.get("invited_by"))
        inviter_user = None
        if inviter_id:
            inviter_user = (await _load_users_by_ids(sb, [inviter_id])).get(inviter_id)
        inviter_email = str((inviter_user or {}).get("email") or "").strip().lower()

        if inviter_email:
            org_name = "VITALOOP Team"
            if org_id:
                try:
                    org_resp = await svc._run(
                        lambda: sb.table("organizations")
                        .select("name")
                        .eq("id", org_id)
                        .limit(1)
                        .execute()
                    )
                    org_name = ((org_resp.data or [{}])[0].get("name") or org_name)
                except Exception:
                    pass

            accepted_user_name = (
                current_user.get("full_name")
                or (current_user.get("user_metadata") or {}).get("full_name")
                or current_user.get("email")
                or "A team member"
            )
            await send_invitation_accepted_email(
                to_email=inviter_email,
                organization_name=org_name,
                accepted_user_name=str(accepted_user_name),
            )
    except Exception:
        pass

    # Best-effort welcome email to new team member
    try:
        accepted_email = str(current_user.get("email") or "").strip().lower()
        if accepted_email:
            org_name = "VITALOOP Team"
            if org_id:
                try:
                    org_resp = await svc._run(
                        lambda: sb.table("organizations")
                        .select("name")
                        .eq("id", org_id)
                        .limit(1)
                        .execute()
                    )
                    org_name = ((org_resp.data or [{}])[0].get("name") or org_name)
                except Exception:
                    pass

            accepted_user_name = (
                current_user.get("full_name")
                or (current_user.get("user_metadata") or {}).get("full_name")
                or current_user.get("email")
                or "Team member"
            )
            dashboard_url = f"{settings.frontend_base_url}/dashboard"

            await send_welcome_email(
                to_email=accepted_email,
                user_name=str(accepted_user_name),
                organization_name=org_name,
                dashboard_url=dashboard_url,
            )
    except Exception:
        pass

    # Best-effort ops notification: send alert to inviter about new team member join
    try:
        inviter_id = _as_text(invitation.get("invited_by"))
        inviter_user = None
        if inviter_id:
            inviter_user = (await _load_users_by_ids(sb, [inviter_id])).get(inviter_id)
        inviter_email = str((inviter_user or {}).get("email") or "").strip().lower()

        if inviter_email:
            org_name = "VITALOOP Team"
            if org_id:
                try:
                    org_resp = await svc._run(
                        lambda: sb.table("organizations")
                        .select("name")
                        .eq("id", org_id)
                        .limit(1)
                        .execute()
                    )
                    org_name = ((org_resp.data or [{}])[0].get("name") or org_name)
                except Exception:
                    pass

            accepted_user_name = (
                current_user.get("full_name")
                or (current_user.get("user_metadata") or {}).get("full_name")
                or current_user.get("email")
                or "A team member"
            )
            member_role = invitation.get("role") or "member"
            
            crm_link = f"{settings.crm_base_url}/organizations/{org_id}/members"

            await send_ops_alert_email(
                to_email=inviter_email,
                organization_name=org_name,
                alert_title=f"New Team Member Joined: {accepted_user_name}",
                alert_message=f"{accepted_user_name} has accepted your invitation and joined with role '{member_role}'.",
                alert_level="info",
                action_url=crm_link,
            )
    except Exception:
        pass

    return {
        "ok": True,
        "organization_id": org_id,
        "membership": membership,
        "invitation": updated_invite_resp.data[0] if updated_invite_resp.data else invitation,
    }


@router.get("/assignments")
async def list_assignments(org_id: UUID = Query(...), current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    membership = await _require_org_access(sb, org_id, current_user)

    resp = await svc._run(
        lambda: sb.table("practitioner_assignments")
        .select("*")
        .eq("organization_id", str(org_id))
        .order("updated_at", desc=True)
        .execute()
    )
    rows = resp.data or []

    role = str((membership or {}).get("role") or "").lower()
    if membership and role == "practitioner":
        rows = [row for row in rows if str(row.get("practitioner_id")) == str(current_user["sub"])]

    users_by_id = await _load_users_by_ids(
        sb,
        [row.get("client_id") for row in rows] + [row.get("practitioner_id") for row in rows],
    )
    return [_serialize_assignment(row, users_by_id) for row in rows]


@router.post("/assignments")
async def create_assignment(body: dict[str, Any] = Body(...), current_user: dict = Depends(get_current_user)):
    org_id_raw = body.get("org_id") or body.get("organization_id")
    practitioner_id = body.get("practitioner_id")
    client_id = body.get("client_id")
    if not org_id_raw or not practitioner_id or not client_id:
        raise HTTPException(status_code=400, detail="org_id, practitioner_id, and client_id are required")
    org_id = UUID(str(org_id_raw))

    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin", "manager"})

    resp = await svc._run(
        lambda: sb.table("practitioner_assignments")
        .upsert({
            "organization_id": str(org_id),
            "practitioner_id": str(practitioner_id),
            "client_id": str(client_id),
            "status": str(body.get("status") or "active"),
            "notes": body.get("notes"),
            "assigned_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="organization_id,practitioner_id,client_id")
        .execute()
    )
    row = resp.data[0] if resp.data else None
    if not row:
        raise HTTPException(status_code=400, detail="Failed to create assignment")

    await _write_audit_log(
        sb,
        actor_user_id=current_user["sub"],
        action="create",
        entity_type="assignment",
        entity_id=_as_text(row.get("id")),
        new_value=row,
        organization_id=str(org_id),
    )

    users = await _load_users_by_ids(sb, [str(practitioner_id), str(client_id)])
    return _serialize_assignment(row, users)


@router.patch("/assignments/{assignment_id}")
async def reassign_assignment(
    assignment_id: UUID,
    body: dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
):
    org_id_raw = body.get("org_id") or body.get("organization_id")
    practitioner_id = body.get("practitioner_id")
    status = body.get("status")
    notes = body.get("notes")
    if not org_id_raw:
        raise HTTPException(status_code=400, detail="org_id is required")
    org_id = UUID(str(org_id_raw))

    sb = await _get_supabase()
    membership = await _require_org_access(sb, org_id, current_user)

    existing_resp = await svc._run(
        lambda: sb.table("practitioner_assignments")
        .select("*")
        .eq("id", str(assignment_id))
        .eq("organization_id", str(org_id))
        .limit(1)
        .execute()
    )
    existing = existing_resp.data[0] if existing_resp.data else None
    if not existing:
        raise HTTPException(status_code=404, detail="Assignment not found")

    role = str((membership or {}).get("role") or "").lower()
    is_practitioner = role == "practitioner"
    is_admin_like = await _is_super_admin(current_user) or role in {"org_owner", "client_admin", "manager"}

    if is_practitioner and str(existing.get("practitioner_id")) != str(current_user["sub"]):
        raise HTTPException(status_code=403, detail="Practitioner can only edit own clients")

    update_data: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if notes is not None:
        update_data["notes"] = str(notes)
    if status is not None:
        update_data["status"] = str(status)

    if practitioner_id is not None:
        if not is_admin_like:
            raise HTTPException(status_code=403, detail="Only managers/admins can reassign practitioners")
        update_data["practitioner_id"] = str(practitioner_id)

    if len(update_data) == 1:
        raise HTTPException(status_code=400, detail="No assignment changes provided")

    resp = await svc._run(
        lambda: sb.table("practitioner_assignments")
        .update(update_data)
        .eq("id", str(assignment_id))
        .eq("organization_id", str(org_id))
        .execute()
    )
    row = resp.data[0] if resp.data else None
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")

    await _write_audit_log(
        sb,
        actor_user_id=current_user["sub"],
        action="update",
        entity_type="assignment",
        entity_id=str(assignment_id),
        old_value=existing,
        new_value=row,
        organization_id=str(org_id),
    )

    users = await _load_users_by_ids(sb, [str(row.get("practitioner_id")), str(row.get("client_id"))])
    return _serialize_assignment(row, users)
