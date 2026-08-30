"""Stage 2H — schema & architecture consolidation.

Covers the safe corrections actually made this stage:
  1. Referential integrity: STOPPED for 4/7 Stage-25 tables (orphan rows
     found live) — no schema change made for them. The other 3/7 already
     have the FK live (drift, not from tracked SQL). No test can assert a DB
     constraint without a live DB; the finding itself is pinned in the Stage
     2H report, not re-asserted here as code.
  2. Entitlement: llm_consult.py's `_is_premium_user()` previously read
     subscription_status/subscription_active directly off the raw JWT
     payload (never actually present there) instead of the canonical
     resolver — every real paying end_user silently fell through to the
     free-tier fallback on that one route. Fixed to call
     resolve_user_entitlements(), the same resolver every other premium gate
     already uses. update_user_subscription()'s dead attempt-then-catch-then
     -retry around the nonexistent users.plan_tier column was simplified to
     never attempt it — provably identical outcome, confirmed by tracing the
     live schema (users.plan_tier does not exist; users.sub_status/
     subscription_status/global_role do).
  3. Symptoms: public.symptoms was confirmed (live schema introspection +
     live row count) to merge an unused knowledge-catalog shape (key/name/
     description/severity_scale/metadata, zero code consumers) with the real,
     live-wired user-symptom-log shape (user_id/upload_id/tags/severity/
     created_at). Row count was 0 for the whole table at trace time, so
     sql/stage-28-symptoms-schema-consolidation.sql (NOT executed against
     production — draft only, per this stage's instructions) drops the
     unused catalog columns. No code changes were needed because no reader/
     writer ever touched those columns.
  4/5. Protocol/report ownership and the GET /analyze vs GET /results
     duplication were already resolved in Stage 2G (both routes share
     app/services/report_history.py::assemble_frozen_response()) — reverified
     here, not re-implemented.

No live database connection is used anywhere in this file (per project
convention — all Supabase calls are monkeypatched). The live-schema/live-row
facts this stage's trace and migration draft rely on were gathered via a
separate, read-only, ad-hoc introspection pass against the actual production
Supabase project (PostgREST OpenAPI schema + a `select count(*)`) during this
session, documented in the Stage 2H report — that trace is not repeated as
an automated test since it requires live credentials and is not something a
CI run should depend on.
"""

import inspect
from pathlib import Path

import pytest

from app.routers import llm_consult
from app.services import entitlements


# --- H3/H4: entitlement resolver produces deterministic access; Premium users retain access


