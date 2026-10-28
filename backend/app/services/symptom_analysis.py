"""P2 stable concept integration for symptom-check and lab analysis.

The module never matches clinical meaning from free text.  It accepts only
stable VITALOOP concept IDs plus reviewed domain keys from the immutable
symptom snapshot, then links those domains to hypotheses already produced by
the lab engine.  No new diagnosis or biomarker threshold is introduced here.
"""

from __future__ import annotations

import hashlib
import re
from copy import deepcopy
from typing import Any, Dict, Iterable, List


SYMPTOM_ANALYSIS_VERSION = "symptom_analysis_v1"
SYMPTOM_CONCEPT_MATRIX_VERSION = "symptom_concept_matrix_v1"

_DOMAIN_ALIASES = {
    "energy": "recovery_energy",
    "fatigue_low_energy": "recovery_energy",
    "sleep": "recovery_energy",
    "sleep_unrefreshing": "recovery_energy",
    "cognition": "micronutrients",
    "cognition_memory": "micronutrients",
    "hair_skin": "thyroid",
    "hair_skin_nails_temperature": "thyroid",
    "mood": "recovery_energy",
    "mood_stress": "recovery_energy",
    "pain": "inflammation",
    "pain_joints_inflammation": "inflammation",
    "digestion": "metabolic_health",
    "digestion_stool": "metabolic_health",
    "metabolic": "metabolic_health",
    "weight_appetite_thirst_urination": "metabolic_health",
    "palpitations_breathlessness_exercise": "cardiovascular",
    "muscle_weakness_cramps_numbness": "micronutrients",
    "menstrual_bleeding_reproductive": "iron_status",
}

# Controlled VITALOOP concepts. Provider concepts use reviewed domain_keys
# persisted by clinical_concept_mappings and do not depend on this fallback.
_CONTROLLED_CONCEPT_DOMAINS = {
    "fatigue": ("iron_status", "micronutrients", "recovery_energy"),
    "low_stamina": ("iron_status", "recovery_energy"),
    "post_activity_exhaustion": ("recovery_energy", "iron_status"),
    "general_weakness": ("iron_status", "micronutrients", "recovery_energy"),
    "difficulty_falling_asleep": ("recovery_energy",),
    "waking_during_the_night": ("recovery_energy",),
    "unrefreshing_sleep": ("recovery_energy", "thyroid"),
    "daytime_sleepiness": ("recovery_energy", "thyroid"),
    "brain_fog": ("micronutrients", "recovery_energy", "thyroid"),
    "poor_concentration": ("micronutrients", "recovery_energy"),
    "memory_difficulty": ("micronutrients", "thyroid"),
    "head_pressure": ("inflammation",),
    "bloating": ("metabolic_health",),
    "abdominal_discomfort": ("metabolic_health", "liver"),
    "bowel_changes": ("metabolic_health",),
    "food_related_symptoms": ("metabolic_health",),
    "hair_shedding": ("iron_status", "thyroid", "micronutrients"),
    "dry_skin": ("thyroid", "micronutrients"),
    "brittle_nails": ("iron_status", "micronutrients"),
    "skin_changes": ("thyroid", "micronutrients"),
    "low_mood": ("recovery_energy", "thyroid", "micronutrients"),
    "anxiety": ("recovery_energy", "thyroid"),
    "irritability": ("recovery_energy",),
    "high_stress_load": ("recovery_energy", "metabolic_health"),
    "muscle_pain": ("inflammation", "micronutrients"),
    "joint_pain": ("inflammation",),
    "headache": ("inflammation", "iron_status"),
    "general_aches": ("inflammation", "micronutrients"),
}


def _key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


def stable_unmapped_concept_id(label: Any) -> str:
    """Create a stable non-clinical ID without treating free text as meaning."""
    normalized = " ".join(str(label or "").strip().casefold().split())
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
    return f"unmapped_symptom_{digest}"


def _normalized_domains(item: Dict[str, Any]) -> List[str]:
    concept_id = _key(item.get("vitaloop_concept_id"))
    raw_domains = [str(value or "").strip().lower() for value in item.get("domain_keys") or []]
    if not raw_domains:
        raw_domains = list(_CONTROLLED_CONCEPT_DOMAINS.get(concept_id, ()))
    result: List[str] = []
    for domain in raw_domains:
        normalized = _DOMAIN_ALIASES.get(domain, domain)
        if normalized and normalized not in result:
            result.append(normalized)
    return result


