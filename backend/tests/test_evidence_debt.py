"""P22: Evidence Debt Score (app/services/evidence_debt.py).

Deterministic, no LLM. Covers domain debt scoring, deduplication of top
debt reducers, empty-input handling, and forbidden-wording absence.
"""

from app.services.evidence_debt import build_evidence_debt


_FORBIDDEN_PHRASES = [
    "diagnosis", "you have", "disease", "ruled out", "guaranteed",
    "healthy score", "unhealthy score", "bad health score",
]


def _gap(domain, marker=None, priority="high", reason=None):
    return {"domain": domain, "missing_marker": marker, "priority": priority, "reason": reason}


def test_high_debt_when_required_markers_missing():
    evidence_gaps = {
        "gaps": [
            _gap("thyroid", "free_t4"),
            _gap("thyroid", "free_t3"),
            _gap("thyroid", "tpo_antibodies"),
        ]
    }

    result = build_evidence_debt(evidence_gaps=evidence_gaps)

    thyroid = next(d for d in result["domain_debt"] if d["domain"] == "thyroid")
    assert thyroid["debt_level"] in {"high", "blocked"}
    assert "missing_required_markers" in thyroid["reason_codes"]
    assert "Free T4" in thyroid["missing_markers"]


def test_contradiction_increases_domain_debt():
    without = build_evidence_debt(clinical_hypotheses=[{"domain": "iron_status", "calibrated_confidence": "moderate"}])
    with_contradiction = build_evidence_debt(
        clinical_hypotheses=[{"domain": "iron_status", "calibrated_confidence": "moderate"}],
        clinical_contradictions=[{"domain": "iron_status", "message": "Inflammation may limit interpretation."}],
    )

    a = next(d for d in without["domain_debt"] if d["domain"] == "iron_status")
    b = next(d for d in with_contradiction["domain_debt"] if d["domain"] == "iron_status")
    assert b["debt_score"] > a["debt_score"]
    assert "unresolved_contradiction" in b["reason_codes"]


def test_low_calibrated_confidence_increases_debt():
    result = build_evidence_debt(
        clinical_hypotheses=[{"domain": "cardiovascular", "calibrated_confidence": "low"}]
    )

    entry = next(d for d in result["domain_debt"] if d["domain"] == "cardiovascular")
    assert "low_calibrated_confidence" in entry["reason_codes"]


def test_high_calibrated_confidence_decreases_debt():
    baseline = build_evidence_debt(
        clinical_hypotheses=[{"domain": "cardiovascular", "calibrated_confidence": "moderate"}]
    )
    high_conf = build_evidence_debt(
        clinical_hypotheses=[{"domain": "cardiovascular", "calibrated_confidence": "high"}]
    )

    a = next(d for d in baseline["domain_debt"] if d["domain"] == "cardiovascular")
    b = next(d for d in high_conf["domain_debt"] if d["domain"] == "cardiovascular")
    assert b["debt_score"] < a["debt_score"]
    assert "high_calibrated_confidence" in b["reason_codes"]


def test_stable_negative_evidence_lowers_debt():
    negative_evidence = {
        "stable_domains": [{"domain": "kidney", "status": "no_strong_signal_detected", "coverage": "sufficient"}],
        "under_tested_domains": [],
    }

    result = build_evidence_debt(negative_evidence=negative_evidence)

    entry = next(d for d in result["domain_debt"] if d["domain"] == "kidney")
    assert "sufficient_stable_coverage" in entry["reason_codes"]
    assert entry["debt_level"] in {"low", "moderate"}


def test_under_tested_domain_increases_debt():
    negative_evidence = {"stable_domains": [], "under_tested_domains": [{"domain": "liver", "status": "under_tested", "coverage": "limited"}]}

    result = build_evidence_debt(negative_evidence=negative_evidence)

    entry = next(d for d in result["domain_debt"] if d["domain"] == "liver")
    assert "under_tested_domain" in entry["reason_codes"]
    assert result["summary"]["under_tested_domains"] == 1


def test_next_test_and_evidence_gap_deduplication_across_domains():
    evidence_gaps = {
        "gaps": [
            _gap("iron_status", "ferritin"),
            _gap("thyroid", "ferritin"),  # same label, different domain
        ]
    }

    result = build_evidence_debt(evidence_gaps=evidence_gaps)

    ferritin_reducers = [r for r in result["top_debt_reducers"] if r["label"].lower() == "ferritin"]
    # Deduplicated into one reducer entry even though it appears in two
    # domains' gap lists.
    assert len(ferritin_reducers) == 1
    assert ferritin_reducers[0]["domain"] is None  # spans >1 domain, no single owner


def test_top_debt_reducers_ranked_by_domain_count():
    evidence_gaps = {
        "gaps": [
            _gap("iron_status", "crp"),
            _gap("thyroid", "crp"),
            _gap("liver", "alt"),
        ]
    }

    result = build_evidence_debt(evidence_gaps=evidence_gaps)

    labels_in_order = [r["label"] for r in result["top_debt_reducers"]]
    crp_label = next(l for l in labels_in_order if l.lower() == "crp")
    alt_label = next(l for l in labels_in_order if l.lower() == "alt")
    assert labels_in_order.index(crp_label) < labels_in_order.index(alt_label)


