"""P37c — Dashboard Today read-only exposure tests.

Covers svc.get_latest_ready_report() / svc.plan_exists_for_upload() directly
(ordering, ownership, side-effect-freedom) and the /dashboard/summary route's
new `today_contract` block (response shape for the no-report and ready-report
cases). See:
  - output/p37a-dashboard-data-state-contract-review-2026-09-20.md
  - output/p37b-local-visual-prototype-2026-09-20.md
  - output/p37c-dashboard-today-read-only-exposure-2026-09-20.md
"""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.analysis import dashboard as dashboard_router
from app.services import supabase_service as svc


# ---------------------------------------------------------------------------
# Fake Supabase query builder: supports the exact chain shapes
# get_latest_ready_report()/plan_exists_for_upload() use (select/eq/in_/
# order/limit/execute, plus a no-op insert for write_audit_log's
# fire-and-forget call), filtering/sorting an in-memory table dict. Not a
# full Supabase emulator -- only what these two functions actually call.
# ---------------------------------------------------------------------------

class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, rows):
        self.rows = list(rows)
        self._order_keys = []  # list of (key, desc), applied in call order

    def select(self, *_a, **_k):
        return self

    def eq(self, key, value):
        self.rows = [r for r in self.rows if r.get(key) == value]
        return self

    def in_(self, key, values):
        values = set(values)
        self.rows = [r for r in self.rows if r.get(key) in values]
        return self

    def order(self, key, desc=False):
        self._order_keys.append((key, desc))
        return self

    def _apply_order(self):
        # Stable sort applied from the LAST specified key to the FIRST, so
        # the first .order() call ends up as the primary sort key -- the
        # same semantics as a multi-column SQL ORDER BY.
        for key, desc in reversed(self._order_keys):
            self.rows.sort(key=lambda r: (r.get(key) is None, r.get(key)), reverse=desc)

    def limit(self, n):
        self._apply_order()
        self.rows = self.rows[:n]
        return self

    def insert(self, *_a, **_k):
        return self

    def execute(self):
        self._apply_order()
        return _FakeResult(self.rows)


class FakeSupabase:
    def __init__(self, tables):
        self.tables = {name: list(rows) for name, rows in tables.items()}

    def table(self, name):
        return _FakeQuery(self.tables.get(name, []))


def install_fake_supabase(monkeypatch, tables):
    fake = FakeSupabase(tables)
    monkeypatch.setattr(svc, "_get_supabase", lambda: fake)
    return fake


# --- 1. No reports -------------------------------------------------------

@pytest.mark.asyncio
async def test_get_latest_ready_report_returns_none_when_no_report_versions(monkeypatch):
    install_fake_supabase(monkeypatch, {"report_versions": [], "lab_uploads": [], "audit_logs": []})
    result = await svc.get_latest_ready_report("user-1")
    assert result is None


@pytest.mark.asyncio
async def test_plan_exists_is_false_when_no_protocol_row(monkeypatch):
    install_fake_supabase(monkeypatch, {"protocols": [], "audit_logs": []})
    exists = await svc.plan_exists_for_upload("user-1", "upload-1")
    assert exists is False


# --- 2. Latest upload failed/processing, older report_versions row exists --

@pytest.mark.asyncio
async def test_latest_ready_report_ignores_failed_or_processing_upload(monkeypatch):
    # Only the OLDER upload ever got a report_versions row -- the newest
    # upload failed before generation completed, exactly per
    # report_history.py's own note that no row is written for a pending/
    # failed generation.
    install_fake_supabase(monkeypatch, {
        "report_versions": [
            {"id": "rv-old", "user_id": "user-1", "upload_id": "upload-old", "status": "completed", "created_at": "2026-09-01T00:00:00Z"},
        ],
        "lab_uploads": [
            {"id": "upload-old", "user_id": "user-1", "created_at": "2026-09-01T00:00:00Z", "lab_name": "Old Lab", "test_date": "2026-08-30", "collected_at": None, "reported_at": None, "date_source": "test_date", "date_confidence": "high"},
            {"id": "upload-new-failed", "user_id": "user-1", "created_at": "2026-09-10T00:00:00Z", "lab_name": "New Lab", "test_date": None, "collected_at": None, "reported_at": None, "date_source": None, "date_confidence": None},
        ],
        "audit_logs": [],
    })
    result = await svc.get_latest_ready_report("user-1")
    assert result is not None
    assert result["upload_id"] == "upload-old"
    assert result["measurement_date"] == "2026-08-30"


