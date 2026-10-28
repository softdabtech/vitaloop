from app.services.knowledge.governance_coverage import build_governance_coverage


def _rule(key, entities, status="active", confidence=0.7):
    return {
        "id": key,
        "key": key,
        "name": key.replace("_", " ").title(),
        "input_entities": entities,
        "governance_status": status,
        "confidence": confidence,
        "severity": "medium",
        "version": 1,
        "source": "manual",
    }


def test_rule_matched_to_domain_by_input_entities():
    rules = [_rule("rule_high_ldl", ["ldl"])]
    result = build_governance_coverage(rules)

    assert result["domains"]["cardiovascular"]["active"] == 1
    assert result["domains"]["cardiovascular"]["rules"][0]["key"] == "rule_high_ldl"


def test_rule_with_no_matching_domain_is_unmapped():
    rules = [_rule("rule_mystery_marker", ["some_unknown_marker_xyz"])]
    result = build_governance_coverage(rules)

    assert result["domains"]["unmapped"]["active"] == 1
    assert result["summary"]["unmapped_rule_count"] == 1


def test_rule_can_match_multiple_domains():
    # homocysteine appears in both cardiovascular and inflammation aliases
    # (per domain_registry.py).
    rules = [_rule("rule_homocysteine", ["homocysteine"])]
    result = build_governance_coverage(rules)

    assert result["domains"]["cardiovascular"]["active"] == 1
    assert result["domains"]["inflammation"]["active"] == 1


def test_every_registered_domain_appears_even_with_zero_rules():
    result = build_governance_coverage([])

    assert "iron_status" in result["domains"]
    assert result["domains"]["iron_status"]["active"] == 0
    assert result["domains"]["iron_status"]["rules"] == []


def test_domains_without_active_coverage_lists_zero_active_domains():
    rules = [_rule("rule_high_ldl", ["ldl"], status="active")]
    result = build_governance_coverage(rules)

    assert "cardiovascular" not in result["summary"]["domains_without_active_coverage"]
    assert "thyroid" in result["summary"]["domains_without_active_coverage"]


def test_draft_only_domain_still_counts_as_without_active_coverage():
    rules = [_rule("rule_draft_tsh", ["tsh"], status="draft")]
    result = build_governance_coverage(rules)

    assert result["domains"]["thyroid"]["draft"] == 1
    assert result["domains"]["thyroid"]["active"] == 0
    assert "thyroid" in result["summary"]["domains_without_active_coverage"]


def test_rule_without_governance_status_falls_back_to_active_flag():
    rule = _rule("rule_legacy", ["ldl"])
    del rule["governance_status"]
    rule["active"] = True

    result = build_governance_coverage([rule])

    assert result["domains"]["cardiovascular"]["active"] == 1


def test_total_domains_matches_registry_size():
    result = build_governance_coverage([])
    assert result["summary"]["total_domains"] == len(result["domains"]) - 1  # minus "unmapped"
