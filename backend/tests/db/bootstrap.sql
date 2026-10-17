-- Test-only minimal schema copy for the finalize_lab_analysis harness.
-- Runs ONLY after tests/db/safety.py verified an empty, sentinel-marked database.
-- No role creation and no schema drops. Mirrors the repo's column/constraint shapes.
create table public.lab_uploads (
  id uuid primary key,
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending','processing','done','failed'))
);
create table public.biomarkers (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null,
  user_id uuid not null,
  name text not null,
  value numeric(10,3),
  unit text,
  ref_low numeric(10,3),
  ref_high numeric(10,3),
  status text check (status in ('OPTIMAL','BORDERLINE','DEFICIENT','ELEVATED')),
  category text,
  canonical_name text,
  reference_source text,
  unevaluated_reason text
);
create unique index uq_biomarkers_upload_name on public.biomarkers(upload_id, lower(name));
create table public.report_versions (
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
-- Downstream tables are intentionally minimal here: this harness verifies the
-- new effect-identity constraints, not their unrelated application schemas.
create table public.intervention_events (id uuid primary key default gen_random_uuid(), user_id uuid not null, upload_id uuid, source_report_version_id uuid, action_type text, related_recommendation_id text);
create table public.safety_events (id uuid primary key default gen_random_uuid(), user_id uuid not null, upload_id uuid, report_version_id uuid, rule_key text);
create table public.analysis_quality_gates (id uuid primary key default gen_random_uuid(), user_id uuid not null, upload_id uuid not null);
create table public.clinical_data_integrity_events (id uuid primary key default gen_random_uuid(), user_id uuid not null, upload_id uuid not null);
create table public.evidence_gaps (id uuid primary key default gen_random_uuid(), user_id uuid not null, upload_id uuid not null);
create table public.health_state_versions (id uuid primary key default gen_random_uuid(), user_id uuid not null, upload_id uuid not null);
create table public.protocols (id uuid primary key default gen_random_uuid(), user_id uuid not null, upload_id uuid not null, recommendations jsonb not null default '[]', prompt_version text);
create unique index uq_protocols_user_upload on public.protocols(user_id, upload_id);
create table public.timeline_events (id uuid primary key default gen_random_uuid(), user_id uuid not null, event_type text not null, summary text not null);
create table public.audit_logs (id uuid primary key default gen_random_uuid(), user_id uuid, action text not null, entity_type text not null, entity_id text not null);
alter table public.lab_uploads enable row level security;
alter table public.biomarkers enable row level security;
alter table public.report_versions enable row level security;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.lab_uploads, public.biomarkers, public.report_versions to service_role;
