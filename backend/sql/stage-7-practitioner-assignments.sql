-- ============================================================
-- VITALOOP Stage 7: Practitioner <-> Client Assignments
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.practitioner_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  notes TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practitioner_assignments_practitioner_id
  ON public.practitioner_assignments(practitioner_id);

CREATE INDEX IF NOT EXISTS idx_practitioner_assignments_client_user_id
  ON public.practitioner_assignments(client_user_id);

CREATE INDEX IF NOT EXISTS idx_practitioner_assignments_organization_id
  ON public.practitioner_assignments(organization_id);

CREATE INDEX IF NOT EXISTS idx_practitioner_assignments_status
  ON public.practitioner_assignments(status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_practitioner_assignments_active_pair
  ON public.practitioner_assignments(practitioner_id, client_user_id)
  WHERE status IN ('pending', 'active');

CREATE OR REPLACE FUNCTION public.touch_practitioner_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_practitioner_assignments_updated_at ON public.practitioner_assignments;
CREATE TRIGGER trg_practitioner_assignments_updated_at
  BEFORE UPDATE ON public.practitioner_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_practitioner_assignments_updated_at();

CREATE OR REPLACE FUNCTION public.sync_practitioner_capacity_from_assignments()
RETURNS TRIGGER AS $$
DECLARE
  updated_count INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      UPDATE public.practitioners
      SET current_clients = current_clients + 1,
          updated_at = NOW()
      WHERE id = NEW.practitioner_id
        AND current_clients < max_clients;

      GET DIAGNOSTICS updated_count = ROW_COUNT;
      IF updated_count = 0 THEN
        RAISE EXCEPTION 'Practitioner % is at capacity', NEW.practitioner_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'active' AND NEW.status = 'active' THEN
      UPDATE public.practitioners
      SET current_clients = current_clients + 1,
          updated_at = NOW()
      WHERE id = NEW.practitioner_id
        AND current_clients < max_clients;

      GET DIAGNOSTICS updated_count = ROW_COUNT;
      IF updated_count = 0 THEN
        RAISE EXCEPTION 'Practitioner % is at capacity', NEW.practitioner_id;
      END IF;
    END IF;

    IF OLD.status = 'active' AND NEW.status IN ('completed', 'cancelled') THEN
      UPDATE public.practitioners
      SET current_clients = current_clients - 1,
          updated_at = NOW()
      WHERE id = NEW.practitioner_id
        AND current_clients > 0;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_practitioner_assignments_capacity ON public.practitioner_assignments;
CREATE TRIGGER trg_practitioner_assignments_capacity
  BEFORE INSERT OR UPDATE ON public.practitioner_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_practitioner_capacity_from_assignments();

ALTER TABLE public.practitioner_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.practitioner_assignments TO service_role;
GRANT SELECT ON TABLE public.practitioner_assignments TO authenticated;

NOTIFY pgrst, 'reload schema';
