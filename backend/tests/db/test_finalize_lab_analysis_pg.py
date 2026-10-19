"""Real-PostgreSQL tests for finalize_lab_analysis. NOT RUN unless explicitly enabled:
  VITALOOP_TEST_PG_DSN=postgresql://...@localhost/vitaloop_test_<name>
  VITALOOP_TEST_PG_CONFIRM_DISPOSABLE=i-understand-this-database-is-disposable
The target must pass tests/db/safety.py BEFORE any DDL. Roles are operator-provisioned
(tests/db/provision_cluster_roles.sql); tests never create roles or drop shared schemas.
Not executed in this change set: guarantees below are UNVERIFIED until run."""
import copy
import asyncio
import json
import logging
import os
import threading
import uuid
from pathlib import Path

import pytest

from app.services.analysis_input_digest import canonical_input_digest
from app.services import recovery_dispatcher as dispatcher
from app.services import supabase_service as svc
from app.workers import autonomous_recovery as worker
from tests.db.safety import (
    CONFIRM_ENV, UnsafeTarget, validate_dsn, validate_server_state,
)

DSN = os.environ.get("VITALOOP_TEST_PG_DSN")
pytestmark = pytest.mark.skipif(not DSN, reason="VITALOOP_TEST_PG_DSN not set")

HERE = Path(__file__).parent
MIGRATIONS = (
    HERE.parents[1] / "migrations" / "20261016120000_atomic_lab_analysis_finalization.sql",
    HERE.parents[1] / "migrations" / "20261019090000_autonomous_recovery_worker.sql",
)
TEST_TABLES = (
    "analysis_followup_work", "analysis_operations", "report_versions", "biomarkers", "lab_uploads",
    "intervention_events", "safety_events", "analysis_quality_gates", "clinical_data_integrity_events",
    "evidence_gaps", "health_state_versions", "protocols", "timeline_events", "audit_logs",
)
SIG = "uuid,uuid,uuid,text,bigint,uuid,text,text,jsonb,jsonb"


def _connect():
    psycopg = pytest.importorskip("psycopg")
    return psycopg.connect(DSN, autocommit=True)


@pytest.fixture(scope="module")
def db():
    try:
        validate_dsn(DSN, os.environ.get(CONFIRM_ENV))
    except UnsafeTarget as exc:
        pytest.fail(f"unsafe PostgreSQL target: {exc}")
    conn = _connect()
    cur = conn.cursor()
    cur.execute("select shobj_description(oid,'pg_database') from pg_database where datname=current_database()")
    comment = cur.fetchone()[0]
    cur.execute("select nspname from pg_namespace")
    schemas = [r[0] for r in cur.fetchall()]
    cur.execute("select (select count(*) from pg_class where relnamespace='public'::regnamespace)"
                " + (select count(*) from pg_proc where pronamespace='public'::regnamespace)")
    objs = cur.fetchone()[0]
    cur.execute("select rolname from pg_roles")
    roles = [r[0] for r in cur.fetchall()]

    # Check for unexpected objects before applying migration
    cur.execute("select extname from pg_extension where extnamespace <> 'pg_catalog'::regnamespace")
    extensions = [r[0] for r in cur.fetchall()]
    cur.execute("select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='v'")
    views_count = cur.fetchone()[0]
    cur.execute("select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='S'")
    sequences_count = cur.fetchone()[0]
    cur.execute("select count(*) from pg_type where typnamespace='public'::regnamespace and typtype='c'")
    types_count = cur.fetchone()[0]

    # Validate every privilege-bearing finalizer attribute. Missing catalog data fails closed.
    cur.execute("""select rolname, rolcanlogin, rolsuper, rolbypassrls, rolinherit,
                          rolcreatedb, rolcreaterole, rolreplication
                   from pg_roles where rolname = 'vitaloop_finalizer'""")
    finalizer_attrs = cur.fetchone()
    role_attrs = {}
    if finalizer_attrs:
        role_attrs["vitaloop_finalizer"] = {
            "rolcanlogin": finalizer_attrs[1],
            "rolsuper": finalizer_attrs[2],
            "rolbypassrls": finalizer_attrs[3],
            "rolinherit": finalizer_attrs[4],
            "rolcreatedb": finalizer_attrs[5],
            "rolcreaterole": finalizer_attrs[6],
            "rolreplication": finalizer_attrs[7],
        }

    # The owner must not inherit authority from any direct or transitive granted role.
    cur.execute("""
        with recursive finalizer_memberships(oid, rolname) as (
            select granted.oid, granted.rolname
            from pg_catalog.pg_auth_members membership
            join pg_catalog.pg_roles member on member.oid = membership.member
            join pg_catalog.pg_roles granted on granted.oid = membership.roleid
            where member.rolname = 'vitaloop_finalizer'
          union
            select granted.oid, granted.rolname
            from finalizer_memberships inherited
            join pg_catalog.pg_auth_members membership on membership.member = inherited.oid
            join pg_catalog.pg_roles granted on granted.oid = membership.roleid
        )
        select rolname from finalizer_memberships
    """)
    finalizer_memberships = [row[0] for row in cur.fetchall()]

    cur.execute("select current_user")
    migration_user = cur.fetchone()[0]

    # Verify migration_user already has vitaloop_finalizer membership (operator-provisioned)
    cur.execute("""select count(*) from pg_roles r
                   where r.rolname = %s
                   and pg_has_role(r.oid, 'vitaloop_finalizer', 'member')""", (migration_user,))
    has_membership = cur.fetchone()[0] > 0
    if not has_membership:
        conn.close()
        pytest.fail(f"migration user '{migration_user}' must be provisioned with vitaloop_finalizer membership "
                   f"(see provision_cluster_roles.sql)")

    problems = validate_server_state(comment=comment, schemas=schemas, public_objects=objs,
                                     roles=roles, extensions=extensions, views=views_count,
                                     sequences=sequences_count, types_=types_count,
                                     role_attrs=role_attrs,
                                     role_memberships=finalizer_memberships)
    if problems:
        conn.close()
        pytest.fail(f"unsafe PostgreSQL target: {problems}")

    try:
        cur.execute((HERE / "bootstrap.sql").read_text())
        for migration in MIGRATIONS:
            cur.execute(migration.read_text())
        yield conn
    finally:
        # Cleanup: remove test objects only. Do NOT auto-revoke membership.
        # Pre-existing memberships are operator-provisioned and remain across test runs.
        try:
            for t in TEST_TABLES:
                cur.execute(f"drop table if exists public.{t} cascade")
            cur.execute("drop function if exists public.finalize_lab_analysis(" + SIG + ")")
            for fn in ("lab_analysis_enc(text)", "lab_analysis_canon_numeric(jsonb)",
                       "lab_analysis_num_eq(jsonb,jsonb)", "lab_analysis_validate_projection(jsonb)",
                       "lab_analysis_input_digest(uuid,text,text,jsonb)",
                       "lab_analysis_validate_report(jsonb,uuid,text,jsonb)",
                       "lab_analysis_recovery_payload_hash(jsonb)",
                       "claim_analysis_followup_work(uuid,uuid,text,uuid)",
                       "complete_analysis_followup_work(uuid,uuid,text,uuid,text,text)",
                       "load_analysis_followup_work_payload(uuid,uuid,text)",
                       "project_report_protocol(uuid,uuid,uuid)",
                       "atomic_finalization_schema_preflight()",
                       "autonomous_recovery_schema_preflight()"):
                cur.execute(f"drop function if exists public.{fn}")
        except Exception as e:
            pytest.fail(f"cleanup failed and must be explicit; do not mask: {e}")
        finally:
            conn.close()


