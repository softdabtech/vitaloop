from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Iterable


DATE_EXTRACTION_VERSION = "lab_date_extraction_v2"

_DATE_PATTERN = re.compile(
    r"(?P<date>\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b)"
)

_TEST_LABELS = (
    "date of test",
    "test date",
    "sample date",
    "specimen date",
    "дата дослідження",
    "дата дослiдження",
    "дата аналізу",
    "дата анализа",
    "дата аналiзу",
)
_COLLECTED_LABELS = (
    "date collected",
    "collection date",
    "collected",
    "sample collected",
    "дата забору",
    "дата взяття",
    "дата взятия",
    "забір матеріалу",
    "забор материала",
)
_ORDER_LABELS = (
    "order date",
    "date ordered",
    "ordered date",
    "ordered",
    "дата замов.",
    "дата замовлення",
    "дата заказа",
    "дата заказу",
)
_DONE_LABELS = (
    "done date",
    "date done",
    "completed date",
    "completion date",
    "date completed",
    "дата виконання",
    "дата выполнения",
    "виконано",
)
_REPORTED_LABELS = (
    "date reported",
    "reported",
    "report date",
    "result date",
    "date of result",
    "printed",
    "дата звіту",
    "дата отчета",
    "дата видачі",
    "дата выдачи",
    "дата результату",
    "дата результата",
    "надруковано",
)
_EXCLUDED_LABELS = (
    "date of birth",
    "birth date",
    "dob",
    "дата народження",
    "дата рождения",
)
_DATE_SNIPPET_TERMS = tuple(
    sorted(
        {
            *_TEST_LABELS,
            *_COLLECTED_LABELS,
            *_ORDER_LABELS,
            *_DONE_LABELS,
            *_REPORTED_LABELS,
            "date",
            "дата",
        },
        key=len,
        reverse=True,
    )
)


@dataclass(frozen=True)
class LabDateExtraction:
    test_date: str | None = None
    collected_at: str | None = None
    reported_at: str | None = None
    date_source: str = "missing"
    date_confidence: str = "low"
    date_raw_text: str | None = None
    version: str = DATE_EXTRACTION_VERSION

    def as_payload(self) -> dict[str, Any]:
        return {
            "test_date": self.test_date,
            "collected_at": self.collected_at,
            "reported_at": self.reported_at,
            "date_source": self.date_source,
            "date_confidence": self.date_confidence,
            "date_raw_text": self.date_raw_text,
        }


def _parse_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    text = text.replace("/", ".").replace("-", ".")
    parts = [part for part in text.split(".") if part]
    if len(parts) != 3:
        return None

    try:
        if len(parts[0]) == 4:
            year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
        else:
            first, second, raw_year = int(parts[0]), int(parts[1]), int(parts[2])
            year = raw_year + 2000 if raw_year < 100 else raw_year
            if first > 12:
                day, month = first, second
            elif second > 12:
                month, day = first, second
            else:
                day, month = first, second
        parsed = date(year, month, day)
    except ValueError:
        return None

    today = datetime.now(timezone.utc).date()
    if parsed > today:
        return None
    if parsed.year < 1990:
        return None
    return parsed


def _line_candidates(text: str, labels: Iterable[str]) -> list[tuple[date, str]]:
    result: list[tuple[date, str]] = []
    label_terms = tuple(sorted((label.lower() for label in labels), key=len, reverse=True))
    excluded_terms = tuple(label.lower() for label in _EXCLUDED_LABELS)
    lines = [" ".join(raw_line.split()) for raw_line in text.splitlines()]
    for line_index, line in enumerate(lines):
        lower = line.lower()
        if not line or not any(label in lower for label in label_terms):
            continue
        if any(label in lower for label in excluded_terms) and not any(label in lower for label in label_terms):
            continue
        for label in label_terms:
            index = lower.find(label)
            if index < 0:
                continue
            current_segment = line[index : index + 240]
            segments = [current_segment]
            for offset in range(1, 4):
                if line_index + offset < len(lines):
                    segments.append(f"{current_segment} {lines[line_index + offset]}"[:240])
            for segment in segments:
                for match in _DATE_PATTERN.finditer(segment):
                    parsed = _parse_date(match.group("date"))
                    if parsed:
                        result.append((parsed, segment[:240]))
                        break
                if result and result[-1][1] == segment[:240]:
                    break
    return result


def _metadata_date(metadata: dict[str, Any], *keys: str) -> tuple[date, str] | None:
    for key in keys:
        parsed = _parse_date(metadata.get(key))
        if parsed:
            return parsed, f"{key}: {metadata.get(key)}"
    return None


