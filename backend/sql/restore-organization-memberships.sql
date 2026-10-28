-- ============================================================
-- Restore Organization Membership Layer (Canonical + Compatibility)
-- ============================================================
-- Purpose:
-- 1) Create canonical table: public.organization_memberships
-- 2) Create backward-compatible view: public.organization_members
-- 3) Seed minimal test memberships for org-admin scope validation
-- 4) Reload PostgREST schema cache
--
-- Notes:
-- - This script is idempotent.
-- - It intentionally avoids hard FK to organizations because organizations table
--   is currently not available in PostgREST schema cache.
-- - user_id keeps FK to public.users.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1) Canonical table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'suspended', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_organization_memberships_org_user UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id
  ON public.organization_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_organization_memberships_org_id
  ON public.organization_memberships(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_memberships_status
  ON public.organization_memberships(status);

CREATE INDEX IF NOT EXISTS idx_organization_memberships_role
  ON public.organization_memberships(role);

CREATE OR REPLACE FUNCTION public.touch_organization_memberships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organization_memberships_updated_at ON public.organization_memberships;
CREATE TRIGGER trg_organization_memberships_updated_at
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_organization_memberships_updated_at();

-- Keep service_role flow simple and deterministic.
ALTER TABLE public.organization_memberships DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_memberships TO service_role;
GRANT SELECT ON TABLE public.organization_memberships TO authenticated;

-- ============================================================
-- 2) Backward-compatible view expected by backend
-- ============================================================
CREATE OR REPLACE VIEW public.organization_members AS
SELECT
  id,
  organization_id,
  user_id,
  role AS org_role,
  role,
  status,
  created_at,
  updated_at
FROM public.organization_memberships;

GRANT SELECT ON TABLE public.organization_members TO service_role;
GRANT SELECT ON TABLE public.organization_members TO authenticated;

-- ============================================================
-- 3) Seed minimal test data
-- ============================================================
-- Test users from live CRM RBAC checks:
-- org_admin user:     d8ca199b-2b32-414f-9b92-2c48d91f888a
-- practitioner user:  52ca39f9-ab8d-4619-b43c-537a79a9113c
-- Shared org id for scoped visibility test:
--                    8e4a0b52-0dc2-4f95-8ff4-0d6598c57ad1

INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
VALUES
  ('8e4a0b52-0dc2-4f95-8ff4-0d6598c57ad1', 'd8ca199b-2b32-414f-9b92-2c48d91f888a', 'org_admin', 'active'),
  ('8e4a0b52-0dc2-4f95-8ff4-0d6598c57ad1', '52ca39f9-ab8d-4619-b43c-537a79a9113c', 'practitioner', 'active')
ON CONFLICT (organization_id, user_id)
DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  updated_at = NOW();

-- ============================================================
-- 4) Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 5) Verification queries
-- ============================================================
-- View sample
-- SELECT * FROM public.organization_members LIMIT 20;

-- Org-admin memberships
-- SELECT *
-- FROM public.organization_members
-- WHERE user_id = 'd8ca199b-2b32-414f-9b92-2c48d91f888a'
-- ORDER BY created_at DESC;

-- Scoped chain validation
-- SELECT
--   om.organization_id,
--   om.user_id,
--   om.org_role,
--   om.status,
--   p.id AS practitioner_id,
--   p.user_id AS practitioner_user_id
-- FROM public.organization_members om
-- LEFT JOIN public.practitioners p ON p.user_id = om.user_id
-- WHERE om.organization_id IN (
--   SELECT organization_id
--   FROM public.organization_members
--   WHERE user_id = 'd8ca199b-2b32-414f-9b92-2c48d91f888a'
--     AND status = 'active'
-- )
-- ORDER BY om.organization_id, om.user_id;
