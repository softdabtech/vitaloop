"""Grounded AI narrative assembled exclusively from Case Synthesis.

The model never receives raw extraction text, raw questionnaire answers, or a
free-form profile.  It receives a closed set of already-grounded statements
and may only select/reorder their stable IDs.  The service materializes the
final text from Case Synthesis after validating that selection, which makes a
new marker, value, symptom, or clinical assertion impossible to introduce at
this layer.

When an LLM is unavailable or its selection is invalid, the same public
contract is assembled deterministically from this report's own statements.
"""

from __future__ import annotations

import json
import logging
import re
from copy import deepcopy
from typing import Any, Awaitable, Callable, Dict, List

from app.config import settings
from app.services.ai.openai_service import is_llm_configured
from app.services.claude_service import _chat_completion, _strip_code_block


logger = logging.getLogger("uvicorn.error")

GROUNDED_AI_NARRATIVE_VERSION = "grounded_ai_narrative_v1"
GROUNDED_AI_NARRATIVE_PROMPT_VERSION = "grounded_narrative_selection_v1"

NARRATIVE_FIELDS = (
    "personalized_summary",
    "key_connections",
    "symptom_lab_correlations",
    "ranked_explanations",
    "uncertainties",
    "next_actions",
    "clinician_questions",
    "retest_plan",
)

GROUNDED_AI_NARRATIVE_FIELDS = (*NARRATIVE_FIELDS, "evidence_links")

_SOURCE_SECTIONS = {
    "personalized_summary": ("main_conclusion",),
    "key_connections": ("what_was_found",),
    "symptom_lab_correlations": ("symptom_connections",),
    "ranked_explanations": ("likely_explanations",),
    "uncertainties": ("contradictions_and_limits", "missing_information"),
    "next_actions": ("actions_now",),
    "clinician_questions": ("clinician_discussion",),
    "retest_plan": ("retest_plan",),
}

_FIELD_LIMITS = {
    "personalized_summary": 4,
    "key_connections": 6,
    "symptom_lab_correlations": 6,
    "ranked_explanations": 5,
    "uncertainties": 8,
    "next_actions": 6,
    "clinician_questions": 6,
    "retest_plan": 8,
}

SelectionGenerator = Callable[..., Awaitable[Dict[str, Any]]]


def _slug(value: Any) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[^a-z0-9_.:-]+", "_", text).strip("_") or "unknown"


