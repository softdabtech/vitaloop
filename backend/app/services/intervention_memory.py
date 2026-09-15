"""Intervention Memory (P20, backend-first v1).

Records and summarizes what a user reports doing BETWEEN lab uploads —
supplements, nutrition, training, sleep, stress, illness, medication,
alcohol, weight change, or a protocol action they acted on. This module
never computes or claims causation (that is P21 Outcome Attribution's
job, explicitly out of scope here) — it only normalizes self-reported
events, classifies which reasoning domains they may be relevant to, and
produces a snapshot-friendly summary for P19's velocity signals and a
future P21 to consume as CONTEXT, not proof.

No LLM anywhere in this module. Every generated string is a fixed
template using cautious, non-causal language ("may be relevant",
"self-reported", "does not prove causation" — never "caused"/"cured"/
"treated"/"fixed"), per docs/TRUST_AND_CLAIMS_GUIDELINES.md.

Frozen-replay safe: pure function of already-fetched intervention_events
rows plus a time window — a summary built from a persisted
input_snapshot is identical to one built at generation time, given the
same events and window.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from app.services.trend_engine import _parse_dt


INTERVENTION_MEMORY_VERSION = "p20_v1"

_DEFAULT_WINDOW_DAYS = 180

_VALID_EVENT_TYPES = {
    "supplement", "nutrition", "training", "sleep", "stress", "illness",
    "medication", "alcohol", "weight_change", "protocol_action", "other",
}

# Event-type -> domain(s) this kind of intervention is generically relevant
# to, before any label-keyword refinement below. Domain vocabulary matches
# report_interpretation.py / negative_evidence.py / personal_baseline.py's
# P19 section, plus "recovery" — a domain P14-P19 don't use (sleep/stress/
# training/illness don't map cleanly onto a lab-marker domain), introduced
# here specifically for that cluster.
_EVENT_TYPE_DOMAINS = {
    "sleep": ["recovery"],
    "stress": ["recovery"],
    "training": ["recovery"],
    "illness": ["inflammation", "recovery"],
    "alcohol": ["liver", "metabolic_health"],
    "weight_change": ["metabolic_health", "cardiovascular"],
}

# Keyword -> domain, checked against the lowercased label+description of
# supplement/nutrition/medication/protocol_action/other events (event types
# with no fixed domain of their own — what they affect depends entirely on
# what they are). Deliberately short and specific rather than an attempt at
# a full supplement/drug database.
_KEYWORD_DOMAINS = [
    (["iron", "ferritin"], "iron_status"),
    (["thyroid", "iodine", "levothyroxine", "selenium"], "thyroid"),
    (["vitamin d", "b12", "cobalamin", "zinc", "magnesium", "folate", "multivitamin"], "micronutrients"),
    (["omega", "fish oil", "statin", "coq10"], "cardiovascular"),
    (["turmeric", "curcumin", "probiotic"], "inflammation"),
    (["metformin", "berberine", "keto", "low carb", "low-carb"], "metabolic_health"),
    (["milk thistle", "nac ", "liver"], "liver"),
]

_DOMAIN_INTERPRETATION_NOTES = {
    "iron_status": "Self-reported iron-related activity may be relevant when reviewing ferritin or hemoglobin changes.",
    "thyroid": "Self-reported thyroid-related activity may be relevant when reviewing TSH or thyroid hormone changes.",
    "micronutrients": "Self-reported nutrient-related activity may be relevant when reviewing vitamin or mineral levels.",
    "cardiovascular": "Self-reported activity may be relevant when reviewing lipid or cardiovascular markers.",
    "inflammation": "Self-reported activity may be relevant when reviewing CRP or other inflammation markers.",
    "metabolic_health": "Self-reported activity may be relevant when reviewing glucose, insulin, or HbA1c changes.",
    "liver": "Self-reported activity may be relevant when reviewing ALT, AST, or GGT changes.",
    "recovery": "Self-reported sleep, stress, training, or illness context can help interpret broader trend changes.",
}

_STANDARD_LIMITATIONS = [
    "Self-reported events may be incomplete.",
    "This does not prove that an intervention caused a marker change.",
]


def _domains_for_event(event_type: str, label: str, description: str | None) -> List[str]:
    domains = list(_EVENT_TYPE_DOMAINS.get(event_type, []))
    text = f"{label or ''} {description or ''}".strip().lower()
    if text:
        for keywords, domain in _KEYWORD_DOMAINS:
            if domain in domains:
                continue
            if any(keyword in text for keyword in keywords):
                domains.append(domain)
    return domains


def normalize_intervention_event(raw: Dict[str, Any]) -> Dict[str, Any] | None:
    """Returns a normalized event, or None for input too malformed to use
    (missing id, or an event_type outside the fixed enum) — never raises."""
    if not isinstance(raw, dict):
        return None
    event_id = raw.get("id")
    event_type = str(raw.get("event_type") or "").strip().lower()
    label = str(raw.get("label") or "").strip()
    if not event_id or event_type not in _VALID_EVENT_TYPES or not label:
        return None

    started_at = raw.get("started_at")
    ended_at = raw.get("ended_at")
    ongoing = bool(raw.get("ongoing")) and not ended_at

    metadata = raw.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}

    return {
        "id": str(event_id),
        "type": event_type,
        "label": label,
        "description": raw.get("description"),
        "started_at": started_at,
        "ended_at": ended_at,
        "ongoing": ongoing,
        "adherence": raw.get("adherence"),
        "intensity": raw.get("intensity"),
        "dose": raw.get("dose"),
        "frequency": raw.get("frequency"),
        "source": raw.get("source") or "user",
        "related_protocol_id": raw.get("related_protocol_id"),
        "related_recommendation_id": raw.get("related_recommendation_id"),
        "domains": _domains_for_event(event_type, label, raw.get("description")),
        "confidence": "self_reported" if (raw.get("source") or "user") == "user" else str(raw.get("source")),
        "metadata": metadata,
    }


def _in_window(event: Dict[str, Any], window_from: datetime | None, window_to: datetime | None) -> bool:
    """An event overlaps the window if its [started_at, ended_at or now]
    span intersects [window_from, window_to] at all — a supplement started
    before the window and still ongoing is still relevant context for a
    report generated inside the window."""
    if window_from is None and window_to is None:
        return True
    started = _parse_dt(event.get("started_at")) if event.get("started_at") else None
    ended = _parse_dt(event.get("ended_at")) if event.get("ended_at") else None
    if started is None and ended is None:
        # No dates at all — can't place it in time, but a self-reported
        # event with no date shouldn't silently vanish either; include it
        # and let the caller's limitations note the gap.
        return True
    effective_end = ended or datetime.now(timezone.utc)
    effective_start = started or effective_end
    if window_to is not None and effective_start > window_to:
        return False
    if window_from is not None and effective_end < window_from:
        return False
    return True


def build_intervention_memory(
    events: List[Dict[str, Any]] | None,
    *,
    window_from: str | None = None,
    window_to: str | None = None,
) -> Dict[str, Any]:
    """window_from/window_to are ISO date/datetime strings — typically the
    previous report's measured_at and the current report's measured_at.
    When window_from is missing (no previous report, or its date is
    unknown), falls back to a conservative recent window
    (_DEFAULT_WINDOW_DAYS) and records that fallback as a limitation
    rather than silently using every event ever logged."""
    parsed_to = _parse_dt(window_to) if window_to else datetime.now(timezone.utc)
    parsed_from = _parse_dt(window_from) if window_from else None

    used_fallback_window = parsed_from is None
    if used_fallback_window:
        parsed_from = (parsed_to or datetime.now(timezone.utc)) - timedelta(days=_DEFAULT_WINDOW_DAYS)

    normalized: List[Dict[str, Any]] = []
    for raw in events or []:
        try:
            item = normalize_intervention_event(raw)
        except Exception:
            item = None
        if item:
            normalized.append(item)

    in_window = [e for e in normalized if _in_window(e, parsed_from, parsed_to)]

    active = [e for e in in_window if not e.get("ended_at")]
    completed = [e for e in in_window if e.get("ended_at")]

    domain_map: Dict[str, List[str]] = {}
    for event in active + completed:
        for domain in event.get("domains") or []:
            domain_map.setdefault(domain, []).append(event["label"])

    domain_context = [
        {
            "domain": domain,
            "events": labels,
            "interpretation_note": _DOMAIN_INTERPRETATION_NOTES.get(
                domain, "Self-reported activity may be relevant context for reviewing changes in this domain."
            ),
            "claim_strength": "context_only",
        }
        for domain, labels in sorted(domain_map.items())
    ]

    limitations = list(_STANDARD_LIMITATIONS)
    if used_fallback_window:
        limitations.append(
            f"No previous report date was available; showing self-reported events from the last "
            f"{_DEFAULT_WINDOW_DAYS} days as a conservative window."
        )
    if any(not e.get("started_at") and not e.get("ended_at") for e in in_window):
        limitations.append("Some events have no recorded date and could not be placed precisely in time.")

    return {
        "version": INTERVENTION_MEMORY_VERSION,
        "events_considered": len(in_window),
        "window": {
            "from": parsed_from.date().isoformat() if parsed_from else None,
            "to": parsed_to.date().isoformat() if parsed_to else None,
        },
        "active_interventions": active,
        "completed_interventions": completed,
        "domain_context": domain_context,
        "limitations": limitations,
    }
