"""Post-release entitlement consistency fix — regression coverage.

Covers:
1. resolve_entitlements_from_data() — the pure, batch-compatible extraction
   of resolve_user_entitlements()'s core logic, added so CRM can resolve
   entitlements for a whole member list without an N+1 per-member fetch,
   using the exact same rule (not a second resolver).
2. supabase_service.get_active_subscriptions_by_user_ids() — batch version
   of get_user_active_subscription(), same "most recent active/past_due/
   paused row per user" selection rule.
3. crm.py::_serialize_member() no longer treats raw users.sub_status as
   Premium authority.
4. The Svetlana regression case: Free -> Personal/Premium via a later
   subscriptions row must resolve to Premium (matches the live account
   audited post-release — this is the exact shape her account had:
   two subscriptions rows, free then personal, the personal one more
   recently updated). Also covers the reverse: Premium -> Free via
   cancellation/expiry must resolve to Free, using the same mechanism.

No live database connection is used anywhere in this file.
"""

import pytest

from app.routers.crm import crm as crm_router
from app.services import entitlements
from app.services import supabase_service as svc


# --- resolve_entitlements_from_data(): pure, batch-compatible core --------------


def test_resolve_entitlements_from_data_matches_resolve_user_entitlements_shape():
    """Same output shape as resolve_user_entitlements() minus the profile
    key (which requires its own fetch and isn't relevant to batch/CRM use)."""
    account = {"global_role": "end_user", "subscription_status": "free", "sub_status": "free"}
    active_sub = {"status": "active", "plan_name": "personal", "cancel_at_period_end": False}

    result = entitlements.resolve_entitlements_from_data(user_id="user-1", account=account, active_sub=active_sub)

    assert result["is_premium"] is True
    assert result["source"] == "subscriptions"
    assert result["plan_key"] == "personal"
    assert "profile" not in result


