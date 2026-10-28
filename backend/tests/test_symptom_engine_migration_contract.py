from pathlib import Path


MIGRATIONS = Path(__file__).parents[1] / "supabase" / "migrations"


def _migration_sql() -> str:
    matches = sorted(MIGRATIONS.glob("*_symptom_engine_foundation.sql"))
    assert len(matches) == 1, "Create exactly one symptom engine foundation migration via Supabase CLI"
    return matches[0].read_text(encoding="utf-8").lower()


def _all_symptom_migration_sql() -> str:
    return "\n".join(
        path.read_text(encoding="utf-8").lower()
        for path in sorted(MIGRATIONS.glob("*_symptom_*.sql"))
    )


def test_symptom_engine_migration_has_required_tables_and_rls():
    sql = _migration_sql()
    tables = (
        "symptom_check_sessions",
        "symptom_evidence",
        "clinical_concept_mappings",
        "symptom_provider_events",
    )
    for table in tables:
        assert f"create table public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql
        assert f"revoke all on table public.{table} from anon, authenticated" in sql


def test_browser_writes_are_not_granted():
    sql = _migration_sql()
    assert "grant insert" not in "\n".join(
        line for line in sql.splitlines() if "to authenticated" in line
    )
    assert "grant update" not in "\n".join(
        line for line in sql.splitlines() if "to authenticated" in line
    )
    assert "grant delete" not in "\n".join(
        line for line in sql.splitlines() if "to authenticated" in line
    )
    assert "grant select on table public.symptom_check_sessions to authenticated" in sql
    assert "grant select on table public.symptom_evidence to authenticated" in sql
    assert "grant select on table public.clinical_concept_mappings to authenticated" not in sql
    assert "grant select on table public.symptom_provider_events to authenticated" not in sql


def test_owner_policies_and_consistency_constraints_exist():
    sql = _migration_sql()
    assert 'create policy "users can read own symptom sessions"' in sql
    assert 'create policy "users can read own symptom evidence"' in sql
    assert "(select auth.uid()) = user_id" in sql
    assert "symptom_evidence_session_owner_fk" in sql
    assert "symptom_provider_events_session_owner_fk" in sql
    assert "symptom_check_sessions_one_active_user_idx" in sql


def test_provider_payloads_and_events_are_metadata_only_by_contract():
    sql = _migration_sql()
    all_sql = _all_symptom_migration_sql()
    assert "provider_payload jsonb" in sql
    assert "request_hash text" in sql
    assert "response_hash text" in sql
    assert "request_body" not in sql
    assert "response_body" not in sql
    assert "symptom_evidence_provider_payload_empty_check" in all_sql
    assert "check (provider_payload = '{}'::jsonb)" in all_sql


def test_every_user_owned_symptom_record_cascades_on_account_deletion():
    sql = _all_symptom_migration_sql()
    assert sql.count("user_id uuid not null references auth.users(id) on delete cascade") >= 4
    assert "symptom_evidence_session_owner_fk" in sql and "on delete cascade" in sql
    assert "symptom_provider_events_session_owner_fk" in sql
    assert "symptom_answer_submissions_session_owner_fk" in sql


def test_answer_reservation_is_atomic_and_backend_only():
    sql = _all_symptom_migration_sql()
    assert "create or replace function public.reserve_symptom_answer_submission" in sql
    assert "on conflict (session_id, idempotency_key_hash) do nothing" in sql
    assert "security invoker" in sql
    assert "set search_path = ''" in sql
    assert "from public, anon, authenticated" in sql
    assert "to service_role" in sql


def test_symptom_snapshot_safety_provenance_is_persisted():
    sql = _all_symptom_migration_sql()
    assert "internal_safety_level text" in sql
    assert "provider_safety_level text" in sql
