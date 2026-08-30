-- ============================================================
-- VITALOOP Stage 9: Supabase Security Advisor fixes
-- ============================================================
-- Fixes:
-- 1) security_definer_view: public.organization_members
-- 2) rls_disabled_in_public: public.organizations,
--    public.organization_memberships
-- 3) function_search_path_mutable warnings for trigger/helper functions

BEGIN;

-- ------------------------------------------------------------
-- 1) View hardening: enforce SECURITY INVOKER for organization_members
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'organization_members'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.organization_members SET (security_invoker = true)';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 2) RLS enablement for public-facing tables
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- organizations RLS policies (idempotent).
DO $$
DECLARE
  owner_col TEXT;
  members_rel TEXT;
  members_table_name TEXT;
  members_status_predicate TEXT := '';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
  ) THEN
    -- Resolve owner column name across schema variants.
    SELECT c.column_name
    INTO owner_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'organizations'
      AND c.column_name IN ('owner_id', 'owner_user_id', 'created_by_user_id', 'created_by', 'user_id')
    ORDER BY CASE c.column_name
      WHEN 'owner_id' THEN 1
      WHEN 'owner_user_id' THEN 2
      WHEN 'created_by_user_id' THEN 3
      WHEN 'created_by' THEN 4
      WHEN 'user_id' THEN 5
      ELSE 99
    END
    LIMIT 1;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'organizations'
        AND policyname = 'Organizations: owners see all'
    ) AND owner_col IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY "Organizations: owners see all" ON public.organizations FOR SELECT USING (auth.uid() = %I)',
        owner_col
      );
    END IF;

    -- Resolve membership relation to use in policy expression.
    IF to_regclass('public.organization_memberships') IS NOT NULL THEN
      members_rel := 'public.organization_memberships';
      members_table_name := 'organization_memberships';
    ELSIF to_regclass('public.organization_members') IS NOT NULL THEN
      members_rel := 'public.organization_members';
      members_table_name := 'organization_members';
    END IF;

    IF members_rel IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = members_table_name
          AND column_name = 'organization_id'
      )
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = members_table_name
          AND column_name = 'user_id'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'organizations'
          AND policyname = 'Organizations: members see their org'
      ) THEN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = members_table_name
          AND column_name = 'status'
      ) THEN
        members_status_predicate := ' AND COALESCE(status::text, ''active'') = ''active''';
      END IF;

      EXECUTE format(
        'CREATE POLICY "Organizations: members see their org" ON public.organizations FOR SELECT USING (id IN (SELECT organization_id FROM %s WHERE user_id = auth.uid()%s))',
        members_rel,
        members_status_predicate
      );
    END IF;
  END IF;
END
$$;

-- organization_memberships RLS policies (idempotent, non-recursive).
-- Drop and recreate to eliminate legacy recursive policy bodies.
DROP POLICY IF EXISTS "OrgMemberships: admins see org members" ON public.organization_memberships;
DROP POLICY IF EXISTS "OrgMemberships: see own membership" ON public.organization_memberships;

-- Create the helper function (no nested quotes).
CREATE OR REPLACE FUNCTION public.is_org_membership_admin(target_org_id UUID, actor_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = target_org_id
      AND om.user_id = actor_user_id
      AND COALESCE(om.status::text, 'active') = 'active'
      AND om.role IN ('org_owner', 'client_admin', 'manager')
  );
$func$;

-- Grant execute permissions on the helper function.
REVOKE ALL ON FUNCTION public.is_org_membership_admin(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_membership_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_membership_admin(UUID, UUID) TO service_role;

-- Create policies using the helper function.
CREATE POLICY "OrgMemberships: see own membership"
ON public.organization_memberships
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "OrgMemberships: admins see org members"
ON public.organization_memberships
FOR SELECT
USING (public.is_org_membership_admin(organization_id, auth.uid()));

-- ------------------------------------------------------------
-- 3) search_path hardening for mutable functions
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user_profile()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user_profile() SET search_path = public';
  END IF;

  IF to_regprocedure('public.handle_new_client()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_client() SET search_path = public';
  END IF;

  IF to_regprocedure('public.handle_new_subscription()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_subscription() SET search_path = public';
  END IF;

  IF to_regprocedure('public.touch_organization_memberships_updated_at()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.touch_organization_memberships_updated_at() SET search_path = public';
  END IF;

  IF to_regprocedure('public.touch_practitioner_assignments_updated_at()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.touch_practitioner_assignments_updated_at() SET search_path = public';
  END IF;

  IF to_regprocedure('public.sync_practitioner_capacity_from_assignments()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.sync_practitioner_capacity_from_assignments() SET search_path = public';
  END IF;
END
$$;

COMMIT;
