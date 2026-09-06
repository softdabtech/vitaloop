"""Tests for the consolidated ClinicalAnalysisEngine.

Covers:
  1. Unit normalization (single source of truth in clinical_engine.units)
  2. Normalizer producing UNKNOWN status for markers without reference
  3. ClinicalAnalysisEngine.analyze() end-to-end
  4. AnalysisResult.context_for_llm() structure and completeness
  5. Backward compatibility: pipeline delegating functions still work
  6. Marker coverage enrichment with unknown_status
  7. Risk flags and prioritization via the engine
"""

import pytest
import asyncio
from typing import Any, Dict, List

from app.services.clinical_engine.units import (
    normalize_unit,
    unit_matches,
    convert_value,
    display_unit,
    is_percentage_unit,
)
from app.services.clinical_engine.normalizer import (
    normalize_biomarkers,
    to_canonical_name,
    STATUS_PRIORITY,
)
from app.services.clinical_engine.marker_coverage import enrich_coverage
from app.services.clinical_engine import (
    ClinicalAnalysisEngine,
    prioritize_biomarkers,
    build_risk_flags,
)
from app.services.clinical_engine.result import AnalysisResult
from app.services.clinical_engine.biomarker_translator import (
    translate_biomarker_name,
    is_localized_name,
    translate_biomarkers_in_panel,
)


# ---------------------------------------------------------------------------
# 0. Biomarker Translator: Ukrainian/Russian to English
# ---------------------------------------------------------------------------


class TestBiomarkerTranslator:
    def test_translate_ukrainian_alt(self):
        assert translate_biomarker_name("аланін амінотрансфераза") == "alanine aminotransferase"
        assert translate_biomarker_name("АЛТ") == "alanine aminotransferase"
        assert translate_biomarker_name("альт") == "alanine aminotransferase"

    def test_translate_ukrainian_ast(self):
        assert translate_biomarker_name("аспартат амінотрансфераза") == "aspartate aminotransferase"
        assert translate_biomarker_name("АСТ") == "aspartate aminotransferase"

    def test_translate_ukrainian_bilirubin(self):
        assert translate_biomarker_name("білірубін загальний") == "total bilirubin"
        assert translate_biomarker_name("білірубін прямий") == "direct bilirubin"
        assert translate_biomarker_name("білірубін непрямий") == "indirect bilirubin"

    def test_translate_ukrainian_albumin(self):
        assert translate_biomarker_name("альбумін") == "albumin"

    def test_translate_ukrainian_total_protein(self):
        assert translate_biomarker_name("білок загальний") == "total protein"

    def test_translate_russian_alt(self):
        # Russian variants should also work
        result = translate_biomarker_name("аланинаминотрансфераза")
        assert "alanine" in result.lower()

    def test_translate_ggt(self):
        assert translate_biomarker_name("гамма-глутамат трансфераза") == "gamma-glutamyl transferase"
        assert translate_biomarker_name("ггт") == "gamma-glutamyl transferase"

    def test_translate_crp(self):
        assert translate_biomarker_name("c-реактивний білок") == "c-reactive protein"
        assert translate_biomarker_name("c-реактивный белок") == "c-reactive protein"

    def test_translate_hemoglobin(self):
        assert translate_biomarker_name("гемоглобін") == "hemoglobin"

    def test_translate_glucose(self):
        assert translate_biomarker_name("глюкоза") == "glucose"

    def test_translate_english_passthrough(self):
        # English names should pass through unchanged
        assert translate_biomarker_name("hemoglobin") == "hemoglobin"
        assert translate_biomarker_name("glucose") == "glucose"

    def test_is_localized_name_cyrillic(self):
        assert is_localized_name("альбумін")
        assert is_localized_name("АЛТ")
        assert is_localized_name("гемоглобін")

    def test_is_localized_name_english(self):
        assert not is_localized_name("albumin")
        assert not is_localized_name("hemoglobin")

    def test_translate_biomarkers_in_panel(self):
        raw = [
            {"name": "альбумін", "value": 46.49, "unit": "g/l"},
            {"name": "гемоглобін", "value": 135, "unit": "g/l"},
            {"name": "hemoglobin", "value": 135, "unit": "g/l"},
        ]
        result = translate_biomarkers_in_panel(raw)
        assert result[0]["name"] == "albumin"
        assert result[1]["name"] == "hemoglobin"
        assert result[2]["name"] == "hemoglobin"  # English passed through
        assert result[0]["original_name"] == "альбумін"  # Original preserved