@pytest.mark.asyncio
async def test_resolve_user_entitlements_still_delegates_to_the_same_pure_function(monkeypatch):
    """resolve_user_entitlements() must produce identical is_premium/source/
    plan_key results to calling resolve_entitlements_from_data() directly
    with the same inputs — proves it's a thin wrapper, not a divergent
    second implementation."""
    account = {"global_role": "end_user", "subscription_status": "active", "sub_status": "active"}
    active_sub = {"status": "active", "plan_name": "personal", "cancel_at_period_end": False}

    async def fake_get_user_account(_user_id):
        return account

    async def fake_get_user_profile(_user_id):
        return {"onboarding_complete": True}

    async def fake_get_user_active_subscription(_user_id):
        return active_sub

    monkeypatch.setattr(entitlements.svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(entitlements.svc, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(entitlements.svc, "get_user_active_subscription", fake_get_user_active_subscription)

    via_wrapper = await entitlements.resolve_user_entitlements("user-2", {"role": "end_user"})
    via_pure = entitlements.resolve_entitlements_from_data(user_id="user-2", account=account, active_sub=active_sub)

    assert via_wrapper["is_premium"] == via_pure["is_premium"]
    assert via_wrapper["source"] == via_pure["source"]
    assert via_wrapper["plan_key"] == via_pure["plan_key"]


# --- get_active_subscriptions_by_user_ids(): batch fetch -------------------------


@pytest.mark.asyncio
async def test_get_active_subscriptions_by_user_ids_picks_most_recent_per_user(monkeypatch):
    """Same selection rule as get_user_active_subscription() (most recently
    updated active/past_due/paused row), applied per user across one batch
    query result instead of one query per user."""
    rows = [
        # Already ordered most-recent-first, as the real query would return
        # (order is applied across the whole result set server-side).
        {"user_id": "user-b", "plan_name": "personal", "status": "active", "updated_at": "2026-08-28T10:17:55Z", "cancel_at_period_end": False, "current_period_end": None},
        {"user_id": "user-a", "plan_name": "personal", "status": "active", "updated_at": "2026-08-27T18:29:10Z", "cancel_at_period_end": False, "current_period_end": None},
        {"user_id": "user-b", "plan_name": "free", "status": "active", "updated_at": "2026-08-25T15:21:02Z", "cancel_at_period_end": False, "current_period_end": None},
    ]

    class _Resp:
        def __init__(self, data):
            self.data = data

    class _Query:
        def select(self, *_a, **_k):
            return self

        def in_(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def execute(self):
            return _Resp(rows)

    class _Client:
        def table(self, name):
            assert name == "subscriptions"
            return _Query()

    async def fake_run(fn):
        return fn()

    async def fake_run_read(fn, label=None):
        return fn()

    monkeypatch.setattr(svc, "_get_supabase", lambda: _Client())
    monkeypatch.setattr(svc, "_run", fake_run)
    monkeypatch.setattr(svc, "_run_supabase_read", fake_run_read)

    result = await svc.get_active_subscriptions_by_user_ids(["user-a", "user-b"])

    assert result["user-a"]["plan_name"] == "personal"
    assert result["user-b"]["plan_name"] == "personal", (
        "must pick user-b's MORE RECENT 'personal' row, not the older 'free' "
        "row that happens to also match — the exact Svetlana shape"
    )


@pytest.mark.asyncio
async def test_get_active_subscriptions_by_user_ids_empty_input_short_circuits():
    result = await svc.get_active_subscriptions_by_user_ids([])
    assert result == {}


# --- CRM: raw sub_status no longer treated as Premium authority -----------------


def test_serialize_member_no_longer_reads_raw_sub_status_for_premium():
    import ast
    import inspect
    import textwrap

    source = inspect.getsource(crm_router._serialize_member)
    tree = ast.parse(textwrap.dedent(source))
    func = tree.body[0]
    body_without_docstring = func.body[1:] if ast.get_docstring(func) else func.body
    code_only = "\n".join(ast.unparse(node) for node in body_without_docstring)
    assert "sub_status" not in code_only, "raw sub_status must no longer be the Premium authority"
    assert "resolve_entitlements_from_data(" in code_only


def test_serialize_member_uses_canonical_resolution_end_to_end():
    row = {"user_id": "user-3", "role": "member", "status": "active"}
    user = {"email": "member@example.com", "full_name": "Member Name", "global_role": "end_user",
            "sub_status": "active", "subscription_status": "free"}  # stale legacy flag, no real evidence
    # No active_sub passed -> no real subscriptions evidence.
    result = crm_router._serialize_member(row, user, active_sub=None)

    assert result["subscription_active"] is False, (
        "a stale sub_status='active' with no supporting subscriptions row must not grant Premium display in CRM"
    )
    assert result["subscription_status"] == "free"


def test_serialize_member_reflects_real_active_sub_evidence():
    row = {"user_id": "user-4", "role": "member", "status": "active"}
    user = {"email": "premium@example.com", "global_role": "end_user", "sub_status": "free", "subscription_status": "free"}
    active_sub = {"status": "active", "plan_name": "personal", "cancel_at_period_end": False}

    result = crm_router._serialize_member(row, user, active_sub=active_sub)

    assert result["subscription_active"] is True
    assert result["subscription_status"] == "active"


# --- Svetlana regression case: Free -> Personal (and the reverse) ---------------


def test_svetlana_case_free_then_personal_resolves_premium():
    """Reproduces the exact live shape found in the post-release audit: a
    default 'free' subscriptions row from signup, superseded by a later
    'personal' row from a manual grant. update_user_subscription() writes
    BOTH the users row (sub_status/subscription_status) and the canonical
    subscriptions row together, so a realistic before/after pair updates
    both — not just the subscriptions table in isolation."""
    before_account = {"global_role": "end_user", "sub_status": "free", "subscription_status": "free"}
    after_account = {"global_role": "end_user", "sub_status": "active", "subscription_status": "active"}

    before_grant = entitlements.resolve_entitlements_from_data(
        user_id="svetlana", account=before_account,
        active_sub={"status": "active", "plan_name": "free", "cancel_at_period_end": False},
    )
    after_grant = entitlements.resolve_entitlements_from_data(
        user_id="svetlana", account=after_account,
        active_sub={"status": "active", "plan_name": "personal", "cancel_at_period_end": False},
    )

    assert before_grant["is_premium"] is False
    assert after_grant["is_premium"] is True
    assert after_grant["source"] == "subscriptions"
    assert after_grant["plan_key"] == "personal"


def test_svetlana_case_revoke_personal_to_free_resolves_free():
    """The reverse: Premium -> Free via cancellation must propagate through
    the identical mechanism — no separate revoke-only code path exists.
    update_user_subscription() sets sub_status/subscription_status to the
    new status too, so a realistic cancel updates both the account row and
    the subscriptions row together."""
    premium_account = {"global_role": "end_user", "sub_status": "active", "subscription_status": "active"}
    cancelled_account = {"global_role": "end_user", "sub_status": "cancelled", "subscription_status": "cancelled"}

    while_premium = entitlements.resolve_entitlements_from_data(
        user_id="svetlana", account=premium_account,
        active_sub={"status": "active", "plan_name": "personal", "cancel_at_period_end": False},
    )
    after_cancel_period_ends = entitlements.resolve_entitlements_from_data(
        user_id="svetlana", account=cancelled_account,
        active_sub={"status": "cancelled", "plan_name": "personal", "cancel_at_period_end": True},
    )

    assert while_premium["is_premium"] is True
    assert after_cancel_period_ends["is_premium"] is False


def test_svetlana_case_client_query_staleness_window_is_short(monkeypatch):
    """Proves the client-side propagation fix at the config level: the
    entitlements query's staleTime is now short enough that the existing
    refetchOnWindowFocus/refetchOnReconnect (already enabled globally) can
    actually fire soon after a grant, instead of being suppressed for 30
    minutes."""
    from pathlib import Path

    source = Path("/var/www/VITALOOP/frontend/src/hooks/useQueries.js").read_text()
    entitlements_block_start = source.index("export const useUserEntitlements")
    entitlements_block = source[entitlements_block_start: entitlements_block_start + 2500]

    assert "staleTime: 60 * 1000" in entitlements_block
    assert "staleTime: 30 * 60 * 1000" not in entitlements_block


def test_login_logout_account_switch_clears_query_cache():
    from pathlib import Path

    source = Path("/var/www/VITALOOP/frontend/src/main.jsx").read_text()
    assert "onAuthStateChange" in source
    assert "queryClient.clear()" in source
    # Must compare against the PREVIOUS user id, not blindly clear on every
    # auth event (e.g. a token refresh for the same user must not thrash
    # the whole cache).
    assert "nextUserId !== lastUserId" in source


def test_client_admin_no_longer_queries_raw_sub_status_directly():
    from pathlib import Path

    source = Path("/var/www/VITALOOP/frontend/src/pages/ClientAdmin.jsx").read_text()
    assert "select('sub_status" not in source
    assert "/auth/entitlements" in source
