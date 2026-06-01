from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException

from app.services import supabase_service as supabase

ALLOWED_GOVERNANCE_STATUS = {"draft", "reviewed", "active", "deprecated"}
ALLOWED_OPERATORS = {"lt", "lte", "gt", "gte", "eq", "neq", "in", "not_in", "exists"}
FORBIDDEN_WORDING = ("confirmed diagnosis", "diagnosis confirmed")


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


def _parse_version(version: Any) -> int:
    raw = str(version or "").strip().lower()
    if raw.startswith("v"):
        raw = raw[1:]
    try:
        value = int(raw)
        return value if value > 0 else 1
    except (TypeError, ValueError):
        return 1


def _ensure_text_without_forbidden(value: Any, field_name: str) -> None:
    if not isinstance(value, str):
        return
    low = value.lower()
    if any(phrase in low for phrase in FORBIDDEN_WORDING):
        raise HTTPException(status_code=400, detail=f"Medical wording is forbidden in {field_name}")


def _validate_condition_item(item: Dict[str, Any], *, location: str) -> None:
    if not isinstance(item, dict):
        raise HTTPException(status_code=400, detail=f"Each condition in {location} must be an object")

    marker = str(item.get("lab_marker") or "").strip()
    symptom = str(item.get("symptom") or "").strip()
    key = str(item.get("key") or "").strip()
    ctype = str(item.get("type") or "").strip()
    if not ((marker or symptom) or (key and ctype)):
        raise HTTPException(status_code=400, detail=f"Condition in {location} must include lab_marker/symptom or type+key")

    operator = str(item.get("operator") or "").strip().lower()
    # Evaluator-compatible shorthand: {"symptom": "fatigue"} is valid without operator/value.
    if symptom and not operator and not marker and not key:
        return

    if operator not in ALLOWED_OPERATORS:
        raise HTTPException(status_code=400, detail=f"Unsupported operator in {location}: {operator or '<empty>'}")

    if operator in {"exists"}:
        return

    has_value = "value" in item and item.get("value") is not None
    has_values = "values" in item and isinstance(item.get("values"), list) and len(item.get("values")) > 0
    if operator in {"in", "not_in"}:
        if not has_values:
            raise HTTPException(status_code=400, detail=f"Operator {operator} in {location} requires non-empty values")
    elif not has_value:
        raise HTTPException(status_code=400, detail=f"Operator {operator} in {location} requires value")


def _validate_conditions_schema(conditions: Any) -> None:
    if not isinstance(conditions, dict):
        raise HTTPException(status_code=400, detail="conditions must be an object")

    has_all = "all" in conditions
    has_any = "any" in conditions
    if not has_all and not has_any:
        raise HTTPException(status_code=400, detail="conditions must contain all or any")

    if has_all:
        all_items = conditions.get("all")
        if not isinstance(all_items, list):
            raise HTTPException(status_code=400, detail="conditions.all must be an array")
        for idx, item in enumerate(all_items):
            _validate_condition_item(item, location=f"conditions.all[{idx}]")

    if has_any:
        any_items = conditions.get("any")
        if not isinstance(any_items, list):
            raise HTTPException(status_code=400, detail="conditions.any must be an array")
        for idx, item in enumerate(any_items):
            _validate_condition_item(item, location=f"conditions.any[{idx}]")


def _validate_outputs_schema(outputs: Any) -> None:
    if not isinstance(outputs, dict):
        raise HTTPException(status_code=400, detail="outputs must be an object")

    has_recommendation_keys = isinstance(outputs.get("recommendation_keys"), list) and len(outputs.get("recommendation_keys")) > 0
    has_recommendations = isinstance(outputs.get("recommendations"), list) and len(outputs.get("recommendations")) > 0
    has_risk_summary = bool(str(outputs.get("risk") or "").strip()) or bool(str(outputs.get("summary") or "").strip())
    if not (has_recommendation_keys or has_recommendations or has_risk_summary):
        raise HTTPException(
            status_code=400,
            detail="outputs must include recommendation_keys or recommendations or risk/summary",
        )

    _ensure_text_without_forbidden(outputs.get("summary"), "outputs.summary")
    recommendations = outputs.get("recommendations")
    if isinstance(recommendations, list):
        for idx, rec in enumerate(recommendations):
            if not isinstance(rec, dict):
                continue
            _ensure_text_without_forbidden(rec.get("title"), f"outputs.recommendations[{idx}].title")
            _ensure_text_without_forbidden(rec.get("body"), f"outputs.recommendations[{idx}].body")


async def _supports_rule_copy_columns() -> bool:
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("knowledge_rules")
        .select("id,copied_from_rule_id,copied_from_version")
        .limit(1)
        .execute()
    )
    _ = response.data or []
    return True


def _contains_forbidden_wording(payload: Dict[str, Any]) -> bool:
    text_fragments: List[str] = []

    name = payload.get("name")
    if isinstance(name, str):
        text_fragments.append(name)

    description = payload.get("description")
    if isinstance(description, str):
        text_fragments.append(description)

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

    _validate_conditions_schema(payload.get("conditions"))
    _validate_outputs_schema(payload.get("outputs"))


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
        "id,key,name,description,input_entities,confidence,severity,requires_doctor,source,source_url,version,copied_from_rule_id,copied_from_version,active,governance_status,last_modified_by,medical_reviewed_by,medical_reviewed_at,change_note,created_at,updated_at"
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


