-- Raw provider payload storage is intentionally unsupported. The column is
-- retained for schema compatibility, but this database guard keeps it empty.
update public.symptom_evidence
set provider_payload = '{}'::jsonb
where provider_payload <> '{}'::jsonb;

alter table public.symptom_evidence
  add constraint symptom_evidence_provider_payload_empty_check
  check (provider_payload = '{}'::jsonb);

comment on column public.symptom_evidence.provider_payload is
  'Compatibility field. Must remain an empty JSON object; raw provider payloads are prohibited.';
