"""Clinical signal accounting: every input marker must have an accounted outcome.

Regression tests for the 2026-09-03 bottleneck audit. Measured on the 15 uploads
stored in report_versions, a correct marker with a correct value could reach the
evaluator and produce nothing at all, for three separate reasons:

  1. to_canonical_name() was an exact-match dictionary, so a lab's decorated name
     ("TSH (Thyroid Stimulating Hormone)", "Iron (Serum)") slugified into a key no
     rule references -- 55 marker instances, including TSH 5.8 uIU/mL against an
     active >=4.5 rule.
  2. A differential reported both as a percentage and as an absolute count
     collapsed onto one key, and first-seen won -- which is the percentage row,
     the one the evaluator deliberately refuses to compare.
  3. The lab's own reference-range signal was emitted only when the knowledge base
     found nothing, so one rule match dropped every marker the lab had flagged.

The percentage guard itself is not a bug and must survive all three fixes.
"""

import pytest

from app.services.knowledge.evaluator import evaluate_input_with_rules
from app.services.knowledge.integration import biomarkers_to_knowledge_lab_results
from app.services.knowledge.report import build_knowledge_report
from app.services.lab_analysis_pipeline import _prioritize_biomarkers, _risk_flags
from app.services.lab_normalization.biomarker_mapping import to_canonical_name


# ---------------------------------------------------------------------------
# 1. Canonical names: parenthetical qualifiers
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "lab_name,expected",
    [
        # The parenthetical expands an abbreviation that is itself a known marker.
        ("TSH (Thyroid Stimulating Hormone)", "tsh"),
        ("White Blood Cells (WBC)", "wbc"),
        ("Red Blood Cells (RBC)", "rbc"),
        ("ALT (Alanine Aminotransferase)", "alt"),
        ("AST (Aspartate Aminotransferase)", "ast"),
        ("C-Reactive Protein (CRP)", "crp"),
        ("Blood Urea Nitrogen (BUN)", "bun"),
        # The parenthetical only names the sample matrix or restates the analyte.
        ("Iron (Serum)", "iron"),
        ("Folate (Serum)", "folate"),
        ("Glucose (Fasting)", "glucose"),
        ("eGFR (Kidney Function)", "egfr"),
        # Spelled-out names of markers the KB knows only by abbreviation.
        ("Erythrocyte Sedimentation Rate", "esr"),
        ("Alkaline Phosphatase", "alp"),
        ("Bilirubin (Total)", "bilirubin_total"),
    ],
)
def test_decorated_lab_names_resolve_to_the_knowledge_base_marker(lab_name, expected):
    assert to_canonical_name(lab_name) == expected


@pytest.mark.parametrize(
    "lab_name",
    [
        # "Random" is not a neutral qualifier: the KB's only glucose rule is
        # rule_elevated_fasting_glucose, and a fasting threshold must not be
        # applied to a random sample.
        "Glucose (Random)",
        # These qualifiers name a different analyte, not a different sample.
        "Testosterone (Free)",
        "Bilirubin (Direct)",
        "Vitamin D (1,25-OH)",
    ],
)
def test_qualifiers_that_change_the_analyte_do_not_collapse_onto_the_stem(lab_name):
    stem = to_canonical_name(lab_name.split(" (")[0])
    assert to_canonical_name(lab_name) != stem


def test_an_unknown_marker_still_slugifies_and_is_never_guessed():
    assert to_canonical_name("Beta-2 Microglobulin (Serum)") == "beta_2_microglobulin_(serum)"


# ---------------------------------------------------------------------------
# 2. Percentage vs absolute count for the same analyte
# ---------------------------------------------------------------------------


def _row(name, value, unit, status="BORDERLINE"):
    # P0 Reference Safety Fix: Changed default from OPTIMAL to BORDERLINE
    # Tests using this helper are about unit handling and marker coverage, not status classification
    # BORDERLINE is an eligible status that reaches KB evaluation, preserving test intent
    return {"name": name, "value": value, "unit": unit, "status": status}


def test_absolute_count_wins_over_percentage_for_the_same_analyte():
    # Labs print the percentage first, so first-seen kept the one value the
    # evaluator cannot use and discarded the one it can.
    lab_results = biomarkers_to_knowledge_lab_results(
        [
            _row("Lymphocytes Percentage", 38.0, "%"),
            _row("Absolute Lymphocytes", 5.66, "10^9 cells/L"),
        ]
    )
    assert lab_results["lymphocytes"]["value"] == 5.66
    assert lab_results["lymphocytes"]["unit"] == "10^9 cells/L"


