from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from app.models.partners.constants import EMBEDDED_TOKEN_POLICY
from app.schemas.partners.embedded import EmbeddedTokenPrincipal
from app.services import supabase_service as supabase


def hash_embedded_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except (TypeError, ValueError):
        return False


async def resolve_partner_patient_id(partner_id: str, patient_ref: str) -> Optional[str]:
    normalized_ref = str(patient_ref or "").strip()
    if not normalized_ref:
        return None

    client = supabase._get_supabase()
    if _is_uuid(normalized_ref):
        by_id = await supabase._run(
            lambda: client.table("partner_patients")
            .select("id")
            .eq("partner_id", partner_id)
            .eq("id", normalized_ref)
            .limit(1)
            .execute()
        )
        rows = by_id.data or []
        if rows:
            return str(rows[0].get("id") or "") or None

    by_external = await supabase._run(
        lambda: client.table("partner_patients")
        .select("id")
        .eq("partner_id", partner_id)
        .eq("external_patient_id", normalized_ref)
        .limit(1)
        .execute()
    )
    rows = by_external.data or []
    if rows:
        return str(rows[0].get("id") or "") or None
    return None


async def create_embedded_session_token(
    *,
    partner_id: str,
    partner_patient_id: str,
    partner_lab_result_id: str,
    ttl_seconds: int,
) -> Dict[str, Any]:
    if EMBEDDED_TOKEN_POLICY != "multi_use_short_session":
        raise RuntimeError("Unsupported embedded token policy")

    raw_token = f"ptk_{secrets.token_urlsafe(32)}"
    token_hash = hash_embedded_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

    payload = {
        "partner_id": partner_id,
        "partner_patient_id": partner_patient_id,
        "partner_lab_result_id": partner_lab_result_id,
        "token_hash": token_hash,
        "expires_at": expires_at.isoformat(),
    }

    client = supabase._get_supabase()
    response = await supabase._run(lambda: client.table("partner_embedded_sessions").insert(payload).execute())
    row = (response.data or [{}])[0]
    return {
        "token": raw_token,
        "expires_at": expires_at,
        "session_id": str(row.get("id") or ""),
    }


async def resolve_embedded_token(token: str) -> Optional[EmbeddedTokenPrincipal]:
    if EMBEDDED_TOKEN_POLICY != "multi_use_short_session":
        raise RuntimeError("Unsupported embedded token policy")

    token_hash = hash_embedded_token((token or "").strip())
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("partner_embedded_sessions")
        .select("id,partner_id,partner_patient_id,partner_lab_result_id,expires_at,consumed_at")
        .eq("token_hash", token_hash)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        return None

    row = rows[0]
    expires_at = datetime.fromisoformat(str(row["expires_at"]).replace("Z", "+00:00"))
    if expires_at < datetime.now(timezone.utc):
        return None

    # Current policy: reusable short-lived token. consumed_at is informational only.
    consumed_at = row.get("consumed_at")
    consumed = datetime.fromisoformat(str(consumed_at).replace("Z", "+00:00")) if consumed_at else None

    return EmbeddedTokenPrincipal(
        partner_id=str(row["partner_id"]),
        partner_patient_id=str(row["partner_patient_id"]),
        partner_lab_result_id=str(row["partner_lab_result_id"]),
        session_id=str(row["id"]),
        expires_at=expires_at,
        consumed_at=consumed,
    )
