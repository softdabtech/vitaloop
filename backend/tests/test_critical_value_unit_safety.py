"""
Unit-safe critical value threshold tests.

Verifies that all Safety Engine numeric thresholds validate unit compatibility
and produce equivalent safety decisions across unit conversions.

Test coverage:
- Expected/canonical unit (canonical path)
- Validated alternative units (conversion path)
- Missing unit (fail closed)
- Incompatible unit (fail closed)
- Unsupported unit (fail closed)
- Threshold boundaries
- Inequality semantics (cross-unit equivalence)
"""

import pytest

from app.services.safety.safety_engine import (
    _check_critical_glucose,
    _check_critical_ldl,
    _check_critical_hba1c,
    _check_critical_alt,
    _check_critical_ast,
    _check_critical_vitamin_d,
    validate_report,
)


class TestCriticalGlucoseUnitSafety:
    """Test unit-safe glucose critical value detection (>=300 or <=54 mg/dL)."""

    def test_glucose_critical_high_canonical_unit(self):
        """300 mg/dL should trigger critical alert."""
        assert _check_critical_glucose(300, "mg/dL") is True
        assert _check_critical_glucose(301, "mg/dL") is True
        assert _check_critical_glucose(400, "mg/dL") is True

    def test_glucose_critical_low_canonical_unit(self):
        """54 mg/dL should trigger critical alert."""
        assert _check_critical_glucose(54, "mg/dL") is True
        assert _check_critical_glucose(53, "mg/dL") is True
        assert _check_critical_glucose(30, "mg/dL") is True

    def test_glucose_safe_range_canonical_unit(self):
        """Values between 55-299 mg/dL should NOT trigger alert."""
        assert _check_critical_glucose(70, "mg/dL") is False
        assert _check_critical_glucose(100, "mg/dL") is False
        assert _check_critical_glucose(200, "mg/dL") is False
        assert _check_critical_glucose(299, "mg/dL") is False
        assert _check_critical_glucose(55, "mg/dL") is False

    def test_glucose_critical_high_mmol_l_conversion(self):
        """16.7 mmol/L (≈300 mg/dL) should trigger alert via conversion."""
        # 300 mg/dL / 18 = 16.67 mmol/L
        assert _check_critical_glucose(16.7, "mmol/L") is True
        assert _check_critical_glucose(17.0, "mmol/L") is True
        assert _check_critical_glucose(22.0, "mmol/L") is True

    def test_glucose_critical_low_mmol_l_conversion(self):
        """3.0 mmol/L (≈54 mg/dL) should trigger alert via conversion."""
        # 54 mg/dL / 18 = 3.0 mmol/L
        assert _check_critical_glucose(3.0, "mmol/L") is True
        assert _check_critical_glucose(2.5, "mmol/L") is True
        assert _check_critical_glucose(1.0, "mmol/L") is True

    def test_glucose_safe_range_mmol_l_conversion(self):
        """Values between 3.0-16.7 mmol/L should NOT trigger alert."""
        assert _check_critical_glucose(3.5, "mmol/L") is False
        assert _check_critical_glucose(5.5, "mmol/L") is False
        assert _check_critical_glucose(10.0, "mmol/L") is False
        assert _check_critical_glucose(15.0, "mmol/L") is False
        assert _check_critical_glucose(16.6, "mmol/L") is False

    def test_glucose_missing_unit_fail_closed(self):
        """Missing unit should fail closed (return False) even for critical values."""
        assert _check_critical_glucose(300, "") is False
        assert _check_critical_glucose(350, "") is False
        assert _check_critical_glucose(54, "") is False

    def test_glucose_incompatible_unit_fail_closed(self):
        """Incompatible unit should fail closed."""
        assert _check_critical_glucose(300, "mmol/mol") is False  # Wrong unit for glucose
        assert _check_critical_glucose(300, "%") is False
        assert _check_critical_glucose(300, "g/L") is False

    def test_glucose_unsupported_unit_fail_closed(self):
        """Unsupported but plausible unit should fail closed."""
        assert _check_critical_glucose(300, "mg/100ml") is False
        assert _check_critical_glucose(300, "unknown") is False

    def test_glucose_case_insensitive_unit(self):
        """Unit matching should be case-insensitive."""
        assert _check_critical_glucose(300, "mg/DL") is True
        assert _check_critical_glucose(300, "MG/DL") is True
        assert _check_critical_glucose(16.7, "MMOL/L") is True