# ---------------------------------------------------------------------------
# 1. Units: single source of truth
# ---------------------------------------------------------------------------


class TestUnits:
    def test_cyrillic_transliteration(self):
        assert normalize_unit("г/л") == "g/l"
        assert normalize_unit("ммоль/л") == "mmol/l"
        assert normalize_unit("мкмоль/л") == "umol/l"

    def test_vendor_synonyms(self):
        assert normalize_unit("10^9 cells/L") == "10^9/l"
        assert normalize_unit("x10^3/µL") == "10^9/l"
        assert normalize_unit("mm/hr") == "mm/h"
        assert normalize_unit("mIU/L") == "uiu/ml"

    def test_unit_matches_identical(self):
        assert unit_matches("g/L", "g/L")
        assert unit_matches("10^9 cells/L", "10^9/L")
        assert unit_matches("г/л", "g/L")

    def test_unit_matches_none_expected(self):
        assert unit_matches("anything", None)

    def test_unit_matches_none_actual(self):
        assert not unit_matches(None, "g/L")

    def test_convert_value_same_unit(self):
        assert convert_value("hemoglobin", 14.5, "g/dL", "g/dL") == 14.5

    def test_convert_value_known_pair(self):
        result = convert_value("hemoglobin", 14.5, "g/dL", "g/L")
        assert result == pytest.approx(145.0)

    def test_convert_value_inverse(self):
        result = convert_value("hemoglobin", 145.0, "g/L", "g/dL")
        assert result == pytest.approx(14.5)

    def test_convert_value_inline_glucose(self):
        result = convert_value("glucose", 5.5, "mmol/L", "mg/dL")
        assert result == pytest.approx(99.0)

    def test_convert_value_unknown_returns_none(self):
        assert convert_value("hemoglobin", 14.5, "g/dL", "fish/pond") is None

    def test_percentage_never_converts(self):
        assert convert_value("lymphocytes", 38.0, "%", "10^9/L") is None

    def test_is_percentage_unit(self):
        assert is_percentage_unit("%")
        assert is_percentage_unit("％")
        assert is_percentage_unit("pct")
        assert not is_percentage_unit("g/L")

    def test_display_unit(self):
        assert display_unit("mg/dl") == "mg/dL"
        assert display_unit("uiu/ml") == "uIU/mL"
        assert display_unit("g/L") == "g/L"  # already fine

    def test_normalize_is_idempotent(self):
        for u in ["г/л", "10^9 cells/L", "mIU/L", "mm/hr", "%"]:
            once = normalize_unit(u)
            twice = normalize_unit(once)
            assert once == twice, f"Not idempotent for {u}: {once} != {twice}"


# ---------------------------------------------------------------------------
# 2. Normalizer: UNKNOWN status
# ---------------------------------------------------------------------------


