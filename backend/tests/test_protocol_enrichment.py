from app.services.protocol_enrichment import enrich_protocol


def test_enrich_protocol_adds_explainability_safety_and_retest_fields():
    enriched = enrich_protocol(
        {
            "supplements": [
                {
                    "supplement": "Vitamin D3",
                    "dosage": "Confirm dose with clinician",
                    "rationale": "Vitamin D is low.",
                    "requires_doctor": True,
                    "based_on": {"biomarkers": [{"canonical_name": "canonical_vitamin_d"}]},
                }
            ],
            "nutrition": [],
            "lifestyle": [],
            "training_recovery": [],
        },
        biomarkers=[
            {
                "name": "Vitamin D",
                "canonical_name": "canonical_vitamin_d",
                "value": 18,
                "unit": "ng/mL",
                "status": "DEFICIENT",
            }
        ],
        prioritized=[
            {
                "name": "Vitamin D",
                "canonical_name": "canonical_vitamin_d",
                "status": "DEFICIENT",
            }
        ],
        safety_result={
            "safety_events": [
                {"key": "current_medications_context", "severity": "medium"},
                {"key": "known_allergies_context", "severity": "medium"},
            ]
        },
        health_states={
            "top_priorities": [
                {
                    "domain": "micronutrients",
                    "score": 54,
                    "risk_level": "needs_attention",
                    "confidence": "medium",
                }
            ]
        },
        trend_analysis={
            "priority_changes": [
                {
                    "name": "Vitamin D",
                    "direction": "falling",
                    "percent_change": -20,
                    "interpretation": "watch_closely",
                }
            ]
        },
        retest_suggestions=[{"marker": "Vitamin D", "timeframe": "8-12 weeks"}],
    )

    item = enriched["supplements"][0]
    assert item["title"] == "Vitamin D3"
    assert item["body"] == "Vitamin D is low."
    assert item["priority"] == "medium"
    assert item["evidence_level"] == "clinical_context"
    assert item["based_on"]["biomarkers"] == []
    assert item["based_on"]["health_domains"] == []
    assert item["based_on"]["trend_changes"] == []
    assert any("medication interactions" in note for note in item["safety_notes"])
    assert any("allergies" in note for note in item["safety_notes"])
    assert item["expected_timeline"]
    assert item["retest_markers"] == []
    assert item["knowledge_domain_registry_version"] == "knowledge_domain_registry_v1"
    assert item["knowledge_domain_context"] == []
    assert item["protocol_enrichment_version"] == "protocol_enrichment_v1"


def test_enrich_protocol_localizes_core_v2_artifacts_for_ukrainian_locale():
    enriched = enrich_protocol(
        {
            "nutrition": [
                {
                    "title": "Balance iron intake",
                    "body": "Pair iron-rich meals with vitamin C.",
                    "requires_doctor": True,
                }
            ],
            "supplements": [],
            "lifestyle": [],
            "training_recovery": [],
        },
        biomarkers=[{"name": "Ferritin", "canonical_name": "canonical_ferritin", "status": "LOW"}],
        prioritized=[{"name": "Ferritin", "canonical_name": "canonical_ferritin", "status": "LOW"}],
        safety_result={
            "safety_events": [
                {"key": "current_medications_context", "severity": "medium"},
                {"key": "known_allergies_context", "severity": "medium"},
            ]
        },
        health_states={
            "top_priorities": [
                {
                    "domain": "iron_status",
                    "score": 72,
                    "risk_level": "needs_attention",
                    "confidence": "medium",
                }
            ]
        },
        trend_analysis={"priority_changes": []},
        retest_suggestions=[{"marker": "Ferritin", "timeframe": "8-12 weeks"}],
        locale="uk",
    )

    item = enriched["nutrition"][0]
    assert "Обговоріть" in item["safety_notes"][0]
    assert any("ліками" in note for note in item["safety_notes"])
    assert "2-4 тижні" in item["expected_timeline"]
    assert item["knowledge_domain_context"] == []
    assert "Review safety first" not in item["expected_timeline"]


def _enrich(item, biomarkers, **kw):
    return enrich_protocol(
        {"nutrition": [item]},
        biomarkers=biomarkers,
        prioritized=[{"name": "Ferritin", "canonical_name": "canonical_ferritin", "status": "LOW"}],
        safety_result={},
        health_states=kw.get("health_states", {"top_priorities": [{"domain": "iron_status", "score": 70}]}),
        trend_analysis=kw.get("trend_analysis", {"priority_changes": []}),
        retest_suggestions=[],
    )["nutrition"][0]


FERRITIN = {"name": "Ferritin", "canonical_name": "canonical_ferritin", "status": "LOW"}


def test_unrelated_flagged_biomarker_is_not_attributed():
    item = _enrich({"title": "Walk daily", "body": "Light movement."}, [FERRITIN])
    assert item["based_on"]["biomarkers"] == []
    assert item["based_on"]["health_domains"] == []
    assert item["based_on"]["trend_changes"] == []


def test_text_mention_does_not_create_attribution():
    item = _enrich({"title": "Eat more ferritin-rich food", "body": "Ferritin matters."}, [FERRITIN])
    assert item["based_on"]["biomarkers"] == []


