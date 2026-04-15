-- ============================================================
-- VITALOOP Stage 8: Adaptive Questionnaire Storage
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.questionnaire_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  model_version TEXT NOT NULL DEFAULT 'v1',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_question_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_sessions_user_id
  ON public.questionnaire_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_questionnaire_sessions_status
  ON public.questionnaire_sessions(status);

CREATE TABLE IF NOT EXISTS public.questionnaire_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.questionnaire_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_order INT NOT NULL,
  answer_value INT NOT NULL CHECK (answer_value BETWEEN 1 AND 10),
  answer_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaire_answers_session_question
  ON public.questionnaire_answers(session_id, question_id);

CREATE INDEX IF NOT EXISTS idx_questionnaire_answers_session_order
  ON public.questionnaire_answers(session_id, question_order);

ALTER TABLE public.questionnaire_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_answers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.questionnaire_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.questionnaire_answers TO service_role;

GRANT SELECT ON TABLE public.questionnaire_sessions TO authenticated;
GRANT SELECT ON TABLE public.questionnaire_answers TO authenticated;

NOTIFY pgrst, 'reload schema';
