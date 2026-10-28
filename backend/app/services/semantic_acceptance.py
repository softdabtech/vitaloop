"""Meaning-level Definition of Done for one generated report.

P5 is deliberately stricter than schema validation.  A report can contain
every required JSON key and still be unhelpful.  This module checks the eight
product failures listed in Structure.md against the already-grounded P1/P3
contracts.  It adds no clinical inference and never rewrites report content.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List


SEMANTIC_ACCEPTANCE_VERSION = "semantic_acceptance_v1"

_INTERNAL_TERMS = (
    "case_synthesis",
    "grounded_ai_narrative",
    "evidence_debt",
    "confidence_calibration",
    "clinical_reasoning_trace",
    "stable symptom concept",
    "symptom-domain link",
    "hypothesis_id",
    "reason_codes",
)

_GENERIC_ADVICE_PATTERNS = (
    r"\bstay hydrated\b",
    r"\bdrink (?:more )?water\b",
    r"\bget (?:enough|more) sleep\b",
    r"\bsleep well\b",
    r"\beat a balanced diet\b",
    r"\bexercise regularly\b",
    r"\bmanage stress\b",
    r"\bhealthy lifestyle\b",
    r"\bwellness foundation\b",
)


def _dicts(value: Any) -> List[Dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _criterion(status: str, code: str, message: str, evidence: Dict[str, Any] | None = None) -> Dict[str, Any]:
    return {
        "status": status,
        "code": code,
        "message": message,
        "evidence": evidence or {},
    }


def _narrative_items(narrative: Dict[str, Any], field: str) -> List[Dict[str, Any]]:
    return _dicts(narrative.get(field))


def _synthesis_items(synthesis: Dict[str, Any], field: str) -> List[Dict[str, Any]]:
    return _dicts(synthesis.get(field))


def _preferred_items(
    narrative: Dict[str, Any],
    narrative_field: str,
    synthesis: Dict[str, Any],
    synthesis_field: str,
) -> List[Dict[str, Any]]:
    return _narrative_items(narrative, narrative_field) or _synthesis_items(synthesis, synthesis_field)


def _registry(narrative: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {
        str(item.get("evidence_id")): item
        for item in _dicts(narrative.get("evidence_links"))
        if item.get("evidence_id")
    }


def _item_evidence(item: Dict[str, Any], registry: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    direct = _dicts(item.get("evidence"))
    if direct:
        return direct
    return [
        registry[evidence_id]
        for evidence_id in (item.get("evidence_ids") or [])
        if str(evidence_id) in registry
    ]


def _text(items: Iterable[Dict[str, Any]]) -> str:
    return "\n".join(str(item.get("text") or "").strip() for item in items if str(item.get("text") or "").strip())


def _normal(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _specific_reference_appears(item: Dict[str, Any], registry: Dict[str, Dict[str, Any]]) -> bool:
    statement = _normal(item.get("text"))
    if not statement:
        return False
    for reference in _item_evidence(item, registry):
        label = _normal(reference.get("label") or reference.get("id"))
        value = reference.get("value")
        if label and label in statement:
            return True
        if value not in (None, "") and _normal(value) in statement:
            return True
    return False


def _has_concrete_value(items: Iterable[Dict[str, Any]], registry: Dict[str, Dict[str, Any]]) -> bool:
    for item in items:
        for reference in _item_evidence(item, registry):
            if (
                reference.get("type") == "biomarker"
                and reference.get("availability", "observed") == "observed"
                and reference.get("value") not in (None, "")
            ):
                return True
    return False


def _specific_actions(actions: List[Dict[str, Any]], registry: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    specific: List[Dict[str, Any]] = []
    for action in actions:
        text = str(action.get("text") or "").strip()
        if not text or not _item_evidence(action, registry):
            continue
        if any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in _GENERIC_ADVICE_PATTERNS):
            continue
        specific.append(action)
    return specific


def _priority_metadata(action: Dict[str, Any]) -> bool:
    return any(action.get(field) not in (None, "") for field in ("priority", "timeframe", "role", "timing"))


def _role_plan_has_priority(action_plan_by_role: Dict[str, Any]) -> bool:
    buckets = action_plan_by_role.get("buckets") if isinstance(action_plan_by_role, dict) else None
    if not isinstance(buckets, dict):
        return False
    return any(_dicts(buckets.get(bucket)) for bucket in ("urgent", "doctor", "practitioner", "self"))


def _specific_safety_events(safety_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    result = []
    for event in _dicts(safety_result.get("safety_events")):
        message = str(event.get("message") or "").strip()
        item = event.get("item") if isinstance(event.get("item"), dict) else {}
        marker = item.get("name") or item.get("canonical_name") or item.get("source_name")
        if message and (marker or event.get("key")):
            result.append(event)
    return result


def build_semantic_acceptance(
    *,
    case_synthesis: Dict[str, Any] | None,
    grounded_ai_narrative: Dict[str, Any] | None,
    symptom_analysis: Dict[str, Any] | None,
    action_plan_by_role: Dict[str, Any] | None,
    safety_result: Dict[str, Any] | None,
) -> Dict[str, Any]:
    synthesis = case_synthesis if isinstance(case_synthesis, dict) else {}
    narrative = grounded_ai_narrative if isinstance(grounded_ai_narrative, dict) else {}
    symptoms = symptom_analysis if isinstance(symptom_analysis, dict) else {}
    action_plan = action_plan_by_role if isinstance(action_plan_by_role, dict) else {}
    safety = safety_result if isinstance(safety_result, dict) else {}
    registry = _registry(narrative)

    summaries = _preferred_items(narrative, "personalized_summary", synthesis, "main_conclusion")
    connections = _preferred_items(narrative, "symptom_lab_correlations", synthesis, "symptom_connections")
    actions = _preferred_items(narrative, "next_actions", synthesis, "actions_now")
    user_items = [
        *summaries,
        *_preferred_items(narrative, "key_connections", synthesis, "what_was_found"),
        *connections,
        *actions,
        *_preferred_items(narrative, "clinician_questions", synthesis, "clinician_discussion"),
        *_preferred_items(narrative, "uncertainties", synthesis, "missing_information"),
    ]

    specific_summaries = [item for item in summaries if _specific_reference_appears(item, registry)]
    if specific_summaries:
        conclusion = _criterion(
            "pass",
            "report_specific_conclusion",
            "The conclusion names evidence from this report.",
            {"specific_statement_count": len(specific_summaries)},
        )
    else:
        conclusion = _criterion(
            "fail",
            "generic_conclusion",
            "No conclusion names a report-specific marker, symptom, or value.",
            {"summary_count": len(summaries)},
        )

    symptom_status = str(symptoms.get("status") or "")
    symptom_present = symptom_status not in {"", "no_symptom_snapshot"}
    symptom_changed = bool((symptoms.get("conclusion_change") or {}).get("changed"))
    linked_connections = [item for item in connections if _item_evidence(item, registry)]
    if not symptom_present:
        symptom_effect = _criterion(
            "not_applicable",
            "no_symptom_check",
            "No completed symptom check was attached to this report.",
        )
    elif symptom_changed and linked_connections:
        symptom_effect = _criterion(
            "pass",
            "symptom_check_changed_result",
            "The symptom check changed priority or explanation and remains evidence-linked.",
            {"connection_count": len(linked_connections)},
        )
    else:
        symptom_effect = _criterion(
            "fail",
            "symptom_check_no_result_effect",
            "A symptom check was present but did not change report priority or explanation.",
            {"symptom_analysis_status": symptom_status, "connection_count": len(connections)},
        )

    if _has_concrete_value(user_items, registry):
        concrete_values = _criterion(
            "pass",
            "concrete_value_links_present",
            "User-facing statements link to at least one measured biomarker value.",
        )
    else:
        concrete_values = _criterion(
            "fail",
            "no_concrete_value_links",
            "No user-facing statement links to a measured biomarker value.",
        )

    specific_actions = _specific_actions(actions, registry)
    if specific_actions:
        action_specificity = _criterion(
            "pass",
            "report_specific_actions",
            "At least one action is evidence-linked and specific to this report.",
            {"specific_action_count": len(specific_actions)},
        )
    else:
        action_specificity = _criterion(
            "fail",
            "generic_or_missing_actions",
            "Actions are missing, ungrounded, or limited to generic wellness advice.",
            {"action_count": len(actions)},
        )

    visible_actions = actions[:3]
    priority_clear = bool(visible_actions) and (
        _priority_metadata(visible_actions[0]) or _role_plan_has_priority(action_plan)
    )
    if priority_clear:
        action_priority = _criterion(
            "pass",
            "action_priority_clear",
            "The leading action has priority, timing, or role context.",
            {"visible_action_count": len(visible_actions)},
        )
    else:
        action_priority = _criterion(
            "fail",
            "action_priority_unclear",
            "The report does not make the action order, timing, or responsible role clear.",
            {"visible_action_count": len(visible_actions)},
        )

    user_text = _text(user_items).lower()
    leaked_terms = sorted(term for term in _INTERNAL_TERMS if term in user_text)
    if leaked_terms:
        user_language = _criterion(
            "fail",
            "internal_module_language_exposed",
            "User-facing report text contains internal engine terminology.",
            {"terms": leaked_terms},
        )
    else:
        user_language = _criterion(
            "pass",
            "user_facing_language",
            "User-facing report text is free of internal module identifiers.",
        )

    narrative_source = str(narrative.get("source") or "")
    if narrative_source != "deterministic_fallback":
        fallback_disclosure = _criterion(
            "not_applicable",
            "ai_fallback_not_used",
            "This report did not use the deterministic AI fallback.",
            {"source": narrative_source or None},
        )
    else:
        grounding = narrative.get("grounding") if isinstance(narrative.get("grounding"), dict) else {}
        disclosed = grounding.get("fallback_used") is True and bool(grounding.get("fallback_reason"))
        fallback_disclosure = _criterion(
            "pass" if disclosed else "fail",
            "ai_fallback_disclosed" if disclosed else "ai_fallback_not_disclosed",
            (
                "The deterministic fallback is explicitly marked with a reason."
                if disclosed
                else "The narrative used fallback output without an explicit fallback marker and reason."
            ),
            {"fallback_reason": grounding.get("fallback_reason")},
        )

    safety_active = bool(
        safety.get("urgent_review_required")
        or safety.get("doctor_discussion_required")
        or safety.get("warnings")
        or safety.get("safety_events")
    )
    specific_events = _specific_safety_events(safety)
    if not safety_active:
        safety_reason = _criterion(
            "not_applicable",
            "no_safety_warning",
            "This report has no safety warning.",
        )
    elif specific_events:
        safety_reason = _criterion(
            "pass",
            "specific_safety_reason",
            "The safety warning is backed by a named safety event and report item.",
            {"specific_event_count": len(specific_events)},
        )
    else:
        safety_reason = _criterion(
            "fail",
            "safety_reason_missing",
            "A safety warning is present without a concrete event or report-specific reason.",
        )

    criteria = {
        "report_specific_conclusion": conclusion,
        "symptom_check_effect": symptom_effect,
        "concrete_value_links": concrete_values,
        "report_specific_actions": action_specificity,
        "action_priority_clarity": action_priority,
        "user_facing_language": user_language,
        "ai_fallback_disclosure": fallback_disclosure,
        "safety_reason_specificity": safety_reason,
    }
    failures = [
        {"criterion": key, "code": value["code"], "message": value["message"]}
        for key, value in criteria.items()
        if value["status"] == "fail"
    ]
    passed = len([item for item in criteria.values() if item["status"] == "pass"])
    not_applicable = len([item for item in criteria.values() if item["status"] == "not_applicable"])
    return {
        "version": SEMANTIC_ACCEPTANCE_VERSION,
        "status": "passed" if not failures else "failed",
        "passes_dod": not failures,
        "criteria": criteria,
        "failures": failures,
        "summary": {
            "criteria_total": len(criteria),
            "passed": passed,
            "failed": len(failures),
            "not_applicable": not_applicable,
        },
    }
