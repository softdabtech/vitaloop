"""Server-owned canonical-action adapter (C4.1B-02D).

BLOCKED_PENDING_INTEGRATION: no generation or persistence caller uses this yet.

Contract
- Input: real protocol sections, the authenticated principal and a report
  version id. No canonical content, evidence, grounding declarations, trust
  flags or report context is accepted from callers; any caller ``grounding``
  withholds the action.
- The complete original action is validated first (protocol_action_contract).
  Unsafe or undeclared fields withhold the whole action; nothing is stripped.
- Keyed actions are personalized KB candidates: authorized against ONE
  owner-scoped frozen report load, and output title/body are the frozen
  canonical KB content. Divergent title/body is rejected, never substituted.
  Dose, prescriptive and diagnosis checks still apply to canonical text.
- Unkeyed actions that pass strict generic-content checks are designated
  GENERAL_EDUCATIONAL by the server (never by the caller) and never inherit KB
  authorization. Failed personalized actions are withheld, never relabelled.
- Only allowlisted non-clinical presentation fields are carried over.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Mapping

from app.services.protocol_action_authorization import (
    _TrustedContext,
    _authorize_with_context,
    _load_trusted_context,
    _principal_user_id,
)
from app.services.protocol_action_contract import (
    authorization_projection,
    presentation_fields,
    validate_original_action,
)
from app.services.protocol_evidence import build_protocol_evidence_registry, validate_action_grounding
from app.services.protocol_evidence_snapshot import verify_protocol_evidence_snapshot

logger = logging.getLogger(__name__)
_CLASSES = ("GROUNDED", "GENERAL_EDUCATIONAL", "UNSUPPORTED")


def _record(section: str, index: int, action: Any, classification: str, reasons: list[str]) -> dict[str, Any]:
    action_id = action.get("action_id") if isinstance(action, dict) else None
    return {
        "section": section,
        "index": index,
        "action_id": action_id if isinstance(action_id, str) else None,
        "classification": classification,
        "reasons": reasons,
    }


def _educational(action: dict[str, Any], context: _TrustedContext) -> tuple[dict[str, Any] | None, list[str]]:
    try:
        registry = build_protocol_evidence_registry(
            report_id=context.report_version_id,
            biomarkers=context.input_context["biomarkers"],
            symptom_snapshot=context.input_context.get("symptom_snapshot"),
        )
    except (KeyError, TypeError, ValueError, AttributeError):
        return None, ["educational_context_unavailable"]
    # The server, not the caller, designates the educational category.
    designated = {
        **authorization_projection(action),
        "grounding": {"designation": "general_educational", "personalized_claims": False, "evidence_refs": []},
    }
    result = validate_action_grounding(designated, registry)
    if result["outcome"] != "GENERAL_EDUCATIONAL":
        return None, list(result.get("reasons") or ["educational_validation_failed"])
    return {**presentation_fields(action), **designated}, []


async def adapt_protocol_actions(
    *,
    protocol: dict[str, list[Any]],
    authenticated_principal: Mapping[str, Any],
    report_version_id: str,
) -> dict[str, Any]:
    user_id = _principal_user_id(authenticated_principal)
    rv_id = report_version_id.strip() if isinstance(report_version_id, str) else ""
    context: _TrustedContext | dict[str, Any] | None = None
    if user_id is not None and rv_id:
        context = await _load_trusted_context(user_id, rv_id)
    return _adapt_with_context(protocol=protocol, context=context)


def _adapt_with_context(
    *,
    protocol: dict[str, list[Any]],
    context: _TrustedContext | dict[str, Any] | None,
) -> dict[str, Any]:
    """Apply the complete-action gate with a context constructed by the server.

    This is deliberately private: public callers use ``adapt_protocol_actions``
    and therefore get an owner-scoped persisted-report load. The pipeline uses
    this helper only with evidence it just froze from its single KB evaluation.
    """
    adapted: dict[str, list[dict[str, Any]]] = {}
    classifications: list[dict[str, Any]] = []
    summary: dict[str, dict[str, Any]] = {}

    for section, items in (protocol or {}).items():
        adapted[section] = []
        for index, action in enumerate(items or []):
            keyed = isinstance(action, dict) and bool(
                str(action.get("key") or action.get("recommendation_key") or "").strip()
            )
            reason = validate_original_action(action, kb_candidate=keyed) if keyed else (
                validate_original_action(action, educational=True)
            )
            if reason is not None:
                classifications.append(_record(section, index, action, "UNSUPPORTED", [reason]))
                continue

            if not isinstance(context, _TrustedContext):
                reasons = list(context.get("reasons") or []) if isinstance(context, dict) else ["invalid_authenticated_context"]
                classifications.append(_record(section, index, action, "UNSUPPORTED", reasons or ["authorization_context_unavailable"]))
                continue

            if not keyed:
                output, reasons = _educational(action, context)
                if output is None:
                    classifications.append(_record(section, index, action, "UNSUPPORTED", reasons))
                else:
                    adapted[section].append(output)
                    classifications.append(_record(section, index, action, "GENERAL_EDUCATIONAL", []))
                continue

            try:
                result = _authorize_with_context(authorization_projection(action), context, None)
            except Exception as exc:
                logger.error("protocol_action_adapter_item_failed exception_type=%s", type(exc).__name__)
                classifications.append(_record(section, index, action, "UNSUPPORTED", ["authorization_failed"]))
                continue
            if result.get("outcome") != "GROUNDED":
                classifications.append(_record(section, index, action, "UNSUPPORTED", list(result.get("reasons") or [])))
                continue
            adapted[section].append({**presentation_fields(action), **result["authorized_action"]})
            classifications.append(_record(section, index, action, "GROUNDED", []))

    for record in classifications:
        bucket = summary.setdefault(record["section"], {name: 0 for name in _CLASSES})
        bucket[record["classification"]] += 1
    for section in adapted:
        summary.setdefault(section, {name: 0 for name in _CLASSES})

    output = {"protocol": adapted, "classifications": classifications, "summary": summary}
    json.dumps(output)
    return output


def adapt_protocol_actions_from_frozen_evidence(
    *,
    protocol: dict[str, list[Any]],
    frozen_evidence: Mapping[str, Any],
    report_version_id: str,
) -> dict[str, Any]:
    """Adapt generated actions using only the current server-built frozen evidence.

    This is an in-process pipeline boundary, not a public authorization API.
    It accepts neither an authenticated principal nor report context from a
    caller. ``frozen_evidence`` must be the exact result of
    ``build_pipeline_frozen_evidence`` for the report being persisted.
    """
    rv_id = report_version_id.strip() if isinstance(report_version_id, str) else ""
    built = frozen_evidence if isinstance(frozen_evidence, Mapping) else {}
    input_context = built.get("input_context")
    status = built.get("status")
    context: _TrustedContext | dict[str, Any]

    if not rv_id or not isinstance(input_context, dict):
        context = {"reasons": ["frozen_evidence_unavailable"]}
    elif status == "BUILT":
        snapshot = built.get("snapshot")
        try:
            verdict = verify_protocol_evidence_snapshot(
                snapshot,
                report_version_id=rv_id,
                input_context=input_context,
            )
        except (TypeError, ValueError, AttributeError, KeyError):
            verdict = None
        if isinstance(verdict, dict) and verdict.get("valid") is True:
            context = _TrustedContext(rv_id, input_context, snapshot)
        else:
            context = {"reasons": ["frozen_evidence_verification_failed"]}
    elif status == "NON_AUTHORIZING":
        # General education still needs the real report-owned evidence registry,
        # but keyed actions receive no usable snapshot and fail closed.
        context = _TrustedContext(rv_id, input_context, {})
    else:
        context = {"reasons": ["frozen_evidence_unavailable"]}

    return _adapt_with_context(protocol=protocol, context=context)
