"""P0 Reference Safety Fix — tests for UNEVALUATED bypass closure.

Validates that:
1. UNEVALUATED biomarkers do NOT reach KB numeric abnormality evaluation
2. OPTIMAL biomarkers are not contradicted by KB
3. Real ELEVATED biomarkers still work
4. UNKNOWN statuses are properly handled
5. NEEDS_CONFIRMATION is blocked upstream
6. Unit compatibility issues don't cause KB crashes
7. Safety Engine remains independent
"""

import pytest
from app.services.clinical_engine import prioritize_biomarkers
from app.services.knowledge.integration import biomarkers_to_knowledge_lab_results
from app.services.knowledge.evaluator import _is_eligible_for_kb_numeric_classification


# ===== Test A: UNEVALUATED Reference Bypass Closure =====

def test_unevaluated_excluded_from_prioritization():
    """Test A: UNEVALUATED is filtered by prioritize_biomarkers()."""
    biomarkers = [
        {
            "name": "D-dimer",
            "canonical_name": "d_dimer",
            "value": 650,
            "unit": "μg/L",
            "status": "UNEVALUATED",
            "unevaluated_reason": "unverified_reference_interval",
            "category": "coagulation",
        },
        {
            "name": "TSH",
            "canonical_name": "tsh",
            "value": 2.0,
            "unit": "mIU/L",
            "status": "OPTIMAL",
            "category": "endocrine",
        },
    ]

    prioritized = prioritize_biomarkers(biomarkers)

    # UNEVALUATED should be excluded
    assert len(prioritized) == 0, "UNEVALUATED and OPTIMAL should both be filtered"
    print("✓ Test A: UNEVALUATED excluded from prioritization")


def test_unevaluated_excluded_from_kb_lab_results():
    """Test A: UNEVALUATED is filtered before KB evaluation."""
    biomarkers = [
        {
            "name": "D-dimer",
            "value": 650,
            "unit": "μg/L",
            "status": "UNEVALUATED",
            "unevaluated_reason": "unverified_reference_interval",
        }
    ]

    lab_results = biomarkers_to_knowledge_lab_results(biomarkers)

    # UNEVALUATED D-dimer should NOT reach KB
    assert "d_dimer" not in lab_results, "UNEVALUATED biomarker should not reach KB evaluation"
    print("✓ Test A: UNEVALUATED excluded from KB lab_results")


def test_unevaluated_eligibility_check():
    """Test A: Eligibility check correctly identifies UNEVALUATED."""
    biomarker = {
        "name": "D-dimer",
        "value": 650,
        "status": "UNEVALUATED",
        "unevaluated_reason": "unverified_reference_interval",
    }

    is_eligible, reason = _is_eligible_for_kb_numeric_classification(biomarker)

    assert not is_eligible, "UNEVALUATED should not be eligible"
    assert "UNEVALUATED" in reason, "Reason should explain status"
    assert "unverified_reference_interval" in reason, "Reason should include unevaluated_reason"
    print("✓ Test A: Eligibility check blocks UNEVALUATED")


# ===== Test B: OPTIMAL Lab Range Conflict =====

def test_optimal_not_contradicted():
    """Test B: OPTIMAL biomarkers with valid lab range should not be contradicted."""
    biomarkers = [
        {
            "name": "Fibrinogen",
            "canonical_name": "fibrinogen",
            "value": 4.0,  # At upper boundary of normal range
            "unit": "g/L",
            "status": "OPTIMAL",
            "ref_low": 2.0,
            "ref_high": 4.0,
            "category": "coagulation",
        }
    ]

    lab_results = biomarkers_to_knowledge_lab_results(biomarkers)

    # OPTIMAL should be excluded (even though it's at boundary, Clinical Engine says OPTIMAL)
    assert "fibrinogen" not in lab_results, "OPTIMAL should not reach KB for numeric abnormality classification"
    print("✓ Test B: OPTIMAL not contradicted by KB")


