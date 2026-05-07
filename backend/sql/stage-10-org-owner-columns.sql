-- ============================================================
-- VITALOOP Stage 10: Add owner_id / owner_name to organizations
-- ============================================================
-- The organizations table was created without owner_id / owner_name
-- columns, so the CRM Owner column is blank and RLS owner policies
-- were never applied.  This migration adds those columns and seeds
-- existing rows with the super_admin user.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Add columns (idempotent)
-- ------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

-- Index for fast owner lookups
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);

-- ------------------------------------------------------------
-- 2) Back-fill existing rows: assign to the first super_admin found
-- ------------------------------------------------------------
DO $$
DECLARE
  sa_id   UUID;
  sa_email TEXT;
BEGIN
  SELECT u.id, u.email
    INTO sa_id, sa_email
    FROM public.users u
   WHERE u.global_role = 'super_admin'
   ORDER BY u.created_at
   LIMIT 1;

  IF sa_id IS NOT NULL THEN
    UPDATE public.organizations
       SET owner_id   = sa_id,
           owner_name = COALESCE(owner_name, sa_email)
     WHERE owner_id IS NULL;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 3) RLS owner policy (now that the column exists)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'organizations'
       AND policyname = 'Organizations: owners see all'
  ) THEN
    EXECUTE 'CREATE POLICY "Organizations: owners see all" ON public.organizations
             FOR SELECT USING (auth.uid() = owner_id)';
  END IF;
END
$$;

COMMIT;
