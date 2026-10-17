"""Strict validation of COMPLETE original protocol actions.

Validation always runs on the full action as received. Only after it passes is
an authorization projection (identity + title/body) built server-side. Unsafe
or undeclared fields are never stripped to make an action pass.

Caller-provided ``grounding`` is untrusted and always rejected; the adapter
alone designates GROUNDED / GENERAL_EDUCATIONAL outcomes. Lexical checks are
conservative and intentionally not claimed to be comprehensive.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from app.services.safety.safety_engine import (
    _DOSAGE_PATTERN,
    _PRESCRIPTIVE_TREATMENT_PATTERN,
    _UNSUPPORTED_SUPPLEMENT_INDICATION,
    _diagnosis_like_text,
)

IDENTITY_FIELDS = ("id", "action_id", "key", "recommendation_key", "title", "body")
PRESENTATION_FIELDS = ("category", "priority", "source", "source_url", "evidence_level", "requires_doctor")
_OPTIONAL_PRESENTATION_FIELDS = frozenset({"category", "source", "source_url", "evidence_level"})
# Closed sets of identifiers observed in existing protocol items, KB seeds and the pipeline.
# Free-text values (e.g. publisher names) are a contract gap and are rejected until registered.
_SOURCES = frozenset({
    "ai_protocol", "vitaloop_analysis_core", "vitaloop_pattern_engine", "vitaloop_context_engine",
    "guideline_placeholder", "clinical_guideline_placeholder", "symptom_check", "deterministic_fallback",
})
_CATEGORIES = frozenset({
    "nutrition", "nutrition_context", "training_recovery", "supplement", "supplement_safety", "lifestyle",
    "profile", "hematology", "micronutrient", "metabolic", "liver", "cardiometabolic", "endocrine", "kidney",
    "inflammation", "oncology", "cardiac", "coagulation",
})
_EVIDENCE_LEVELS = frozenset({
    "best_practice", "clinical_context", "context_required", "contextual_lab_pattern", "dri_context",
    "fallback", "managed_context", "safety", "low", "moderate", "high", "clinical_guideline_context",
})
_CLOSED = {"category": _CATEGORIES, "evidence_level": _EVIDENCE_LEVELS, "source": _SOURCES}
_PRIORITIES = frozenset({"urgent", "critical", "high", "medium", "low"})
_MAX_FIELD_LENGTH = 2000
_PERSONAL_OR_CLAIM = re.compile(
    r"\b(?:you|your|yours|patient|my|based on)\b|"
    r"\b(?:is|are|was|were|looks?)\s+(?:low|high|elevated|deficient|abnormal|critical|borderline)\b",
    re.IGNORECASE,
)


def _hard_unsafe(value: str) -> bool:
    return bool(
        _DOSAGE_PATTERN.search(value)
        or _PRESCRIPTIVE_TREATMENT_PATTERN.search(value)
        or _diagnosis_like_text(value)
    )


_HOST_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
_TLD = re.compile(r"^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$")


def _valid_hostname(host: str) -> bool:
    if not host or len(host) > 253 or host != host.lower():
        return False
    labels = host.split(".")
    return (
        len(labels) >= 2
        and all(_HOST_LABEL.match(label) for label in labels)
        and bool(_TLD.match(labels[-1]))
    )


def _safe_url(value: str) -> bool:
    """HTTPS only, parsed hostname/port validated; says nothing about clinical authority."""
    if not value.isascii() or not value.isprintable() or any(c.isspace() or c == "\\" for c in value):
        return False
    if len(value) > 500 or value != value.strip():
        return False
    try:
        parsed = urlparse(value)
        port = parsed.port
        host = parsed.hostname
    except ValueError:
        return False
    if parsed.scheme != "https" or parsed.username is not None or parsed.password is not None:
        return False
    if not parsed.netloc or parsed.netloc.endswith(":") or (port is not None and not 1 <= port <= 65535):
        return False
    return _valid_hostname(host or "")


def validate_original_action(
    action: Any,
    *,
    educational: bool = False,
    kb_candidate: bool = False,
) -> str | None:
    """Return a rejection reason, or None when the complete action is acceptable.

    ``kb_candidate`` marks a keyed action whose title/body must additionally
    equal trusted frozen KB content before it can be authorized. For those the
    hedged-indication wording check is left to that exact-content binding;
    dose, prescriptive-treatment and diagnosis checks always apply.
    """
    if not isinstance(action, dict):
        return "invalid_action"
    if "grounding" in action:
        return "caller_grounding_untrusted"
    allowed = set(IDENTITY_FIELDS) | set(PRESENTATION_FIELDS)
    if educational:
        allowed -= {"key", "recommendation_key"}
    if set(action) - allowed:
        return "undeclared_action_fields"
    for field, value in action.items():
        # Existing KB/report shaping represents unavailable presentation
        # metadata as null. It is not a hidden instruction and must remain
        # distinguishable from an undeclared field; output projection omits it.
        if field in _OPTIONAL_PRESENTATION_FIELDS and value is None:
            continue
        if field == "requires_doctor":
            if not isinstance(value, bool):
                return "invalid_field_type"
            continue
        if not isinstance(value, str) or len(value) > _MAX_FIELD_LENGTH:
            return "invalid_field_type"
        if field in ("title", "body"):
            if _hard_unsafe(value):
                return "unsafe_action_content"
            if not kb_candidate and _UNSUPPORTED_SUPPLEMENT_INDICATION.search(value):
                return "unsafe_action_content"
        elif field in _CLOSED:
            if value not in _CLOSED[field]:
                return "invalid_presentation_field"
        elif field == "priority":
            if value not in _PRIORITIES:
                return "invalid_presentation_field"
        elif field == "source_url":
            if not _safe_url(value):
                return "invalid_presentation_field"
        elif _hard_unsafe(value) or _PERSONAL_OR_CLAIM.search(value):
            return "invalid_identifier_field"
    if not isinstance(action.get("title"), str) or not isinstance(action.get("body"), str):
        return "missing_action_content"
    return None


def authorization_projection(action: dict[str, Any]) -> dict[str, Any]:
    """Server-built projection; call only after validate_original_action passes."""
    return {field: action[field] for field in IDENTITY_FIELDS if field in action}


def presentation_fields(action: dict[str, Any]) -> dict[str, Any]:
    return {
        field: action[field]
        for field in PRESENTATION_FIELDS
        if field in action and action[field] is not None
    }
