from datetime import datetime, timedelta, timezone
import secrets
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.dependencies import get_current_user
from app.models.crm import OrganizationMemberCreate
from app.models.organization import OrganizationCreate, OrganizationUpdate
from app.services import supabase_service as svc


router = APIRouter()


def _is_super_admin(current_user: dict) -> bool:
    user_meta = current_user.get("user_metadata") or {}
    app_meta = current_user.get("app_metadata") or {}
    global_role = current_user.get("global_role") or app_meta.get("global_role") or user_meta.get("global_role")
    return bool(
        user_meta.get("is_super_admin")
        or app_meta.get("is_super_admin")
        or str(global_role or "").lower() == "super_admin"
    )


def _display_name(user: Optional[dict], fallback_email: str = "") -> str:
    if not user:
        return fallback_email
    return user.get("full_name") or user.get("name") or user.get("email") or fallback_email


async def _get_supabase():
    return svc._get_supabase()


async def _require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not _is_super_admin(current_user):
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
    if _is_super_admin(current_user):
        return None

    membership = await _get_membership(sb, org_id, current_user["sub"])
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied")
    return membership


async def _require_org_role(sb, org_id: UUID, current_user: dict, allowed_roles: set[str]) -> Optional[dict]:
    if _is_super_admin(current_user):
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
        .select("id, email, full_name, sub_status")
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
        "client_id": row.get("client_id"),
        "client_name": _display_name(client),
        "practitioner_id": row.get("practitioner_id"),
        "practitioner_name": _display_name(practitioner),
        "status": row.get("status") or "active",
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


@router.get("/organizations")
async def list_organizations(current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()

    if _is_super_admin(current_user):
        org_resp = await svc._run(lambda: sb.table("organizations").select("*").order("created_at").execute())
        owner_ids = [row.get("owner_id") for row in (org_resp.data or [])]
        owners = await _load_users_by_ids(sb, owner_ids)
        return [_serialize_organization(row, owners.get(str(row.get("owner_id")))) for row in (org_resp.data or [])]

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
    owner_ids = [row.get("owner_id") for row in (org_resp.data or [])]
    owners = await _load_users_by_ids(sb, owner_ids)
    return [_serialize_organization(row, owners.get(str(row.get("owner_id")))) for row in (org_resp.data or [])]


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

    owners = await _load_users_by_ids(sb, [row.get("owner_id")])
    return _serialize_organization(row, owners.get(str(row.get("owner_id"))))


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
async def create_organization(req: OrganizationCreate, _: dict = Depends(_require_super_admin)):
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

    resp = await svc._run(
        lambda: sb.table("organizations")
        .update(update_data)
        .eq("id", str(org_id))
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Organization not found")

    row = resp.data[0]
    owners = await _load_users_by_ids(sb, [row.get("owner_id")])
    return _serialize_organization(row, owners.get(str(row.get("owner_id"))))


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

    users = await _load_users_by_ids(sb, [str(user_id)])
    return _serialize_member(row, users.get(str(user_id)))


@router.delete("/members/{user_id}")
async def remove_member(user_id: UUID, org_id: UUID = Query(...), current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    resp = await svc._run(
        lambda: sb.table("organization_members")
        .update({"status": "removed", "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("organization_id", str(org_id))
        .eq("user_id", str(user_id))
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"ok": True}


@router.get("/invitations")
async def list_invitations(org_id: UUID = Query(...), current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    resp = await svc._run(
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
    org_id = UUID(str(org_id_raw))

    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    resp = await svc._run(
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
    return _serialize_invitation(row)


@router.delete("/invitations/{invitation_id}")
async def revoke_invitation(invitation_id: UUID, org_id: UUID = Query(...), current_user: dict = Depends(get_current_user)):
    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin"})

    resp = await svc._run(
        lambda: sb.table("invitations")
        .update({"status": "revoked"})
        .eq("id", str(invitation_id))
        .eq("organization_id", str(org_id))
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return {"ok": True}


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
    if not org_id_raw or not practitioner_id:
        raise HTTPException(status_code=400, detail="org_id and practitioner_id are required")
    org_id = UUID(str(org_id_raw))

    sb = await _get_supabase()
    await _require_org_role(sb, org_id, current_user, {"org_owner", "client_admin", "manager"})

    resp = await svc._run(
        lambda: sb.table("practitioner_assignments")
        .update({
            "practitioner_id": str(practitioner_id),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", str(assignment_id))
        .eq("organization_id", str(org_id))
        .execute()
    )
    row = resp.data[0] if resp.data else None
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")

    users = await _load_users_by_ids(sb, [str(practitioner_id), str(row.get("client_id"))])
    return _serialize_assignment(row, users)
