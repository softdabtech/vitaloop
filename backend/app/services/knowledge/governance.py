from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException

from app.services import supabase_service as supabase

ALLOWED_GOVERNANCE_STATUS = {"draft", "reviewed", "active", "deprecated"}
FORBIDDEN_WORDING = ("confirmed diagnosis",)


def _is_uuid(value: str | None) -> bool:
    if not value:
        return False
    try:
        UUID(value)
        return True
    except (ValueError, TypeError):
        return False


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _contains_forbidden_wording(payload: Dict[str, Any]) -> bool:
    text_fragments: List[str] = []

    explanation = payload.get("explanation_template")
    if isinstance(explanation, str):
        text_fragments.append(explanation)

    outputs = payload.get("outputs")
    if isinstance(outputs, dict):
        text_fragments.append(json.dumps(outputs, ensure_ascii=True))

    joined = "\n".join(text_fragments).lower()
    return any(phrase in joined for phrase in FORBIDDEN_WORDING)


def _validate_common_payload(payload: Dict[str, Any]) -> None:
    if _contains_forbidden_wording(payload):
        raise HTTPException(status_code=400, detail="Medical rule wording must not use confirmed diagnosis")

    source = str(payload.get("source") or "").strip()
    source_url = str(payload.get("source_url") or "").strip()
    if not source or not source_url:
        raise HTTPException(status_code=400, detail="source and source_url are required")


