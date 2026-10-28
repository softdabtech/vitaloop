-- VITALOOP Stage 26: Lab upload date metadata for longitudinal progress
-- Safe to run multiple times.

alter table public.lab_uploads
  add column if not exists collected_at date,
  add column if not exists reported_at date,
  add column if not exists date_source text,
  add column if not exists date_confidence text,
  add column if not exists date_raw_text text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lab_uploads_date_source_check'
      and conrelid = 'public.lab_uploads'::regclass
  ) then
    alter table public.lab_uploads
      add constraint lab_uploads_date_source_check
      check (
        date_source is null
        or date_source in (
          'extracted_test_date',
          'extracted_collected_at',
          'extracted_reported_at',
          'user_provided',
          'missing'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lab_uploads_date_confidence_check'
      and conrelid = 'public.lab_uploads'::regclass
  ) then
    alter table public.lab_uploads
      add constraint lab_uploads_date_confidence_check
      check (
        date_confidence is null
        or date_confidence in ('high', 'medium', 'low')
      );
  end if;
end $$;

create index if not exists idx_lab_uploads_user_test_date
  on public.lab_uploads(user_id, test_date desc)
  where test_date is not null;

create index if not exists idx_lab_uploads_user_collected_at
  on public.lab_uploads(user_id, collected_at desc)
  where collected_at is not null;

create index if not exists idx_lab_uploads_user_reported_at
  on public.lab_uploads(user_id, reported_at desc)
  where reported_at is not null;
