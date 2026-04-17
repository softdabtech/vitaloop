import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.services import supabase_service as svc

logger = logging.getLogger("crm.assignment.service")

ADMIN_ORG_ROLES = {"org_admin", "org_owner", "client_admin", "manager"}
ACTIVE_ASSIGNMENT_STATUSES = {"pending", "active"}


class AssignmentService:
    def __init__(self):
        self._sb = None

    @property
    def sb(self):
        if self._sb is None:
            self._sb = svc._get_supabase()
        return self._sb

    async def _get_assignment(self, assignment_id: UUID) -> Optional[Dict[str, Any]]:
        resp = await svc._run(
            lambda: self.sb.table("practitioner_assignments")
            .select("*")
            .eq("id", str(assignment_id))
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    async def _get_practitioner(self, practitioner_id: UUID) -> Optional[Dict[str, Any]]:
        resp = await svc._run(
            lambda: self.sb.table("practitioners")
            .select("*")
            .eq("id", str(practitioner_id))
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    async def _get_practitioner_by_user_id(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        resp = await svc._run(
            lambda: self.sb.table("practitioners")
            .select("*")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    async def _get_org_membership(self, user_id: UUID, organization_id: UUID) -> Optional[Dict[str, Any]]:
        resp = await svc._run(
            lambda: self.sb.table("organization_members")
            .select("*")
            .eq("organization_id", str(organization_id))
            .eq("user_id", str(user_id))
            .in_("status", ["active", "pending"])
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    async def _verify_user_exists(self, user_id: UUID) -> None:
        resp = await svc._run(
            lambda: self.sb.table("users")
            .select("id")
            .eq("id", str(user_id))
            .limit(1)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client user not found")

    async def _has_active_or_pending_pair(self, practitioner_id: UUID, client_user_id: UUID) -> bool:
        resp = await svc._run(
            lambda: self.sb.table("practitioner_assignments")
            .select("id,status")
            .eq("practitioner_id", str(practitioner_id))
            .eq("client_user_id", str(client_user_id))
            .in_("status", list(ACTIVE_ASSIGNMENT_STATUSES))
            .limit(1)
            .execute()
        )
        return bool(resp.data)

    async def _list_admin_org_ids(self, user_id: UUID) -> List[str]:
        resp = await svc._run(
            lambda: self.sb.table("organization_members")
            .select("organization_id,role,org_role,status")
            .eq("user_id", str(user_id))
            .execute()
        )
        rows = resp.data or []
        org_ids: List[str] = []
        for row in rows:
            role = str(row.get("org_role") or row.get("role") or "").lower()
            status_value = str(row.get("status") or "active").lower()
            org_id = row.get("organization_id")
            if status_value == "active" and role in ADMIN_ORG_ROLES and org_id:
                org_ids.append(str(org_id))
        return sorted(set(org_ids))

    async def create_assignment(
        self,
        practitioner_id: UUID,
        client_user_id: UUID,
        org_id: UUID,
        assigned_by: UUID,
        notes: Optional[str],
    ) -> Dict[str, Any]:
        practitioner = await self._get_practitioner(practitioner_id)
        if not practitioner:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practitioner not found")

        if str(practitioner.get("status") or "inactive").lower() != "active":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Practitioner is not active")

        membership = await self._get_org_membership(UUID(practitioner["user_id"]), org_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Practitioner is not a member of this organization",
            )

        await self._verify_user_exists(client_user_id)

        if await self._has_active_or_pending_pair(practitioner_id, client_user_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Active or pending assignment already exists for this practitioner-client pair",
            )

        current_clients = int(practitioner.get("current_clients") or 0)
        max_clients = int(practitioner.get("max_clients") or 0)
        if max_clients > 0 and current_clients >= max_clients:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Practitioner is at capacity")

        now = datetime.now(timezone.utc).isoformat()
        payload = {
            "practitioner_id": str(practitioner_id),
            "client_user_id": str(client_user_id),
            "organization_id": str(org_id),
            "assigned_by": str(assigned_by),
            "status": "pending",
            "notes": notes,
            "assigned_at": now,
            "created_at": now,
            "updated_at": now,
        }

        resp = await svc._run(lambda: self.sb.table("practitioner_assignments").insert(payload).execute())
        if not resp.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create assignment")
        return resp.data[0]

    async def activate_assignment(self, assignment_id: UUID, activated_by: UUID) -> Dict[str, Any]:
        assignment = await self._get_assignment(assignment_id)
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

        if assignment.get("status") != "pending":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Only pending assignment can be activated")

        now = datetime.now(timezone.utc).isoformat()
        resp = await svc._run(
            lambda: self.sb.table("practitioner_assignments")
            .update(
                {
                    "status": "active",
                    "activated_at": now,
                    "updated_at": now,
                }
            )
            .eq("id", str(assignment_id))
            .eq("status", "pending")
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Assignment state changed before activation")
        return resp.data[0]

    async def complete_assignment(self, assignment_id: UUID, completed_by: UUID) -> Dict[str, Any]:
        assignment = await self._get_assignment(assignment_id)
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

        if assignment.get("status") != "active":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Only active assignment can be completed")

        now = datetime.now(timezone.utc).isoformat()
        resp = await svc._run(
            lambda: self.sb.table("practitioner_assignments")
            .update(
                {
                    "status": "completed",
                    "completed_at": now,
                    "updated_at": now,
                }
            )
            .eq("id", str(assignment_id))
            .eq("status", "active")
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Assignment state changed before completion")
        return resp.data[0]

    async def cancel_assignment(self, assignment_id: UUID, cancelled_by: UUID) -> Dict[str, Any]:
        assignment = await self._get_assignment(assignment_id)
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

        if assignment.get("status") not in {"pending", "active"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only pending or active assignment can be cancelled",
            )

        now = datetime.now(timezone.utc).isoformat()
        resp = await svc._run(
            lambda: self.sb.table("practitioner_assignments")
            .update({"status": "cancelled", "updated_at": now})
            .eq("id", str(assignment_id))
            .in_("status", ["pending", "active"])
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Assignment state changed before cancellation")
        return resp.data[0]

    async def list_assignments_for_practitioner(
        self,
        practitioner_id: UUID,
        scope_user_id: UUID,
        global_role: str,
    ) -> List[Dict[str, Any]]:
        role = (global_role or "").lower()
        query = self.sb.table("practitioner_assignments").select("*").eq("practitioner_id", str(practitioner_id))

        if role in {"super_admin", "admin"}:
            pass
        elif role in ADMIN_ORG_ROLES:
            org_ids = await self._list_admin_org_ids(scope_user_id)
            if not org_ids:
                return []
            query = query.in_("organization_id", org_ids)
        elif role == "practitioner":
            own_practitioner = await self._get_practitioner_by_user_id(scope_user_id)
            if not own_practitioner or str(own_practitioner.get("id")) != str(practitioner_id):
                return []
        else:
            return []

        resp = await svc._run(lambda: query.order("updated_at", desc=True).execute())
        return resp.data or []

    async def list_assignments_for_client(
        self,
        client_user_id: UUID,
        scope_user_id: UUID,
        global_role: str,
    ) -> List[Dict[str, Any]]:
        role = (global_role or "").lower()
        query = self.sb.table("practitioner_assignments").select("*").eq("client_user_id", str(client_user_id))

        if role in {"super_admin", "admin"}:
            pass
        elif role in ADMIN_ORG_ROLES:
            org_ids = await self._list_admin_org_ids(scope_user_id)
            if not org_ids:
                return []
            query = query.in_("organization_id", org_ids)
        elif role == "end_user":
            if str(scope_user_id) != str(client_user_id):
                return []
        elif role == "practitioner":
            own_practitioner = await self._get_practitioner_by_user_id(scope_user_id)
            if not own_practitioner:
                return []
            query = query.eq("practitioner_id", str(own_practitioner["id"]))
        else:
            return []

        resp = await svc._run(lambda: query.order("updated_at", desc=True).execute())
        return resp.data or []

    async def list_assignments(
        self,
        scope_user_id: UUID,
        global_role: str,
        practitioner_id: Optional[UUID] = None,
        client_user_id: Optional[UUID] = None,
        status_value: Optional[str] = None,
        org_id: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        role = (global_role or "").lower()
        query = self.sb.table("practitioner_assignments").select("*")

        if role in {"super_admin", "admin"}:
            pass
        elif role in ADMIN_ORG_ROLES:
            org_ids = await self._list_admin_org_ids(scope_user_id)
            if not org_ids:
                return []
            query = query.in_("organization_id", org_ids)
        elif role == "practitioner":
            own_practitioner = await self._get_practitioner_by_user_id(scope_user_id)
            if not own_practitioner:
                return []
            query = query.eq("practitioner_id", str(own_practitioner["id"]))
        elif role == "end_user":
            query = query.eq("client_user_id", str(scope_user_id))
        else:
            return []

        if practitioner_id:
            query = query.eq("practitioner_id", str(practitioner_id))
        if client_user_id:
            query = query.eq("client_user_id", str(client_user_id))
        if org_id:
            query = query.eq("organization_id", str(org_id))
        if status_value:
            query = query.eq("status", status_value)

        resp = await svc._run(lambda: query.order("updated_at", desc=True).execute())
        return resp.data or []

    async def get_assignment_with_scope(
        self,
        assignment_id: UUID,
        scope_user_id: UUID,
        global_role: str,
    ) -> Optional[Dict[str, Any]]:
        rows = await self.list_assignments(scope_user_id=scope_user_id, global_role=global_role)
        for row in rows:
            if str(row.get("id")) == str(assignment_id):
                return row
        return None