class TestCriticalLDLUnitSafety:
    """Test unit-safe LDL critical value detection (>=190 mg/dL)."""

    def test_ldl_critical_high_canonical_unit(self):
        """190 mg/dL should trigger critical alert."""
        assert _check_critical_ldl(190, "mg/dL") is True
        assert _check_critical_ldl(191, "mg/dL") is True
        assert _check_critical_ldl(300, "mg/dL") is True

    def test_ldl_safe_range_canonical_unit(self):
        """Values below 190 mg/dL should NOT trigger alert."""
        assert _check_critical_ldl(100, "mg/dL") is False
        assert _check_critical_ldl(150, "mg/dL") is False
        assert _check_critical_ldl(189, "mg/dL") is False

    def test_ldl_critical_high_mmol_l_conversion(self):
        """4.92 mmol/L (≈190 mg/dL) should trigger alert via conversion."""
        # 190 mg/dL / 38.67 = 4.912 mmol/L
        assert _check_critical_ldl(4.92, "mmol/L") is True
        assert _check_critical_ldl(5.0, "mmol/L") is True
        assert _check_critical_ldl(6.0, "mmol/L") is True

    def test_ldl_safe_range_mmol_l_conversion(self):
        """Values below 4.9 mmol/L should NOT trigger alert."""
        assert _check_critical_ldl(3.0, "mmol/L") is False
        assert _check_critical_ldl(4.5, "mmol/L") is False
        assert _check_critical_ldl(4.8, "mmol/L") is False

    def test_ldl_missing_unit_fail_closed(self):
        """Missing unit should fail closed."""
        assert _check_critical_ldl(190, "") is False
        assert _check_critical_ldl(200, "") is False

    def test_ldl_incompatible_unit_fail_closed(self):
        """Incompatible unit should fail closed."""
        assert _check_critical_ldl(190, "%") is False
        assert _check_critical_ldl(190, "g/L") is False


class TestCriticalHbA1cUnitSafety:
    """Test unit-safe HbA1c critical value detection (>=9.0%)."""

    def test_hba1c_critical_high_canonical_unit_percent(self):
        """9.0% should trigger critical alert."""
        assert _check_critical_hba1c(9.0, "%") is True
        assert _check_critical_hba1c(9.5, "%") is True
        assert _check_critical_hba1c(10.0, "%") is True

    def test_hba1c_safe_range_canonical_unit_percent(self):
        """Values below 9.0% should NOT trigger alert."""
        assert _check_critical_hba1c(5.0, "%") is False
        assert _check_critical_hba1c(7.0, "%") is False
        assert _check_critical_hba1c(8.9, "%") is False

    def test_hba1c_mmol_mol_not_comparable(self):
        """mmol/mol is NOT comparable to %. 9 mmol/mol ≠ 9%."""
        # 9 mmol/mol is approximately 0.84% (different scale)
        # This should fail closed, not convert
        assert _check_critical_hba1c(9, "mmol/mol") is False
        assert _check_critical_hba1c(100, "mmol/mol") is False

    def test_hba1c_missing_unit_fail_closed(self):
        """Missing unit should fail closed."""
        assert _check_critical_hba1c(9.0, "") is False
        assert _check_critical_hba1c(10.0, "") is False

    def test_hba1c_incompatible_unit_fail_closed(self):
        """Incompatible unit should fail closed."""
        assert _check_critical_hba1c(9.0, "mg/dL") is False
        assert _check_critical_hba1c(9.0, "mmol/L") is False

    def test_hba1c_percent_variants_accepted(self):
        """Various percent representations should be accepted."""
        assert _check_critical_hba1c(9.0, "percent") is True
        assert _check_critical_hba1c(9.0, "pct") is True


class TestCriticalALTUnitSafety:
    """Test unit-safe ALT critical value detection (>=150 U/L)."""

    def test_alt_critical_high_canonical_unit(self):
        """150 U/L should trigger critical alert."""
        assert _check_critical_alt(150, "U/L") is True
        assert _check_critical_alt(151, "U/L") is True
        assert _check_critical_alt(200, "U/L") is True

    def test_alt_safe_range_canonical_unit(self):
        """Values below 150 U/L should NOT trigger alert."""
        assert _check_critical_alt(40, "U/L") is False
        assert _check_critical_alt(100, "U/L") is False
        assert _check_critical_alt(149, "U/L") is False

    def test_alt_iu_l_variant_accepted(self):
        """IU/L should be accepted as equivalent to U/L."""
        assert _check_critical_alt(150, "IU/L") is True
        assert _check_critical_alt(100, "IU/L") is False

    def test_alt_missing_unit_fail_closed(self):
        """Missing unit should fail closed."""
        assert _check_critical_alt(150, "") is False
        assert _check_critical_alt(200, "") is False

    def test_alt_incompatible_unit_fail_closed(self):
        """Incompatible unit should fail closed."""
        assert _check_critical_alt(150, "mg/dL") is False
        assert _check_critical_alt(150, "%") is False