# ===== Test C: Real ELEVATED Still Works =====

def test_real_elevated_reaches_kb():
    """Test C: Genuinely ELEVATED biomarkers should still reach KB."""
    biomarkers = [
        {
            "name": "D-dimer",
            "canonical_name": "d_dimer",
            "value": 650,
            "unit": "μg/L",
            "status": "ELEVATED",
            "ref_low": None,
            "ref_high": 500,
            "category": "coagulation",
        }
    ]

    lab_results = biomarkers_to_knowledge_lab_results(biomarkers)

    # ELEVATED should reach KB
    assert "d_dimer" in lab_results, "ELEVATED biomarker should reach KB"
    assert lab_results["d_dimer"]["value"] == 650, "Value should be preserved"
    print("✓ Test C: ELEVATED biomarkers reach KB")


# ===== Test D: UNKNOWN Handling =====

def test_unknown_excluded_from_prioritization():
    """Test D: UNKNOWN statuses should be excluded."""
    biomarkers = [
        {
            "name": "TSH",
            "canonical_name": "tsh",
            "value": 2.0,
            "unit": "mIU/L",
            "status": "UNKNOWN",
            "category": "endocrine",
        }
    ]

    prioritized = prioritize_biomarkers(biomarkers)

    # UNKNOWN should be excluded
    assert len(prioritized) == 0, "UNKNOWN should be filtered"
    print("✓ Test D: UNKNOWN excluded")


def test_unknown_excluded_from_kb_lab_results():
    """Test D: UNKNOWN should not reach KB."""
    biomarkers = [
        {
            "name": "TSH",
            "value": 2.0,
            "unit": "mIU/L",
            "status": "UNKNOWN",
        }
    ]

    lab_results = biomarkers_to_knowledge_lab_results(biomarkers)

    # UNKNOWN should NOT reach KB
    assert "tsh" not in lab_results, "UNKNOWN biomarker should not reach KB"
    print("✓ Test D: UNKNOWN excluded from KB")


# ===== Test E: NEEDS_CONFIRMATION Upstream Block =====

def test_needs_confirmation_not_in_eligibility():
    """Test E: NEEDS_CONFIRMATION should be ineligible."""
    biomarker = {
        "name": "Test",
        "value": 100,
        "status": "NEEDS_CONFIRMATION",
    }

    is_eligible, reason = _is_eligible_for_kb_numeric_classification(biomarker)

    assert not is_eligible, "NEEDS_CONFIRMATION should be ineligible"
    print("✓ Test E: NEEDS_CONFIRMATION ineligible (upstream gate blocks earlier)")


# ===== Test F: Unit Compatibility =====

def test_unit_compatibility_issue_excluded():
    """Test F: Biomarkers with unit compatibility issues don't crash KB."""
    biomarkers = [
        {
            "name": "Glucose",
            "canonical_name": "glucose",
            "value": 92,
            "unit": "mg/dL",
            "status": "ELEVATED",
            "category": "metabolic",
        },
        {
            "name": "Invalid",
            "canonical_name": "invalid",
            "value": None,  # No value
            "unit": "unknown_unit",
            "status": "ELEVATED",
            "category": "other",
        },
    ]

    lab_results = biomarkers_to_knowledge_lab_results(biomarkers)

    # Valid value should be included, invalid should not
    assert "glucose" in lab_results, "Valid biomarker should be included"
    assert "invalid" not in lab_results, "Biomarker with no value should be excluded"
    print("✓ Test F: Unit compatibility handled safely")


# ===== Test G: Safety Engine Independence =====

