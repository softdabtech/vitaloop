"""Stage 2E — regression coverage for check-in -> dashboard state visibility.

Root cause traced: submit_weekly_checkin() was a pure write with no downstream
effect on /dashboard/summary's response, compounded by a 45s in-process
per-user cache (dashboard.py's _summary_cache) and _build_next_best_action()
never receiving check-in state as an input at all.

No fake clinical/Health Score movement is introduced anywhere in this file —
that logic (calculate_health_score, /insights/health-score) is untouched.

No live database connection is used anywhere in this file.
"""

from datetime import date, datetime, timedelta, timezone

import pytest

from app.routers.analysis import dashboard as dashboard_router
from app.routers.protocol import checkins


@pytest.fixture(autouse=True)
def _clear_dashboard_cache():
    dashboard_router._summary_cache.clear()
    yield
    dashboard_router._summary_cache.clear()


# --- E1: successful check-in persists -------------------------------------------


@pytest.mark.asyncio
async def test_e1_successful_checkin_persists(monkeypatch):
    saved = {}

    async def fake_submit_weekly_checkin(user_id, data):
        saved["user_id"] = user_id
        saved["data"] = data
        return {"id": "checkin-e1", "user_id": user_id, **data}

    monkeypatch.setattr(checkins.svc, "submit_weekly_checkin", fake_submit_weekly_checkin)

    body = checkins.CheckinCreate(week_start=date(2026, 8, 24), energy_score=6, protocol_adherence=4)
    result = await checkins.submit_checkin(body, {"sub": "user-e1"})

    assert result["id"] == "checkin-e1"
    assert saved["data"]["week_start"] == "2026-08-24"


# --- E2: dashboard immediately stops suggesting "Run weekly check-in" ----------


def test_e2_next_best_action_stops_suggesting_checkin_when_recently_done():
    onboarding = {"requires_onboarding": False}
    progress = [{"id": "u1", "measurement_date": "2026-08-01"}]
    today = datetime.now(timezone.utc).date()
    recent_checkin = {"week_start": today.isoformat(), "created_at": f"{today.isoformat()}T10:00:00Z"}

    action_without_checkin = dashboard_router._build_next_best_action(onboarding, [], progress, None)
    assert action_without_checkin["title"] == "Run weekly check-in"

    action_with_checkin = dashboard_router._build_next_best_action(onboarding, [], progress, recent_checkin)
    assert action_with_checkin["title"] != "Run weekly check-in", (
        "immediately after a check-in the dashboard must not keep suggesting the same action"
    )
    assert action_with_checkin["path"] != "/check-ins"


@pytest.mark.asyncio
async def test_e2_cache_invalidated_so_next_dashboard_read_is_fresh(monkeypatch):
    """Proves the cache-invalidation wiring specifically: a cached dashboard
    response exists before the check-in; submitting one must clear it so the
    very next read recomputes rather than serving the stale cached value."""
    dashboard_router._cache_set("user-e2", {"blocks": {"stale": True}})
    assert dashboard_router._cache_get("user-e2") is not None

    async def fake_submit_weekly_checkin(user_id, data):
        return {"id": "checkin-e2", "user_id": user_id, **data}

    monkeypatch.setattr(checkins.svc, "submit_weekly_checkin", fake_submit_weekly_checkin)

    body = checkins.CheckinCreate(week_start=date(2026, 8, 24), energy_score=6)
    await checkins.submit_checkin(body, {"sub": "user-e2"})

    assert dashboard_router._cache_get("user-e2") is None, "the stale cached summary must be invalidated by check-in submission"


# --- E3: completion visible in dashboard/timeline/adherence state --------------


@pytest.mark.asyncio
async def test_e3_checkin_completion_visible_in_latest_activity(monkeypatch):
    """_fetch_latest_activity() (already correct — always reads fresh, no
    caching of its own) must return the just-submitted check-in without any
    additional Stage 2E change — this test proves that pre-existing behavior
    stays intact and is what actually surfaces once the cache is no longer
    in the way."""
    from app.services import supabase_service as svc

    class _Resp:
        def __init__(self, data):
            self.data = data

    class _CheckinsTable:
        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            return _Resp([{"week_start": "2026-08-24", "created_at": "2026-08-24T10:00:00Z", "energy_score": 6, "sleep_quality": 7, "mood_score": 6, "protocol_adherence": 4}])

    class _QuestionnaireTable:
        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            return _Resp([])

    class _Client:
        def table(self, name):
            if name == "checkins_weekly":
                return _CheckinsTable()
            if name == "questionnaire_sessions":
                return _QuestionnaireTable()
            raise AssertionError(name)

    async def fake_run(fn):
        return fn()

    async def fake_audit(**_kwargs):
        return None

    monkeypatch.setattr(svc, "_get_supabase", lambda: _Client())
    monkeypatch.setattr(svc, "_run", fake_run)
    monkeypatch.setattr(svc, "write_audit_log", fake_audit)

    weekly_checkin, _questionnaire = await dashboard_router._fetch_latest_activity("user-e3")
    assert weekly_checkin["week_start"] == "2026-08-24"


