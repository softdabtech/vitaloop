from typing import Any

from app.integrations.infermedica.schemas import (
    ProviderDiagnosisResponse,
    ProviderQuestion,
    ProviderSuggestion,
)


def normalize_question(question: ProviderQuestion | None, *, sequence: int) -> dict[str, Any] | None:
    if question is None:
        return None
    return {
        "id": f"provider_question_{sequence}",
        "sequence": sequence,
        "type": question.type,
        "text": question.text,
        "items": [
            {
                "id": item.id,
                "label": item.name,
                "choices": [{"id": choice.id, "label": choice.label} for choice in item.choices],
            }
            for item in question.items
        ],
    }


def normalize_diagnosis_for_user(payload: dict[str, Any], *, sequence: int) -> dict[str, Any]:
    """Return only interview state; condition rankings stay server-side."""
    parsed = ProviderDiagnosisResponse.model_validate(payload)
    return {
        "question": normalize_question(parsed.question, sequence=sequence),
        "should_stop": parsed.should_stop,
    }


def normalize_red_flag_question(
    suggestions: list[ProviderSuggestion], *, sequence: int
) -> dict[str, Any] | None:
    """Build a controlled question without inventing medical labels or IDs."""
    if not suggestions:
        return None
    return {
        "id": f"provider_red_flags_{sequence}",
        "sequence": sequence,
        "type": "group_multiple",
        "text": "Are any of these warning signs present now?",
        "source": "red_flags",
        "items": [
            {
                "id": item.id,
                "label": item.common_name or item.name,
                "choices": [
                    {"id": "present", "label": "Yes"},
                    {"id": "absent", "label": "No"},
                    {"id": "unknown", "label": "Not sure"},
                ],
            }
            for item in suggestions
        ],
    }