class TestNormalizerUnknownStatus:
    def test_marker_without_any_reference_gets_unknown(self):
        result = normalize_biomarkers([
            {"name": "Ceruloplasmin", "value": 0.31, "unit": "g/L"},
        ])
        assert result[0]["status"] == "UNKNOWN"
        assert result[0]["reference_source"] is None

    def test_marker_with_lab_range_gets_proper_status(self):
        """Lab-reported ranges ALWAYS produce clinical status (not UNEVALUATED)."""
        result = normalize_biomarkers([
            {"name": "Hemoglobin", "value": 118, "unit": "g/L", "ref_low": 120, "ref_high": 160},
        ])
        assert result[0]["status"] == "DEFICIENT"
        assert result[0]["reference_source"] == "lab_report"
        # Lab ranges should NOT have unevaluated_reason
        assert "unevaluated_reason" not in result[0]

    def test_marker_with_fallback_range_gets_proper_status(self):
        """Fallback ranges are UNVERIFIED, so status should be UNEVALUATED."""
        result = normalize_biomarkers([
            {"name": "C-Reactive Protein", "value": 1.52, "unit": "mg/L"},
        ])
        # ⚠️  SAFETY: Fallback ranges are unverified (no source URL/version/date)
        # They must NOT produce clinical status classification
        assert result[0]["status"] == "UNEVALUATED"
        assert result[0]["reference_source"] == "vitaloop_reference_table"
        assert result[0]["unevaluated_reason"] == "unverified_reference_interval"

    def test_unknown_status_is_in_priority(self):
        assert "UNKNOWN" in STATUS_PRIORITY
        assert STATUS_PRIORITY["UNKNOWN"] > STATUS_PRIORITY["BORDERLINE"]
        assert STATUS_PRIORITY["UNKNOWN"] < STATUS_PRIORITY["OPTIMAL"]

    def test_unevaluated_status_is_in_priority(self):
        """UNEVALUATED status for unverified fallback ranges."""
        assert "UNEVALUATED" in STATUS_PRIORITY
        assert STATUS_PRIORITY["UNEVALUATED"] == STATUS_PRIORITY["UNKNOWN"]


# ---------------------------------------------------------------------------
# 3. Marker coverage enrichment
# ---------------------------------------------------------------------------


class TestMarkerCoverage:
    def test_enrich_adds_unknown_status(self):
        raw_coverage = {
            "evaluated": ["tsh"],
            "fired": ["tsh"],
            "no_matching_rule": [],
            "unit_blocked": [],
        }
        biomarkers = [
            {"canonical_name": "canonical_tsh", "status": "ELEVATED"},
            {"canonical_name": "canonical_ceruloplasmin", "status": "UNKNOWN"},
        ]
        enriched = enrich_coverage(raw_coverage, biomarkers)
        assert enriched["unknown_status"] == ["canonical_ceruloplasmin"]
        assert enriched["evaluated"] == ["tsh"]  # untouched


# ---------------------------------------------------------------------------
# 4. Prioritization and risk flags via engine
# ---------------------------------------------------------------------------


class TestPrioritizeAndRiskFlags:
    def test_unknown_excluded_from_prioritized(self):
        biomarkers = [
            {"name": "X", "canonical_name": "x", "value": 1, "unit": "g/L", "status": "UNKNOWN", "category": "other"},
            {"name": "Y", "canonical_name": "y", "value": 2, "unit": "g/L", "status": "ELEVATED", "category": "other"},
        ]
        result = prioritize_biomarkers(biomarkers)
        assert len(result) == 1
        assert result[0]["canonical_name"] == "y"

    def test_risk_flags_combine_kb_and_lab(self):
        kr = {
            "safety_alerts": [],
            "why_it_matters": [
                {"rule_key": "r1", "severity": "moderate", "title": "TSH elevated", "summary": "x"}
            ],
        }
        prioritized = [
            {"name": "LDL", "canonical_name": "ldl", "value": 105, "unit": "mg/dL",
             "status": "ELEVATED", "priority": "high", "rationale": "Out of range"},
        ]
        flags = build_risk_flags(kr, prioritized)
        types = {f["type"] for f in flags}
        assert "knowledge_rule" in types
        assert "biomarker_flag" in types

    def test_risk_flags_deduplication(self):
        kr = {
            "safety_alerts": [{"marker": "ldl", "message": "Critical"}],
            "why_it_matters": [],
        }
        prioritized = [
            {"name": "LDL", "canonical_name": "ldl", "value": 200, "unit": "mg/dL",
             "status": "ELEVATED", "priority": "high", "rationale": "Out of range"},
        ]
        flags = build_risk_flags(kr, prioritized)
        ldl_flags = [f for f in flags if str(f.get("biomarker") or "").lower() == "ldl"]
        assert len(ldl_flags) == 1
        assert ldl_flags[0]["type"] == "safety_alert"