def test_missing_intervention_context_increases_debt_when_velocity_signal_exists():
    velocity_signals = [{"domain": "iron_status", "marker": "ferritin", "status": "worsened_from_baseline", "confidence": "moderate"}]

    without_events = build_evidence_debt(velocity_signals=velocity_signals, intervention_memory={"active_interventions": [], "completed_interventions": []})
    with_events = build_evidence_debt(
        velocity_signals=velocity_signals,
        intervention_memory={
            "active_interventions": [{"domains": ["iron_status"]}],
            "completed_interventions": [],
        },
    )

    a = next(d for d in without_events["domain_debt"] if d["domain"] == "iron_status")
    b = next(d for d in with_events["domain_debt"] if d["domain"] == "iron_status")
    assert "missing_intervention_context" in a["reason_codes"]
    assert a["debt_score"] > b["debt_score"]


def test_empty_input_returns_valid_high_or_blocked_debt_object():
    result = build_evidence_debt()

    assert result["version"] == "p22_v1"
    assert result["overall_debt"] in {"high", "blocked"}
    assert result["domain_debt"] == []
    assert "data completeness" in result["limitations"][0].lower()


def test_domain_names_match_current_vocabulary():
    evidence_gaps = {"gaps": [_gap("kidney", "creatinine"), _gap("thyroid", "tsh"), _gap("micronutrients", "vitamin_d")]}

    result = build_evidence_debt(evidence_gaps=evidence_gaps)

    domains = {d["domain"] for d in result["domain_debt"]}
    assert domains == {"kidney", "thyroid", "micronutrients"}


def test_pseudo_domains_from_evidence_gaps_are_excluded():
    """Regression (found in 2026-09-16 QA pass against production): a real
    upload's evidence_gaps included marker_coverage entries tagged with
    evidence_gaps.py's "knowledge_coverage" domain (a marker with no
    matching active rule) — that string leaked into domain_debt as if it
    were a real clinical domain, failing the "domain names match current
    vocabulary" requirement. "data_quality" is the same kind of
    pseudo-domain from clinical_data_integrity issues."""
    evidence_gaps = {
        "gaps": [
            _gap("kidney", "creatinine"),
            _gap("knowledge_coverage", "some_uninterpreted_marker", priority="medium"),
            {"domain": "data_quality", "missing_marker": None, "priority": "medium"},
        ]
    }

    result = build_evidence_debt(evidence_gaps=evidence_gaps)

    domains = {d["domain"] for d in result["domain_debt"]}
    assert domains == {"kidney"}
    assert "knowledge_coverage" not in domains
    assert "data_quality" not in domains


def test_malformed_input_does_not_crash():
    result = build_evidence_debt(
        evidence_gaps={"gaps": ["bad", None, 42, {}]},
        clinical_contradictions=["bad", None],
        clinical_hypotheses=["bad", None, {}],
        negative_evidence={"stable_domains": "not_a_list", "under_tested_domains": None},
        velocity_signals=["bad", None],
        intervention_memory={"active_interventions": None, "completed_interventions": "bad"},
        outcome_attribution={"attributions": "bad"},
        next_test_funnel={"panel": "bad"},
    )

    assert isinstance(result["domain_debt"], list)


def test_forbidden_wording_absent_from_generated_text():
    evidence_gaps = {"gaps": [_gap("thyroid", "free_t4"), _gap("liver", "ggt")]}
    result = build_evidence_debt(
        evidence_gaps=evidence_gaps,
        clinical_hypotheses=[{"domain": "thyroid", "doctor_only": True}],
        clinical_contradictions=[{"domain": "liver", "message": "Some contradiction context."}],
    )

    text_blob = " ".join(
        result["limitations"]
        + [r["reason"] for r in result["top_debt_reducers"]]
        + [
            reason
            for d in result["domain_debt"]
            for reason in (d.get("top_debt_reducers") and [r["reason"] for r in d["top_debt_reducers"]] or [])
        ]
    ).lower()

    for phrase in _FORBIDDEN_PHRASES:
        assert phrase not in text_blob, f"forbidden phrase found: {phrase}"


def test_summary_counts_reconcile():
    hypotheses = [
        {"domain": "iron_status", "calibrated_confidence": "high"},
        {"domain": "thyroid", "calibrated_confidence": "moderate"},
        {"domain": "liver", "calibrated_confidence": "low"},
    ]

    result = build_evidence_debt(clinical_hypotheses=hypotheses)

    assert result["summary"]["high_confidence_findings"] == 1
    assert result["summary"]["moderate_confidence_hypotheses"] == 1
    assert result["summary"]["low_confidence_or_blocked_items"] == 1
