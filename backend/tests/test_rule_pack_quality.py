"""P26: Rule Pack Quality Scoring (app/services/knowledge/rule_pack_quality.py).

Deterministic composition over rule_packs.py's existing pack grouping,
no LLM. Covers: empty input, a strong pack, a weak pack, an unreviewed
pack, a stale pack, mixed statuses, reviewer/provenance metrics, domain
coverage metrics, improvement actions, deterministic output across
repeated calls, malformed/missing-field resilience, and no input
mutation.
"""

from datetime import datetime, timezone

from app.services.knowledge.rule_pack_quality import build_rule_pack_quality


_FIXED_NOW = datetime(2026, 9, 18, tzinfo=timezone.utc)


def _rule(key, source, entities=None, status="active", reviewer=None,
          reviewed_at=None, updated_at="2026-08-01T00:00:00Z", version=1):
    return {
        "id": key,
        "key": key,
        "name": key.replace("_", " ").title(),
        "source": source,
        "input_entities": entities or [],
        "governance_status": status,
        "medical_reviewed_by": reviewer,
        "medical_reviewed_at": reviewed_at or ("2026-08-01T00:00:00Z" if reviewer else None),
        "updated_at": updated_at,
        "version": version,
    }


def test_empty_input_returns_no_packs():
    result = build_rule_pack_quality([], now=_FIXED_NOW)

    assert result["version"] == "rule_pack_quality_v1"
    assert result["packs"] == {}
    assert result["summary"]["pack_count"] == 0
    assert result["summary"]["measurable_pack_count"] == 0
    assert result["summary"]["average_quality_score"] is None
    assert result["summary"]["strongest_pack_id"] is None
    assert result["summary"]["weakest_pack_id"] is None


def test_strong_pack_scores_high_and_needs_no_action():
    rules = [
        _rule(f"r{i}", source="core_vitaloop", status="active", reviewer="dr_a",
              entities=["ferritin"], reviewed_at="2026-08-01T00:00:00Z")
        for i in range(5)
    ]

    result = build_rule_pack_quality(rules, now=_FIXED_NOW)
    pack = result["packs"]["core_vitaloop"]

    assert pack["quality_level"] in {"strong", "adequate"}
    assert pack["quality_score"] > 60
    assert pack["status_counts"]["active"] == 5
    assert pack["reviewer_coverage"]["reviewer_backed_ratio"] == 1.0
    assert pack["freshness"]["stale_count"] == 0


def test_weak_pack_all_drafts_scores_low():
    rules = [_rule(f"r{i}", source="expert_x", status="draft", entities=[]) for i in range(4)]

    result = build_rule_pack_quality(rules, now=_FIXED_NOW)
    pack = result["packs"]["expert_x"]

    assert pack["quality_level"] == "weak"
    assert pack["status_counts"]["draft"] == 4
    assert pack["status_counts"]["active"] == 0
    assert any("draft" in action.lower() for action in pack["improvement_actions"])


def test_unreviewed_pack_flags_reviewer_coverage_action():
    rules = [_rule(f"r{i}", source="expert_y", status="active", reviewer=None) for i in range(3)]

    result = build_rule_pack_quality(rules, now=_FIXED_NOW)
    pack = result["packs"]["expert_y"]

    assert pack["reviewer_coverage"]["reviewer_backed_count"] == 0
    assert pack["reviewer_coverage"]["reviewer_backed_ratio"] == 0.0
    assert any("reviewer" in action.lower() for action in pack["improvement_actions"])


def test_stale_pack_flags_freshness_action():
    old_date = "2018-01-01T00:00:00Z"
    rules = [
        _rule("r1", source="expert_z", status="active", reviewer="dr_b",
              reviewed_at=old_date, updated_at=old_date, entities=["tsh"]),
    ]

    result = build_rule_pack_quality(rules, now=_FIXED_NOW)
    pack = result["packs"]["expert_z"]

    assert pack["freshness"]["stale_count"] == 1
    assert pack["freshness"]["fresh_count"] == 0
    assert pack["freshness"]["stale_rule_ids"] == ["r1"]
    assert any("365 days" in action for action in pack["improvement_actions"])


def test_fresh_via_updated_at_alone_counts_as_fresh():
    """A rule can be legitimately updated (e.g. a wording fix) without a
    fresh medical re-review -- either signal should count."""
    rules = [
        _rule("r1", source="pack_x", status="active", reviewer="dr_c",
              reviewed_at="2018-01-01T00:00:00Z", updated_at="2026-08-01T00:00:00Z"),
    ]

    result = build_rule_pack_quality(rules, now=_FIXED_NOW)
    pack = result["packs"]["pack_x"]

    assert pack["freshness"]["fresh_count"] == 1
    assert pack["freshness"]["stale_count"] == 0


