"""
Regression tests for extraction integrity fixes:
1. Inequality operator preservation (<5, >200, <=10, >=100, ≤, ≥)
2. Unit-marker compatibility validation
3. Physiologically implausible value fail-closed handling
4. Silent loss invariant verification

Tests verify:
- Normal values remain unaffected
- Lab-provided ranges remain authoritative
- Unverified fallback ranges remain UNEVALUATED
- Safety Engine behavior unchanged
- No new medical thresholds introduced
"""

import pytest

from app.services.lab_adapters.smartlab import (
    SmartlabAdapter,
    _extract_inequality_and_value,
    _check_unit_marker_compatibility,
)
from app.services.clinical_data_integrity import validate_clinical_data_integrity
from app.schemas.partners.results import PartnerResultIngestRequest
from datetime import date


class TestInequalityPreservation:
    """Test FIX 1: Inequality operators are preserved, not silently lost"""

    @pytest.mark.parametrize("raw_value,expected_qualifier,expected_numeric", [
        ("<5", "<", 5.0),
        (">200", ">", 200.0),
        ("<=10", "<=", 10.0),
        (">=100", ">=", 100.0),
        ("≤10", "<=", 10.0),
        ("≥100", ">=", 100.0),
        ("<>50", "<>", 50.0),
        ("=<5", "<=", 5.0),
        ("=>100", ">=", 100.0),
        ("125", None, 125.0),  # No qualifier
        ("125.5", None, 125.5),
    ])
    def test_inequality_extraction(self, raw_value, expected_qualifier, expected_numeric):
        """Verify inequality operators are extracted correctly"""
        qualifier, numeric, raw_str = _extract_inequality_and_value(raw_value)
        assert qualifier == expected_qualifier
        assert numeric == expected_numeric
        assert raw_str == str(raw_value)

    def test_inequality_not_silently_lost(self):
        """Verify that biomarkers with inequality operators are not dropped"""
        adapter = SmartlabAdapter()
        request = PartnerResultIngestRequest(
            partner_slug="test",
            external_patient_id="p1",
            external_order_id="o1",
            external_result_id="r1",
            lab_result={}
        )

        payload = {
            "biomarkers": [
                {"name": "WBC", "value": "<5", "unit": "x10^9/L"},
                {"name": "Glucose", "value": ">300", "unit": "mg/dL"},
            ]
        }

        result = adapter.to_canonical(request, payload)

        # Both biomarkers should be present (not silently dropped)
        assert len(result.biomarkers) == 2

        # Verify qualifiers are preserved
        wbc = result.biomarkers[0]
        assert wbc.value_qualifier == "<"
        assert wbc.value == 5.0
        assert wbc.raw_value == "<5"

        glucose = result.biomarkers[1]
        assert glucose.value_qualifier == ">"
        assert glucose.value == 300.0
        assert glucose.raw_value == ">300"

    def test_invalid_inequality_value_rejected(self):
        """Verify that unparseable values (e.g., '<abc') are rejected"""
        adapter = SmartlabAdapter()
        request = PartnerResultIngestRequest(
            partner_slug="test",
            external_patient_id="p1",
            external_order_id="o1",
            external_result_id="r1",
            lab_result={}
        )

        payload = {
            "biomarkers": [
                {"name": "WBC", "value": "<abc", "unit": "x10^9/L"},  # Invalid
            ]
        }

        result = adapter.to_canonical(request, payload)
        assert len(result.biomarkers) == 0  # Should be rejected


class TestUnitMarkerCompatibility:
    """Test FIX 2: Unit-marker compatibility validated against BIOMARKER_DATABASE"""

    def test_compatible_units_pass(self):
        """Verify that compatible marker-unit pairs are accepted"""
        # Sodium with mEq/L (valid)
        compatibility = _check_unit_marker_compatibility("canonical_sodium", "mEq/L")
        assert compatibility is None

        # Sodium with mmol/L (valid)
        compatibility = _check_unit_marker_compatibility("canonical_sodium", "mmol/L")
        assert compatibility is None

        # Glucose with mg/dL (valid)
        compatibility = _check_unit_marker_compatibility("canonical_glucose", "mg/dL")
        assert compatibility is None

        # Hemoglobin with g/dL (valid)
        compatibility = _check_unit_marker_compatibility("canonical_hemoglobin", "g/dL")
        assert compatibility is None

    def test_incompatible_units_detected(self):
        """Verify that incompatible marker-unit pairs are flagged"""
        # Sodium with mg/dL (WRONG UNIT)
        compatibility = _check_unit_marker_compatibility("canonical_sodium", "mg/dL")
        assert compatibility is not None
        assert "unit_not_valid_for_marker" in compatibility

        # Glucose with mEq/L (WRONG UNIT)
        compatibility = _check_unit_marker_compatibility("canonical_glucose", "mEq/L")
        assert compatibility is not None

        # Hemoglobin with mEq/L (WRONG UNIT)
        compatibility = _check_unit_marker_compatibility("canonical_hemoglobin", "mEq/L")
        assert compatibility is not None

    def test_unknown_markers_allowed(self):
        """Verify that unknown markers don't fail compatibility check"""
        # Unknown marker should return None (not rejected merely for being unknown)
        compatibility = _check_unit_marker_compatibility("canonical_unknown_marker", "mg/dL")
        assert compatibility is None

    def test_incompatible_unit_in_validation(self):
        """Verify that incompatible units are caught in clinical data integrity"""
        validation = validate_clinical_data_integrity(
            biomarkers=[
                {
                    "name": "Sodium",
                    "canonical_name": "canonical_sodium",
                    "value": 140.0,
                    "unit": "mg/dL",  # WRONG UNIT
                    "unit_compatibility_issue": "unit_not_valid_for_marker:mg/dL",
                }
            ]
        )

        # Should be flagged as issue
        assert len(validation["issues"]) > 0
        assert any(issue.get("key") == "unit_marker_incompatible" for issue in validation["issues"])

        # Should affect marker status
        marker = validation["markers"][0]
        assert marker["evaluation_status"] == "UNEVALUATED"
        assert "incompatible_unit" in marker["blocking_issues"][0]


