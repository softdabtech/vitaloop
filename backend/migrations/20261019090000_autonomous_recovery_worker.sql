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
declare
  finalizer_oid oid;
  service_role_oid oid;
  function_owner oid;
  function_definer boolean;
  function_config text[];
  function_oid oid := 'public.autonomous_recovery_schema_preflight()'::regprocedure;
begin
  -- The preflight is itself a SECURITY DEFINER boundary.  Check its complete
  -- catalog contract on every invocation so later ACL/owner/config drift fails
  -- closed before the worker is considered safe to run.
  select oid into finalizer_oid
  from pg_catalog.pg_roles
  where rolname = 'vitaloop_finalizer'
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit
    and not rolcreatedb and not rolcreaterole and not rolreplication;
  if finalizer_oid is null then
    raise exception 'autonomous_recovery_schema_not_ready';
  end if;

  select oid into service_role_oid
  from pg_catalog.pg_roles
  where rolname = 'service_role';
  if service_role_oid is null then
    raise exception 'autonomous_recovery_schema_not_ready';
  end if;

  if exists (
    with recursive memberships(oid) as (
      select membership.roleid
      from pg_catalog.pg_auth_members membership
      where membership.member = finalizer_oid
      union
      select membership.roleid
      from memberships inherited
      join pg_catalog.pg_auth_members membership on membership.member = inherited.oid
    )
    select 1 from memberships
  ) then
    raise exception 'autonomous_recovery_schema_not_ready';
  end if;

  select p.proowner, p.prosecdef, p.proconfig
    into function_owner, function_definer, function_config
  from pg_catalog.pg_proc p
  where p.oid = function_oid;
  if function_owner is distinct from finalizer_oid
     or function_definer is not true
     or function_config is distinct from array['search_path=pg_catalog, public']::text[] then
    raise exception 'autonomous_recovery_schema_not_ready';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where p.oid = function_oid
      and acl.privilege_type = 'EXECUTE'
      and (
        acl.grantee = 0
        or acl.grantee in (
          select oid from pg_catalog.pg_roles where rolname in ('anon', 'authenticated')
        )
        or acl.grantee not in (p.proowner, service_role_oid)
      )
  ) or not pg_catalog.has_function_privilege(service_role_oid, function_oid, 'EXECUTE')
       or not pg_catalog.has_function_privilege(finalizer_oid, function_oid, 'EXECUTE') then
    raise exception 'autonomous_recovery_schema_not_ready';
  end if;

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

-- Self-audit after the complete CREATE -> REVOKE -> OWNER -> GRANT handoff.
-- This makes a misapplied migration fail before it can advertise the worker as
-- ready; the callable preflight above repeats the same checks for later drift.
do $$
declare
  finalizer_oid oid;
  service_role_oid oid;
  function_owner oid;
  function_definer boolean;
  function_config text[];
  function_oid oid := 'public.autonomous_recovery_schema_preflight()'::regprocedure;
begin
  select oid into finalizer_oid
  from pg_catalog.pg_roles
  where rolname = 'vitaloop_finalizer'
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit
    and not rolcreatedb and not rolcreaterole and not rolreplication;
  select oid into service_role_oid
  from pg_catalog.pg_roles
  where rolname = 'service_role';

  if finalizer_oid is null or service_role_oid is null then
    raise exception 'autonomous_recovery_acl_audit_failed';
  end if;

  if exists (
    with recursive memberships(oid) as (
      select membership.roleid
      from pg_catalog.pg_auth_members membership
      where membership.member = finalizer_oid
      union
      select membership.roleid
      from memberships inherited
      join pg_catalog.pg_auth_members membership on membership.member = inherited.oid
    )
    select 1 from memberships
  ) then
    raise exception 'autonomous_recovery_acl_audit_failed';
  end if;

  select p.proowner, p.prosecdef, p.proconfig
    into function_owner, function_definer, function_config
  from pg_catalog.pg_proc p
  where p.oid = function_oid;
  if function_owner is distinct from finalizer_oid
     or function_definer is not true
     or function_config is distinct from array['search_path=pg_catalog, public']::text[] then
    raise exception 'autonomous_recovery_acl_audit_failed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where p.oid = function_oid
      and acl.privilege_type = 'EXECUTE'
      and (
        acl.grantee = 0
        or acl.grantee in (
          select oid from pg_catalog.pg_roles where rolname in ('anon', 'authenticated')
        )
        or acl.grantee not in (p.proowner, service_role_oid)
      )
  ) or not pg_catalog.has_function_privilege(service_role_oid, function_oid, 'EXECUTE')
       or not pg_catalog.has_function_privilege(finalizer_oid, function_oid, 'EXECUTE') then
    raise exception 'autonomous_recovery_acl_audit_failed';
  end if;
end $$;

notify pgrst, 'reload schema';
