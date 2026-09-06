"""Assay qualifier support tests for FEU/DDU distinction in biomarkers.

Tests that assay_qualifier is properly extracted, passed through pipeline,
and used in KB rule matching.
"""

import pytest
from app.services.knowledge.evaluator import evaluate_input_with_rules, _assay_qualifier_matches
from app.services.knowledge.integration import biomarkers_to_knowledge_lab_results
from app.services.clinical_engine.normalizer import normalize_biomarkers


class TestAssayQualifierNormalization:
    """Test assay qualifier string normalization."""

    def test_normalize_feu_variants(self):
        """Test normalization of FEU variants."""
        matches, reason = _assay_qualifier_matches("FEU", "FEU")
        assert matches is True

        matches, reason = _assay_qualifier_matches("(FEU)", "FEU")
        assert matches is True

        matches, reason = _assay_qualifier_matches("feu", "FEU")
        assert matches is True

        matches, reason = _assay_qualifier_matches("[FEU]", "FEU")
        assert matches is True

    def test_normalize_ddu_variants(self):
        """Test normalization of DDU variants."""
        matches, reason = _assay_qualifier_matches("DDU", "DDU")
        assert matches is True

        matches, reason = _assay_qualifier_matches("(DDU)", "DDU")
        assert matches is True

        matches, reason = _assay_qualifier_matches("ddu", "DDU")
        assert matches is True

    def test_feu_ddu_mismatch(self):
        """FEU and DDU do not match."""
        matches, reason = _assay_qualifier_matches("FEU", "DDU")
        assert matches is False
        assert reason == "assay_semantics_mismatch"

        matches, reason = _assay_qualifier_matches("DDU", "FEU")
        assert matches is False
        assert reason == "assay_semantics_mismatch"

    def test_unknown_assay_when_required(self):
        """Unknown/null assay when rule requires one."""
        matches, reason = _assay_qualifier_matches(None, "FEU")
        assert matches is False
        assert reason == "assay_semantics_unknown"

        matches, reason = _assay_qualifier_matches("", "FEU")
        assert matches is False
        assert reason == "assay_semantics_unknown"

    def test_backward_compatibility_no_expected(self):
        """When rule doesn't specify qualifier, any input is acceptable."""
        matches, reason = _assay_qualifier_matches("FEU", None)
        assert matches is True
        assert reason is None

        matches, reason = _assay_qualifier_matches("DDU", None)
        assert matches is True

        matches, reason = _assay_qualifier_matches(None, None)
        assert matches is True


class TestAssayQualifierExtraction:
    """Test biomarker extraction with assay qualifier."""

    def test_extract_d_dimer_with_feu(self):
        """D-dimer extraction preserves FEU qualifier."""
        biomarkers = [
            {
                "name": "D-dimer",
                "value": 600,
                "unit": "ng/mL",
                "assay_qualifier": "FEU",
                "status": "ELEVATED",
            }
        ]

        normalized = normalize_biomarkers(biomarkers)
        assert len(normalized) == 1
        assert normalized[0]["assay_qualifier"] == "FEU"
        assert normalized[0]["unit"] == "ng/mL"
        assert normalized[0]["value"] == 600.0

    def test_extract_d_dimer_without_qualifier(self):
        """D-dimer without qualifier has assay_qualifier=None."""
        biomarkers = [
            {
                "name": "D-dimer",
                "value": 600,
                "unit": "ng/mL",
                "status": "ELEVATED",
            }
        ]

        normalized = normalize_biomarkers(biomarkers)
        assert normalized[0]["assay_qualifier"] is None

    def test_kb_input_preserves_assay_qualifier(self):
        """KB input preserves assay_qualifier from biomarker."""
        biomarkers = [
            {
                "name": "D-dimer",
                "canonical_name": "d_dimer",
                "value": 600,
                "unit": "ng/mL",
                "assay_qualifier": "FEU",
                "status": "ELEVATED",
            }
        ]

        kb_input = biomarkers_to_knowledge_lab_results(biomarkers)
        assert "d_dimer" in kb_input
        assert kb_input["d_dimer"]["assay_qualifier"] == "FEU"


