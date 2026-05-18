-- Stage 13: LLM usage events for Claude token spend analytics
-- Apply in Supabase SQL editor before using CRM Claude spend dashboard.

create table if not exists public.llm_usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  upload_id uuid null references public.lab_uploads(id) on delete set null,
  provider text not null default 'anthropic',
  model text not null,
  task_name text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_llm_usage_events_created_at on public.llm_usage_events(created_at desc);
create index if not exists idx_llm_usage_events_user_created on public.llm_usage_events(user_id, created_at desc);
create index if not exists idx_llm_usage_events_task_created on public.llm_usage_events(task_name, created_at desc);

alter table public.llm_usage_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'llm_usage_events'
      and policyname = 'llm_usage_events_select_own'
  ) then
    create policy llm_usage_events_select_own
      on public.llm_usage_events
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
