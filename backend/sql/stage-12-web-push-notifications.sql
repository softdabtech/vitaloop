-- Web push notifications MVP tables
-- Run in Supabase SQL editor before enabling push reminders in production.

create extension if not exists pgcrypto;

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  platform text not null default 'desktop',
  user_agent text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_push_subscriptions_user_id
  on public.user_push_subscriptions(user_id);

create index if not exists idx_user_push_subscriptions_active
  on public.user_push_subscriptions(is_active);

create table if not exists public.user_notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  push_enabled boolean not null default true,
  weekly_checkin boolean not null default true,
  assignment_due boolean not null default true,
  retest_reminder boolean not null default true,
  streak_reminder boolean not null default true,
  weekly_digest boolean not null default true,
  achievement_unlock boolean not null default true,
  biomarker_alert boolean not null default true,
  insight_published boolean not null default true,
  timezone text not null default 'UTC',
  quiet_hours_start time not null default '22:00:00',
  quiet_hours_end time not null default '08:00:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reminder_type text not null,
  channel text not null default 'push',
  sent_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_dispatch_log_user_created
  on public.notification_dispatch_log(user_id, created_at desc);

alter table public.user_push_subscriptions enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.notification_dispatch_log enable row level security;

-- Owner access for user subscriptions
drop policy if exists "Users can view own push subscriptions" on public.user_push_subscriptions;
create policy "Users can view own push subscriptions"
  on public.user_push_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own push subscriptions" on public.user_push_subscriptions;
create policy "Users can insert own push subscriptions"
  on public.user_push_subscriptions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own push subscriptions" on public.user_push_subscriptions;
create policy "Users can update own push subscriptions"
  on public.user_push_subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owner access for preferences
drop policy if exists "Users can view own notification preferences" on public.user_notification_preferences;
create policy "Users can view own notification preferences"
  on public.user_notification_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification preferences" on public.user_notification_preferences;
create policy "Users can insert own notification preferences"
  on public.user_notification_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification preferences" on public.user_notification_preferences;
create policy "Users can update own notification preferences"
  on public.user_notification_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Read-only access to own dispatch logs
drop policy if exists "Users can view own dispatch logs" on public.notification_dispatch_log;
create policy "Users can view own dispatch logs"
  on public.notification_dispatch_log
  for select
  using (auth.uid() = user_id);
