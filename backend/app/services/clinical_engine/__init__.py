"""ClinicalAnalysisEngine — единая точка входа для детерминированного анализа.

Заменяет разрозненную цепочку:
  biomarker_mapping → pipeline.normalize → integration.bio_to_lab →
  evaluator.evaluate → report.build → pipeline._risk_flags

на один вызов:
  engine = ClinicalAnalysisEngine()
  result = await engine.analyze(biomarkers, symptoms, ...)
  result.context_for_llm()  # для промпта LLM

Все I/O-операции (Supabase: загрузка правил, persist) управляются флагами.
Детерминированное ядро (нормализация, оценка, report) — чистые функции.

Обратная совместимость: старые модули остаются и делегируют сюда.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.services.clinical_engine.normalizer import (
    STATUS_PRIORITY,
    normalize_biomarkers,
)
from app.services.clinical_engine.marker_coverage import enrich_coverage
from app.services.clinical_engine.result import AnalysisResult
from app.services.clinical_engine.units import is_percentage_unit

# Re-exports for convenience
from app.services.clinical_engine.units import (  # noqa: F401
    normalize_unit,
    unit_matches,
    convert_value,
    display_unit,
    is_percentage_unit,
)
from app.services.clinical_engine.normalizer import (  # noqa: F401
    to_canonical_name,
    infer_category,
    is_metadata_field,
)
from app.services.clinical_engine.result import AnalysisResult  # noqa: F401

logger = logging.getLogger("uvicorn.error")

CLINICAL_ENGINE_VERSION = "clinical_engine_v1"


def _priority_for_status(status: str) -> str:
    if status in {"DEFICIENT", "ELEVATED"}:
        return "high"
    if status == "BORDERLINE":
        return "medium"
    return "low"


def prioritize_biomarkers(biomarkers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort biomarkers by severity, exclude OPTIMAL and UNKNOWN, return top 24."""
    ordered = sorted(
        biomarkers,
        key=lambda item: (
            STATUS_PRIORITY.get(str(item.get("status") or "BORDERLINE"), 9),
            str(item.get("category") or ""),
            str(item.get("name") or ""),
        ),
    )
    result: List[Dict[str, Any]] = []
    for item in ordered:
        status = str(item.get("status") or "BORDERLINE")
        # P0 Reference Safety Fix: Exclude statuses that must not be KB-classified as numeric abnormalities
        if status in ("OPTIMAL", "UNKNOWN", "UNEVALUATED"):
            continue
        result.append(
            {
                "name": item["name"],
                "canonical_name": item["canonical_name"],
                "value": item["value"],
                "unit": item["unit"],
                "status": status,
                "category": item.get("category"),
                "priority": _priority_for_status(status),
                "rationale": "Prioritized because the value is outside or near the provided reference range.",
                "reference_range": item.get("reference_range") or (
                    f"{item.get('ref_low')} - {item.get('ref_high')} {item.get('unit')}"
                    if item.get("ref_low") is not None and item.get("ref_high") is not None
                    else None
                ),
            }
        )
    return result[:24]


