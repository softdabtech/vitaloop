from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List


SAFETY_ENGINE_VERSION = "safety_engine_v1"

_DIAGNOSIS_PATTERNS = [
    r"\byou have\b",
    r"\bdiagnosed with\b",
    r"\bconfirmed diagnosis\b",
    r"\bу вас є діагноз\b",
    r"\bу вас діагностовано\b",
]

_SENSITIVE_SUPPLEMENTS = {
    "iron": ["iron", "заліз", "желез"],
    "vitamin_d": ["vitamin d", "d3", "вітамін d", "витамин d"],
    "b12": ["b12", "б12"],
    "folate": ["folate", "folic", "фолат", "фоліє", "фолиев"],
}

_DOSAGE_PATTERN = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|iu|мг|мкг|мо|од\.?)\b",
    re.IGNORECASE,
)

_DOSING_FREQUENCY_PATTERN = re.compile(
    r"\b(?:tid|bid|qid|qd|q\.d\.|b\.i\.d\.|t\.i\.d\.)\b|"
    r"\b(?:daily|per day|/day|на добу|щодня)\b",
    re.IGNORECASE,
)


def _num(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _marker_name(item: Dict[str, Any]) -> str:
    return str(item.get("canonical_name") or item.get("name") or item.get("source_name") or "").strip().lower()


def _add_event(events: List[Dict[str, Any]], *, key: str, severity: str, message: str, item: Any = None) -> None:
    events.append({"key": key, "severity": severity, "message": message, "item": item})


def _value_present(value: Any) -> bool:
    if isinstance(value, list):
        return any(str(item).strip() for item in value)
    if isinstance(value, dict):
        return any(str(item).strip() for item in value.values())
    return bool(str(value or "").strip())


def _dedupe_events(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: List[Dict[str, Any]] = []
    seen = set()
    for event in events:
        key = (event.get("key"), event.get("severity"), event.get("message"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(event)
    return deduped


def _dangerous_lab_events(biomarkers: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    for item in biomarkers or []:
        if not isinstance(item, dict):
            continue
        name = _marker_name(item)
        value = _num(item.get("value"))
        unit = str(item.get("unit") or "").strip().lower()
        if value is None:
            continue
        if "glucose" in name and ("mg/dl" in unit or unit == "") and (value >= 300 or value <= 54):
            _add_event(events, key="dangerous_glucose", severity="critical", message="Critical glucose value requires medical review.", item=item)
        if "hba1c" in name and value >= 9.0:
            _add_event(events, key="dangerous_hba1c", severity="high", message="Very high HbA1c requires medical review.", item=item)
        if (name.endswith("alt") or " alt" in name or name == "alt") and value >= 150:
            _add_event(events, key="dangerous_alt", severity="high", message="Significant ALT elevation requires medical review.", item=item)
        if (name.endswith("ast") or " ast" in name or name == "ast") and value >= 120:
            _add_event(events, key="dangerous_ast", severity="high", message="Significant AST elevation requires medical review.", item=item)
        if "ldl" in name and ("mg/dl" in unit or unit == "") and value >= 190:
            _add_event(events, key="dangerous_ldl", severity="high", message="Very high LDL requires clinician discussion.", item=item)
        if "vitamin" in name and "d" in name and value < 10 and ("ng/ml" in unit or unit == ""):
            _add_event(events, key="severe_vitamin_d", severity="high", message="Severe vitamin D insufficiency should be reviewed medically.", item=item)
    return events


def _profile_events(profile: Dict[str, Any] | None) -> List[Dict[str, Any]]:
    profile = profile if isinstance(profile, dict) else {}
    events: List[Dict[str, Any]] = []
    age = _num(profile.get("age"))
    if age is not None and age < 18:
        _add_event(events, key="pediatric_context", severity="high", message="Pediatric context requires conservative clinician-first recommendations.")
    pregnancy = str(profile.get("pregnancy_status") or "").strip().lower()
    if pregnancy in {"pregnant", "yes", "true", "вагітна", "беременность", "pregnancy"}:
        _add_event(events, key="pregnancy_context", severity="high", message="Pregnancy context requires clinician-first recommendations.")
    current_medications = profile.get("current_medications") or profile.get("medications")
    if _value_present(current_medications):
        _add_event(events, key="current_medications_context", severity="medium", message="Current medications require interaction review before supplement or lifestyle changes.")
    if _value_present(profile.get("current_supplements")):
        _add_event(events, key="current_supplements_context", severity="medium", message="Current supplement stack should be checked before adding new supplements.")
    if _value_present(profile.get("allergies")):
        _add_event(events, key="known_allergies_context", severity="medium", message="Known allergies require safety screening before recommendations.")
    if _value_present(profile.get("prior_diagnoses")):
        _add_event(events, key="prior_diagnoses_context", severity="medium", message="Prior diagnoses require clinician context when interpreting recommendations.")
    return events


def _contains_sensitive_supplement(item: Dict[str, Any]) -> str | None:
    text = " ".join(
        str(item.get(key) or "")
        for key in ("supplement", "title", "body", "rationale", "dosage", "category")
    ).lower()
    for supplement_key, aliases in _SENSITIVE_SUPPLEMENTS.items():
        if any(alias in text for alias in aliases):
            return supplement_key
    return None


def _profile_age(profile: Dict[str, Any] | None) -> float | None:
    profile = profile if isinstance(profile, dict) else {}
    return _num(profile.get("age"))


def _is_pediatric_profile(profile: Dict[str, Any] | None) -> bool:
    age = _profile_age(profile)
    return age is not None and age < 18


def _is_pregnancy_profile(profile: Dict[str, Any] | None) -> bool:
    profile = profile if isinstance(profile, dict) else {}
    pregnancy = str(profile.get("pregnancy_status") or "").strip().lower()
    return pregnancy in {"pregnant", "yes", "true", "вагітна", "беременность", "pregnancy"}


def _contains_explicit_dosage(item: Dict[str, Any]) -> bool:
    dosage = str(item.get("dosage") or "").strip()
    if dosage and (_DOSAGE_PATTERN.search(dosage) or _DOSING_FREQUENCY_PATTERN.search(dosage)):
        return True

    text = " ".join(str(item.get(key) or "") for key in ("body", "rationale", "instructions", "supplement"))
    has_amount = bool(_DOSAGE_PATTERN.search(text))
    if not has_amount:
        return False
    return bool(_DOSING_FREQUENCY_PATTERN.search(text) or re.search(r"\b(?:take|use|start|dose|dosage|приймай|вживай|доз)\b", text, re.IGNORECASE))


def _has_safety_wording(item: Dict[str, Any]) -> bool:
    text = " ".join(str(value or "") for value in item.values()).lower()
    safe_terms = [
        "doctor",
        "clinician",
        "medical review",
        "discuss",
        "confirm",
        "qualified",
        "лікар",
        "обговор",
        "медич",
        "підтверд",
    ]
    return any(term in text for term in safe_terms)


def _diagnosis_like_text(value: Any) -> bool:
    text = str(value or "").lower()
    return any(re.search(pattern, text) for pattern in _DIAGNOSIS_PATTERNS)


def validate_recommendation(
    recommendation: Dict[str, Any],
    *,
    profile: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    warnings: List[Dict[str, Any]] = []
    blocked_items: List[Dict[str, Any]] = []
    events = _profile_events(profile)

    supplement_key = _contains_sensitive_supplement(recommendation)
    has_explicit_dosage = _contains_explicit_dosage(recommendation)
    if supplement_key and not _has_safety_wording(recommendation):
        warning = {
            "key": f"{supplement_key}_safety_wording",
            "message": "Sensitive supplement recommendation needs confirmation/clinician safety wording.",
            "item": recommendation,
        }
        warnings.append(warning)
        _add_event(events, key=warning["key"], severity="medium", message=warning["message"], item=recommendation)

    if supplement_key and has_explicit_dosage:
        warning = {
            "key": f"{supplement_key}_dosage_requires_clinician_review",
            "message": "Explicit supplement dosage requires clinician review and must not be presented as self-directed advice.",
            "item": recommendation,
        }
        warnings.append(warning)
        _add_event(events, key=warning["key"], severity="high", message=warning["message"], item=recommendation)

    if supplement_key and has_explicit_dosage and (_is_pediatric_profile(profile) or _is_pregnancy_profile(profile)):
        blocked = {
            "key": f"{supplement_key}_dosage_blocked_for_sensitive_context",
            "message": "Explicit supplement dosage is blocked for pediatric or pregnancy context.",
            "item": recommendation,
        }
        blocked_items.append(blocked)
        _add_event(events, key=blocked["key"], severity="high", message=blocked["message"], item=recommendation)

    if any(_diagnosis_like_text(value) for value in recommendation.values()):
        blocked = {
            "key": "diagnosis_like_wording",
            "message": "Recommendation contains diagnosis-like wording.",
            "item": recommendation,
        }
        blocked_items.append(blocked)
        _add_event(events, key="diagnosis_like_wording", severity="high", message=blocked["message"], item=recommendation)

    status = "blocked" if blocked_items else ("approved_with_warnings" if warnings or events else "approved")
    return {
        "status": status,
        "warnings": warnings,
        "blocked_items": blocked_items,
        "doctor_discussion_required": bool(warnings or blocked_items or events),
        "safety_events": _dedupe_events(events),
    }


def validate_protocol(
    protocol: Any,
    *,
    profile: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    warnings: List[Dict[str, Any]] = []
    blocked_items: List[Dict[str, Any]] = []
    events = _profile_events(profile)

    items: List[Dict[str, Any]] = []
    if isinstance(protocol, dict):
        for value in protocol.values():
            if isinstance(value, list):
                items.extend(item for item in value if isinstance(item, dict))
    elif isinstance(protocol, list):
        items.extend(item for item in protocol if isinstance(item, dict))

    for item in items:
        result = validate_recommendation(item, profile=profile)
        warnings.extend(result["warnings"])
        blocked_items.extend(result["blocked_items"])
        events.extend(result["safety_events"])

    status = "blocked" if blocked_items else ("approved_with_warnings" if warnings or events else "approved")
    return {
        "status": status,
        "warnings": warnings,
        "blocked_items": blocked_items,
        "doctor_discussion_required": bool(warnings or blocked_items or events),
        "safety_events": _dedupe_events(events),
    }


def validate_report(
    *,
    biomarkers: List[Dict[str, Any]] | None = None,
    knowledge_report: Dict[str, Any] | None = None,
    protocol: Any = None,
    profile: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    warnings: List[Dict[str, Any]] = []
    blocked_items: List[Dict[str, Any]] = []
    events = []
    events.extend(_dangerous_lab_events(biomarkers or []))
    events.extend(_profile_events(profile))

    report_text = str(knowledge_report or "")
    if _diagnosis_like_text(report_text):
        blocked_items.append({"key": "diagnosis_like_report_wording", "message": "Report contains diagnosis-like wording."})
        _add_event(events, key="diagnosis_like_report_wording", severity="high", message="Report contains diagnosis-like wording.")

    protocol_result = validate_protocol(protocol, profile=profile)
    warnings.extend(protocol_result["warnings"])
    blocked_items.extend(protocol_result["blocked_items"])
    events.extend(protocol_result["safety_events"])

    if any(str(event.get("severity")) == "critical" for event in events):
        warnings.append({"key": "critical_lab_value", "message": "Critical lab value requires medical review."})

    status = "blocked" if blocked_items else ("approved_with_warnings" if warnings or events else "approved")
    return {
        "status": status,
        "warnings": warnings,
        "blocked_items": blocked_items,
        "doctor_discussion_required": bool(warnings or blocked_items or events),
        "safety_events": _dedupe_events(events),
    }
