-- ============================================================
-- VITALOOP Stage 29: Per-Organization Rule Pack Enablement (P11 v1 follow-up)
-- ============================================================
--
-- rule_packs.py (P11 v1, 2026-09-14) already groups knowledge_rules by
-- their existing `source` column into named "packs" for VISIBILITY only —
-- every active rule from every pack applies globally today, unchanged.
-- This migration adds the persisted state needed for the next increment:
-- letting an organization turn a specific expert/clinic pack on or off,
-- without a schema change to knowledge_rules itself (pack_id here is the
-- same free-text value as knowledge_rules.source — no new FK to a
-- nonexistent "rule_packs" table, since packs are a computed grouping,
-- not a stored entity).
--
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF
-- NOT EXISTS / DROP TRIGGER IF EXISTS + CREATE TRIGGER throughout, matching
-- this repo's existing stage-N migration convention, e.g. stage-7).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.organization_rule_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Free-text, matching knowledge_rules.source verbatim (e.g.
  -- "dr_smith_thyroid_pack") — NOT a foreign key, because packs are a
  -- computed grouping over knowledge_rules.source (see rule_packs.py),
  -- not a separately stored entity with its own primary key.
  pack_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  enabled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One row per (org, pack) — enabling/disabling again should update the
  -- existing row, not accumulate history rows (unlike knowledge_rules'
  -- own append-only draft-copy versioning, this is simple current-state
  -- toggle, not something that needs its own audit trail beyond
  -- enabled_by/enabled_at).
  UNIQUE (organization_id, pack_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_rule_packs_organization_id
  ON public.organization_rule_packs(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_rule_packs_pack_id
  ON public.organization_rule_packs(pack_id);

-- The VITALOOP core pack (knowledge_rules rows with no `source`, grouped
-- under "core_vitaloop" by rule_packs.py) is never gated by this table —
-- application code should treat the absence of a "core_vitaloop" row, or
-- a missing row for any pack, as "enabled" (opt-out, not opt-in), so an
-- org that has never touched pack settings keeps today's behavior
-- (every active rule applies) rather than silently losing coverage the
-- moment this table exists. Enforced in application code
-- (rule_packs.py / a future org-settings endpoint), not here.

CREATE OR REPLACE FUNCTION public.touch_organization_rule_packs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organization_rule_packs_updated_at ON public.organization_rule_packs;
CREATE TRIGGER trg_organization_rule_packs_updated_at
  BEFORE UPDATE ON public.organization_rule_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_organization_rule_packs_updated_at();

-- RLS: service_role (used by the FastAPI backend via the service key) is
-- exempt from RLS entirely, matching every other CRM table in this repo
-- (organizations, practitioner_assignments, etc. — the backend is the only
-- writer/reader today, there is no direct client-side Supabase access to
-- this table). Enabled with no policies so a future direct-client-access
-- path fails closed by default instead of being silently world-readable.
ALTER TABLE public.organization_rule_packs ENABLE ROW LEVEL SECURITY;
