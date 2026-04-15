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

logger = logging.getLogger("crm.dependencies")


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
                global_role = resp.data[0].get("global_role", "end_user")
            else:
                global_role = "end_user"
        except Exception as e:
            logger.warning(f"Failed to fetch global_role for {user_id}: {e}")
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
        return {
            "org_id": org_id,
            "role": membership.get("org_role", "member"),
            "is_admin": membership.get("org_role") in ["org_owner", "client_admin"],
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