# ---------------------------------------------------------------------------
# 5. AnalysisResult and context_for_llm
# ---------------------------------------------------------------------------


class TestAnalysisResult:
    def _make_result(self, **overrides) -> AnalysisResult:
        defaults = {
            "normalized_biomarkers": [
                {"name": "TSH", "canonical_name": "tsh", "value": 5.8, "unit": "uIU/mL",
                 "status": "ELEVATED", "ref_low": 0.4, "ref_high": 4.0, "reference_source": "vitaloop_reference_table"},
            ],
            "matched_rules": [
                {"rule_key": "rule_high_tsh", "name": "High TSH", "severity": "moderate",
                 "summary": "TSH elevated", "requires_doctor": False},
            ],
            "recommendation_keys": ["thyroid_followup"],
            "requires_doctor": False,
            "safety_alerts": [],
            "confidence": 0.85,
            "max_confidence": 0.85,
            "marker_coverage": {"evaluated": ["tsh"], "fired": ["tsh"], "no_matching_rule": [], "unit_blocked": [], "unknown_status": []},
            "unevaluated_markers": [],
            "knowledge_report": {"summary": {"headline": "1 biomarker found. 1 needs review.", "risk_level": "needs_attention"}},
            "prioritized_biomarkers": [
                {"name": "TSH", "canonical_name": "tsh", "value": 5.8, "unit": "uIU/mL",
                 "status": "ELEVATED", "priority": "high", "reference_range": "0.4 - 4.0 uIU/mL"},
            ],
            "risk_flags": [
                {"type": "knowledge_rule", "severity": "moderate", "title": "High TSH", "biomarker": None},
            ],
        }
        defaults.update(overrides)
        return AnalysisResult(**defaults)

    def test_context_for_llm_structure(self):
        result = self._make_result()
        ctx = result.context_for_llm()
        assert ctx["engine_version"] == "clinical_engine_v1"
        assert ctx["biomarker_count"] == 1
        assert ctx["abnormal_count"] == 1
        assert len(ctx["matched_rules"]) == 1
        assert ctx["matched_rules"][0]["rule_key"] == "rule_high_tsh"
        assert ctx["knowledge_headline"] == "1 biomarker found. 1 needs review."
        assert ctx["marker_coverage_summary"]["evaluated"] == 1
        assert ctx["marker_coverage_summary"]["fired"] == 1

    def test_context_for_llm_includes_risk_flags(self):
        result = self._make_result()
        ctx = result.context_for_llm()
        assert len(ctx["risk_flags"]) == 1
        assert ctx["risk_flags"][0]["title"] == "High TSH"

    def test_context_for_llm_includes_prioritized(self):
        result = self._make_result()
        ctx = result.context_for_llm()
        assert len(ctx["prioritized_abnormal"]) == 1
        assert ctx["prioritized_abnormal"][0]["value"] == 5.8

    def test_to_dict_includes_context_for_llm(self):
        result = self._make_result()
        d = result.to_dict()
        assert "context_for_llm" in d
        assert d["context_for_llm"]["engine_version"] == "clinical_engine_v1"

    def test_unknown_count(self):
        result = self._make_result(
            normalized_biomarkers=[
                {"name": "X", "canonical_name": "x", "value": 1, "unit": "g/L", "status": "UNKNOWN"},
                {"name": "Y", "canonical_name": "y", "value": 2, "unit": "g/L", "status": "ELEVATED"},
            ]
        )
        ctx = result.context_for_llm()
        assert ctx["unknown_count"] == 1
        assert ctx["abnormal_count"] == 1


# ---------------------------------------------------------------------------
# 6. Backward compatibility: pipeline functions delegate correctly
# ---------------------------------------------------------------------------


