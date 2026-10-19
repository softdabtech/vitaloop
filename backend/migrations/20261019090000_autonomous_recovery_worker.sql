-- C4.1B-03: bounded global discovery for the autonomous frozen-ledger worker.
--
-- Apply only after 20261016120000_atomic_lab_analysis_finalization.sql through
-- the same controlled role-handoff procedure. This migration is additive: it
-- neither changes report versions nor work payloads, and grants no new table
-- access. The worker uses the existing service_role ledger policy and RPCs.

-- The C4.1B-02 index begins with user_id and only supports the request fast
-- path. These partial indexes make the server-owned global worker bounded
-- without scanning completed history or active leases.
create index if not exists idx_analysis_followup_work_global_retryable
  on public.analysis_followup_work (status, created_at, report_version_id)
  where status in ('pending', 'retryable');

create index if not exists idx_analysis_followup_work_global_expired_lease
  on public.analysis_followup_work (lease_expires_at, created_at, report_version_id)
  where status = 'processing';

-- This RPC exposes only structural readiness, never ledger rows or patient
-- data. Explicit EXECUTE ACLs ensure it is callable only by service_role.
create or replace function public.autonomous_recovery_schema_preflight()
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_index i on i.indexrelid = c.oid
    where c.relname = 'idx_analysis_followup_work_global_retryable'
      and i.indisvalid and i.indisready
  ) or not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_index i on i.indexrelid = c.oid
    where c.relname = 'idx_analysis_followup_work_global_expired_lease'
      and i.indisvalid and i.indisready
  ) then
    raise exception 'autonomous_recovery_schema_not_ready' using errcode = 'VL503';
  end if;

  return pg_catalog.jsonb_build_object(
    'schema_ready', true,
    'migration_contract', '20261019090000_autonomous_recovery_worker'
  );
exception when others then
  raise exception 'autonomous_recovery_schema_not_ready' using errcode = 'VL503';
end;
$$;

revoke all on function public.autonomous_recovery_schema_preflight()
  from public, anon, authenticated;
alter function public.autonomous_recovery_schema_preflight() owner to vitaloop_finalizer;
grant execute on function public.autonomous_recovery_schema_preflight() to service_role;
notify pgrst, 'reload schema';
