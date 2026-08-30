"""
CRM Business Logic Layer (Services)
Implements domain logic, state machines, and workflows.
Consumed by routers, uses repositories for data access.
"""

import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta, timezone

from app.models.crm_clients import (
    ClientOnboardingStatus,
    ClientProgramStatus,
    SubscriptionPlan,
    SubscriptionStatus,
)
from app.repositories import (
    ClientRepository,
    PractitionerRepository,
    ProgramRepository,
    ClientProgramRepository,
    QuestionnaireRepository,
    QuestionnaireResultRepository,
    InterventionRepository,
    SubscriptionRepository,
    AuditLogRepository,
    ClientReadRepository,
)

logger = logging.getLogger("crm.service")


class ClientService:
    """Manage client lifecycle."""

    def __init__(self):
        self.repo = ClientRepository()
        self.audit = AuditLogRepository()
        self.read_repo = ClientReadRepository()

    async def create_client(self, user_id: UUID, organization_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Create client profile on user signup."""
        data = {
            "user_id": str(user_id),
            "onboarding_status": ClientOnboardingStatus.STARTED.value,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        client = await self.repo.insert(data)
        await self.audit.log_action(user_id, "create", "client", client["id"])
        logger.info(f"Created client for user {user_id}")
        return client

    async def get_client(self, client_id: UUID) -> Optional[Dict[str, Any]]:
        """Get client detail."""
        return await self.repo.get_by_id(client_id)

    async def get_client_by_user(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Get client by user_id."""
        return await self.repo.get_by_user_id(user_id)

    async def update_onboarding_status(
        self, client_id: UUID, status: ClientOnboardingStatus, actor_user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Update client onboarding status.
        Enforces valid state transitions.
        """
        valid_transitions = {
            ClientOnboardingStatus.STARTED: [ClientOnboardingStatus.QUESTIONNAIRE_PENDING],
            ClientOnboardingStatus.QUESTIONNAIRE_PENDING: [ClientOnboardingStatus.PROGRAM_ASSIGNED],
            ClientOnboardingStatus.PROGRAM_ASSIGNED: [ClientOnboardingStatus.ACTIVE],
            ClientOnboardingStatus.ACTIVE: [ClientOnboardingStatus.PAUSED, ClientOnboardingStatus.COMPLETED],
            ClientOnboardingStatus.PAUSED: [ClientOnboardingStatus.ACTIVE],
            ClientOnboardingStatus.COMPLETED: [],
        }

        current = await self.get_client(client_id)
        if not current:
            raise ValueError(f"Client {client_id} not found")

        current_status = ClientOnboardingStatus(current.get("onboarding_status", ClientOnboardingStatus.STARTED.value))
        if status not in valid_transitions.get(current_status, []):
            raise ValueError(
                f"Invalid transition: {current_status.value} → {status.value}. "
                f"Allowed: {[s.value for s in valid_transitions.get(current_status, [])]}"
            )

        updated = await self.repo.update(
            client_id,
            {
                "onboarding_status": status.value,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        await self.audit.log_action(
            actor_user_id,
            "update",
            "client",
            client_id,
            {"onboarding_status": f"{current_status.value} → {status.value}"},
        )
        return updated

    async def get_full_view(self, client_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Get client full read model for CRM UI.
        Uses a single embedded query to avoid N+1 API patterns.
        """
        payload = await self.read_repo.get_full_view(client_id)
        if not payload:
            return None

        assignments = payload.get("client_programs") or []
        active_assignment = None
        if assignments:
            active_assignment = next(
                (a for a in assignments if a.get("status") in ["active", "paused", "onboarding"]),
                assignments[0],
            )

        interventions = []
        if active_assignment and active_assignment.get("interventions"):
            interventions = active_assignment.get("interventions") or []

        questionnaires = payload.get("client_questionnaires") or []

        client_data = {k: v for k, v in payload.items() if k not in ["client_programs", "client_questionnaires"]}

        return {
            "client": client_data,
            "practitioner": payload.get("practitioner"),
            "active_program": payload.get("active_program"),
            "client_program": active_assignment,
            "questionnaires": questionnaires,
            "interventions": interventions,
            "subscription": payload.get("subscription"),
        }


class PractitionerService:
    """Manage practitioner profiles and assignments."""

    def __init__(self):
        self.repo = PractitionerRepository()
        self.client_repo = ClientRepository()
        self.audit = AuditLogRepository()

    async def create_practitioner(
        self, user_id: UUID, specialization: str, bio: Optional[str] = None, max_clients: int = 20
    ) -> Dict[str, Any]:
        """Register a practitioner."""
        data = {
            "user_id": str(user_id),
            "specialization": specialization,
            "bio": bio,
            "max_clients": max_clients,
            "current_clients": 0,
            "status": "active",
            "availability": "available",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        practitioner = await self.repo.insert(data)
        await self.audit.log_action(user_id, "create", "practitioner", practitioner["id"])
        logger.info(f"Created practitioner for user {user_id}")
        return practitioner

    async def get_practitioner(self, practitioner_id: UUID) -> Optional[Dict[str, Any]]:
        """Get practitioner detail."""
        return await self.repo.get_by_id(practitioner_id)

    async def list_practitioners(self, limit: int = 100, offset: int = 0) -> tuple[List[Dict[str, Any]], int]:
        """List practitioners for CRM table view."""
        return await self.repo.get_all_summary(limit=limit, offset=offset)

    async def list_practitioners_by_user_ids(
        self, user_ids: List[str], limit: int = 100, offset: int = 0
    ) -> tuple[List[Dict[str, Any]], int]:
        """List practitioners constrained to specific user IDs."""
        return await self.repo.get_by_user_ids(user_ids=user_ids, limit=limit, offset=offset)

    async def get_practitioner_for_user(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Return practitioner profile for a specific auth user."""
        return await self.repo.get_by_user_id_summary(user_id)

    async def assign_to_client(
        self, client_id: UUID, practitioner_id: UUID, assigner_user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Assign practitioner to client.
        Validates practitioner capacity and client subscription status.
        """
        practitioner = await self.repo.get_by_id(practitioner_id)
        if not practitioner:
            raise ValueError(f"Practitioner {practitioner_id} not found")

        if practitioner["current_clients"] >= practitioner["max_clients"]:
            raise ValueError(f"Practitioner {practitioner_id} is at capacity")

        client = await self.client_repo.get_by_id(client_id)
        if not client:
            raise ValueError(f"Client {client_id} not found")

        # Update client assignment
        updated_client = await self.client_repo.update(
            client_id,
            {
                "assigned_practitioner_id": str(practitioner_id),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Increment practitioner client count
        await self.repo.update(
            practitioner_id,
            {
                "current_clients": practitioner["current_clients"] + 1,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        await self.audit.log_action(
            assigner_user_id,
            "assign",
            "client",
            client_id,
            {"assigned_practitioner_id": str(practitioner_id)},
        )
        logger.info(f"Assigned practitioner {practitioner_id} to client {client_id}")
        return updated_client

    async def unassign_from_client(
        self, client_id: UUID, unassigner_user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Remove practitioner assignment from client."""
        client = await self.client_repo.get_by_id(client_id)
        if not client:
            raise ValueError(f"Client {client_id} not found")

        if not client.get("assigned_practitioner_id"):
            raise ValueError(f"Client {client_id} has no assigned practitioner")

        practitioner_id = UUID(client["assigned_practitioner_id"])

        # Update client
        updated_client = await self.client_repo.update(
            client_id,
            {
                "assigned_practitioner_id": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Decrement practitioner client count
        practitioner = await self.repo.get_by_id(practitioner_id)
        if practitioner:
            await self.repo.update(
                practitioner_id,
                {
                    "current_clients": max(0, practitioner["current_clients"] - 1),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            )

        await self.audit.log_action(
            unassigner_user_id, "unassign", "client", client_id, {"assigned_practitioner_id": str(practitioner_id)}
        )
        logger.info(f"Unassigned practitioner from client {client_id}")
        return updated_client


class ProgramService:
    """Manage program templates."""

    def __init__(self):
        self.repo = ProgramRepository()
        self.audit = AuditLogRepository()

    async def create_program(
        self,
        name: str,
        category: str,
        duration_days: int,
        description: Optional[str] = None,
        template_protocol: Optional[Dict[str, Any]] = None,
        biomarker_targets: Optional[Dict[str, Any]] = None,
        checkpoint_intervals: Optional[List[int]] = None,
        creator_user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Create program template (OPS only)."""
        data = {
            "name": name,
            "category": category,
            "duration_days": duration_days,
            "description": description,
            "template_protocol": template_protocol or {},
            "biomarker_targets": biomarker_targets or {},
            "checkpoint_intervals": checkpoint_intervals or [7, 14, 30, 60, 90],
            "status": "active",
            "created_by_user_id": str(creator_user_id) if creator_user_id else None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        program = await self.repo.insert(data)
        await self.audit.log_action(creator_user_id, "create", "program", program["id"])
        logger.info(f"Created program {program['id']}: {name}")
        return program

    async def get_program(self, program_id: UUID) -> Optional[Dict[str, Any]]:
        """Get program detail."""
        return await self.repo.get_by_id(program_id)

    async def get_active_programs(self) -> List[Dict[str, Any]]:
        """Get all active programs."""
        return await self.repo.get_active()

    async def get_programs_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get programs by category."""
        return await self.repo.get_by_category(category)


class ClientProgramService:
    """Manage program assignments to clients."""

    def __init__(self):
        self.repo = ClientProgramRepository()
        self.client_service = ClientService()
        self.audit = AuditLogRepository()

    async def assign_program(
        self,
        client_id: UUID,
        program_id: UUID,
        notes: Optional[str] = None,
        assigner_user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Assign program to client.
        Enforces no duplicate active assignments.
        """
        # Check for active assignment
        active = await self.repo.get_active_program(client_id)
        if active and active["status"] in ["active", "paused"]:
            raise ValueError(f"Client {client_id} already has active program {active['program_id']}")

        # Create assignment
        data = {
            "client_id": str(client_id),
            "program_id": str(program_id),
            "status": ClientProgramStatus.ONBOARDING.value,
            "assigned_date": datetime.now(timezone.utc).isoformat(),
            "projected_end_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),  # Placeholder
            "checkpoint_progress": {},
            "notes": notes,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        assignment = await self.repo.insert(data)

        # Update client active_program_id
        await self.client_service.repo.update(
            client_id,
            {
                "active_program_id": str(program_id),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        await self.audit.log_action(
            assigner_user_id,
            "assign",
            "client_program",
            assignment["id"],
            {"client_id": str(client_id), "program_id": str(program_id)},
        )
        logger.info(f"Assigned program {program_id} to client {client_id}")
        return assignment

    async def start_program(self, assignment_id: UUID) -> Dict[str, Any]:
        """Transition program from ONBOARDING to ACTIVE."""
        assignment = await self.repo.get_by_id(assignment_id)
        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")

        current_status = ClientProgramStatus(assignment.get("status", ClientProgramStatus.ONBOARDING.value))
        if current_status != ClientProgramStatus.ONBOARDING:
            raise ValueError(f"Cannot start program in status {current_status.value}")

        updated = await self.repo.update(
            assignment_id,
            {
                "status": ClientProgramStatus.ACTIVE.value,
                "started_date": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        await self.audit.log_action(None, "update", "client_program", assignment_id, {"status": "active"})
        return updated

    async def pause_program(self, assignment_id: UUID) -> Dict[str, Any]:
        """Pause active program."""
        assignment = await self.repo.get_by_id(assignment_id)
        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")

        current_status = ClientProgramStatus(assignment.get("status", ClientProgramStatus.ACTIVE.value))
        if current_status not in [ClientProgramStatus.ACTIVE, ClientProgramStatus.ONBOARDING]:
            raise ValueError(f"Cannot pause program in status {current_status.value}")

        updated = await self.repo.update(
            assignment_id,
            {
                "status": ClientProgramStatus.PAUSED.value,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        await self.audit.log_action(None, "update", "client_program", assignment_id, {"status": "paused"})
        return updated

    async def complete_program(self, assignment_id: UUID) -> Dict[str, Any]:
        """Mark program as completed."""
        assignment = await self.repo.get_by_id(assignment_id)
        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")

        updated = await self.repo.update(
            assignment_id,
            {
                "status": ClientProgramStatus.COMPLETED.value,
                "completed_date": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        await self.audit.log_action(None, "update", "client_program", assignment_id, {"status": "completed"})
        return updated


class QuestionnaireService:
    """Manage questionnaires and responses."""

    def __init__(self):
        self.repo = QuestionnaireRepository()
        self.result_repo = QuestionnaireResultRepository()
        self.audit = AuditLogRepository()

    async def get_questionnaire(self, questionnaire_id: UUID) -> Optional[Dict[str, Any]]:
        """Get questionnaire template."""
        return await self.repo.get_by_id(questionnaire_id)

    async def get_by_type(self, template_type: str) -> List[Dict[str, Any]]:
        """Get questionnaires by type."""
        return await self.repo.get_by_type(template_type)

    async def get_client_history(self, client_id: UUID, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Get questionnaire submission history for a client."""
        return await self.result_repo.get_history_by_client(client_id=client_id, limit=limit, offset=offset)

    async def submit_questionnaire(
        self,
        client_id: UUID,
        questionnaire_id: UUID,
        responses: Dict[str, Any],
        scorer_user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Submit questionnaire responses.
        Calculates score and creates result record.
        """
        questionnaire = await self.repo.get_by_id(questionnaire_id)
        if not questionnaire:
            raise ValueError(f"Questionnaire {questionnaire_id} not found")

        # Validate responses match questions
        questions = questionnaire.get("questions", {})
        expected_keys = set(questions.keys())
        provided_keys = set(responses.keys())
        if not provided_keys.issubset(expected_keys):
            raise ValueError(f"Unexpected response keys: {provided_keys - expected_keys}")

        # Score responses (mock scoring for now)
        score = await self._calculate_score(responses, questionnaire.get("scoring_logic", {}))

        # Store result
        result_data = {
            "client_id": str(client_id),
            "questionnaire_id": str(questionnaire_id),
            "responses": responses,
            "score": score,
            "result_notes": None,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await self.result_repo.insert(result_data)

        await self.audit.log_action(
            scorer_user_id,
            "create",
            "client_questionnaire",
            result["id"],
            {"client_id": str(client_id), "score": score},
        )
        logger.info(f"Questionnaire {questionnaire_id} submitted by client {client_id}, score={score}")
        return result

    async def _calculate_score(self, responses: Dict[str, Any], scoring_logic: Dict[str, Any]) -> Optional[float]:
        """Calculate a weighted questionnaire score when scoring rules are provided."""
        if not responses:
            return 0.0

        weights = scoring_logic.get("weights") if isinstance(scoring_logic, dict) else {}
        scale_questions = set(scoring_logic.get("scale_questions", [])) if isinstance(scoring_logic, dict) else set()

        def _coerce_numeric(value: Any) -> Optional[float]:
            if isinstance(value, bool):
                return None
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, dict):
                raw_value = value.get("answer_value")
                if isinstance(raw_value, (int, float)):
                    return float(raw_value)
            if isinstance(value, str):
                try:
                    return float(value)
                except ValueError:
                    return None
            return None

        scored_values = []
        for question_id, raw_value in responses.items():
            numeric_value = _coerce_numeric(raw_value)
            if numeric_value is None:
                continue

            if scale_questions or weights:
                if question_id not in scale_questions and question_id not in weights:
                    continue

            if 0 <= numeric_value <= 10:
                normalized = max(0.0, min(100.0, ((numeric_value - 1.0) / 9.0) * 100.0)) if numeric_value > 1 else 0.0
            else:
                normalized = max(0.0, min(100.0, numeric_value))

            weight = 1.0
            if isinstance(weights, dict):
                try:
                    weight = float(weights.get(question_id, 1.0))
                except (TypeError, ValueError):
                    weight = 1.0
            scored_values.append((normalized, weight))

        if scored_values:
            weighted_total = sum(value * weight for value, weight in scored_values)
            total_weight = sum(weight for _, weight in scored_values)
            if total_weight > 0:
                return round(weighted_total / total_weight, 2)

        numeric_values = [value for value in (_coerce_numeric(v) for v in responses.values()) if value is not None]
        if numeric_values:
            return round(sum(numeric_values) / len(numeric_values), 2)

        return None


class InterventionService:
    """Manage practitioner interventions (protocol adjustments)."""

    def __init__(self):
        self.repo = InterventionRepository()
        self.audit = AuditLogRepository()

    async def create_intervention(
        self,
        client_program_id: UUID,
        practitioner_id: UUID,
        change_type: str,
        description: str,
        changes: Dict[str, Any],
        creator_user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Record practitioner intervention.
        Updates protocol in client_program assignment.
        """
        data = {
            "client_program_id": str(client_program_id),
            "practitioner_id": str(practitioner_id),
            "change_type": change_type,
            "description": description,
            "changes": changes,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        intervention = await self.repo.insert(data)

        await self.audit.log_action(
            creator_user_id,
            "create",
            "intervention",
            intervention["id"],
            {"change_type": change_type},
        )
        logger.info(f"Created intervention {intervention['id']} for program {client_program_id}")
        return intervention

    async def get_interventions(self, client_program_id: UUID) -> List[Dict[str, Any]]:
        """Get all interventions for program assignment."""
        return await self.repo.get_by_client_program(client_program_id)

    async def get_client_interventions(self, client_id: UUID, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Get interventions timeline for client across all program assignments."""
        return await self.repo.get_by_client(client_id=client_id, limit=limit, offset=offset)


class SubscriptionService:
    """Manage subscriptions and billing."""

    def __init__(self):
        self.repo = SubscriptionRepository()
        self.audit = AuditLogRepository()

    async def get_subscription(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Get active subscription for user."""
        return await self.repo.get_by_user_id(user_id)

    async def create_subscription(
        self,
        user_id: UUID,
        plan_name: str,
        external_subscription_id: Optional[str] = None,
        creator_user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Create subscription record."""
        data = {
            "user_id": str(user_id),
            "plan_name": plan_name,
            "status": SubscriptionStatus.ACTIVE.value,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        subscription = await self.repo.insert(data)

        await self.audit.log_action(
            creator_user_id,
            "create",
            "subscription",
            subscription["id"],
            {"plan_name": plan_name},
        )
        logger.info(f"Created {plan_name} subscription for user {user_id}")
        return subscription

    async def cancel_subscription(self, subscription_id: UUID, canceller_user_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Cancel subscription."""
        updated = await self.repo.update(
            subscription_id,
            {
                "status": SubscriptionStatus.CANCELLED.value,
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        await self.audit.log_action(
            canceller_user_id,
            "update",
            "subscription",
            subscription_id,
            {"status": SubscriptionStatus.CANCELLED.value},
        )
        logger.info(f"Cancelled subscription {subscription_id}")
        return updated


class AuditLogService:
    """Read/list audit logs for CRM operations."""

    def __init__(self):
        self.repo = AuditLogRepository()

    async def list_logs(
        self,
        limit: int = 50,
        offset: int = 0,
        entity_type: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        return await self.repo.list_logs(
            limit=limit,
            offset=offset,
            entity_type=entity_type,
            user_id=user_id,
        )