class TestBackwardCompatibility:
    def test_pipeline_normalize_biomarkers_delegates(self):
        from app.services.lab_analysis_pipeline import normalize_biomarkers as pipeline_normalize
        result = pipeline_normalize([
            {"name": "TSH (Thyroid Stimulating Hormone)", "value": 5.8, "unit": "uIU/mL"},
        ])
        assert result[0]["canonical_name"] == "canonical_tsh"

    def test_pipeline_prioritize_delegates(self):
        from app.services.lab_analysis_pipeline import _prioritize_biomarkers
        result = _prioritize_biomarkers([
            {"name": "X", "canonical_name": "x", "value": 100, "unit": "mg/dL",
             "status": "ELEVATED", "category": "metabolic", "reference_range": None,
             "ref_low": None, "ref_high": 99},
        ])
        assert len(result) == 1
        assert result[0]["priority"] == "high"

    def test_pipeline_risk_flags_delegates(self):
        from app.services.lab_analysis_pipeline import _risk_flags
        kr = {"safety_alerts": [], "why_it_matters": [{"rule_key": "r1", "severity": "moderate", "title": "T", "summary": "S"}]}
        result = _risk_flags(kr, [])
        assert len(result) == 1
        assert result[0]["type"] == "knowledge_rule"

    def test_evaluator_normalize_unit_import(self):
        """The evaluator still exports _normalize_unit for backward compatibility."""
        from app.services.knowledge.evaluator import _normalize_unit
        assert _normalize_unit("10^9 cells/L") == "10^9/l"

    def test_evaluator_convert_value_import(self):
        from app.services.knowledge.evaluator import _convert_value
        result = _convert_value("hemoglobin", 14.5, "g/dL", "g/L")
        assert result == pytest.approx(145.0)

    def test_evaluator_unit_matches_import(self):
        from app.services.knowledge.evaluator import _unit_matches
        assert _unit_matches("г/л", "g/L")


# ---------------------------------------------------------------------------
# 7. ClinicalAnalysisEngine.analyze() integration
# ---------------------------------------------------------------------------


class TestClinicalAnalysisEngineAnalyze:
    """Test the engine's analyze method with mock rules (no Supabase)."""

    @pytest.mark.asyncio
    async def test_analyze_produces_analysis_result(self):
        """Test that analyze returns an AnalysisResult with all required fields."""
        engine = ClinicalAnalysisEngine()
        # Mock the Supabase-dependent function imported from knowledge.integration
        from unittest.mock import AsyncMock, patch

        mock_eval = AsyncMock(return_value={
            "matched_rules": [{"rule_key": "rule_high_tsh", "name": "High TSH",
                               "severity": "moderate", "summary": "Elevated", "requires_doctor": False}],
            "generated_recommendations": [],
            "requires_doctor": False,
            "max_confidence": 0.85,
            "confidence": 0.85,
            "safety_alerts": [],
            "source_references": [],
            "nutrition_context": {},
            "rule_evaluation_ids": [],
            "unevaluated_markers": [],
            "marker_coverage": {"evaluated": ["tsh"], "fired": ["tsh"], "no_matching_rule": [], "unit_blocked": []},
            "recommendation_keys": [],
        })

        with patch("app.services.knowledge.integration.evaluate_biomarkers_with_knowledge", mock_eval):
            result = await engine.analyze(
                biomarkers=[{"name": "TSH", "value": 5.8, "unit": "uIU/mL"}],
                symptoms=[],
                locale="en",
            )

        assert isinstance(result, AnalysisResult)
        assert len(result.normalized_biomarkers) == 1
        assert result.normalized_biomarkers[0]["canonical_name"] == "canonical_tsh"
        assert len(result.matched_rules) == 1
        assert result.confidence == 0.85

        ctx = result.context_for_llm()
        assert ctx["engine_version"] == "clinical_engine_v1"
        assert ctx["biomarker_count"] == 1
        assert len(ctx["matched_rules"]) == 1
