-- ============================================================
-- VITALOOP Stage 11: Health Failures Log
-- Stores backend operational failures for diagnostics/alerting
-- ============================================================

CREATE TABLE IF NOT EXISTS public.health_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_failures_created_at
  ON public.health_failures(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_failures_service
  ON public.health_failures(service_name);

ALTER TABLE public.health_failures ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.health_failures TO service_role;

NOTIFY pgrst, 'reload schema';
