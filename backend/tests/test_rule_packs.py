from app.services.knowledge.rule_packs import build_rule_packs


def _rule(key, source, entities=None, status="active", reviewer=None, version=1):
    return {
        "id": key,
        "key": key,
        "name": key.replace("_", " ").title(),
        "source": source,
        "input_entities": entities or [],
        "governance_status": status,
        "medical_reviewed_by": reviewer,
        "medical_reviewed_at": "2026-09-14T00:00:00Z" if reviewer else None,
        "version": version,
    }


def test_rules_without_source_fall_back_to_core_pack():
    rules = [_rule("rule_a", source=None)]
    result = build_rule_packs(rules)

    assert "core_vitaloop" in result["packs"]
    assert result["packs"]["core_vitaloop"]["rule_count"] == 1


def test_rules_with_explicit_source_form_their_own_pack():
    rules = [_rule("rule_b", source="dr_smith_thyroid_pack", entities=["tsh"])]
    result = build_rule_packs(rules)

    assert "dr_smith_thyroid_pack" in result["packs"]
    assert result["packs"]["dr_smith_thyroid_pack"]["rule_count"] == 1
    assert "thyroid" in result["packs"]["dr_smith_thyroid_pack"]["domains"]


def test_reviewers_collected_per_pack():
    rules = [
        _rule("rule_c", source="clinic_x_pack", reviewer="dr-uuid-1"),
        _rule("rule_d", source="clinic_x_pack", reviewer="dr-uuid-2"),
    ]
    result = build_rule_packs(rules)

    assert result["packs"]["clinic_x_pack"]["reviewers"] == ["dr-uuid-1", "dr-uuid-2"]


def test_status_counts_tracked_per_pack():
    rules = [
        _rule("rule_e", source="clinic_x_pack", status="active"),
        _rule("rule_f", source="clinic_x_pack", status="draft"),
    ]
    result = build_rule_packs(rules)

    assert result["packs"]["clinic_x_pack"]["status_counts"]["active"] == 1
    assert result["packs"]["clinic_x_pack"]["status_counts"]["draft"] == 1


def test_rule_without_governance_status_falls_back_to_active_flag():
    rule = _rule("rule_g", source="clinic_x_pack")
    del rule["governance_status"]
    rule["active"] = True

    result = build_rule_packs([rule])

    assert result["packs"]["clinic_x_pack"]["status_counts"]["active"] == 1


def test_summary_distinguishes_core_from_expert_packs():
    rules = [
        _rule("rule_h", source=None),
        _rule("rule_i", source="clinic_x_pack"),
    ]
    result = build_rule_packs(rules)

    assert result["summary"]["core_pack_rule_count"] == 1
    assert result["summary"]["expert_pack_count"] == 1
    assert result["summary"]["pack_count"] == 2


def test_empty_rules_yields_no_packs():
    result = build_rule_packs([])
    assert result["packs"] == {}
    assert result["summary"]["pack_count"] == 0


def test_domain_coverage_is_deduplicated_and_sorted():
    rules = [_rule("rule_j", source="pack_x", entities=["ldl", "hdl", "tsh"])]
    result = build_rule_packs(rules)

    domains = result["packs"]["pack_x"]["domains"]
    assert domains == sorted(set(domains))
