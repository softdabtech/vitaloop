import argparse
import asyncio
import json
import sys
from pathlib import Path
from uuid import uuid4

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.services.supabase_service import redact_old_lab_upload_text, write_audit_log
from app.services.email_service import send_ops_alert_email


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Redact old raw lab extracted_text rows")
    parser.add_argument("--days", type=int, default=settings.lab_upload_raw_retention_days)
    parser.add_argument("--batch-size", type=int, default=settings.lab_upload_retention_batch_size)
    parser.add_argument("--apply", action="store_true", help="Apply redaction. Defaults to dry-run mode.")
    return parser


async def _run(days: int, batch_size: int, apply_changes: bool) -> int:
    try:
        result = await redact_old_lab_upload_text(
            retention_days=days,
            batch_size=batch_size,
            dry_run=not apply_changes,
        )
        await write_audit_log(
            user_id=None,
            action="retention_redaction_job",
            entity_type="lab_uploads",
            entity_id=str(uuid4()),
            new_value={
                "status": "success",
                "days": days,
                "batch_size": batch_size,
                "dry_run": not apply_changes,
                "updated": int(result.get("updated") or 0),
            },
        )
        print(json.dumps(result, ensure_ascii=True))
        return 0
    except Exception as exc:
        error_payload = {
            "error": str(exc),
            "days": days,
            "batch_size": batch_size,
            "apply": apply_changes,
        }
        print(json.dumps(error_payload, ensure_ascii=True), file=sys.stderr)

        await write_audit_log(
            user_id=None,
            action="retention_redaction_job",
            entity_type="lab_uploads",
            entity_id=str(uuid4()),
            new_value={
                "status": "failed",
                "days": days,
                "batch_size": batch_size,
                "dry_run": not apply_changes,
                "error": str(exc),
            },
        )

        alert_email = (settings.retention_alert_email or settings.registration_alert_email or "").strip()
        if alert_email:
            try:
                await send_ops_alert_email(
                    to_email=alert_email,
                    organization_name="VITALOOP",
                    alert_title="Retention redaction job failed",
                    alert_message=json.dumps(error_payload, ensure_ascii=True),
                    alert_level="critical",
                )
            except Exception:
                pass
        return 1


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    return asyncio.run(_run(days=args.days, batch_size=args.batch_size, apply_changes=args.apply))


if __name__ == "__main__":
    raise SystemExit(main())
