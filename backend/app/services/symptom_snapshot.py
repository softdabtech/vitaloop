"""Immutable symptom context captured at lab-analysis generation time.

The symptom interview remains mutable while it is in progress.  This module
creates a detached, normalized value only from a completed interview.  The
pipeline embeds that value in an append-only report version, so a later
interview can never change the clinical context of an earlier report.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from app.services import supabase_service as svc
from app.services.symptom_safety_policy import map_provider_triage


SYMPTOM_SNAPSHOT_VERSION = "symptom_snapshot_v1"

CONTROLLED_SYMPTOM_SIGNALS = {
    "energy": {"fatigue": "Fatigue", "low_stamina": "Low stamina", "post_activity_exhaustion": "Post-activity exhaustion", "general_weakness": "General weakness"},
    "sleep": {"difficulty_falling_asleep": "Difficulty falling asleep", "waking_during_the_night": "Waking during the night", "unrefreshing_sleep": "Unrefreshing sleep", "daytime_sleepiness": "Daytime sleepiness"},
    "cognition": {"brain_fog": "Brain fog", "poor_concentration": "Poor concentration", "memory_difficulty": "Memory difficulty", "head_pressure": "Head pressure"},
    "digestion": {"bloating": "Bloating", "abdominal_discomfort": "Abdominal discomfort", "bowel_changes": "Bowel changes", "food_related_symptoms": "Food-related symptoms"},
    "hair_skin": {"hair_shedding": "Hair shedding", "dry_skin": "Dry skin", "brittle_nails": "Brittle nails", "skin_changes": "Skin changes"},
    "mood": {"low_mood": "Low mood", "anxiety": "Anxiety", "irritability": "Irritability", "high_stress_load": "High stress load"},
    "pain": {"muscle_pain": "Muscle pain", "joint_pain": "Joint pain", "headache": "Headache", "general_aches": "General aches"},
}
_CONTROLLED_ENUMS = {
    "overall_wellbeing": {"good", "mostly_good", "reduced", "poor"},
    "duration_bucket": {"today", "days_2_7", "weeks_1_4", "months_1_3", "months_3_plus", "intermittent", "unknown"},
    "symptom_pattern": {"improving", "stable", "worsening", "intermittent"},
    "functional_impact": {"none", "mild", "moderate", "severe"},
    "domain_detail": {"present", "absent", "unknown"},
    "urgent_warning": {"present", "absent", "unknown"},
}

_B2C_SOURCES = {
    "legacy_multipart_pdf",
    "candidate_quality_review",
    "candidate_confirmation",
    "results_read",
    "report_regeneration",
    "results_compatibility",
}


def should_load_symptom_snapshot(source_metadata: dict[str, Any] | None) -> bool:
    source = str((source_metadata or {}).get("source") or "").strip().lower()
    return source.startswith("b2c_") or source in _B2C_SOURCES


def _evidence_item(row: dict[str, Any]) -> dict[str, Any]:
    """Allowlist stable clinical facts; never copy provider payloads."""
    return {
        "vitaloop_concept_id": row.get("vitaloop_concept_id"),
        "provider_concept_id": row.get("provider_concept_id"),
        "display_name_en": row.get("display_name_en"),
        "concept_type": row.get("concept_type"),
        "mapping_status": row.get("mapping_status"),
        "is_primary": bool(row.get("is_primary")),
        "source": row.get("source"),
        "domain_keys": sorted(
            {str(key).strip() for key in (row.get("domain_keys") or []) if str(key).strip()}
        ),
    }


def build_symptom_snapshot(
    *, session: dict[str, Any], evidence: list[dict[str, Any]]
) -> dict[str, Any] | None:
    """Build a detached snapshot, or ``None`` for an ineligible session."""
    if str(session.get("status") or "") != "completed" or not session.get("completed_at"):
        return None

    grouped: dict[str, list[dict[str, Any]]] = {
        "present": [],
        "absent": [],
        "unknown": [],
    }
    for row in evidence:
        choice = str(row.get("choice_id") or "")
        if choice in grouped:
            grouped[choice].append(_evidence_item(row))
    for items in grouped.values():
        items.sort(
            key=lambda item: (
                not item["is_primary"],
                str(item.get("vitaloop_concept_id") or ""),
            )
        )

    provider_level = map_provider_triage(session.get("provider_triage_level")).value
    snapshot = {
        "version": SYMPTOM_SNAPSHOT_VERSION,
        "source_type": session.get("source_type") or "provider_symptom_check",
        "session_id": session.get("id"),
        "questionnaire_version": session.get("questionnaire_version"),
        "provider": session.get("provider"),
        "provider_model": session.get("provider_model"),
        "provider_model_version": session.get("provider_model_version"),
        "root_concern_id": session.get("root_concern_id"),
        "primary_concern": {
            "vitaloop_concept_id": session.get("primary_concept_id"),
            "provider_concept_id": session.get("primary_provider_concept_id"),
        },
        "overall_wellbeing": session.get("overall_wellbeing"),
        "duration_bucket": session.get("duration_bucket"),
        "assessment": {
            "severity": session.get("severity"),
            "trajectory": session.get("trajectory"),
            "functional_impact": session.get("functional_impact"),
            "domain_detail": session.get("domain_detail"),
            "urgent_warning": session.get("urgent_warning"),
        },
        "evidence": grouped,
        "triage": {
            "provider_level": session.get("provider_triage_level"),
            "root_cause": session.get("provider_triage_root_cause"),
        },
        "safety": {
            "internal_level": session.get("internal_safety_level") or "insufficient_data",
            "provider_level": session.get("provider_safety_level") or provider_level,
            "final_level": session.get("final_safety_level") or "insufficient_data",
        },
        "completed_at": session.get("completed_at"),
    }
    return deepcopy(snapshot)


def _controlled_summary(session: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(session, dict):
        return None
    metadata = session.get("session_metadata") if isinstance(session.get("session_metadata"), dict) else {}
    summary = metadata.get("summary") if isinstance(metadata.get("summary"), dict) else {}
    if (
        summary.get("schema_version") != "controlled_symptom_fallback_v1"
        or summary.get("input_mode") != "controlled_only"
    ):
        return None
    concern_id = str(summary.get("primary_concern_id") or "")
    concept_id = str(summary.get("primary_concept_id") or "")
    signals = CONTROLLED_SYMPTOM_SIGNALS.get(concern_id) or {}
    if not concept_id or concept_id not in signals or summary.get("primary_signal") != signals[concept_id]:
        return None
    if any(summary.get(field) not in allowed for field, allowed in _CONTROLLED_ENUMS.items()):
        return None
    answers = summary.get("controlled_answers")
    if not isinstance(answers, dict) or set(answers) != {
        "severity", "trajectory", "functional_impact", "domain_detail", "urgent_warning"
    }:
        return None
    expected_severity = {"mild": 3, "moderate": 6, "severe": 9}.get(answers.get("severity"))
    if (
        expected_severity != summary.get("severity")
        or answers.get("trajectory") != summary.get("symptom_pattern")
        or answers.get("functional_impact") != summary.get("functional_impact")
        or answers.get("domain_detail") != summary.get("domain_detail")
        or answers.get("urgent_warning") != summary.get("urgent_warning")
    ):
        return None
    related = summary.get("related_symptoms") or []
    related_ids = summary.get("related_concept_ids") or []
    if (
        not isinstance(related, list)
        or not isinstance(related_ids, list)
        or len(related) != len(related_ids)
        or len(related) > 2
        or any(item == concept_id or item not in signals for item in related_ids)
        or [signals[item] for item in related_ids] != related
    ):
        return None
    return summary


def build_controlled_questionnaire_snapshot(session: dict[str, Any]) -> dict[str, Any] | None:
    """Normalize only the controlled fallback of the new symptom checker."""
    if str(session.get("status") or "") != "completed" or not session.get("completed_at"):
        return None
    summary = _controlled_summary(session)
    if not summary:
        return None
    concern_id = str(summary["primary_concern_id"])
    signals = CONTROLLED_SYMPTOM_SIGNALS[concern_id]
    primary_id = str(summary["primary_concept_id"])
    related_ids = [str(item) for item in (summary.get("related_concept_ids") or [])]
    concepts = [(primary_id, signals[primary_id]), *[(concept_id, signals[concept_id]) for concept_id in related_ids if concept_id != primary_id]]
    evidence = [
        {
            "vitaloop_concept_id": concept_id,
            "provider_concept_id": None,
            "display_name_en": label,
            "concept_type": "symptom",
            "choice_id": "present",
            "source": "controlled_questionnaire",
            "is_primary": index == 0,
            "domain_keys": [concern_id],
            "mapping_status": "mapped",
        }
        for index, (concept_id, label) in enumerate(dict.fromkeys(concepts))
    ]
    urgent = summary.get("urgent_warning")
    if urgent is None:
        urgency_text = str(summary.get("urgency") or "").lower()
        urgent = "present" if "timely clinician" in urgency_text or "do not delay" in urgency_text else "absent"
    normalized_session = {
        "id": session.get("id"),
        "source_type": "controlled_symptom_check",
        "status": "completed",
        "completed_at": session.get("completed_at"),
        "questionnaire_version": summary.get("schema_version") or session.get("model_version") or "questionnaire_v2",
        "provider": "vitaloop_controlled" if summary.get("schema_version") == "controlled_symptom_fallback_v1" else "vitaloop_legacy",
        "root_concern_id": summary.get("primary_concern_id") or summary.get("bodySystem") or summary.get("body_system"),
        "primary_concept_id": summary.get("primary_concept_id"),
        "overall_wellbeing": summary.get("overall_wellbeing"),
        "duration_bucket": summary.get("duration_bucket") or summary.get("duration"),
        "severity": summary.get("severity"),
        "trajectory": summary.get("symptom_pattern") or summary.get("symptomPattern"),
        "functional_impact": summary.get("functional_impact") or summary.get("functionalImpact"),
        "domain_detail": summary.get("domain_detail"),
        "urgent_warning": urgent,
        "internal_safety_level": "urgent" if urgent == "present" else "routine",
        "final_safety_level": "urgent" if urgent == "present" else "routine",
    }
    return build_symptom_snapshot(session=normalized_session, evidence=evidence)


def build_legacy_questionnaire_snapshot(session: dict[str, Any]) -> dict[str, Any] | None:
    """Compatibility alias; unstructured legacy questionnaires are rejected."""
    return build_controlled_questionnaire_snapshot(session)


def _completed_at(value: dict[str, Any] | None) -> datetime:
    raw = str((value or {}).get("completed_at") or "").replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(raw)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


async def load_latest_eligible_symptom_snapshot(user_id: str) -> dict[str, Any] | None:
    """Load the newest completed interview owned by ``user_id``."""
    supabase = svc._get_supabase()
    # The provider-backed symptom tables are optional while the controlled
    # questionnaire is the production fallback.  A deployment with
    # INFERMEDICA_ENABLED=false must therefore keep report generation working
    # even before those optional migrations have been applied.
    try:
        response = await svc._run(
            lambda: supabase.table("symptom_check_sessions")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .order("completed_at", desc=True)
            .limit(1)
            .execute()
        )
        provider_session = (response.data or [None])[0]
    except Exception as exc:
        message = str(exc)
        if "PGRST205" not in message or "symptom_check_sessions" not in message:
            raise
        provider_session = None
    controlled_response = await svc._run(
        lambda: supabase.table("questionnaire_sessions")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(20)
        .execute()
    )
    controlled_session = next(
        (item for item in (controlled_response.data or []) if _controlled_summary(item)),
        None,
    )
    if controlled_session and _completed_at(controlled_session) > _completed_at(provider_session):
        return build_controlled_questionnaire_snapshot(controlled_session)
    if not provider_session:
        return build_controlled_questionnaire_snapshot(controlled_session) if controlled_session else None
    session = {**provider_session, "source_type": "provider_symptom_check"}
    evidence_response = await svc._run(
        lambda: supabase.table("symptom_evidence")
        .select(
            "vitaloop_concept_id,provider_concept_id,display_name_en,concept_type,"
            "choice_id,source,is_primary,question_sequence"
        )
        .eq("session_id", session["id"])
        .eq("user_id", user_id)
        .order("question_sequence")
        .execute()
    )
    evidence = evidence_response.data or []
    concept_ids = sorted(
        {
            str(row.get("vitaloop_concept_id"))
            for row in evidence
            if row.get("vitaloop_concept_id")
        }
    )
    domains_by_concept: dict[str, list[str]] = {}
    if concept_ids:
        mapping_response = await svc._run(
            lambda: supabase.table("clinical_concept_mappings")
            .select("vitaloop_concept_id,domain_keys")
            .in_("vitaloop_concept_id", concept_ids)
            .eq("active", True)
            .eq("review_status", "approved")
            .execute()
        )
        for row in mapping_response.data or []:
            concept_id = str(row.get("vitaloop_concept_id") or "")
            domains_by_concept.setdefault(concept_id, []).extend(row.get("domain_keys") or [])
    enriched = [
        {
            **row,
            "domain_keys": sorted(set(domains_by_concept.get(str(row.get("vitaloop_concept_id")), []))),
        }
        for row in evidence
    ]
    return build_symptom_snapshot(session=session, evidence=enriched)


def symptoms_from_snapshot(snapshot: dict[str, Any] | None) -> list[str]:
    """Return mapped stable concept IDs from present evidence only."""
    evidence = (snapshot or {}).get("evidence")
    present = evidence.get("present") if isinstance(evidence, dict) else []
    result: list[str] = []
    seen: set[str] = set()
    for item in present or []:
        if not isinstance(item, dict) or item.get("concept_type") == "positive_baseline":
            continue
        concept_id = str(item.get("vitaloop_concept_id") or "").strip()
        if item.get("mapping_status") == "unmapped" or concept_id.startswith("unmapped_symptom_"):
            continue
        key = concept_id.casefold()
        if concept_id and key not in seen:
            seen.add(key)
            result.append(concept_id)
    return result


def public_symptom_snapshot(snapshot: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return a client-safe projection while preserving clinical choices."""
    if not isinstance(snapshot, dict):
        return None
    result = deepcopy(snapshot)
    result.pop("provider_model", None)
    result.pop("provider_model_version", None)
    primary = result.get("primary_concern")
    if isinstance(primary, dict):
        primary.pop("provider_concept_id", None)
    evidence = result.get("evidence")
    if isinstance(evidence, dict):
        for items in evidence.values():
            for item in items if isinstance(items, list) else []:
                if isinstance(item, dict):
                    item.pop("provider_concept_id", None)
    return result


def redact_report_version_symptom_snapshot(report_version: Any) -> Any:
    """Redact provider identifiers from a report row returned to a client."""
    if not isinstance(report_version, dict):
        return report_version
    result = deepcopy(report_version)
    input_snapshot = result.get("input_snapshot")
    if isinstance(input_snapshot, dict) and "symptom_snapshot" in input_snapshot:
        input_snapshot["symptom_snapshot"] = public_symptom_snapshot(
            input_snapshot.get("symptom_snapshot")
        )
    return result
