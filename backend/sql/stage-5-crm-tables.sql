-- ============================================================
-- VITALOOP Stage 5: CRM Core Tables Migration
-- Execute in Supabase SQL Editor after existing migrations
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PRACTITIONERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.practitioners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  specialization TEXT NOT NULL DEFAULT 'general'
    CHECK (specialization IN ('nutrition', 'biohacking', 'performance', 'general')),
  bio TEXT,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'onboarding')),
  availability TEXT DEFAULT 'available'
    CHECK (availability IN ('available', 'booked', 'unavailable')),
  max_clients SMALLINT DEFAULT 20,
  current_clients SMALLINT DEFAULT 0,
  hourly_rate_cents INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practitioners_user_id ON public.practitioners(user_id);
CREATE INDEX IF NOT EXISTS idx_practitioners_status ON public.practitioners(status);

-- ============================================================
-- 2. PROGRAMS (Templates)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'wellness'
    CHECK (category IN ('metabolic-optimization', 'longevity', 'athletic-performance', 'wellness', 'custom')),
  duration_days INT CHECK (duration_days > 0),
  template_protocol JSONB,
  biomarker_targets JSONB,
  checkpoint_intervals INT[] DEFAULT '{7,14,30,60,90}',
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'deprecated', 'archived')),
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programs_category ON public.programs(category);
CREATE INDEX IF NOT EXISTS idx_programs_status ON public.programs(status);

-- ============================================================
-- 3. SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  plan_name TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_name IN ('free', 'core', 'personal')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'past_due')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_name ON public.subscriptions(plan_name);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
-- ============================================================
-- 4. CLIENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  assigned_practitioner_id UUID REFERENCES public.practitioners(id) ON DELETE SET NULL,
  onboarding_status TEXT DEFAULT 'started'
    CHECK (onboarding_status IN ('started', 'questionnaire_pending', 'program_assigned', 'active', 'paused', 'completed')),
  active_program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  last_upload_at TIMESTAMPTZ,
  last_check_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_practitioner_id ON public.clients(assigned_practitioner_id);
CREATE INDEX IF NOT EXISTS idx_clients_active_program_id ON public.clients(active_program_id);
CREATE INDEX IF NOT EXISTS idx_clients_subscription_id ON public.clients(subscription_id);
CREATE INDEX IF NOT EXISTS idx_clients_onboarding_status ON public.clients(onboarding_status);

-- ============================================================
-- 5. CLIENT PROGRAMS (Assignments)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE RESTRICT NOT NULL,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('onboarding', 'active', 'paused', 'completed', 'dropped')),
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  started_date TIMESTAMPTZ,
  projected_end_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  checkpoint_progress JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_programs_client_id ON public.client_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_program_id ON public.client_programs(program_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_status ON public.client_programs(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_programs_active ON public.client_programs(client_id)
  WHERE status IN ('onboarding', 'active', 'paused');

-- ============================================================
-- 6. QUESTIONNAIRES (Templates)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.questionnaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_type TEXT DEFAULT 'onboarding'
    CHECK (template_type IN ('onboarding', 'progress-check', 'program-specific', 'symptom-tracker')),
  questions JSONB NOT NULL,
  scoring_logic JSONB,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'draft', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questionnaires_template_type ON public.questionnaires(template_type);
CREATE INDEX IF NOT EXISTS idx_questionnaires_program_id ON public.questionnaires(program_id);

-- ============================================================
-- 7. CLIENT QUESTIONNAIRE RESULTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_questionnaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  questionnaire_id UUID REFERENCES public.questionnaires(id) ON DELETE RESTRICT NOT NULL,
  responses JSONB NOT NULL,
  score NUMERIC(5,2),
  result_notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_questionnaires_client_id ON public.client_questionnaires(client_id);
CREATE INDEX IF NOT EXISTS idx_client_questionnaires_questionnaire_id ON public.client_questionnaires(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_client_questionnaires_completed_at ON public.client_questionnaires(completed_at DESC);

-- ============================================================
-- 8. INTERVENTIONS (Practitioner Protocol Adjustments)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.interventions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_program_id UUID REFERENCES public.client_programs(id) ON DELETE CASCADE NOT NULL,
  practitioner_id UUID REFERENCES public.practitioners(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  description TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interventions_client_program_id ON public.interventions(client_program_id);
CREATE INDEX IF NOT EXISTS idx_interventions_practitioner_id ON public.interventions(practitioner_id);

-- ============================================================
-- 9. AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL DEFAULT 'create'
    CHECK (action IN ('create', 'read', 'update', 'delete', 'assign', 'reassign')),
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('client', 'practitioner', 'program', 'subscription', 'questionnaire', 'client_program', 'intervention')),
  entity_id UUID NOT NULL,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE IF EXISTS public.practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES (ROW LEVEL SECURITY)
-- ============================================================

-- Clients: users see own, practitioners see assigned, super_admin see all
DROP POLICY IF EXISTS "Clients: users see own" ON public.clients;
CREATE POLICY "Clients: users see own"
  ON public.clients FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clients: practitioners see assigned" ON public.clients;
CREATE POLICY "Clients: practitioners see assigned"
  ON public.clients FOR SELECT
  USING (
    assigned_practitioner_id = (
      SELECT id FROM public.practitioners WHERE user_id = auth.uid()
    )
  );

-- Practitioners: users see own, super_admin see all
DROP POLICY IF EXISTS "Practitioners: users see own" ON public.practitioners;
CREATE POLICY "Practitioners: users see own"
  ON public.practitioners FOR SELECT
  USING (auth.uid() = user_id);

-- Subscriptions: users see own
DROP POLICY IF EXISTS "Subscriptions: users see own" ON public.subscriptions;
CREATE POLICY "Subscriptions: users see own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Questionnaires: authenticated users can read
DROP POLICY IF EXISTS "Questionnaires: authenticated read" ON public.questionnaires;
CREATE POLICY "Questionnaires: authenticated read"
  ON public.questionnaires FOR SELECT
  USING (TRUE);

-- Client questionnaire results: users see own, practitioners see assigned clients
DROP POLICY IF EXISTS "Client questionnaires: users see own responses" ON public.client_questionnaires;
CREATE POLICY "Client questionnaires: users see own responses"
  ON public.client_questionnaires FOR SELECT
  USING (
    client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_questionnaires.client_id
      AND c.assigned_practitioner_id = (SELECT id FROM public.practitioners WHERE user_id = auth.uid())
    )
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-create client profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_client()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if client already exists (might be created by API)
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = NEW.id) THEN
    INSERT INTO public.clients (user_id, onboarding_status)
    VALUES (NEW.id, 'started');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_create_client ON auth.users;
CREATE TRIGGER on_auth_user_created_create_client
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client();

-- Auto-create free subscription on user signup
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if subscription already exists
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = NEW.id AND status = 'active') THEN
    INSERT INTO public.subscriptions (user_id, plan_name, status)
    VALUES (NEW.id, 'free', 'active');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_create_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_create_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_subscription();

-- ============================================================
-- Migration Complete
-- ============================================================
-- Tables created and RLS enabled.
-- Policies provide multi-tenant access control.
-- All endpoints in backend/app/routers/crm_stage5.py ready to use.
