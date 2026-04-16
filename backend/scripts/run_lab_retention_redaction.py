import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.services.supabase_service import redact_old_lab_upload_text


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Redact old raw lab extracted_text rows")
    parser.add_argument("--days", type=int, default=settings.lab_upload_raw_retention_days)
    parser.add_argument("--batch-size", type=int, default=settings.lab_upload_retention_batch_size)
    parser.add_argument("--apply", action="store_true", help="Apply redaction. Defaults to dry-run mode.")
    return parser


async def _run(days: int, batch_size: int, apply_changes: bool) -> int:
    result = await redact_old_lab_upload_text(
        retention_days=days,
        batch_size=batch_size,
        dry_run=not apply_changes,
    )
    print(json.dumps(result, ensure_ascii=True))
    return 0


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    return asyncio.run(_run(days=args.days, batch_size=args.batch_size, apply_changes=args.apply))


if __name__ == "__main__":
    raise SystemExit(main())