# --- E4: no fabricated Health Score/clinical improvement ------------------------


def test_e4_next_best_action_does_not_touch_health_score():
    """_build_next_best_action() must not reference/derive any score value —
    it only changes CTA copy. Health score computation itself is untouched by
    this stage (calculate_health_score/_fetch_health_and_streak unmodified)."""
    onboarding = {"requires_onboarding": False}
    progress = [{"id": "u1", "measurement_date": "2026-08-01"}]
    today = datetime.now(timezone.utc).date()
    recent_checkin = {"week_start": today.isoformat()}

    action = dashboard_router._build_next_best_action(onboarding, [], progress, recent_checkin)
    assert "score" not in str(action).lower()
    assert "improved" not in str(action).lower()
    assert "improving" not in str(action).lower()


# --- E5: a user with a DUE check-in still gets the check-in next action --------


def test_e5_user_without_recent_checkin_still_gets_checkin_action():
    onboarding = {"requires_onboarding": False}
    progress = [{"id": "u1", "measurement_date": "2026-08-01"}]

    # No check-in at all.
    action_never = dashboard_router._build_next_best_action(onboarding, [], progress, None)
    assert action_never["title"] == "Run weekly check-in"

    # A check-in exists, but it's over a week old — due again.
    stale_date = (datetime.now(timezone.utc).date() - timedelta(days=10)).isoformat()
    action_stale = dashboard_router._build_next_best_action(onboarding, [], progress, {"week_start": stale_date})
    assert action_stale["title"] == "Run weekly check-in", (
        "presence of ANY historical check-in must not permanently suppress the suggestion"
    )


# --- E6: check-in state is isolated per user ------------------------------------


def test_e6_cache_invalidation_is_scoped_to_one_user():
    dashboard_router._cache_set("user-a", {"blocks": {"user": "a"}})
    dashboard_router._cache_set("user-b", {"blocks": {"user": "b"}})

    dashboard_router.invalidate_summary_cache("user-a")

    assert dashboard_router._cache_get("user-a") is None
    assert dashboard_router._cache_get("user-b") is not None, "invalidating one user's cache must not affect another user's"


# --- E7: existing report/progress/safety behavior unchanged --------------------


@pytest.mark.asyncio
async def test_e7_report_progress_safety_regression_untouched():
    """Narrow smoke check that Stage 2E's dashboard/check-in changes did not
    touch the pipeline — full coverage lives in test_stage2b_canonical_boundary.py
    / test_stage2c_safety_enforcement.py / test_stage2d1_progress_chronology.py,
    re-run separately per the stage instructions; this is a fast in-file guard."""
    from app.services import lab_analysis_pipeline

    assert hasattr(lab_analysis_pipeline, "run_lab_analysis_pipeline")
    # calculate_health_score is untouched — still the only place a real score
    # is (re)computed; Stage 2E never imports or calls it.
    import inspect

    source = inspect.getsource(dashboard_router)
    assert "calculate_health_score" not in inspect.getsource(dashboard_router._build_next_best_action)
    assert "calculate_health_score" in source, "the real score computation path must still exist elsewhere in this module, untouched"


# --- E8: next due state is based on real timing, not just historical presence --


def test_e8_next_due_state_uses_real_elapsed_time():
    onboarding = {"requires_onboarding": False}
    progress = [{"id": "u1", "measurement_date": "2026-08-01"}]

    today = datetime.now(timezone.utc).date()

    # Just checked in today -> not due.
    action_today = dashboard_router._build_next_best_action(onboarding, [], progress, {"week_start": today.isoformat()})
    assert action_today["title"] != "Run weekly check-in"

    # Checked in exactly at the boundary (7 days ago) -> due again.
    boundary_date = (today - timedelta(days=dashboard_router.CHECKIN_DUE_INTERVAL_DAYS)).isoformat()
    action_boundary = dashboard_router._build_next_best_action(onboarding, [], progress, {"week_start": boundary_date})
    assert action_boundary["title"] == "Run weekly check-in"

    # Checked in 3 days ago -> still not due, and description names a real future date.
    recent_date = (today - timedelta(days=3)).isoformat()
    action_recent = dashboard_router._build_next_best_action(onboarding, [], progress, {"week_start": recent_date})
    assert action_recent["title"] != "Run weekly check-in"
    expected_next_due = (today - timedelta(days=3) + timedelta(days=dashboard_router.CHECKIN_DUE_INTERVAL_DAYS)).isoformat()
    assert expected_next_due in action_recent["description"]