def row(**k):
    d = dict(name="Ferritin", value=45.5, unit="ng/mL", ref_low=30, ref_high=400, status="OPTIMAL",
             category=None, canonical_name="ferritin", reference_source=None, unevaluated_reason=None)
    d.update(k)
    return d


def report(rid, rows, locale="en"):
    h = "a" * 64
    return {
        "version": "v1", "locale": locale, "status": "completed",
        "input_snapshot": {
            "biomarkers": copy.deepcopy(rows) + [], "protocol_projection": [],
            "extra_clinical": {"k": [1, 2]},
        },
        "knowledge_report": {}, "protocol": [], "safety_result": {},
        "explainability": {"frozen_protocol_evidence": {
            "schema": "protocol_frozen_evidence_v1", "report_version_id": str(rid),
            "snapshot": {"schema": "protocol_action_evidence_snapshot_v1", "report_version_id": str(rid),
                         "input_context_hash": h, "entries": [{"x": 1}], "integrity_hash": h}}},
    }


class Case:
    def __init__(self, conn):
        self.conn, self.user, self.upload = conn, uuid.uuid4(), uuid.uuid4()
        self.rows = [row()]
        c = conn.cursor()
        c.execute("insert into public.lab_uploads(id,user_id) values (%s,%s)", (self.upload, self.user))

    def args(self, **o):
        rid = o.pop("rid", uuid.uuid4())
        rows = o.pop("rows", self.rows)
        a = dict(user=self.user, upload=self.upload, key=uuid.uuid4(), gen=0, rid=rid, locale="en",
                 pv="v1", rows=rows, report=report(rid, rows))
        a.update(o)
        if "hash" not in a:
            a["hash"] = canonical_input_digest(upload_id=a["upload"], locale=a["locale"],
                                               pipeline_version=a["pv"], projection=a["rows"])
        return a

    def call(self, conn=None, **o):
        a = self.args(**o)
        cur = (conn or self.conn).cursor()
        cur.execute("select public.finalize_lab_analysis(%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb)",
                    (a["user"], a["upload"], a["key"], a["hash"], a["gen"], a["rid"], a["locale"], a["pv"],
                     json.dumps(a["rows"]), json.dumps(a["report"])))
        return cur.fetchone()[0], a

    def count(self, table, where="upload_id=%s"):
        c = self.conn.cursor()
        c.execute(f"select count(*) from public.{table} where {where}", (self.upload,))
        return c.fetchone()[0]


def sqlstate(exc):
    return getattr(exc, "sqlstate", None)


def expect_error(fn, state):
    with pytest.raises(Exception) as ei:
        fn()
    assert sqlstate(ei.value) == state, ei.value


def _row_dict(cursor, query, params=()):
    cursor.execute(query, params)
    row = cursor.fetchone()
    if row is None:
        return None
    return dict(zip((column.name for column in cursor.description), row))


