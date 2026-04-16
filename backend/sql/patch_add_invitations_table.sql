-- ============================================================
-- VITALOOP — Patch: add missing invitations table
-- Safe to run on an existing database
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('org_owner', 'client_admin', 'manager', 'practitioner', 'support', 'member')),
  status TEXT DEFAULT 'sent'
    CHECK (status IN ('sent', 'accepted', 'expired', 'revoked')),
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  token TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON public.invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invitations: admins see org invitations" ON public.invitations;
CREATE POLICY "Invitations: admins see org invitations" ON public.invitations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('org_owner', 'client_admin')
    )
  );

-- Service role is used by backend; keep explicit grants for compatibility.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invitations TO service_role;
GRANT SELECT ON TABLE public.invitations TO authenticated;

-- Ensure PostgREST picks up schema updates immediately.
NOTIFY pgrst, 'reload schema';