def test_no_biomarkers_gives_empty_evidence():
    assert _enrich({"title": "Sleep", "body": "Sleep well."}, [])["based_on"]["biomarkers"] == []


def _binding(key="iron", title="Iron", body="x", report="r1", rows=(("Ferritin", "canonical_ferritin", "LOW"),)):
    from app.services.protocol_enrichment import ActionEvidenceBinding

    return ActionEvidenceBinding(report, key, title, body, tuple(rows))


def _impl(item, evidence, report="r1"):
    from app.services.protocol_enrichment import _enrich_protocol_impl

    return _enrich_protocol_impl(
        {"nutrition": [item]}, biomarkers=[FERRITIN], prioritized=[], safety_result={}, health_states={},
        trend_analysis={}, retest_suggestions=[{"marker": "Ferritin"}, {"marker": "Iron"}],
        trusted_evidence={("nutrition", 0): evidence} if evidence else {},
        trusted_report_version_id=report,
    )["nutrition"][0]


def test_model_supplied_references_are_never_action_evidence():
    item = _enrich(
        {
            "title": "Vitamin D3",
            "body": "x",
            "key": "vitamin_d",
            "based_on": {
                "biomarkers": [{"canonical_name": "canonical_ferritin", "status": "LOW"}],
                "health_domains": [{"domain": "iron_status"}],
                "trend_changes": [{"name": "Ferritin", "direction": "falling"}],
            },
            "retest_markers": ["Ferritin"],
            "expected_timeline": "Fake personalised timeline",
            "knowledge_domain_context": [{"domain": "iron_status"}],
        },
        [FERRITIN],
        trend_analysis={"priority_changes": [{"name": "Ferritin", "direction": "falling"}]},
    )
    assert item["based_on"]["biomarkers"] == []
    assert item["based_on"]["health_domains"] == []
    assert item["based_on"]["trend_changes"] == []
    assert item["retest_markers"] == []
    assert item["knowledge_domain_context"] == []
    assert item["expected_timeline"] != "Fake personalised timeline"


def test_public_enrichment_ignores_externally_supplied_evidence_and_verified_flags():
    item = {"title": "Iron", "body": "x", "key": "iron"}
    for kwargs in (
        {"authorized_evidence": {"iron": {"verified": True, "biomarkers": [FERRITIN]}}},
        {"trusted_evidence": {("nutrition", 0): _binding()}, "trusted_report_version_id": "r1"},
    ):
        out = enrich_protocol(
            {"nutrition": [item]}, biomarkers=[FERRITIN], prioritized=[], safety_result={},
            health_states={}, trend_analysis={}, retest_suggestions=[{"marker": "Ferritin"}], **kwargs,
        )
        assert out["nutrition"][0]["based_on"]["biomarkers"] == []
        assert out["nutrition"][0]["retest_markers"] == []


def test_internal_binding_retained_for_exact_report_key_title_body_and_hides_unknown():
    rows = (("Ferritin", "canonical_ferritin", "LOW"), ("Iron", "canonical_iron", "UNKNOWN"))
    out = _impl({"title": "Iron", "body": "x", "key": "iron"}, _binding(rows=rows))
    assert out["based_on"]["biomarkers"] == [
        {"name": "Ferritin", "canonical_name": "canonical_ferritin", "status": "LOW"}
    ]
    assert out["retest_markers"] == ["Ferritin"]


def test_binding_rejected_for_modified_content_other_report_or_dict_flag():
    item = {"title": "Iron", "body": "x", "key": "iron"}
    assert _impl({**item, "body": "different"}, _binding())["based_on"]["biomarkers"] == []
    assert _impl(item, _binding(body="other"))["based_on"]["biomarkers"] == []
    assert _impl(item, _binding(report="r2"))["based_on"]["biomarkers"] == []
    assert _impl({**item, "key": "shared_key"}, _binding())["based_on"]["biomarkers"] == []
    assert _impl(item, {"verified": True, "biomarkers": [FERRITIN]})["based_on"]["biomarkers"] == []
    assert _impl(item, _binding(), report=None)["based_on"]["biomarkers"] == []


def test_unknown_ferritin_has_no_based_on_even_with_binding():
    out = _impl(
        {"title": "Iron", "body": "x", "key": "iron"},
        _binding(rows=(("Ferritin", "canonical_ferritin", "UNKNOWN"),)),
    )
    assert out["based_on"]["biomarkers"] == []


def test_shared_domain_not_assigned_as_action_evidence():
    item = _enrich({"title": "Iron", "body": "x"}, [FERRITIN])
    assert item["based_on"]["health_domains"] == []


def test_enrichment_preserves_schema_category_and_cannot_ground_unsupported_action():
    from app.services.protocol_evidence import validate_action_grounding

    item = _enrich({"title": "Take iron 65 mg", "body": "Your ferritin is low.", "category": "nutrition"}, [FERRITIN])
    assert item["category"] == "nutrition"
    assert {"key", "title", "body", "based_on", "safety_notes", "expected_timeline", "retest_markers"} <= set(item)
    assert validate_action_grounding(item, {"report_id": "r", "evidence": []})["outcome"] == "UNSUPPORTED"