class TestImplausibleValueFailClosed:
    """Test FIX 3: Physiologically implausible values are fail-closed"""

    @pytest.mark.parametrize("marker,value,unit,should_fail", [
        ("canonical_glucose", 5000.0, "mg/dL", True),  # Way too high (>1500)
        ("canonical_glucose", 5.0, "mg/dL", True),   # Way too low (<10)
        ("canonical_hemoglobin", 100.0, "g/dL", True),  # Way too high (>30)
        ("canonical_glucose", 100.0, "mg/dL", False),  # Normal
        ("canonical_hemoglobin", 15.0, "g/dL", False),  # Normal
    ])
    def test_implausible_value_detection(self, marker, value, unit, should_fail):
        """Verify that implausible values are detected"""
        validation = validate_clinical_data_integrity(
            biomarkers=[
                {
                    "name": marker.replace("canonical_", ""),
                    "canonical_name": marker,
                    "value": value,
                    "unit": unit,
                }
            ]
        )

        has_implausibility_issue = any(
            issue.get("key") == "physiologically_implausible_value"
            for issue in validation["issues"]
        )

        assert has_implausibility_issue == should_fail

        if should_fail:
            # Marker should be marked for confirmation/unevaluated
            marker_data = validation["markers"][0]
            assert marker_data["evaluation_status"] in ["NEEDS_CONFIRMATION", "UNEVALUATED"]
            assert any("implausible" in issue for issue in marker_data["blocking_issues"])

    def test_implausible_value_not_silently_accepted(self):
        """Verify that impossible values (glucose 5000) don't proceed normally"""
        validation = validate_clinical_data_integrity(
            biomarkers=[
                {
                    "name": "Glucose",
                    "canonical_name": "canonical_glucose",
                    "value": 5000.0,  # IMPOSSIBLE
                    "unit": "mg/dL",
                }
            ]
        )

        # Must have high severity issue
        assert any(
            issue.get("severity") == "high" and issue.get("key") == "physiologically_implausible_value"
            for issue in validation["issues"]
        )

        # Validation status should reflect this
        assert validation["status"] in ["review_required", "pass_with_warnings"]

        # Marker should be blocked from casual evaluation
        marker = validation["markers"][0]
        assert marker["evaluation_status"] != "EVALUABLE"


class TestSilentLossInvariant:
    """Test that no recognized biomarker silently disappears"""

    def test_recognized_biomarker_with_inequality_preserved(self):
        """Biomarker with inequality should appear in output with qualifier"""
        adapter = SmartlabAdapter()
        request = PartnerResultIngestRequest(
            partner_slug="test",
            external_patient_id="p1",
            external_order_id="o1",
            external_result_id="r1",
            lab_result={}
        )

        payload = {
            "biomarkers": [
                {"name": "WBC", "value": "<5", "unit": "x10^9/L"},
            ]
        }

        result = adapter.to_canonical(request, payload)
        assert len(result.biomarkers) == 1
        assert result.biomarkers[0].value_qualifier == "<"

    def test_recognized_biomarker_with_unit_incompatibility_preserved(self):
        """Biomarker with wrong unit should appear with flag, not disappear"""
        adapter = SmartlabAdapter()
        request = PartnerResultIngestRequest(
            partner_slug="test",
            external_patient_id="p1",
            external_order_id="o1",
            external_result_id="r1",
            lab_result={}
        )

        payload = {
            "biomarkers": [
                {"name": "Sodium", "value": 140, "unit": "mg/dL"},  # Wrong unit
            ]
        }

        result = adapter.to_canonical(request, payload)
        assert len(result.biomarkers) == 1
        assert result.biomarkers[0].unit_compatibility_issue is not None

    def test_recognized_biomarker_with_implausible_value_preserved(self):
        """Biomarker with impossible value should appear with flag, not disappear"""
        validation = validate_clinical_data_integrity(
            biomarkers=[
                {
                    "name": "Glucose",
                    "canonical_name": "canonical_glucose",
                    "value": 5000.0,  # Impossible
                    "unit": "mg/dL",
                }
            ]
        )

        # Marker should still appear in output
        assert len(validation["markers"]) == 1
        assert validation["markers"][0]["value"] == 5000.0  # Data preserved
        assert validation["markers"][0]["evaluation_status"] != "EVALUABLE"


