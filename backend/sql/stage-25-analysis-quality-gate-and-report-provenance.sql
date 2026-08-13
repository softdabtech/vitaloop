begin;

create table if not exists public.biomarker_extraction_candidates (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null,
  user_id uuid not null,
  source text not null default 'ai',
  raw_name text,
  raw_value text,
  raw_unit text,
  raw_reference_range text,
  parsed_value double precision,
  confidence_score double precision,
  confidence_reasons jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  source_page integer,
  source_row text,
  corrections jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.biomarker_extraction_candidates
  add column if not exists confidence_label text,
  add column if not exists status text default 'pending',
  add column if not exists corrections jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_biomarker_extraction_candidates_upload_user
  on public.biomarker_extraction_candidates(upload_id, user_id);

create index if not exists idx_biomarker_extraction_candidates_status
  on public.biomarker_extraction_candidates(status);

alter table public.biomarker_extraction_candidates enable row level security;

drop policy if exists "Users can read own biomarker extraction candidates" on public.biomarker_extraction_candidates;
create policy "Users can read own biomarker extraction candidates"
  on public.biomarker_extraction_candidates
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own biomarker extraction candidates" on public.biomarker_extraction_candidates;
create policy "Users can update own biomarker extraction candidates"
  on public.biomarker_extraction_candidates
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.report_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  upload_id uuid not null,
  version text not null,
  locale text not null default 'en',
  input_snapshot jsonb not null default '{}'::jsonb,
  knowledge_report jsonb not null default '{}'::jsonb,
  protocol jsonb not null default '{}'::jsonb,
  safety_result jsonb not null default '{}'::jsonb,
  explainability jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

alter table public.report_versions
  add column if not exists input_snapshot jsonb default '{}'::jsonb,
  add column if not exists knowledge_report jsonb default '{}'::jsonb,
  add column if not exists protocol jsonb default '{}'::jsonb,
  add column if not exists safety_result jsonb default '{}'::jsonb,
  add column if not exists explainability jsonb default '{}'::jsonb,
  add column if not exists status text default 'completed';

create index if not exists idx_report_versions_upload_user_locale_created
  on public.report_versions(upload_id, user_id, locale, created_at desc);

create index if not exists idx_report_versions_user_created
  on public.report_versions(user_id, created_at desc);

alter table public.report_versions enable row level security;

drop policy if exists "Users can read own report versions" on public.report_versions;
create policy "Users can read own report versions"
  on public.report_versions
  for select
  using (auth.uid() = user_id);

create table if not exists public.safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  upload_id uuid,
  report_version_id uuid,
  rule_key text,
  severity text,
  action text,
  input_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.safety_events
  add column if not exists rule_key text,
  add column if not exists severity text,
  add column if not exists action text,
  add column if not exists input_snapshot jsonb default '{}'::jsonb;

create index if not exists idx_safety_events_user_created
  on public.safety_events(user_id, created_at desc);

create index if not exists idx_safety_events_upload
  on public.safety_events(upload_id);

alter table public.safety_events enable row level security;

drop policy if exists "Users can read own safety events" on public.safety_events;
create policy "Users can read own safety events"
  on public.safety_events
  for select
  using (auth.uid() = user_id);

commit;