def _valid_dicts(value: Any) -> List[Dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _evidence_id(reference: Dict[str, Any]) -> str:
    return ":".join(
        (
            _slug(reference.get("type")),
            _slug(reference.get("id")),
            _slug(reference.get("availability") or "observed"),
        )
    )


def _public_evidence(reference: Dict[str, Any], evidence_id: str) -> Dict[str, Any]:
    result = {"evidence_id": evidence_id}
    for field in (
        "type",
        "id",
        "label",
        "availability",
        "value",
        "unit",
        "status",
        "reference_range",
    ):
        value = reference.get(field)
        if value not in (None, ""):
            result[field] = deepcopy(value)
    return result


def build_verified_narrative_context(case_synthesis: Dict[str, Any] | None) -> Dict[str, Any]:
    """Create the only context that the narrative model is allowed to see."""
    synthesis = case_synthesis if isinstance(case_synthesis, dict) else {}
    evidence_by_id: Dict[str, Dict[str, Any]] = {}
    candidates: Dict[str, List[Dict[str, Any]]] = {field: [] for field in NARRATIVE_FIELDS}

    for field in NARRATIVE_FIELDS:
        ordinal = 0
        for source_section in _SOURCE_SECTIONS[field]:
            for statement in _valid_dicts(synthesis.get(source_section)):
                text = str(statement.get("text") or "").strip()
                references = _valid_dicts(statement.get("evidence"))
                evidence_ids: List[str] = []
                for reference in references:
                    if reference.get("type") not in {"biomarker", "symptom", "profile"}:
                        continue
                    if not str(reference.get("id") or "").strip():
                        continue
                    evidence_id = _evidence_id(reference)
                    evidence_by_id.setdefault(
                        evidence_id,
                        _public_evidence(reference, evidence_id),
                    )
                    if evidence_id not in evidence_ids:
                        evidence_ids.append(evidence_id)
                if not text or not evidence_ids:
                    continue

                statement_id = f"cs:{field}:{ordinal}"
                details = {
                    key: deepcopy(value)
                    for key, value in statement.items()
                    if key not in {"text", "evidence"} and value not in (None, "")
                }
                candidates[field].append(
                    {
                        "statement_id": statement_id,
                        "text": text,
                        "evidence_ids": evidence_ids,
                        "details": details,
                    }
                )
                ordinal += 1

    return {
        "context_version": "verified_case_synthesis_context_v1",
        "source_version": synthesis.get("version"),
        "locale": synthesis.get("locale") or "en",
        "candidates": candidates,
        "evidence_registry": [evidence_by_id[key] for key in sorted(evidence_by_id)],
    }


def _default_selection(context: Dict[str, Any]) -> Dict[str, Any]:
    selection: Dict[str, Any] = {}
    evidence_ids: set[str] = set()
    candidates = context.get("candidates") if isinstance(context.get("candidates"), dict) else {}
    for field in NARRATIVE_FIELDS:
        rows = _valid_dicts(candidates.get(field))[: _FIELD_LIMITS[field]]
        selection[field] = [row["statement_id"] for row in rows]
        for row in rows:
            evidence_ids.update(str(item) for item in row.get("evidence_ids") or [])
    selection["evidence_links"] = sorted(evidence_ids)
    return selection


def _validate_selection(selection: Any, context: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(selection, dict):
        raise ValueError("narrative selection must be a JSON object")
    if set(selection) != set(GROUNDED_AI_NARRATIVE_FIELDS):
        raise ValueError("narrative selection must contain exactly the required fields")

    candidates = context.get("candidates") if isinstance(context.get("candidates"), dict) else {}
    normalized: Dict[str, Any] = {}
    selected_evidence: set[str] = set()
    for field in NARRATIVE_FIELDS:
        raw_ids = selection.get(field)
        if not isinstance(raw_ids, list) or not all(isinstance(item, str) for item in raw_ids):
            raise ValueError(f"{field} must be a list of statement IDs")
        allowed_rows = _valid_dicts(candidates.get(field))
        allowed = {str(row.get("statement_id")): row for row in allowed_rows}
        if allowed and not raw_ids:
            raise ValueError(f"{field} cannot be empty when verified candidates exist")
        if len(raw_ids) > _FIELD_LIMITS[field] or len(set(raw_ids)) != len(raw_ids):
            raise ValueError(f"{field} contains too many or duplicate statement IDs")
        if any(statement_id not in allowed for statement_id in raw_ids):
            raise ValueError(f"{field} references a statement outside its verified candidate set")
        normalized[field] = raw_ids
        for statement_id in raw_ids:
            selected_evidence.update(str(item) for item in allowed[statement_id].get("evidence_ids") or [])

    raw_evidence = selection.get("evidence_links")
    if not isinstance(raw_evidence, list) or not all(isinstance(item, str) for item in raw_evidence):
        raise ValueError("evidence_links must be a list of evidence IDs")
    if len(set(raw_evidence)) != len(raw_evidence) or set(raw_evidence) != selected_evidence:
        raise ValueError("evidence_links must exactly match evidence used by selected statements")
    registry_ids = {
        str(item.get("evidence_id"))
        for item in _valid_dicts(context.get("evidence_registry"))
        if item.get("evidence_id")
    }
    if not selected_evidence.issubset(registry_ids):
        raise ValueError("selection references evidence outside the verified registry")
    normalized["evidence_links"] = sorted(selected_evidence)
    return normalized


def _materialize(
    selection: Dict[str, Any],
    context: Dict[str, Any],
    *,
    source: str,
    fallback_reason: str | None,
) -> Dict[str, Any]:
    candidates = context.get("candidates") if isinstance(context.get("candidates"), dict) else {}
    result: Dict[str, Any] = {}
    used_ids: set[str] = set()
    for field in NARRATIVE_FIELDS:
        by_id = {
            str(row.get("statement_id")): row
            for row in _valid_dicts(candidates.get(field))
            if row.get("statement_id")
        }
        items: List[Dict[str, Any]] = []
        for statement_id in selection[field]:
            row = by_id[statement_id]
            evidence_ids = list(row.get("evidence_ids") or [])
            used_ids.update(evidence_ids)
            item = {
                "statement_id": statement_id,
                "text": row["text"],
                "evidence_ids": evidence_ids,
            }
            item.update(deepcopy(row.get("details") or {}))
            items.append(item)
        result[field] = items

    registry = {
        str(item.get("evidence_id")): item
        for item in _valid_dicts(context.get("evidence_registry"))
        if item.get("evidence_id")
    }
    result["evidence_links"] = [deepcopy(registry[evidence_id]) for evidence_id in sorted(used_ids)]
    statement_count = sum(len(result[field]) for field in NARRATIVE_FIELDS)
    return {
        "version": GROUNDED_AI_NARRATIVE_VERSION,
        "status": "complete" if statement_count else "insufficient_data",
        "source": source,
        "locale": context.get("locale") or "en",
        "model": getattr(settings, "active_llm_model", None) if source == "llm_selection" else None,
        "prompt_version": GROUNDED_AI_NARRATIVE_PROMPT_VERSION,
        **result,
        "grounding": {
            "policy": "llm_selects_verified_statement_ids_only",
            "source_context_version": context.get("context_version"),
            "source_case_synthesis_version": context.get("source_version"),
            "all_statements_grounded": True,
            "statement_count": statement_count,
            "evidence_count": len(result["evidence_links"]),
            "fallback_used": source == "deterministic_fallback",
            "fallback_reason": fallback_reason,
        },
    }


async def generate_grounded_narrative_selection(
    context: Dict[str, Any],
    *,
    user_id: str | None = None,
    upload_id: str | None = None,
) -> Dict[str, Any]:
    """Ask the LLM only to select IDs from a closed verified context."""
    prompt = (
        "Select and order the most useful verified statements for each narrative section. "
        "You may only copy statement_id values from the matching section in verified_context.candidates. "
        "Do not write or rewrite prose. Include every required key exactly once. "
        "For evidence_links, return the sorted unique union of evidence_ids used by all selected statements. "
        "If a candidate section is non-empty, select at least one statement; if it is empty, return [].\n\n"
        "Required JSON keys: "
        + json.dumps(list(GROUNDED_AI_NARRATIVE_FIELDS))
        + "\n\nverified_context:\n"
        + json.dumps(context, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    )
    raw = await _chat_completion(
        prompt,
        task_name="generate_grounded_narrative",
        user_id=user_id,
        upload_id=upload_id,
    )
    payload = json.loads(_strip_code_block(raw))
    if not isinstance(payload, dict):
        raise ValueError("grounded narrative model response must be a JSON object")
    return payload


async def build_grounded_ai_narrative(
    *,
    case_synthesis: Dict[str, Any] | None,
    user_id: str | None = None,
    upload_id: str | None = None,
    use_llm: bool = True,
    generator: SelectionGenerator | None = None,
) -> Dict[str, Any]:
    context = build_verified_narrative_context(case_synthesis)
    fallback = _default_selection(context)
    has_candidates = any(context["candidates"][field] for field in NARRATIVE_FIELDS)
    if not has_candidates:
        return _materialize(
            _validate_selection(fallback, context),
            context,
            source="deterministic_fallback",
            fallback_reason="no_verified_statements",
        )
    if not use_llm:
        return _materialize(
            _validate_selection(fallback, context),
            context,
            source="deterministic_fallback",
            fallback_reason="llm_generation_disabled",
        )
    if not is_llm_configured():
        return _materialize(
            _validate_selection(fallback, context),
            context,
            source="deterministic_fallback",
            fallback_reason="llm_not_configured",
        )

    selected_by = generator or generate_grounded_narrative_selection
    try:
        selection = await selected_by(
            context,
            user_id=user_id,
            upload_id=upload_id,
        )
        validated = _validate_selection(selection, context)
        return _materialize(validated, context, source="llm_selection", fallback_reason=None)
    except Exception as exc:
        logger.error(
            "grounded_narrative_fallback upload_id=%s reason=%s",
            upload_id,
            type(exc).__name__,
        )
        return _materialize(
            _validate_selection(fallback, context),
            context,
            source="deterministic_fallback",
            fallback_reason=f"invalid_llm_selection:{type(exc).__name__}",
        )
