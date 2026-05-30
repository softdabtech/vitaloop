-- Stage 17b: RLS review checklist for partner tables.
-- This script is intentionally non-destructive and documents next hardening steps.

-- 1) Confirm all partner tables have RLS enabled.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'partner_%'
order by tablename;

-- 2) Inspect active policies.
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename like 'partner_%'
order by tablename, policyname;

-- 3) Future production task:
-- Replace deny-all anon/authenticated policies with tenant-scoped claims-based policies
-- if direct client access is required.
