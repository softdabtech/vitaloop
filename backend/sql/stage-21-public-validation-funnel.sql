-- Stage 21: Public validation funnel for EN symptom-intake MVP.
-- Anonymous, low-friction data capture. This does not replace authenticated
-- questionnaire_sessions, timeline_events, knowledge_rules, or checkins_weekly.

create table if not exists public.public_funnel_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_public_funnel_events_session
  on public.public_funnel_events(session_id);

create index if not exists idx_public_funnel_events_event_created
  on public.public_funnel_events(event_name, created_at desc);

create table if not exists public.symptom_assessments (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  symptoms text[] not null,
  duration text not null,
  age_range text,
  sex text,
  email text,
  recommended_labs jsonb not null default '[]'::jsonb,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_symptom_assessments_session
  on public.symptom_assessments(session_id);

create index if not exists idx_symptom_assessments_created
  on public.symptom_assessments(created_at desc);

create index if not exists idx_symptom_assessments_email
  on public.symptom_assessments(email)
  where email is not null;

alter table public.public_funnel_events enable row level security;
alter table public.symptom_assessments enable row level security;

grant select, insert, update, delete on table public.public_funnel_events to service_role;
grant select, insert, update, delete on table public.symptom_assessments to service_role;
