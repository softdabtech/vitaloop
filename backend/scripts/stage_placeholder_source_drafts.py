"""Stage draft copies of knowledge_rules that still carry the seed-time
placeholder citation (source="clinical_guideline_placeholder",
source_url pointing at example.org).

Found during a 2026-09-03 knowledge-base audit: scripts/seed_knowledge_v2.py
inserted all 111 rules directly with governance_status="active" and a fake
medical_reviewed_at — bypassing the draft -> review -> approve workflow
governance.py otherwise enforces. None of them carry a real citation.

This script does NOT invent citations (no clinical judgment call to make
here) and does NOT touch the live active rules — governance.py's
update_rule() refuses to edit an active row by design, and this script
respects that rather than bypassing it with a raw SQL patch. Instead, for
each affected rule it creates a draft copy (via the normal
create_draft_copy() governance path — full audit trail) with an honest,
self-evidently-internal source label, ready for a medically-qualified
reviewer to fill in the real citation and approve through the CRM governance
panel whenever that work resumes. The active rule keeps serving reports
unchanged in the meantime — this only stages the fix, it does not flip it live.

Usage:
    python3 scripts/stage_placeholder_source_drafts.py --actor-user-id <uuid> [--limit N] [--apply]

Defaults to a dry run (lists what would be staged). Pass --apply to actually
create the draft rows.
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.knowledge.governance import create_draft_copy, update_rule  # noqa: E402
from app.services.supabase_service import _get_supabase  # noqa: E402

PLACEHOLDER_SOURCE = "clinical_guideline_placeholder"
HONEST_SOURCE = "internal_kb_v2_seed_pending_citation"
HONEST_SOURCE_URL = "internal://kb-v2-seed/pending-citation"
CHANGE_NOTE = (
    "2026-09-03 audit: seed-time placeholder citation (source=clinical_guideline_placeholder, "
    "source_url=example.org) replaced with an honest internal marker. No clinical content "
    "(conditions/outputs/thresholds) changed. Needs a real citation + medical review before approval."
)


def _find_placeholder_rules(limit: int | None) -> list[dict]:
    client = _get_supabase()
    query = (
        client.table("knowledge_rules")
        .select("id,key,name,source,source_url,governance_status,active")
        .eq("active", True)
        .eq("governance_status", "active")
        .eq("source", PLACEHOLDER_SOURCE)
    )
    if limit:
        query = query.limit(limit)
    resp = query.execute()
    rules = resp.data or []

    # Idempotency: skip any rule that already has a non-active draft/reviewed
    # copy staged (matched by key — a prior run may have gotten interrupted
    # after create_draft_copy but before update_rule, as happened once during
    # testing on 2026-09-03). Re-running create_draft_copy for those would
    # collide on the (key, version) unique constraint.
    keys = [r["key"] for r in rules]
    if not keys:
        return rules
    existing_drafts = (
        client.table("knowledge_rules")
        .select("key")
        .in_("key", keys)
        .neq("governance_status", "active")
        .execute()
    )
    already_staged = {row["key"] for row in (existing_drafts.data or [])}
    if already_staged:
        print(f"skipping {len(already_staged)} rule(s) that already have a staged draft: {sorted(already_staged)}")
    return [r for r in rules if r["key"] not in already_staged]


async def stage_one(rule: dict, *, actor_user_id: str, apply: bool) -> None:
    key = rule.get("key")
    if not apply:
        print(f"[dry-run] would stage draft for {key} ({rule['id']})")
        return

    draft = await create_draft_copy(
        rule["id"],
        {"change_note": CHANGE_NOTE, "last_modified_by": actor_user_id},
        actor_user_id=actor_user_id,
    )
    draft_id = draft.get("id")
    await update_rule(
        draft_id,
        {
            "source": HONEST_SOURCE,
            "source_url": HONEST_SOURCE_URL,
            "change_note": CHANGE_NOTE,
            "last_modified_by": actor_user_id,
        },
        actor_user_id=actor_user_id,
    )
    print(f"staged draft {draft_id} for {key} (source_rule={rule['id']})")


async def main_async(actor_user_id: str, limit: int | None, apply: bool) -> None:
    rules = _find_placeholder_rules(limit)
    print(f"{len(rules)} active rule(s) with placeholder source found" + (f" (capped at {limit})" if limit else ""))
    if not apply:
        print("Dry run — pass --apply to actually create draft copies.\n")

    for rule in rules:
        await stage_one(rule, actor_user_id=actor_user_id, apply=apply)

    if not apply:
        print(f"\n{len(rules)} draft(s) would be created. Nothing written.")
    else:
        print(f"\n{len(rules)} draft(s) created with governance_status=draft, active=False.")
        print("Review + approve each through the CRM knowledge-rules panel once a real citation is available.")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--actor-user-id", required=True, help="UUID recorded as last_modified_by / audit actor.")
    parser.add_argument("--limit", type=int, default=None, help="Only stage the first N matching rules.")
    parser.add_argument("--apply", action="store_true", help="Actually create the draft copies. Defaults to dry-run.")
    return parser


if __name__ == "__main__":
    args = _build_parser().parse_args()
    asyncio.run(main_async(args.actor_user_id, args.limit, args.apply))