@pytest.mark.parametrize(
    ("initial_state", "expected_attempt_count"),
    (("pending", 1), ("retryable", 2), ("expired_lease", 2)),
)
@pytest.mark.asyncio
async def test_autonomous_worker_recovers_committed_timeline_without_a_new_request(
    db, monkeypatch, caplog, initial_state, expected_attempt_count,
):
    """E2E: a separate worker consumes an actual frozen-ledger item via SQL RPCs."""
    case = Case(db)
    committed, args = case.call()
    report_id = str(committed["report_version_id"])
    user_id, upload_id = str(case.user), str(case.upload)
    cur = db.cursor()

    # Keep one real pending effect for this focused E2E scenario. The other
    # frozen rows are transitioned through the production claim/complete RPC;
    # no constraints, payloads, or RLS policies are bypassed.
    for effect_type in (
        "retest_obligations", "retest_fulfillment", "lab_plan_fulfillment",
        "safety_events", "intelligence_artifacts", "protocol", "audit",
    ):
        lease = uuid.uuid4()
        cur.execute("select public.claim_analysis_followup_work(%s,%s,%s,%s)",
                    (user_id, report_id, effect_type, lease))
        assert cur.fetchone()[0]["claimed"] is True
        cur.execute("select public.complete_analysis_followup_work(%s,%s,%s,%s,%s,%s)",
                    (user_id, report_id, effect_type, lease, "failed", "synthetic_e2e_scope"))
        assert cur.fetchone()[0]["status"] == "failed"

    if initial_state != "pending":
        interrupted_lease = uuid.uuid4()
        cur.execute("select public.claim_analysis_followup_work(%s,%s,%s,%s)",
                    (user_id, report_id, "timeline", interrupted_lease))
        assert cur.fetchone()[0]["claimed"] is True
        if initial_state == "retryable":
            cur.execute("select public.complete_analysis_followup_work(%s,%s,%s,%s,%s,%s)",
                        (user_id, report_id, "timeline", interrupted_lease, "retryable", "synthetic_retry"))
        else:
            # The first process has terminated without acknowledgement. Move
            # only the lease clock backwards to simulate its real expiry.
            cur.execute("update public.analysis_followup_work "
                        "set lease_expires_at=clock_timestamp() - interval '1 second' "
                        "where report_version_id=%s and effect_type='timeline'", (report_id,))

    cur.execute("select status, attempt_count from public.analysis_followup_work "
                "where report_version_id=%s and effect_type='timeline'", (report_id,))
    assert cur.fetchone() == ({"pending": "pending", "retryable": "retryable", "expired_lease": "processing"}[initial_state],
                              0 if initial_state == "pending" else 1)

    stopped = asyncio.Event()

    async def list_global(*, limit):
        assert limit >= 1
        row = _row_dict(cur, """
            select user_id::text, report_version_id::text
            from public.analysis_followup_work
            where status in ('pending', 'retryable')
               or (status = 'processing' and lease_expires_at <= clock_timestamp())
            order by created_at
            limit 1
        """)
        return [row] if row else []

    async def get_report(user_id, report_version_id):
        return _row_dict(cur, """
            select id::text, user_id::text, upload_id::text, version, locale,
                   input_snapshot, knowledge_report, protocol, safety_result,
                   explainability, status
            from public.report_versions where id=%s and user_id=%s
        """, (report_version_id, user_id))

    async def authoritative(*, user_id, upload_id, report_version_id):
        report = await get_report(user_id=user_id, report_version_id=report_version_id)
        cur.execute("""
            select effect_type, status, attempt_count
            from public.analysis_followup_work
            where user_id=%s and upload_id=%s and report_version_id=%s
            order by effect_type
        """, (user_id, upload_id, report_version_id))
        work = [dict(zip((column.name for column in cur.description), row)) for row in cur.fetchall()]
        return {"report_version": report, "followup_work": work}

    async def claim(*, user_id, report_version_id, effect_type, lease_token):
        cur.execute("select public.claim_analysis_followup_work(%s,%s,%s,%s)",
                    (user_id, report_version_id, effect_type, lease_token))
        return cur.fetchone()[0]

    async def load_payload(*, user_id, report_version_id, effect_type):
        cur.execute("select public.load_analysis_followup_work_payload(%s,%s,%s)",
                    (user_id, report_version_id, effect_type))
        return cur.fetchone()[0]

    async def complete(*, user_id, report_version_id, effect_type, lease_token, status, error_code=None):
        cur.execute("select public.complete_analysis_followup_work(%s,%s,%s,%s,%s,%s)",
                    (user_id, report_version_id, effect_type, lease_token, status, error_code))
        return cur.fetchone()[0]

    async def persist_timeline(user_id, event_type, summary, *, analysis_effect_key, require_durable, **_unused):
        assert require_durable is True
        cur.execute("""
            insert into public.timeline_events(user_id, event_type, summary, analysis_effect_key)
            values (%s,%s,%s,%s)
            on conflict (analysis_effect_key) do nothing
        """, (user_id, event_type, summary, analysis_effect_key))
        stopped.set()

    monkeypatch.setattr(svc, "list_global_recoverable_followup_reports", list_global)
    monkeypatch.setattr(svc, "get_report_version_for_user", get_report)
    monkeypatch.setattr(svc, "load_authoritative_finalization_replay", authoritative)
    monkeypatch.setattr(svc, "claim_frozen_followup_work", claim)
    monkeypatch.setattr(svc, "load_frozen_followup_payload", load_payload)
    monkeypatch.setattr(svc, "complete_frozen_followup_work", complete)
    monkeypatch.setattr(svc, "save_timeline_event", persist_timeline)
    monkeypatch.setattr(worker.settings, "recovery_worker_enabled", True)
    monkeypatch.setattr(worker.settings, "recovery_worker_interval_seconds", 60)

    with caplog.at_level(logging.INFO):
        await asyncio.wait_for(worker.run_worker(stop_event=stopped), timeout=5)

    cur.execute("select status, attempt_count, lease_token, completed_at is not null "
                "from public.analysis_followup_work where report_version_id=%s and effect_type='timeline'", (report_id,))
    assert cur.fetchone() == ("completed", expected_attempt_count, None, True)
    cur.execute("select count(*) from public.timeline_events where user_id=%s and event_type='lab_analyzed'", (user_id,))
    assert cur.fetchone()[0] == 1
    assert "autonomous_recovery_cycle discovered=1 processed=1 failed=0" in caplog.messages
    assert "autonomous_recovery_worker_started" in caplog.messages
    assert "autonomous_recovery_worker_stopped" in caplog.messages
    assert user_id not in caplog.text and report_id not in caplog.text


