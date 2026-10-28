-- Cover the composite ownership foreign keys used for cascade checks/deletes.
create index symptom_evidence_session_owner_idx
  on public.symptom_evidence(session_id, user_id);

create index symptom_provider_events_session_owner_idx
  on public.symptom_provider_events(session_id, user_id);
