"""Report-scoped evidence references for protocol-action grounding."""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import date, datetime
from typing import Any, Literal, TypedDict


PROTOCOL_EVIDENCE_VERSION = "protocol_evidence_v1"
GroundingOutcome = Literal["GROUNDED", "GENERAL_EDUCATIONAL", "UNSUPPORTED"]

_BIOMARKER_CLAIMS = {"measurement", "confirmed_abnormality"}
_PROFILE_FIELDS = (
    "age",
    "sex",
    "height_cm",
    "weight_kg",
    "pregnancy_status",
    "current_medications",
    "current_supplements",
    "medications",
    "supplements",
    "known_allergies",
    "allergies",
    "prior_diagnoses",
)
_PROFILE_SCALAR_FIELDS = {
    "age",
    "sex",
    "height_cm",
    "weight_kg",
    "pregnancy_status",
}
_PROFILE_LIST_FIELDS = {
    "current_medications",
    "current_supplements",
    "medications",
    "supplements",
    "known_allergies",
    "allergies",
    "prior_diagnoses",
}
_ELIGIBLE_ABNORMAL_STATUSES = {"DEFICIENT", "ELEVATED"}
_MAPPED_SYMPTOM_STATUSES = {"mapped", "approved"}
_PERSONAL_CLAIM_PATTERNS = (
    re.compile(r"\b(?:your|this patient's)\s+(?:lab|test|result|level|marker|biomarker|bloodwork)\b", re.I),
    re.compile(r"\bbased on\s+(?:your|this patient's)\b", re.I),
    re.compile(r"\byou\s+(?:have|are|show|showing|need|require|are deficient|are elevated)\b", re.I),
    re.compile(r"\byour\s+(?:results?|levels?|tests?)\s+(?:show|indicate|suggest|confirm)\b", re.I),
)
_USER_VISIBLE_FIELDS = (
    "title",
    "body",
    "description",
    "rationale",
    "summary",
    "instructions",
    "supplement",
    "dosage",
    "timing",
    "iherb_search",
)
_PERSONALIZED_ACTION_FIELDS = {
    "id",
    "action_id",
    "key",
    "recommendation_key",
    "title",
    "body",
    "grounding",
}
_GROUNDING_DECLARATION_FIELDS = {"designation", "evidence_refs", "personalized_claims"}
_EDUCATIONAL_RESTRICTED_TERMS = re.compile(
    r"\b(?:you|your|patient|diagnos(?:e|ed|is)|deficien(?:cy|t)|anemia|"
    r"abnormal|low|high|elevated|borderline|optimal|critical|treat(?:ment|ments)?|"
    r"therapy|therap(?:ies|y)|prescri(?:be|bed|ption)|dose|dosage|"
    r"recommend(?:ation|ations|ed)?|require(?:s|d)?|should|must|need(?:s|ed)?|"
    r"take|start|stop|avoid|increase|decrease|correct(?:ion)?|replet(?:e|ion)|"
    r"consult|discuss|review|monitor|follow|seek|use|add|adjust|maintain|track|"
    r"repeat|check|consider|indicate|suggest|confirm|support|treat|manage|"
    r"prescribe|supplement)\b",
    re.IGNORECASE,
)


class EvidenceReference(TypedDict, total=False):
    type: str
    id: str
    report_id: str
    claim: str


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("Evidence registry values must be finite JSON numbers")
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        if not all(isinstance(key, str) for key in value):
            raise ValueError("Evidence registry object keys must be strings")
        return {key: _json_safe(item) for key, item in value.items()}
    raise ValueError(f"Evidence registry value is not JSON-serializable: {type(value).__name__}")


def _canonical_json(value: Any) -> str:
    return json.dumps(_json_safe(value), sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)