def test_lymphocytosis_rule_fires_once_the_absolute_count_survives():
    rules = [
        {
            "id": "r1",
            "key": "rule_high_lymphocytes",
            "active": True,
            "governance_status": "active",
            "input_entities": ["lymphocytes"],
            "conditions": {
                "all": [
                    {"lab_marker": "lymphocytes", "operator": "gt", "value": 4.0, "unit": "10^9/L"}
                ]
            },
            "outputs": {},
        }
    ]
    lab_results = biomarkers_to_knowledge_lab_results(
        [
            _row("Lymphocytes Percentage", 38.0, "%"),
            _row("Absolute Lymphocytes", 5.66, "10^9 cells/L"),
        ]
    )
    result = evaluate_input_with_rules({"lab_results": lab_results, "symptoms": []}, rules)
    assert [rule["rule_key"] for rule in result["matched_rules"]] == ["rule_high_lymphocytes"]


def test_a_percentage_alone_is_still_refused_rather_than_guessed():
    rules = [
        {
            "id": "r1",
            "key": "rule_high_lymphocytes",
            "active": True,
            "governance_status": "active",
            "input_entities": ["lymphocytes"],
            "conditions": {
                "all": [
                    {"lab_marker": "lymphocytes", "operator": "gt", "value": 4.0, "unit": "10^9/L"}
                ]
            },
            "outputs": {},
        }
    ]
    lab_results = biomarkers_to_knowledge_lab_results([_row("Lymphocytes Percentage", 38.0, "%")])
    result = evaluate_input_with_rules({"lab_results": lab_results, "symptoms": []}, rules)
    assert result["matched_rules"] == []
    assert result["unevaluated_markers"][0]["marker"] == "lymphocytes"
    assert result["marker_coverage"]["unit_blocked"] == ["lymphocytes"]


# ---------------------------------------------------------------------------
# 3. Marker coverage: no marker may be silently absent from the accounting
# ---------------------------------------------------------------------------


def _rule(key, marker, operator, value, unit):
    return {
        "id": key,
        "key": key,
        "active": True,
        "governance_status": "active",
        "input_entities": [marker],
        "conditions": {"all": [{"lab_marker": marker, "operator": operator, "value": value, "unit": unit}]},
        "outputs": {},
    }


def test_every_input_marker_lands_in_exactly_one_coverage_bucket():
    rules = [
        _rule("rule_high_tsh", "tsh", "gte", 4.5, "uIU/mL"),
        _rule("rule_high_lymphocytes", "lymphocytes", "gt", 4.0, "10^9/L"),
    ]
    lab_results = biomarkers_to_knowledge_lab_results(
        [
            _row("TSH (Thyroid Stimulating Hormone)", 5.8, "uIU/mL"),
            _row("Lymphocytes Percentage", 38.0, "%"),
            _row("Hematocrit", 34.0, "%"),
        ]
    )
    coverage = evaluate_input_with_rules({"lab_results": lab_results, "symptoms": []}, rules)["marker_coverage"]

    assert coverage["evaluated"] == ["tsh"]
    assert coverage["unit_blocked"] == ["lymphocytes"]
    assert coverage["no_matching_rule"] == ["hematocrit"]
    assert coverage["fired"] == ["tsh"]

    buckets = coverage["evaluated"] + coverage["unit_blocked"] + coverage["no_matching_rule"]
    assert sorted(buckets) == sorted(lab_results)


def test_marker_coverage_reaches_the_knowledge_report():
    # It used to travel only inside knowledge_evaluation, so no report surface
    # could tell the reader which markers the knowledge base actually looked at.
    report = build_knowledge_report(
        biomarkers=[_row("Hematocrit", 34.0, "%", status="DEFICIENT")],
        knowledge_evaluation={
            "matched_rules": [],
            "marker_coverage": {"evaluated": [], "no_matching_rule": ["hematocrit"], "unit_blocked": [], "fired": []},
            "unevaluated_markers": [],
        },
    )
    assert report["marker_coverage"]["no_matching_rule"] == ["hematocrit"]
    assert "unevaluated_markers" in report


# ---------------------------------------------------------------------------
# 4. The lab's own reference range is a separate signal from a KB rule
# ---------------------------------------------------------------------------


def test_lab_range_flags_survive_alongside_a_knowledge_rule_match():
    # KB thresholds are deliberately wider than a lab's range (LDL >=130 mg/dL vs
    # a lab high of 99), so a report with one rule match used to drop every marker
    # the lab itself had flagged.
    knowledge_report = {
        "safety_alerts": [],
        "why_it_matters": [{"rule_key": "rule_high_tsh", "severity": "moderate", "title": "TSH elevated", "summary": "x"}],
    }
    prioritized = _prioritize_biomarkers(
        [
            {"name": "LDL Cholesterol", "canonical_name": "canonical_ldl", "value": 105.0,
             "unit": "mg/dL", "status": "ELEVATED", "category": "metabolic", "ref_low": None, "ref_high": 99.0},
        ]
    )
    flags = _risk_flags(knowledge_report, prioritized)

    types = [flag["type"] for flag in flags]
    assert "knowledge_rule" in types
    assert "biomarker_flag" in types
    assert any(flag.get("biomarker") == "canonical_ldl" for flag in flags)


