# Critical Value Unit Safety Audit & Fix

## Executive Summary

Production Safety Engine had critical unit-safety vulnerabilities in numeric thresholds that could allow unsafe values to bypass alerts through unit confusion. This audit identified all affected rules and implemented unit-safe replacements using existing validated conversion infrastructure.

## Audit Date
2026-09-04

## Critical Issues Found

### 1. **Glucose Thresholds (CRITICAL)**
- **Original Code**: `if "glucose" in name and ("mg/dl" in unit or unit == "") and (value >= 300 or value <= 54):`
- **Issue**: Only validated mg/dL or missing unit; accepted empty string as valid.
- **Risk**: Valid mmol/L values (e.g., 16.7 mmol/L ≈ 300 mg/dL) could bypass alert.
- **Impact**: Critical glucose levels undetected.

### 2. **LDL Thresholds (HIGH)**
- **Original Code**: `if "ldl" in name and ("mg/dl" in unit or unit == "") and value >= 190:`
- **Issue**: Only validated mg/dL or missing unit; accepted empty string as valid.
- **Risk**: Valid mmol/L values (e.g., 4.9+ mmol/L ≈ 190 mg/dL) could bypass alert.
- **Impact**: Dangerous lipid levels undetected.

### 3. **HbA1c Thresholds (MEDIUM)**
- **Original Code**: `if "hba1c" in name and value >= 9.0:`
- **Issue**: No unit validation; assumed % without checking for mmol/mol.
- **Risk**: 9 mmol/mol (≈0.84%) incorrectly compared to 9% threshold.
- **Impact**: Incompatible units could produce wrong decisions.

### 4. **ALT Thresholds (MEDIUM)**
- **Original Code**: `if (name.endswith("alt") or " alt" in name or name == "alt") and value >= 150:`
- **Issue**: No unit validation; assumed U/L without verification.
- **Risk**: Incompatible units (e.g., mg/dL, unclear origin) not caught.
- **Impact**: Enzyme elevation detection unreliable.

### 5. **AST Thresholds (MEDIUM)**
- **Original Code**: `if (name.endswith("ast") or " ast" in name or name == "ast") and value >= 120:`
- **Issue**: No unit validation; assumed U/L without verification.
- **Risk**: Incompatible units not caught.
- **Impact**: Enzyme elevation detection unreliable.

### 6. **Vitamin D Thresholds (MEDIUM)**
- **Original Code**: `if "vitamin" in name and "d" in name and value < 10 and ("ng/ml" in unit or unit == ""):`
- **Issue**: Only validated ng/mL or missing unit; accepted empty string as valid.
- **Risk**: Valid nmol/L values (e.g., 24 nmol/L ≈ 9.6 ng/mL) could bypass alert.
- **Impact**: Severe Vitamin D insufficiency undetected.

## Implementation Strategy

### Core Rule (Unit-Safe Threshold Pattern)

A unit-dependent threshold executes ONLY when:

1. **Biomarker identity** is known (marker name recognized)
2. **Unit is known** (not missing/empty)
3. **Marker/unit compatibility** is valid
4. **Value is in expected unit OR converted** via existing validated infrastructure

### Key Principles

- **Use existing conversion infrastructure**: All conversions via `/app/services/clinical_engine/units.py`
- **No duplicate coefficients**: Reuse validated factors (glucose 18.0, LDL 38.67, etc.)
- **Fail closed**: Missing/incompatible/unsupported units → no alert (safe default)
- **Cross-unit equivalence**: Equivalent values produce equivalent decisions

## Changes Made

### File Modified: `app/services/safety/safety_engine.py`

#### 1. Added Imports
```python
from app.services.clinical_engine.units import normalize_unit, convert_value
```

#### 2. Created Unit-Safe Checker Functions