def test_commit_and_snapshot_roundtrip(db):
    c = Case(db)
    res, a = c.call()
    assert res["replay"] is False and res["generation"] == 1
    cur = db.cursor()
    cur.execute("select input_snapshot from public.report_versions where id=%s", (a["rid"],))
    assert cur.fetchone()[0] == a["report"]["input_snapshot"]


def test_replay_does_not_write_or_replace(db):
    c = Case(db)
    res, a = c.call()
    cur = db.cursor()
    cur.execute("update public.biomarkers set value=1 where upload_id=%s", (c.upload,))
    res2, _ = c.call(key=a["key"], gen=0, rid=uuid.uuid4(), rows=a["rows"], hash=a["hash"])
    assert res2["replay"] is True and res2["report_version_id"] == str(a["rid"])
    assert c.count("report_versions") == 1
    cur.execute("select value from public.biomarkers where upload_id=%s", (c.upload,))
    assert float(cur.fetchone()[0]) == 1.0


def test_commit_creates_one_durable_followup_row_per_effect_and_replay_does_not_duplicate(db):
    c = Case(db)
    _, a = c.call()
    cur = db.cursor()
    cur.execute("select effect_type, status from public.analysis_followup_work where report_version_id=%s", (a["rid"],))
    rows = cur.fetchall()
    assert len(rows) == 8
    assert {effect for effect, _ in rows} == {
        "retest_obligations", "retest_fulfillment", "lab_plan_fulfillment", "safety_events",
        "intelligence_artifacts", "protocol", "timeline", "audit",
    }
    assert {status for _, status in rows} == {"pending"}
    replay, _ = c.call(key=a["key"], gen=0, rid=uuid.uuid4(), rows=a["rows"], hash=a["hash"])
    assert replay["replay"] is True
    cur.execute("select count(*) from public.analysis_followup_work where report_version_id=%s", (a["rid"],))
    assert cur.fetchone()[0] == 8


def test_followup_lease_prevents_completed_effect_from_being_reclaimed(db):
    c = Case(db)
    _, a = c.call()
    cur = db.cursor()
    lease = uuid.uuid4()
    cur.execute("select public.claim_analysis_followup_work(%s,%s,%s,%s)",
                (c.user, a["rid"], "timeline", lease))
    assert cur.fetchone()[0] == {"claimed": True, "status": "processing", "attempt_count": 1}
    cur.execute("select public.complete_analysis_followup_work(%s,%s,%s,%s,%s,%s)",
                (c.user, a["rid"], "timeline", lease, "completed", None))
    assert cur.fetchone()[0] == {"completed": True, "status": "completed"}
    cur.execute("select public.claim_analysis_followup_work(%s,%s,%s,%s)",
                (c.user, a["rid"], "timeline", uuid.uuid4()))
    assert cur.fetchone()[0] == {"claimed": False, "status": "completed", "attempt_count": 1}


def test_concurrent_followup_claims_allow_exactly_one_dispatcher(db):
    c = Case(db)
    _, args = c.call()
    results, barrier = [], threading.Barrier(2)

    def claim_once():
        conn = _connect()
        try:
            barrier.wait()
            cur = conn.cursor()
            cur.execute("select public.claim_analysis_followup_work(%s,%s,%s,%s)",
                        (c.user, args["rid"], "timeline", uuid.uuid4()))
            results.append(cur.fetchone()[0])
        finally:
            conn.close()

    threads = [threading.Thread(target=claim_once) for _ in range(2)]
    [thread.start() for thread in threads]
    [thread.join() for thread in threads]
    assert sorted(row["claimed"] for row in results) == [False, True]
    assert {row["status"] for row in results} == {"processing"}


def test_stale_followup_lease_cannot_complete_an_effect(db):
    c = Case(db)
    _, args = c.call()
    cur = db.cursor()
    lease = uuid.uuid4()
    cur.execute("select public.claim_analysis_followup_work(%s,%s,%s,%s)",
                (c.user, args["rid"], "timeline", lease))
    expect_error(lambda: cur.execute("select public.complete_analysis_followup_work(%s,%s,%s,%s,%s,%s)",
                                     (c.user, args["rid"], "timeline", uuid.uuid4(), "completed", None)),
                 "VL409")


def test_followup_retry_limit_is_terminal_after_five_attempts(db):
    c = Case(db)
    _, a = c.call()
    cur = db.cursor()
    for attempt in range(1, 6):
        lease = uuid.uuid4()
        cur.execute("select public.claim_analysis_followup_work(%s,%s,%s,%s)",
                    (c.user, a["rid"], "audit", lease))
        assert cur.fetchone()[0] == {"claimed": True, "status": "processing", "attempt_count": attempt}
        cur.execute("select public.complete_analysis_followup_work(%s,%s,%s,%s,%s,%s)",
                    (c.user, a["rid"], "audit", lease, "retryable", "writer_failed"))
        assert cur.fetchone()[0] == {"completed": False, "status": "retryable"}
    cur.execute("select public.claim_analysis_followup_work(%s,%s,%s,%s)",
                (c.user, a["rid"], "audit", uuid.uuid4()))
    assert cur.fetchone()[0] == {"claimed": False, "status": "failed", "attempt_count": 5}


