#!/usr/bin/env python3
"""Seed managed knowledge domain registry from the code registry.

Run from backend/:
    python scripts/seed_knowledge_domain_registry.py --env-file .env.staging.local

The operation is idempotent and upserts by domain key.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


def _load_env(env_file: str) -> None:
    path = Path(env_file)
    if not path.is_absolute():
        path = BACKEND_DIR / path
    if not path.exists():
        raise SystemExit(f"Env file not found: {path}")
    load_dotenv(path, override=True)

    # Staging files may intentionally use STAGING_* names. Map them only for
    # this process so app Settings can initialize normally.
    if os.environ.get("STAGING_SUPABASE_URL") and not os.environ.get("SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = os.environ["STAGING_SUPABASE_URL"]
    if os.environ.get("STAGING_SUPABASE_SERVICE_ROLE_KEY") and not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = os.environ["STAGING_SUPABASE_SERVICE_ROLE_KEY"]


def _row_from_definition(definition: dict, *, active: bool) -> dict:
    return {
        "key": definition["key"],
        "label": definition["label"],
        "marker_aliases": definition.get("marker_aliases") or [],
        "symptom_aliases": definition.get("symptom_aliases") or [],
        "required_markers": definition.get("required_markers") or [],
        "retest_markers": definition.get("retest_markers") or [],
        "protocol_sections": definition.get("protocol_sections") or [],
        "expected_timeline": definition.get("expected_timeline") or "",
        "evidence_level": definition.get("evidence_level") or "clinical_context",
        "requires_doctor_if_flagged": bool(definition.get("requires_doctor_if_flagged")),
        "sort_order": definition.get("sort_order") or 100,
        "active": active,
        "governance_status": "active" if active else "reviewed",
        "version": "managed_seed_v1",
        "metadata": {
            "seeded_from": "code_registry",
            "source_registry_version": definition.get("registry_version"),
        },
    }


async def _run(args: argparse.Namespace) -> None:
    _load_env(args.env_file)

    from app.services import supabase_service as supabase
    from app.services.knowledge.domain_registry import list_domain_definitions

    definitions = list_domain_definitions()
    rows = [_row_from_definition(item, active=not args.reviewed_only) for item in definitions]

    if args.dry_run:
        print(f"dry_run=true domain_count={len(rows)}")
        for row in rows:
            print(f"- {row['key']} active={row['active']} governance_status={row['governance_status']}")
        return

    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("knowledge_domain_registry")
        .upsert(rows, on_conflict="key")
        .execute()
    )
    upserted = response.data or []
    print(f"upserted_domain_count={len(upserted) or len(rows)}")
    print("domain_keys=", ",".join(row["key"] for row in rows))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed managed knowledge domain registry from code registry")
    parser.add_argument("--env-file", default=".env", help="Env file relative to backend/ or absolute path")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--reviewed-only",
        action="store_true",
        help="Seed rows as reviewed/inactive instead of active. Useful before manual medical approval.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    asyncio.run(_run(parse_args()))
