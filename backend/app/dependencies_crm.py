"""
CRM-specific dependency injections for access control.
Used in routers to enforce auth, roles, org boundaries, and subscriptions.
"""

import logging
from typing import Optional, Dict, Any
from uuid import UUID

from fastapi import Depends, HTTPException, status

from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.utils.roles import normalize_global_role

logger = logging.getLogger("crm.dependencies")


def _is_missing_org_members_table_error(ex: Exception) -> bool:
    message = str(ex)
    return "PGRST205" in message and "organization_members" in message


class UserContext:
    """Resolved user context with role information."""

    def __init__(self, user_id: UUID, global_role: str, jwt_payload: Dict[str, Any]):
        self.user_id = user_id
        self.global_role = global_role
        self.jwt_payload = jwt_payload
        self.org_memberships: Optional[Dict[str, Any]] = None

    @property
    def is_super_admin(self) -> bool:
        """Check if user is super_admin."""
        return self.global_role in ["super_admin", "admin"]

    @property
    def is_end_user(self) -> bool:
        """Check if user is end_user."""
        return self.global_role == "end_user"


async def get_user_context(jwt_payload: dict = Depends(get_current_user)) -> UserContext:
    """
    Resolve user context with global role.
    Must be called before role-specific dependencies.
    """
    user_id = UUID(jwt_payload.get("sub"))

    # Get global_role from JWT or fetch from DB
    global_role = jwt_payload.get("global_role")
    if not global_role:
        # Fallback to DB lookup
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("users")
                .select("global_role")
                .eq("id", str(user_id))
                .limit(1)
                .execute()
            )
            if resp.data:
                global_role = normalize_global_role(resp.data[0].get("global_role"))
            else:
                global_role = "end_user"
        except Exception as e:
            logger.warning("Failed to fetch global_role for %s: %s", user_id, e, exc_info=True)
            global_role = "end_user"

    return UserContext(user_id, global_role, jwt_payload)


async def require_super_admin(user_context: UserContext = Depends(get_user_context)) -> UserContext:
    """Enforce super_admin access."""
    if not user_context.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return user_context


async def require_practitioner(user_context: UserContext = Depends(get_user_context)) -> UserContext:
    """Enforce practitioner role."""
    if user_context.global_role not in ["practitioner", "super_admin", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Practitioner access required",
        )
    return user_context


async def require_end_user(user_context: UserContext = Depends(get_user_context)) -> UserContext:
    """Enforce end_user or higher."""
    if user_context.global_role not in ["end_user", "practitioner", "super_admin", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User access required",
        )
    return user_context


async def require_subscription_plan(
    required_plan: str,
) -> callable:
    """
    Factory for subscription check dependency.
    Usage: def endpoint(..., _: None = Depends(require_subscription_plan("personal"))):
    """

    async def check_subscription(user_context: UserContext = Depends(get_user_context)):
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("subscriptions")
                .select("plan_name, status")
                .eq("user_id", str(user_context.user_id))
                .eq("status", "active")
                .limit(1)
                .execute()
            )

            if not resp.data:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f"Plan '{required_plan}' required",
                )

            plan_name = resp.data[0].get("plan_name")

            # Plan hierarchy: free < core < personal
            plans = {"free": 0, "core": 1, "personal": 2}
            required_level = plans.get(required_plan, 0)
            current_level = plans.get(plan_name, 0)

            if current_level < required_level:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f"Plan '{required_plan}' required, current: {plan_name}",
                )

            return user_context
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Subscription check failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authorization check failed",
            )

    return check_subscription


async def get_org_context(org_id: UUID, user_context: UserContext = Depends(get_user_context)) -> Dict[str, Any]:
    """
    Resolve organization membership context.
    Validates user has access to organization.
    """
    # Super admin can access any org
    if user_context.is_super_admin:
        return {"org_id": org_id, "is_owner": False, "is_admin": True, "role": "super_admin"}

    # Non-super user must be member
    try:
        sb = svc._get_supabase()
        resp = await svc._run(
            lambda: sb.table("organization_members")
            .select("*")
            .eq("organization_id", str(org_id))
            .eq("user_id", str(user_context.user_id))
            .limit(1)
            .execute()
        )

        if not resp.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization",
            )

        membership = resp.data[0]
        membership_role = membership.get("org_role") or membership.get("role") or "member"
        return {
            "org_id": org_id,
            "role": membership_role,
            "is_admin": membership_role in ["org_owner", "client_admin", "org_admin", "manager"],
            "membership_id": membership.get("id"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Org context resolution failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authorization check failed",
        )


async def require_org_admin(
    org_id: UUID, org_context: Dict[str, Any] = Depends(get_org_context)
) -> Dict[str, Any]:
    """Enforce org admin or super_admin role."""
    if not org_context.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization admin access required",
        )
    return org_context


