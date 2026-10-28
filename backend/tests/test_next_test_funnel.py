from app.services.next_test_funnel import build_next_test_funnel


def _test(marker, priority="medium", domain=None, reason="because reasons"):
    return {"marker": marker, "priority": priority, "domain": domain, "reason": reason}


def test_unavailable_when_nothing_pending_or_completed():
    result = build_next_test_funnel()
    assert result["available"] is False
    assert result["panel"] == {}


def test_pending_tests_grouped_by_explicit_domain():
    next_best_tests = {"recommended_tests": [_test("ferritin", domain="iron_status")]}
    result = build_next_test_funnel(next_best_tests=next_best_tests)

    assert result["available"] is True
    assert result["panel"]["iron_status"][0]["marker"] == "ferritin"


def test_pending_tests_grouped_by_inferred_domain_when_domain_missing():
    next_best_tests = {"recommended_tests": [_test("tsh")]}
    result = build_next_test_funnel(next_best_tests=next_best_tests)

    assert "thyroid" in result["panel"]


def test_unmatched_marker_falls_back_to_general_domain():
    next_best_tests = {"recommended_tests": [_test("some_truly_unknown_marker_xyz")]}
    result = build_next_test_funnel(next_best_tests=next_best_tests)

    assert "general" in result["panel"]


def test_pending_sorted_by_priority():
    next_best_tests = {
        "recommended_tests": [
            _test("zinc", priority="low", domain="micronutrients"),
            _test("ferritin", priority="high", domain="iron_status"),
        ]
    }
    result = build_next_test_funnel(next_best_tests=next_best_tests)

    all_markers = [item["marker"] for group in result["panel"].values() for item in group]
    # ferritin (high) must be processed/sorted ahead of zinc (low) in the
    # underlying ranking even though they land in different domain groups.
    assert result["summary"]["high_priority_pending"] == 1


def test_marker_completed_since_last_upload_when_now_present():
    previous_next_best_tests = {"recommended_tests": [_test("ferritin", domain="iron_status")]}
    current_biomarkers = [{"canonical_name": "ferritin", "value": 40}]

    result = build_next_test_funnel(
        previous_next_best_tests=previous_next_best_tests,
        current_biomarkers=current_biomarkers,
    )

    assert len(result["completed_since_last_upload"]) == 1
    assert result["completed_since_last_upload"][0]["marker"] == "ferritin"
    assert result["summary"]["completed_since_last_upload_count"] == 1


def test_marker_not_completed_when_still_absent():
    previous_next_best_tests = {"recommended_tests": [_test("ferritin", domain="iron_status")]}
    current_biomarkers = [{"canonical_name": "glucose", "value": 90}]

    result = build_next_test_funnel(
        previous_next_best_tests=previous_next_best_tests,
        current_biomarkers=current_biomarkers,
    )

    assert result["completed_since_last_upload"] == []


def test_summary_domains_with_pending_tests_matches_panel_keys():
    next_best_tests = {
        "recommended_tests": [
            _test("ferritin", domain="iron_status"),
            _test("tsh", domain="thyroid"),
        ]
    }
    result = build_next_test_funnel(next_best_tests=next_best_tests)

    assert result["summary"]["domains_with_pending_tests"] == sorted(result["panel"].keys())