def test_a_marker_is_not_flagged_twice_by_both_signals():
    knowledge_report = {
        "safety_alerts": [
            {"marker": "canonical_ldl", "message": "Requires medical review."}
        ],
        "why_it_matters": [],
    }
    prioritized = _prioritize_biomarkers(
        [
            {"name": "LDL Cholesterol", "canonical_name": "canonical_ldl", "value": 200.0,
             "unit": "mg/dL", "status": "ELEVATED", "category": "metabolic", "ref_low": None, "ref_high": 99.0},
        ]
    )
    flags = _risk_flags(knowledge_report, prioritized)
    ldl_flags = [flag for flag in flags if str(flag.get("biomarker")) == "canonical_ldl"]
    assert len(ldl_flags) == 1
    assert ldl_flags[0]["type"] == "safety_alert"


# ---------------------------------------------------------------------------
# 5. Truncation must not silently contradict the counts shown beside it
# ---------------------------------------------------------------------------


def test_fired_rules_are_not_cut_to_eight_findings():
    matched = [
        {"rule_key": f"rule_{index}", "name": f"Finding {index}", "summary": "s",
         "explanation": "e", "severity": "moderate", "confidence": 0.5}
        for index in range(20)
    ]
    report = build_knowledge_report(biomarkers=[], knowledge_evaluation={"matched_rules": matched})
    assert len(report["why_it_matters"]) == 20


# ---------------------------------------------------------------------------
# 6. A marker with no lab-supplied range must not be invented into "needs review"
# ---------------------------------------------------------------------------


def test_missing_lab_range_falls_back_to_the_reference_table():
    from app.services.lab_analysis_pipeline import normalize_biomarkers

    # CRP 1.52 mg/L with no range printed by the lab falls back to VITALOOP table
    # BUT the fallback range is unverified (no documented source/version/date)
    # So status is UNEVALUATED, not OPTIMAL (safety: prevent silent use of unverified ranges)
    result = normalize_biomarkers([{"name": "C-Reactive Protein", "value": 1.52, "unit": "mg/L"}])
    assert result[0]["reference_source"] == "vitaloop_reference_table"
    assert result[0]["ref_high"] is not None
    assert result[0]["status"] == "UNEVALUATED"
    assert result[0]["unevaluated_reason"] == "unverified_reference_interval"


def test_a_lab_supplied_range_always_wins_over_the_fallback():
    from app.services.lab_analysis_pipeline import normalize_biomarkers

    result = normalize_biomarkers(
        [{"name": "Hemoglobin", "value": 118.0, "unit": "g/L", "ref_low": 120.0, "ref_high": 140.0}]
    )
    assert result[0]["reference_source"] == "lab_report"
    assert (result[0]["ref_low"], result[0]["ref_high"]) == (120.0, 140.0)
    assert result[0]["status"] == "DEFICIENT"


def test_a_marker_the_reference_table_does_not_cover_keeps_the_old_behaviour():
    from app.services.lab_analysis_pipeline import normalize_biomarkers

    result = normalize_biomarkers([{"name": "Ceruloplasmin", "value": 0.31, "unit": "g/L"}])
    assert result[0]["reference_source"] is None
    assert result[0]["ref_low"] is None and result[0]["ref_high"] is None


def test_reference_bounds_resolve_across_equivalent_unit_spellings():
    from app.services.biomarker_reference import resolve_status_bounds

    # The table stores "x10^9/L"; labs write "10^9 cells/L".
    assert resolve_status_bounds("wbc", "10^9 cells/L", None) == resolve_status_bounds("wbc", "x10^9/L", None)
    assert resolve_status_bounds("wbc", "10^9 cells/L", None) is not None


def test_a_comprehensive_panel_is_not_cut_to_eight_flagged_markers():
    biomarkers = [
        _row(f"Marker {index}", 1.0, "mg/L", status="ELEVATED")
        for index in range(20)
    ]
    for item in biomarkers:
        item["canonical_name"] = to_canonical_name(item["name"])
    report = build_knowledge_report(biomarkers=biomarkers, knowledge_evaluation={})

    counts = report["what_was_found"]["counts"]
    review = counts["deficient"] + counts["elevated"] + counts["borderline"]
    assert review == 20
    assert len(report["what_was_found"]["flagged_markers"]) == 20