class TestAssayQualifierRuleMatching:
    """Test KB rule matching with assay_qualifier."""

    def test_feu_rule_matches_feu_input(self):
        """D-dimer 600 ng/mL FEU matches FEU rule."""
        rule = {
            "id": "test_rule",
            "key": "test_d_dimer_feu",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {
                        "lab_marker": "d_dimer",
                        "operator": "gt",
                        "value": 500,
                        "unit": "μg/L",
                        "assay_qualifier": "FEU",
                    }
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "assay_qualifier": "FEU",
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 1, "FEU rule should match FEU input"

    def test_feu_rule_does_not_match_ddu_input(self):
        """D-dimer 600 ng/mL DDU does NOT match FEU rule."""
        rule = {
            "id": "test_rule",
            "key": "test_d_dimer_feu",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {
                        "lab_marker": "d_dimer",
                        "operator": "gt",
                        "value": 500,
                        "unit": "μg/L",
                        "assay_qualifier": "FEU",
                    }
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "assay_qualifier": "DDU",
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 0, "FEU rule should NOT match DDU input"
        # Marker was evaluated but rule didn't match
        assert "d_dimer" in result["marker_coverage"]["evaluated"]

    def test_feu_rule_does_not_match_unknown_assay(self):
        """D-dimer 600 ng/mL (no qualifier) does NOT match FEU rule."""
        rule = {
            "id": "test_rule",
            "key": "test_d_dimer_feu",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {
                        "lab_marker": "d_dimer",
                        "operator": "gt",
                        "value": 500,
                        "unit": "μg/L",
                        "assay_qualifier": "FEU",
                    }
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "assay_qualifier": None,
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 0, "FEU rule should NOT match unknown assay"

    def test_backward_compatibility_rule_without_assay_qualifier(self):
        """Old rule without assay_qualifier still works."""
        rule = {
            "id": "test_rule",
            "key": "test_d_dimer_old",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {
                        "lab_marker": "d_dimer",
                        "operator": "gt",
                        "value": 500,
                        "unit": "μg/L",
                        # NO assay_qualifier specified
                    }
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        # Should match any assay type
        test_cases = [
            ("FEU", True),
            ("DDU", True),
            (None, True),
        ]

        for qualifier, should_match in test_cases:
            lab_results = {
                "d_dimer": {
                    "value": 600,
                    "unit": "ng/mL",
                    "assay_qualifier": qualifier,
                    "status": "ELEVATED",
                }
            }

            result = evaluate_input_with_rules(
                {"lab_results": lab_results, "symptoms": []},
                [rule]
            )

            matched = len(result["matched_rules"]) > 0
            assert matched == should_match, f"Old rule with qualifier={qualifier} should match={should_match}"

    def test_dimensional_conversion_preserves_assay(self):
        """Dimensional conversion (ng/mL → μg/L) preserves assay_qualifier."""
        rule = {
            "id": "test_rule",
            "key": "test_d_dimer_feu",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {
                        "lab_marker": "d_dimer",
                        "operator": "gt",
                        "value": 500,
                        "unit": "μg/L",
                        "assay_qualifier": "FEU",
                    }
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        # Input in ng/mL, rule expects μg/L
        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",  # Different unit
                "assay_qualifier": "FEU",  # But same assay
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        # Should match: assay matches and value converts correctly
        assert len(result["matched_rules"]) == 1

    def test_p0_boundary_with_assay_qualifier(self):
        """P0 boundaries still work with assay_qualifier."""
        rule = {
            "id": "test_rule",
            "key": "test_d_dimer_feu",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {
                        "lab_marker": "d_dimer",
                        "operator": "gt",
                        "value": 500,
                        "unit": "μg/L",
                        "assay_qualifier": "FEU",
                    }
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        # Even with matching assay qualifier, OPTIMAL/UNEVALUATED are blocked
        test_cases = [
            ("OPTIMAL", False),
            ("UNEVALUATED", False),
            ("UNKNOWN", False),
            ("ELEVATED", True),
        ]

        for status, should_match in test_cases:
            lab_results = {
                "d_dimer": {
                    "value": 600,
                    "unit": "ng/mL",
                    "assay_qualifier": "FEU",
                    "status": status,
                }
            }

            result = evaluate_input_with_rules(
                {"lab_results": lab_results, "symptoms": []},
                [rule]
            )

            matched = len(result["matched_rules"]) > 0
            assert matched == should_match, f"Status={status} should match={should_match}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
