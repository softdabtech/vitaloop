"""Stage 2F.1 — backend-owned questionnaire derived state.

Ports the exact deterministic formulas that previously lived ONLY client-side
in frontend/src/pages/Questionnaire.jsx (scoreReadiness(), the readiness
useMemo's "extra" calculation, and urgencyGuidance()) — unchanged thresholds,
unchanged logic, per the Stage 2F.1 instruction not to invent new medical
rules or redesign the scoring model in this stage. This module is now the
single authoritative source for `readiness` and `urgency`; the backend
recomputes them from raw questionnaire inputs on every write and ignores
whatever value (if any) the client submitted for them.

`severity` is traced as RAW USER INPUT (a direct 1-10 slider pick in
Questionnaire.jsx, `useState(5)` set directly by the UI — no formula produces
it anywhere, client or server). It is not "derived" and therefore has no
authoritative-recomputation step here — it is validated/clamped like any
other raw answer field, not recalculated.
"""

from __future__ import annotations

from typing import Any, Dict


QUESTIONNAIRE_SCORING_VERSION = "questionnaire_scoring_v1"

_RED_FLAG_KEYS = (
    "severeOnset",
    "fever",
    "swelling",
    "numbnessWeakness",
    "chestBreath",
    "trauma",
    "pregnancyContext",
)


def _text_len(value: Any) -> int:
    return len(str(value or "").strip())


def _as_number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_list(value: Any) -> list:
    if isinstance(value, list):
        return value
    if value in (None, ""):
        return []
    return [value]


def score_readiness(
    *,
    concern: Any = None,
    duration: Any = None,
    severity: Any = None,
    body_system: Any = None,
    related: Any = None,
    meds: Any = None,
) -> int:
    """Direct port of Questionnaire.jsx's scoreReadiness() — same base score,
    same point values, same clamp range."""
    score = 20
    if _text_len(concern) >= 6:
        score += 24
    if duration:
        score += 10
    if _as_number(severity) >= 4:
        score += 10
    if body_system:
        score += 12
    if _text_len(related) >= 4:
        score += 12
    if _text_len(meds) >= 3:
        score += 8
    return max(20, min(98, score))


def compute_readiness(summary: Dict[str, Any]) -> int:
    """Direct port of the `readiness` useMemo in Questionnaire.jsx: base score
    plus the "extra" bonus from triggers/lifestyle/functional-impact/pattern,
    same weights and same overall clamp to 99."""
    related = summary.get("relatedSymptoms") if summary.get("relatedSymptoms") is not None else summary.get("related_symptoms")
    meds = summary.get("medications")
    triggers = _as_list(summary.get("symptomTriggers") if summary.get("symptomTriggers") is not None else summary.get("symptom_triggers"))
    lifestyle = _as_list(summary.get("lifestyleContext") if summary.get("lifestyleContext") is not None else summary.get("lifestyle_context"))
    functional_impact = summary.get("functionalImpact") if summary.get("functionalImpact") is not None else summary.get("functional_impact")
    symptom_pattern = summary.get("symptomPattern") if summary.get("symptomPattern") is not None else summary.get("symptom_pattern")

    base = score_readiness(
        concern=summary.get("concern"),
        duration=summary.get("duration"),
        severity=summary.get("severity"),
        body_system=summary.get("bodySystem") if summary.get("bodySystem") is not None else summary.get("body_system"),
        related=related,
        meds=meds,
    )
    extra = min(
        18,
        len(triggers) * 3
        + len(lifestyle) * 2
        + (5 if functional_impact else 0)
        + (4 if symptom_pattern else 0),
    )
    return min(99, base + extra)


def _urgency_text(active_count: int, locale: str) -> str:
    is_uk = str(locale or "").lower().startswith("uk")
    if active_count == 0:
        return "Термінових червоних прапорців не зазначено." if is_uk else "No urgent red flags reported."
    if active_count <= 2:
        return (
            "Деякі відповіді вказують, що своєчасний огляд лікаря важливий."
            if is_uk
            else "Some answers suggest timely clinician review is important."
        )
    return (
        "Виявлено кілька червоних прапорців. Не відкладайте медичний огляд."
        if is_uk
        else "Multiple red flags detected. Do not delay medical review."
    )


def compute_urgency(summary: Dict[str, Any], *, locale: str = "en") -> str:
    """Direct port of Questionnaire.jsx's urgencyGuidance(): counts active red
    flags among the same fixed set of 7 keys, same 0 / 1-2 / 3+ thresholds,
    same copy per locale (logic is locale-independent; only the string is
    translated — mirrors the same pattern already used in safety_engine.py)."""
    red_flags = summary.get("redFlags") if summary.get("redFlags") is not None else summary.get("red_flags")
    red_flags = red_flags if isinstance(red_flags, dict) else {}
    active_count = sum(1 for key in _RED_FLAG_KEYS if bool(red_flags.get(key)))
    return _urgency_text(active_count, locale)


def apply_authoritative_derived_state(summary: Dict[str, Any], *, locale: str = "en") -> Dict[str, Any]:
    """Given a client-submitted `summary` dict (raw answers + possibly a
    client-computed readiness/urgency that must NOT be trusted), returns a new
    dict with `readiness` and `urgency` overwritten by the backend's own
    recomputation from the raw fields. Raw answer fields are passed through
    unchanged — only the two derived fields are ever touched here.
    """
    result = dict(summary or {})
    result["readiness"] = compute_readiness(result)
    result["urgency"] = compute_urgency(result, locale=locale)
    result["readiness_source"] = "backend"
    result["urgency_source"] = "backend"
    return result