def _digest(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()[:16]


def _report_scope(report_id: str) -> str:
    return hashlib.sha256(report_id.encode("utf-8")).hexdigest()[:12]


def _reference_id(scope: str, evidence_type: str, payload: dict[str, Any], ordinal: int = 0) -> str:
    return f"ev1:{scope}:{evidence_type}:{_digest(payload)}:{ordinal}"


def _canonical_biomarker(item: dict[str, Any]) -> dict[str, Any]:
    fields = (
        "canonical_name",
        "name",
        "value",
        "unit",
        "status",
        "ref_low",
        "ref_high",
        "reference_range",
        "reference_source",
        "unevaluated_reason",
        "assay_qualifier",
        "collected_at",
    )
    return {key: _json_safe(item.get(key)) for key in fields if item.get(key) is not None}


def _has_matched_rule_atom(value: Any) -> bool:
    if isinstance(value, dict):
        if value.get("type") in {"lab_marker", "symptom"}:
            return value.get("matched") is True
        return any(_has_matched_rule_atom(item) for item in value.values())
    if isinstance(value, list):
        return any(_has_matched_rule_atom(item) for item in value)
    return False


def _symptom_rows(snapshot: Any) -> list[dict[str, Any]]:
    if (
        not isinstance(snapshot, dict)
        or snapshot.get("version") != "symptom_snapshot_v1"
        or not snapshot.get("completed_at")
    ):
        return []
    evidence = snapshot.get("evidence")
    if not isinstance(evidence, dict):
        return []
    grouped: dict[str, list[Any]] = {}
    for choice in ("present", "absent", "unknown"):
        values = evidence.get(choice)
        grouped[choice] = values if isinstance(values, list) else []
    conflicts: set[str] = set()
    present_ids = {
        str(item.get("vitaloop_concept_id") or "").strip().casefold()
        for item in grouped["present"]
        if isinstance(item, dict) and item.get("vitaloop_concept_id")
    }
    for choice in ("absent", "unknown"):
        conflicts.update(
            str(item.get("vitaloop_concept_id") or "").strip().casefold()
            for item in grouped[choice]
            if isinstance(item, dict) and item.get("vitaloop_concept_id")
        )
    present = grouped["present"]
    rows = []
    for item in present:
        if not isinstance(item, dict):
            continue
        concept_id = str(item.get("vitaloop_concept_id") or "").strip()
        mapping_status = str(item.get("mapping_status") or "").strip().lower()
        if (
            not concept_id
            or concept_id.casefold() in conflicts
            or mapping_status not in _MAPPED_SYMPTOM_STATUSES
        ):
            continue
        domain_keys = item.get("domain_keys")
        safe_domain_keys = (
            sorted({str(key).strip() for key in domain_keys if isinstance(key, str) and key.strip()})
            if isinstance(domain_keys, list)
            else []
        )
        try:
            rows.append(
                {
                    "concept_id": concept_id,
                    "display_name": _json_safe(item.get("display_name_en")),
                    "concept_type": _json_safe(item.get("concept_type")),
                    "mapping_status": mapping_status,
                    "source": _json_safe(item.get("source")),
                    "domain_keys": safe_domain_keys,
                }
            )
        except (TypeError, ValueError, OverflowError, RecursionError):
            continue
    return rows if present_ids else []


def _profile_evidence_value(field: str, value: Any) -> tuple[bool, Any]:
    if field in _PROFILE_SCALAR_FIELDS:
        if isinstance(value, (str, bool, int, float, date, datetime)):
            try:
                return True, _json_safe(value)
            except (TypeError, ValueError, OverflowError):
                return False, None
        return False, None
    if field in _PROFILE_LIST_FIELDS and isinstance(value, list):
        values = []
        for item in value:
            if isinstance(item, (str, bool, int, float, date, datetime)):
                try:
                    values.append(_json_safe(item))
                except (TypeError, ValueError, OverflowError):
                    continue
        return bool(values), values
    return False, None


def build_protocol_evidence_registry(
    *,
    report_id: str,
    biomarkers: list[dict[str, Any]] | None = None,
    matched_rules: list[dict[str, Any]] | None = None,
    symptom_snapshot: dict[str, Any] | None = None,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build stable, report-scoped references from deterministic report inputs.

    IDs deliberately exclude AI-authored action text and explanations. Biomarkers
    are canonically sorted before assigning occurrence ordinals so duplicate
    measurements remain separately addressable and input ordering is irrelevant.
    """
    scope_id = str(report_id or "").strip()
    if not scope_id:
        raise ValueError("report_id is required to build a report-scoped evidence registry")
    scope = _report_scope(scope_id)
    entries: list[dict[str, Any]] = []
    entries: list[dict[str, Any]] = []

    measurement_rows = []
    for item in biomarkers if isinstance(biomarkers, list) else []:
        if not isinstance(item, dict):
            continue
        try:
            measurement_rows.append(_canonical_biomarker(item))
        except (TypeError, ValueError, OverflowError, RecursionError):
            continue
    measurement_rows.sort(key=_canonical_json)
    previous_payload: str | None = None
    occurrence = 0
    for row in measurement_rows:
        encoded = _canonical_json(row)
        occurrence = occurrence + 1 if encoded == previous_payload else 0
        previous_payload = encoded
        status = str(row.get("status") or "").strip().upper()
        claims = ["measurement"]
        if status in _ELIGIBLE_ABNORMAL_STATUSES and row.get("value") is not None and row.get("unit"):
            claims.append("confirmed_abnormality")
        entries.append(
            {
                "id": _reference_id(scope, "biomarker", row, occurrence),
                "type": "biomarker_measurement",
                "report_id": scope_id,
                "claim_types": claims,
                "status": status or None,
                "measurement": row,
            }
        )

    rule_rows: list[tuple[str, str, dict[str, Any]]] = []
    rules_input = matched_rules if isinstance(matched_rules, list) else []
    for rule in rules_input:
        if not isinstance(rule, dict):
            continue
        rule_key = str(rule.get("rule_key") or rule.get("key") or "").strip()
        rule_id = str(rule.get("rule_id") or rule.get("id") or "").strip()
        try:
            evidence_input = rule.get("evidence")
            evidence = _json_safe(evidence_input if isinstance(evidence_input, (dict, list)) else [])
        except (TypeError, ValueError, OverflowError, RecursionError):
            continue
        if not rule_key or not rule_id or not _has_matched_rule_atom(evidence):
            continue
        recommendation_keys = rule.get("recommendation_keys")
        if not isinstance(recommendation_keys, list):
            continue
        safe_recommendation_keys = {
            key.strip()
            for key in recommendation_keys
            if isinstance(key, str) and key.strip()
        }
        for recommendation_key in sorted(safe_recommendation_keys):
            payload = {
                "rule_id": rule_id,
                "rule_key": rule_key,
                "recommendation_key": recommendation_key,
                "evidence": evidence,
            }
            rule_rows.append(( _canonical_json(payload), recommendation_key, payload))
    rule_rows.sort(key=lambda row: row[0])
    previous_payload = None
    occurrence = 0
    for encoded, _, payload in rule_rows:
        occurrence = occurrence + 1 if encoded == previous_payload else 0
        previous_payload = encoded
        entries.append(
            {
                "id": _reference_id(scope, "kb_recommendation", payload, occurrence),
                "type": "kb_rule_recommendation",
                "report_id": scope_id,
                "claim_types": ["rule_recommendation"],
                **payload,
            }
        )

    symptom_rows = _symptom_rows(symptom_snapshot)
    symptom_rows.sort(key=_canonical_json)
    previous_payload = None
    occurrence = 0
    for row in symptom_rows:
        encoded = _canonical_json(row)
        occurrence = occurrence + 1 if encoded == previous_payload else 0
        previous_payload = encoded
        entries.append(
            {
                "id": _reference_id(scope, "symptom", row, occurrence),
                "type": "present_symptom_concept",
                "report_id": scope_id,
                "claim_types": ["present_symptom"],
                **row,
            }
        )

    profile_data = profile if isinstance(profile, dict) else {}
    for field in _PROFILE_FIELDS:
        value = profile_data.get(field)
        if value is None or value == "":
            continue
        is_safe, safe_value = _profile_evidence_value(field, value)
        if not is_safe:
            continue
        payload = {"field": field, "value": safe_value}
        entries.append(
            {
                "id": _reference_id(scope, "profile", payload),
                "type": "profile_field",
                "report_id": scope_id,
                "claim_types": ["context_only"],
                **payload,
            }
        )

    entries.sort(key=lambda item: (item["type"], item["id"]))
    registry = {
        "version": PROTOCOL_EVIDENCE_VERSION,
        "report_id": scope_id,
        "evidence": entries,
    }
    _canonical_json(registry)
    return registry


def _educational_action_is_generic(action: dict[str, Any], registry: dict[str, Any]) -> bool:
    text = " ".join(
        str(action.get(field) or "")
        for field in _USER_VISIBLE_FIELDS
    )
    if not text.strip():
        return False
    if _EDUCATIONAL_RESTRICTED_TERMS.search(text):
        return False
    if any(pattern.search(text) for pattern in _PERSONAL_CLAIM_PATTERNS):
        return False
    for item in registry.get("evidence") or []:
        if item.get("type") != "biomarker_measurement":
            continue
        measurement = item.get("measurement") or {}
        for marker_name in (measurement.get("name"), measurement.get("canonical_name")):
            normalized_name = str(marker_name or "").replace("canonical_", "").replace("_", " ").strip()
            if normalized_name:
                escaped_name = re.escape(normalized_name)
                if re.search(
                    rf"\b(?:your|this patient's)\s+{escaped_name}\b|"
                    rf"\b{escaped_name}\s+(?:is|was|looks)\s+(?:low|high|normal|abnormal|"
                    rf"deficient|elevated|borderline|optimal|critical|unknown)\b",
                    text,
                    re.IGNORECASE,
                ):
                    return False
        value = measurement.get("value")
        unit = str(measurement.get("unit") or "")
        if value is not None and unit and re.search(
            rf"(?<![\w.]){re.escape(str(value))}\s*{re.escape(unit)}(?!\w)",
            text,
            re.IGNORECASE,
        ):
            return False
    return True


def validate_evidence_reference(
    reference: Any,
    registry: Any,
) -> dict[str, Any]:
    """Validate one typed reference against exactly one report registry."""
    if not isinstance(reference, dict):
        return {"valid": False, "reason": "invalid_reference"}
    if (
        not isinstance(registry, dict)
        or not isinstance(registry.get("report_id"), str)
        or not isinstance(registry.get("evidence"), list)
    ):
        return {"valid": False, "reason": "invalid_registry"}
    if set(reference) - {"type", "id", "report_id", "claim"}:
        return {"valid": False, "reason": "unexpected_reference_fields"}
    report_id = str(registry.get("report_id") or "")
    if reference.get("report_id") != report_id:
        return {"valid": False, "reason": "cross_report_reference"}
    requested_type = reference.get("type")
    requested_id = reference.get("id")
    entry = next(
        (
            item
            for item in registry["evidence"]
            if isinstance(item, dict)
            if item.get("id") == requested_id and item.get("type") == requested_type
        ),
        None,
    )
    if entry is None:
        return {"valid": False, "reason": "unknown_or_dangling_reference"}
    claim = reference.get("claim")
    if requested_type == "biomarker_measurement":
        if claim not in _BIOMARKER_CLAIMS or claim not in entry.get("claim_types", []):
            return {"valid": False, "reason": "biomarker_claim_not_supported"}
        measurement = entry.get("measurement") or {}
        if measurement.get("value") is None or not measurement.get("unit"):
            return {"valid": False, "reason": "biomarker_measurement_incomplete"}
    elif requested_type == "kb_rule_recommendation":
        if claim not in (None, "rule_recommendation"):
            return {"valid": False, "reason": "rule_claim_not_supported"}
    elif requested_type == "present_symptom_concept":
        if claim not in (None, "present_symptom"):
            return {"valid": False, "reason": "symptom_claim_not_supported"}
    elif requested_type == "profile_field":
        if claim != "context_only":
            return {"valid": False, "reason": "profile_evidence_context_only"}
    else:
        return {"valid": False, "reason": "unsupported_reference_type"}
    return {"valid": True, "reason": None, "evidence": entry}


def _personalized_action_shape_error(action: dict[str, Any]) -> str | None:
    if set(action) - _PERSONALIZED_ACTION_FIELDS:
        return "unapproved_action_fields"
    declaration = action.get("grounding")
    if not isinstance(declaration, dict) or set(declaration) - _GROUNDING_DECLARATION_FIELDS:
        return "unapproved_grounding_fields"
    if any(
        not isinstance(action.get(identifier), str)
        for identifier in ("id", "action_id")
        if identifier in action
    ):
        return "invalid_action_identifier"
    if any(
        not isinstance(action.get(field), str)
        for field in ("title", "body")
        if field in action
    ):
        return "invalid_action_content"
    return None


def validate_action_grounding(action: Any, registry: Any) -> dict[str, Any]:
    """Return deterministic grounding outcome without interpreting explanations."""
    if not isinstance(action, dict):
        return {"outcome": "UNSUPPORTED", "reasons": ["invalid_action"], "valid_reference_ids": []}
    if (
        not isinstance(registry, dict)
        or not isinstance(registry.get("report_id"), str)
        or not isinstance(registry.get("evidence"), list)
        or any(not isinstance(item, dict) for item in registry["evidence"])
    ):
        return {"outcome": "UNSUPPORTED", "reasons": ["invalid_registry"], "valid_reference_ids": []}
    declaration = action.get("grounding")
    if not isinstance(declaration, dict):
        return {"outcome": "UNSUPPORTED", "reasons": ["grounding_not_designated"], "valid_reference_ids": []}

    designation = declaration.get("designation")
    if designation == "general_educational":
        if declaration.get("personalized_claims") is not False:
            return {"outcome": "UNSUPPORTED", "reasons": ["educational_scope_not_explicitly_nonpersonalized"], "valid_reference_ids": []}
        if declaration.get("evidence_refs"):
            return {"outcome": "UNSUPPORTED", "reasons": ["educational_action_must_not_claim_personal_evidence"], "valid_reference_ids": []}
        if not _educational_action_is_generic(action, registry):
            return {"outcome": "UNSUPPORTED", "reasons": ["personalized_claim_in_educational_action"], "valid_reference_ids": []}
        return {"outcome": "GENERAL_EDUCATIONAL", "reasons": [], "valid_reference_ids": []}

    if designation != "personalized":
        return {"outcome": "UNSUPPORTED", "reasons": ["unknown_grounding_designation"], "valid_reference_ids": []}
    shape_error = _personalized_action_shape_error(action)
    if shape_error:
        return {"outcome": "UNSUPPORTED", "reasons": [shape_error], "valid_reference_ids": []}
    references = declaration.get("evidence_refs")
    if not isinstance(references, list) or not references:
        return {"outcome": "UNSUPPORTED", "reasons": ["personalized_action_has_no_evidence"], "valid_reference_ids": []}
    authorized_key = action.get("key")
    declared_recommendation_key = action.get("recommendation_key")
    if (
        not isinstance(authorized_key, str)
        or not authorized_key.strip()
        or (
            declared_recommendation_key is not None
            and declared_recommendation_key != authorized_key
        )
    ):
        return {"outcome": "UNSUPPORTED", "reasons": ["action_recommendation_key_missing"], "valid_reference_ids": []}
    authorized_key = authorized_key.strip()

    valid_ids: list[str] = []
    reasons: list[str] = []
    has_rule_recommendation = False
    for reference in references:
        result = validate_evidence_reference(reference, registry)
        if not result["valid"]:
            reasons.append(result["reason"])
            continue
        evidence = result["evidence"]
        if (
            evidence.get("type") == "kb_rule_recommendation"
            and evidence.get("recommendation_key") != authorized_key
        ):
            reasons.append("action_recommendation_key_mismatch")
            continue
        valid_ids.append(str(evidence["id"]))
        if evidence["type"] == "kb_rule_recommendation":
            has_rule_recommendation = True
    if reasons:
        return {"outcome": "UNSUPPORTED", "reasons": sorted(set(reasons)), "valid_reference_ids": valid_ids}
    if not has_rule_recommendation:
        return {
            "outcome": "UNSUPPORTED",
            "reasons": ["evidence_does_not_authorize_personalized_recommendation"],
            "valid_reference_ids": valid_ids,
        }
    return {
        "outcome": "UNSUPPORTED",
        "reasons": ["server_owned_recommendation_catalog_required"],
        "valid_reference_ids": valid_ids,
    }