@pytest.mark.parametrize("table", [
    "intervention_events", "safety_events", "analysis_quality_gates", "clinical_data_integrity_events",
    "evidence_gaps", "health_state_versions", "protocols", "timeline_events", "audit_logs",
])
def test_append_only_effect_key_is_database_unique_and_historical_nulls_remain_allowed(db, table):
    c = Case(db)
    key = f"effect-{uuid.uuid4()}"
    cur = db.cursor()
    if table == "intervention_events":
        sql = "insert into public.intervention_events(user_id, analysis_effect_key) values (%s,%s)"
        null_sql = "insert into public.intervention_events(user_id) values (%s)"
    elif table == "safety_events":
        sql = "insert into public.safety_events(user_id, analysis_effect_key) values (%s,%s)"
        null_sql = "insert into public.safety_events(user_id) values (%s)"
    elif table in {"analysis_quality_gates", "clinical_data_integrity_events", "evidence_gaps", "health_state_versions"}:
        sql = f"insert into public.{table}(user_id, upload_id, analysis_effect_key) values (%s,%s,%s)"
        null_sql = f"insert into public.{table}(user_id, upload_id) values (%s,%s)"
    elif table == "protocols":
        sql = "insert into public.protocols(user_id, upload_id, analysis_effect_key) values (%s,%s,%s)"
        null_sql = "insert into public.protocols(user_id, upload_id) values (%s,%s)"
    elif table == "timeline_events":
        sql = "insert into public.timeline_events(user_id,event_type,summary,analysis_effect_key) values (%s,%s,%s,%s)"
        null_sql = "insert into public.timeline_events(user_id,event_type,summary) values (%s,%s,%s)"
    else:
        sql = "insert into public.audit_logs(user_id,action,entity_type,entity_id,analysis_effect_key) values (%s,%s,%s,%s,%s)"
        null_sql = "insert into public.audit_logs(user_id,action,entity_type,entity_id) values (%s,%s,%s,%s)"

    if table in {"intervention_events", "safety_events"}:
        args, null_args = (c.user, key), (c.user,)
    elif table in {"analysis_quality_gates", "clinical_data_integrity_events", "evidence_gaps", "health_state_versions", "protocols"}:
        args, null_args = (c.user, c.upload, key), (c.user, uuid.uuid4())
    elif table == "timeline_events":
        args, null_args = (c.user, "lab_analyzed", "test", key), (c.user, "lab_analyzed", "historical")
    else:
        args, null_args = (c.user, "create", "lab_upload", "x", key), (c.user, "create", "lab_upload", str(uuid.uuid4()))
    cur.execute(sql, args)
    expect_error(lambda: cur.execute(sql, args), "23505")
    cur.execute(null_sql, null_args)


def test_concurrent_duplicate_downstream_effect_allows_one_insert(db):
    c = Case(db)
    key = f"effect-{uuid.uuid4()}"
    results, barrier = [], threading.Barrier(2)

    def run():
        conn = _connect()
        try:
            barrier.wait()
            conn.cursor().execute(
                "insert into public.timeline_events(user_id,event_type,summary,analysis_effect_key) values (%s,%s,%s,%s)",
                (c.user, "lab_analyzed", "exactly once", key),
            )
            results.append(("ok", None))
        except Exception as exc:
            results.append(("err", sqlstate(exc)))
        finally:
            conn.close()

    threads = [threading.Thread(target=run) for _ in range(2)]
    [thread.start() for thread in threads]
    [thread.join() for thread in threads]
    assert sorted(results) == [("err", "23505"), ("ok", None)]


def _project_protocol(cur, case, report_id):
    cur.execute("select public.project_report_protocol(%s,%s,%s)", (case.user, case.upload, report_id))
    return cur.fetchone()[0]


def test_protocol_projection_never_replaces_newer_generation(db):
    c = Case(db)
    older = c.args()
    older["report"]["input_snapshot"]["protocol_projection"] = [{"key": "older"}]
    older_result, _ = c.call(**older)
    newer = c.args(gen=1)
    newer["report"]["input_snapshot"]["protocol_projection"] = [{"key": "newer"}]
    newer_result, _ = c.call(**newer)
    cur = db.cursor()
    assert _project_protocol(cur, c, older_result["report_version_id"])["status"] == "applied"
    assert _project_protocol(cur, c, newer_result["report_version_id"])["status"] == "applied"
    replay = _project_protocol(cur, c, older_result["report_version_id"])
    assert replay["status"] == "newer_projection"
    cur.execute("select source_report_version_id,recommendations from public.protocols where user_id=%s and upload_id=%s", (c.user, c.upload))
    source_id, recommendations = cur.fetchone()
    assert str(source_id) == newer_result["report_version_id"]
    assert recommendations == [{"key": "newer"}]


def test_legacy_protocol_without_source_fails_closed(db):
    c = Case(db)
    result, _ = c.call()
    cur = db.cursor()
    cur.execute("insert into public.protocols(user_id,upload_id,recommendations) values (%s,%s,%s::jsonb)",
                (c.user, c.upload, "[]"))
    expect_error(lambda: _project_protocol(cur, c, result["report_version_id"]), "VL409")


def test_recovery_payload_is_owner_scoped_and_tamper_detected(db):
    c = Case(db)
    result, _ = c.call()
    report_id = result["report_version_id"]
    cur = db.cursor()
    cur.execute("select public.load_analysis_followup_work_payload(%s,%s,%s)", (c.user, report_id, "timeline"))
    payload = cur.fetchone()[0]
    assert payload["report_version_id"] == str(report_id)
    assert payload["data"]["event_type"] == "lab_analyzed"
    expect_error(lambda: cur.execute("select public.load_analysis_followup_work_payload(%s,%s,%s)",
                                     (uuid.uuid4(), report_id, "timeline")), "VL404")
    cur.execute("update public.analysis_followup_work set work_payload = work_payload || %s::jsonb "
                "where report_version_id=%s and effect_type='timeline'", ('{"extra":true}', report_id))
    expect_error(lambda: cur.execute("select public.load_analysis_followup_work_payload(%s,%s,%s)",
                                     (c.user, report_id, "timeline")), "VL422")


