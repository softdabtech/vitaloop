create table public.symptom_answer_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key_hash text not null,
  request_hash text not null,
  response_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint symptom_answer_submissions_session_owner_fk
    foreign key (session_id, user_id)
    references public.symptom_check_sessions(id, user_id)
    on delete cascade,
  constraint symptom_answer_submissions_idempotency_unique
    unique (session_id, idempotency_key_hash)
);

create index symptom_answer_submissions_session_owner_idx
  on public.symptom_answer_submissions(session_id, user_id);

create index symptom_answer_submissions_user_created_idx
  on public.symptom_answer_submissions(user_id, created_at desc);

alter table public.symptom_answer_submissions enable row level security;

revoke all on table public.symptom_answer_submissions from anon, authenticated;
grant select, insert, update, delete on table public.symptom_answer_submissions to service_role;

comment on table public.symptom_answer_submissions is
  'Backend-only answer idempotency ledger. Stores hashes and normalized VITALOOP responses, never raw provider bodies.';

notify pgrst, 'reload schema';
