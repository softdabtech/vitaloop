from __future__ import annotations

from typing import Any, Dict, Optional

from app.models.partners.constants import PARTNER_EVENT_TYPES
from app.services import supabase_service as supabase


def normalize_event_type(event_type: str) -> str:
    normalized = (event_type or "").strip().lower()
    if normalized not in PARTNER_EVENT_TYPES:
        raise ValueError(f"Unsupported partner event_type: {event_type}")
    return normalized


async def track_partner_event(
    *,
    partner_id: str,
    event_type: str,
    partner_patient_id: Optional[str] = None,
    partner_lab_result_id: Optional[str] = None,
    event_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    client = supabase._get_supabase()
    payload = {
        "partner_id": partner_id,
        "event_type": normalize_event_type(event_type),
        "partner_patient_id": partner_patient_id,
        "partner_lab_result_id": partner_lab_result_id,
        "event_payload": event_payload or {},
    }
    response = await supabase._run(
        lambda: client.table("partner_events")
        .insert(payload)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else payload