class TestCriticalASTUnitSafety:
    """Test unit-safe AST critical value detection (>=120 U/L)."""

    def test_ast_critical_high_canonical_unit(self):
        """120 U/L should trigger critical alert."""
        assert _check_critical_ast(120, "U/L") is True
        assert _check_critical_ast(121, "U/L") is True
        assert _check_critical_ast(200, "U/L") is True

    def test_ast_safe_range_canonical_unit(self):
        """Values below 120 U/L should NOT trigger alert."""
        assert _check_critical_ast(40, "U/L") is False
        assert _check_critical_ast(100, "U/L") is False
        assert _check_critical_ast(119, "U/L") is False

    def test_ast_iu_l_variant_accepted(self):
        """IU/L should be accepted as equivalent to U/L."""
        assert _check_critical_ast(120, "IU/L") is True
        assert _check_critical_ast(100, "IU/L") is False

    def test_ast_missing_unit_fail_closed(self):
        """Missing unit should fail closed."""
        assert _check_critical_ast(120, "") is False
        assert _check_critical_ast(200, "") is False

    def test_ast_incompatible_unit_fail_closed(self):
        """Incompatible unit should fail closed."""
        assert _check_critical_ast(120, "mg/dL") is False
        assert _check_critical_ast(120, "%") is False


class TestCriticalVitaminDUnitSafety:
    """Test unit-safe Vitamin D critical value detection (<10 ng/mL)."""

    def test_vitamin_d_critical_low_canonical_unit(self):
        """Values < 10 ng/mL should trigger critical alert."""
        assert _check_critical_vitamin_d(9.9, "ng/mL") is True
        assert _check_critical_vitamin_d(9, "ng/mL") is True
        assert _check_critical_vitamin_d(5, "ng/mL") is True

    def test_vitamin_d_safe_range_canonical_unit(self):
        """Values >= 10 ng/mL should NOT trigger alert."""
        assert _check_critical_vitamin_d(10, "ng/mL") is False
        assert _check_critical_vitamin_d(10.1, "ng/mL") is False
        assert _check_critical_vitamin_d(20, "ng/mL") is False
        assert _check_critical_vitamin_d(50, "ng/mL") is False

    def test_vitamin_d_critical_low_nmol_l_conversion(self):
        """< 25 nmol/L (≈ < 10 ng/mL) should trigger alert via conversion."""
        # 10 ng/mL * 2.5 = 25 nmol/L (boundary, not included)
        # 9.9 ng/mL * 2.5 = 24.75 nmol/L (triggers)
        assert _check_critical_vitamin_d(24.75, "nmol/L") is True
        assert _check_critical_vitamin_d(20, "nmol/L") is True
        assert _check_critical_vitamin_d(10, "nmol/L") is True

    def test_vitamin_d_safe_range_nmol_l_conversion(self):
        """Values >= 25 nmol/L should NOT trigger alert."""
        assert _check_critical_vitamin_d(25, "nmol/L") is False
        assert _check_critical_vitamin_d(25.1, "nmol/L") is False
        assert _check_critical_vitamin_d(50, "nmol/L") is False
        assert _check_critical_vitamin_d(100, "nmol/L") is False

    def test_vitamin_d_missing_unit_fail_closed(self):
        """Missing unit should fail closed."""
        assert _check_critical_vitamin_d(10, "") is False
        assert _check_critical_vitamin_d(5, "") is False

    def test_vitamin_d_incompatible_unit_fail_closed(self):
        """Incompatible unit should fail closed."""
        assert _check_critical_vitamin_d(10, "mg/dL") is False
        assert _check_critical_vitamin_d(10, "%") is False


