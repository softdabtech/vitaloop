-- ============================================================
-- VITALOOP Stage 10: Questionnaire Engine v2
-- Adds scoring, LLM summary, and adaptive follow-up support
-- Run after stage-8-questionnaire.sql
-- ============================================================

ALTER TABLE public.questionnaire_sessions
  ADD COLUMN IF NOT EXISTS completion_score    NUMERIC,
  ADD COLUMN IF NOT EXISTS dimension_scores    JSONB,
  ADD COLUMN IF NOT EXISTS llm_summary         TEXT,
  ADD COLUMN IF NOT EXISTS pending_followups   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS session_metadata    JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.questionnaire_sessions.completion_score  IS 'Overall health score 0–100 calculated at session completion';
COMMENT ON COLUMN public.questionnaire_sessions.dimension_scores  IS 'Per-dimension scores JSONB: {"energy": 70, "sleep": 40, ...}';
COMMENT ON COLUMN public.questionnaire_sessions.llm_summary       IS 'LLM-generated personalized health summary text';
COMMENT ON COLUMN public.questionnaire_sessions.pending_followups IS 'Queue of LLM-generated follow-up question objects not yet answered';
COMMENT ON COLUMN public.questionnaire_sessions.session_metadata  IS 'Free-form session metadata (model params, flags, etc.)';

NOTIFY pgrst, 'reload schema';