# --- 3. Multiple ready reports -> deterministic latest -------------------

@pytest.mark.asyncio
async def test_latest_ready_report_picks_most_recent_by_created_at(monkeypatch):
    install_fake_supabase(monkeypatch, {
        "report_versions": [
            {"id": "rv-1", "user_id": "user-1", "upload_id": "upload-1", "status": "completed", "created_at": "2026-07-01T00:00:00Z"},
            {"id": "rv-2", "user_id": "user-1", "upload_id": "upload-2", "status": "completed", "created_at": "2026-09-01T00:00:00Z"},
            {"id": "rv-3", "user_id": "user-1", "upload_id": "upload-3", "status": "completed", "created_at": "2026-08-01T00:00:00Z"},
        ],
        "lab_uploads": [
            {"id": "upload-2", "user_id": "user-1", "created_at": "2026-09-01T00:00:00Z", "lab_name": "Latest Lab", "test_date": "2026-08-28", "collected_at": None, "reported_at": None, "date_source": "test_date", "date_confidence": "high"},
        ],
        "audit_logs": [],
    })
    result = await svc.get_latest_ready_report("user-1")
    assert result["upload_id"] == "upload-2"
    assert result["report_version_id"] == "rv-2"


@pytest.mark.asyncio
async def test_latest_ready_report_tiebreaks_deterministically_on_same_timestamp(monkeypatch):
    # Same created_at (e.g. two locale rows from one generation event) --
    # ordering must still be deterministic (by id), not arbitrary.
    same_ts = "2026-09-01T00:00:00Z"
    install_fake_supabase(monkeypatch, {
        "report_versions": [
            {"id": "rv-a", "user_id": "user-1", "upload_id": "upload-x", "status": "completed", "created_at": same_ts, "locale": "en"},
            {"id": "rv-b", "user_id": "user-1", "upload_id": "upload-x", "status": "completed", "created_at": same_ts, "locale": "uk"},
        ],
        "lab_uploads": [
            {"id": "upload-x", "user_id": "user-1", "created_at": same_ts, "lab_name": "Lab X", "test_date": None, "collected_at": None, "reported_at": None, "date_source": None, "date_confidence": None},
        ],
        "audit_logs": [],
    })
    first = await svc.get_latest_ready_report("user-1")
    second = await svc.get_latest_ready_report("user-1")
    assert first["report_version_id"] == second["report_version_id"] == "rv-b"  # "rv-b" > "rv-a" lexicographically, desc


# --- 4 & 5. Plan existence, and no-generation guarantee -------------------

@pytest.mark.asyncio
async def test_plan_exists_false_and_generation_never_called(monkeypatch):
    install_fake_supabase(monkeypatch, {"protocols": [], "audit_logs": []})

    def _fail_if_called(*_a, **_k):
        raise AssertionError("protocol generation must never be called by a read-only existence check")

    # Patch every generation-capable symbol plan_exists_for_upload/
    # get_protocol_by_upload could plausibly reach, so the test fails loudly
    # if a future change accidentally wires generation into this path.
    monkeypatch.setattr("app.services.ai.openai_service.generate_protocol", _fail_if_called, raising=False)

    exists = await svc.plan_exists_for_upload("user-1", "upload-1")
    assert exists is False


@pytest.mark.asyncio
async def test_plan_exists_true_when_protocol_row_present(monkeypatch):
    install_fake_supabase(monkeypatch, {
        "protocols": [
            {"id": "proto-1", "user_id": "user-1", "upload_id": "upload-1", "recommendations": [{"supplement": "Vitamin D"}]},
        ],
        "audit_logs": [],
    })
    exists = await svc.plan_exists_for_upload("user-1", "upload-1")
    assert exists is True


