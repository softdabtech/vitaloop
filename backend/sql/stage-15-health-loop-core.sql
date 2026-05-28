-- Stage 15: health loop domain model baseline

CREATE TABLE IF NOT EXISTS public.health_concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_area TEXT,
  severity SMALLINT CHECK (severity BETWEEN 1 AND 10),
  duration TEXT,
  urgency_level TEXT DEFAULT 'routine'
    CHECK (urgency_level IN ('routine', 'timely_review', 'urgent')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'resolved', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_concerns_user_status
ON public.health_concerns(user_id, status);

ALTER TABLE public.health_concerns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'health_concerns'
      AND policyname = 'Health concerns: users see own'
  ) THEN
    CREATE POLICY "Health concerns: users see own"
    ON public.health_concerns
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.health_concern_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_id UUID NOT NULL REFERENCES public.health_concerns(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer_value SMALLINT,
  answer_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lab_plan_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_id UUID NOT NULL REFERENCES public.health_concerns(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.concern_upload_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_id UUID NOT NULL REFERENCES public.health_concerns(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES public.lab_uploads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (concern_id, upload_id)
);

CREATE TABLE IF NOT EXISTS public.symptom_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_id UUID NOT NULL REFERENCES public.health_concerns(id) ON DELETE CASCADE,
  status TEXT,
  symptom_severity SMALLINT CHECK (symptom_severity BETWEEN 1 AND 10),
  adherence TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