async def require_client_access(
    client_id: UUID, user_context: UserContext = Depends(get_user_context)
) -> Dict[str, Any]:
    """
    Validate user has access to client.
    Rules:
    - Super admin: always allowed
    - Practitioner: allowed if assigned
    - End user: allowed if self
    """
    try:
        sb = svc._get_supabase()
        resp = await svc._run(
            lambda: sb.table("clients")
            .select("user_id, assigned_practitioner_id")
            .eq("id", str(client_id))
            .limit(1)
            .execute()
        )

        if not resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found",
            )

        client = resp.data[0]
        client_user_id = UUID(client["user_id"])
        assigned_practitioner_id = client.get("assigned_practitioner_id")

        # Super admin always allowed
        if user_context.is_super_admin:
            return {"client_id": client_id, "access_granted": True}

        # End user can only see self
        if user_context.is_end_user and user_context.user_id == client_user_id:
            return {"client_id": client_id, "access_granted": True}

        # Practitioner can see assigned clients
        if user_context.global_role == "practitioner" and assigned_practitioner_id:
            # Fetch practitioner profile
            prac_resp = await svc._run(
                lambda: sb.table("practitioners")
                .select("id")
                .eq("user_id", str(user_context.user_id))
                .limit(1)
                .execute()
            )
            if prac_resp.data and prac_resp.data[0]["id"] == assigned_practitioner_id:
                return {"client_id": client_id, "access_granted": True}

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this client",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Client access check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authorization check failed",
        )


async def resolve_practitioner_list_scope(
    user_context: UserContext = Depends(get_user_context),
) -> Dict[str, Any]:
    """
    Resolve practitioner list visibility scope.

    Rules:
    - super_admin/admin: all practitioners
    - org admin-like member (org_owner/client_admin/manager/org_admin): practitioners in same org(s)
    - practitioner: own practitioner profile only
    - otherwise: forbidden
    """
    if user_context.is_super_admin:
        return {"scope": "all"}

    if user_context.global_role == "practitioner":
        return {"scope": "self", "user_id": str(user_context.user_id)}

    admin_like_roles = {"org_admin", "org_owner", "client_admin", "manager"}
    if user_context.global_role not in admin_like_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role to list practitioners",
        )

    try:
        sb = svc._get_supabase()

        memberships_resp = await svc._run(
            lambda: sb.table("organization_members")
            .select("organization_id, role, org_role, status")
            .eq("user_id", str(user_context.user_id))
            .execute()
        )
        memberships = memberships_resp.data or []

        admin_roles = {"org_owner", "client_admin", "manager", "org_admin"}
        admin_org_ids = {
            str(row.get("organization_id"))
            for row in memberships
            if str((row.get("status") or "active")).lower() == "active"
            and str((row.get("role") or row.get("org_role") or "")).lower() in admin_roles
            and row.get("organization_id")
        }

        if admin_org_ids:
            members_resp = await svc._run(
                lambda: sb.table("organization_members")
                .select("organization_id,user_id,status")
                .in_("organization_id", list(admin_org_ids))
                .execute()
            )
            visible_user_ids = {
                str(row.get("user_id"))
                for row in (members_resp.data or [])
                if str((row.get("status") or "active")).lower() == "active" and row.get("user_id")
            }
            return {
                "scope": "org",
                "organization_ids": sorted(admin_org_ids),
                "user_ids": sorted(visible_user_ids),
            }

        if user_context.global_role == "org_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization admin has no active organization memberships",
            )

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    except HTTPException:
        raise
    except Exception as e:
        if user_context.global_role == "org_admin" or _is_missing_org_members_table_error(e):
            # Safe fallback until PostgREST schema cache includes organization_members.
            logger.warning(
                "Organization membership lookup unavailable for user %s (role=%s): %s. Returning empty org scope.",
                user_context.user_id,
                user_context.global_role,
                e,
            )
            return {"scope": "org", "organization_ids": [], "user_ids": []}

        logger.error("Practitioner scope resolution failed for user %s: %s", user_context.user_id, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resolve practitioner visibility scope",
        )