# --- 6. Another user's report/protocol is never exposed -------------------

@pytest.mark.asyncio
async def test_latest_ready_report_never_returns_another_users_report(monkeypatch):
    install_fake_supabase(monkeypatch, {
        "report_versions": [
            {"id": "rv-other", "user_id": "other-user", "upload_id": "upload-other", "status": "completed", "created_at": "2026-09-15T00:00:00Z"},
        ],
        "lab_uploads": [
            {"id": "upload-other", "user_id": "other-user", "created_at": "2026-09-15T00:00:00Z", "lab_name": "Other User Lab", "test_date": None, "collected_at": None, "reported_at": None, "date_source": None, "date_confidence": None},
        ],
        "audit_logs": [],
    })
    result = await svc.get_latest_ready_report("user-1")
    assert result is None


@pytest.mark.asyncio
async def test_plan_exists_never_returns_true_for_another_users_protocol(monkeypatch):
    install_fake_supabase(monkeypatch, {
        "protocols": [
            {"id": "proto-other", "user_id": "other-user", "upload_id": "upload-1", "recommendations": []},
        ],
        "audit_logs": [],
    })
    exists = await svc.plan_exists_for_upload("user-1", "upload-1")
    assert exists is False


# --- 7. Old/frozen snapshot path remains read-only -------------------------

@pytest.mark.asyncio
async def test_blocked_status_report_counts_as_ready_without_recomputation(monkeypatch):
    # "blocked" is a terminal, already-sanitized-at-write-time outcome per
    # report_history.py::is_frozen_report_version() -- servable exactly like
    # "completed", never recomputed.
    install_fake_supabase(monkeypatch, {
        "report_versions": [
            {"id": "rv-blocked", "user_id": "user-1", "upload_id": "upload-1", "status": "blocked", "created_at": "2026-06-01T00:00:00Z"},
        ],
        "lab_uploads": [
            {"id": "upload-1", "user_id": "user-1", "created_at": "2026-06-01T00:00:00Z", "lab_name": "Legacy Lab", "test_date": "2026-05-28", "collected_at": None, "reported_at": None, "date_source": "test_date", "date_confidence": "high"},
        ],
        "audit_logs": [],
    })
    result = await svc.get_latest_ready_report("user-1")
    assert result["report_status"] == "blocked"
    assert result["upload_id"] == "upload-1"


@pytest.mark.asyncio
async def test_needs_confirmation_status_is_never_treated_as_ready(monkeypatch):
    install_fake_supabase(monkeypatch, {
        "report_versions": [
            {"id": "rv-pending", "user_id": "user-1", "upload_id": "upload-1", "status": "needs_confirmation", "created_at": "2026-09-01T00:00:00Z"},
        ],
        "lab_uploads": [],
        "audit_logs": [],
    })
    result = await svc.get_latest_ready_report("user-1")
    assert result is None


# --- 8. Free vs Premium does not affect the boolean existence read ---------

def test_plan_exists_and_latest_ready_report_take_no_entitlement_input():
    import inspect
    sig_plan = inspect.signature(svc.plan_exists_for_upload)
    sig_report = inspect.signature(svc.get_latest_ready_report)
    forbidden = {"entitlements", "is_premium", "subscription", "current_user"}
    assert forbidden.isdisjoint(sig_plan.parameters.keys())
    assert forbidden.isdisjoint(sig_report.parameters.keys())


def test_plan_exists_source_never_references_subscription_gate():
    import inspect
    source = inspect.getsource(svc.plan_exists_for_upload) + inspect.getsource(svc.get_latest_ready_report)
    assert "require_active_subscription" not in source
    assert "resolve_user_entitlements" not in source
    assert "is_premium" not in source


# ---------------------------------------------------------------------------
# Route-level: /dashboard/summary's new `today_contract` block
# ---------------------------------------------------------------------------

