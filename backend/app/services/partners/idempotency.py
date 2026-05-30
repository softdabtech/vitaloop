from __future__ import annotations

from typing import Any, Dict, Optional

from app.services import supabase_service as supabase


def is_duplicate_external_ids(
    existing: Optional[Dict[str, Any]],
    *,
    external_result_id: str,
    external_order_id: str,
) -> bool:
    if not existing:
        return False
    return (
        str(existing.get("external_result_id") or "") == str(external_result_id)
        and str(existing.get("external_order_id") or "") == str(external_order_id)
    )


async def find_existing_partner_result(
    *,
    partner_id: str,
    external_result_id: str,
    external_order_id: str,
) -> Optional[Dict[str, Any]]:
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("partner_lab_results")
        .select("id,partner_id,external_result_id,external_order_id,status")
        .eq("partner_id", partner_id)
        .eq("external_result_id", external_result_id)
        .eq("external_order_id", external_order_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None