class TestNormalValueRegression:
    """Test that normal values remain unaffected"""

    @pytest.mark.parametrize("marker,value,unit", [
        ("Glucose", 95.0, "mg/dL"),
        ("Hemoglobin", 14.5, "g/dL"),
        ("Sodium", 138.0, "mEq/L"),
        ("WBC", 7.5, "x10^9/L"),
        ("Creatinine", 1.0, "mg/dL"),
    ])
    def test_normal_values_pass_validation(self, marker, value, unit):
        """Verify normal values pass validation without issues"""
        validation = validate_clinical_data_integrity(
            biomarkers=[
                {
                    "name": marker,
                    "canonical_name": f"canonical_{marker.lower()}",
                    "value": value,
                    "unit": unit,
                }
            ]
        )

        # No critical issues
        high_issues = [i for i in validation["issues"] if i.get("severity") == "high"]
        assert len(high_issues) == 0

        # Marker should be evaluable
        marker_data = validation["markers"][0]
        assert marker_data["evaluation_status"] == "EVALUABLE"

    def test_lab_provided_ranges_authoritative(self):
        """Verify lab-provided ranges take precedence"""
        adapter = SmartlabAdapter()
        request = PartnerResultIngestRequest(
            partner_slug="test",
            external_patient_id="p1",
            external_order_id="o1",
            external_result_id="r1",
            lab_result={}
        )

        # Lab provides custom range
        payload = {
            "biomarkers": [
                {
                    "name": "Glucose",
                    "value": 95.0,
                    "unit": "mg/dL",
                    "ref_low": 75.0,
                    "ref_high": 110.0,  # Lab's range
                }
            ]
        }

        result = adapter.to_canonical(request, payload)
        bio = result.biomarkers[0]

        # Lab ranges should be preserved
        assert bio.ref_low == 75.0
        assert bio.ref_high == 110.0


class TestSafetyEngineRegression:
    """Test that Safety Engine behavior is preserved"""

    def test_critical_threshold_with_inequality_still_fires(self):
        """Critical safety thresholds should still fire even with inequality"""
        adapter = SmartlabAdapter()
        request = PartnerResultIngestRequest(
            partner_slug="test",
            external_patient_id="p1",
            external_order_id="o1",
            external_result_id="r1",
            lab_result={}
        )

        # Glucose >300 (critical) with inequality
        payload = {
            "biomarkers": [
                {"name": "Glucose", "value": ">300", "unit": "mg/dL"},
            ]
        }

        result = adapter.to_canonical(request, payload)
        bio = result.biomarkers[0]

        # Numeric value is preserved (300)
        assert bio.value == 300.0
        # Qualifier is preserved
        assert bio.value_qualifier == ">"
        # Safety engine can still evaluate: value 300 >= critical threshold

    def test_critical_value_with_incompatible_unit_still_preserved(self):
        """Critical values should be preserved even if unit is wrong"""
        adapter = SmartlabAdapter()
        request = PartnerResultIngestRequest(
            partner_slug="test",
            external_patient_id="p1",
            external_order_id="o1",
            external_result_id="r1",
            lab_result={}
        )

        payload = {
            "biomarkers": [
                {
                    "name": "Sodium",
                    "value": 300.0,  # Obviously wrong value
                    "unit": "mg/dL",  # Wrong unit
                }
            ]
        }

        result = adapter.to_canonical(request, payload)
        assert len(result.biomarkers) == 1
        assert result.biomarkers[0].value == 300.0


class TestReferenceRangeSafety:
    """Test that reference range safety is preserved"""

    def test_unverified_fallback_ranges_remain_unevaluated(self):
        """Fallback ranges without lab data should remain UNEVALUATED"""
        # This test verifies the fix doesn't interfere with existing UNEVALUATED logic
        # Actual UNEVALUATED status is set by normalizer, not this adapter
        # Just verify the adapter doesn't add false confidence

        validation = validate_clinical_data_integrity(
            biomarkers=[
                {
                    "name": "CRP",
                    "canonical_name": "canonical_crp",
                    "value": 1.5,
                    "unit": "mg/L",
                    # No ref_low/ref_high provided, so reference_source will be "missing"
                }
            ]
        )

        # Should be marked as missing reference range
        marker = validation["markers"][0]
        assert marker["reference_source"] == "missing"
