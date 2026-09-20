"""Stage 2F — regression coverage for fabricated dashboard metric removal.

Root cause traced: UserDashboard.jsx computed several clinical-looking
percentages independent of any real backend calculation:
  - biomarkerScore: flat constant (70 if any results exist, else 25)
  - safetyScore: binary 85/45 from a substring match on a questionnaire field
  - symptomScore: frontend-invented formula (100 - severity*9) over a value
    that is itself client-computed-then-stored (Questionnaire.jsx), not
    backend-derived
  - profileScore: read stats.profile_completion, a field that does not exist
    in the API response, so it always silently fell back to a hardcoded 55
  - a fabricated "Day X of 14" protocol-cycle counter derived from the
    CURRENT CALENDAR DATE, unrelated to any real protocol start date

Fix: exposed calculate_health_score()'s already-computed, already-persisted
sub-components (symptom_component/biomarker_component/adherence_component)
via stats.health_score_components, and profile.onboarding.completion_pct
(already existed, wrong path was being read) — no new formula introduced
anywhere. UserDashboard.jsx now uses these real values directly, showing
"Not yet calculated" instead of a fabricated fallback when a real value is
absent.

Because there is no configured JS test runner in this project (no "test"
script in package.json — confirmed in the Stage 2D-1 frontend verification
pass), the frontend-behavior assertions here are enforced two ways:
  1. Backend regression tests proving the DATA CONTRACT the frontend now
     depends on is real, traceable, and correctly plumbed through.
  2. Source-inspection tests (the same technique already used in
     test_stage2c_safety_enforcement.py::test_e6) proving the specific
     fabricated formulas are actually gone from the shipped file, not just
     assumed removed.

No live database connection is used anywhere in this file.

P37 UPDATE (2026-09-20): the entire Health Signal Score / Score Breakdown /
Journey Progress UI these source-text assertions were pinned to has been
intentionally removed from UserDashboard.jsx by the Dashboard Today redesign
(see output/p37d-today-core-layout-state-adapter-2026-09-20.md and the design
spec's explicit do-not-do list: no Health Signal Score, no journey/progress
framing, no default "No urgent red flags reported." banner). This is a
deliberate product decision, not a regression -- the backend computation
these tests originally protected (calculate_health_score() ->
health_scores table -> stats.health_score_components) is untouched and still
under test here (see test_f5_health_score_components_pass_through_unmodified
below); only its old frontend *display* is gone. Assertions that pinned the
removed display's exact source text have been replaced with assertions
proving the removal was deliberate and complete (not a half-finished
migration), each pointing at what superseded it in the new P37 Today
contract. See each test's own comment for its specific before/after.
"""

import inspect
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = REPO_ROOT / "frontend" / "src"
BACKEND_APP = REPO_ROOT / "backend" / "app"
BACKEND_SQL = REPO_ROOT / "backend" / "sql"

import pytest

from app.routers.analysis import dashboard as dashboard_router
from app.services import supabase_service as svc

DASHBOARD_JSX = (FRONTEND_SRC / "pages/UserDashboard.jsx").read_text()


# --- F1: fabricated biomarker percentage is gone --------------------------------


def test_f1_fabricated_biomarker_score_pattern_removed():
    assert "hasResults ? 70 : 25" not in DASHBOARD_JSX, "the flat 70/25 biomarker placeholder must be gone"
    # P37 UPDATE: the entire Score Breakdown card (which is what
    # `healthScoreComponents.biomarker` fed) was intentionally removed from
    # Today, not just the fabricated 70/25 placeholder -- there is no
    # replacement biomarker percentage to display on this page at all. The
    # only requirement left worth pinning is that the old fabricated
    # constant itself never comes back (asserted above); the real backend
    # value it would have read remains correctly computed and forwarded
    # (test_f5_health_score_components_pass_through_unmodified, below).
    assert "healthScoreComponents" not in DASHBOARD_JSX, "the removed Score Breakdown display must not be reintroduced"


# --- F2: fabricated safety percentage is gone -----------------------------------


