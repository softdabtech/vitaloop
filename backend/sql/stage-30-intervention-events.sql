-- ============================================================
-- VITALOOP Stage 30: Intervention Memory (P20)
-- ============================================================
--
-- Records what a user (or, later, a practitioner/protocol/import) did
-- between lab uploads — supplements started/stopped, nutrition/training/
-- sleep/stress changes, illness, medication, alcohol, weight change, or a
-- protocol action they acted on. P19's Personal Baseline velocity signals
-- and P21's future Outcome Attribution both need this context layer; this
-- migration only records events — it does NOT compute or claim causation.
--
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF
-- NOT EXISTS / DROP TRIGGER IF EXISTS + CREATE TRIGGER throughout, matching
-- this repo's existing stage-N migration convention, e.g. stage-29).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.intervention_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who recorded this event — "user" (self-reported, the only source the
  -- P20 v1 API writes) vs "practitioner" / "protocol" / "import" / "system",
  -- reserved for later stages that may write on the user's behalf.
  source TEXT NOT NULL DEFAULT 'user'
    CHECK (source IN ('user', 'practitioner', 'protocol', 'import', 'system')),

  event_type TEXT NOT NULL CHECK (event_type IN (
    'supplement', 'nutrition', 'training', 'sleep', 'stress', 'illness',
    'medication', 'alcohol', 'weight_change', 'protocol_action', 'other'
  )),

  label TEXT NOT NULL,
  description TEXT,

  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  -- True means "still doing this as of the last time the user told us" —
  -- independent of ended_at being null (a user who logs an end date should
  -- also flip this off; kept as two separate fields rather than deriving
  -- "ongoing" from ended_at being null, since a one-off event like
  -- "started feeling sick" may have no known end date yet without being
  -- an indefinitely "ongoing" intervention).
  ongoing BOOLEAN NOT NULL DEFAULT FALSE,

  adherence TEXT CHECK (adherence IS NULL OR adherence IN ('unknown', 'low', 'partial', 'high')),
  intensity TEXT CHECK (intensity IS NULL OR intensity IN ('low', 'moderate', 'high')),
  dose TEXT,
  frequency TEXT,

  -- Not a foreign key to a "protocols" or "recommendations" table: this
  -- repo's protocol action ids are not yet stable/persisted entities (see
  -- app/services/lab_analysis_pipeline.py's protocol output, generated
  -- fresh per report) — recorded as free-text so a future stage can add
  -- real referential integrity once that stabilizes, documented here as a
  -- known P20b follow-up rather than forced now.
  related_protocol_id UUID,
  related_recommendation_id TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intervention_events_user_started
  ON public.intervention_events(user_id, started_at);

CREATE INDEX IF NOT EXISTS idx_intervention_events_user_type
  ON public.intervention_events(user_id, event_type);

CREATE INDEX IF NOT EXISTS idx_intervention_events_related_protocol_id
  ON public.intervention_events(related_protocol_id)
  WHERE related_protocol_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intervention_events_metadata_gin
  ON public.intervention_events USING GIN (metadata);

CREATE OR REPLACE FUNCTION public.touch_intervention_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_intervention_events_updated_at ON public.intervention_events;
CREATE TRIGGER trg_intervention_events_updated_at
  BEFORE UPDATE ON public.intervention_events
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_intervention_events_updated_at();

-- RLS: service_role (used by the FastAPI backend via the service key) is
-- exempt from RLS entirely, matching every other user-data table in this
-- repo (recurring_complaints, user_locations, etc. — the backend enforces
-- the user_id filter itself on every query, see
-- app/services/intervention_memory.py / the /interventions router).
-- Enabled with no policies so a future direct-client-access path fails
-- closed by default instead of being silently world-readable.
ALTER TABLE public.intervention_events ENABLE ROW LEVEL SECURITY;
