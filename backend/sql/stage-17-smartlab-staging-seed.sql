-- Smartlab staging seed for Partner Layer.
-- Intended for staging only.
-- Replace :api_key_hash before execution.

begin;

insert into public.partners (slug, display_name, status, metadata)
values ('smartlab', 'Smartlab', 'active', '{"seed":"staging"}'::jsonb)
on conflict (slug)
do update set
  display_name = excluded.display_name,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

with p as (
  select id from public.partners where slug = 'smartlab' limit 1
)
insert into public.partner_api_keys (partner_id, key_hash, key_label, status, scopes)
select
  p.id,
  '__REPLACE_WITH_SHA256_API_KEY_HASH__',
  'smartlab-staging-main',
  'active',
  '["results:write","results:read","embedded:create","events:write"]'::jsonb
from p
on conflict (key_hash)
do update set
  partner_id = excluded.partner_id,
  key_label = excluded.key_label,
  status = excluded.status,
  scopes = excluded.scopes;

with p as (
  select id from public.partners where slug = 'smartlab' limit 1
)
insert into public.partner_patients (partner_id, external_patient_id, profile)
select p.id, 'SMARTLAB-STAGE-PATIENT-001', '{"seed":true}'::jsonb
from p
on conflict (partner_id, external_patient_id)
do update set updated_at = now();

with p as (
  select id from public.partners where slug = 'smartlab' limit 1
), pp as (
  select id as patient_id, partner_id
  from public.partner_patients
  where external_patient_id = 'SMARTLAB-STAGE-PATIENT-001'
  limit 1
)
insert into public.partner_lab_results (
  partner_id,
  partner_patient_id,
  external_order_id,
  external_result_id,
  source_lab,
  result_date,
  status,
  raw_payload,
  canonical_payload
)
select
  p.id,
  pp.patient_id,
  'STAGE-ORDER-001',
  'STAGE-RESULT-001',
  'smartlab',
  current_date,
  'processed',
  '{"biomarkers":[{"name":"Vitamin D","value":24,"unit":"ng/mL","ref_low":30,"ref_high":100}]}'::jsonb,
  '{}'::jsonb
from p
join pp on pp.partner_id = p.id
on conflict (partner_id, external_order_id, external_result_id)
do update set
  status = excluded.status,
  raw_payload = excluded.raw_payload,
  updated_at = now();

commit;