class TestCrossUnitEquivalenceSemanticsGlucose:
    """Verify cross-unit equivalent values produce equivalent safety decisions (glucose)."""

    def test_glucose_equivalence_high_threshold(self):
        """300 mg/dL and 16.7 mmol/L should both trigger."""
        mg_dl_result = _check_critical_glucose(300, "mg/dL")
        mmol_l_result = _check_critical_glucose(16.7, "mmol/L")
        assert mg_dl_result is True
        assert mmol_l_result is True
        assert mg_dl_result == mmol_l_result

    def test_glucose_equivalence_just_below_threshold_high(self):
        """299 mg/dL and 16.6 mmol/L should both NOT trigger."""
        mg_dl_result = _check_critical_glucose(299, "mg/dL")
        mmol_l_result = _check_critical_glucose(16.6, "mmol/L")
        assert mg_dl_result is False
        assert mmol_l_result is False
        assert mg_dl_result == mmol_l_result

    def test_glucose_equivalence_low_threshold(self):
        """54 mg/dL and 3.0 mmol/L should both trigger."""
        mg_dl_result = _check_critical_glucose(54, "mg/dL")
        mmol_l_result = _check_critical_glucose(3.0, "mmol/L")
        assert mg_dl_result is True
        assert mmol_l_result is True
        assert mg_dl_result == mmol_l_result

    def test_glucose_equivalence_just_above_threshold_low(self):
        """55 mg/dL and 3.1 mmol/L should both NOT trigger."""
        mg_dl_result = _check_critical_glucose(55, "mg/dL")
        mmol_l_result = _check_critical_glucose(3.1, "mmol/L")
        assert mg_dl_result is False
        assert mmol_l_result is False
        assert mg_dl_result == mmol_l_result


class TestCrossUnitEquivalenceSemanticsLDL:
    """Verify cross-unit equivalent values produce equivalent safety decisions (LDL)."""

    def test_ldl_equivalence_threshold(self):
        """190 mg/dL and 4.92 mmol/L should both trigger."""
        mg_dl_result = _check_critical_ldl(190, "mg/dL")
        mmol_l_result = _check_critical_ldl(4.92, "mmol/L")
        assert mg_dl_result is True
        assert mmol_l_result is True
        assert mg_dl_result == mmol_l_result

    def test_ldl_equivalence_just_below_threshold(self):
        """189 mg/dL and 4.88 mmol/L should both NOT trigger."""
        mg_dl_result = _check_critical_ldl(189, "mg/dL")
        mmol_l_result = _check_critical_ldl(4.88, "mmol/L")
        assert mg_dl_result is False
        assert mmol_l_result is False
        assert mg_dl_result == mmol_l_result


class TestCrossUnitEquivalenceSemanticsVitaminD:
    """Verify cross-unit equivalent values produce equivalent safety decisions (Vitamin D)."""

    def test_vitamin_d_equivalence_threshold(self):
        """9.9 ng/mL and 24.75 nmol/L should both trigger (both < 10 ng/mL / < 25 nmol/L)."""
        ng_ml_result = _check_critical_vitamin_d(9.9, "ng/mL")
        nmol_l_result = _check_critical_vitamin_d(24.75, "nmol/L")
        assert ng_ml_result is True
        assert nmol_l_result is True
        assert ng_ml_result == nmol_l_result

    def test_vitamin_d_equivalence_just_above_threshold(self):
        """10.1 ng/mL and 25.3 nmol/L should both NOT trigger."""
        ng_ml_result = _check_critical_vitamin_d(10.1, "ng/mL")
        nmol_l_result = _check_critical_vitamin_d(25.3, "nmol/L")
        assert ng_ml_result is False
        assert nmol_l_result is False
        assert ng_ml_result == nmol_l_result


