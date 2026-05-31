-- Stage 18: Explainable medical knowledge base foundation
-- Non-destructive schema additions for rule-based health interpretation.

begin;

create extension if not exists pgcrypto;

create table if not exists public.knowledge_entities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'lab_marker',
    'symptom',
    'condition',
    'recommendation',
    'risk_factor',
    'lifestyle_factor',
    'medication',
    'document_topic'
  )),
  key text not null unique,
  name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_knowledge_entities_type on public.knowledge_entities(type);
create index if not exists idx_knowledge_entities_key on public.knowledge_entities(key);

create table if not exists public.lab_markers (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  display_name text not null,
  common_units jsonb not null default '[]'::jsonb,
  description text,
  category text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_lab_markers_key on public.lab_markers(key);

create table if not exists public.reference_ranges (
  id uuid primary key default gen_random_uuid(),
  lab_marker_id uuid not null references public.lab_markers(id) on delete cascade,
  sex text check (sex in ('male', 'female', 'any')),
  min_age integer,
  max_age integer,
  unit text not null,
  low_value numeric,
  high_value numeric,
  optimal_low_value numeric,
  optimal_high_value numeric,
  source text,
  source_url text,
  notes text,
  version text not null default 'v1',
  active boolean not null default true
);
create index if not exists idx_reference_ranges_lab_marker_id on public.reference_ranges(lab_marker_id);
create index if not exists idx_reference_ranges_active on public.reference_ranges(active);

create table if not exists public.symptoms (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  severity_scale text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_symptoms_key on public.symptoms(key);

create table if not exists public.conditions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  category text,
  medical_disclaimer text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_conditions_key on public.conditions(key);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  body text not null,
  category text,
  priority text,
  requires_doctor boolean not null default false,
  evidence_level text,
  source text,
  source_url text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_recommendations_key on public.recommendations(key);

create table if not exists public.knowledge_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  input_entities jsonb not null default '[]'::jsonb,
  conditions jsonb not null,
  outputs jsonb not null,
  confidence numeric not null default 0.5,
  severity text,
  requires_doctor boolean not null default false,
  explanation_template text not null,
  source text,
  source_url text,
  governance_status text not null default 'draft' check (governance_status in ('draft', 'reviewed', 'active', 'deprecated')),
  last_modified_by uuid references public.users(id) on delete set null,
  medical_reviewed_by uuid references public.users(id) on delete set null,
  medical_reviewed_at timestamptz,
  change_note text,
  auto_update_allowed boolean not null default false,
  version text not null default 'v1',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_knowledge_rules_key on public.knowledge_rules(key);
create index if not exists idx_knowledge_rules_active on public.knowledge_rules(active);
create index if not exists idx_knowledge_rules_status on public.knowledge_rules(governance_status);

create or replace function public.sync_knowledge_rule_active_flag()
returns trigger
language plpgsql
as $$
begin
  if new.governance_status = 'active' then
    new.active := true;
  else
    new.active := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_knowledge_rule_active_flag on public.knowledge_rules;
create trigger trg_sync_knowledge_rule_active_flag
before insert or update on public.knowledge_rules
for each row execute function public.sync_knowledge_rule_active_flag();

create or replace function public.enforce_knowledge_rule_governance()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if coalesce(new.change_note, '') = '' then
      raise exception 'knowledge_rules update requires change_note to prevent silent auto-update';
    end if;

    if new.last_modified_by is null and coalesce(new.change_note, '') <> 'stage_18_seed' then
      raise exception 'knowledge_rules update requires last_modified_by';
    end if;

    if new.governance_status in ('reviewed', 'active') and new.medical_reviewed_at is null then
      raise exception 'knowledge_rules reviewed/active status requires medical_reviewed_at';
    end if;

    if position('confirmed diagnosis' in lower(coalesce(new.explanation_template, ''))) > 0 then
      raise exception 'knowledge_rules explanation_template must not contain confirmed diagnosis wording';
    end if;

    if position('confirmed diagnosis' in lower(coalesce((new.outputs->>'summary')::text, ''))) > 0 then
      raise exception 'knowledge_rules outputs.summary must not contain confirmed diagnosis wording';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_knowledge_rule_governance on public.knowledge_rules;
create trigger trg_enforce_knowledge_rule_governance
before update on public.knowledge_rules
for each row execute function public.enforce_knowledge_rule_governance();

create table if not exists public.rule_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  rule_id uuid not null references public.knowledge_rules(id) on delete cascade,
  input_snapshot jsonb not null,
  result jsonb not null,
  explanation text,
  confidence numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_rule_evaluations_rule_id on public.rule_evaluations(rule_id);
create index if not exists idx_rule_evaluations_user_id on public.rule_evaluations(user_id);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text,
  source_url text,
  document_type text,
  medical_review_status text not null default 'draft' check (medical_review_status in ('draft', 'reviewed', 'rejected')),
  version text not null default 'v1',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding jsonb,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);
create index if not exists idx_knowledge_chunks_document_id on public.knowledge_chunks(document_id);

create table if not exists public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  rule_evaluation_id uuid references public.rule_evaluations(id) on delete set null,
  feedback_type text not null check (feedback_type in ('accepted', 'rejected', 'ignored', 'helpful', 'not_helpful')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_recommendation_feedback_recommendation_id on public.recommendation_feedback(recommendation_id);
create index if not exists idx_recommendation_feedback_user_id on public.recommendation_feedback(user_id);

-- RLS baseline: deny direct anon/authenticated access until explicit tenant policies are introduced.
alter table public.knowledge_entities enable row level security;
alter table public.lab_markers enable row level security;
alter table public.reference_ranges enable row level security;
alter table public.symptoms enable row level security;
alter table public.conditions enable row level security;
alter table public.recommendations enable row level security;
alter table public.knowledge_rules enable row level security;
alter table public.rule_evaluations enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.recommendation_feedback enable row level security;

drop policy if exists deny_all_knowledge_entities on public.knowledge_entities;
create policy deny_all_knowledge_entities on public.knowledge_entities for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_lab_markers on public.lab_markers;
create policy deny_all_lab_markers on public.lab_markers for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_reference_ranges on public.reference_ranges;
create policy deny_all_reference_ranges on public.reference_ranges for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_symptoms on public.symptoms;
create policy deny_all_symptoms on public.symptoms for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_conditions on public.conditions;
create policy deny_all_conditions on public.conditions for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_recommendations on public.recommendations;
create policy deny_all_recommendations on public.recommendations for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_knowledge_rules on public.knowledge_rules;
create policy deny_all_knowledge_rules on public.knowledge_rules for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_rule_evaluations on public.rule_evaluations;
create policy deny_all_rule_evaluations on public.rule_evaluations for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_knowledge_documents on public.knowledge_documents;
create policy deny_all_knowledge_documents on public.knowledge_documents for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_knowledge_chunks on public.knowledge_chunks;
create policy deny_all_knowledge_chunks on public.knowledge_chunks for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_all_recommendation_feedback on public.recommendation_feedback;
create policy deny_all_recommendation_feedback on public.recommendation_feedback for all to anon, authenticated using (false) with check (false);

-- Seed: baseline marker dictionary for sandbox + initial production-safe rules.
insert into public.lab_markers (key, display_name, common_units, description, category)
values
  ('glucose', 'Glucose', '["mg/dL", "mmol/L"]'::jsonb, 'Blood glucose concentration.', 'metabolic'),
  ('hba1c', 'HbA1c', '["%"]'::jsonb, 'Average blood glucose marker over prior months.', 'metabolic'),
  ('vitamin_d', 'Vitamin D (25-OH)', '["ng/mL", "nmol/L"]'::jsonb, 'Vitamin D status marker.', 'micronutrient'),
  ('ferritin', 'Ferritin', '["ng/mL", "ug/L"]'::jsonb, 'Iron storage biomarker.', 'hematology'),
  ('tsh', 'TSH', '["uIU/mL", "mIU/L"]'::jsonb, 'Thyroid stimulating hormone.', 'endocrine'),
  ('alt', 'ALT', '["U/L"]'::jsonb, 'Alanine aminotransferase.', 'liver'),
  ('ast', 'AST', '["U/L"]'::jsonb, 'Aspartate aminotransferase.', 'liver'),
  ('ldl', 'LDL Cholesterol', '["mg/dL", "mmol/L"]'::jsonb, 'Low-density lipoprotein cholesterol.', 'lipids'),
  ('hdl', 'HDL Cholesterol', '["mg/dL", "mmol/L"]'::jsonb, 'High-density lipoprotein cholesterol.', 'lipids'),
  ('triglycerides', 'Triglycerides', '["mg/dL", "mmol/L"]'::jsonb, 'Triglyceride concentration.', 'lipids')
on conflict (key) do update
set
  display_name = excluded.display_name,
  common_units = excluded.common_units,
  description = excluded.description,
  category = excluded.category;

insert into public.knowledge_entities (type, key, name, description)
select 'lab_marker', lm.key, lm.display_name, lm.description
from public.lab_markers lm
on conflict (key) do update
set
  type = excluded.type,
  name = excluded.name,
  description = excluded.description;

insert into public.symptoms (key, name, description, severity_scale)
values
  ('fatigue', 'Fatigue', 'Persistent low energy or tiredness.', 'none,mild,moderate,severe')
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  severity_scale = excluded.severity_scale;

insert into public.knowledge_entities (type, key, name, description)
values
  ('symptom', 'fatigue', 'Fatigue', 'Persistent low energy or tiredness.')
on conflict (key) do update
set
  type = excluded.type,
  name = excluded.name,
  description = excluded.description;

insert into public.conditions (key, name, description, category, medical_disclaimer)
values
  ('possible_iron_deficiency_risk', 'Possible Iron Deficiency Risk', 'Low ferritin with fatigue may indicate reduced iron stores.', 'hematology', 'This is not a diagnosis. Consider discussing with a clinician.'),
  ('possible_vitamin_d_insufficiency', 'Possible Vitamin D Insufficiency', 'Lower vitamin D values may indicate insufficiency.', 'micronutrient', 'This is not a diagnosis. Consider discussing with a clinician.'),
  ('possible_elevated_diabetes_risk', 'Possible Elevated Diabetes Risk', 'Elevated HbA1c may indicate increased diabetes risk.', 'metabolic', 'This is not a diagnosis and requires medical review.'),
  ('possible_liver_enzyme_elevation', 'Possible Liver Enzyme Elevation', 'Elevated ALT/AST may indicate liver stress.', 'liver', 'This is not a diagnosis and requires medical review.'),
  ('possible_cardiovascular_risk', 'Possible Cardiovascular Risk', 'High LDL may indicate elevated cardiovascular risk.', 'cardiometabolic', 'This is not a diagnosis. Consider discussing with a clinician.')
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  medical_disclaimer = excluded.medical_disclaimer;

insert into public.knowledge_entities (type, key, name, description)
select 'condition', c.key, c.name, c.description
from public.conditions c
on conflict (key) do update
set
  type = excluded.type,
  name = excluded.name,
  description = excluded.description;

insert into public.recommendations (
  key,
  title,
  body,
  category,
  priority,
  requires_doctor,
  evidence_level,
  source,
  source_url
)
values
  (
    'iron_followup_discussion',
    'Discuss iron status follow-up',
    'Low ferritin with fatigue may indicate a possible iron deficiency risk. Consider discussing iron studies and follow-up testing with a clinician.',
    'hematology',
    'high',
    false,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/iron-guideline'
  ),
  (
    'vitamin_d_lifestyle_and_followup',
    'Address possible vitamin D insufficiency',
    'Vitamin D level may indicate insufficiency. Consider lifestyle and supplementation options, and discuss follow-up testing with a clinician.',
    'micronutrient',
    'medium',
    false,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/vitamin-d-guideline'
  ),
  (
    'hba1c_medical_review',
    'Requires medical review for elevated HbA1c',
    'HbA1c may indicate elevated diabetes risk and requires medical review. Consider discussing confirmatory evaluation with a clinician.',
    'metabolic',
    'high',
    true,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/hba1c-guideline'
  ),
  (
    'liver_enzyme_medical_review',
    'Review elevated liver enzymes with a clinician',
    'ALT/AST values may indicate liver enzyme elevation. Consider discussing potential causes and repeat testing with a clinician.',
    'liver',
    'high',
    true,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/liver-guideline'
  ),
  (
    'ldl_risk_reduction_plan',
    'Create cardiovascular risk reduction plan',
    'LDL value may indicate elevated cardiovascular risk. Consider lifestyle risk-reduction measures and clinician follow-up.',
    'cardiometabolic',
    'medium',
    true,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/lipid-guideline'
  )
on conflict (key) do update
set
  title = excluded.title,
  body = excluded.body,
  category = excluded.category,
  priority = excluded.priority,
  requires_doctor = excluded.requires_doctor,
  evidence_level = excluded.evidence_level,
  source = excluded.source,
  source_url = excluded.source_url;

insert into public.knowledge_entities (type, key, name, description)
select 'recommendation', r.key, r.title, r.body
from public.recommendations r
on conflict (key) do update
set
  type = excluded.type,
  name = excluded.name,
  description = excluded.description;

insert into public.knowledge_rules (
  key,
  name,
  description,
  input_entities,
  conditions,
  outputs,
  confidence,
  severity,
  requires_doctor,
  explanation_template,
  source,
  source_url,
  governance_status,
  medical_reviewed_at,
  change_note,
  version,
  active
)
values
  (
    'rule_low_ferritin_fatigue',
    'Low ferritin with fatigue',
    'Low ferritin with fatigue may indicate possible iron deficiency risk.',
    '["ferritin", "fatigue"]'::jsonb,
    '{"all":[{"lab_marker":"ferritin","operator":"lt","value":30,"unit":"ng/mL"},{"symptom":"fatigue"}]}'::jsonb,
    '{"risk":"possible_iron_deficiency_risk","recommendation_keys":["iron_followup_discussion"],"summary":"Low ferritin with fatigue may indicate possible iron deficiency risk."}'::jsonb,
    0.72,
    'moderate',
    false,
    'Ferritin value ({{ferritin_value}} {{ferritin_unit}}) with symptom fatigue may indicate possible iron deficiency risk. Consider discussing with a clinician.',
    'clinical_guideline_placeholder',
    'https://example.org/iron-guideline',
    'active',
    now(),
    'stage_18_seed',
    'v1',
    true
  ),
  (
    'rule_low_vitamin_d',
    'Low vitamin D',
    'Lower vitamin D may indicate possible insufficiency.',
    '["vitamin_d"]'::jsonb,
    '{"all":[{"lab_marker":"vitamin_d","operator":"lt","value":30,"unit":"ng/mL"}]}'::jsonb,
    '{"risk":"possible_vitamin_d_insufficiency","recommendation_keys":["vitamin_d_lifestyle_and_followup"],"summary":"Vitamin D level may indicate possible insufficiency."}'::jsonb,
    0.68,
    'moderate',
    false,
    'Vitamin D value ({{vitamin_d_value}} {{vitamin_d_unit}}) may indicate possible insufficiency. Consider discussing with a clinician.',
    'clinical_guideline_placeholder',
    'https://example.org/vitamin-d-guideline',
    'active',
    now(),
    'stage_18_seed',
    'v1',
    true
  ),
  (
    'rule_high_hba1c',
    'High HbA1c',
    'Elevated HbA1c may indicate elevated diabetes risk and requires medical review.',
    '["hba1c"]'::jsonb,
    '{"all":[{"lab_marker":"hba1c","operator":"gte","value":5.7,"unit":"%"}]}'::jsonb,
    '{"risk":"possible_elevated_diabetes_risk","recommendation_keys":["hba1c_medical_review"],"summary":"HbA1c may indicate elevated diabetes risk and requires medical review."}'::jsonb,
    0.82,
    'high',
    true,
    'HbA1c value ({{hba1c_value}} {{hba1c_unit}}) may indicate elevated diabetes risk and requires medical review.',
    'clinical_guideline_placeholder',
    'https://example.org/hba1c-guideline',
    'active',
    now(),
    'stage_18_seed',
    'v1',
    true
  ),
  (
    'rule_high_alt_or_ast',
    'High ALT or AST',
    'Elevated ALT or AST may indicate liver enzyme elevation. Significant elevations require medical review.',
    '["alt", "ast"]'::jsonb,
    '{"any":[{"lab_marker":"alt","operator":"gt","value":55,"unit":"U/L"},{"lab_marker":"ast","operator":"gt","value":48,"unit":"U/L"}]}'::jsonb,
    '{"risk":"possible_liver_enzyme_elevation","recommendation_keys":["liver_enzyme_medical_review"],"summary":"ALT/AST may indicate liver enzyme elevation and may require medical review."}'::jsonb,
    0.8,
    'high',
    true,
    'ALT/AST values (ALT={{alt_value}} {{alt_unit}}, AST={{ast_value}} {{ast_unit}}) may indicate liver enzyme elevation and may require medical review.',
    'clinical_guideline_placeholder',
    'https://example.org/liver-guideline',
    'active',
    now(),
    'stage_18_seed',
    'v1',
    true
  ),
  (
    'rule_high_ldl',
    'High LDL',
    'Elevated LDL may indicate increased cardiovascular risk and should be reviewed in clinical context.',
    '["ldl"]'::jsonb,
    '{"all":[{"lab_marker":"ldl","operator":"gte","value":130,"unit":"mg/dL"}]}'::jsonb,
    '{"risk":"possible_cardiovascular_risk","recommendation_keys":["ldl_risk_reduction_plan"],"summary":"LDL may indicate elevated cardiovascular risk; consider clinician discussion."}'::jsonb,
    0.74,
    'moderate',
    true,
    'LDL value ({{ldl_value}} {{ldl_unit}}) may indicate elevated cardiovascular risk. Consider discussing with a clinician.',
    'clinical_guideline_placeholder',
    'https://example.org/lipid-guideline',
    'active',
    now(),
    'stage_18_seed',
    'v1',
    true
  )
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  input_entities = excluded.input_entities,
  conditions = excluded.conditions,
  outputs = excluded.outputs,
  confidence = excluded.confidence,
  severity = excluded.severity,
  requires_doctor = excluded.requires_doctor,
  explanation_template = excluded.explanation_template,
  source = excluded.source,
  source_url = excluded.source_url,
  governance_status = excluded.governance_status,
  medical_reviewed_at = excluded.medical_reviewed_at,
  change_note = excluded.change_note,
  version = excluded.version,
  active = excluded.active,
  updated_at = now();

commit;
