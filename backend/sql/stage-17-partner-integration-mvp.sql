-- Stage 17: Partner Integration Layer (MVP)
-- Creates isolated B2B partner ingestion pipeline without touching B2C /analyze flow.

begin;

create extension if not exists pgcrypto;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_api_keys (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  key_hash text not null unique,
  key_label text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  scopes jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_api_keys_partner_id on public.partner_api_keys(partner_id);

create table if not exists public.partner_patients (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  external_patient_id text not null,
  local_user_id uuid,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id, external_patient_id)
);

create table if not exists public.partner_lab_results (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  partner_patient_id uuid not null references public.partner_patients(id) on delete cascade,
  external_order_id text not null,
  external_result_id text not null,
  source_lab text,
  result_date date,
  status text not null default 'received' check (status in ('received', 'normalized', 'processed', 'failed', 'duplicate')),
  raw_payload jsonb not null default '{}'::jsonb,
  canonical_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id, external_order_id, external_result_id)
);
create index if not exists idx_partner_lab_results_partner_id on public.partner_lab_results(partner_id);
create index if not exists idx_partner_lab_results_patient_id on public.partner_lab_results(partner_patient_id);

create table if not exists public.partner_biomarkers (
  id uuid primary key default gen_random_uuid(),
  partner_lab_result_id uuid not null references public.partner_lab_results(id) on delete cascade,
  canonical_name text not null,
  display_name text not null,
  value numeric not null,
  unit text not null,
  ref_low numeric,
  ref_high numeric,
  status text,
  category text,
  confidence numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_biomarkers_result_id on public.partner_biomarkers(partner_lab_result_id);

create table if not exists public.partner_insights (
  id uuid primary key default gen_random_uuid(),
  partner_lab_result_id uuid not null unique references public.partner_lab_results(id) on delete cascade,
  insight_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  partner_patient_id uuid,
  partner_lab_result_id uuid,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_events_partner_id on public.partner_events(partner_id);
create index if not exists idx_partner_events_result_id on public.partner_events(partner_lab_result_id);

create table if not exists public.partner_embedded_sessions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  partner_patient_id uuid not null references public.partner_patients(id) on delete cascade,
  partner_lab_result_id uuid not null references public.partner_lab_results(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_embedded_sessions_partner_id on public.partner_embedded_sessions(partner_id);

-- RLS baseline. Service-role calls bypass RLS, but policies are added for safe defaults.
alter table public.partners enable row level security;
alter table public.partner_api_keys enable row level security;
alter table public.partner_patients enable row level security;
alter table public.partner_lab_results enable row level security;
alter table public.partner_biomarkers enable row level security;
alter table public.partner_insights enable row level security;
alter table public.partner_events enable row level security;
alter table public.partner_embedded_sessions enable row level security;

-- Block direct access from anon/authenticated until tenant-aware policies are introduced.
drop policy if exists deny_all_partners on public.partners;
create policy deny_all_partners on public.partners for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_partner_api_keys on public.partner_api_keys;
create policy deny_all_partner_api_keys on public.partner_api_keys for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_partner_patients on public.partner_patients;
create policy deny_all_partner_patients on public.partner_patients for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_partner_lab_results on public.partner_lab_results;
create policy deny_all_partner_lab_results on public.partner_lab_results for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_partner_biomarkers on public.partner_biomarkers;
create policy deny_all_partner_biomarkers on public.partner_biomarkers for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_partner_insights on public.partner_insights;
create policy deny_all_partner_insights on public.partner_insights for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_partner_events on public.partner_events;
create policy deny_all_partner_events on public.partner_events for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_partner_embedded_sessions on public.partner_embedded_sessions;
create policy deny_all_partner_embedded_sessions on public.partner_embedded_sessions for all to anon, authenticated using (false) with check (false);

commit;
