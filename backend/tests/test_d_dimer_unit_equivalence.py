"""D-dimer unit equivalence fix — regression tests for μg/L ↔ ng/mL conversion.

Validates that:
1. D-dimer conversions between μg/L and ng/mL work bidirectionally
2. KB rule matching works with unit conversion
3. P0 biomarker status boundaries remain intact
4. Incompatible units still fail closed
"""

import pytest
from app.services.clinical_engine.units import convert_value, unit_matches, normalize_unit
from app.services.knowledge.evaluator import evaluate_input_with_rules
from app.services.knowledge.integration import biomarkers_to_knowledge_lab_results


# =============================================================================
# TEST 1: Direct Unit Conversion
# =============================================================================

class TestDDimerDirectConversion:
    """Direct conversion function tests for D-dimer μg/L ↔ ng/mL."""

    def test_d_dimer_ug_l_to_ng_ml_conversion(self):
        """D-dimer 600 μg/L converts to 600 ng/mL."""
        result = convert_value("d_dimer", 600, "μg/L", "ng/mL")
        assert result is not None, "Conversion should succeed"
        assert result == 600.0, f"Expected 600.0, got {result}"

    def test_d_dimer_ng_ml_to_ug_l_conversion(self):
        """D-dimer 600 ng/mL converts to 600 μg/L."""
        result = convert_value("d_dimer", 600, "ng/mL", "μg/L")
        assert result is not None, "Conversion should succeed"
        assert result == 600.0, f"Expected 600.0, got {result}"

    def test_d_dimer_normalized_units_conversion(self):
        """D-dimer conversion works with normalized unit strings."""
        # normalize_unit converts "μg/L" → "ug/l" and "ng/mL" → "ng/ml"
        result = convert_value("d_dimer", 500, "ug/l", "ng/ml")
        assert result is not None, "Conversion should succeed with normalized units"
        assert result == 500.0, f"Expected 500.0, got {result}"

    def test_d_dimer_reverse_normalized_conversion(self):
        """D-dimer reverse conversion with normalized units."""
        result = convert_value("d_dimer", 500, "ng/ml", "ug/l")
        assert result is not None, "Reverse conversion should succeed"
        assert result == 500.0, f"Expected 500.0, got {result}"

    def test_d_dimer_low_value_conversion(self):
        """D-dimer low value (300 ng/mL) converts correctly."""
        result = convert_value("d_dimer", 300, "ng/ml", "ug/l")
        assert result == 300.0, f"Expected 300.0, got {result}"

    def test_d_dimer_high_value_conversion(self):
        """D-dimer high value (1500 ng/mL) converts correctly."""
        result = convert_value("d_dimer", 1500, "ng/ml", "ug/l")
        assert result == 1500.0, f"Expected 1500.0, got {result}"

    def test_d_dimer_threshold_value_conversion(self):
        """D-dimer threshold value (500) converts correctly."""
        result = convert_value("d_dimer", 500, "ng/ml", "ug/l")
        assert result == 500.0, f"Expected 500.0, got {result}"


# =============================================================================
# TEST 2: Unit Matching Behavior
# =============================================================================

class TestDDimerUnitMatching:
    """Unit matching behavior (unit_matches returns False, but convert_value works)."""

    def test_unit_matches_returns_false(self):
        """unit_matches still returns False (normalized units differ)."""
        # This is expected: normalize_unit("ng/ml") = "ng/ml"
        #                   normalize_unit("ug/l") = "ug/l"
        # They don't match, but convert_value will handle the conversion
        result = unit_matches("ng/mL", "μg/L")
        assert result is False, "Normalized units should differ (ng/ml ≠ ug/l)"

    def test_convert_value_succeeds_despite_mismatch(self):
        """convert_value succeeds even though unit_matches returns False."""
        # This is the key fix: KB evaluator tries conversion when unit_matches fails
        matches = unit_matches("ng/mL", "μg/L")
        converts = convert_value("d_dimer", 600, "ng/mL", "μg/L")
        assert matches is False, "Units should not match"
        assert converts == 600.0, "But conversion should still work"


# =============================================================================
# TEST 3: Evaluator Integration with KB Rule
# =============================================================================

