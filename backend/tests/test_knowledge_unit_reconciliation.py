"""Unit reconciliation in the knowledge evaluator.

Regression tests for the 2026-09-03 audit finding: _unit_matches() compared unit
strings literally and _convert_value() covered only 6 markers, so any other unit
spelling silently skipped the rule. Measured on 15 real uploads, 50% of rule atoms
whose marker was present were never evaluated -- 28 missed firings across 7 uploads,
including anemia (Hb 11.2 g/dL), low free T4 (0.72 ng/dL) and high phosphorus.

The percentage guard is the deliberate exception: % and an absolute count are
different quantities, so those atoms must keep being skipped rather than guessed.
"""

import pytest

from app.services.knowledge.evaluator import (
    _convert_value,
    _evaluate_atom,
    _normalize_unit,
    _unit_matches,
    evaluate_input_with_rules,
)


def _atom(marker, operator, value, unit):
    return {"lab_marker": marker, "operator": operator, "value": value, "unit": unit}


def _lab(marker, value, unit):
    return {marker: {"value": value, "unit": unit}}


# ---------------------------------------------------------------------------
# Spelling: the same physical unit written differently
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "cyrillic,latin",
    [
        ("г/л", "g/L"),
        ("10^9/л", "10^9/L"),
        ("10^12/л", "10^12/L"),
        ("фл", "fL"),
        ("пг", "pg"),
        ("мм/год", "mm/h"),
        ("ммоль/л", "mmol/L"),
        ("мкмоль/л", "μmol/L"),
    ],
)
def test_cyrillic_unit_is_the_same_unit_as_its_latin_spelling(cyrillic, latin):
    assert _normalize_unit(cyrillic) == _normalize_unit(latin)
    assert _unit_matches(cyrillic, latin)


@pytest.mark.parametrize(
    "vendor,canonical",
    [
        ("10^9 cells/L", "10^9/L"),
        ("x10^3/µL", "10^9/L"),
        ("10^3/uL", "10^9/L"),
        ("10^12 cells/L", "10^12/L"),
        ("x10^6/µL", "10^12/L"),
        ("mm/hr", "mm/h"),
    ],
)
def test_vendor_unit_variants_normalise_to_the_canonical_spelling(vendor, canonical):
    assert _unit_matches(vendor, canonical)


def test_anemia_rule_fires_on_a_cyrillic_lab_report():
    # Hb 90 г/л is unambiguous anemia; before the fix this atom was skipped on
    # unit_mismatch and the rule never fired for Ukrainian/Russian lab reports.
    atom = _atom("hemoglobin", "lt", 120, "g/L")
    matched, trace = _evaluate_atom(atom, _lab("hemoglobin", 90.0, "г/л"), set())
    assert matched is True
    assert trace["evaluated_value"] == 90.0


def test_critical_thrombocytopenia_fires_on_a_cyrillic_lab_report():
    atom = _atom("platelets", "lt", 100, "10^9/L")
    matched, _ = _evaluate_atom(atom, _lab("platelets", 22.0, "10^9/л"), set())
    assert matched is True


# ---------------------------------------------------------------------------
# Conversion: genuinely different units
# ---------------------------------------------------------------------------


def test_hemoglobin_in_g_per_dl_converts_and_detects_anemia():
    # 11.2 g/dL == 112 g/L, below the 120 g/L threshold. This exact value was
    # missed in production.
    atom = _atom("hemoglobin", "lt", 120, "g/L")
    matched, trace = _evaluate_atom(atom, _lab("hemoglobin", 11.2, "g/dL"), set())
    assert matched is True
    assert trace["converted"] is True
    assert trace["evaluated_value"] == pytest.approx(112.0)


def test_free_t4_in_ng_per_dl_converts_and_detects_low_value():
    # 0.72 ng/dL == 9.27 pmol/L, below the 12 pmol/L threshold.
    atom = _atom("free_t4", "lt", 12, "pmol/L")
    matched, trace = _evaluate_atom(atom, _lab("free_t4", 0.72, "ng/dL"), set())
    assert matched is True
    assert trace["evaluated_value"] == pytest.approx(9.27, abs=0.02)


def test_phosphorus_in_mg_per_dl_converts_and_detects_high_value():
    atom = _atom("phosphorus", "gt", 1.5, "mmol/L")
    matched, trace = _evaluate_atom(atom, _lab("phosphorus", 11.0, "mg/dL"), set())
    assert matched is True
    assert trace["evaluated_value"] == pytest.approx(3.55, abs=0.01)


def test_conversion_is_reversible():
    forward = _convert_value("hemoglobin", 11.2, "g/dL", "g/L")
    assert forward == pytest.approx(112.0)
    assert _convert_value("hemoglobin", forward, "g/L", "g/dL") == pytest.approx(11.2)


def test_meq_per_litre_uses_ionic_charge_not_a_blanket_alias():
    # Monovalent: 1 mEq/L == 1 mmol/L. Divalent calcium: 1 mEq/L == 0.5 mmol/L.
    # A blanket mEq/L -> mmol/L alias would double every calcium result.
    assert _convert_value("sodium", 138.0, "mEq/L", "mmol/L") == pytest.approx(138.0)
    assert _convert_value("calcium", 5.0, "mEq/L", "mmol/L") == pytest.approx(2.5)


