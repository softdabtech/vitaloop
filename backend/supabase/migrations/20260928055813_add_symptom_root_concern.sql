alter table public.symptom_check_sessions
  add column root_concern_id text not null;

create index symptom_check_sessions_root_concern_idx
  on public.symptom_check_sessions(root_concern_id, created_at desc);