| Function | Marker | Canonical Unit | Threshold | Supports |
|----------|--------|-----------------|-----------|----------|
| `_check_critical_glucose()` | glucose | mg/dL | ≥300 or ≤54 | mg/dL, mmol/L |
| `_check_critical_ldl()` | ldl | mg/dL | ≥190 | mg/dL, mmol/L |
| `_check_critical_hba1c()` | hba1c | % | ≥9.0 | % only (mmol/mol NOT comparable) |
| `_check_critical_alt()` | alt | U/L | ≥150 | U/L, IU/L |
| `_check_critical_ast()` | ast | U/L | ≥120 | U/L, IU/L |
| `_check_critical_vitamin_d()` | vitamin_d | ng/mL | <10 | ng/mL, nmol/L |

#### 3. Updated `_dangerous_lab_events()`
Replaced inline threshold checks with calls to new unit-safe functions.

Each function:
- Normalizes unit via `normalize_unit()` (handles case, synonyms, transliteration)
- **Fails closed** if unit is missing/empty
- **Fails closed** if unit is incompatible/unsupported
- Converts via `convert_value()` if in alternative supported unit
- Performs threshold comparison in canonical unit

## Test Coverage

### File Created: `tests/test_critical_value_unit_safety.py`

**63 comprehensive tests** covering:

#### Unit-Safe Checks (Per Marker)
- ✓ Canonical unit (direct path)
- ✓ Alternative supported units (conversion path)
- ✓ Missing unit (fail closed)
- ✓ Incompatible units (fail closed)
- ✓ Unsupported units (fail closed)
- ✓ Boundary values (on/off threshold)
- ✓ Case-insensitivity

#### Cross-Unit Equivalence
- ✓ 300 mg/dL ≡ 16.7 mmol/L (glucose high)
- ✓ 54 mg/dL ≡ 3.0 mmol/L (glucose low)
- ✓ 190 mg/dL ≡ 4.92 mmol/L (LDL)
- ✓ 10 ng/mL ≡ 25 nmol/L (Vitamin D boundary)

#### Integration & Regression
- ✓ `validate_report()` uses unit-safe checks
- ✓ No regressions in existing behavior
- ✓ Normal values NOT flagged
- ✓ Critical values properly flagged

### Regression Tests Passed
- `test_stage2pre_safety_baseline.py`: 2/2 ✓
- `test_extraction_integrity_fixes.py`: 35/35 ✓
- `test_health_state_engine.py`: 14/14 ✓
- `test_clinical_engine.py`: 51/51 ✓

## Validation Conversions Used

All conversions validated against existing clinical infrastructure:

```
GLUCOSE: 1 mmol/L = 18 mg/dL (physiologically verified)
  - Critical high: ≥300 mg/dL = ≥16.7 mmol/L
  - Critical low: ≤54 mg/dL = ≤3.0 mmol/L

LDL: 1 mmol/L = 38.67 mg/dL (standard lipid conversion)
  - Critical: ≥190 mg/dL = ≥4.91 mmol/L

VITAMIN D: 1 ng/mL = 2.5 nmol/L (NIH standard)
  - Critical: <10 ng/mL = <25 nmol/L

ENZYME (ALT/AST): U/L ≡ IU/L (dimensionally equivalent)
  - Accepts both units as canonical

HBAIC: % only (no conversion to mmol/mol supported)
  - mmol/mol is different scale; fails closed
```

## Fail-Closed Behavior Verified

### Missing Unit (`unit=""`)
- Glucose 300: ❌ NOT flagged (closed)
- LDL 190: ❌ NOT flagged (closed)
- HbA1c 9.0: ❌ NOT flagged (closed)
- ALT 150: ❌ NOT flagged (closed)
- AST 120: ❌ NOT flagged (closed)
- Vitamin D 9.5: ❌ NOT flagged (closed)

### Incompatible Unit
- Glucose 300 mg/kg: ❌ NOT flagged (closed)
- HbA1c 9 mmol/mol: ❌ NOT flagged (closed)
- ALT 150 mg/dL: ❌ NOT flagged (closed)

### Unsupported Unit
- LDL 190 mg/100ml: ❌ NOT flagged (closed)
- Vitamin D 10 ug/L: ❌ NOT flagged (closed)

## Cross-Unit Equivalence Verified

