"""
CRM Data Access Layer (Repository Pattern)
Isolates Supabase queries and handles data transformation.
"""

import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone

from app.services import supabase_service as svc

logger = logging.getLogger("crm.repository")


class BaseRepository:
    """Base repository with common Supabase operations."""

    def __init__(self, table_name: str):
        self.table_name = table_name

    async def get_by_id(self, record_id: UUID) -> Optional[Dict[str, Any]]:
        """Fetch single record by ID."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table(self.table_name)
                .select("*")
                .eq("id", str(record_id))
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception as e:
            logger.error(f"Error fetching {self.table_name} {record_id}: {e}")
            return None

    async def get_all(self, limit: int = 100, offset: int = 0) -> tuple[List[Dict[str, Any]], int]:
        """Fetch paginated records."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table(self.table_name)
                .select("*", count="exact")
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            return resp.data or [], resp.count or 0
        except Exception as e:
            logger.error(f"Error fetching {self.table_name}: {e}")
            return [], 0

    async def insert(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Insert single record."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table(self.table_name)
                .insert(data)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception as e:
            logger.error(f"Error inserting into {self.table_name}: {e}")
            raise

    async def update(self, record_id: UUID, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update record."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table(self.table_name)
                .update(data)
                .eq("id", str(record_id))
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception as e:
            logger.error(f"Error updating {self.table_name} {record_id}: {e}")
            raise

    async def delete(self, record_id: UUID) -> bool:
        """Delete record."""
        try:
            sb = svc._get_supabase()
            await svc._run(
                lambda: sb.table(self.table_name)
                .delete()
                .eq("id", str(record_id))
                .execute()
            )
            return True
        except Exception as e:
            logger.error(f"Error deleting from {self.table_name}: {e}")
            return False


class ClientRepository(BaseRepository):
    """Client-specific data access."""

    def __init__(self):
        super().__init__("clients")

    async def get_by_user_id(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Get client by user_id (should be unique)."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("clients")
                .select("*")
                .eq("user_id", str(user_id))
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception as e:
            logger.error(f"Error fetching client by user_id {user_id}: {e}")
            return None

    async def get_by_practitioner(
        self, practitioner_id: UUID, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all clients assigned to practitioner."""
        try:
            sb = svc._get_supabase()
            query = sb.table("clients").select("*").eq("assigned_practitioner_id", str(practitioner_id))
            if status:
                query = query.eq("onboarding_status", status)
            resp = await svc._run(lambda: query.execute())
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching clients for practitioner {practitioner_id}: {e}")
            return []

    async def get_in_organization(self, org_id: UUID) -> List[Dict[str, Any]]:
        """Get all clients in organization (via members)."""
        try:
            sb = svc._get_supabase()
            # Join clients with organization_members
            resp = await svc._run(
                lambda: sb.table("clients")
                .select("""
                    *,
                    users!inner(id, email, full_name)
                """)
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching org clients for {org_id}: {e}")
            return []


class PractitionerRepository(BaseRepository):
    """Practitioner-specific data access."""

    def __init__(self):
        super().__init__("practitioners")

    async def get_by_user_id(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Get practitioner by user_id."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("practitioners")
                .select("*")
                .eq("user_id", str(user_id))
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception as e:
            logger.error(f"Error fetching practitioner by user_id {user_id}: {e}")
            return None

    async def get_available(self, organization_id: UUID) -> List[Dict[str, Any]]:
        """Get available practitioners in organization."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("practitioners")
                .select("*")
                .eq("status", "active")
                .lt("current_clients", sb.table("practitioners").select("max_clients"))
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching available practitioners: {e}")
            return []

    async def get_all_summary(self, limit: int = 100, offset: int = 0) -> tuple[List[Dict[str, Any]], int]:
        """Get practitioner list rows used by CRM list endpoint."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("practitioners")
                .select(
                    "id,user_id,specialization,bio,status,availability,current_clients,max_clients,created_at",
                    count="exact",
                )
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            return resp.data or [], resp.count or 0
        except Exception as e:
            logger.error(f"Error fetching practitioner summary list: {e}")
            return [], 0

    async def get_by_user_ids(self, user_ids: List[str], limit: int = 100, offset: int = 0) -> tuple[List[Dict[str, Any]], int]:
        """Get practitioners scoped to a list of user IDs."""
        ids = [str(uid) for uid in set(user_ids or []) if uid]
        if not ids:
            return [], 0

        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("practitioners")
                .select(
                    "id,user_id,specialization,bio,status,availability,current_clients,max_clients,created_at",
                    count="exact",
                )
                .in_("user_id", ids)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            return resp.data or [], resp.count or 0
        except Exception as e:
            logger.error(f"Error fetching practitioners by user ids: {e}")
            return [], 0

    async def get_by_user_id_summary(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Get one practitioner row for specific user_id with list fields."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("practitioners")
                .select("id,user_id,specialization,bio,status,availability,current_clients,max_clients,created_at")
                .eq("user_id", str(user_id))
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception as e:
            logger.error(f"Error fetching practitioner summary by user_id {user_id}: {e}")
            return None


class ProgramRepository(BaseRepository):
    """Program template data access."""

    def __init__(self):
        super().__init__("programs")

    async def get_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get programs by category."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("programs")
                .select("*")
                .eq("category", category)
                .eq("status", "active")
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching programs for category {category}: {e}")
            return []

    async def get_active(self) -> List[Dict[str, Any]]:
        """Get all active programs."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("programs")
                .select("*")
                .eq("status", "active")
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching active programs: {e}")
            return []


class ClientProgramRepository(BaseRepository):
    """Program assignment data access."""

    def __init__(self):
        super().__init__("client_programs")

    async def get_by_client(self, client_id: UUID, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all program assignments for client."""
        try:
            sb = svc._get_supabase()
            query = sb.table("client_programs").select("*").eq("client_id", str(client_id))
            if status:
                query = query.eq("status", status)
            resp = await svc._run(lambda: query.execute())
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching programs for client {client_id}: {e}")
            return []

    async def get_active_program(self, client_id: UUID) -> Optional[Dict[str, Any]]:
        """Get currently active program assignment."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("client_programs")
                .select("*")
                .eq("client_id", str(client_id))
                .in_("status", ["active", "paused"])
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception as e:
            logger.error(f"Error fetching active program for client {client_id}: {e}")
            return None


class QuestionnaireRepository(BaseRepository):
    """Questionnaire template data access."""

    def __init__(self):
        super().__init__("questionnaires")

    async def get_by_type(self, template_type: str) -> List[Dict[str, Any]]:
        """Get questionnaires by template type."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("questionnaires")
                .select("*")
                .eq("template_type", template_type)
                .eq("status", "active")
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching questionnaires for type {template_type}: {e}")
            return []

    async def get_by_program(self, program_id: UUID) -> List[Dict[str, Any]]:
        """Get questionnaires for program."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("questionnaires")
                .select("*")
                .eq("program_id", str(program_id))
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching questionnaires for program {program_id}: {e}")
            return []


class QuestionnaireResultRepository(BaseRepository):
    """Questionnaire response data access."""

    def __init__(self):
        super().__init__("client_questionnaires")

    async def get_by_client(self, client_id: UUID) -> List[Dict[str, Any]]:
        """Get questionnaire responses for client."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("client_questionnaires")
                .select("*")
                .eq("client_id", str(client_id))
                .order("completed_at", desc=True)
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching questionnaire results for client {client_id}: {e}")
            return []

    async def get_history_by_client(self, client_id: UUID, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Get lightweight questionnaire history for a client."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("client_questionnaires")
                .select("id,questionnaire_id,score,completed_at")
                .eq("client_id", str(client_id))
                .order("completed_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching questionnaire history for client {client_id}: {e}")
            return []


class InterventionRepository(BaseRepository):
    """Practitioner intervention data access."""

    def __init__(self):
        super().__init__("interventions")

    async def get_by_client_program(self, client_program_id: UUID) -> List[Dict[str, Any]]:
        """Get all interventions for program assignment."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("interventions")
                .select("*")
                .eq("client_program_id", str(client_program_id))
                .order("created_at", desc=True)
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching interventions for {client_program_id}: {e}")
            return []

    async def get_by_client(self, client_id: UUID, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Get all interventions for a client via client_programs join."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("interventions")
                .select("id,client_program_id,practitioner_id,change_type,created_at,client_programs!inner(client_id)")
                .eq("client_programs.client_id", str(client_id))
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.error(f"Error fetching interventions for client {client_id}: {e}")
            return []


class SubscriptionRepository(BaseRepository):
    """Subscription data access."""

    def __init__(self):
        super().__init__("subscriptions")

    async def get_by_user_id(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Get active subscription for user."""
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("subscriptions")
                .select("*")
                .eq("user_id", str(user_id))
                .eq("status", "active")
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception as e:
            logger.error(f"Error fetching subscription for user {user_id}: {e}")
            return None


class AuditLogRepository(BaseRepository):
    """Audit log data access."""

    def __init__(self):
        super().__init__("audit_logs")

    async def log_action(
        self,
        user_id: Optional[UUID],
        action: str,
        entity_type: str,
        entity_id: UUID,
        changes: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Log audit entry (fire-and-forget)."""
        try:
            data = {
                "user_id": str(user_id) if user_id else None,
                "action": action,
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "changes": changes or {},
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await self.insert(data)
            return True
        except Exception as e:
            logger.warning(f"Audit log failed (non-critical): {e}")
            return False

    async def list_logs(
        self,
        limit: int = 50,
        offset: int = 0,
        entity_type: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        """List audit logs with optional filters."""
        try:
            sb = svc._get_supabase()
            query = (
                sb.table("audit_logs")
                .select("*", count="exact")
                .order("created_at", desc=True)
            )
            if entity_type:
                query = query.eq("entity_type", entity_type)
            if user_id:
                query = query.eq("user_id", str(user_id))

            resp = await svc._run(lambda: query.range(offset, offset + limit - 1).execute())
            return resp.data or [], resp.count or 0
        except Exception as e:
            logger.error(f"Error listing audit logs: {e}")
            return [], 0


class ClientReadRepository:
    """Aggregated read models for client-centric CRM views."""

    async def get_full_view(self, client_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Fetch aggregated client full view with embedded relations in one DB call.
        Designed for Stage 6 UI to avoid N+1 and minimize latency.
        """
        try:
            sb = svc._get_supabase()
            resp = await svc._run(
                lambda: sb.table("clients")
                .select(
                    """
                    *,
                    practitioner:practitioners!clients_assigned_practitioner_id_fkey(*),
                    active_program:programs!clients_active_program_id_fkey(*),
                    subscription:subscriptions!clients_subscription_id_fkey(*),
                    client_programs(*, interventions(*)),
                    client_questionnaires(*)
                    """
                )
                .eq("id", str(client_id))
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception as e:
            logger.error(f"Error fetching full view for client {client_id}: {e}")
            return None