def test_recovery_payload_input_hash_must_match_the_authoritative_operation(db):
    c = Case(db)
    result, _ = c.call()
    report_id = result["report_version_id"]
    cur = db.cursor()
    # Recompute the payload hash after tampering: integrity alone is not
    # provenance; it must still bind to the persisted operation input hash.
    cur.execute(
        "update public.analysis_followup_work "
        "set work_payload = jsonb_set(work_payload, '{input_hash}', to_jsonb(%s::text)), "
        "work_payload_hash = public.lab_analysis_recovery_payload_hash("
        "jsonb_set(work_payload, '{input_hash}', to_jsonb(%s::text))) "
        "where report_version_id=%s and effect_type='timeline'",
        ("0" * 64, "0" * 64, report_id),
    )
    expect_error(lambda: cur.execute("select public.load_analysis_followup_work_payload(%s,%s,%s)",
                                     (c.user, report_id, "timeline")), "VL422")


def test_concurrent_protocol_projection_prefers_newer_generation(db):
    c = Case(db)
    older = c.args()
    older["report"]["input_snapshot"]["protocol_projection"] = [{"key": "older"}]
    old_result, _ = c.call(**older)
    newer = c.args(gen=1)
    newer["report"]["input_snapshot"]["protocol_projection"] = [{"key": "newer"}]
    new_result, _ = c.call(**newer)
    results, barrier = [], threading.Barrier(2)

    def run(report_id):
        conn = _connect()
        try:
            barrier.wait()
            cur = conn.cursor()
            cur.execute("select public.project_report_protocol(%s,%s,%s)", (c.user, c.upload, report_id))
            results.append(("ok", cur.fetchone()[0]["status"]))
        except Exception as exc:
            results.append(("err", sqlstate(exc)))
        finally:
            conn.close()

    threads = [threading.Thread(target=run, args=(rid,)) for rid in (old_result["report_version_id"], new_result["report_version_id"])]
    [thread.start() for thread in threads]
    [thread.join() for thread in threads]
    assert all(kind == "ok" for kind, _ in results)
    cur = db.cursor()
    cur.execute("select source_report_version_id,recommendations from public.protocols where user_id=%s and upload_id=%s", (c.user, c.upload))
    source_id, recommendations = cur.fetchone()
    assert str(source_id) == new_result["report_version_id"]
    assert recommendations == [{"key": "newer"}]


def test_replay_precedes_generation_check(db):
    c = Case(db)
    _, a = c.call()
    res, _ = c.call(key=a["key"], gen=0, hash=a["hash"])
    assert res["replay"] is True
    expect_error(lambda: c.call(gen=0), "VL409")


def test_same_key_different_hash_or_upload_conflicts(db):
    c = Case(db)
    _, a = c.call()
    expect_error(lambda: c.call(key=a["key"], rows=[row(value=1)]), "VL409")
    other = Case(db)
    other.user = c.user
    cur = db.cursor()
    cur.execute("insert into public.lab_uploads(id,user_id) values (%s,%s)", (uuid.uuid4(), c.user))
    cur.execute("select id from public.lab_uploads where user_id=%s and id<>%s", (c.user, c.upload))
    other.upload = cur.fetchone()[0]
    expect_error(lambda: other.call(key=a["key"]), "VL409")
    assert other.count("biomarkers") == 0


def test_cross_user_rejected(db):
    c = Case(db)
    expect_error(lambda: c.call(user=uuid.uuid4()), "VL404")
    assert c.count("report_versions") == 0


def test_hash_mismatch_and_projection_errors(db):
    c = Case(db)
    expect_error(lambda: c.call(hash="0" * 64), "VL422")
    for bad in ([{**row(), "extra": 1}], [{k: v for k, v in row().items() if k != "category"}],
                [row(), row(name="FERRITIN")], [row(value="1")]):
        a = c.args(rows=[row()])
        a["rows"] = bad
        expect_error(lambda: c.call(rows=bad, hash="0" * 64), "VL422")
    assert c.count("report_versions") == 0


def test_snapshot_projection_mismatch(db):
    c = Case(db)
    a = c.args()
    a["report"]["input_snapshot"]["biomarkers"][0]["value"] = 46
    expect_error(lambda: c.call(report=a["report"], rid=a["rid"]), "VL422")


@pytest.mark.parametrize("mut", ["missing", "wrong_schema", "wrong_id", "bad_hash", "no_entries", "extra_key"])
def test_frozen_evidence_rejected(db, mut):
    c = Case(db)
    a = c.args()
    fe = a["report"]["explainability"]
    if mut == "missing":
        del fe["frozen_protocol_evidence"]
    else:
        f = fe["frozen_protocol_evidence"]
        if mut == "wrong_schema": f["schema"] = "x"
        if mut == "wrong_id": f["snapshot"]["report_version_id"] = str(uuid.uuid4())
        if mut == "bad_hash": f["snapshot"]["integrity_hash"] = "zz"
        if mut == "no_entries": f["snapshot"]["entries"] = []
        if mut == "extra_key": f["extra"] = 1
    expect_error(lambda: c.call(report=a["report"], rid=a["rid"]), "VL422")
    assert c.count("report_versions") == 0


def test_numeric_boundaries(db):
    c = Case(db)
    c.call(rows=[row(value=9999999.999, ref_low=-9999999.999)])
    c2 = Case(db)
    expect_error(lambda: c2.call(rows=[row(value=10000000)], hash="0" * 64), "VL422")
    expect_error(lambda: c2.call(rows=[row(value=1.0005)], hash="0" * 64), "VL422")