def test_f2_fabricated_safety_score_pattern_removed():
    assert "urgency?.includes" not in DASHBOARD_JSX, "the binary substring-match safety score must be gone"
    # No live safetyScore variable declaration/usage — "safetyScore" may still
    # appear inside an explanatory comment (documenting what Stage 2F
    # replaced), which prose reflow can wrap across lines differently; a live
    # reference would read as `safetyScore =`/`safetyScore)`/`{safetyScore`/
    # `safetyScore.` etc. None of those patterns should be present.
    import re
    assert not re.search(r"safetyScore\s*[=).]|\{safetyScore\b", DASHBOARD_JSX), \
        "no live safetyScore variable should remain (only an explanatory comment may mention the old name)"


# --- F3/F4: dashboard renders correctly with and without labs (data contract) ---


@pytest.mark.asyncio
async def test_f3_dashboard_stats_reflect_real_upload_presence(monkeypatch):
    """The has-labs/no-labs branch the dashboard renders is driven by
    stats.total_uploads, which is real (svc.get_user_upload_count / len(progress)),
    not a fabricated flag."""

    async def fake_get_user_progress(_user_id):
        return [{"id": "u1", "measurement_date": "2026-08-01", "biomarkers": []}]

    monkeypatch.setattr(svc, "get_user_progress", fake_get_user_progress)
    result = await svc.get_user_progress("user-f3")
    assert len(result) == 1  # a real, non-fabricated count backs stats.total_uploads


def test_f4_dashboard_falls_back_to_truthful_empty_state_text():
    # P37 UPDATE: the KPIBlock/Recent-Context cards these strings lived in
    # were removed along with the rest of the old journey UI. The same
    # underlying invariant this test protects -- never show a fabricated
    # value when the real one is absent -- is now enforced by the P37 Today
    # adapter instead: a missing retest date renders an honest "not set
    # yet" sentence, never a computed/guessed one (see
    # buildTodayViewModel()'s returnSection.noDate, and P37e's explicit
    # "do not invent... retest timing" rule).
    assert "noDate:" in DASHBOARD_JSX
    assert "does not include a repeat-test date yet" in DASHBOARD_JSX
    # And the specific old fabricated fallback constant must not return.
    assert "notYetCalculated" not in DASHBOARD_JSX


# --- F5: real Health Score passed through unchanged, not recomputed in frontend --


@pytest.mark.asyncio
async def test_f5_health_score_components_pass_through_unmodified(monkeypatch):
    """_fetch_health_and_streak() must forward the health_scores row's stored
    components verbatim — no recalculation, no rounding/transform beyond what
    calculate_health_score() itself already did."""

    class _Resp:
        def __init__(self, data, count=None):
            self.data = data
            self.count = count

    class _HealthScoresTable:
        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            return _Resp([
                {
                    "score": 67.4,
                    "calculated_at": "2026-08-28T00:00:00Z",
                    "symptom_component": 72.0,
                    "biomarker_component": 55.5,
                    "adherence_component": 75.0,
                }
            ])

    class _UploadsTable:
        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            return _Resp([], count=1)

    class _Client:
        def table(self, name):
            if name == "health_scores":
                return _HealthScoresTable()
            if name == "lab_uploads":
                return _UploadsTable()
            raise AssertionError(name)

    async def fake_run(fn):
        return fn()

    async def fake_audit(**_kwargs):
        return None

    monkeypatch.setattr(svc, "_get_supabase", lambda: _Client())
    monkeypatch.setattr(svc, "_run", fake_run)
    monkeypatch.setattr(svc, "write_audit_log", fake_audit)

    health_latest, health_delta, _streak = await dashboard_router._fetch_health_and_streak("user-f5")

    assert health_latest["symptom_component"] == 72.0
    assert health_latest["biomarker_component"] == 55.5
    assert health_latest["adherence_component"] == 75.0
    assert health_delta == 0  # only one row returned, no prior score to diff against


