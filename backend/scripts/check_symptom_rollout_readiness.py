#!/usr/bin/env python3
"""Fail deployment when an enabled symptom rollout has unresolved gates."""

from __future__ import annotations

import argparse
import asyncio
import json

from app.config import settings
from app.services import supabase_service as svc
from app.services.symptom_rollout import assess_symptom_rollout_readiness, rollout_target


async def _approved_mapping_count() -> int | None:
    if rollout_target(settings) == "disabled":
        return None
    try:
        client = svc._get_supabase()
        response = await svc._run(
            lambda: client.table("clinical_concept_mappings")
            .select("id", count="exact")
            .eq("active", True)
            .eq("review_status", "approved")
            .execute()
        )
        return int(response.count or 0)
    except Exception:
        return None


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--target",
        choices=("auto", "disabled", "internal", "percentage"),
        default="auto",
    )
    args = parser.parse_args()
    report = assess_symptom_rollout_readiness(
        settings,
        approved_mapping_count=await _approved_mapping_count(),
        target=args.target,
    )
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["ready"] else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
