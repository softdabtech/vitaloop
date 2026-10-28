-- Stage 24: B2B analyze-labs API support
-- Extends partner storage for full structured analysis responses and usage tracking.

begin;

alter table public.partners
  add column if not exists b2b_retention_days integer not null default 90,
  add column if not exists b2b_biomarker_mappings jsonb not null default '{}'::jsonb,
  add column if not exists b2b_allowed_ips jsonb not null default '[]'::jsonb,
  add column if not exists b2b_require_cloudflare boolean not null default false;

alter table public.partner_api_keys
  add column if not exists key_prefix text,
  add column if not exists last_used_at timestamptz,
  add column if not exists revoked_at timestamptz;

alter table public.partner_lab_results
  add column if not exists raw_request jsonb not null default '{}'::jsonb,
  add column if not exists normalized_biomarkers jsonb not null default '[]'::jsonb,
  add column if not exists final_response jsonb not null default '{}'::jsonb,
  add column if not exists analysis_status text not null default 'received',
  add column if not exists cost_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.partner_usage_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  api_key_id uuid references public.partner_api_keys(id) on delete set null,
  partner_lab_result_id uuid references public.partner_lab_results(id) on delete set null,
  request_count integer not null default 1,
  biomarker_count integer not null default 0,
  ai_prompt_tokens integer not null default 0,
  ai_completion_tokens integer not null default 0,
  estimated_cost_usd numeric not null default 0,
  estimated boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_usage_events_partner_id on public.partner_usage_events(partner_id);
create index if not exists idx_partner_usage_events_api_key_id on public.partner_usage_events(api_key_id);
create index if not exists idx_partner_usage_events_lab_result_id on public.partner_usage_events(partner_lab_result_id);

alter table public.partner_usage_events enable row level security;

drop policy if exists deny_all_partner_usage_events on public.partner_usage_events;
create policy deny_all_partner_usage_events on public.partner_usage_events
  for all to anon, authenticated using (false) with check (false);

commit;
