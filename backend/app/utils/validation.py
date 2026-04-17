"""
Shared input-validation helpers for request payloads.
"""

from fastapi import HTTPException
from app.constants import MAX_SYMPTOMS, MAX_SYMPTOM_LENGTH


def normalize_symptoms(symptoms: list[str]) -> list[str]:
    """Validate and deduplicate a list of symptom strings.

    Raises HTTP 422 on violations.
    """
    normalized: list[str] = []
    seen: set[str] = set()

    for raw in symptoms:
        item = (raw or "").strip().lower()
        if not item:
            continue
        if len(item) > MAX_SYMPTOM_LENGTH:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": f"Symptom is too long (max {MAX_SYMPTOM_LENGTH} chars)",
                    "code": "SYMPTOM_TOO_LONG",
                },
            )
        if item not in seen:
            seen.add(item)
            normalized.append(item)

    if len(normalized) > MAX_SYMPTOMS:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"Too many symptoms provided (max {MAX_SYMPTOMS})",
                "code": "TOO_MANY_SYMPTOMS",
            },
        )

    return normalized
