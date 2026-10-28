alter table public.symptom_check_sessions
  add column internal_safety_level text check (internal_safety_level in (
    'emergency', 'urgent_24h', 'clinician_review', 'routine', 'insufficient_data'
  )),
  add column provider_safety_level text check (provider_safety_level in (
    'emergency', 'urgent_24h', 'clinician_review', 'routine', 'insufficient_data'
  ));

comment on column public.symptom_check_sessions.internal_safety_level is
  'Normalized VITALOOP safety decision before provider merge.';
comment on column public.symptom_check_sessions.provider_safety_level is
  'Normalized provider safety decision before conservative merge.';

notify pgrst, 'reload schema';
