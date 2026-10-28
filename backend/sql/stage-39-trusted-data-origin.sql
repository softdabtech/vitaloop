-- VITALOOP Stage 39: trusted upload data origin
--
-- Existing rows are intentionally preserved as legacy_unclassified. They are
-- not silently reclassified as clinical or non-clinical; explicit non-clinical
-- origins are required for isolation from current patient context.

ALTER TABLE public.lab_uploads
  ADD COLUMN IF NOT EXISTS data_origin TEXT NOT NULL DEFAULT 'legacy_unclassified'
  CHECK (data_origin IN (
    'clinical',
    'synthetic',
    'qa',
    'smoke',
    'validation',
    'legacy_unclassified'
  ));

CREATE INDEX IF NOT EXISTS idx_lab_uploads_user_origin
  ON public.lab_uploads(user_id, data_origin);
