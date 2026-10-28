#!/usr/bin/env python3
"""Seed Smartlab partner records in staging.

Usage examples:
  python scripts/seed_partner_smartlab.py --api-key "smartlab_staging_key"
  python scripts/seed_partner_smartlab.py --generate-api-key --with-fixtures
"""

from __future__ import annotations

import argparse
import asyncio
import secrets
from datetime import date

from app.services import supabase_service as supabase
from app.services.partners.auth import hash_partner_api_key

DEFAULT_SCOPES = ["results:write", "results:read", "embedded:create", "events:write"]


async def _upsert_partner(slug: str, display_name: str) -> dict:
    client = supabase._get_supabase()
    payload = {
        "slug": slug,
        "display_name": display_name,
        "status": "active",
        "metadata": {"seeded_by": "seed_partner_smartlab.py"},
    }
    response = await supabase._run(
        lambda: client.table("partners")
        .upsert(payload, on_conflict="slug")
        .execute()
    )
    rows = response.data or []
    if rows and rows[0].get("id"):
        return rows[0]

    fallback = await supabase._run(
        lambda: client.table("partners")
        .select("id,slug,display_name")
        .eq("slug", slug)
        .limit(1)
        .execute()
    )
    rows = fallback.data or []
    if not rows:
        raise RuntimeError("Failed to resolve partner row after upsert")
    return rows[0]


async def _upsert_partner_key(partner_id: str, api_key: str, key_label: str) -> dict:
    client = supabase._get_supabase()
    payload = {
        "partner_id": partner_id,
        "key_hash": hash_partner_api_key(api_key),
        "key_label": key_label,
        "status": "active",
        "scopes": DEFAULT_SCOPES,
    }
    response = await supabase._run(
        lambda: client.table("partner_api_keys")
        .upsert(payload, on_conflict="key_hash")
        .execute()
    )
    rows = response.data or []
    if rows:
        return rows[0]

    fallback = await supabase._run(
        lambda: client.table("partner_api_keys")
        .select("id,partner_id,key_hash,scopes")
        .eq("key_hash", payload["key_hash"])
        .limit(1)
        .execute()
    )
    rows = fallback.data or []
    if not rows:
        raise RuntimeError("Failed to resolve partner_api_keys row after upsert")
    return rows[0]


async def _seed_fixture_patient_and_result(partner_id: str, patient_external_id: str) -> tuple[str, str]:
    client = supabase._get_supabase()

    patient_payload = {
        "partner_id": partner_id,
        "external_patient_id": patient_external_id,
        "profile": {"seed": True},
    }
    patient_resp = await supabase._run(
        lambda: client.table("partner_patients")
        .upsert(patient_payload, on_conflict="partner_id,external_patient_id")
        .execute()
    )
    patient_rows = patient_resp.data or []
    patient_id = str((patient_rows[0] if patient_rows else {}).get("id") or "")
    if not patient_id:
        patient_lookup = await supabase._run(
            lambda: client.table("partner_patients")
            .select("id")
            .eq("partner_id", partner_id)
            .eq("external_patient_id", patient_external_id)
            .limit(1)
            .execute()
        )
        lookup_rows = patient_lookup.data or []
        patient_id = str((lookup_rows[0] if lookup_rows else {}).get("id") or "")
    if not patient_id:
        raise RuntimeError("Failed to resolve test partner patient id")

    result_payload = {
        "partner_id": partner_id,
        "partner_patient_id": patient_id,
        "external_order_id": "STAGE-ORDER-001",
        "external_result_id": "STAGE-RESULT-001",
        "source_lab": "smartlab",
        "result_date": date.today().isoformat(),
        "status": "processed",
        "raw_payload": {
            "biomarkers": [
                {"name": "Vitamin D", "value": 24, "unit": "ng/mL", "ref_low": 30, "ref_high": 100}
            ]
        },
        "canonical_payload": {},
    }
    result_resp = await supabase._run(
        lambda: client.table("partner_lab_results")
        .upsert(result_payload, on_conflict="partner_id,external_order_id,external_result_id")
        .execute()
    )
    result_rows = result_resp.data or []
    result_id = str((result_rows[0] if result_rows else {}).get("id") or "")
    if not result_id:
        result_lookup = await supabase._run(
            lambda: client.table("partner_lab_results")
            .select("id")
            .eq("partner_id", partner_id)
            .eq("external_order_id", "STAGE-ORDER-001")
            .eq("external_result_id", "STAGE-RESULT-001")
            .limit(1)
            .execute()
        )
        lookup_rows = result_lookup.data or []
        result_id = str((lookup_rows[0] if lookup_rows else {}).get("id") or "")
    if not result_id:
        raise RuntimeError("Failed to resolve test partner lab result id")

    return patient_id, result_id


async def _run(args: argparse.Namespace) -> None:
    api_key = args.api_key or (f"smartlab_staging_{secrets.token_urlsafe(18)}" if args.generate_api_key else "")
    if not api_key:
        raise SystemExit("Provide --api-key or use --generate-api-key")

    partner = await _upsert_partner(args.partner_slug, args.display_name)
    key_row = await _upsert_partner_key(str(partner["id"]), api_key, args.key_label)

    print("partner_id=", partner.get("id"))
    print("partner_slug=", partner.get("slug"))
    print("partner_api_key_id=", key_row.get("id"))
    print("partner_api_key_hash=", key_row.get("key_hash"))
    print("partner_api_key_scopes=", key_row.get("scopes"))
    print("partner_api_key_plain=", api_key)

    if args.with_fixtures:
        patient_id, result_id = await _seed_fixture_patient_and_result(str(partner["id"]), args.fixture_external_patient_id)
        print("fixture_partner_patient_id=", patient_id)
        print("fixture_partner_lab_result_id=", result_id)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed Smartlab partner and API key in staging")
    parser.add_argument("--partner-slug", default="smartlab")
    parser.add_argument("--display-name", default="Smartlab")
    parser.add_argument("--key-label", default="smartlab-staging-main")
    parser.add_argument("--api-key", default="")
    parser.add_argument("--generate-api-key", action="store_true")
    parser.add_argument("--with-fixtures", action="store_true")
    parser.add_argument("--fixture-external-patient-id", default="SMARTLAB-STAGE-PATIENT-001")
    return parser.parse_args()


if __name__ == "__main__":
    asyncio.run(_run(parse_args()))