### Glucose
- 300 mg/dL → 16.7 mmol/L: Both trigger ✓
- 299 mg/dL → 16.6 mmol/L: Both don't trigger ✓
- 54 mg/dL → 3.0 mmol/L: Both trigger ✓
- 55 mg/dL → 3.05 mmol/L: Both don't trigger ✓

### LDL
- 190 mg/dL → 4.92 mmol/L: Both trigger ✓
- 189 mg/dL → 4.88 mmol/L: Both don't trigger ✓

### Vitamin D
- 9.9 ng/mL → 24.75 nmol/L: Both trigger ✓
- 10.1 ng/mL → 25.25 nmol/L: Both don't trigger ✓

## Non-Critical Safety Engine Rules (Unchanged)

The following rules were audited and remain unchanged because they don't have unit-specific thresholds:

- `pediatric_context` (age < 18)
- `pregnancy_context`
- `current_medications_context`
- `current_supplements_context`
- `known_allergies_context`
- `prior_diagnoses_context`
- Diagnosis-like wording detection
- Sensitive supplement dosage in pediatric/pregnancy context

These rules do not compare numeric values against unit-dependent thresholds.

## No Regressions

- ✓ Normal values NOT flagged
- ✓ Existing tests still pass (37/37)
- ✓ Clinical engine tests pass (51/51)
- ✓ Health state engine tests pass (14/14)
- ✓ Extraction integrity fixes still work (inequality operators, unit compatibility)
- ✓ Safety events still deduplicated correctly
- ✓ `validate_report()` behavior unchanged for non-unit-related checks

## Extraction Integrity Fix Still Active

The previously deployed Extraction Integrity Safety Fix (inequality operators, unit validation, plausible value checks) remains fully functional and unchanged.

## What Was NOT Added

❌ **Duplicate conversion coefficients** — all uses delegated to `clinical_engine.units`  
❌ **Invented conversion factors** — only standard clinical conversions  
❌ **Invented clinical thresholds** — all from original code  
❌ **Second conversion system** — integrated with existing infrastructure  
❌ **Special handling for missing units** — consistently fail closed  

## Summary Statistics

| Metric | Value |
|--------|-------|
| Files Modified | 1 |
| Files Created | 1 |
| Functions Added | 6 |
| Safety Rules Audited | 6 |
| Safety Rules Fixed | 6 |
| Tests Created | 63 |
| Tests Passed | 100% (63/63) |
| Regression Tests Passed | 100% (102/102) |
| Production Code Locations | 1 |
| Deployment Required | NO |

## Ready for Deployment

✓ All unit-safe critical value checks implemented  
✓ All cross-unit equivalence verified  
✓ All fail-closed scenarios tested  
✓ Existing behavior regression tested  
✓ Extraction Integrity Fix preserved  
✓ No new conversion factors added  
✓ No duplicate conversion logic  

**READY_FOR_DEPLOYMENT = YES** (when approved)

---

## Appendix A: Critical Value Thresholds Reference

### Glucose (mg/dL)
- Normal fasting: 70-99
- **Critical high**: ≥300
- **Critical low**: ≤54

### LDL (mg/dL)
- Optimal: <100
- **Critical high**: ≥190

### HbA1c (%)
- Normal: <5.7%
- Prediabetes: 5.7-6.4%
- **Critical**: ≥9.0%

### Vitamin D (ng/mL)
- Optimal: 30-50
- Insufficient: 20-29
- **Critical low**: <10

### ALT (U/L)
- Normal: 7-55
- **Critical**: ≥150

### AST (U/L)
- Normal: 10-40
- **Critical**: ≥120

---

## Appendix B: Conversion Factors Used

All factors from validated clinical infrastructure (`app/services/clinical_engine/units.py`):

```
Glucose:    18.0 (mmol/L ↔ mg/dL)
LDL:        38.67 (mmol/L ↔ mg/dL)
Vitamin D:  2.5 (nmol/L ↔ ng/mL)
Enzyme:     1.0 (U/L ≡ IU/L)
```

No custom coefficients invented.
