from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List

from app.services.clinical_engine.units import normalize_unit, convert_value

SAFETY_ENGINE_VERSION = "safety_engine_v1"

_DIAGNOSIS_PATTERNS = [
    r"\byou have\b",
    r"\bdiagnosed with\b",
    r"\bconfirmed diagnosis\b",
    r"\biron deficiency anemia\b",
    r"\bу вас є діагноз\b",
    r"\bу вас діагностовано\b",
]

_SENSITIVE_SUPPLEMENTS = {
    "iron": ["iron", "заліз", "желез"],
    "vitamin_d": ["vitamin d", "d3", "вітамін d", "витамин d"],
    "b12": ["b12", "б12"],
    "folate": ["folate", "folic", "фолат", "фоліє", "фолиев"],
    "magnesium": ["magnesium", "магній", "магни"],
    "potassium": ["potassium", "potassium chloride", "калій", "калий"],
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
    parts = [
        str(item.get("canonical_name") or "").replace("canonical_", "").replace("_", " "),
        str(item.get("name") or ""),
        str(item.get("source_name") or ""),
    ]
    return " ".join(part.strip().lower() for part in parts if part.strip())


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


def _check_critical_glucose(value: float, unit: str) -> bool:
    """Check if glucose value is critically high (>=300) or low (<=54), handling unit conversion.

    Canonical unit: mg/dL
    - Critical high: >= 300 mg/dL (or >= 16.7 mmol/L)
    - Critical low: <= 54 mg/dL (or <= 3.0 mmol/L)

    Returns: True if value exceeds critical threshold.
    Fails closed (returns False) if unit is missing, incompatible, or unsupported.
    """
    norm_unit = normalize_unit(unit)

    # Fail closed if unit is missing or empty
    if not norm_unit or norm_unit == "unit":
        return False

    # Check if unit is mg/dl (canonical)
    if norm_unit == "mg/dl":
        return value >= 300 or value <= 54

    # Try to convert from alternative unit to canonical
    converted = convert_value("glucose", value, unit, "mg/dl")
    if converted is not None:
        return converted >= 300 or converted <= 54

    # Unsupported unit - fail closed
    return False


def _check_critical_ldl(value: float, unit: str) -> bool:
    """Check if LDL value is critically high (>=190), handling unit conversion.

    Canonical unit: mg/dL
    - Critical high: >= 190 mg/dL (or >= 4.9 mmol/L)

    Returns: True if value exceeds critical threshold.
    Fails closed (returns False) if unit is missing, incompatible, or unsupported.
    """
    norm_unit = normalize_unit(unit)

    # Fail closed if unit is missing or empty
    if not norm_unit or norm_unit == "unit":
        return False

    # Check if unit is mg/dl (canonical)
    if norm_unit == "mg/dl":
        return value >= 190

    # Try to convert from alternative unit to canonical
    converted = convert_value("ldl", value, unit, "mg/dl")
    if converted is not None:
        return converted >= 190

    # Unsupported unit - fail closed
    return False


def _check_critical_hba1c(value: float, unit: str) -> bool:
    """Check if HbA1c is critically elevated (>=9.0%), handling unit validation.

    Canonical unit: % (percent)
    - Critical: >= 9.0%

    Note: mmol/mol cannot be directly compared to % as they are on different scales.
    A value of 9 mmol/mol is NOT equivalent to 9%.

    Returns: True if value exceeds critical threshold.
    Fails closed (returns False) if unit is missing, incompatible, or unsupported.
    """
    norm_unit = normalize_unit(unit)

    # Fail closed if unit is missing or empty
    if not norm_unit or norm_unit == "unit":
        return False

    # Only accept % (percent) as valid unit for this comparison
    if norm_unit in {"%", "percent", "pct"}:
        return value >= 9.0

    # mmol/mol is a different scale and cannot be safely compared to %
    # Would require a separate clinical conversion factor (not in current infrastructure)
    # Fail closed for any other unit
    return False


def _check_critical_alt(value: float, unit: str) -> bool:
    """Check if ALT is significantly elevated (>=150 U/L), handling unit validation.

    Canonical unit: U/L (IU/L)
    - Critical: >= 150 U/L

    Returns: True if value exceeds critical threshold.
    Fails closed (returns False) if unit is missing, incompatible, or unsupported.
    """
    norm_unit = normalize_unit(unit)

    # Fail closed if unit is missing or empty
    if not norm_unit or norm_unit == "unit":
        return False

    # Accept U/L and IU/L as equivalent canonical units
    if norm_unit in {"u/l", "iu/l"}:
        return value >= 150

    # Other units for enzyme activity not supported without clinical conversion
    # Fail closed for any other unit
    return False


def _check_critical_ast(value: float, unit: str) -> bool:
    """Check if AST is significantly elevated (>=120 U/L), handling unit validation.

    Canonical unit: U/L (IU/L)
    - Critical: >= 120 U/L

    Returns: True if value exceeds critical threshold.
    Fails closed (returns False) if unit is missing, incompatible, or unsupported.
    """
    norm_unit = normalize_unit(unit)

    # Fail closed if unit is missing or empty
    if not norm_unit or norm_unit == "unit":
        return False

    # Accept U/L and IU/L as equivalent canonical units
    if norm_unit in {"u/l", "iu/l"}:
        return value >= 120

    # Other units for enzyme activity not supported without clinical conversion
    # Fail closed for any other unit
    return False


def _check_critical_vitamin_d(value: float, unit: str) -> bool:
    """Check if Vitamin D is severely deficient (<10 ng/mL), handling unit conversion.

    Canonical unit: ng/mL
    - Critical low: < 10 ng/mL (or < 25 nmol/L)

    Returns: True if value is below critical threshold.
    Fails closed (returns False) if unit is missing, incompatible, or unsupported.
    """
    norm_unit = normalize_unit(unit)

    # Fail closed if unit is missing or empty
    if not norm_unit or norm_unit == "unit":
        return False

    # Check if unit is ng/ml (canonical)
    if norm_unit == "ng/ml":
        return value < 10

    # Try to convert from alternative unit to canonical
    converted = convert_value("vitamin_d", value, unit, "ng/ml")
    if converted is not None:
        return converted < 10

    # Unsupported unit - fail closed
    return False


def _as_10e9_per_l(value: float, unit: str) -> float | None:
    norm_unit = normalize_unit(unit)
    if not norm_unit or norm_unit == "unit":
        return None
    if norm_unit in {"10^9/l", "g/l", "г/л"}:
        return value
    return None


def _as_g_per_dl(marker_key: str, value: float, unit: str) -> float | None:
    norm_unit = normalize_unit(unit)
    if not norm_unit or norm_unit == "unit":
        return None
    if norm_unit == "g/dl":
        return value
    converted = convert_value(marker_key, value, unit, "g/dl")
    return converted


def _as_mmol_per_l(marker_key: str, value: float, unit: str) -> float | None:
    norm_unit = normalize_unit(unit)
    if not norm_unit or norm_unit == "unit":
        return None
    if norm_unit == "mmol/l":
        return value
    converted = convert_value(marker_key, value, unit, "mmol/l")
    return converted


def _check_critical_anc(value: float, unit: str) -> bool:
    converted = _as_10e9_per_l(value, unit)
    return converted is not None and converted <= 0.5


def _check_critical_potassium(value: float, unit: str) -> bool:
    converted = _as_mmol_per_l("potassium", value, unit)
    return converted is not None and converted < 3.0


def _check_critical_platelets(value: float, unit: str) -> bool:
    converted = _as_10e9_per_l(value, unit)
    return converted is not None and converted < 75


def _check_critical_hemoglobin(value: float, unit: str) -> bool:
    converted = _as_g_per_dl("hemoglobin", value, unit)
    return converted is not None and converted < 9.0


def _dangerous_lab_events(biomarkers: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Identify dangerous lab values using unit-safe critical thresholds.

    All checks validate unit compatibility and fail closed when:
    - Unit is missing (empty string)
    - Unit is incompatible with the marker
    - Unit is unsupported (no validated conversion available)

    This ensures equivalent cross-unit values produce equivalent safety decisions.
    """
    events: List[Dict[str, Any]] = []
    for item in biomarkers or []:
        if not isinstance(item, dict):
            continue
        name = _marker_name(item)
        value = _num(item.get("value"))
        unit = str(item.get("unit") or "").strip().lower()
        if value is None:
            continue

        # Unit-safe glucose check
        if "glucose" in name and _check_critical_glucose(value, unit):
            _add_event(events, key="dangerous_glucose", severity="critical", message="Critical glucose value requires medical review.", item=item)

        # Unit-safe HbA1c check
        if "hba1c" in name and _check_critical_hba1c(value, unit):
            _add_event(events, key="dangerous_hba1c", severity="high", message="Very high HbA1c requires medical review.", item=item)

        # Unit-safe ALT check
        if (name.endswith("alt") or " alt" in name or name == "alt") and _check_critical_alt(value, unit):
            _add_event(events, key="dangerous_alt", severity="high", message="Significant ALT elevation requires medical review.", item=item)

        # Unit-safe AST check
        if (name.endswith("ast") or " ast" in name or name == "ast") and _check_critical_ast(value, unit):
            _add_event(events, key="dangerous_ast", severity="high", message="Significant AST elevation requires medical review.", item=item)

        # Unit-safe LDL check
        if "ldl" in name and _check_critical_ldl(value, unit):
            _add_event(events, key="dangerous_ldl", severity="high", message="Very high LDL requires clinician discussion.", item=item)

        # Unit-safe Vitamin D check
        if "vitamin" in name and "d" in name and _check_critical_vitamin_d(value, unit):
            _add_event(events, key="severe_vitamin_d", severity="high", message="Severe vitamin D insufficiency should be reviewed medically.", item=item)

        if (
            name == "anc"
            or "absolute neutrophil" in name
            or "neutrophils absolute" in name
            or "absolute neutrophils" in name
        ) and _check_critical_anc(value, unit):
            _add_event(events, key="critical_absolute_neutrophils", severity="critical", message="Very low absolute neutrophils require prompt medical review.", item=item)

        if "potassium" in name and _check_critical_potassium(value, unit):
            _add_event(events, key="critical_potassium", severity="critical", message="Very low potassium requires prompt medical review.", item=item)

        if ("platelet" in name or name in {"plt", "thrombocytes"}) and _check_critical_platelets(value, unit):
            _add_event(events, key="critical_platelets", severity="critical", message="Very low platelets require prompt medical review.", item=item)

        if ("hemoglobin" in name or name in {"hb", "hgb"}) and _check_critical_hemoglobin(value, unit):
            _add_event(events, key="critical_hemoglobin", severity="critical", message="Very low hemoglobin requires prompt medical review.", item=item)

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


def _clinician_review_dosage_text(locale: str) -> str:
    if str(locale or "").lower().startswith("uk"):
        return "Узгодити дозування з лікарем з урахуванням віку, ваги, аналізів і поточних добавок."
    return "Confirm dosing with a qualified clinician based on age, weight, labs, and current supplements."


def _supplement_dosage_safety_note(locale: str) -> str:
    if str(locale or "").lower().startswith("uk"):
        return "Для дитячого або вагітного контексту VITALOOP не показує самостійні дозування добавок."
    return "For pediatric or pregnancy context, VITALOOP does not show self-directed supplement dosing."


def _diagnosis_like_replacement_text(locale: str) -> str:
    if str(locale or "").lower().startswith("uk"):
        return "Цей висновок варто обговорити з лікарем — VITALOOP не встановлює діагноз."
    return "This finding should be discussed with a qualified clinician — VITALOOP does not provide a diagnosis."


def _clinician_review_action_text(locale: str) -> str:
    if str(locale or "").lower().startswith("uk"):
        return "Обговоріть доречність, дозування і безпечність цього кроку з кваліфікованим лікарем."
    return "Discuss whether this step is appropriate, including dose and safety, with a qualified clinician."


def urgent_review_notice(locale: str) -> str:
    if str(locale or "").lower().startswith("uk"):
        return (
            "У цьому звіті є показники, які можуть потребувати швидкого медичного перегляду. "
            "Зв'яжіться з лікарем або невідкладною допомогою, особливо якщо симптоми виражені чи погіршуються."
        )
    return (
        "This report contains lab values that may require prompt medical review. "
        "Contact a qualified clinician or urgent care, especially if symptoms are severe or worsening."
    )


def _sanitize_user_text(value: Any, locale: str) -> Any:
    if not isinstance(value, str) or not value.strip():
        return value
    text = value
    replacement = _diagnosis_like_replacement_text(locale)
    text = re.sub(r"\biron deficiency anemia\b", "a possible iron-status/anemia pattern requiring clinical confirmation", text, flags=re.IGNORECASE)
    text = re.sub(r"\bconfirmed diagnosis\b", "a pattern requiring clinical confirmation", text, flags=re.IGNORECASE)
    text = re.sub(r"\byou have\b", "your results may be consistent with", text, flags=re.IGNORECASE)
    text = re.sub(r"\bdiagnosed with\b", "requires clinician review for", text, flags=re.IGNORECASE)
    text = re.sub(
        r"\bsupplementation is necessary\b",
        "supplementation should be discussed with a qualified clinician",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\b(?:take|use|start)\s+[^.?!;\n]*\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|iu|мг|мкг|мо|од\.?)[^.?!;\n]*[.?!;]?",
        _clinician_review_action_text(locale),
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\baddress smoking, physical inactivity and metabolic syndrome\b[.]?",
        "If relevant, discuss smoking status, activity level, and metabolic risk factors with a clinician.",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\bsmoking increases your risk\b",
        "If you smoke, this may be relevant to discuss with a clinician",
        text,
        flags=re.IGNORECASE,
    )
    if _diagnosis_like_text(text):
        return replacement
    return text


def blocked_content_notice(locale: str) -> str:
    """Plain-language, user-facing notice for when validate_report() returns
    status="blocked" and content has been redacted. Deliberately does not
    reference internal blocked_items keys or rule names."""
    if str(locale or "").lower().startswith("uk"):
        return "Частину рекомендацій приховано або скориговано з міркувань безпеки. Обговоріть це з лікарем."
    return "Some recommendations were withheld or adjusted for safety. Please discuss this with a clinician."


def _diagnosis_like_safety_note(locale: str) -> str:
    if str(locale or "").lower().startswith("uk"):
        return "Частину тексту приховано, оскільки він звучав як медичний діагноз."
    return "Part of this content was withheld because it read as a medical diagnosis."


def _prescriptive_safety_note(locale: str) -> str:
    if str(locale or "").lower().startswith("uk"):
        return "Самостійні дозування або призначення приховано з міркувань безпеки."
    return "Self-directed dosing or prescriptive wording was withheld for safety."


# Fields plausibly containing recommendation-facing prose. Kept narrow and
# reused from the same field set _contains_explicit_dosage/_has_safety_wording
# already scan — no new detection surface, only a redaction target list.
_RECOMMENDATION_TEXT_FIELDS = ("title", "body", "rationale", "instructions", "summary", "notes")

# knowledge_report["why_it_matters"] items (built by
# app/services/knowledge/report.py::_interpretation) carry free text — sourced
# from matched-rule name/summary/explanation/risk fields — in exactly these
# three keys. Same redaction target pattern as _RECOMMENDATION_TEXT_FIELDS,
# scoped to this different, addressable schema.
_WHY_IT_MATTERS_TEXT_FIELDS = ("title", "summary", "why_it_matters")

# knowledge_evaluation["matched_rules"] items are the UPSTREAM source
# _interpretation() reads to build why_it_matters (see report.py:311-328:
# title = name/summary, summary = summary/description, why = explanation/risk).
# knowledge_evaluation is a separate object from knowledge_report and is served
# independently in every live response — for English locale specifically, the
# report-level localization merge (_localized_knowledge_evaluation_for_response)
# only overwrites matched_rules with the (already-sanitized) report fields for
# Ukrainian; English callers would otherwise still see the raw upstream text.
_MATCHED_RULE_TEXT_FIELDS = ("name", "summary", "description", "explanation", "risk")


def _redact_diagnosis_like_dict_fields(item: Dict[str, Any], locale: str, fields: Iterable[str]) -> tuple[Dict[str, Any], bool]:
    """Shared redaction step reused by both sanitize_protocol_for_safety() and
    sanitize_knowledge_report_for_safety(): if any of `fields` on `item`
    contains diagnosis-like text (per the existing _diagnosis_like_text
    detector), replace just those fields with the safe clinician-referral text
    and flag the item. Returns (possibly-modified copy, changed: bool)."""
    if any(_diagnosis_like_text(value) for value in item.values()):
        sanitized = dict(item)
        for field in fields:
            value = sanitized.get(field)
            if value is not None and _diagnosis_like_text(value):
                sanitized[field] = _diagnosis_like_replacement_text(locale)
        sanitized["original_content_hidden"] = True
        sanitized["requires_doctor"] = True
        notes = list(sanitized.get("safety_notes") or [])
        note = _diagnosis_like_safety_note(locale)
        if note not in notes:
            notes.insert(0, note)
        sanitized["safety_notes"] = notes
        return sanitized, True
    return item, False


def _sanitize_protocol_item(
    item: Dict[str, Any],
    *,
    profile: Dict[str, Any] | None = None,
    locale: str = "en",
) -> tuple[Dict[str, Any], bool]:
    sensitive_context = _is_pediatric_profile(profile) or _is_pregnancy_profile(profile)
    supplement_key = _contains_sensitive_supplement(item)
    sanitized, changed = _redact_diagnosis_like_dict_fields(item, locale, _RECOMMENDATION_TEXT_FIELDS)
    sanitized = dict(sanitized)

    for field in _RECOMMENDATION_TEXT_FIELDS:
        value = sanitized.get(field)
        new_value = _sanitize_user_text(value, locale)
        if new_value != value:
            sanitized[field] = new_value
            changed = True

    supplement_key = supplement_key or _contains_sensitive_supplement(sanitized)
    if supplement_key and _contains_explicit_dosage(sanitized):
        sanitized["original_dosage_hidden"] = True
        sanitized["dosage"] = _clinician_review_dosage_text(locale)
        sanitized["requires_doctor"] = True
        notes = list(sanitized.get("safety_notes") or [])
        note = _supplement_dosage_safety_note(locale) if sensitive_context else _prescriptive_safety_note(locale)
        if note not in notes:
            notes.insert(0, note)
        sanitized["safety_notes"] = notes
        changed = True

    return sanitized if changed else item, changed


def sanitize_protocol_for_safety(
    protocol: Any,
    *,
    profile: Dict[str, Any] | None = None,
    locale: str = "en",
) -> Any:
    """
    Enforce the safety engine's existing blocked-content semantics on individual
    protocol/recommendation items:

    1. Diagnosis-like wording (validate_recommendation's `diagnosis_like_wording`
       blocker) is redacted from every item, in every context — this is a
       universal rule, not gated to pediatric/pregnancy profiles.
    2. Self-directed supplement dosing in a pediatric/pregnancy context (the
       existing `..._dosage_blocked_for_sensitive_context` blocker) is redacted,
       as before — unchanged, still context-gated.

    Both reuse the exact same detectors already used to compute blocked_items
    in validate_recommendation() (_diagnosis_like_text, _contains_sensitive_
    supplement, _contains_explicit_dosage) — no new safety logic is introduced
    here, only enforcement of what those detectors already decide.
    """
    def sanitize_item(item: Any) -> Any:
        if not isinstance(item, dict):
            return item
        sanitized, changed = _sanitize_protocol_item(item, profile=profile, locale=locale)
        return sanitized if changed else item

    if isinstance(protocol, dict):
        return {
            key: [sanitize_item(item) for item in value] if isinstance(value, list) else value
            for key, value in protocol.items()
        }
    if isinstance(protocol, list):
        return [sanitize_item(item) for item in protocol]
    return protocol


def sanitize_knowledge_report_for_safety(
    knowledge_report: Dict[str, Any] | None,
    *,
    locale: str = "en",
) -> Dict[str, Any] | None:
    """
    Report-level counterpart to sanitize_protocol_for_safety(): closes the gap
    where validate_report()'s report-text check (str(knowledge_report or ""))
    can detect diagnosis-like wording and return status="blocked", while the
    exact free-text field responsible for that verdict was still served/
    persisted unchanged.

    Traced source of that free text (app/services/knowledge/report.py):
      - knowledge_report["why_it_matters"]: list of dicts with title/summary/
        why_it_matters string fields, built from matched-rule name/summary/
        explanation/risk text (_interpretation()).
      - knowledge_report["doctor_discussion"]: list of plain template strings
        that can embed a rule's title (_discussion_points()).
    Every other field in knowledge_report (summary.headline, what_was_found's
    biomarker/status labels, nutrition_context, source_references, action_plan)
    is either a fixed-template/enum-derived string with no free-text injection
    point, or (action_plan) already covered by sanitize_protocol_for_safety()
    via the separate `recommendations`/`protocol` sanitization — so this
    function only needs to address these two fields, not the whole dict.

    Uses the exact same _diagnosis_like_text detector and replacement/note text
    as sanitize_protocol_for_safety() — no new detection logic, no whole-report
    suppression, unrelated fields untouched.
    """
    if not isinstance(knowledge_report, dict):
        return knowledge_report

    sanitized = dict(knowledge_report)

    why_it_matters = sanitized.get("why_it_matters")
    if isinstance(why_it_matters, list):
        new_items = []
        for item in why_it_matters:
            if isinstance(item, dict):
                redacted, _changed = _redact_diagnosis_like_dict_fields(item, locale, _WHY_IT_MATTERS_TEXT_FIELDS)
                redacted = {
                    key: (_sanitize_user_text(value, locale) if key in _WHY_IT_MATTERS_TEXT_FIELDS else value)
                    for key, value in redacted.items()
                }
                new_items.append(redacted)
            else:
                new_items.append(_sanitize_user_text(item, locale))
        sanitized["why_it_matters"] = new_items

    doctor_discussion = sanitized.get("doctor_discussion")
    if isinstance(doctor_discussion, list):
        sanitized["doctor_discussion"] = [
            _sanitize_user_text(point, locale)
            for point in doctor_discussion
        ]

    action_plan = sanitized.get("action_plan")
    if isinstance(action_plan, list):
        sanitized["action_plan"] = sanitize_protocol_for_safety(action_plan, locale=locale)

    return sanitized


def sanitize_knowledge_evaluation_for_safety(
    knowledge_evaluation: Dict[str, Any] | None,
    *,
    locale: str = "en",
) -> Dict[str, Any] | None:
    """
    knowledge_evaluation is the upstream rule-matching output _interpretation()
    reads to build knowledge_report["why_it_matters"] (see report.py:311-328) —
    but it is ALSO served directly and independently in every live response
    (analyze.py's "knowledge_evaluation" field, and B2B's spread of the raw
    pipeline result). The report-level fix above does not reach this object.
    Redacts matched_rules[].name/summary/description/explanation/risk using the
    same detector/replacement as sanitize_knowledge_report_for_safety() —
    no new detection logic.
    """
    if not isinstance(knowledge_evaluation, dict):
        return knowledge_evaluation

    matched_rules = knowledge_evaluation.get("matched_rules")
    if not isinstance(matched_rules, list):
        return knowledge_evaluation

    sanitized = dict(knowledge_evaluation)
    new_rules = []
    for rule in matched_rules:
        if isinstance(rule, dict):
            redacted, _changed = _redact_diagnosis_like_dict_fields(rule, locale, _MATCHED_RULE_TEXT_FIELDS)
            redacted = {
                key: (_sanitize_user_text(value, locale) if key in _MATCHED_RULE_TEXT_FIELDS else value)
                for key, value in redacted.items()
            }
            new_rules.append(redacted)
        else:
            new_rules.append(_sanitize_user_text(rule, locale))
    sanitized["matched_rules"] = new_rules
    return sanitized


def sanitize_safety_result_for_output(
    safety_result: Dict[str, Any] | None,
    *,
    locale: str = "en",
) -> Dict[str, Any] | None:
    """Defense-in-depth for served safety payloads.

    validate_*() now stores sanitized copies in warnings/blocked_items, but
    historical frozen rows may still contain raw recommendation objects. This
    keeps the public safety_result useful without allowing it to become a
    backdoor for diagnosis-like or prescriptive text.
    """
    if not isinstance(safety_result, dict):
        return safety_result

    def clean(value: Any) -> Any:
        if isinstance(value, dict):
            if any(key in value for key in ("title", "body", "rationale", "dosage", "supplement", "instructions", "summary", "notes")):
                return _sanitize_protocol_item(value, locale=locale)[0]
            return {key: clean(item) for key, item in value.items()}
        if isinstance(value, list):
            return [clean(item) for item in value]
        return _sanitize_user_text(value, locale)

    return clean(safety_result)


def _diagnosis_like_text(value: Any) -> bool:
    text = str(value or "").lower()
    return any(re.search(pattern, text) for pattern in _DIAGNOSIS_PATTERNS)


def validate_recommendation(
    recommendation: Dict[str, Any],
    *,
    profile: Dict[str, Any] | None = None,
    locale: str = "en",
) -> Dict[str, Any]:
    warnings: List[Dict[str, Any]] = []
    blocked_items: List[Dict[str, Any]] = []
    events = _profile_events(profile)

    supplement_key = _contains_sensitive_supplement(recommendation)
    has_explicit_dosage = _contains_explicit_dosage(recommendation)
    if supplement_key and not _has_safety_wording(recommendation):
        public_item, _ = _sanitize_protocol_item(recommendation, profile=profile, locale=locale)
        warning = {
            "key": f"{supplement_key}_safety_wording",
            "message": "Sensitive supplement recommendation needs confirmation/clinician safety wording.",
            "item": public_item,
        }
        warnings.append(warning)
        _add_event(events, key=warning["key"], severity="medium", message=warning["message"], item=recommendation)

    if supplement_key and has_explicit_dosage:
        public_item, _ = _sanitize_protocol_item(recommendation, profile=profile, locale=locale)
        warning = {
            "key": f"{supplement_key}_dosage_requires_clinician_review",
            "message": "Explicit supplement dosage requires clinician review and must not be presented as self-directed advice.",
            "item": public_item,
        }
        warnings.append(warning)
        _add_event(events, key=warning["key"], severity="high", message=warning["message"], item=recommendation)

    if supplement_key and has_explicit_dosage and (_is_pediatric_profile(profile) or _is_pregnancy_profile(profile)):
        public_item, _ = _sanitize_protocol_item(recommendation, profile=profile, locale=locale)
        blocked = {
            "key": f"{supplement_key}_dosage_blocked_for_sensitive_context",
            "message": "Explicit supplement dosage is blocked for pediatric or pregnancy context.",
            "item": public_item,
        }
        blocked_items.append(blocked)
        _add_event(events, key=blocked["key"], severity="high", message=blocked["message"], item=recommendation)

    if any(_diagnosis_like_text(value) for value in recommendation.values()):
        public_item, _ = _sanitize_protocol_item(recommendation, profile=profile, locale=locale)
        blocked = {
            "key": "diagnosis_like_wording",
            "message": "Recommendation contains diagnosis-like wording.",
            "item": public_item,
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
    locale: str = "en",
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
        result = validate_recommendation(item, profile=profile, locale=locale)
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
    locale: str = "en",
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

    protocol_result = validate_protocol(protocol, profile=profile, locale=locale)
    warnings.extend(protocol_result["warnings"])
    blocked_items.extend(protocol_result["blocked_items"])
    events.extend(protocol_result["safety_events"])

    if any(str(event.get("severity")) == "critical" for event in events):
        warnings.append({"key": "critical_lab_value", "message": "Critical lab value requires medical review."})

    status = "blocked" if blocked_items else ("approved_with_warnings" if warnings or events else "approved")
    urgent_review_required = any(str(event.get("severity")) == "critical" for event in events)
    return {
        "status": status,
        "risk_level": "urgent_review" if urgent_review_required else ("medical_review" if warnings or blocked_items or events else "routine"),
        "urgent_review_required": urgent_review_required,
        "prominent_user_warning": urgent_review_notice(locale) if urgent_review_required else None,
        "warnings": warnings,
        "blocked_items": blocked_items,
        "doctor_discussion_required": bool(warnings or blocked_items or events),
        "safety_events": _dedupe_events(events),
    }
