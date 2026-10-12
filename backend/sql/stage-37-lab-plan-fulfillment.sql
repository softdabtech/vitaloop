ALTER TABLE public.lab_plan_items
  DROP CONSTRAINT IF EXISTS lab_plan_items_status_check;

ALTER TABLE public.lab_plan_items
  ADD CONSTRAINT lab_plan_items_status_check
  CHECK (status IN ('planned', 'fulfilled'));

ALTER TABLE public.lab_plan_items
  ADD COLUMN IF NOT EXISTS fulfilled_by_upload_id uuid
    REFERENCES public.lab_uploads(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS fulfilled_by_report_version_id uuid
    REFERENCES public.report_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;