def build_risk_flags(
    knowledge_report: Dict[str, Any],
    prioritized: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Combine KB rule flags + lab reference-range flags, deduplicated."""
    flags: List[Dict[str, Any]] = []

    for alert in knowledge_report.get("safety_alerts") or []:
        if not isinstance(alert, dict):
            continue
        flags.append({
            "type": "safety_alert",
            "severity": "critical",
            "title": f"{alert.get('marker') or 'Marker'} requires medical review",
            "rationale": alert.get("message") or "Safety alert requires medical review.",
            "biomarker": alert.get("marker"),
            "requires_doctor": True,
        })

    for rule in knowledge_report.get("why_it_matters") or []:
        if not isinstance(rule, dict):
            continue
        flags.append({
            "type": "knowledge_rule",
            "severity": str(rule.get("severity") or "moderate"),
            "title": str(rule.get("title") or "Matched health pattern"),
            "rationale": str(rule.get("why_it_matters") or rule.get("summary") or ""),
            "biomarker": None,
            "requires_doctor": bool(rule.get("requires_doctor")),
        })

    # Lab reference-range flags — deduplicated against already-flagged biomarkers
    already_flagged = {str(flag.get("biomarker") or "").lower() for flag in flags}
    for item in prioritized:
        canonical = str(item["canonical_name"]).lower()
        if canonical in already_flagged:
            continue
        already_flagged.add(canonical)
        flags.append({
            "type": "biomarker_flag",
            "severity": item["priority"],
            "title": f"{item['name']} is {str(item['status']).lower()}",
            "rationale": item["rationale"],
            "biomarker": item["canonical_name"],
            "requires_doctor": item["priority"] == "high",
        })
    return flags[:24]


class ClinicalAnalysisEngine:
    """Единый детерминированный клинический анализатор.

    Использование:
        engine = ClinicalAnalysisEngine()
        result = await engine.analyze(
            biomarkers=[...],
            symptoms=[...],
            user_profile={...},
            locale="uk",
        )
        # Для LLM промпта:
        llm_context = result.context_for_llm()
    """

    version = CLINICAL_ENGINE_VERSION

    async def analyze(
        self,
        *,
        biomarkers: List[Dict[str, Any]],
        symptoms: Optional[List[str]] = None,
        user_profile: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        upload_id: Optional[str] = None,
        locale: str = "en",
        name_aliases: Optional[Dict[str, str]] = None,
        persist: bool = False,
    ) -> AnalysisResult:
        """Run the full deterministic clinical analysis.

        Steps:
          1. normalize_biomarkers (canonical names, units, reference ranges, status)
          2. biomarkers_to_knowledge_lab_results (bridge to evaluator input)
          3. load KB rules from Supabase
          4. evaluate_input_with_rules (deterministic rule matching)
          5. evaluate_health_input (async: recommendations, safety, confidence)
          6. build_knowledge_report
          7. prioritize + risk_flags
          8. marker_coverage enrichment
          9. Pack into AnalysisResult
        """
        from app.services.knowledge.integration import (
            biomarkers_to_knowledge_lab_results,
            evaluate_biomarkers_with_knowledge,
        )
        from app.services.knowledge.report import build_knowledge_report

        # Step 1: Normalize (with sex/age-aware reference ranges)
        user_sex = None
        user_age = None
        if user_profile:
            user_sex = str(user_profile.get("sex") or "").strip().lower() or None
            user_age = user_profile.get("age")
            if user_age is not None:
                try:
                    user_age = int(user_age)
                except (TypeError, ValueError):
                    user_age = None

        normalized = normalize_biomarkers(
            biomarkers,
            name_aliases=name_aliases,
            sex=user_sex,
            age=user_age,
        )
        normalized_symptoms = [
            str(s).strip().lower() for s in (symptoms or []) if str(s).strip()
        ]

        # Step 2-5: Evaluate with KB (loads rules, evaluates, generates recommendations)
        knowledge_evaluation = await evaluate_biomarkers_with_knowledge(
            biomarkers=normalized,
            symptoms=normalized_symptoms,
            user_id=user_id,
            upload_id=upload_id,
            user_profile=user_profile,
            health_context={},  # Will be built by the pipeline orchestrator
            persist=persist,
        )
        knowledge_evaluation = knowledge_evaluation if isinstance(knowledge_evaluation, dict) else {}

        # Step 6: Build knowledge report
        knowledge_report = build_knowledge_report(
            biomarkers=normalized,
            knowledge_evaluation=knowledge_evaluation,
            locale=locale,
            user_profile=user_profile,
        )

        # Step 7: Prioritize + risk flags
        prioritized = prioritize_biomarkers(normalized)
        risk_flags = build_risk_flags(knowledge_report, prioritized)

        # Step 8: Enrich marker coverage
        raw_coverage = knowledge_evaluation.get("marker_coverage", {})
        marker_coverage = enrich_coverage(raw_coverage, normalized)

        return AnalysisResult(
            normalized_biomarkers=normalized,
            matched_rules=knowledge_evaluation.get("matched_rules", []),
            recommendation_keys=knowledge_evaluation.get("recommendation_keys", []),
            requires_doctor=bool(knowledge_evaluation.get("requires_doctor"))
                or bool(knowledge_evaluation.get("safety_alerts")),
            safety_alerts=knowledge_evaluation.get("safety_alerts", []),
            confidence=knowledge_evaluation.get("confidence", 0.0),
            max_confidence=knowledge_evaluation.get("max_confidence", 0.0),
            marker_coverage=marker_coverage,
            unevaluated_markers=knowledge_evaluation.get("unevaluated_markers", []),
            knowledge_report=knowledge_report,
            generated_recommendations=knowledge_evaluation.get("generated_recommendations", []),
            source_references=knowledge_evaluation.get("source_references", []),
            nutrition_context=knowledge_evaluation.get("nutrition_context", {}),
            rule_evaluation_ids=knowledge_evaluation.get("rule_evaluation_ids", []),
            prioritized_biomarkers=prioritized,
            risk_flags=risk_flags,
        )
