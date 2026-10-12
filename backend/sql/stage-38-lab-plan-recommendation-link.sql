ALTER TABLE public.lab_plan_items
  ADD COLUMN IF NOT EXISTS source_recommendation_id text;

CREATE INDEX IF NOT EXISTS idx_lab_plan_items_source_recommendation
  ON public.lab_plan_items (source_recommendation_id)
  WHERE source_recommendation_id IS NOT NULL;