def require_global_role(allowed_roles: list[str]):
    """Factory dependency to enforce global roles."""

    allowed = {str(role).lower() for role in allowed_roles}

    async def checker(user_context: UserContext = Depends(get_user_context)) -> UserContext:
        current_role = str(user_context.global_role or "").lower()
        if current_role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Global role access denied")
        return user_context

    return checker


def require_org_role(allowed_roles: list[str]):
    """Factory dependency to enforce organization membership role."""

    allowed = {str(role).lower() for role in allowed_roles}

    async def checker(
        org_id: UUID,
        user_context: UserContext = Depends(get_user_context),
    ) -> Dict[str, Any]:
        if user_context.is_super_admin:
            return {"organization_id": str(org_id), "role": "super_admin", "status": "active"}

        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("organization_members")
                .select("*")
                .eq("organization_id", str(org_id))
                .eq("user_id", str(user_context.user_id))
                .limit(1)
                .execute()
            )
            membership = resp.data[0] if resp.data else None
            role = str((membership or {}).get("org_role") or (membership or {}).get("role") or "").lower()
            if not membership or role not in allowed:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization role access denied")
            return membership
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Organization role check failed for user %s: %s", user_context.user_id, e, exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Organization role check failed")

    return checker


def require_assignment_access(action: str):
    """
    Load assignment and verify access by action:
    - read: super_admin/admin, org member, practitioner-self, or client-self
    - modify: super_admin/admin or org admin-like
    - cancel: modify + practitioner-self
    """

    async def checker(
        assignment_id: UUID,
        user_context: UserContext = Depends(get_user_context),
    ) -> Dict[str, Any]:
        try:
            sb = svc._get_supabase()
            assignment_resp = await svc._run(
                lambda: sb.table("practitioner_assignments")
                .select("*")
                .eq("id", str(assignment_id))
                .limit(1)
                .execute()
            )
            assignment = assignment_resp.data[0] if assignment_resp.data else None
            if not assignment:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

            if user_context.is_super_admin:
                return assignment

            global_role = str(user_context.global_role or "").lower()
            org_id = assignment.get("organization_id")

            membership_resp = await svc._run(
                lambda: sb.table("organization_members")
                .select("*")
                .eq("organization_id", str(org_id))
                .eq("user_id", str(user_context.user_id))
                .limit(1)
                .execute()
            )
            membership = membership_resp.data[0] if membership_resp.data else None
            membership_role = str((membership or {}).get("org_role") or (membership or {}).get("role") or "").lower()
            is_org_admin_like = membership_role in {"org_admin", "org_owner", "client_admin", "manager"}

            practitioner_resp = await svc._run(
                lambda: sb.table("practitioners")
                .select("id,user_id")
                .eq("user_id", str(user_context.user_id))
                .limit(1)
                .execute()
            )
            own_practitioner = practitioner_resp.data[0] if practitioner_resp.data else None
            is_practitioner_owner = bool(
                own_practitioner and str(own_practitioner.get("id")) == str(assignment.get("practitioner_id"))
            )
            is_client_owner = str(assignment.get("client_user_id")) == str(user_context.user_id)

            if action == "read":
                if membership or is_practitioner_owner or is_client_owner:
                    return assignment
            elif action == "modify":
                if global_role in {"super_admin", "admin"} or is_org_admin_like:
                    return assignment
            elif action == "cancel":
                if global_role in {"super_admin", "admin"} or is_org_admin_like or is_practitioner_owner:
                    return assignment

            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Assignment access denied")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                "Assignment access check failed for user %s assignment %s action %s: %s",
                user_context.user_id,
                assignment_id,
                action,
                e,
                exc_info=True,
            )
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Assignment access check failed")

    return checker
