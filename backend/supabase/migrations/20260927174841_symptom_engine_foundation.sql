-- VITALOOP structured symptom engine foundation.
-- Local migration only. Apply after clinical/API review.

create extension if not exists "pgcrypto";

create table public.symptom_check_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in (
    'active', 'completed', 'skipped', 'unsupported', 'abandoned', 'provider_error'
  )),
  provider text not null default 'infermedica_engine',
  interview_id uuid not null default gen_random_uuid() unique,
  locale text not null check (locale in ('en', 'uk')),
  provider_model text not null,
  provider_model_version text,
  questionnaire_version text not null,
  current_stage smallint not null default 1 check (current_stage between 1 and 3),
  overall_wellbeing text check (overall_wellbeing in ('good', 'mostly_good', 'reduced', 'poor')),
  primary_concept_id text,
  primary_provider_concept_id text,
  duration_bucket text check (duration_bucket in (
    'today', 'days_2_7', 'weeks_1_4', 'months_1_3', 'months_3_plus', 'intermittent', 'unknown'
  )),
  last_question jsonb,
  last_question_sequence integer not null default 0 check (last_question_sequence >= 0),
  should_stop boolean not null default false,
  provider_triage_level text check (provider_triage_level in (
    'emergency_ambulance', 'emergency', 'consultation_24', 'consultation', 'self_care'
  )),
  provider_triage_root_cause text,
  final_safety_level text check (final_safety_level in (
    'emergency', 'urgent_24h', 'clinician_review', 'routine', 'insufficient_data'
  )),
  condition_candidates jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint symptom_check_sessions_id_user_unique unique (id, user_id),
  constraint symptom_check_sessions_completion_time_check check (
    (status = 'active' and completed_at is null)
    or status <> 'active'
  )
);

create unique index symptom_check_sessions_one_active_user_idx
  on public.symptom_check_sessions(user_id)
  where status = 'active';

create index symptom_check_sessions_user_created_idx
  on public.symptom_check_sessions(user_id, created_at desc);

create index symptom_check_sessions_status_updated_idx
  on public.symptom_check_sessions(status, updated_at);

create table public.symptom_evidence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  vitaloop_concept_id text not null,
  provider_concept_id text,
  concept_type text not null check (concept_type in (
    'symptom', 'risk_factor', 'attribute', 'positive_baseline'
  )),
  choice_id text not null check (choice_id in ('present', 'absent', 'unknown')),
  source text not null check (source in (
    'initial', 'suggest', 'red_flags', 'diagnosis', 'predefined', 'baseline'
  )),
  is_primary boolean not null default false,
  question_id text,
  question_sequence integer not null check (question_sequence >= 0),
  display_name_en text not null,
  provider_payload jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint symptom_evidence_session_owner_fk
    foreign key (session_id, user_id)
    references public.symptom_check_sessions(id, user_id)
    on delete cascade,
  constraint symptom_evidence_local_fact_unique
    unique (session_id, vitaloop_concept_id, concept_type)
);

create unique index symptom_evidence_provider_fact_unique_idx
  on public.symptom_evidence(session_id, provider_concept_id)
  where provider_concept_id is not null;

create index symptom_evidence_user_recorded_idx
  on public.symptom_evidence(user_id, recorded_at desc);

create index symptom_evidence_session_sequence_idx
  on public.symptom_evidence(session_id, question_sequence);

create index symptom_evidence_concept_choice_idx
  on public.symptom_evidence(vitaloop_concept_id, choice_id);

create table public.clinical_concept_mappings (
  id uuid primary key default gen_random_uuid(),
  vitaloop_concept_id text not null,
  provider text not null,
  provider_model text not null,
  provider_concept_id text not null,
  concept_type text not null check (concept_type in ('symptom', 'risk_factor', 'attribute')),
  display_name_en text not null,
  display_name_uk text,
  root_concern_id text,
  domain_keys text[] not null default '{}',
  active boolean not null default true,
  mapping_version text not null,
  review_status text not null default 'draft' check (review_status in (
    'draft', 'clinical_review', 'approved', 'retired'
  )),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_concept_mappings_provider_unique
    unique (provider, provider_model, provider_concept_id, mapping_version),
  constraint clinical_concept_mappings_review_check check (
    review_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null)
  )
);

create index clinical_concept_mappings_catalog_idx
  on public.clinical_concept_mappings(root_concern_id, active, review_status);

create index clinical_concept_mappings_vitaloop_idx
  on public.clinical_concept_mappings(vitaloop_concept_id, mapping_version);

create table public.symptom_provider_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint_name text not null,
  request_sequence integer not null check (request_sequence >= 0),
  http_status integer check (http_status between 100 and 599),
  latency_ms integer check (latency_ms >= 0),
  provider_model text not null,
  provider_model_version text,
  request_hash text,
  response_hash text,
  normalized_error_code text,
  created_at timestamptz not null default now(),
  constraint symptom_provider_events_session_owner_fk
    foreign key (session_id, user_id)
    references public.symptom_check_sessions(id, user_id)
    on delete cascade,
  constraint symptom_provider_events_sequence_unique unique (session_id, request_sequence)
);

create index symptom_provider_events_user_created_idx
  on public.symptom_provider_events(user_id, created_at desc);

create index symptom_provider_events_session_created_idx
  on public.symptom_provider_events(session_id, created_at);

alter table public.symptom_check_sessions enable row level security;
alter table public.symptom_evidence enable row level security;
alter table public.clinical_concept_mappings enable row level security;
alter table public.symptom_provider_events enable row level security;

revoke all on table public.symptom_check_sessions from anon, authenticated;
revoke all on table public.symptom_evidence from anon, authenticated;
revoke all on table public.clinical_concept_mappings from anon, authenticated;
revoke all on table public.symptom_provider_events from anon, authenticated;

grant select, insert, update, delete on table public.symptom_check_sessions to service_role;
grant select, insert, update, delete on table public.symptom_evidence to service_role;
grant select, insert, update, delete on table public.clinical_concept_mappings to service_role;
grant select, insert, update, delete on table public.symptom_provider_events to service_role;

grant select on table public.symptom_check_sessions to authenticated;
grant select on table public.symptom_evidence to authenticated;

create policy "Users can read own symptom sessions"
  on public.symptom_check_sessions
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can read own symptom evidence"
  on public.symptom_evidence
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

comment on table public.symptom_check_sessions is
  'Server-owned structured symptom interviews. Condition candidates are never exposed by ordinary user endpoints.';
comment on table public.symptom_evidence is
  'Controlled present/absent/unknown clinical evidence. Browser writes are prohibited.';
comment on table public.clinical_concept_mappings is
  'Versioned, clinically reviewed VITALOOP-to-provider concept mappings. Backend-only.';
comment on table public.symptom_provider_events is
  'Operational provider metadata and hashes only; never raw medical request or response bodies.';

notify pgrst, 'reload schema';