def test_mixed_statuses_counted_correctly_including_deprecated():
    rules = [
        _rule("r1", source="mixed_pack", status="active", reviewer="dr_a"),
        _rule("r2", source="mixed_pack", status="draft"),
        _rule("r3", source="mixed_pack", status="reviewed", reviewer="dr_b"),
        _rule("r4", source="mixed_pack", status="deprecated", reviewer="dr_c"),
        _rule("r5", source="mixed_pack", status="deprecated"),
    ]

    result = build_rule_pack_quality(rules, now=_FIXED_NOW)
    pack = result["packs"]["mixed_pack"]

    assert pack["status_counts"] == {"draft": 1, "reviewed": 1, "active": 1, "deprecated": 2, "approved": 1}
    assert pack["rule_count"] == 5
    assert any("deprecated" in action.lower() for action in pack["improvement_actions"])


def test_approved_is_documented_alias_for_active():
    """This codebase has no separate 'approved' governance_status --
    'active' IS the approved/live state. Confirm the alias, not a
    fabricated fifth count."""
    rules = [_rule("r1", source="pack_y", status="active", reviewer="dr_a")]

    result = build_rule_pack_quality(rules, now=_FIXED_NOW)
    pack = result["packs"]["pack_y"]

    assert pack["status_counts"]["approved"] == pack["status_counts"]["active"]


def test_domain_coverage_metrics_reflect_total_known_domains():
    rules = [_rule("r1", source="pack_z", status="active", reviewer="dr_a", entities=["ferritin", "tsh"])]

    result = build_rule_pack_quality(rules, now=_FIXED_NOW)
    pack = result["packs"]["pack_z"]

    assert pack["domain_coverage"]["total_known_domains"] > 0
    assert pack["domain_coverage"]["domain_count"] == len(pack["domain_coverage"]["domains"])
    assert 0.0 <= pack["domain_coverage"]["domain_coverage_ratio"] <= 1.0


def test_narrow_domain_coverage_flags_action():
    # No matching entities -> zero domain coverage, well under the 0.2
    # threshold regardless of how many domains the real registry defines.
    rules = [_rule("r1", source="narrow_pack", status="active", reviewer="dr_a", entities=[])]

    result = build_rule_pack_quality(rules, now=_FIXED_NOW)
    pack = result["packs"]["narrow_pack"]

    assert pack["domain_coverage"]["domain_coverage_ratio"] < 0.2
    assert any("clinical domain" in action.lower() for action in pack["improvement_actions"])


def test_summary_identifies_strongest_and_weakest_packs():
    strong_rules = [
        _rule(f"s{i}", source="strong_pack", status="active", reviewer="dr_a", entities=["ferritin"])
        for i in range(3)
    ]
    weak_rules = [_rule(f"w{i}", source="weak_pack", status="draft") for i in range(3)]

    result = build_rule_pack_quality(strong_rules + weak_rules, now=_FIXED_NOW)

    assert result["summary"]["strongest_pack_id"] == "strong_pack"
    assert result["summary"]["weakest_pack_id"] == "weak_pack"
    assert result["summary"]["measurable_pack_count"] == 2
    assert result["summary"]["average_quality_score"] is not None


def test_deterministic_output_across_repeated_calls():
    rules = [
        _rule("r1", source="pack_a", status="active", reviewer="dr_a", entities=["ferritin"]),
        _rule("r2", source="pack_a", status="draft"),
    ]

    first = build_rule_pack_quality(rules, now=_FIXED_NOW)
    second = build_rule_pack_quality(rules, now=_FIXED_NOW)

    assert first == second


def test_malformed_and_missing_fields_do_not_crash():
    rules = [
        "not_a_dict",
        None,
        42,
        {},
        {"id": "r1", "source": "pack_b"},  # missing governance_status, input_entities, etc.
        {"id": "r2", "source": "pack_b", "governance_status": "active", "medical_reviewed_at": "not-a-date"},
    ]

    result = build_rule_pack_quality(rules, now=_FIXED_NOW)

    assert "pack_b" in result["packs"]
    assert isinstance(result["packs"]["pack_b"]["quality_score"], float)


def test_methodology_and_limitations_documented_in_output():
    result = build_rule_pack_quality([], now=_FIXED_NOW)

    assert "methodology" in result
    assert abs(sum(result["methodology"]["weights"].values()) - 1.0) < 1e-9
    assert result["methodology"]["freshness_window_days"] == 365
    assert len(result["methodology"]["limitations"]) >= 3


def test_does_not_mutate_input_rules():
    rule = _rule("r1", source="pack_c", status="active", reviewer="dr_a", entities=["ferritin"])
    rules = [rule]
    rule_copy = dict(rule)

    build_rule_pack_quality(rules, now=_FIXED_NOW)

    assert rule == rule_copy
    assert rules == [rule_copy]