async def create_draft_copy(rule_id: str, payload: Dict[str, Any], *, actor_user_id: str) -> Dict[str, Any]:
    existing = await _load_rule(rule_id)
    status = str(existing.get("governance_status") or "").lower()
    if status not in {"active", "deprecated"}:
        raise HTTPException(status_code=400, detail="Draft copy can be created only from active or deprecated rule")

    change_note = str(payload.get("change_note") or "").strip()
    if not change_note:
        raise HTTPException(status_code=400, detail="change_note is required")

    last_modified_by = str(payload.get("last_modified_by") or "").strip()
    if not _is_uuid(last_modified_by):
        raise HTTPException(status_code=400, detail="last_modified_by must be a valid UUID")

    next_version = f"v{_parse_version(existing.get('version')) + 1}"
    row: Dict[str, Any] = {
        "key": str(existing.get("key") or "").strip(),
        "name": str(existing.get("name") or "").strip(),
        "description": existing.get("description"),
        "input_entities": existing.get("input_entities") if isinstance(existing.get("input_entities"), list) else [],
        "conditions": existing.get("conditions") if isinstance(existing.get("conditions"), dict) else {},
        "outputs": existing.get("outputs") if isinstance(existing.get("outputs"), dict) else {},
        "confidence": existing.get("confidence") if existing.get("confidence") is not None else 0.5,
        "severity": existing.get("severity"),
        "requires_doctor": bool(existing.get("requires_doctor", False)),
        "explanation_template": str(existing.get("explanation_template") or "").strip(),
        "source": str(existing.get("source") or "").strip(),
        "source_url": str(existing.get("source_url") or "").strip(),
        "governance_status": "draft",
        "active": False,
        "last_modified_by": last_modified_by,
        "medical_reviewed_by": None,
        "medical_reviewed_at": None,
        "change_note": change_note,
        "auto_update_allowed": bool(existing.get("auto_update_allowed", False)),
        "version": next_version,
    }

    _validate_common_payload(row)

    client = supabase._get_supabase()
    supports_copy_columns = False
    try:
        supports_copy_columns = await _supports_rule_copy_columns()
    except Exception:
        supports_copy_columns = False

    if supports_copy_columns:
        row["copied_from_rule_id"] = rule_id
        row["copied_from_version"] = existing.get("version")

    response = await supabase._run(lambda: client.table("knowledge_rules").insert(row).execute())
    rows = response.data or []
    created = rows[0] if rows else row

    await supabase.write_audit_log(
        user_id=actor_user_id if _is_uuid(actor_user_id) else None,
        action="create",
        entity_type="knowledge_rule",
        entity_id=str(created.get("id") or ""),
        old_value={
            "copied_from_rule_id": rule_id,
            "copied_from_version": existing.get("version"),
        },
        new_value={
            "governance_status": "draft",
            "version": created.get("version"),
            "change_note": change_note,
        },
    )

    return created


async def list_recommendations() -> List[Dict[str, Any]]:
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("recommendations")
        .select("id,key,title,category,priority,requires_doctor,evidence_level,source")
        .order("key")
        .execute()
    )
    return response.data or []


async def get_recommendation(recommendation_id: str) -> Dict[str, Any]:
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("recommendations")
        .select("id,key,title,body,category,priority,requires_doctor,evidence_level,source,source_url,metadata")
        .eq("id", recommendation_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return rows[0]


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
                "medical_reviewed_at": _utc_now_iso(),
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

    async def _load_legacy_audit_rows() -> List[Dict[str, Any]]:
        legacy_response = await supabase._run(
            lambda: client.table("audit_logs")
            .select("id,user_id,action,entity_type,entity_id,changes,created_at")
            .in_("entity_type", ["knowledge_rule", "client"])
            .order("created_at", desc=True)
            .limit(min(5000, safe_limit * 20))
            .execute()
        )
        rows = legacy_response.data or []
        normalized: List[Dict[str, Any]] = []
        for row in rows:
            changes = row.get("changes") if isinstance(row.get("changes"), dict) else {}
            entity_type = str(row.get("entity_type") or "")
            entity_id = str(row.get("entity_id") or "")
            source_entity_type = str(changes.get("source_entity_type") or "")
            source_entity_id = str(changes.get("source_entity_id") or "")

            is_direct_match = entity_type == "knowledge_rule" and entity_id == rule_id
            is_legacy_match = (
                entity_type == "client"
                and source_entity_type == "knowledge_rule"
                and source_entity_id == rule_id
            )
            if not (is_direct_match or is_legacy_match):
                continue

            normalized.append(
                {
                    "id": row.get("id"),
                    "user_id": row.get("user_id"),
                    "action": row.get("action"),
                    "entity_type": "knowledge_rule",
                    "entity_id": rule_id,
                    "old_value": changes.get("old_value") if isinstance(changes.get("old_value"), dict) else {},
                    "new_value": changes.get("new_value") if isinstance(changes.get("new_value"), dict) else {},
                    "timestamp": row.get("created_at"),
                }
            )
        return normalized[:safe_limit]

    try:
        response = await supabase._run(
            lambda: client.table("audit_logs")
            .select("id,user_id,action,entity_type,entity_id,old_value,new_value,timestamp")
            .eq("entity_type", "knowledge_rule")
            .eq("entity_id", rule_id)
            .order("timestamp", desc=True)
            .limit(safe_limit)
            .execute()
        )
        rows = response.data or []
        if rows:
            return rows
    except Exception:
        pass

    # Compatibility fallback for deployments where audit_logs stores payload
    # in changes jsonb and/or knowledge events were written through legacy CRM
    # constraints as entity_type=client.
    return await _load_legacy_audit_rows()