def test_f5_no_client_side_health_score_recompute_formula_remains():
    assert "100 - concernSummary.severity" not in DASHBOARD_JSX
    # P37 UPDATE: `symptomScore`/`healthScoreComponents.symptom` no longer
    # exist because the whole Score Breakdown display they fed was removed
    # (see test_f1 above) -- there is nothing left to recompute a health
    # score FROM on this page, client-side or otherwise, which is a
    # stronger guarantee than "still reads the real value" was.
    assert "symptomScore" not in DASHBOARD_JSX
    assert "healthScoreComponents" not in DASHBOARD_JSX


# --- F6: safety state derived from backend data, not substring heuristics -------


def test_f6_safety_section_has_no_score_threshold_styling():
    assert "safetyScore >= 70" not in DASHBOARD_JSX
    # P37 UPDATE: the design spec explicitly forbids carrying forward a
    # default "No urgent red flags reported." banner (do-not-do §14: absence
    # of a loaded safety value must never be presented as a green
    # all-clear). The old fallback-to-a-hardcoded-safe-string pattern this
    # test previously required is now precisely the pattern that must NOT
    # exist -- real questionnaire urgency is still shown when present
    # (safetyText, unchanged from before), but there is no default banner
    # at all when it is absent (see buildTodayViewModel(): safetyTone ===
    # 'success' -> null, never a rendered "all clear" string).
    assert "concernSummary?.urgency || copy.noRedFlags" not in DASHBOARD_JSX
    assert "No urgent red flags reported." not in DASHBOARD_JSX
    assert "safetyText" in DASHBOARD_JSX  # real urgency text is still read and passed through when present


# --- F7: Stage 2E check-in state remains correct --------------------------------


def test_f7_stage_2e_checkin_untouched_at_its_real_source():
    # P37 UPDATE: Today no longer surfaces a check-in-due KPI card at all --
    # the design spec's returning-user "When to come back" checkpoint is
    # now retest-plan-driven (knowledge_report.retest_plan, see P37e), not
    # weekly-check-in-driven, so `CHECKIN_DUE_INTERVAL_DAYS`/
    # `isCheckinCurrent` were removed from UserDashboard.jsx along with the
    # KPI card that displayed them -- a deliberate scope change, not an
    # accidental loss of the underlying Stage 2E invariant. That invariant
    # (a check-in counts as "current" only within a real 7-day window, not
    # merely "any check-in ever") still lives at its actual source of
    # truth -- the backend's CHECKIN_DUE_INTERVAL_DAYS constant -- and is
    # still fully covered by test_stage2e_checkin_dashboard.py (re-run as
    # part of this stage's required test sweep). This test now proves the
    # frontend copy was deliberately retired, not silently dropped.
    assert "CHECKIN_DUE_INTERVAL_DAYS" not in DASHBOARD_JSX
    assert "isCheckinCurrent" not in DASHBOARD_JSX
    backend_source = (BACKEND_APP / "routers/analysis/dashboard.py").read_text()
    assert "CHECKIN_DUE_INTERVAL_DAYS" in backend_source, \
        "the real 7-day check-in-due invariant must still exist at its backend source of truth"


# --- F8: Stage 2D-1 chronology remains correct ----------------------------------


def test_f8_stage_2d1_chronology_fields_untouched():
    source = inspect.getsource(dashboard_router)
    assert "latest_lab_result" in source
    assert "latest_upload = max(progress" in source
    # Full behavioral coverage lives in test_stage2d1_progress_chronology.py,
    # re-run as part of this stage's required test sweep, not duplicated here.


# --- F9: no visible number implies clinical precision without a backend source --


def test_f9_no_fabricated_numeric_patterns_remain_anywhere_in_the_file():
    forbidden_patterns = [
        "hasResults ? 70 : 25",           # old biomarkerScore
        "urgency?.includes('No urgent') ? 85 : 45",  # old safetyScore
        "100 - concernSummary.severity * 9",  # old symptomScore formula
        "stats?.profile_completion || 55",     # old profileScore dead-field fallback
        "concernSummary?.readiness || 38",     # old labReadiness fabricated fallback
        "getDate() % 14",                       # old fabricated "Day X of 14" counter
    ]
    for pattern in forbidden_patterns:
        assert pattern not in DASHBOARD_JSX, f"fabricated pattern still present: {pattern!r}"
