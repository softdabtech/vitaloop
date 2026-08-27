import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.lab_upload_date_backfill import (  # noqa: E402
    build_lab_upload_date_backfill_decision,
    summarize_lab_date_backfill,
)
from app.services.supabase_service import (  # noqa: E402
    apply_lab_upload_date_backfill,
    get_lab_uploads_for_date_backfill,
    get_user_by_email,
    write_audit_log,
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Backfill lab upload date metadata from stored extracted text without re-analysis."
    )
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--email", help="User email to backfill.")
    target.add_argument("--user-id", help="User id to backfill.")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--apply", action="store_true", help="Apply updates. Defaults to dry-run.")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow overwrite of existing high-confidence extracted dates.",
    )
    return parser


async def _run(*, email: str | None, user_id: str | None, limit: int, apply_changes: bool, overwrite: bool) -> int:
    if email:
        user = await get_user_by_email(email)
        if not user:
            print(json.dumps({"error": "user_not_found", "email": email}, ensure_ascii=True), file=sys.stderr)
            return 2
        user_id = str(user["id"])

    assert user_id
    uploads = await get_lab_uploads_for_date_backfill(user_id, limit=limit)
    decisions = [build_lab_upload_date_backfill_decision(row).as_dict() for row in uploads]
    summary = summarize_lab_date_backfill(
        [build_lab_upload_date_backfill_decision(row) for row in uploads]
    )

    applied = []
    if apply_changes:
        applied = await apply_lab_upload_date_backfill(user_id=user_id, decisions=decisions, overwrite=overwrite)

    result = {
        **summary,
        "user_id": user_id,
        "email": email,
        "dry_run": not apply_changes,
        "applied_updates": len(applied),
        "decisions": decisions,
    }

    await write_audit_log(
        user_id=user_id,
        action="update" if apply_changes else "read",
        entity_type="lab_upload_date_backfill",
        entity_id=user_id,
        new_value={
            "version": summary["version"],
            "dry_run": not apply_changes,
            "uploads_scanned": summary["uploads_scanned"],
            "uploads_with_test_date": summary["uploads_with_test_date"],
            "unique_lab_dates": summary["unique_lab_dates"],
            "undated": summary["undated"],
            "skipped_by_reason": summary["skipped_by_reason"],
        },
    )

    print(json.dumps(result, ensure_ascii=True, indent=2))
    return 0


def main() -> int:
    args = _build_parser().parse_args()
    return asyncio.run(
        _run(
            email=args.email,
            user_id=args.user_id,
            limit=args.limit,
            apply_changes=args.apply,
            overwrite=args.overwrite,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