def test_digest_parity_with_python_vectors(db):
    cur = db.cursor()
    u = "11111111-1111-1111-1111-111111111111"
    cur.execute("select public.lab_analysis_input_digest(%s,'en','v1',%s::jsonb)", (u, json.dumps([row()])))
    assert cur.fetchone()[0] == "47ccabeba259a06cc599fb601e120988624fd299d618cd9da91bebd95b5eb0e4"
    rows = [row(name="Вітамін D", value=-9999999.999, ref_low=None, ref_high=0.0, category="Ліпіди"),
            row(name="B12", value=0, canonical_name="b12")]
    cur.execute("select public.lab_analysis_input_digest(%s,'uk','v1',%s::jsonb)", (u, json.dumps(rows)))
    assert cur.fetchone()[0] == "997a7f3f1ec419860f84ea34a7b8e1bc9bfa5f08792e0a18e211d779d9116299"


def test_failed_biomarker_insert_rolls_back_everything(db):
    c = Case(db)
    c.call()
    before = c.count("biomarkers")
    cur = db.cursor()
    cur.execute("update public.biomarkers set status='ELEVATED' where upload_id=%s", (c.upload,))
    bad = [row(name="X", status="NOT_A_STATUS")]
    expect_error(lambda: c.call(gen=1, rows=bad), "23514")
    cur.execute("select status from public.biomarkers where upload_id=%s", (c.upload,))
    assert cur.fetchone()[0] == "ELEVATED" and c.count("biomarkers") == before
    assert c.count("report_versions") == 1
    cur.execute("select analysis_generation from public.lab_uploads where id=%s", (c.upload,))
    assert cur.fetchone()[0] == 1


def test_sequential_reanalysis_and_stale_generation(db):
    c = Case(db)
    c.call()
    c.call(gen=1, rows=[row(value=50)])
    assert c.count("report_versions") == 2
    expect_error(lambda: c.call(gen=1, rows=[row(value=60)]), "VL409")


def _race(c, calls):
    results, barrier = [], threading.Barrier(len(calls))

    def run(kw):
        conn = _connect()
        try:
            barrier.wait()
            results.append(("ok", c.call(conn=conn, **kw)[0]))
        except Exception as exc:
            results.append(("err", sqlstate(exc)))
        finally:
            conn.close()
    ts = [threading.Thread(target=run, args=(kw,)) for kw in calls]
    [t.start() for t in ts]
    [t.join() for t in ts]
    return results


def test_concurrent_identical_requests_one_report(db):
    c = Case(db)
    a = c.args()
    res = _race(c, [dict(key=a["key"], rid=a["rid"], hash=a["hash"], report=a["report"])] * 4)
    assert all(r[0] == "ok" for r in res)
    assert sum(1 for r in res if not r[1]["replay"]) == 1
    assert c.count("report_versions") == 1


def test_concurrent_different_operations_generation_conflict(db):
    c = Case(db)
    res = _race(c, [dict(rows=[row(value=10 + i)]) for i in range(4)])
    assert sum(1 for r in res if r[0] == "ok") == 1
    assert all(r == ("err", "VL409") for r in res if r[0] == "err")
    assert c.count("report_versions") == 1