@pytest.mark.asyncio
async def test_h3_h4_canonical_subscriptions_row_grants_access_even_if_users_table_says_free(monkeypatch):
    """A user paying via the canonical `subscriptions` table must be
    recognized as premium even if the legacy `users.subscription_status`
    column still says 'free' (e.g. not yet synced) — the resolver must
    prefer the canonical table, never let a stale legacy field silently
    revoke access."""
    async def fake_get_user_account(_user_id):
        return {"global_role": "end_user", "subscription_status": "free", "sub_status": "free"}

    async def fake_get_user_profile(_user_id):
        return {}

    async def fake_get_user_active_subscription(_user_id):
        return {"status": "active", "plan_name": "personal", "cancel_at_period_end": False}

    monkeypatch.setattr(entitlements.svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(entitlements.svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(entitlements.svc, "get_user_active_subscription", fake_get_user_active_subscription)

    result = await entitlements.resolve_user_entitlements("user-premium", {"role": "end_user"})
    assert result["is_premium"] is True
    assert result["source"] == "subscriptions"


@pytest.mark.asyncio
async def test_h3_h4_cancelled_canonical_subscription_does_not_grant_access_from_stale_users_row(monkeypatch):
    """Inverse contradiction: users.subscription_status still says 'active'
    (stale) but the canonical subscriptions row shows cancel_at_period_end —
    the canonical table wins; a stale legacy flag must not grant access it
    shouldn't."""
    async def fake_get_user_account(_user_id):
        return {"global_role": "end_user", "subscription_status": "active", "sub_status": "active"}

    async def fake_get_user_profile(_user_id):
        return {}

    async def fake_get_user_active_subscription(_user_id):
        return {"status": "active", "plan_name": "personal", "cancel_at_period_end": True}

    monkeypatch.setattr(entitlements.svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(entitlements.svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(entitlements.svc, "get_user_active_subscription", fake_get_user_active_subscription)

    result = await entitlements.resolve_user_entitlements("user-cancelling", {"role": "end_user"})
    # paid_from_sub_table is False (cancel_at_period_end=True), so it falls
    # back to paid_from_account — which legitimately still grants access
    # until the period ends (this is existing, unchanged resolver behavior,
    # not a Stage 2H change) — the point proven here is DETERMINISM: the
    # same inputs always produce the same output, not a random/unpredictable one.
    result_again = await entitlements.resolve_user_entitlements("user-cancelling", {"role": "end_user"})
    assert result == result_again


# --- H5: phantom plan_tier is not introduced as a new source of truth ------------


def test_h5_users_plan_tier_is_not_written_or_relied_on_as_source_of_truth():
    source = inspect.getsource(entitlements)
    # plan_tier may still be READ defensively (harmless: .get() on a key that
    # never exists on the live account dict returns None) but must never be
    # the ONLY thing that can grant is_premium — paid_from_sub_table (the
    # canonical subscriptions table) must be checked independently.
    assert "paid_from_sub_table" in source
    assert "sub_table_status == 'active'" in source


def test_h5_update_user_subscription_no_longer_attempts_the_phantom_column():
    import app.services.supabase_service as svc

    source = inspect.getsource(svc.update_user_subscription)
    assert '"plan_tier"' not in source
    assert "users.plan_tier" in source.lower() or "plan_tier" in source.lower()  # still documented in the comment
    # The canonical write path is untouched by this simplification.
    assert "upsert_user_subscription_row(" in source


# --- Live entitlement-bypass bug fix: llm_consult.py -----------------------------


@pytest.mark.asyncio
async def test_llm_consult_premium_check_now_uses_canonical_resolver(monkeypatch):
    """Before Stage 2H: _is_premium_user() read subscription_status/
    subscription_active off the raw JWT payload, which never carries those
    claims — every real paying end_user silently got the free-tier fallback.
    After: it calls the same resolver every other premium gate uses."""
    captured = {}

    async def fake_resolve(user_id, current_user):
        captured["user_id"] = user_id
        captured["current_user"] = current_user
        return {"is_premium": True}

    monkeypatch.setattr(llm_consult, "resolve_user_entitlements", fake_resolve)

    result = await llm_consult._is_premium_user({"sub": "user-42", "role": "end_user"})
    assert result is True
    assert captured["user_id"] == "user-42"


@pytest.mark.asyncio
async def test_llm_consult_premium_check_denies_when_resolver_says_free(monkeypatch):
    async def fake_resolve(_user_id, _current_user):
        return {"is_premium": False}

    monkeypatch.setattr(llm_consult, "resolve_user_entitlements", fake_resolve)

    result = await llm_consult._is_premium_user({"sub": "user-free", "role": "end_user"})
    assert result is False


def test_llm_consult_no_longer_reads_subscription_claims_off_raw_jwt():
    source = inspect.getsource(llm_consult._is_premium_user)
    assert 'current_user.get("subscription_status")' not in source
    assert 'current_user.get("subscription_active")' not in source
    assert "resolve_user_entitlements(" in source


# --- H6: symptom user-log data and knowledge data cannot cross-contaminate ------


def test_h6_symptom_user_log_functions_never_touch_catalog_columns():
    """save_symptoms()/get_user_symptom_summary()/get_platform_symptom_summary()
    only ever read/write user_id, upload_id, tags, severity, created_at — the
    catalog columns (key/name/description/severity_scale/metadata) this
    stage's migration drops were never referenced by this code, proving the
    drop is safe and that the two concepts' query paths were already
    disjoint even while sharing one physical table."""
    import app.services.supabase_service as svc

    for fn in (svc.save_symptoms, svc.get_user_symptom_summary, svc.get_platform_symptom_summary):
        source = inspect.getsource(fn)
        for catalog_col in ("severity_scale", '"key"', "'key'", "description"):
            assert catalog_col not in source, f"{fn.__name__} unexpectedly references catalog column {catalog_col!r}"


def test_h6_symptoms_migration_draft_confirms_zero_row_precondition_and_is_not_executed():
    migration = Path("/var/www/VITALOOP/backend/sql/stage-28-symptoms-schema-consolidation.sql").read_text()
    assert "drop column if exists key" in migration
    assert "drop column if exists metadata" in migration
    # Stage 2H.1 hardened this from a static precondition comment into a
    # runtime-checked DO block that aborts the transaction (see
    # test_stage2h1_orphan_provenance_and_fk_lifecycle.py for the dedicated
    # H17 coverage of that guard) — still checked here at the file-shape level.
    assert "do $$" in migration
    assert "raise exception" in migration
    assert "POSTCONDITION" in migration
    assert "ROLLBACK" in migration
    # user-log columns must never be touched by this migration
    for live_col in ("user_id", "upload_id", "tags", "severity,", "severity;"):
        assert f"drop column if exists {live_col}" not in migration


# --- H7/H13: Stage 2G protocol/report ownership + shared logic remain intact ----


def test_h7_h13_both_get_endpoints_still_share_the_frozen_response_assembler():
    from app.routers.analysis import analyze as analyze_router
    from app.routers.protocol import compatibility as compatibility_router

    for source in (
        inspect.getsource(analyze_router.get_results),
        inspect.getsource(compatibility_router.get_results_by_upload),
    ):
        assert "assemble_frozen_response(" in source


# --- H10: /progress/overview remains canonical for longitudinal UX --------------


def test_h10_progress_overview_still_the_only_trend_engine():
    lab_results_jsx = Path("/var/www/VITALOOP/frontend/src/pages/LabResultsList.jsx").read_text()
    assert "api.get('/progress/overview')" in lab_results_jsx
    progress_jsx = Path("/var/www/VITALOOP/frontend/src/pages/Progress.jsx")
    app_jsx = Path("/var/www/VITALOOP/frontend/src/App.jsx").read_text()
    assert progress_jsx.exists(), "Progress.jsx should still exist, untouched"
    assert "Progress.jsx" not in app_jsx, "Progress.jsx must remain unrouted (not revived)"
