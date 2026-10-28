"""P20 Intervention Memory — CRUD for the current user's self-reported
intervention events (supplements, nutrition, training, sleep, stress,
illness, medication, alcohol, weight change, protocol actions).

Every read/write is scoped to the authenticated user's own rows —
supabase_service.py's get/update/delete_intervention_event functions all
filter by (id, user_id), so a user can never read or modify another
user's events even by guessing a valid uuid. No practitioner access in
this v1 (per P20's explicit scope guard — left for a later stage once
the authorization model for practitioner write-access to a client's
self-reported events is decided)."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

_EVENT_TYPES = Literal[
    "supplement", "nutrition", "training", "sleep", "stress", "illness",
    "medication", "alcohol", "weight_change", "protocol_action", "other",
]
_ADHERENCE = Literal["unknown", "low", "partial", "high"]
_INTENSITY = Literal["low", "moderate", "high"]


class InterventionEventCreate(BaseModel):
    event_type: _EVENT_TYPES
    label: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    ongoing: bool = False
    adherence: Optional[_ADHERENCE] = None
    intensity: Optional[_INTENSITY] = None
    dose: Optional[str] = Field(default=None, max_length=100)
    frequency: Optional[str] = Field(default=None, max_length=100)
    related_protocol_id: Optional[str] = None
    related_recommendation_id: Optional[str] = None
    action_id: Optional[str] = None
    source_report_version_id: Optional[UUID] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class InterventionEventUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    ongoing: Optional[bool] = None
    adherence: Optional[_ADHERENCE] = None
    intensity: Optional[_INTENSITY] = None
    dose: Optional[str] = Field(default=None, max_length=100)
    frequency: Optional[str] = Field(default=None, max_length=100)


@router.get("")
async def list_interventions(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return await svc.get_intervention_events(user_id)


@router.post("", status_code=201)
async def create_intervention(
    body: InterventionEventCreate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    if body.action_id or body.source_report_version_id:
        if body.event_type != "protocol_action" or not body.action_id or not body.source_report_version_id:
            raise HTTPException(status_code=400, detail="action_id and source_report_version_id are required for protocol actions")
        report_version = await svc.get_report_version_for_user(user_id, str(body.source_report_version_id))
        if not report_version or not _report_contains_action(report_version, body.action_id):
            raise HTTPException(status_code=404, detail="Protocol action not found")
        return await svc.complete_protocol_action(
            user_id=user_id,
            action_id=body.action_id,
            report_version_id=str(body.source_report_version_id),
            label=body.label,
            description=body.description,
            metadata=body.metadata,
        )
    # source is always "user" for this endpoint — practitioner/protocol/
    # import/system sources are reserved for a later, separately-authorized
    # write path (see this module's docstring).
    data = {**body.model_dump(mode="json", exclude_none=True), "source": "user"}
    return await svc.create_intervention_event(user_id, data)


def _report_contains_action(report_version: dict[str, Any], action_id: str) -> bool:
    def contains(value: Any) -> bool:
        if isinstance(value, dict):
            if value.get("action_id") == action_id:
                return True
            return any(contains(child) for child in value.values())
        if isinstance(value, list):
            return any(contains(child) for child in value)
        return False

    return contains(report_version.get("input_snapshot")) or contains(report_version.get("protocol")) or contains(report_version.get("knowledge_report"))


@router.patch("/{event_id}")
async def update_intervention(
    event_id: str,
    body: InterventionEventUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    data = body.model_dump(mode="json", exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await svc.update_intervention_event(user_id, event_id, data)
    if result is None:
        raise HTTPException(status_code=404, detail="Intervention event not found")
    return result


@router.delete("/{event_id}", status_code=204)
async def delete_intervention(
    event_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    deleted = await svc.delete_intervention_event(user_id, event_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Intervention event not found")
    return None
