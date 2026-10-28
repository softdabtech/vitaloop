alter table public.biomarkers
  add column if not exists canonical_name text,
  add column if not exists reference_source text,
  add column if not exists unevaluated_reason text;

notify pgrst, 'reload schema';