def extract_date_bearing_snippets(text: str | None, *, max_lines: int = 24) -> list[str]:
    snippets: list[str] = []
    seen: set[str] = set()
    for raw_line in str(text or "").splitlines():
        line = " ".join(raw_line.split())
        if not line or not _DATE_PATTERN.search(line):
            continue
        lower = line.lower()
        if not any(term in lower for term in _DATE_SNIPPET_TERMS):
            continue
        if any(term in lower for term in _EXCLUDED_LABELS) and not any(
            term in lower
            for term in (
                *_TEST_LABELS,
                *_COLLECTED_LABELS,
                *_ORDER_LABELS,
                *_DONE_LABELS,
                *_REPORTED_LABELS,
            )
        ):
            continue
        snippet = line[:240]
        if snippet in seen:
            continue
        seen.add(snippet)
        snippets.append(snippet)
        if len(snippets) >= max_lines:
            break
    return snippets


def extract_lab_dates(
    text: str | None = None,
    *,
    document_metadata: dict[str, Any] | None = None,
    user_provided_test_date: date | str | None = None,
) -> LabDateExtraction:
    provided = _parse_date(user_provided_test_date)
    if provided:
        iso = provided.isoformat()
        return LabDateExtraction(
            test_date=iso,
            date_source="user_provided",
            date_confidence="high",
            date_raw_text=f"user_provided: {iso}",
        )

    metadata = document_metadata or {}
    test_from_metadata = _metadata_date(metadata, "specimen_date", "test_date", "sample_date", "date_of_test")
    collected_from_metadata = _metadata_date(metadata, "collection_date", "collected_at", "date_collected", "sample_collected")
    order_from_metadata = _metadata_date(metadata, "order_date", "date_ordered", "ordered_date")
    done_from_metadata = _metadata_date(metadata, "done_date", "date_done", "completed_date", "date_completed")
    reported_from_metadata = _metadata_date(metadata, "report_date", "reported_at", "date_reported", "result_date", "date_of_result")

    normalized_text = str(text or "")
    test_matches = _line_candidates(normalized_text, _TEST_LABELS)
    collected_matches = _line_candidates(normalized_text, _COLLECTED_LABELS)
    order_matches = _line_candidates(normalized_text, _ORDER_LABELS)
    done_matches = _line_candidates(normalized_text, _DONE_LABELS)
    reported_matches = _line_candidates(normalized_text, _REPORTED_LABELS)

    if test_matches:
        parsed, raw = test_matches[0]
        return LabDateExtraction(
            test_date=parsed.isoformat(),
            date_source="extracted_test_date",
            date_confidence="high",
            date_raw_text=raw,
        )
    if collected_matches:
        parsed, raw = collected_matches[0]
        iso = parsed.isoformat()
        return LabDateExtraction(
            test_date=iso,
            collected_at=iso,
            date_source="extracted_collected_at",
            date_confidence="high",
            date_raw_text=raw,
        )
    if test_from_metadata:
        parsed, raw = test_from_metadata
        return LabDateExtraction(
            test_date=parsed.isoformat(),
            date_source="extracted_test_date",
            date_confidence="medium",
            date_raw_text=raw,
        )
    if collected_from_metadata:
        parsed, raw = collected_from_metadata
        iso = parsed.isoformat()
        return LabDateExtraction(
            test_date=iso,
            collected_at=iso,
            date_source="extracted_collected_at",
            date_confidence="medium",
            date_raw_text=raw,
        )
    if order_matches:
        parsed, raw = order_matches[0]
        return LabDateExtraction(
            test_date=parsed.isoformat(),
            date_source="extracted_order_date",
            date_confidence="high",
            date_raw_text=raw,
        )
    if order_from_metadata:
        parsed, raw = order_from_metadata
        return LabDateExtraction(
            test_date=parsed.isoformat(),
            date_source="extracted_order_date",
            date_confidence="medium",
            date_raw_text=raw,
        )
    if done_matches:
        parsed, raw = done_matches[0]
        return LabDateExtraction(
            test_date=parsed.isoformat(),
            date_source="extracted_done_date",
            date_confidence="high",
            date_raw_text=raw,
        )
    if done_from_metadata:
        parsed, raw = done_from_metadata
        return LabDateExtraction(
            test_date=parsed.isoformat(),
            date_source="extracted_done_date",
            date_confidence="medium",
            date_raw_text=raw,
        )
    if reported_matches:
        parsed, raw = reported_matches[0]
        iso = parsed.isoformat()
        return LabDateExtraction(
            test_date=iso,
            reported_at=iso,
            date_source="extracted_reported_at",
            date_confidence="high",
            date_raw_text=raw,
        )
    if reported_from_metadata:
        parsed, raw = reported_from_metadata
        iso = parsed.isoformat()
        return LabDateExtraction(
            test_date=iso,
            reported_at=iso,
            date_source="extracted_reported_at",
            date_confidence="medium",
            date_raw_text=raw,
        )
    return LabDateExtraction()


def choose_measurement_date(row: dict[str, Any]) -> str | None:
    upload = row.get("lab_uploads") if isinstance(row.get("lab_uploads"), dict) else {}
    for key in ("test_date", "collected_at", "reported_at"):
        parsed = _parse_date(row.get(key)) or _parse_date(upload.get(key))
        if parsed:
            return parsed.isoformat()
    return None