# ---------------------------------------------------------------------------
# The percentage guard must survive
# ---------------------------------------------------------------------------


def test_percentage_is_never_compared_against_an_absolute_count():
    # Lymphocytes 24.1 % must not be read as 24.1 x10^9/L, which would trip a
    # ">4.0 x10^9/L" lymphocytosis rule on a completely normal differential.
    atom = _atom("lymphocytes", "gt", 4.0, "10^9/L")
    matched, trace = _evaluate_atom(atom, _lab("lymphocytes", 24.1, "%"), set())
    assert matched is False
    assert trace["reason"] == "unit_mismatch"


def test_no_conversion_factor_is_defined_between_percent_and_an_absolute_unit():
    assert _convert_value("lymphocytes", 24.1, "%", "10^9/L") is None
    assert _convert_value("eosinophils", 4.3, "%", "10^9/L") is None


def test_unknown_marker_unit_pair_still_refuses_to_guess():
    assert _convert_value("some_new_marker", 1.0, "mg/dL", "mmol/L") is None
    atom = _atom("some_new_marker", "gt", 1.0, "mmol/L")
    matched, trace = _evaluate_atom(atom, _lab("some_new_marker", 5.0, "mg/dL"), set())
    assert matched is False
    assert trace["reason"] == "unit_mismatch"


# ---------------------------------------------------------------------------
# A skipped atom must be visible to the caller
# ---------------------------------------------------------------------------


def test_unreconcilable_unit_is_reported_instead_of_silently_dropped():
    rules = [
        {
            "id": "r1",
            "key": "rule_high_lymphocytes",
            "active": True,
            "governance_status": "active",
            "conditions": {"all": [_atom("lymphocytes", "gt", 4.0, "10^9/L")]},
            "outputs": {},
        }
    ]
    result = evaluate_input_with_rules(
        {"lab_results": _lab("lymphocytes", 24.1, "%"), "symptoms": []}, rules
    )

    assert result["matched_rules"] == []
    assert len(result["unevaluated_markers"]) == 1
    entry = result["unevaluated_markers"][0]
    assert entry["marker"] == "lymphocytes"
    assert entry["reported_unit"] == "%"
    assert entry["expected_unit"] == "10^9/L"
    assert entry["blocked_rule_keys"] == ["rule_high_lymphocytes"]


def test_reconcilable_units_produce_no_unevaluated_entry():
    rules = [
        {
            "id": "r1",
            "key": "rule_low_hemoglobin_anemia",
            "active": True,
            "governance_status": "active",
            "conditions": {"all": [_atom("hemoglobin", "lt", 120, "g/L")]},
            "outputs": {"risk": "anemia_risk"},
        }
    ]
    result = evaluate_input_with_rules(
        {"lab_results": _lab("hemoglobin", 90.0, "г/л"), "symptoms": []}, rules
    )

    assert result["unevaluated_markers"] == []
    assert len(result["matched_rules"]) == 1
    assert result["matched_rules"][0]["rule_key"] == "rule_low_hemoglobin_anemia"


def test_unevaluated_markers_survive_the_public_entry_point(monkeypatch):
    # evaluate_input_with_rules is internal; evaluate_health_input builds its own
    # response dict, and the first version of this fix dropped the field there --
    # the whole point (a visible skip) never reached the API.
    import asyncio

    from app.services.knowledge import evaluator

    rules = [
        {
            "id": "r1",
            "key": "rule_high_lymphocytes",
            "active": True,
            "governance_status": "active",
            "conditions": {"all": [_atom("lymphocytes", "gt", 4.0, "10^9/L")]},
            "outputs": {},
        }
    ]

    async def fake_load_active_rules():
        return rules

    async def fake_load_recommendations(keys):
        return {}

    monkeypatch.setattr(evaluator, "_load_active_rules", fake_load_active_rules)
    monkeypatch.setattr(evaluator, "_load_recommendations", fake_load_recommendations)
    monkeypatch.setattr(evaluator, "build_nutrition_kb_context", lambda *a, **k: {})

    result = asyncio.run(
        evaluator.evaluate_health_input(
            {"lab_results": _lab("lymphocytes", 24.1, "%"), "symptoms": []},
            persist=False,
        )
    )

    assert "unevaluated_markers" in result
    assert result["unevaluated_markers"][0]["marker"] == "lymphocytes"


def test_normal_value_reports_neither_a_match_nor_an_unevaluated_marker():
    # The healthy CBC that motivated the audit: 0 matched rules here is the
    # correct answer, and it must be distinguishable from "never checked".
    rules = [
        {
            "id": "r1",
            "key": "rule_low_hemoglobin_anemia",
            "active": True,
            "governance_status": "active",
            "conditions": {"all": [_atom("hemoglobin", "lt", 120, "g/L")]},
            "outputs": {},
        }
    ]
    result = evaluate_input_with_rules(
        {"lab_results": _lab("hemoglobin", 143.0, "g/L"), "symptoms": []}, rules
    )

    assert result["matched_rules"] == []
    assert result["unevaluated_markers"] == []