class TestDDimerEvaluatorIntegration:
    """KB evaluator integration — rule matching with unit conversion."""

    def test_d_dimer_rule_matches_with_ng_ml_input(self):
        """D-dimer 600 ng/mL with ELEVATED status matches rule >500 μg/L."""
        rule = {
            "id": "rule_high_d_dimer",
            "key": "rule_high_d_dimer",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 1, "D-dimer rule should match"
        assert result["matched_rules"][0]["rule_key"] == "rule_high_d_dimer"

    def test_d_dimer_rule_matches_with_ug_l_input(self):
        """D-dimer 600 μg/L with ELEVATED status matches rule >500 μg/L."""
        rule = {
            "id": "rule_high_d_dimer",
            "key": "rule_high_d_dimer",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "μg/L",
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 1, "D-dimer rule should match"

    def test_d_dimer_rule_no_match_low_value(self):
        """D-dimer 300 ng/mL does NOT match rule >500 μg/L."""
        rule = {
            "id": "rule_high_d_dimer",
            "key": "rule_high_d_dimer",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 300,
                "unit": "ng/mL",
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 0, "D-dimer rule should NOT match for 300"

    def test_d_dimer_rule_matches_at_boundary(self):
        """D-dimer 500 ng/mL (equals threshold) does NOT match >500 (strict greater)."""
        rule = {
            "id": "rule_high_d_dimer",
            "key": "rule_high_d_dimer",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 500,
                "unit": "ng/mL",
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 0, "Rule uses >500, not >=500"

    def test_d_dimer_rule_matches_just_above_threshold(self):
        """D-dimer 501 ng/mL matches rule >500 μg/L."""
        rule = {
            "id": "rule_high_d_dimer",
            "key": "rule_high_d_dimer",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 501,
                "unit": "ng/mL",
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 1, "Rule should match for 501 > 500"


# =============================================================================
# TEST 4: P0 Reference Safety Fix Boundaries
# =============================================================================

class TestDDimerP0Boundaries:
    """P0 Reference Safety Fix boundaries remain intact with D-dimer conversions."""

    def test_d_dimer_optimal_status_blocked(self):
        """D-dimer with OPTIMAL status does NOT create KB recommendation (P0 fix)."""
        rule = {
            "id": "rule_high_d_dimer",
            "key": "rule_high_d_dimer",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "status": "OPTIMAL",  # P0 blocks this
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 0, "OPTIMAL status should be blocked"

    def test_d_dimer_unevaluated_status_blocked(self):
        """D-dimer with UNEVALUATED status does NOT create KB recommendation (P0 fix)."""
        rule = {
            "id": "rule_high_d_dimer",
            "key": "rule_high_d_dimer",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "status": "UNEVALUATED",  # P0 blocks this
                "unevaluated_reason": "unverified_reference_interval",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 0, "UNEVALUATED status should be blocked"

    def test_d_dimer_unknown_status_blocked(self):
        """D-dimer with UNKNOWN status does NOT create KB recommendation (P0 fix)."""
        rule = {
            "id": "rule_high_d_dimer",
            "key": "rule_high_d_dimer",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "status": "UNKNOWN",  # P0 blocks this
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 0, "UNKNOWN status should be blocked"

    def test_d_dimer_needs_confirmation_blocked(self):
        """D-dimer with NEEDS_CONFIRMATION status does NOT create KB recommendation."""
        rule = {
            "id": "rule_high_d_dimer",
            "key": "rule_high_d_dimer",
            "active": True,
            "governance_status": "active",
            "input_entities": ["d_dimer"],
            "conditions": {
                "all": [
                    {"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "status": "NEEDS_CONFIRMATION",  # P0 blocks this
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 0, "NEEDS_CONFIRMATION should be blocked"


# =============================================================================
# TEST 5: Safety — Incompatible Units Fail Closed
# =============================================================================

class TestDDimerIncompatibleUnits:
    """Incompatible units still fail safely."""

    def test_d_dimer_incompatible_unit_conversion_fails(self):
        """D-dimer conversion to incompatible unit returns None."""
        # mmol/L is incompatible with μg/L (different dimensions)
        result = convert_value("d_dimer", 600, "ng/ml", "mmol/l")
        assert result is None, "Incompatible unit conversion should return None"

    def test_d_dimer_unknown_unit_conversion_fails(self):
        """D-dimer conversion to unknown unit returns None."""
        result = convert_value("d_dimer", 600, "ng/ml", "xyz/ml")
        assert result is None, "Unknown unit conversion should return None"

    def test_d_dimer_percentage_unit_not_supported(self):
        """D-dimer conversion to percentage returns None (incompatible dimension)."""
        result = convert_value("d_dimer", 600, "ng/ml", "%")
        assert result is None, "Percentage is incompatible dimension"

    def test_d_dimer_percentage_from_value_fails(self):
        """D-dimer percentage input conversion fails."""
        result = convert_value("d_dimer", 60, "%", "ng/ml")
        assert result is None, "Percentage conversion should fail"


# =============================================================================
# TEST 6: Integration with biomarkers_to_knowledge_lab_results
# =============================================================================

class TestDDimerIntegration:
    """Integration with the full KB lab results pipeline."""

    def test_d_dimer_elevated_reaches_kb(self):
        """ELEVATED D-dimer reaches KB evaluation."""
        biomarkers = [
            {
                "name": "D-dimer",
                "canonical_name": "d_dimer",
                "value": 600,
                "unit": "ng/mL",
                "status": "ELEVATED",
            }
        ]

        lab_results = biomarkers_to_knowledge_lab_results(biomarkers)

        assert "d_dimer" in lab_results, "ELEVATED D-dimer should reach KB"
        assert lab_results["d_dimer"]["value"] == 600
        assert lab_results["d_dimer"]["unit"] == "ng/mL"

    def test_d_dimer_optimal_excluded_from_kb(self):
        """OPTIMAL D-dimer excluded from KB (P0 fix)."""
        biomarkers = [
            {
                "name": "D-dimer",
                "canonical_name": "d_dimer",
                "value": 400,
                "unit": "ng/mL",
                "status": "OPTIMAL",
            }
        ]

        lab_results = biomarkers_to_knowledge_lab_results(biomarkers)

        assert "d_dimer" not in lab_results, "OPTIMAL D-dimer should not reach KB"

    def test_d_dimer_unevaluated_excluded_from_kb(self):
        """UNEVALUATED D-dimer excluded from KB (P0 fix)."""
        biomarkers = [
            {
                "name": "D-dimer",
                "canonical_name": "d_dimer",
                "value": 650,
                "unit": "ng/mL",
                "status": "UNEVALUATED",
                "unevaluated_reason": "unverified_reference_interval",
            }
        ]

        lab_results = biomarkers_to_knowledge_lab_results(biomarkers)

        assert "d_dimer" not in lab_results, "UNEVALUATED D-dimer should not reach KB"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