def concepts_from_snapshot(snapshot: Dict[str, Any] | None) -> List[Dict[str, Any]]:
    evidence = (snapshot or {}).get("evidence")
    evidence = evidence if isinstance(evidence, dict) else {}
    concepts: List[Dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for choice in ("present", "absent", "unknown"):
        for item in evidence.get(choice) or []:
            if not isinstance(item, dict) or item.get("concept_type") == "positive_baseline":
                continue
            label = str(item.get("display_name_en") or "Symptom answer").strip()
            raw_id = str(item.get("vitaloop_concept_id") or "").strip()
            concept_id = raw_id or stable_unmapped_concept_id(label)
            identity = (concept_id, choice)
            if identity in seen:
                continue
            seen.add(identity)
            domains = _normalized_domains({**item, "vitaloop_concept_id": concept_id})
            mapping_status = str(item.get("mapping_status") or "").strip().lower()
            if concept_id.startswith("unmapped_symptom_"):
                mapping_status = "unmapped"
                domains = []
            elif not mapping_status:
                mapping_status = "mapped" if domains else "unmapped"
            concepts.append(
                {
                    "concept_id": concept_id,
                    "label": label,
                    "choice": choice,
                    "domains": domains,
                    "mapping_status": mapping_status,
                    "is_primary": bool(item.get("is_primary")),
                }
            )
    concepts.sort(key=lambda item: (not item["is_primary"], item["concept_id"], item["choice"]))
    return concepts


def _marker_id(item: Any) -> str:
    if isinstance(item, dict):
        value = item.get("canonical_name") or item.get("name") or item.get("marker")
    else:
        value = item
    return _key(str(value or "").removeprefix("canonical_"))


def _hypothesis_marker_ids(hypothesis: Dict[str, Any], available: set[str]) -> List[str]:
    result: List[str] = []
    for item in hypothesis.get("supporting_evidence") or []:
        marker_id = _marker_id(item)
        if marker_id and marker_id in available and marker_id not in result:
            result.append(marker_id)
    return result


def build_symptom_analysis(
    *,
    symptom_snapshot: Dict[str, Any] | None,
    hypotheses: Iterable[Dict[str, Any]] | None,
    biomarkers: Iterable[Dict[str, Any]] | None,
) -> Dict[str, Any]:
    concepts = concepts_from_snapshot(symptom_snapshot)
    hypothesis_rows = [item for item in hypotheses or [] if isinstance(item, dict)]
    available_markers = {_marker_id(item) for item in biomarkers or [] if _marker_id(item)}
    matrix: List[Dict[str, Any]] = []
    matched_hypothesis_ids: set[str] = set()
    linked_hypothesis_ids: set[str] = set()

    for concept in concepts:
        matches = []
        for hypothesis in hypothesis_rows:
            hypothesis_id = str(hypothesis.get("hypothesis_id") or "").strip()
            domain = str(hypothesis.get("domain") or "").strip().lower()
            if not hypothesis_id or domain not in concept["domains"]:
                continue
            marker_ids = _hypothesis_marker_ids(hypothesis, available_markers)
            matches.append(
                {
                    "hypothesis_id": hypothesis_id,
                    "domain": domain,
                    "confirming_marker_ids": marker_ids,
                }
            )
            if concept["choice"] in {"present", "absent"}:
                linked_hypothesis_ids.add(hypothesis_id)
            if concept["choice"] == "present":
                matched_hypothesis_ids.add(hypothesis_id)
        matrix.append(
            {
                "symptom_concept_id": concept["concept_id"],
                "symptom_label": concept["label"],
                "choice": concept["choice"],
                "mapping_status": concept["mapping_status"],
                "domains": concept["domains"],
                "hypotheses": matches,
                "effect": (
                    "raises_priority" if concept["choice"] == "present" and matches
                    else "limits_support" if concept["choice"] == "absent" and matches
                    else "no_matching_hypothesis"
                ),
            }
        )

    mapped = [item for item in concepts if item["mapping_status"] == "mapped"]
    if not symptom_snapshot:
        status = "no_symptom_snapshot"
    elif not concepts or not mapped:
        status = "no_mapped_concepts"
    elif not linked_hypothesis_ids:
        status = "no_matching_hypotheses"
    else:
        status = "applied"

    return {
        "version": SYMPTOM_ANALYSIS_VERSION,
        "matrix_version": SYMPTOM_CONCEPT_MATRIX_VERSION,
        "status": status,
        "source": {
            "snapshot_version": (symptom_snapshot or {}).get("version"),
            "session_id": (symptom_snapshot or {}).get("session_id"),
            "completed_at": (symptom_snapshot or {}).get("completed_at"),
        },
        "concepts": concepts,
        "matrix": matrix,
        "matched_hypothesis_ids": sorted(matched_hypothesis_ids),
        "linked_hypothesis_ids": sorted(linked_hypothesis_ids),
        "priority_effects": [],
        "conclusion_change": {
            "changed": False,
            "reason": "no_supported_symptom_hypothesis_connection",
            "explanations": [],
        },
    }


def apply_symptom_priority(
    hypotheses: Iterable[Dict[str, Any]] | None,
    symptom_analysis: Dict[str, Any] | None,
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Re-rank existing hypotheses by stable concept/domain alignment.

    Clinical confidence remains the calibrated engine score.  Symptom answers
    change presentation priority and wording, while their exact contribution
    stays visible in `symptom_priority` and `priority_effects`.
    """
    rows = [deepcopy(item) for item in hypotheses or [] if isinstance(item, dict)]
    analysis = deepcopy(symptom_analysis or {})
    matrix = analysis.get("matrix") if isinstance(analysis.get("matrix"), list) else []
    present_by_hypothesis: Dict[str, List[Dict[str, Any]]] = {}
    absent_by_hypothesis: Dict[str, List[Dict[str, Any]]] = {}
    for row in matrix:
        target = present_by_hypothesis if row.get("choice") == "present" else absent_by_hypothesis
        if row.get("choice") not in {"present", "absent"}:
            continue
        for match in row.get("hypotheses") or []:
            hypothesis_id = str(match.get("hypothesis_id") or "")
            if hypothesis_id:
                target.setdefault(hypothesis_id, []).append(row)

    baseline_rank = {
        str(item.get("hypothesis_id") or ""): int(item.get("rank") or index)
        for index, item in enumerate(rows, start=1)
    }
    for item in rows:
        hypothesis_id = str(item.get("hypothesis_id") or "")
        present = present_by_hypothesis.get(hypothesis_id, [])
        absent = absent_by_hypothesis.get(hypothesis_id, [])
        item["symptom_priority"] = {
            "supporting_concept_ids": [row["symptom_concept_id"] for row in present],
            "absent_concept_ids": [row["symptom_concept_id"] for row in absent],
            "support_count": len(present),
            "absence_count": len(absent),
            "changed_by_symptoms": bool(present or absent),
        }

    def _score(item: Dict[str, Any]) -> float:
        value = item.get("calibrated_score", item.get("confidence_score", 0.0))
        return float(value) if isinstance(value, (int, float)) else 0.0

    rows.sort(
        key=lambda item: (
            -(item.get("symptom_priority") or {}).get("support_count", 0),
            (item.get("symptom_priority") or {}).get("absence_count", 0),
            -_score(item),
            baseline_rank.get(str(item.get("hypothesis_id") or ""), 999),
            str(item.get("hypothesis_id") or ""),
        )
    )

    effects = []
    explanations = []
    for rank, item in enumerate(rows, start=1):
        hypothesis_id = str(item.get("hypothesis_id") or "")
        old_rank = baseline_rank.get(hypothesis_id, rank)
        item["rank"] = rank
        priority = item.get("symptom_priority") or {}
        concept_ids = priority.get("supporting_concept_ids") or []
        absent_concept_ids = priority.get("absent_concept_ids") or []
        if priority.get("changed_by_symptoms"):
            effect = {
                "hypothesis_id": hypothesis_id,
                "baseline_rank": old_rank,
                "symptom_adjusted_rank": rank,
                "rank_changed": old_rank != rank,
                "supporting_concept_ids": concept_ids,
                "absent_concept_ids": absent_concept_ids,
            }
            effects.append(effect)
            if concept_ids:
                explanations.append(
                    {
                        "hypothesis_id": hypothesis_id,
                        "symptom_concept_ids": concept_ids,
                        "message": "This explanation was prioritized because the reported symptom concepts align with its clinical domain.",
                    }
                )
            if absent_concept_ids:
                explanations.append(
                    {
                        "hypothesis_id": hypothesis_id,
                        "symptom_concept_ids": absent_concept_ids,
                        "effect": "deprioritized",
                        "message": "This explanation was deprioritized because the related symptom concepts were reported absent.",
                    }
                )

    changed = bool(explanations)
    analysis["priority_effects"] = effects
    analysis["conclusion_change"] = {
        "changed": changed,
        "reason": (
            "stable_symptom_answers_changed_explanation_priority"
            if changed else "no_supported_symptom_hypothesis_connection"
        ),
        "explanations": explanations,
    }
    return rows, analysis
