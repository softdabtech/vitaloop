"""Frozen protocol evidence: build in the pipeline, verify on owner-scoped read.

Build side: server-owned and in-process. Inputs are the pipeline's own
normalized biomarkers, verified symptom snapshot and the single KB evaluation
already produced for this run; nothing comes from AI or client payloads.

The payload is stored as its own versioned object at
``report_versions.explainability["frozen_protocol_evidence"]``. It is built
once, before URL stripping, safety sanitization or localization of
``knowledge_evaluation``, and is never regenerated from that mutable object.

Read side: ``verify_persisted_frozen_evidence`` only consumes the stored
payload. It never reconstructs evidence from ``knowledge_evaluation``.
"""

from __future__ import annotations

import json
import logging
from copy import deepcopy
from typing import Any

from app.services.protocol_evidence_snapshot import (
    _sha256,
    build_protocol_evidence_snapshot,
    verify_protocol_evidence_snapshot,
)

logger = logging.getLogger(__name__)

FROZEN_EVIDENCE_KEY = "frozen_protocol_evidence"
FROZEN_EVIDENCE_SCHEMA = "protocol_frozen_evidence_v1"
_PAYLOAD_FIELDS = {"schema", "report_version_id", "snapshot"}
# Valid report with no recommendation-bearing rules: records the evaluated input
# binding only. It authorizes nothing and carries no evidence or recommendations.
NON_AUTHORIZING_SCHEMA = "protocol_frozen_evidence_nonauthorizing_v1"
NON_AUTHORIZING_REASON = "no_action_authorizing_rules"
NON_AUTHORIZING_READ_REASON = "frozen_protocol_evidence_non_authorizing"
_NON_AUTHORIZING_FIELDS = {"schema", "report_version_id", "reason", "input_context_hash"}


def _unavailable(reason: str) -> dict[str, Any]:
    return {"status": "UNAVAILABLE", "reason": reason, "snapshot": None, "payload": None, "input_context": None}


def _action_authorizing_rules(matched_rules: Any) -> list[dict[str, Any]] | None:
    """Rules that carry recommendation keys. Keyless interpretive rules (an empty
    ``recommendation_keys`` list, as the evaluator emits) authorize no action and
    are excluded without invalidating the others. Anything else that is not a
    usable key list is malformed and fails the whole build; keys are never invented.
    """
    if not isinstance(matched_rules, list):
        return None
    eligible: list[dict[str, Any]] = []
    for rule in matched_rules:
        if not isinstance(rule, dict):
            return None
        keys = rule.get("recommendation_keys")
        if not isinstance(keys, list):
            return None
        if keys:
            eligible.append(rule)
    return eligible


def _catalog_rows(eligible_rules: list[dict[str, Any]], generated: Any) -> list[dict[str, Any]] | None:
    if not isinstance(generated, list):
        return None
    expected_keys: set[str] = set()
    for rule in eligible_rules:
        keys = rule["recommendation_keys"]
        if any(not isinstance(key, str) or not key.strip() for key in keys) or len(set(keys)) != len(keys):
            return None
        expected_keys.update(keys)
    rows_by_key: dict[str, dict[str, Any]] = {}
    for item in generated:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        if not isinstance(key, str) or key not in expected_keys:
            continue
        if key in rows_by_key:
            return None
        rows_by_key[key] = item
    if not expected_keys or set(rows_by_key) != expected_keys:
        return None
    return [rows_by_key[key] for key in sorted(expected_keys)]


def input_context_from_report_inputs(input_snapshot: Any) -> dict[str, Any] | None:
    if not isinstance(input_snapshot, dict) or not isinstance(input_snapshot.get("biomarkers"), list):
        return None
    return {
        "biomarkers": input_snapshot["biomarkers"],
        "symptom_snapshot": input_snapshot.get("symptom_snapshot"),
    }


