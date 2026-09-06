"""Typed result of the clinical analysis engine.

AnalysisResult — единый контракт между детерминированным движком и всем
остальным (pipeline-оркестратор, LLM, API-ответ, persistence).

Ключевой метод: context_for_llm() — собирает именно то, что нужно промпту
генератора протокола, решая проблему «context_snapshot → metadata, а не в промпт».
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class AnalysisResult:
    """Результат детерминированного клинического анализа.

    Не содержит LLM-вывода, persistence-артефактов, safety-санитизации.
    Это — то, что система точно знает ДО вызова LLM.
    """

    # Нормализованные биомаркеры (каждый — dict с name, canonical_name, value,
    # unit, ref_low, ref_high, reference_source, status, category)
    normalized_biomarkers: List[Dict[str, Any]]

    # Результат оценки KB-правил
    matched_rules: List[Dict[str, Any]]
    recommendation_keys: List[str]
    requires_doctor: bool

    # Safety alerts (critical thresholds)
    safety_alerts: List[Dict[str, Any]]

    # Уверенность
    confidence: float
    max_confidence: float

    # Marker coverage accounting
    marker_coverage: Dict[str, Any]
    unevaluated_markers: List[Dict[str, Any]]

    # Knowledge report (полный, не обрезанный)
    knowledge_report: Dict[str, Any]

    # Сгенерированные рекомендации из KB
    generated_recommendations: List[Dict[str, Any]] = field(default_factory=list)

    # Source references
    source_references: List[Dict[str, str]] = field(default_factory=list)

    # Nutrition context
    nutrition_context: Dict[str, Any] = field(default_factory=dict)

    # Rule evaluation IDs (если persist=True)
    rule_evaluation_ids: List[str] = field(default_factory=list)

    # Prioritized biomarkers (отсортированные по severity, без OPTIMAL)
    prioritized_biomarkers: List[Dict[str, Any]] = field(default_factory=list)

    # Risk flags (KB rules + lab range flags, deduplicated)
    risk_flags: List[Dict[str, Any]] = field(default_factory=list)

    def context_for_llm(self) -> Dict[str, Any]:
        """Контекст для LLM-промпта протокола.

        Это — ответ на проблему «context_snapshot собирается, но не передаётся
        в generate_protocol()». Вместо россыпи dict'ов LLM получает:
          - все сработавшие правила (название, severity, summary)
          - safety alerts
          - marker coverage summary
          - prioritized abnormal biomarkers
          - knowledge report headline + risk level
        """
        return {
            "engine_version": "clinical_engine_v1",
            "biomarker_count": len(self.normalized_biomarkers),
            "abnormal_count": sum(
                1 for b in self.normalized_biomarkers
                if b.get("status") in ("DEFICIENT", "ELEVATED", "BORDERLINE")
            ),
            "unknown_count": sum(
                1 for b in self.normalized_biomarkers
                if b.get("status") == "UNKNOWN"
            ),
            "matched_rules": [
                {
                    "rule_key": r.get("rule_key"),
                    "name": r.get("name"),
                    "severity": r.get("severity"),
                    "summary": r.get("summary"),
                    "requires_doctor": r.get("requires_doctor"),
                }
                for r in self.matched_rules
            ],
            "safety_alerts": [
                {
                    "marker": a.get("marker"),
                    "message": a.get("message"),
                }
                for a in self.safety_alerts
            ],
            "risk_flags": [
                {
                    "type": f.get("type"),
                    "severity": f.get("severity"),
                    "title": f.get("title"),
                    "biomarker": f.get("biomarker"),
                }
                for f in self.risk_flags[:12]
            ],
            "prioritized_abnormal": [
                {
                    "name": b["name"],
                    "canonical_name": b["canonical_name"],
                    "value": b["value"],
                    "unit": b["unit"],
                    "status": b["status"],
                    "priority": b.get("priority"),
                    "reference_range": b.get("reference_range"),
                }
                for b in self.prioritized_biomarkers[:12]
            ],
            "knowledge_headline": (self.knowledge_report.get("summary") or {}).get("headline"),
            "knowledge_risk_level": (self.knowledge_report.get("summary") or {}).get("risk_level"),
            "requires_doctor": self.requires_doctor,
            "confidence": self.confidence,
            "marker_coverage_summary": {
                "evaluated": len(self.marker_coverage.get("evaluated", [])),
                "fired": len(self.marker_coverage.get("fired", [])),
                "no_matching_rule": len(self.marker_coverage.get("no_matching_rule", [])),
                "unit_blocked": len(self.marker_coverage.get("unit_blocked", [])),
                "unknown_status": len(self.marker_coverage.get("unknown_status", [])),
            },
        }

    def to_dict(self) -> Dict[str, Any]:
        """Serialize для совместимости с существующим pipeline dict-контрактом."""
        return {
            "normalized_biomarkers": self.normalized_biomarkers,
            "matched_rules": self.matched_rules,
            "recommendation_keys": self.recommendation_keys,
            "requires_doctor": self.requires_doctor,
            "safety_alerts": self.safety_alerts,
            "confidence": self.confidence,
            "max_confidence": self.max_confidence,
            "marker_coverage": self.marker_coverage,
            "unevaluated_markers": self.unevaluated_markers,
            "knowledge_report": self.knowledge_report,
            "generated_recommendations": self.generated_recommendations,
            "source_references": self.source_references,
            "nutrition_context": self.nutrition_context,
            "rule_evaluation_ids": self.rule_evaluation_ids,
            "prioritized_biomarkers": self.prioritized_biomarkers,
            "risk_flags": self.risk_flags,
            "context_for_llm": self.context_for_llm(),
        }
