"""
Shared input-validation helpers for request payloads.
"""

from uuid import UUID
from fastapi import HTTPException
from app.constants import MAX_SYMPTOMS, MAX_SYMPTOM_LENGTH


def is_valid_uuid(value: str) -> bool:
    """Check if string is valid UUID format.

    Args:
        value: String to validate

    Returns:
        True if valid UUID, False otherwise
    """
    try:
        UUID(value)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def validate_uuid(value: str, field_name: str = "id") -> str:
    """Validate UUID or raise HTTPException.

    Args:
        value: String to validate
        field_name: Name of field for error message

    Returns:
        The validated UUID string

    Raises:
        HTTPException: 422 if invalid UUID format
    """
    if not is_valid_uuid(value):
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"Invalid {field_name} format",
                "code": "INVALID_UUID",
            },
        )
    return value


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