class TestValidateReportWithUnitSafeCriticalValues:
    """Integration tests: validate_report() uses unit-safe critical value detection."""

    def test_glucose_critical_high_mg_dl(self):
        """Report with 300 mg/dL glucose should flag critical event."""
        result = validate_report(
            biomarkers=[{"name": "glucose", "value": 300, "unit": "mg/dL"}],
        )
        assert any(e["key"] == "dangerous_glucose" for e in result["safety_events"])
        assert any(e["severity"] == "critical" for e in result["safety_events"])

    def test_glucose_critical_high_mmol_l(self):
        """Report with 16.7 mmol/L glucose should flag critical event."""
        result = validate_report(
            biomarkers=[{"name": "glucose", "value": 16.7, "unit": "mmol/L"}],
        )
        assert any(e["key"] == "dangerous_glucose" for e in result["safety_events"])
        assert any(e["severity"] == "critical" for e in result["safety_events"])

    def test_glucose_missing_unit_not_flagged(self):
        """Report with 300 glucose but no unit should NOT flag critical."""
        result = validate_report(
            biomarkers=[{"name": "glucose", "value": 300, "unit": ""}],
        )
        assert not any(e["key"] == "dangerous_glucose" for e in result["safety_events"])

    def test_ldl_critical_high_mg_dl(self):
        """Report with 190 mg/dL LDL should flag event."""
        result = validate_report(
            biomarkers=[{"name": "ldl", "value": 190, "unit": "mg/dL"}],
        )
        assert any(e["key"] == "dangerous_ldl" for e in result["safety_events"])

    def test_ldl_critical_high_mmol_l(self):
        """Report with 4.92 mmol/L LDL should flag event."""
        result = validate_report(
            biomarkers=[{"name": "ldl", "value": 4.92, "unit": "mmol/L"}],
        )
        assert any(e["key"] == "dangerous_ldl" for e in result["safety_events"])

    def test_hba1c_critical_percent(self):
        """Report with 9.0% HbA1c should flag event."""
        result = validate_report(
            biomarkers=[{"name": "hba1c", "value": 9.0, "unit": "%"}],
        )
        assert any(e["key"] == "dangerous_hba1c" for e in result["safety_events"])

    def test_hba1c_mmol_mol_not_flagged(self):
        """Report with 9 mmol/mol HbA1c should NOT flag (incompatible unit)."""
        result = validate_report(
            biomarkers=[{"name": "hba1c", "value": 9, "unit": "mmol/mol"}],
        )
        assert not any(e["key"] == "dangerous_hba1c" for e in result["safety_events"])

    def test_alt_critical_u_l(self):
        """Report with 150 U/L ALT should flag event."""
        result = validate_report(
            biomarkers=[{"name": "alt", "value": 150, "unit": "U/L"}],
        )
        assert any(e["key"] == "dangerous_alt" for e in result["safety_events"])

    def test_ast_critical_u_l(self):
        """Report with 120 U/L AST should flag event."""
        result = validate_report(
            biomarkers=[{"name": "ast", "value": 120, "unit": "U/L"}],
        )
        assert any(e["key"] == "dangerous_ast" for e in result["safety_events"])

    def test_vitamin_d_critical_ng_ml(self):
        """Report with 9.9 ng/mL Vitamin D should flag event."""
        result = validate_report(
            biomarkers=[{"name": "vitamin d", "value": 9.9, "unit": "ng/mL"}],
        )
        assert any(e["key"] == "severe_vitamin_d" for e in result["safety_events"])

    def test_vitamin_d_critical_nmol_l(self):
        """Report with 24.75 nmol/L Vitamin D should flag event."""
        result = validate_report(
            biomarkers=[{"name": "vitamin d", "value": 24.75, "unit": "nmol/L"}],
        )
        assert any(e["key"] == "severe_vitamin_d" for e in result["safety_events"])


class TestNoRegressionInExistingBehavior:
    """Ensure unit-safe fixes don't regress existing behavior."""

    def test_normal_glucose_not_flagged(self):
        """Normal glucose values should NOT be flagged."""
        result = validate_report(
            biomarkers=[{"name": "glucose", "value": 100, "unit": "mg/dL"}],
        )
        assert not any(e["key"] == "dangerous_glucose" for e in result["safety_events"])

    def test_normal_ldl_not_flagged(self):
        """Normal LDL values should NOT be flagged."""
        result = validate_report(
            biomarkers=[{"name": "ldl", "value": 130, "unit": "mg/dL"}],
        )
        assert not any(e["key"] == "dangerous_ldl" for e in result["safety_events"])

    def test_normal_hba1c_not_flagged(self):
        """Normal HbA1c values should NOT be flagged."""
        result = validate_report(
            biomarkers=[{"name": "hba1c", "value": 6.0, "unit": "%"}],
        )
        assert not any(e["key"] == "dangerous_hba1c" for e in result["safety_events"])

    def test_normal_alt_not_flagged(self):
        """Normal ALT values should NOT be flagged."""
        result = validate_report(
            biomarkers=[{"name": "alt", "value": 40, "unit": "U/L"}],
        )
        assert not any(e["key"] == "dangerous_alt" for e in result["safety_events"])

    def test_normal_ast_not_flagged(self):
        """Normal AST values should NOT be flagged."""
        result = validate_report(
            biomarkers=[{"name": "ast", "value": 40, "unit": "U/L"}],
        )
        assert not any(e["key"] == "dangerous_ast" for e in result["safety_events"])

    def test_normal_vitamin_d_not_flagged(self):
        """Normal Vitamin D values should NOT be flagged."""
        result = validate_report(
            biomarkers=[{"name": "vitamin d", "value": 30, "unit": "ng/mL"}],
        )
        assert not any(e["key"] == "severe_vitamin_d" for e in result["safety_events"])
