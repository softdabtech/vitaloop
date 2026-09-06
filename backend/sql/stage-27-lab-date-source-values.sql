-- VITALOOP Stage 27: expanded lab date source values.
-- Safe to run multiple times.

alter table public.lab_uploads
  drop constraint if exists lab_uploads_date_source_check;

alter table public.lab_uploads
  add constraint lab_uploads_date_source_check
  check (
    date_source is null
    or date_source in (
      'extracted_test_date',
      'extracted_collected_at',
      'extracted_order_date',
      'extracted_done_date',
      'extracted_reported_at',
      'user_provided',
      'missing'
    )
  );
