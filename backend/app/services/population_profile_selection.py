"""Population Profile Selection / Targeting (P24.3, backend-first v1).

Decides WHICH population profiles population_profiles.py should compute
for a given report — a small, deterministic, no-LLM step that runs
*before* build_population_profile_overlays(), never inside it. Selection
logic lives here specifically so P24.1/P24.2's overlay-building code never
needs to know how a profile got chosen; it only ever receives a final
`profile_ids` list.

This module reads only structured data the pipeline already computes:
- intervention_memory (P20's normalized, self-reported events — event
  `type` is a fixed enum, see intervention_memory.py's _VALID_EVENT_TYPES),
- an optional explicit override carried in the existing, already-plumbed
  free-form `source_metadata` dict (key: "population_profile_ids") — no
  new request field, no new API surface, no UI/CRM change.

It NEVER reads lab markers/hypotheses/evidence_debt to decide activation.
"Athlete" is a self-reported lifestyle context (training, sleep, stress,
illness), not something a lab value can establish on its own — inferring
it from biomarkers alone would silently turn a data pattern into a
lifestyle claim, which this module deliberately refuses to do.

Selection rules (backward-compatible with P24.1/P24.2's shipped default):
- `longevity_metabolic_optimization` is always the default and stays
  active unless an explicit selection overrides the whole list.
- `athlete_recovery` activates only when:
  - explicitly requested via source_metadata["population_profile_ids"], or
  - a strong structured signal exists: a recent intervention_memory event
    of type "training" (always sufficient on its own), or a "sleep"/
    "stress"/"illness" event whose label/description text names
    training/athletic context explicitly (a plain "poor sleep" or
    "stressful week" event, with no athletic language, is NOT enough --
    those event types are extremely common and not athlete-specific).
- Unknown/invalid explicit profile ids are dropped, never raised on, and
  reported in `ignored_profile_ids` plus a `selection_reasons` entry so a
  caller/log can see why.
- When explicit ids are supplied, they are honored as-is (no additional
  inference layered on top) -- explicit always wins outright.

Output shape:
    {
        "version": "p24_3_v1",
        "active_profile_ids": ["longevity_metabolic_optimization"],
        "selection_source": "default" | "explicit" | "inferred" | "mixed",
        "selection_reasons": [
            {"profile_id": "...", "reason_code": "...", "source": "..."},
        ],
        "ignored_profile_ids": ["..."],
    }

`selection_source` values:
- "default": only the always-on default was applied, no explicit request,
  no inference triggered.
- "explicit": an explicit, valid profile_ids request was honored as-is.
- "mixed": the default profile stayed active AND an inference added
  another profile alongside it (the only way inference can currently
  occur, since the default is never removed without an explicit override).
- "inferred": reserved for a future selection rule that could produce a
  profile list driven entirely by inference with no default component;
  not reachable under the current rules, kept in the enum so callers can
  already branch on it without a later contract change.

Frozen-replay safe by construction: a pure function of already-computed
intervention_memory + source_metadata. Its own output is persisted
verbatim into input_snapshot as `population_profile_selection` and never
recomputed on a later read -- same posture as population_profiles.py's
own `population_profile_overlays`.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from app.services.population_profiles import (
    ATHLETE_RECOVERY,
    LONGEVITY_METABOLIC_OPTIMIZATION,
)
from app.services.population_profiles import _PROFILE_CONFIGS as _KNOWN_PROFILE_IDS


POPULATION_PROFILE_SELECTION_VERSION = "p24_3_v1"

_DEFAULT_PROFILE_IDS = [LONGEVITY_METABOLIC_OPTIMIZATION]

_TRAINING_EVENT_TYPE = "training"
# These event types are common and NOT athlete-specific on their own --
# only combined with explicit athletic/training language in the event's
# own text do they count as a strong signal.
_CONTEXT_EVENT_TYPES_REQUIRING_KEYWORD = {"sleep", "stress", "illness"}
_ATHLETE_KEYWORDS = [
    "training", "athlete", "athletic", "endurance", "marathon", "triathlon",
    "race", "competition", "workout", "training load", "recovery week",
]


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _event_text(event: Dict[str, Any]) -> str:
    return f"{event.get('label') or ''} {event.get('description') or ''}".strip().lower()


def _has_athlete_signal(intervention_memory: Dict[str, Any]) -> bool:
    events = (
        _safe_list(intervention_memory.get("active_interventions"))
        + _safe_list(intervention_memory.get("completed_interventions"))
    )
    for event in events:
        if not isinstance(event, dict):
            continue
        event_type = str(event.get("type") or "").strip().lower()
        if event_type == _TRAINING_EVENT_TYPE:
            return True
        if event_type in _CONTEXT_EVENT_TYPES_REQUIRING_KEYWORD:
            text = _event_text(event)
            if any(keyword in text for keyword in _ATHLETE_KEYWORDS):
                return True
    return False


def _validate_profile_ids(candidate_ids: List[Any]) -> Tuple[List[str], List[str]]:
    valid: List[str] = []
    invalid: List[str] = []
    for candidate in candidate_ids:
        candidate_id = str(candidate or "").strip()
        if not candidate_id:
            continue
        if candidate_id in _KNOWN_PROFILE_IDS:
            if candidate_id not in valid:
                valid.append(candidate_id)
        elif candidate_id not in invalid:
            invalid.append(candidate_id)
    return valid, invalid


def _result(
    active_profile_ids: List[str],
    selection_source: str,
    selection_reasons: List[Dict[str, Any]],
    ignored_profile_ids: List[str],
) -> Dict[str, Any]:
    return {
        "version": POPULATION_PROFILE_SELECTION_VERSION,
        "active_profile_ids": active_profile_ids,
        "selection_source": selection_source,
        "selection_reasons": selection_reasons,
        "ignored_profile_ids": ignored_profile_ids,
    }


def select_population_profiles(
    *,
    intervention_memory: Dict[str, Any] | None = None,
    source_metadata: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Never raises on missing/malformed input -- every field defaults to
    an empty container and the result always at least contains the
    default profile. Never mutates `intervention_memory` or
    `source_metadata`."""
    intervention_memory = _safe_dict(intervention_memory)
    source_metadata = _safe_dict(source_metadata)

    explicit_raw = source_metadata.get("population_profile_ids")
    explicit_requested = isinstance(explicit_raw, list) and len(explicit_raw) > 0

    if explicit_requested:
        valid_ids, invalid_ids = _validate_profile_ids(explicit_raw)
        active_profile_ids = valid_ids or list(_DEFAULT_PROFILE_IDS)
        selection_source = "explicit" if valid_ids else "default"

        selection_reasons: List[Dict[str, Any]] = [
            {"profile_id": pid, "reason_code": "explicit_request", "source": "source_metadata"}
            for pid in active_profile_ids
        ] if valid_ids else [
            {"profile_id": pid, "reason_code": "default_profile", "source": "default"}
            for pid in active_profile_ids
        ]
        selection_reasons += [
            {"profile_id": pid, "reason_code": "unknown_profile_id_ignored", "source": "source_metadata"}
            for pid in invalid_ids
        ]
        return _result(active_profile_ids, selection_source, selection_reasons, invalid_ids)

    # No explicit request: default longevity always active, plus
    # athlete_recovery if (and only if) a strong structured signal exists.
    active_profile_ids = list(_DEFAULT_PROFILE_IDS)
    selection_reasons = [
        {"profile_id": LONGEVITY_METABOLIC_OPTIMIZATION, "reason_code": "default_profile", "source": "default"}
    ]
    selection_source = "default"

    if _has_athlete_signal(intervention_memory):
        active_profile_ids.append(ATHLETE_RECOVERY)
        selection_reasons.append(
            {"profile_id": ATHLETE_RECOVERY, "reason_code": "training_context_present", "source": "intervention_memory"}
        )
        selection_source = "mixed"

    return _result(active_profile_ids, selection_source, selection_reasons, [])