def test_concurrent_same_key_different_uploads(db):
    c, d = Case(db), Case(db)
    d.user = c.user
    cur = db.cursor()
    cur.execute("update public.lab_uploads set user_id=%s where id=%s", (c.user, d.upload))
    key = uuid.uuid4()
    res = []
    barrier = threading.Barrier(2)

    def run(case):
        conn = _connect()
        try:
            barrier.wait()
            res.append(("ok", case.call(conn=conn, key=key)[0]))
        except Exception as exc:
            res.append(("err", sqlstate(exc)))
        finally:
            conn.close()
    ts = [threading.Thread(target=run, args=(x,)) for x in (c, d)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert sorted(r[0] for r in res) == ["err", "ok"]
    assert ("err", "VL409") in res


def test_acl_owner_and_search_path_catalog(db):
    cur = db.cursor()
    cur.execute("""select p.proname, r.rolname, r.rolsuper, r.rolcanlogin, p.prosecdef, p.proconfig::text,
                          has_function_privilege('anon', p.oid, 'execute'),
                          has_function_privilege('authenticated', p.oid, 'execute'),
                          has_function_privilege('service_role', p.oid, 'execute'),
                          has_function_privilege('public', p.oid, 'execute')
                   from pg_proc p join pg_roles r on r.oid=p.proowner
                   where p.pronamespace='public'::regnamespace
                     and (p.proname like 'lab\\_analysis\\_%' or p.proname in
                       ('finalize_lab_analysis', 'claim_analysis_followup_work',
                        'complete_analysis_followup_work', 'load_analysis_followup_work_payload',
                        'project_report_protocol', 'atomic_finalization_schema_preflight'))""")
    rows = cur.fetchall()
    service_rpcs = {
        "finalize_lab_analysis", "claim_analysis_followup_work", "complete_analysis_followup_work",
        "load_analysis_followup_work_payload", "project_report_protocol",
        "atomic_finalization_schema_preflight",
    }
    assert len(rows) == 13
    for name, owner, sup, login, definer, cfg, anon, authd, svc, pub in rows:
        assert owner == "vitaloop_finalizer" and not sup and not login
        assert "search_path=pg_catalog, public" in cfg
        assert not (anon or authd or pub)
        assert svc == (name in service_rpcs)
        assert definer == (name in service_rpcs)


@pytest.mark.parametrize("role,ok", [("anon", False), ("authenticated", False), ("service_role", True)])
def test_rpc_execution_by_role(db, role, ok):
    c = Case(db)
    cur = db.cursor()
    cur.execute(f"set role {role}")
    try:
        if ok:
            c.call()
        else:
            expect_error(lambda: c.call(), "42501")
    finally:
        cur.execute("reset role")


def test_helpers_not_callable_by_clients(db):
    cur = db.cursor()
    for role in ("anon", "authenticated", "service_role"):
        cur.execute(f"set role {role}")
        expect_error(lambda: cur.execute("select public.lab_analysis_enc('x')"), "42501")
        cur.execute("reset role")


def test_release_preflight_requires_the_full_atomic_contract(db):
    cur = db.cursor()
    cur.execute("select public.atomic_finalization_schema_preflight()")
    assert cur.fetchone()[0] == {
        "schema_ready": True,
        "migration_contract": "20261016120000_atomic_lab_analysis_finalization",
    }
    for role in ("anon", "authenticated"):
        cur.execute(f"set role {role}")
        try:
            expect_error(lambda: cur.execute("select public.atomic_finalization_schema_preflight()"), "42501")
        finally:
            cur.execute("reset role")


def test_autonomous_recovery_preflight_requires_global_indexes_and_service_role(db):
    cur = db.cursor()
    cur.execute("select public.autonomous_recovery_schema_preflight()")
    assert cur.fetchone()[0] == {
        "schema_ready": True,
        "migration_contract": "20261019090000_autonomous_recovery_worker",
    }
    cur.execute("""select indexname from pg_indexes
                   where schemaname='public' and indexname in
                     ('idx_analysis_followup_work_global_retryable',
                      'idx_analysis_followup_work_global_expired_lease')""")
    assert {row[0] for row in cur.fetchall()} == {
        "idx_analysis_followup_work_global_retryable",
        "idx_analysis_followup_work_global_expired_lease",
    }
    cur.execute("""select r.rolname, p.prosecdef, p.proconfig::text,
                          has_function_privilege('service_role', p.oid, 'execute')
                   from pg_proc p join pg_roles r on r.oid=p.proowner
                   where p.oid='public.autonomous_recovery_schema_preflight()'::regprocedure""")
    owner, definer, config, service_execute = cur.fetchone()
    assert owner == "vitaloop_finalizer" and definer and service_execute
    assert "search_path=pg_catalog, public" in config
    for role in ("anon", "authenticated"):
        cur.execute(f"set role {role}")
        try:
            expect_error(lambda: cur.execute("select public.autonomous_recovery_schema_preflight()"), "42501")
        finally:
            cur.execute("reset role")
    cur.execute("set role service_role")
    try:
        cur.execute("select public.autonomous_recovery_schema_preflight()")
        assert cur.fetchone()[0]["schema_ready"] is True
    finally:
        cur.execute("reset role")


def test_autonomous_recovery_preflight_fails_closed_when_its_security_contract_drifts(db):
    """The service-only readiness RPC must detect catalog drift, not just indexes."""
    cur = db.cursor()
    function = "public.autonomous_recovery_schema_preflight()"
    mutations = (
        (
            f"grant execute on function {function} to authenticated",
            (f"revoke execute on function {function} from authenticated",),
        ),
        (
            f"alter function {function} set search_path to public",
            (f"alter function {function} set search_path to pg_catalog, public",),
        ),
    )

    for mutate, restore in mutations:
        cur.execute("set role vitaloop_finalizer")
        try:
            cur.execute(mutate)
        finally:
            cur.execute("reset role")
        try:
            cur.execute("set role service_role")
            expect_error(lambda: cur.execute(f"select {function}"), "VL503")
        finally:
            cur.execute("reset role")
            cur.execute("set role vitaloop_finalizer")
            for restore_statement in restore:
                cur.execute(restore_statement)
            cur.execute("reset role")

        cur.execute("set role service_role")
        try:
            cur.execute(f"select {function}")
            assert cur.fetchone()[0]["schema_ready"] is True
        finally:
            cur.execute("reset role")


def test_autonomous_recovery_preflight_rejects_wrong_owner_when_runner_can_simulate_drift(db):
    """Changing a function's owner requires a disposable-cluster superuser."""
    cur = db.cursor()
    cur.execute("select rolsuper from pg_catalog.pg_roles where rolname = current_user")
    if not cur.fetchone()[0]:
        pytest.skip("owner-drift simulation requires a superuser on the disposable cluster")

    function = "public.autonomous_recovery_schema_preflight()"
    cur.execute(f"alter function {function} owner to service_role")
    try:
        cur.execute("set role service_role")
        expect_error(lambda: cur.execute(f"select {function}"), "VL503")
    finally:
        cur.execute("reset role")
        cur.execute(f"alter function {function} owner to vitaloop_finalizer")
        # PostgreSQL clears the prior service-role ACL as part of ownership
        # transfer, so restore the complete intended contract.
        cur.execute(f"grant execute on function {function} to service_role")

    cur.execute("set role service_role")
    try:
        cur.execute(f"select {function}")
        assert cur.fetchone()[0]["schema_ready"] is True
    finally:
        cur.execute("reset role")


def test_rpc_works_under_rls_as_finalizer(db):
    c = Case(db)
    res, _ = c.call()
    assert res["replay"] is False
    assert c.count("analysis_operations") == 1


def test_composite_fk_integrity(db):
    c = Case(db)
    _, a = c.call()
    cur = db.cursor()
    cur.execute("select report_version_id from public.analysis_operations where upload_id=%s", (c.upload,))
    with pytest.raises(Exception) as ei:
        cur.execute("insert into public.analysis_operations values (%s,%s,%s,%s,%s,0,1,now())",
                    (uuid.uuid4(), uuid.uuid4(), c.upload, "a" * 64, a["rid"]))
    assert sqlstate(ei.value) in ("23503", "23505")
