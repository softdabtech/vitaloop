from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.services.lab_date_extraction import LabDateExtraction, extract_lab_dates


BACKFILL_VERSION = "lab_upload_date_backfill_v2"
_REDACTED_TEXT = "[REDACTED_BY_RETENTION_POLICY]"


@dataclass(frozen=True)
class LabUploadDateBackfillDecision:
    upload_id: str
    action: str
    reason: str
    patch: dict[str, Any]
    extraction: LabDateExtraction | None = None

    def as_dict(self) -> dict[str, Any]:
        payload = {
            "upload_id": self.upload_id,
            "action": self.action,
            "reason": self.reason,
            "patch": self.patch,
        }
        if self.extraction:
            payload["extraction"] = self.extraction.as_payload()
        return payload


def _flatten_text(value: Any, *, limit: int = 80_000) -> str:
    chunks: list[str] = []

    def visit(item: Any) -> None:
        if len("\n".join(chunks)) >= limit:
            return
        if item is None:
            return
        if isinstance(item, str):
            text = item.strip()
            if text:
                chunks.append(text)
            return
        if isinstance(item, (int, float, bool)):
            chunks.append(str(item))
            return
        if isinstance(item, dict):
            priority_keys = (
                "document_text_excerpt",
                "date_bearing_snippets",
                "analysis_metadata",
                "document_metadata",
                "extracted_text",
                "text",
                "raw_text",
                "content",
                "metadata",
                "analysis",
                "biomarkers",
            )
            visited = set()
            for key in priority_keys:
                if key in item:
                    visited.add(key)
                    visit(item.get(key))
            for key, nested in item.items():
                if key not in visited:
                    visit(nested)
            return
        if isinstance(item, (list, tuple)):
            for nested in item:
                visit(nested)

    visit(value)
    return "\n".join(chunks)[:limit]


def _extract_search_text(row: dict[str, Any]) -> tuple[str, str]:
    extracted_text = str(row.get("extracted_text") or "").strip()
    if not extracted_text:
        return "", "unrestorable_without_manual_date"
    if extracted_text == _REDACTED_TEXT:
        return "", "original_text_redacted"

    candidates = [extracted_text]
    try:
        parsed = json.loads(extracted_text)
        flattened = _flatten_text(parsed)
        if flattened:
            candidates.insert(0, flattened)
    except (TypeError, ValueError):
        pass

    text = "\n".join(part for part in candidates if part.strip()).strip()
    return text, "stored_extracted_text"


def build_lab_upload_date_backfill_decision(row: dict[str, Any]) -> LabUploadDateBackfillDecision:
    upload_id = str(row.get("id") or "")
    existing_date = row.get("test_date") or row.get("collected_at") or row.get("reported_at")
    existing_source = str(row.get("date_source") or "")
    existing_confidence = str(row.get("date_confidence") or "")
    if existing_date and existing_source.startswith("extracted_") and existing_confidence == "high":
        return LabUploadDateBackfillDecision(
            upload_id=upload_id,
            action="skipped",
            reason="high_confidence_date_already_present",
            patch={},
        )

    text, source_reason = _extract_search_text(row)
    if not text:
        return LabUploadDateBackfillDecision(
            upload_id=upload_id,
            action="skipped",
            reason=source_reason,
            patch={},
        )

    extraction = extract_lab_dates(text)
    patch = extraction.as_payload()
    if not extraction.test_date:
        return LabUploadDateBackfillDecision(
            upload_id=upload_id,
            action="skipped",
            reason="date_not_found_in_stored_text",
            patch={
                "date_source": "missing",
                "date_confidence": "low",
            },
            extraction=extraction,
        )

    return LabUploadDateBackfillDecision(
        upload_id=upload_id,
        action="update",
        reason=source_reason,
        patch={key: value for key, value in patch.items() if value is not None or key in {"date_source", "date_confidence"}},
        extraction=extraction,
    )


def summarize_lab_date_backfill(decisions: list[LabUploadDateBackfillDecision]) -> dict[str, Any]:
    updated = [item for item in decisions if item.action == "update"]
    skipped = [item for item in decisions if item.action != "update"]
    test_dates = sorted({str(item.patch.get("test_date")) for item in updated if item.patch.get("test_date")})
    skipped_by_reason: dict[str, int] = {}
    for item in skipped:
        skipped_by_reason[item.reason] = skipped_by_reason.get(item.reason, 0) + 1
    return {
        "version": BACKFILL_VERSION,
        "uploads_scanned": len(decisions),
        "uploads_with_test_date": len(updated),
        "unique_lab_dates": len(test_dates),
        "lab_dates": test_dates,
        "undated": len(skipped),
        "skipped_by_reason": skipped_by_reason,
    }
