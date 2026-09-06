"""Safe rollout tests for assay_qualifier support.

Ensures zero behavior change until FEU/DDU feature is explicitly activated.

STATE 0 (CURRENT PRODUCTION):
- Extraction: FEU/DDU parsing OFF
- rule_high_d_dimer: no assay_qualifier
- Behavior: Matches any assay type

STATE A (CODE DEPLOYED, FEATURE OFF):
- Extraction: FEU/DDU parsing OFF
- rule_high_d_dimer: no assay_qualifier
- Expected: IDENTICAL TO STATE 0

STATE B (RULE UPDATED, EXTRACTION STILL OFF):
- Extraction: FEU/DDU parsing OFF
- rule_high_d_dimer: assay_qualifier = FEU
- Expected: Fail closed (no parsed FEU means no match)

STATE C (FULL ACTIVATION):
- Extraction: FEU/DDU parsing ON
- rule_high_d_dimer: assay_qualifier = FEU
- Expected: FEU matches, DDU/unknown don't
"""

import pytest
from app.services.knowledge.evaluator import evaluate_input_with_rules


class TestState0CurrentProduction:
    """Baseline: Current production behavior (extraction parsing OFF)."""

    def test_state0_plain_unit_no_qualifier(self):
        """600 ng/mL (no qualifier, assay_qualifier=None) matches rule."""
        rule = {
            "id": "rule",
            "key": "rule_high_d_dimer",
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
                        # NO assay_qualifier
                    }
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "assay_qualifier": None,  # No qualifier parsed
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 1, "STATE 0: Plain unit should match"


class TestStateACapabilityDeployed:
    """Code deployed, extraction OFF, old rule unchanged."""

    def test_state_a_extraction_parsing_off(self):
        """When extraction parsing is OFF, assay_qualifier stays None even if present in text."""
        # With extraction parsing OFF (default state), LLM won't produce assay_qualifier
        # So this simulates the extracted biomarker state with parsing OFF:
        # Input text: "D-dimer 600 ng/mL (FEU)" but extraction parsing OFF
        # → LLM returns: assay_qualifier = None (or doesn't include field)

        rule = {
            "id": "rule",
            "key": "rule_high_d_dimer",
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
                        # NO assay_qualifier in rule (old rule unchanged)
                    }
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        # Biomarker as extracted with parsing OFF:
        # "D-dimer 600 ng/mL (FEU)" → unit="ng/mL (FEU)", assay_qualifier=None
        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL (FEU)",  # Embedded in unit string (parsing OFF)
                "assay_qualifier": None,  # Not parsed
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        # With parsing OFF, unit is "ng/mL (FEU)" which won't match "μg/L"
        # Conversion attempt: convert_value("d_dimer", 600, "ng/mL (FEU)", "μg/L") → None
        # Result: NO MATCH
        # This is the safe state - no false positives, but also no rule matching
        assert len(result["matched_rules"]) == 0, "STATE A: Embedded FEU in unit cannot be converted"

    def test_state_a_identical_behavior_plain_unit(self):
        """STATE A should be identical to STATE 0 for plain units."""
        rule_state0 = {
            "id": "rule",
            "key": "rule_high_d_dimer",
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
                    }
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        # Both STATE 0 and STATE A have extraction parsing OFF
        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",  # Clean plain unit (extraction with parsing OFF)
                "assay_qualifier": None,
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule_state0]
        )

        # Should match: plain unit converts correctly
        assert len(result["matched_rules"]) == 1, "STATE A: Plain unit behavior unchanged from STATE 0"


class TestStateBRuleActivatedExtractionOff:
    """Phase B: rule_high_d_dimer updated to require assay_qualifier=FEU, extraction still OFF."""

    def test_state_b_feu_rule_no_parsed_qualifier(self):
        """With parsing OFF, assay_qualifier is always None, so FEU rule cannot match."""
        rule_with_feu = {
            "id": "rule",
            "key": "rule_high_d_dimer",
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
                        "assay_qualifier": "FEU",  # Rule NOW requires FEU
                    }
                ]
            },
            "outputs": {"recommendation_keys": []},
        }

        # With extraction parsing OFF, assay_qualifier is None
        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "assay_qualifier": None,  # Parsing OFF = always None
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule_with_feu]
        )

        # Must NOT match: rule requires FEU but input has None
        # This fails closed - safe but no matches
        assert len(result["matched_rules"]) == 0, "STATE B: FEU rule with parsing OFF = no matches (fail closed)"


class TestStateCFullActivation:
    """Phase C: extraction ON + FEU rule active."""

    def test_state_c_feu_input_matches_feu_rule(self):
        """With parsing ON, FEU inputs match FEU rule."""
        rule_with_feu = {
            "id": "rule",
            "key": "rule_high_d_dimer",
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

        # With parsing ON, FEU is extracted
        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "assay_qualifier": "FEU",  # Parsing ON = extracted
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule_with_feu]
        )

        assert len(result["matched_rules"]) == 1, "STATE C: FEU input matches FEU rule"

    def test_state_c_ddu_input_does_not_match_feu_rule(self):
        """With parsing ON, DDU inputs do NOT match FEU rule."""
        rule_with_feu = {
            "id": "rule",
            "key": "rule_high_d_dimer",
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

        # With parsing ON, DDU is extracted
        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "assay_qualifier": "DDU",  # Parsing ON = DDU extracted
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule_with_feu]
        )

        # Must NOT match: rule requires FEU but input is DDU
        assert len(result["matched_rules"]) == 0, "STATE C: DDU input does not match FEU rule"

    def test_state_c_unknown_assay_does_not_match_feu_rule(self):
        """With parsing ON, unknown assay does NOT match FEU rule."""
        rule_with_feu = {
            "id": "rule",
            "key": "rule_high_d_dimer",
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

        # With parsing ON, if no FEU/DDU recognized, qualifier is None
        lab_results = {
            "d_dimer": {
                "value": 600,
                "unit": "ng/mL",
                "assay_qualifier": None,  # Parsing ON but no recognized qualifier
                "status": "ELEVATED",
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule_with_feu]
        )

        # Must NOT match: rule requires FEU but input is unknown
        assert len(result["matched_rules"]) == 0, "STATE C: Unknown assay does not match FEU rule"


class TestP0BoundaryPreservation:
    """P0 boundaries must hold in all states."""

    def test_p0_optimal_blocked_all_states(self):
        """OPTIMAL must be blocked regardless of assay_qualifier."""
        rule = {
            "id": "rule",
            "key": "rule_high_d_dimer",
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
                        # No assay_qualifier (compatible with all states)
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
                "status": "OPTIMAL",  # P0 blocks this
            }
        }

        result = evaluate_input_with_rules(
            {"lab_results": lab_results, "symptoms": []},
            [rule]
        )

        assert len(result["matched_rules"]) == 0, "OPTIMAL must be blocked in all states"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
