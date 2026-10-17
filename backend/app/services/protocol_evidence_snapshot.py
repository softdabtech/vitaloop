"""Deterministic, frozen evidence contract for protocol-action authorization."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from app.services.knowledge.evaluator import KB_INELIGIBLE_STATUSES
from app.services.protocol_evidence import (
    _json_safe,
    build_protocol_evidence_registry,
    validate_evidence_reference,
)

SNAPSHOT_SCHEMA = "protocol_action_evidence_snapshot_v1"
_SNAPSHOT_FIELDS = {
    "schema",
    "report_version_id",
    "input_context_hash",
    "entries",
    "integrity_hash",
}
_ENTRY_FIELDS = {
    "rule",
    "recommendation",
    "rule_evidence",
    "matched_evidence",
    "evidence_refs",
}
_RULE_FIELDS = {"id", "key", "version", "source", "source_url", "medical_reviewed_at"}
_RECOMMENDATION_FIELDS = {"key", "title", "body", "source", "source_url"}
_ACTION_FIELDS = {"id", "action_id", "key", "recommendation_key", "title", "body"}
_CONTEXT_FIELDS = {"biomarkers", "symptom_snapshot"}


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        allow_nan=False,
    )


def _sha256(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _normalize_marker_key(value: Any) -> str:
    return (
        str(value or "")
        .strip()
        .casefold()
        .removeprefix("canonical_")
        .replace("_", " ")
        .replace("-", " ")
    )


def _matched_atoms(value: Any):
    if isinstance(value, dict):
        if value.get("matched") is True and value.get("type") in {"lab_marker", "symptom"}:
            yield value
        for child in value.values():
            yield from _matched_atoms(child)
    elif isinstance(value, list):
        for child in value:
            yield from _matched_atoms(child)


def _matched_evidence_context(
    rule: dict[str, Any],
    *,
    input_context: dict[str, Any],
    registry: dict[str, Any],
) -> list[dict[str, Any]]:
    biomarkers = input_context["biomarkers"]
    captured: list[dict[str, Any]] = []
    atoms = list(_matched_atoms(rule.get("evidence")))
    if not atoms:
        raise ValueError("evaluated rule has no matched evidence atoms")
    for atom in atoms:
        if atom["type"] == "lab_marker":
            atom_key = _normalize_marker_key(atom.get("key"))
            rows = [
                biomarker
                for biomarker in biomarkers
                if isinstance(biomarker, dict)
                and atom_key
                in {
                    _normalize_marker_key(biomarker.get("name")),
                    _normalize_marker_key(biomarker.get("canonical_name")),
                }
            ]
            if len(rows) != 1:
                raise ValueError("matched biomarker identity is missing or ambiguous")
            biomarker = rows[0]
            status = str(biomarker.get("status") or "").strip().upper()
            if not status or status in KB_INELIGIBLE_STATUSES:
                raise ValueError("matched biomarker status is missing or ineligible")
            if (
                atom.get("value") != biomarker.get("value")
                or not isinstance(atom.get("unit"), str)
                or atom["unit"].strip().casefold()
                != str(biomarker.get("unit") or "").strip().casefold()
            ):
                raise ValueError("matched biomarker value or unit conflicts with frozen input")
            reference = _registry_evidence_reference(
                registry,
                evidence_type="biomarker_measurement",
                predicate=lambda item: item.get("measurement", {}).get("value")
                == biomarker.get("value")
                and item.get("measurement", {}).get("unit") == biomarker.get("unit")
                and item.get("measurement", {}).get("status") == biomarker.get("status")
                and _normalize_marker_key(item.get("measurement", {}).get("name"))
                == _normalize_marker_key(biomarker.get("name")),
                claim="measurement",
            )
            if reference is None:
                raise ValueError("matched biomarker reference is missing or ambiguous")
            captured.append(
                {
                    "type": "lab_marker",
                    "key": atom.get("key"),
                    "value": atom.get("value"),
                    "unit": atom.get("unit"),
                    "status": status,
                    "evidence_ref": reference,
                }
            )
        else:
            reference = _registry_evidence_reference(
                registry,
                evidence_type="present_symptom_concept",
                predicate=lambda item: str(item.get("concept_id") or "").casefold()
                == str(atom.get("key") or "").casefold(),
                claim="present_symptom",
            )
            if reference is None:
                raise ValueError("matched symptom evidence is missing or ambiguous")
            captured.append(
                {
                    "type": "symptom",
                    "key": atom.get("key"),
                    "matched": True,
                    "evidence_ref": reference,
                }
            )
    captured.sort(key=_canonical_json)
    return captured


def _registry_evidence_reference(
    registry: dict[str, Any],
    *,
    evidence_type: str,
    predicate,
    claim: str,
) -> dict[str, Any] | None:
    entries = [
        item
        for item in registry["evidence"]
        if item.get("type") == evidence_type and predicate(item)
    ]
    if len(entries) != 1:
        return None
    reference = {
        "type": evidence_type,
        "id": entries[0]["id"],
        "report_id": registry["report_id"],
        "claim": claim,
    }
    if not validate_evidence_reference(reference, registry)["valid"]:
        return None
    return reference


def _supporting_references(
    *,
    rule: dict[str, Any],
    recommendation_key: str,
    registry: dict[str, Any],
) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    rule_reference = _registry_evidence_reference(
        registry,
        evidence_type="kb_rule_recommendation",
        predicate=lambda item: (
            item.get("rule_id") == str(rule["rule_id"])
            and item.get("rule_key") == str(rule["rule_key"])
            and item.get("recommendation_key") == recommendation_key
        ),
        claim="rule_recommendation",
    )
    if rule_reference is None:
        raise ValueError("matched rule recommendation reference is unavailable")
    refs.append(rule_reference)

    for captured in _matched_evidence_context(
        rule,
        input_context={"biomarkers": [
            item["measurement"]
            for item in registry["evidence"]
            if item.get("type") == "biomarker_measurement"
        ]},
        registry=registry,
    ):
        reference = captured["evidence_ref"]
        if not validate_evidence_reference(reference, registry)["valid"]:
            raise ValueError("matched evidence reference is ineligible")
        refs.append(reference)

    unique = {
        (ref["type"], ref["id"], ref["claim"]): ref
        for ref in refs
    }
    return [unique[key] for key in sorted(unique)]


def _snapshot_payload(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in snapshot.items() if key != "integrity_hash"}


def build_protocol_evidence_snapshot(
    *,
    report_version_id: str,
    input_context: Any,
    evaluated_rules: Any,
    canonical_recommendations: Any,
) -> dict[str, Any]:
    """Freeze evaluated rules, catalog wording and report-scoped evidence.

    Call only within server-owned orchestration using the immutable report
    version inputs, evaluator output, and catalog rows loaded for that evaluation.
    """
    version_id = report_version_id.strip() if isinstance(report_version_id, str) else ""
    if not version_id:
        raise ValueError("report_version_id is required")
    if (
        not isinstance(input_context, dict)
        or set(input_context) - _CONTEXT_FIELDS
        or not isinstance(input_context.get("biomarkers"), list)
    ):
        raise ValueError("input context is missing or contains unsupported fields")
    if not isinstance(evaluated_rules, list) or not evaluated_rules:
        raise ValueError("evaluated matched rules are required")
    if not isinstance(canonical_recommendations, list):
        raise ValueError("canonical recommendation rows are required")
    observed_rule_versions: dict[tuple[str, str], str] = {}
    for rule in evaluated_rules:
        if not isinstance(rule, dict):
            raise ValueError("evaluated rule is malformed")
        rule_id = rule.get("rule_id")
        rule_key = rule.get("rule_key")
        rule_version = rule.get("version")
        if not all(
            isinstance(value, str) and value.strip()
            for value in (rule_id, rule_key, rule_version)
        ):
            raise ValueError("evaluated rule identity or version is incomplete")
        identity = (rule_id, rule_key)
        previous_version = observed_rule_versions.get(identity)
        if previous_version is not None:
            if previous_version != rule_version:
                raise ValueError("evaluated rule version is conflicting")
            raise ValueError("evaluated rule identity is duplicated")
        observed_rule_versions[identity] = rule_version

    registry = build_protocol_evidence_registry(
        report_id=version_id,
        biomarkers=input_context["biomarkers"],
        matched_rules=evaluated_rules,
        symptom_snapshot=input_context.get("symptom_snapshot"),
    )
    recommendations_by_key: dict[str, dict[str, Any]] = {}
    for row in canonical_recommendations:
        if not isinstance(row, dict):
            raise ValueError("canonical recommendation row is malformed")
        key = row.get("key")
        if not isinstance(key, str) or not key.strip():
            raise ValueError("canonical recommendation key is missing")
        key = key.strip()
        if key in recommendations_by_key:
            raise ValueError("canonical recommendation key is ambiguous")
        if (
            not isinstance(row.get("title"), str)
            or not row["title"].strip()
            or not isinstance(row.get("body"), str)
            or not row["body"].strip()
        ):
            raise ValueError("canonical recommendation content is incomplete")
        recommendations_by_key[key] = row

    entries: list[dict[str, Any]] = []
    seen_rule_versions: dict[tuple[str, str], str] = {}
    expected_keys: set[str] = set()
    for rule in evaluated_rules:
        if not isinstance(rule, dict):
            raise ValueError("evaluated rule is malformed")
        rule_id = rule.get("rule_id")
        rule_key = rule.get("rule_key")
        rule_version = rule.get("version")
        recommendation_keys = rule.get("recommendation_keys")
        if (
            not isinstance(rule_id, str)
            or not rule_id.strip()
            or not isinstance(rule_key, str)
            or not rule_key.strip()
            or not isinstance(rule_version, str)
            or not rule_version.strip()
            or not isinstance(recommendation_keys, list)
            or not recommendation_keys
        ):
            raise ValueError("evaluated rule identity, version, or keys are incomplete")
        identity = (rule_id, rule_key)
        previous_version = seen_rule_versions.get(identity)
        if previous_version is not None and previous_version != rule_version:
            raise ValueError("evaluated rule version is conflicting")
        if previous_version is not None:
            raise ValueError("evaluated rule identity is duplicated")
        seen_rule_versions[identity] = rule_version
        if any(not isinstance(key, str) or not key.strip() for key in recommendation_keys):
            raise ValueError("evaluated recommendation key is malformed")
        if len(set(recommendation_keys)) != len(recommendation_keys):
            raise ValueError("evaluated recommendation keys are duplicated")
        for recommendation_key in recommendation_keys:
            expected_keys.add(recommendation_key)
            recommendation = recommendations_by_key.get(recommendation_key)
            if recommendation is None:
                raise ValueError("canonical recommendation row is missing")
            refs = _supporting_references(
                rule=rule,
                recommendation_key=recommendation_key,
                registry=registry,
            )
            try:
                rule_evidence = _json_safe(rule.get("evidence"))
            except (TypeError, ValueError, OverflowError, RecursionError) as exc:
                raise ValueError("evaluated rule evidence is malformed") from exc
            if not isinstance(rule_evidence, (dict, list)):
                raise ValueError("evaluated rule evidence is missing")
            matched_evidence = _matched_evidence_context(
                rule,
                input_context=input_context,
                registry=registry,
            )
            entries.append(
                {
                    "rule": {
                        "id": rule_id,
                        "key": rule_key,
                        "version": rule_version,
                        "source": rule.get("source"),
                        "source_url": rule.get("source_url"),
                        "medical_reviewed_at": rule.get("medical_reviewed_at"),
                    },
                    "recommendation": {
                        "key": recommendation_key,
                        "title": recommendation["title"],
                        "body": recommendation["body"],
                        "source": recommendation.get("source"),
                        "source_url": recommendation.get("source_url"),
                    },
                    "rule_evidence": rule_evidence,
                    "matched_evidence": matched_evidence,
                    "evidence_refs": refs,
                }
            )
    if expected_keys != set(recommendations_by_key):
        raise ValueError("canonical recommendation rows do not exactly match evaluated keys")
    entries.sort(key=_canonical_json)
    evidence_context = [
        item
        for item in registry["evidence"]
        if item.get("type") in {"biomarker_measurement", "present_symptom_concept"}
    ]
    payload = {
        "schema": SNAPSHOT_SCHEMA,
        "report_version_id": version_id,
        "input_context_hash": _sha256(evidence_context),
        "entries": entries,
    }
    snapshot = {**payload, "integrity_hash": _sha256(payload)}
    _canonical_json(snapshot)
    return snapshot


def verify_protocol_evidence_snapshot(
    snapshot: Any,
    *,
    report_version_id: str,
    input_context: Any,
) -> dict[str, Any]:
    """Validate integrity and binding to the expected frozen report context."""
    if snapshot is None:
        return {"valid": False, "reason": "missing_evidence_snapshot"}
    if not isinstance(snapshot, dict) or set(snapshot) != _SNAPSHOT_FIELDS:
        return {"valid": False, "reason": "malformed_evidence_snapshot"}
    if snapshot.get("schema") != SNAPSHOT_SCHEMA:
        return {"valid": False, "reason": "unsupported_snapshot_schema"}
    if snapshot.get("report_version_id") != report_version_id:
        return {"valid": False, "reason": "report_version_mismatch"}
    if (
        not isinstance(input_context, dict)
        or set(input_context) - _CONTEXT_FIELDS
        or not isinstance(input_context.get("biomarkers"), list)
    ):
        return {"valid": False, "reason": "invalid_input_context"}
    try:
        registry = build_protocol_evidence_registry(
            report_id=report_version_id,
            biomarkers=input_context["biomarkers"],
            symptom_snapshot=input_context.get("symptom_snapshot"),
        )
        context_evidence = [
            item
            for item in registry["evidence"]
            if item.get("type") in {"biomarker_measurement", "present_symptom_concept"}
        ]
        context_hash = _sha256(context_evidence)
        computed_integrity_hash = _sha256(_snapshot_payload(snapshot))
    except (TypeError, ValueError, OverflowError, RecursionError):
        return {"valid": False, "reason": "malformed_evidence_snapshot"}
    if snapshot.get("input_context_hash") != context_hash:
        return {"valid": False, "reason": "input_context_mismatch"}
    if snapshot.get("integrity_hash") != computed_integrity_hash:
        return {"valid": False, "reason": "integrity_hash_mismatch"}

    entries = snapshot.get("entries")
    if not isinstance(entries, list) or not entries:
        return {"valid": False, "reason": "missing_snapshot_entries"}
    rules_for_registry: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            return {"valid": False, "reason": "malformed_snapshot_entry"}
        rule = entry.get("rule")
        recommendation = entry.get("recommendation")
        rule_evidence = entry.get("rule_evidence")
        if (
            not isinstance(rule, dict)
            or not isinstance(recommendation, dict)
            or not isinstance(rule_evidence, (dict, list))
        ):
            return {"valid": False, "reason": "incomplete_snapshot_entry"}
        rules_for_registry.append(
            {
                "rule_id": rule.get("id"),
                "rule_key": rule.get("key"),
                "recommendation_keys": [recommendation.get("key")],
                "evidence": rule_evidence,
            }
        )
    try:
        evidence_registry = build_protocol_evidence_registry(
            report_id=report_version_id,
            biomarkers=input_context["biomarkers"],
            matched_rules=rules_for_registry,
            symptom_snapshot=input_context.get("symptom_snapshot"),
        )
    except (TypeError, ValueError, OverflowError, RecursionError):
        return {"valid": False, "reason": "malformed_evidence_snapshot"}
    seen_pairs: set[tuple[str, str, str]] = set()
    expected_rule_recommendations: set[tuple[str, str, str]] = set()
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != _ENTRY_FIELDS:
            return {"valid": False, "reason": "malformed_snapshot_entry"}
        rule = entry.get("rule")
        recommendation = entry.get("recommendation")
        refs = entry.get("evidence_refs")
        if (
            not isinstance(rule, dict)
            or set(rule) != _RULE_FIELDS
            or not all(isinstance(rule.get(field), str) and rule[field].strip() for field in ("id", "key", "version"))
            or not isinstance(recommendation, dict)
            or set(recommendation) != _RECOMMENDATION_FIELDS
            or not all(
                isinstance(recommendation.get(field), str) and recommendation[field].strip()
                for field in ("key", "title", "body")
            )
            or not isinstance(refs, list)
            or not refs
            or not isinstance(entry.get("rule_evidence"), (dict, list))
            or not isinstance(entry.get("matched_evidence"), list)
        ):
            return {"valid": False, "reason": "incomplete_snapshot_entry"}
        pair = (rule["id"], rule["version"], recommendation["key"])
        if pair in seen_pairs:
            return {"valid": False, "reason": "duplicate_snapshot_entry"}
        seen_pairs.add(pair)
        expected_rule_recommendations.add((rule["id"], rule["key"], recommendation["key"]))
        rule_refs = [
            ref
            for ref in refs
            if isinstance(ref, dict) and ref.get("type") == "kb_rule_recommendation"
        ]
        if len(rule_refs) != 1 or any(
            ref.get("report_id") != report_version_id
            or not any(
                item.get("id") == ref.get("id")
                and item.get("type") == ref.get("type")
                and item.get("rule_id") == rule["id"]
                and item.get("rule_key") == rule["key"]
                and item.get("recommendation_key") == recommendation["key"]
                for item in evidence_registry["evidence"]
            )
            for ref in rule_refs
        ):
            return {"valid": False, "reason": "missing_rule_evidence_reference"}
        if any(
            not isinstance(ref, dict)
            or ref.get("report_id") != report_version_id
            or not isinstance(ref.get("id"), str)
            or not isinstance(ref.get("type"), str)
            for ref in refs
        ):
            return {"valid": False, "reason": "cross_report_evidence_reference"}
        if any(
            ref.get("type") == "biomarker_measurement"
            and ref.get("claim") not in {"measurement"}
            for ref in refs
        ):
            return {"valid": False, "reason": "ineligible_biomarker_reference"}
        expected_references = _supporting_references(
            rule={
                "rule_id": rule["id"],
                "rule_key": rule["key"],
                "recommendation_keys": [recommendation["key"]],
                "evidence": entry["rule_evidence"],
            },
            recommendation_key=recommendation["key"],
            registry=evidence_registry,
        )
        try:
            expected_matched_evidence = _matched_evidence_context(
                {
                    "evidence": entry["rule_evidence"],
                },
                input_context=input_context,
                registry=evidence_registry,
            )
        except (TypeError, ValueError, OverflowError, RecursionError):
            return {"valid": False, "reason": "matched_evidence_context_mismatch"}
        if (
            refs != expected_references
            or entry["matched_evidence"] != expected_matched_evidence
        ):
            return {"valid": False, "reason": "matched_evidence_context_mismatch"}
    if expected_rule_recommendations != {
        (entry["rule"]["id"], entry["rule"]["key"], entry["recommendation"]["key"])
        for entry in entries
    }:
        return {"valid": False, "reason": "duplicate_snapshot_entry"}
    try:
        _canonical_json(snapshot)
    except (TypeError, ValueError, OverflowError, RecursionError):
        return {"valid": False, "reason": "malformed_evidence_snapshot"}
    return {"valid": True, "reason": None}


def _authorize_action_from_verified_snapshot(
    action: Any,
    snapshot: Any,
    *,
    report_version_id: str,
    input_context: Any,
) -> dict[str, Any]:
    """Authorize only exact frozen catalog content after snapshot verification."""
    if not isinstance(action, dict):
        return {"outcome": "UNSUPPORTED", "reasons": ["invalid_action"]}
    if set(action) - _ACTION_FIELDS:
        return {"outcome": "UNSUPPORTED", "reasons": ["unapproved_action_fields"]}
    verification = verify_protocol_evidence_snapshot(
        snapshot,
        report_version_id=report_version_id,
        input_context=input_context,
    )
    if not verification["valid"]:
        return {"outcome": "UNSUPPORTED", "reasons": [verification["reason"]]}
    key = action.get("key")
    if not isinstance(key, str) or not key.strip():
        return {"outcome": "UNSUPPORTED", "reasons": ["action_key_missing"]}
    key = key.strip()
    if action.get("recommendation_key", key) != key:
        return {"outcome": "UNSUPPORTED", "reasons": ["action_recommendation_key_mismatch"]}
    matching = [
        entry
        for entry in snapshot["entries"]
        if entry["recommendation"]["key"] == key
    ]
    if not matching:
        return {"outcome": "UNSUPPORTED", "reasons": ["no_frozen_rule_authorizes_action_key"]}
    canonical = {
        (entry["recommendation"]["title"], entry["recommendation"]["body"])
        for entry in matching
    }
    if len(canonical) != 1:
        return {"outcome": "UNSUPPORTED", "reasons": ["ambiguous_frozen_recommendation"]}
    title, body = next(iter(canonical))
    if action.get("title") != title or action.get("body") != body:
        return {"outcome": "UNSUPPORTED", "reasons": ["action_content_does_not_match_frozen_recommendation"]}
    refs_by_identity = {
        (ref["type"], ref["id"], ref.get("claim")): ref
        for entry in matching
        for ref in entry["evidence_refs"]
    }
    refs = [refs_by_identity[key] for key in sorted(refs_by_identity)]
    authorized_action = {
        field: action[field]
        for field in ("id", "action_id", "key")
        if field in action
    }
    authorized_action.update(
        {
            "title": title,
            "body": body,
            "grounding": {
                "designation": "personalized",
                "evidence_refs": refs,
            },
        }
    )
    result = {
        "outcome": "GROUNDED",
        "reasons": [],
        "valid_reference_ids": sorted({ref["id"] for ref in refs}),
        "authorized_action": authorized_action,
    }
    _canonical_json(result)
    return result


def authorize_action_from_snapshot(
    action: Any,
    snapshot: Any,
    *,
    report_version_id: str,
    input_context: Any,
) -> dict[str, Any]:
    """Validate standalone evidence, but never confer final authorization.

    A self-consistent payload and hash do not establish who persisted it or who
    owns its report. Personalized authorization is only exposed by the
    owner-scoped report service.
    """
    verification = verify_protocol_evidence_snapshot(
        snapshot,
        report_version_id=report_version_id,
        input_context=input_context,
    )
    if not verification["valid"]:
        return {"outcome": "UNSUPPORTED", "reasons": [verification["reason"]]}
    return {
        "outcome": "UNSUPPORTED",
        "reasons": ["owner_scoped_report_authorization_required"],
    }