async def _load_rule(rule_id: str) -> Dict[str, Any]:
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("knowledge_rules")
        .select("*")
        .eq("id", rule_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Knowledge rule not found")
    return rows[0]


async def list_rules(
    *,
    governance_status: Optional[str] = None,
    active: Optional[bool] = None,
    key: Optional[str] = None,
    source: Optional[str] = None,
    requires_doctor: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    client = supabase._get_supabase()
    query = client.table("knowledge_rules").select(
        "id,key,name,description,input_entities,confidence,severity,requires_doctor,source,source_url,version,active,governance_status,last_modified_by,medical_reviewed_by,medical_reviewed_at,change_note,created_at,updated_at"
    )

    if governance_status:
        status_value = str(governance_status).strip().lower()
        if status_value not in ALLOWED_GOVERNANCE_STATUS:
            raise HTTPException(status_code=400, detail="Unsupported governance_status")
        query = query.eq("governance_status", status_value)

    if active is not None:
        query = query.eq("active", active)

    if key:
        query = query.ilike("key", f"%{key.strip()}%")

    if source:
        query = query.ilike("source", f"%{source.strip()}%")

    if requires_doctor is not None:
        query = query.eq("requires_doctor", requires_doctor)

    response = await supabase._run(lambda: query.order("updated_at", desc=True).execute())
    return response.data or []


async def get_rule(rule_id: str) -> Dict[str, Any]:
    return await _load_rule(rule_id)


async def create_rule(payload: Dict[str, Any], *, actor_user_id: str) -> Dict[str, Any]:
    governance_status = str(payload.get("governance_status") or "draft").strip().lower()
    if governance_status != "draft":
        raise HTTPException(status_code=400, detail="New knowledge rule must be created in draft status")

    _validate_common_payload(payload)

    last_modified_by = str(payload.get("last_modified_by") or "").strip()
    if not _is_uuid(last_modified_by):
        raise HTTPException(status_code=400, detail="last_modified_by must be a valid UUID")

    change_note = str(payload.get("change_note") or "").strip()
    if not change_note:
        raise HTTPException(status_code=400, detail="change_note is required")

    row = {
        "key": str(payload.get("key") or "").strip(),
        "name": str(payload.get("name") or "").strip(),
        "description": payload.get("description"),
        "input_entities": payload.get("input_entities") or [],
        "conditions": payload.get("conditions") or {},
        "outputs": payload.get("outputs") or {},
        "confidence": payload.get("confidence") if payload.get("confidence") is not None else 0.5,
        "severity": payload.get("severity"),
        "requires_doctor": bool(payload.get("requires_doctor", False)),
        "explanation_template": str(payload.get("explanation_template") or "").strip(),
        "source": str(payload.get("source") or "").strip(),
        "source_url": str(payload.get("source_url") or "").strip(),
        "governance_status": "draft",
        "active": False,
        "last_modified_by": last_modified_by,
        "medical_reviewed_by": payload.get("medical_reviewed_by"),
        "medical_reviewed_at": payload.get("medical_reviewed_at"),
        "change_note": change_note,
        "auto_update_allowed": bool(payload.get("auto_update_allowed", False)),
        "version": payload.get("version") or "v1",
    }

    if not row["key"] or not row["name"]:
        raise HTTPException(status_code=400, detail="key and name are required")
    if not isinstance(row["conditions"], dict) or not row["conditions"]:
        raise HTTPException(status_code=400, detail="conditions are required")
    if not isinstance(row["outputs"], dict) or not row["outputs"]:
        raise HTTPException(status_code=400, detail="outputs are required")
    if not row["explanation_template"]:
        raise HTTPException(status_code=400, detail="explanation_template is required")

    client = supabase._get_supabase()
    response = await supabase._run(lambda: client.table("knowledge_rules").insert(row).execute())
    rows = response.data or []
    created = rows[0] if rows else row

    await supabase.write_audit_log(
        user_id=actor_user_id if _is_uuid(actor_user_id) else None,
        action="create",
        entity_type="knowledge_rule",
        entity_id=str(created.get("id") or ""),
        new_value={
            "key": created.get("key"),
            "governance_status": created.get("governance_status"),
            "change_note": change_note,
        },
    )

    return created


async def update_rule(rule_id: str, payload: Dict[str, Any], *, actor_user_id: str) -> Dict[str, Any]:
    existing = await _load_rule(rule_id)

    status = str(existing.get("governance_status") or "").lower()
    if status == "active":
        raise HTTPException(
            status_code=409,
            detail="Active rule cannot be edited directly; create a new draft version",
        )

    if status not in {"draft", "reviewed", "deprecated"}:
        raise HTTPException(status_code=400, detail="Rule status is not editable")

    change_note = str(payload.get("change_note") or "").strip()
    if not change_note:
        raise HTTPException(status_code=400, detail="change_note is required")

    last_modified_by = str(payload.get("last_modified_by") or "").strip()
    if not _is_uuid(last_modified_by):
        raise HTTPException(status_code=400, detail="last_modified_by must be a valid UUID")

    next_payload = {
        "explanation_template": payload.get("explanation_template", existing.get("explanation_template")),
        "outputs": payload.get("outputs", existing.get("outputs")),
        "source": payload.get("source", existing.get("source")),
        "source_url": payload.get("source_url", existing.get("source_url")),
    }
    _validate_common_payload(next_payload)

    updates: Dict[str, Any] = {
        "name": payload.get("name", existing.get("name")),
        "description": payload.get("description", existing.get("description")),
        "input_entities": payload.get("input_entities", existing.get("input_entities")),
        "conditions": payload.get("conditions", existing.get("conditions")),
        "outputs": payload.get("outputs", existing.get("outputs")),
        "confidence": payload.get("confidence", existing.get("confidence")),
        "severity": payload.get("severity", existing.get("severity")),
        "requires_doctor": payload.get("requires_doctor", existing.get("requires_doctor")),
        "explanation_template": payload.get("explanation_template", existing.get("explanation_template")),
        "source": payload.get("source", existing.get("source")),
        "source_url": payload.get("source_url", existing.get("source_url")),
        "last_modified_by": last_modified_by,
        "change_note": change_note,
        "auto_update_allowed": payload.get("auto_update_allowed", existing.get("auto_update_allowed")),
        "version": payload.get("version", existing.get("version")),
        "updated_at": _utc_now_iso(),
    }

    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("knowledge_rules")
        .update(updates)
        .eq("id", rule_id)
        .execute()
    )
    rows = response.data or []
    updated = rows[0] if rows else await _load_rule(rule_id)

    await supabase.write_audit_log(
        user_id=actor_user_id if _is_uuid(actor_user_id) else None,
        action="update",
        entity_type="knowledge_rule",
        entity_id=rule_id,
        old_value={
            "governance_status": existing.get("governance_status"),
            "version": existing.get("version"),
        },
        new_value={
            "governance_status": updated.get("governance_status"),
            "version": updated.get("version"),
            "change_note": change_note,
        },
    )

    return updated


async def submit_rule_review(rule_id: str, payload: Dict[str, Any], *, actor_user_id: str) -> Dict[str, Any]:
    existing = await _load_rule(rule_id)
    status = str(existing.get("governance_status") or "").lower()
    if status != "draft":
        raise HTTPException(status_code=400, detail="Only draft rules can be submitted for review")

    change_note = str(payload.get("change_note") or "").strip()
    last_modified_by = str(payload.get("last_modified_by") or "").strip()
    if not change_note:
        raise HTTPException(status_code=400, detail="change_note is required")
    if not _is_uuid(last_modified_by):
        raise HTTPException(status_code=400, detail="last_modified_by must be a valid UUID")

    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("knowledge_rules")
        .update(
            {
                "governance_status": "reviewed",
                "active": False,
                "last_modified_by": last_modified_by,
                "change_note": change_note,
                "updated_at": _utc_now_iso(),
            }
        )
        .eq("id", rule_id)
        .execute()
    )
    rows = response.data or []
    updated = rows[0] if rows else await _load_rule(rule_id)

    await supabase.write_audit_log(
        user_id=actor_user_id if _is_uuid(actor_user_id) else None,
        action="update",
        entity_type="knowledge_rule",
        entity_id=rule_id,
        old_value={"governance_status": "draft"},
        new_value={"governance_status": "reviewed", "change_note": change_note},
    )
    return updated