def build_pipeline_frozen_evidence(
    *,
    report_version_id: Any,
    normalized_biomarkers: Any,
    symptom_snapshot: Any,
    knowledge_evaluation: Any,
) -> dict[str, Any]:
    """Freeze the evaluation that was just run; fail closed (no raise) on any defect.

    Call immediately after the KB evaluation. Inputs are deep-copied through JSON
    so later in-place changes cannot alter the frozen data.
    """
    version_id = report_version_id.strip() if isinstance(report_version_id, str) else ""
    if not version_id:
        return _unavailable("report_version_id_unavailable")
    evaluation = knowledge_evaluation if isinstance(knowledge_evaluation, dict) else {}
    try:
        frozen = json.loads(
            json.dumps(
                {
                    "biomarkers": normalized_biomarkers,
                    "symptom_snapshot": symptom_snapshot,
                    "matched_rules": evaluation.get("matched_rules"),
                    "generated_recommendations": evaluation.get("generated_recommendations"),
                },
                sort_keys=True,
                allow_nan=False,
            )
        )
    except (TypeError, ValueError, OverflowError, RecursionError) as exc:
        logger.error("pipeline_frozen_evidence_inputs_invalid exception_type=%s", type(exc).__name__)
        return _unavailable("evaluation_output_malformed")

    input_context = input_context_from_report_inputs(frozen)
    if input_context is None:
        return _unavailable("report_inputs_malformed")
    eligible = _action_authorizing_rules(frozen["matched_rules"])
    if eligible is None:
        return _unavailable("evaluation_output_malformed")
    if not eligible:
        return {
            "status": "NON_AUTHORIZING",
            "reason": NON_AUTHORIZING_REASON,
            "snapshot": None,
            "payload": {
                "schema": NON_AUTHORIZING_SCHEMA,
                "report_version_id": version_id,
                "reason": NON_AUTHORIZING_REASON,
                "input_context_hash": _sha256(input_context),
            },
            "input_context": deepcopy(input_context),
        }
    rows = _catalog_rows(eligible, frozen["generated_recommendations"])
    if rows is None:
        return _unavailable("evaluation_time_recommendations_unavailable")
    try:
        snapshot = build_protocol_evidence_snapshot(
            report_version_id=version_id,
            input_context=input_context,
            evaluated_rules=eligible,
            canonical_recommendations=rows,
        )
        verdict = verify_protocol_evidence_snapshot(
            snapshot, report_version_id=version_id, input_context=input_context
        )
    except (TypeError, ValueError, OverflowError, RecursionError) as exc:
        logger.error("pipeline_frozen_evidence_invalid exception_type=%s", type(exc).__name__)
        return _unavailable("frozen_evidence_invalid")
    if not isinstance(verdict, dict) or verdict.get("valid") is not True:
        return _unavailable("frozen_evidence_failed_verification")
    return {
        "status": "BUILT",
        "reason": None,
        "snapshot": snapshot,
        "payload": {
            "schema": FROZEN_EVIDENCE_SCHEMA,
            "report_version_id": version_id,
            "snapshot": deepcopy(snapshot),
        },
        "input_context": deepcopy(input_context),
    }


def _verify_non_authorizing(payload: dict[str, Any], report_version: dict[str, Any], report_version_id: str) -> str:
    """Always returns a reason string: this state can never yield authorizing context."""
    if set(payload) != _NON_AUTHORIZING_FIELDS or payload.get("reason") != NON_AUTHORIZING_REASON:
        return "frozen_protocol_evidence_malformed"
    if payload.get("report_version_id") != report_version_id:
        return "frozen_protocol_evidence_report_mismatch"
    input_context = input_context_from_report_inputs(report_version.get("input_snapshot"))
    if input_context is None:
        return "frozen_report_inputs_unavailable"
    try:
        expected = _sha256(input_context)
    except (TypeError, ValueError, OverflowError, RecursionError):
        return "frozen_protocol_evidence_invalid"
    if payload.get("input_context_hash") != expected:
        return "frozen_protocol_evidence_invalid"
    return NON_AUTHORIZING_READ_REASON


def verify_persisted_frozen_evidence(
    report_version: dict[str, Any], *, report_version_id: str
) -> tuple[dict[str, Any], dict[str, Any]] | str:
    """Return (input_context, snapshot) from the stored payload, or a reason code.

    Consumes only ``explainability[frozen_protocol_evidence]`` and the persisted
    report input snapshot. Legacy reports without the payload are unsupported.
    """
    explainability = report_version.get("explainability")
    payload = explainability.get(FROZEN_EVIDENCE_KEY) if isinstance(explainability, dict) else None
    if payload is None:
        return "frozen_protocol_evidence_unavailable"
    if isinstance(payload, dict) and payload.get("schema") == NON_AUTHORIZING_SCHEMA:
        return _verify_non_authorizing(payload, report_version, report_version_id)
    if (
        not isinstance(payload, dict)
        or set(payload) != _PAYLOAD_FIELDS
        or payload.get("schema") != FROZEN_EVIDENCE_SCHEMA
    ):
        return "frozen_protocol_evidence_malformed"
    if payload.get("report_version_id") != report_version_id:
        return "frozen_protocol_evidence_report_mismatch"
    input_context = input_context_from_report_inputs(report_version.get("input_snapshot"))
    if input_context is None:
        return "frozen_report_inputs_unavailable"
    try:
        verdict = verify_protocol_evidence_snapshot(
            payload.get("snapshot"),
            report_version_id=report_version_id,
            input_context=input_context,
        )
    except (TypeError, ValueError, OverflowError, RecursionError) as exc:
        logger.error("frozen_evidence_verify_failed exception_type=%s", type(exc).__name__)
        return "frozen_protocol_evidence_invalid"
    if not isinstance(verdict, dict) or verdict.get("valid") is not True:
        return "frozen_protocol_evidence_invalid"
    return input_context, payload["snapshot"]
