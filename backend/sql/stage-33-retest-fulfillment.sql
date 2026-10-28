-- VITALOOP Stage 33: Retest fulfillment linkage
-- Safe to run multiple times. Existing obligations remain pending; this
-- migration does not backfill or mutate historical fulfillment state.

ALTER TABLE public.intervention_events
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'fulfilled')),
  ADD COLUMN IF NOT EXISTS fulfilled_by_upload_id UUID
    REFERENCES public.lab_uploads(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS fulfilled_by_report_version_id UUID
    REFERENCES public.report_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_intervention_events_fulfillment_status
  ON public.intervention_events(user_id, fulfillment_status)
  WHERE action_type = 'retest';

CREATE OR REPLACE FUNCTION public.prevent_fulfilled_retest_reassignment()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.fulfillment_status = 'fulfilled'
    AND (
      NEW.fulfillment_status IS DISTINCT FROM OLD.fulfillment_status
      OR NEW.fulfilled_by_upload_id IS DISTINCT FROM OLD.fulfilled_by_upload_id
      OR NEW.fulfilled_by_report_version_id IS DISTINCT FROM OLD.fulfilled_by_report_version_id
      OR NEW.fulfilled_at IS DISTINCT FROM OLD.fulfilled_at
    ) THEN
    RAISE EXCEPTION 'Fulfilled retest obligations are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_fulfilled_retest_reassignment ON public.intervention_events;
CREATE TRIGGER trg_prevent_fulfilled_retest_reassignment
  BEFORE UPDATE ON public.intervention_events
  FOR EACH ROW
  WHEN (OLD.action_type = 'retest' OR NEW.action_type = 'retest')
  EXECUTE FUNCTION public.prevent_fulfilled_retest_reassignment();