def _override_common_dashboard_reads(monkeypatch, user_id):
    """Mirrors tests/test_dashboard_summary_route.py's existing pattern so
    the route can be exercised end-to-end without a real Supabase client."""
    async def fake_get_user_account(_user_id):
        return {"id": user_id, "email": "user@example.com", "full_name": "Test User", "global_role": "end_user", "sub_status": "free", "created_at": "2026-01-01T00:00:00Z"}

    async def fake_get_user_progress(_user_id):
        return []

    async def fake_get_user_insights(_user_id):
        return []

    async def fake_get_user_upload_count(_user_id):
        return 0

    async def fake_resolve_onboarding_state(_user_id, _current_user):
        return {"requires_onboarding": False, "current_stage": "complete", "current_stage_label": "Onboarding complete", "checklist": {}, "completion_pct": 100}

    async def fake_fetch_assignments(_user_id, _global_role):
        return []

    async def fake_fetch_health_and_streak(_user_id):
        return None, 0, 0

    async def fake_fetch_user_goals(_user_id):
        return 0

    async def fake_fetch_latest_activity(_user_id):
        return None, None

    monkeypatch.setattr(svc, "get_user_account", fake_get_user_account)
    monkeypatch.setattr(svc, "get_user_progress", fake_get_user_progress)
    monkeypatch.setattr(svc, "get_user_insights", fake_get_user_insights)
    monkeypatch.setattr(svc, "get_user_upload_count", fake_get_user_upload_count)
    monkeypatch.setattr(dashboard_router, "_resolve_onboarding_state", fake_resolve_onboarding_state)
    monkeypatch.setattr(dashboard_router, "_fetch_assignments", fake_fetch_assignments)
    monkeypatch.setattr(dashboard_router, "_fetch_health_and_streak", fake_fetch_health_and_streak)
    monkeypatch.setattr(dashboard_router, "_fetch_user_goals", fake_fetch_user_goals)
    monkeypatch.setattr(dashboard_router, "_fetch_latest_activity", fake_fetch_latest_activity)


@pytest.mark.asyncio
async def test_dashboard_summary_today_contract_no_report(monkeypatch):
    user_id = str(uuid.uuid4())
    _override_common_dashboard_reads(monkeypatch, user_id)

    async def fake_get_latest_ready_report(_user_id):
        return None

    monkeypatch.setattr(svc, "get_latest_ready_report", fake_get_latest_ready_report)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id, "email": "user@example.com"}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/dashboard/summary")
        assert response.status_code == 200
        contract = response.json()["today_contract"]
        assert contract["latest_ready_report"] is None
        assert contract["latest_ready_report_status"] == "none"
        assert contract["plan_exists_for_latest_ready_report"] is None
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_dashboard_summary_today_contract_ready_report_with_plan(monkeypatch):
    user_id = str(uuid.uuid4())
    _override_common_dashboard_reads(monkeypatch, user_id)

    async def fake_get_latest_ready_report(_user_id):
        return {
            "upload_id": "upload-42",
            "report_version_id": "rv-42",
            "report_status": "completed",
            "report_generated_at": "2026-09-18T14:22:00Z",
            "upload_created_at": "2026-09-15T09:00:00Z",
            "measurement_date": "2026-09-14",
            "lab_name": "Quest Diagnostics",
        }

    async def fake_plan_exists_for_upload(_user_id, upload_id):
        assert upload_id == "upload-42"
        return True

    monkeypatch.setattr(svc, "get_latest_ready_report", fake_get_latest_ready_report)
    monkeypatch.setattr(svc, "plan_exists_for_upload", fake_plan_exists_for_upload)

    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id, "email": "user@example.com"}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/dashboard/summary")
        assert response.status_code == 200
        contract = response.json()["today_contract"]
        assert contract["latest_ready_report"]["upload_id"] == "upload-42"
        assert contract["latest_ready_report_status"] == "ready"
        assert contract["plan_exists_for_latest_ready_report"] is True
    finally:
        app.dependency_overrides.clear()
