"""Owner-scoped authorization using evidence frozen in a report version.

Authenticated-principal integration status: BLOCKED_PENDING_INTEGRATION.
There is no application caller yet. A future route must pass the mapping
returned by ``Depends(get_current_user)``; request bodies and query parameters
must never supply this value.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Mapping

from app.services import supabase_service
from app.services.protocol_pipeline_evidence import verify_persisted_frozen_evidence
from app.services.protocol_action_contract import authorization_projection, validate_original_action
from app.services.protocol_enrichment import ActionEvidenceBinding, _enrich_protocol_impl
from app.services.protocol_evidence import (
    _personalized_action_shape_error,
    build_protocol_evidence_registry,
    validate_action_grounding,
)
from app.services.protocol_evidence_snapshot import (
    _authorize_action_from_verified_snapshot,
    build_protocol_evidence_snapshot,
)

logger = logging.getLogger(__name__)

_ACTION_FIELDS = {"id", "action_id", "key", "recommendation_key", "title", "body", "grounding"}
_EDUCATIONAL_FIELDS = {"id", "action_id", "title", "body", "grounding"}
_REPORT_VERSION = "report_v1"
_ENRICHMENT_KWARGS = {
    "biomarkers", "prioritized", "safety_result", "health_states",
    "trend_analysis", "retest_suggestions", "domain_definitions", "locale",
}


def _evidence_binding(
    action: dict[str, Any],
    result: dict[str, Any],
    report_version_id: str,
    input_context: dict[str, Any],
) -> ActionEvidenceBinding | None:
    try:
        registry = build_protocol_evidence_registry(
            report_id=report_version_id,
            biomarkers=input_context["biomarkers"],
            symptom_snapshot=input_context.get("symptom_snapshot"),
        )
        ids = set(result["valid_reference_ids"])
        rows = sorted(
            {
                (
                    str(item["measurement"].get("name") or ""),
                    str(item["measurement"].get("canonical_name") or ""),
                    str(item["measurement"].get("status") or ""),
                )
                for item in registry["evidence"]
                if item.get("type") == "biomarker_measurement" and item.get("id") in ids
            }
        )
        return ActionEvidenceBinding(
            report_version_id=report_version_id,
            action_key=str(action["key"]),
            title=str(action["title"]),
            body=str(action["body"]),
            biomarkers=tuple(rows),
        )
    except (KeyError, TypeError, ValueError, AttributeError):
        return None


def _unsupported(reason: str) -> dict[str, Any]:
    return {"outcome": "UNSUPPORTED", "reasons": [reason], "valid_reference_ids": []}


def _serialization_safe(result: dict[str, Any]) -> dict[str, Any]:
    try:
        json.dumps(result, sort_keys=True, ensure_ascii=True, allow_nan=False)
    except (TypeError, ValueError, OverflowError, RecursionError):
        return _unsupported("authorization_result_not_serializable")
    return result


def _principal_user_id(authenticated_principal: Any) -> str | None:
    """Extract the verified JWT subject supplied by the server auth dependency."""
    if not isinstance(authenticated_principal, Mapping):
        return None
    user_id = authenticated_principal.get("sub")
    if not isinstance(user_id, str) or not user_id.strip():
        return None
    return user_id.strip()


async def authorize_protocol_action(
    *,
    action: Any,
    authenticated_principal: Mapping[str, Any],
    report_version_id: str,
    **untrusted_authorization_inputs: Any,
) -> dict[str, Any]:
    """Public, JSON-serializable authorization result. Never carries internal evidence."""
    return await _authorize(
        action=action,
        authenticated_principal=authenticated_principal,
        report_version_id=report_version_id,
        evidence_sink=None,
        untrusted_authorization_inputs=untrusted_authorization_inputs,
    )


async def _authorize(
    *,
    action: Any,
    authenticated_principal: Mapping[str, Any],
    report_version_id: str,
    evidence_sink: list[ActionEvidenceBinding] | None,
    untrusted_authorization_inputs: dict[str, Any],
) -> dict[str, Any]:
    """Authorize against one persisted report version owned by the user.

    ``authenticated_principal`` must be the verified server-side principal from
    ``Depends(get_current_user)``. This service extracts only its JWT ``sub``;
    it never accepts a client-provided user ID. Report context and evaluation
    evidence are loaded from the owner-scoped report_versions service. No
    client-provided context, matched rule, catalog row, or trust flag is used.

    End-to-end principal binding remains BLOCKED_PENDING_INTEGRATION until a
    real authenticated application caller invokes this service.
    """
    if untrusted_authorization_inputs:
        return _unsupported("unapproved_authorization_inputs")
    if not isinstance(action, dict):
        return _unsupported("invalid_action")
    user_id = _principal_user_id(authenticated_principal)
    if user_id is None:
        return _unsupported("invalid_authenticated_principal")
    if not isinstance(report_version_id, str) or not report_version_id.strip():
        return _unsupported("invalid_report_version")

    grounding = action.get("grounding")
    if isinstance(grounding, dict) and grounding.get("designation") == "general_educational":
        if (
            set(action) - _EDUCATIONAL_FIELDS
            or not isinstance(action.get("title"), str)
            or not isinstance(action.get("body"), str)
        ):
            return _unsupported("unapproved_action_fields")
        result = validate_action_grounding(
            action,
            {"report_id": "education", "evidence": []},
        )
        if result["outcome"] != "GENERAL_EDUCATIONAL":
            return result
        return _serialization_safe({**result, "authorized_action": action})

    if set(action) - _ACTION_FIELDS or "grounding" in action:
        return _unsupported("unapproved_action_fields")
    loaded = await _load_trusted_context(user_id, report_version_id.strip())
    if isinstance(loaded, dict):
        return loaded
    return _authorize_with_context(action, loaded, evidence_sink)


@dataclass(frozen=True)
class _TrustedContext:
    """Internal only: never accepted from callers or returned in public results."""

    report_version_id: str
    input_context: dict[str, Any]
    snapshot: dict[str, Any]


async def _load_trusted_context(
    user_id: str, rv_id: str
) -> _TrustedContext | dict[str, Any]:
    """One owner-scoped report load; returns the context or an UNSUPPORTED result."""
    try:
        report_version = await supabase_service.get_report_version_for_user(
            user_id,
            rv_id,
        )
    except Exception as exc:
        logger.error(
            "protocol_action_report_load_failed exception_type=%s",
            type(exc).__name__,
        )
        return _unsupported("report_version_unavailable")
    if not isinstance(report_version, dict):
        return _unsupported("report_version_unavailable")
    if (
        str(report_version.get("id") or "") != rv_id
        or str(report_version.get("user_id") or "") != user_id
    ):
        return _unsupported("report_owner_or_identity_mismatch")
    if report_version.get("status") != "completed":
        return _unsupported("report_version_not_completed")
    if report_version.get("version") != _REPORT_VERSION:
        return _unsupported("unsupported_report_snapshot_version")

    frozen = verify_persisted_frozen_evidence(report_version, report_version_id=rv_id)
    if isinstance(frozen, str):
        return _unsupported(frozen)
    input_context, snapshot = frozen
    return _TrustedContext(rv_id, input_context, snapshot)


def _authorize_with_context(
    action: dict[str, Any],
    ctx: _TrustedContext,
    evidence_sink: list[ActionEvidenceBinding] | None,
) -> dict[str, Any]:
    if not isinstance(action, dict):
        return _unsupported("invalid_action")
    if set(action) - _ACTION_FIELDS or "grounding" in action:
        return _unsupported("unapproved_action_fields")
    try:
        result = _authorize_action_from_verified_snapshot(
            action,
            ctx.snapshot,
            report_version_id=ctx.report_version_id,
            input_context=ctx.input_context,
        )
    except Exception as exc:
        # Log only the exception class: messages and report context may contain
        # patient data and must not be emitted by this trust-boundary failure.
        logger.error(
            "protocol_action_snapshot_verification_failed exception_type=%s",
            type(exc).__name__,
        )
        return _unsupported("frozen_evidence_verification_failed")
    if result.get("outcome") != "GROUNDED":
        return result
    authorized_action = result.get("authorized_action")
    if (
        not isinstance(authorized_action, dict)
        or _personalized_action_shape_error(authorized_action)
    ):
        return _unsupported("authorized_action_shape_invalid")
    safe = _serialization_safe(result)
    if evidence_sink is not None:
        binding = _evidence_binding(authorized_action, result, ctx.report_version_id, ctx.input_context)
        if binding is not None:
            evidence_sink.append(binding)
    return safe




async def enrich_protocol_with_authorization(
    *,
    protocol: dict[str, list[dict[str, Any]]],
    authenticated_principal: Mapping[str, Any],
    report_version_id: str,
    **enrichment_kwargs: Any,
) -> dict[str, list[dict[str, Any]]]:
    """Server-owned authorization-to-enrichment path.

    Evidence is derived here from the owner-scoped frozen report for each
    action's exact key/title/body and handed straight to the enricher; no
    caller supplies evidence. Actions that fail authorization get no
    action-specific attribution. BLOCKED_PENDING_INTEGRATION: no generation
    or persistence caller uses this yet.
    """
    # Any unexpected argument (trust_flags, forged context/evidence, ...) is
    # rejected safely: no authorization runs and no evidence is attached.
    unexpected = set(enrichment_kwargs) - _ENRICHMENT_KWARGS
    if unexpected:
        logger.warning("protocol_enrichment_unexpected_arguments count=%d", len(unexpected))
        enrichment_kwargs = {k: v for k, v in enrichment_kwargs.items() if k in _ENRICHMENT_KWARGS}
    bindings: dict[tuple[str, int], ActionEvidenceBinding] = {}
    user_id = _principal_user_id(authenticated_principal)
    rv_id = report_version_id.strip() if isinstance(report_version_id, str) else ""
    positions = [
        (section, index, item)
        for section, items in (protocol or {}).items()
        for index, item in enumerate(items or [])
        if isinstance(item, dict)
    ]
    if not unexpected and positions and user_id is not None and rv_id:
        loaded = await _load_trusted_context(user_id, rv_id)
        if isinstance(loaded, _TrustedContext):
            for section, index, item in positions:
                sink: list[ActionEvidenceBinding] = []
                try:
                    # The complete original action is validated first; the
                    # authorization projection is built only afterwards.
                    if validate_original_action(item, kb_candidate=True) is not None:
                        continue
                    result = _authorize_with_context(authorization_projection(item), loaded, sink)
                except Exception as exc:
                    logger.error("protocol_action_batch_item_failed exception_type=%s", type(exc).__name__)
                    continue
                if result.get("outcome") == "GROUNDED" and len(sink) == 1:
                    bindings[(section, index)] = sink[0]
    return _enrich_protocol_impl(
        protocol,
        trusted_evidence=bindings,
        trusted_report_version_id=str(report_version_id).strip(),
        **enrichment_kwargs,
    )