async def approve_rule(rule_id: str, payload: Dict[str, Any], *, actor_user_id: str) -> Dict[str, Any]:
    existing = await _load_rule(rule_id)
    status = str(existing.get("governance_status") or "").lower()
    if status != "reviewed":
        raise HTTPException(status_code=400, detail="Only reviewed rules can be approved")

    medical_reviewed_by = str(payload.get("medical_reviewed_by") or "").strip()
    if not _is_uuid(medical_reviewed_by):
        raise HTTPException(status_code=400, detail="medical_reviewed_by must be a valid UUID")

    change_note = str(payload.get("change_note") or "").strip()
    if not change_note:
        raise HTTPException(status_code=400, detail="change_note is required")

    reviewed_at = payload.get("medical_reviewed_at") or _utc_now_iso()
    last_modified_by = str(payload.get("last_modified_by") or medical_reviewed_by)
    if not _is_uuid(last_modified_by):
        raise HTTPException(status_code=400, detail="last_modified_by must be a valid UUID")

    client = supabase._get_supabase()

    # Deprecate currently active rule with same key (if exists) before activating this one.
    existing_key = str(existing.get("key") or "").strip()
    if existing_key:
        await supabase._run(
            lambda: client.table("knowledge_rules")
            .update(
                {
                    "governance_status": "deprecated",
                    "active": False,
                    "last_modified_by": last_modified_by,
                    "change_note": f"auto-deprecated: replacement approved ({rule_id})",
                    "updated_at": _utc_now_iso(),
                }
            )
            .eq("key", existing_key)
            .neq("id", rule_id)
            .eq("governance_status", "active")
            .execute()
        )

    response = await supabase._run(
        lambda: client.table("knowledge_rules")
        .update(
            {
                "governance_status": "active",
                "active": True,
                "medical_reviewed_by": medical_reviewed_by,
                "medical_reviewed_at": reviewed_at,
                "last_modified_by": last_modified_by,
                "change_note": change_note,
                "updated_at": _utc_now_iso(),
            }
        )
        .eq("id", rule_id)
        .execute()
    )
    rows = response.data or []
    updated = rows[0] if rows else await _load_rule(rule_id)

    await supabase.write_audit_log(
        user_id=actor_user_id if _is_uuid(actor_user_id) else None,
        action="update",
        entity_type="knowledge_rule",
        entity_id=rule_id,
        old_value={"governance_status": "reviewed"},
        new_value={
            "governance_status": "active",
            "medical_reviewed_by": medical_reviewed_by,
            "medical_reviewed_at": reviewed_at,
            "change_note": change_note,
        },
    )
    return updated


async def deprecate_rule(rule_id: str, payload: Dict[str, Any], *, actor_user_id: str) -> Dict[str, Any]:
    existing = await _load_rule(rule_id)

    status = str(existing.get("governance_status") or "").lower()
    if status not in {"active", "reviewed", "draft", "deprecated"}:
        raise HTTPException(status_code=400, detail="Rule status cannot be deprecated")

    change_note = str(payload.get("change_note") or "").strip()
    last_modified_by = str(payload.get("last_modified_by") or "").strip()
    if not change_note:
        raise HTTPException(status_code=400, detail="change_note is required")
    if not _is_uuid(last_modified_by):
        raise HTTPException(status_code=400, detail="last_modified_by must be a valid UUID")

    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("knowledge_rules")
        .update(
            {
                "governance_status": "deprecated",
                "active": False,
                "last_modified_by": last_modified_by,
                "change_note": change_note,
                "updated_at": _utc_now_iso(),
            }
        )
        .eq("id", rule_id)
        .execute()
    )
    rows = response.data or []
    updated = rows[0] if rows else await _load_rule(rule_id)

    await supabase.write_audit_log(
        user_id=actor_user_id if _is_uuid(actor_user_id) else None,
        action="update",
        entity_type="knowledge_rule",
        entity_id=rule_id,
        old_value={"governance_status": status},
        new_value={"governance_status": "deprecated", "change_note": change_note},
    )
    return updated


async def get_rule_audit(rule_id: str, *, limit: int = 200) -> List[Dict[str, Any]]:
    _ = await _load_rule(rule_id)
    safe_limit = max(1, min(limit, 500))

    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("audit_logs")
        .select("id,user_id,action,entity_type,entity_id,old_value,new_value,timestamp")
        .eq("entity_type", "knowledge_rule")
        .eq("entity_id", rule_id)
        .order("timestamp", desc=True)
        .limit(safe_limit)
        .execute()
    )
    return response.data or []
