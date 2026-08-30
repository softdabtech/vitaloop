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

create table if not exists public.analysis_quality_gates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  upload_id uuid not null,
  decision text not null,
  label text,
  score double precision,
  requires_confirmation boolean not null default false,
  components jsonb not null default '{}'::jsonb,
  candidate_summary jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  source jsonb not null default '{}'::jsonb,
  gate_version text,
  status text not null default 'recorded',
  created_at timestamptz not null default now()
);

create index if not exists idx_analysis_quality_gates_upload_user_created
  on public.analysis_quality_gates(upload_id, user_id, created_at desc);

create index if not exists idx_analysis_quality_gates_user_created
  on public.analysis_quality_gates(user_id, created_at desc);

create index if not exists idx_analysis_quality_gates_decision
  on public.analysis_quality_gates(decision);

alter table public.analysis_quality_gates enable row level security;

drop policy if exists "Users can read own analysis quality gates" on public.analysis_quality_gates;
create policy "Users can read own analysis quality gates"
  on public.analysis_quality_gates
  for select
  using (auth.uid() = user_id);

create table if not exists public.clinical_data_integrity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  upload_id uuid not null,
  status text not null,
  integrity_version text,
  summary jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  profile jsonb not null default '{}'::jsonb,
  markers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_data_integrity_events_upload_user_created
  on public.clinical_data_integrity_events(upload_id, user_id, created_at desc);

create index if not exists idx_clinical_data_integrity_events_user_created
  on public.clinical_data_integrity_events(user_id, created_at desc);

create index if not exists idx_clinical_data_integrity_events_status
  on public.clinical_data_integrity_events(status);

alter table public.clinical_data_integrity_events enable row level security;

drop policy if exists "Users can read own clinical data integrity events" on public.clinical_data_integrity_events;
create policy "Users can read own clinical data integrity events"
  on public.clinical_data_integrity_events
  for select
  using (auth.uid() = user_id);

create table if not exists public.evidence_gaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  upload_id uuid not null,
  evidence_gaps_version text,
  gaps jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  status text not null default 'recorded',
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_gaps_upload_user_created
  on public.evidence_gaps(upload_id, user_id, created_at desc);

create index if not exists idx_evidence_gaps_user_created
  on public.evidence_gaps(user_id, created_at desc);

alter table public.evidence_gaps enable row level security;

drop policy if exists "Users can read own evidence gaps" on public.evidence_gaps;
create policy "Users can read own evidence gaps"
  on public.evidence_gaps
  for select
  using (auth.uid() = user_id);

create table if not exists public.health_state_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  upload_id uuid not null,
  health_state_version text,
  domain_registry_version text,
  states jsonb not null default '[]'::jsonb,
  top_priorities jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  status text not null default 'recorded',
  created_at timestamptz not null default now()
);

create index if not exists idx_health_state_versions_upload_user_created
  on public.health_state_versions(upload_id, user_id, created_at desc);

create index if not exists idx_health_state_versions_user_created
  on public.health_state_versions(user_id, created_at desc);

alter table public.health_state_versions enable row level security;

drop policy if exists "Users can read own health state versions" on public.health_state_versions;
create policy "Users can read own health state versions"
  on public.health_state_versions
  for select
  using (auth.uid() = user_id);

commit;