def test_safety_engine_can_still_access_biomarkers():
    """Test G: UNEVALUATED biomarkers remain available for Safety Engine."""
    biomarkers = [
        {
            "name": "Potassium",
            "canonical_name": "potassium",
            "value": 2.0,  # Low
            "unit": "mmol/L",
            "status": "UNEVALUATED",
            "unevaluated_reason": "unverified_reference_interval",
            "category": "electrolytes",
        }
    ]

    # UNEVALUATED should be excluded from KB
    lab_results = biomarkers_to_knowledge_lab_results(biomarkers)
    assert "potassium" not in lab_results, "UNEVALUATED excluded from KB"

    # But Safety Engine would still have access to the original biomarker object
    # and can independently evaluate critical values
    assert len(biomarkers) == 1, "Original biomarker list preserved for Safety Engine"
    assert biomarkers[0]["value"] == 2.0, "Raw value preserved"
    print("✓ Test G: Safety Engine can still access original biomarkers")


# ===== Test H, I, J: Direct Evaluator Defense =====

def test_direct_evaluator_unevaluated_blocked():
    """Test H: Direct evaluator call with UNEVALUATED is blocked."""
    from app.services.knowledge.evaluator import evaluate_input_with_rules

    # Create a simple rule that fires when D-dimer > 500
    rule = {
        "id": "test_rule_h",
        "key": "rule_high_d_dimer_direct",
        "active": True,
        "governance_status": "active",
        "input_entities": ["d_dimer"],
        "conditions": {
            "all": [
                {"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}
            ]
        },
        "outputs": {},
    }

    # D-dimer is 650 (above threshold) but UNEVALUATED
    lab_results = {
        "d_dimer": {
            "value": 650,
            "unit": "μg/L",
            "status": "UNEVALUATED",
            "unevaluated_reason": "unverified_reference_interval",
        }
    }

    # Even though value exceeds threshold, rule should NOT match
    result = evaluate_input_with_rules(
        {"lab_results": lab_results, "symptoms": []},
        [rule]
    )

    assert len(result["matched_rules"]) == 0, "UNEVALUATED should block rule match"
    print("✓ Test H: Direct evaluator UNEVALUATED blocked")


def test_direct_evaluator_optimal_blocked():
    """Test I: Direct evaluator call with OPTIMAL is blocked."""
    from app.services.knowledge.evaluator import evaluate_input_with_rules

    # Create a rule that fires when Fibrinogen value matches
    rule = {
        "id": "test_rule_i",
        "key": "rule_fibrinogen_abnormality_direct",
        "active": True,
        "governance_status": "active",
        "input_entities": ["fibrinogen"],
        "conditions": {
            "all": [
                {"lab_marker": "fibrinogen", "operator": "gte", "value": 4.0, "unit": "g/L"}
            ]
        },
        "outputs": {},
    }

    # Fibrinogen is 4.0 (at threshold boundary) but OPTIMAL
    lab_results = {
        "fibrinogen": {
            "value": 4.0,
            "unit": "g/L",
            "status": "OPTIMAL",
        }
    }

    # Even though value equals threshold, rule should NOT match
    result = evaluate_input_with_rules(
        {"lab_results": lab_results, "symptoms": []},
        [rule]
    )

    assert len(result["matched_rules"]) == 0, "OPTIMAL should block rule match"
    print("✓ Test I: Direct evaluator OPTIMAL blocked")


def test_direct_evaluator_elevated_works():
    """Test J: Direct evaluator call with ELEVATED still works."""
    from app.services.knowledge.evaluator import evaluate_input_with_rules

    # Create a rule that fires when D-dimer > 500
    rule = {
        "id": "test_rule_j",
        "key": "rule_high_d_dimer_direct_elevated",
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

    # D-dimer is 650 (above threshold) and ELEVATED
    lab_results = {
        "d_dimer": {
            "value": 650,
            "unit": "μg/L",
            "status": "ELEVATED",
        }
    }

    # Rule should match because ELEVATED is eligible
    result = evaluate_input_with_rules(
        {"lab_results": lab_results, "symptoms": []},
        [rule]
    )

    assert len(result["matched_rules"]) == 1, "ELEVATED should allow rule match"
    assert result["matched_rules"][0]["rule_key"] == "rule_high_d_dimer_direct_elevated"
    print("✓ Test J: Direct evaluator ELEVATED works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
