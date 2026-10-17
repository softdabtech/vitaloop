-- MANUAL operator script. Tests never run this.
-- Run once per disposable cluster as a superuser, then:
--   createdb vitaloop_test_finalize
--   psql -c "comment on database vitaloop_test_finalize is 'vitaloop-disposable-test-database'"
-- Cluster roles are shared across databases, so do NOT run on a shared/production cluster.
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role','vitaloop_finalizer'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;
-- A non-superuser test login must be granted these roles to SET ROLE into them.
