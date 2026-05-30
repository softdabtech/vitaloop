from __future__ import annotations

from typing import Any, Dict

from app.schemas.partners.results import PartnerResultIngestRequest
from app.services import supabase_service as supabase
from app.services.intelligence.partner_pipeline import build_partner_insights
from app.services.lab_adapters import get_adapter
from app.services.partners.auth import PartnerPrincipal
from app.services.partners.events import track_partner_event
from app.services.partners.idempotency import find_existing_partner_result


async def _upsert_partner_patient(partner_id: str, external_patient_id: str) -> Dict[str, Any]:
    client = supabase._get_supabase()
    payload = {
        "partner_id": partner_id,
        "external_patient_id": external_patient_id,
    }
    response = await supabase._run(
        lambda: client.table("partner_patients")
        .upsert(payload, on_conflict="partner_id,external_patient_id")
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else payload


async def _insert_partner_lab_result(payload: Dict[str, Any]) -> Dict[str, Any]:
    client = supabase._get_supabase()
    response = await supabase._run(lambda: client.table("partner_lab_results").insert(payload).execute())
    rows = response.data or []
    return rows[0] if rows else payload


def _require_row_id(row: Dict[str, Any], *, entity_name: str) -> str:
    row_id = str(row.get("id") or "").strip()
    if not row_id:
        raise RuntimeError(f"{entity_name} insert returned no id")
    return row_id


async def _replace_partner_biomarkers(partner_lab_result_id: str, biomarkers: list[Dict[str, Any]]) -> None:
    client = supabase._get_supabase()
    await supabase._run(
        lambda: client.table("partner_biomarkers")
        .delete()
        .eq("partner_lab_result_id", partner_lab_result_id)
        .execute()
    )

    if not biomarkers:
        return

    rows = []
    for biomarker in biomarkers:
        row = dict(biomarker)
        row["partner_lab_result_id"] = partner_lab_result_id
        rows.append(row)

    await supabase._run(lambda: client.table("partner_biomarkers").insert(rows).execute())


async def _insert_partner_insight(partner_lab_result_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    client = supabase._get_supabase()
    row = {
        "partner_lab_result_id": partner_lab_result_id,
        "insight_payload": payload,
    }
    response = await supabase._run(lambda: client.table("partner_insights").insert(row).execute())
    rows = response.data or []
    return rows[0] if rows else row


async def get_partner_insight(partner_id: str, partner_lab_result_id: str) -> Dict[str, Any] | None:
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("partner_insights")
        .select("id,insight_payload,partner_lab_results!inner(id,partner_id)")
        .eq("partner_lab_result_id", partner_lab_result_id)
        .eq("partner_lab_results.partner_id", partner_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


async def ingest_partner_result(request: PartnerResultIngestRequest, principal: PartnerPrincipal) -> Dict[str, Any]:
    existing = await find_existing_partner_result(
        partner_id=principal.partner_id,
        external_result_id=request.external_result_id,
        external_order_id=request.external_order_id,
    )
    if existing:
        await track_partner_event(
            partner_id=principal.partner_id,
            event_type="result_received",
            partner_lab_result_id=str(existing.get("id") or ""),
            event_payload={"duplicate": True},
        )
        return {
            "partner_lab_result_id": str(existing.get("id") or ""),
            "status": "duplicate",
            "insight_id": None,
            "duplicate": True,
            "biomarkers": [],
        }

    patient = await _upsert_partner_patient(principal.partner_id, request.external_patient_id)

    raw_payload = {
        "partner_id": principal.partner_id,
        "partner_patient_id": str(patient.get("id") or request.external_patient_id),
        "external_order_id": request.external_order_id,
        "external_result_id": request.external_result_id,
        "source_lab": request.lab_name or "smartlab",
        "result_date": request.result_date.isoformat() if request.result_date else None,
        "status": "received",
        "raw_payload": request.lab_result,
        "canonical_payload": {},
    }
    inserted = await _insert_partner_lab_result(raw_payload)
    partner_lab_result_id = _require_row_id(inserted, entity_name="partner_lab_result")

    await track_partner_event(
        partner_id=principal.partner_id,
        event_type="result_received",
        partner_patient_id=str(patient.get("id") or None),
        partner_lab_result_id=partner_lab_result_id,
    )

    adapter = get_adapter(request.lab_name or request.partner_slug)
    canonical = adapter.to_canonical(request, request.lab_result)
    biomarker_rows = [b.model_dump() for b in canonical.biomarkers]

    await _replace_partner_biomarkers(partner_lab_result_id, biomarker_rows)
    await track_partner_event(
        partner_id=principal.partner_id,
        event_type="result_normalized",
        partner_patient_id=str(patient.get("id") or None),
        partner_lab_result_id=partner_lab_result_id,
        event_payload={"biomarker_count": len(biomarker_rows)},
    )

    insight_payload = build_partner_insights(canonical)
    insight = await _insert_partner_insight(partner_lab_result_id, insight_payload)

    client = supabase._get_supabase()
    await supabase._run(
        lambda: client.table("partner_lab_results")
        .update({
            "status": "processed",
            "canonical_payload": canonical.model_dump(mode="json"),
        })
        .eq("id", partner_lab_result_id)
        .execute()
    )

    await track_partner_event(
        partner_id=principal.partner_id,
        event_type="insight_generated",
        partner_patient_id=str(patient.get("id") or None),
        partner_lab_result_id=partner_lab_result_id,
    )

    await supabase.write_audit_log(
        user_id=None,
        action="partner_result_ingested",
        entity_type="partner_lab_result",
        entity_id=partner_lab_result_id,
        new_value={
            "partner_id": principal.partner_id,
            "external_result_id": request.external_result_id,
            "insight_id": insight.get("id"),
            "biomarker_count": len(biomarker_rows),
        },
    )

    return {
        "partner_lab_result_id": partner_lab_result_id,
        "status": "processed",
        "insight_id": str(insight.get("id") or ""),
        "duplicate": False,
        "biomarkers": biomarker_rows,
    }
