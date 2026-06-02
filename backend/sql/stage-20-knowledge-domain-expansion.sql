-- Stage 20: Knowledge base domain expansion
-- Adds deeper educational rules/recommendations for iron/ferritin, glucose/HbA1c,
-- lipids, vitamin D, liver enzymes, and thyroid patterns.
-- Non-destructive. Does not enable pgvector/RAG.
--
-- Production compatibility note:
-- This migration intentionally avoids ON CONFLICT because some production tables
-- may not have the same unique constraints as the original Stage 18 SQL.
-- The body is wrapped in one DO statement so Supabase SQL Editor keeps temp
-- staging tables in the same execution context.

do $$
begin

create temp table _stage20_lab_markers (
  key text,
  display_name text,
  common_units jsonb,
  description text,
  category text
) on commit drop;

insert into _stage20_lab_markers (key, display_name, common_units, description, category)
values
  ('iron', 'Serum Iron', '["ug/dL", "umol/L"]'::jsonb, 'Serum iron concentration.', 'hematology'),
  ('transferrin_saturation', 'Transferrin Saturation', '["%"]'::jsonb, 'Percentage of transferrin saturated with iron.', 'hematology'),
  ('total_cholesterol', 'Total Cholesterol', '["mg/dL", "mmol/L"]'::jsonb, 'Total cholesterol concentration.', 'lipids'),
  ('apob', 'Apolipoprotein B', '["mg/dL", "g/L"]'::jsonb, 'Atherogenic particle marker.', 'lipids'),
  ('free_t4', 'Free T4', '["ng/dL", "pmol/L"]'::jsonb, 'Free thyroxine marker.', 'endocrine'),
  ('free_t3', 'Free T3', '["pg/mL", "pmol/L"]'::jsonb, 'Free triiodothyronine marker.', 'endocrine'),
  ('ggt', 'GGT', '["U/L"]'::jsonb, 'Gamma-glutamyl transferase.', 'liver'),
  ('crp', 'C-Reactive Protein', '["mg/L"]'::jsonb, 'Inflammation marker.', 'inflammation'),
  ('insulin', 'Fasting Insulin', '["uIU/mL", "pmol/L"]'::jsonb, 'Fasting insulin concentration.', 'metabolic');

update public.lab_markers lm
set
  display_name = src.display_name,
  common_units = src.common_units,
  description = src.description,
  category = src.category
from _stage20_lab_markers src
where lm.key = src.key;

insert into public.lab_markers (key, display_name, common_units, description, category)
select src.key, src.display_name, src.common_units, src.description, src.category
from _stage20_lab_markers src
where not exists (
  select 1 from public.lab_markers lm where lm.key = src.key
);

create temp table _stage20_conditions (
  key text,
  name text,
  description text,
  category text,
  medical_disclaimer text
) on commit drop;

insert into _stage20_conditions (key, name, description, category, medical_disclaimer)
values
  ('possible_low_iron_store_pattern', 'Possible Low Iron Store Pattern', 'Low ferritin may indicate reduced iron stores, especially when symptoms are present.', 'hematology', 'This is not a diagnosis. Review in clinical context.'),
  ('possible_glucose_regulation_pattern', 'Possible Glucose Regulation Pattern', 'Elevated glucose or HbA1c may indicate altered glucose regulation.', 'metabolic', 'This is not a diagnosis. Elevated values require clinician review.'),
  ('possible_atherogenic_lipid_pattern', 'Possible Atherogenic Lipid Pattern', 'Elevated LDL, triglycerides, ApoB, or low HDL may indicate increased cardiometabolic risk.', 'cardiometabolic', 'This is not a diagnosis. Review cardiovascular risk with a clinician.'),
  ('possible_severe_vitamin_d_insufficiency', 'Possible Severe Vitamin D Insufficiency', 'Very low vitamin D may require more urgent review and follow-up testing.', 'micronutrient', 'This is not a diagnosis. Review with a clinician.'),
  ('possible_liver_stress_pattern', 'Possible Liver Stress Pattern', 'Elevated liver enzymes may reflect liver or biliary stress and need context.', 'liver', 'This is not a diagnosis. Significant or persistent elevations require clinician review.'),
  ('possible_thyroid_axis_pattern', 'Possible Thyroid Axis Pattern', 'TSH and thyroid hormone changes may indicate thyroid-axis imbalance.', 'endocrine', 'This is not a diagnosis. Thyroid findings require clinician review.');

update public.conditions c
set
  name = src.name,
  description = src.description,
  category = src.category,
  medical_disclaimer = src.medical_disclaimer
from _stage20_conditions src
where c.key = src.key;

insert into public.conditions (key, name, description, category, medical_disclaimer)
select src.key, src.name, src.description, src.category, src.medical_disclaimer
from _stage20_conditions src
where not exists (
  select 1 from public.conditions c where c.key = src.key
);

create temp table _stage20_recommendations (
  key text,
  title text,
  body text,
  category text,
  priority text,
  requires_doctor boolean,
  evidence_level text,
  source text,
  source_url text
) on commit drop;

insert into _stage20_recommendations (
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
    'iron_panel_context_review',
    'Review iron status in context',
    'Low ferritin should be interpreted with CBC, serum iron, transferrin saturation, CRP, symptoms, diet, bleeding risk, and medications. Discuss whether follow-up iron studies or clinical review are appropriate.',
    'hematology',
    'high',
    false,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/iron-context'
  ),
  (
    'very_low_ferritin_medical_review',
    'Review very low ferritin with a clinician',
    'Very low ferritin may reflect depleted iron stores. Discuss clinical context, possible causes, iron studies, CBC, and follow-up timing with a qualified clinician.',
    'hematology',
    'high',
    true,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/ferritin-review'
  ),
  (
    'glucose_regulation_followup',
    'Review glucose regulation markers',
    'Elevated fasting glucose or HbA1c should be interpreted with fasting status, recent meals, medications, sleep, stress, waist circumference, and repeat testing. Discuss confirmatory evaluation with a clinician.',
    'metabolic',
    'high',
    true,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/glucose-review'
  ),
  (
    'lipid_pattern_context_review',
    'Review lipid risk pattern',
    'Lipid markers should be interpreted with overall cardiovascular risk, family history, blood pressure, glucose markers, thyroid status, ApoB when available, diet, and lifestyle context.',
    'cardiometabolic',
    'high',
    true,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/lipid-pattern'
  ),
  (
    'triglyceride_hdl_metabolic_review',
    'Review triglyceride and HDL pattern',
    'High triglycerides with low HDL may indicate a possible cardiometabolic risk pattern. Discuss fasting status, glucose regulation, alcohol intake, thyroid status, diet, and repeat fasting lipid testing.',
    'cardiometabolic',
    'high',
    true,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/triglyceride-hdl'
  ),
  (
    'severe_vitamin_d_followup',
    'Review very low vitamin D follow-up',
    'Very low vitamin D should be reviewed with context such as sun exposure, diet, malabsorption risk, medications, calcium status, and follow-up testing interval.',
    'micronutrient',
    'high',
    false,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/vitamin-d-severe'
  ),
  (
    'liver_pattern_context_review',
    'Review liver enzyme pattern',
    'Elevated liver enzymes should be interpreted with medications, alcohol intake, viral risk, metabolic markers, bilirubin, ALP/GGT, symptoms, and repeat testing or clinical review when appropriate.',
    'liver',
    'high',
    true,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/liver-pattern'
  ),
  (
    'thyroid_axis_followup',
    'Review thyroid-axis markers',
    'TSH findings should be interpreted with free T4, free T3 when available, symptoms, medications, iodine exposure, pregnancy status, and repeat testing or clinician review.',
    'endocrine',
    'high',
    true,
    'guideline_placeholder',
    'clinical_guideline_placeholder',
    'https://example.org/thyroid-axis'
  );

update public.recommendations r
set
  title = src.title,
  body = src.body,
  category = src.category,
  priority = src.priority,
  requires_doctor = src.requires_doctor,
  evidence_level = src.evidence_level,
  source = src.source,
  source_url = src.source_url
from _stage20_recommendations src
where r.key = src.key;

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
select
  src.key,
  src.title,
  src.body,
  src.category,
  src.priority,
  src.requires_doctor,
  src.evidence_level,
  src.source,
  src.source_url
from _stage20_recommendations src
where not exists (
  select 1 from public.recommendations r where r.key = src.key
);

create temp table _stage20_entities (
  type text,
  key text,
  name text,
  description text
) on commit drop;

insert into _stage20_entities (type, key, name, description)
select 'lab_marker', lm.key, lm.display_name, lm.description
from public.lab_markers lm
where lm.key in (select key from _stage20_lab_markers)
union all
select 'condition', c.key, c.name, c.description
from public.conditions c
where c.key in (select key from _stage20_conditions)
union all
select 'recommendation', r.key, r.title, r.body
from public.recommendations r
where r.key in (select key from _stage20_recommendations);

update public.knowledge_entities ke
set
  type = src.type,
  name = src.name,
  description = src.description
from _stage20_entities src
where ke.key = src.key;

insert into public.knowledge_entities (type, key, name, description)
select src.type, src.key, src.name, src.description
from _stage20_entities src
where not exists (
  select 1 from public.knowledge_entities ke where ke.key = src.key
);

create temp table _stage20_rules (
  key text,
  name text,
  description text,
  input_entities jsonb,
  conditions jsonb,
  outputs jsonb,
  confidence numeric,
  severity text,
  requires_doctor boolean,
  explanation_template text,
  source text,
  source_url text,
  governance_status text,
  medical_reviewed_at timestamptz,
  change_note text,
  version text,
  active boolean
) on commit drop;

insert into _stage20_rules (
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
    'rule_low_ferritin_without_symptom',
    'Low ferritin',
    'Low ferritin may indicate reduced iron stores even when symptoms are not provided.',
    '["ferritin"]'::jsonb,
    '{"all":[{"lab_marker":"ferritin","operator":"lt","value":30,"unit":"ng/mL"}]}'::jsonb,
    '{"risk":"possible_low_iron_store_pattern","recommendation_keys":["iron_panel_context_review"],"summary":"Ferritin may indicate reduced iron stores and should be reviewed in clinical context."}'::jsonb,
    0.7,
    'moderate',
    false,
    'Ferritin value ({{ferritin_value}} {{ferritin_unit}}) may indicate reduced iron stores. Review alongside CBC, iron studies, CRP, symptoms, and clinical context.',
    'clinical_guideline_placeholder',
    'https://example.org/iron-context',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  ),
  (
    'rule_very_low_ferritin',
    'Very low ferritin',
    'Very low ferritin may indicate depleted iron stores and should be reviewed.',
    '["ferritin"]'::jsonb,
    '{"all":[{"lab_marker":"ferritin","operator":"lt","value":15,"unit":"ng/mL"}]}'::jsonb,
    '{"risk":"possible_low_iron_store_pattern","recommendation_keys":["very_low_ferritin_medical_review","iron_panel_context_review"],"summary":"Very low ferritin may indicate depleted iron stores and should be reviewed."}'::jsonb,
    0.78,
    'high',
    true,
    'Ferritin value ({{ferritin_value}} {{ferritin_unit}}) is very low and may indicate depleted iron stores. Discuss follow-up and possible causes with a clinician.',
    'clinical_guideline_placeholder',
    'https://example.org/ferritin-review',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  ),
  (
    'rule_elevated_fasting_glucose',
    'Elevated glucose',
    'Elevated glucose may indicate altered glucose regulation depending on fasting status.',
    '["glucose"]'::jsonb,
    '{"all":[{"lab_marker":"glucose","operator":"gte","value":100,"unit":"mg/dL"}]}'::jsonb,
    '{"risk":"possible_glucose_regulation_pattern","recommendation_keys":["glucose_regulation_followup"],"summary":"Glucose may indicate altered glucose regulation; interpret with fasting status and HbA1c."}'::jsonb,
    0.72,
    'moderate',
    true,
    'Glucose value ({{glucose_value}} {{glucose_unit}}) may indicate altered glucose regulation depending on fasting status. Review with HbA1c and clinical context.',
    'clinical_guideline_placeholder',
    'https://example.org/glucose-review',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  ),
  (
    'rule_hba1c_glucose_combined',
    'Elevated HbA1c with elevated glucose',
    'Elevated HbA1c plus elevated glucose strengthens the glucose regulation signal.',
    '["hba1c","glucose"]'::jsonb,
    '{"all":[{"lab_marker":"hba1c","operator":"gte","value":5.7,"unit":"%"},{"lab_marker":"glucose","operator":"gte","value":100,"unit":"mg/dL"}]}'::jsonb,
    '{"risk":"possible_glucose_regulation_pattern","recommendation_keys":["glucose_regulation_followup","hba1c_medical_review"],"summary":"HbA1c and glucose together may indicate altered glucose regulation and require review."}'::jsonb,
    0.86,
    'high',
    true,
    'HbA1c ({{hba1c_value}} {{hba1c_unit}}) with glucose ({{glucose_value}} {{glucose_unit}}) may indicate altered glucose regulation and requires medical review.',
    'clinical_guideline_placeholder',
    'https://example.org/glucose-review',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  ),
  (
    'rule_high_triglycerides',
    'High triglycerides',
    'High triglycerides may indicate cardiometabolic risk and should be interpreted with fasting status.',
    '["triglycerides"]'::jsonb,
    '{"all":[{"lab_marker":"triglycerides","operator":"gte","value":150,"unit":"mg/dL"}]}'::jsonb,
    '{"risk":"possible_atherogenic_lipid_pattern","recommendation_keys":["lipid_pattern_context_review"],"summary":"Triglycerides may indicate cardiometabolic risk; interpret with fasting status and other lipid markers."}'::jsonb,
    0.74,
    'moderate',
    true,
    'Triglycerides value ({{triglycerides_value}} {{triglycerides_unit}}) may indicate cardiometabolic risk. Review fasting status, glucose regulation, and lipid context.',
    'clinical_guideline_placeholder',
    'https://example.org/lipid-pattern',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  ),
  (
    'rule_low_hdl',
    'Low HDL',
    'Low HDL may contribute to cardiometabolic risk assessment.',
    '["hdl"]'::jsonb,
    '{"all":[{"lab_marker":"hdl","operator":"lt","value":40,"unit":"mg/dL"}]}'::jsonb,
    '{"risk":"possible_atherogenic_lipid_pattern","recommendation_keys":["lipid_pattern_context_review"],"summary":"Low HDL may contribute to cardiometabolic risk assessment."}'::jsonb,
    0.68,
    'moderate',
    false,
    'HDL value ({{hdl_value}} {{hdl_unit}}) may contribute to cardiometabolic risk assessment. Review with triglycerides, LDL, ApoB, and clinical context.',
    'clinical_guideline_placeholder',
    'https://example.org/lipid-pattern',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  ),
  (
    'rule_high_triglycerides_low_hdl',
    'High triglycerides with low HDL',
    'High triglycerides with low HDL may indicate a possible cardiometabolic risk pattern.',
    '["triglycerides","hdl"]'::jsonb,
    '{"all":[{"lab_marker":"triglycerides","operator":"gte","value":150,"unit":"mg/dL"},{"lab_marker":"hdl","operator":"lt","value":40,"unit":"mg/dL"}]}'::jsonb,
    '{"risk":"possible_atherogenic_lipid_pattern","recommendation_keys":["triglyceride_hdl_metabolic_review","lipid_pattern_context_review"],"summary":"High triglycerides with low HDL may indicate a possible cardiometabolic risk pattern."}'::jsonb,
    0.8,
    'high',
    true,
    'Triglycerides ({{triglycerides_value}} {{triglycerides_unit}}) with HDL ({{hdl_value}} {{hdl_unit}}) may indicate a cardiometabolic risk pattern. Review with a clinician.',
    'clinical_guideline_placeholder',
    'https://example.org/triglyceride-hdl',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  ),
  (
    'rule_very_low_vitamin_d',
    'Very low vitamin D',
    'Very low vitamin D may require more focused follow-up.',
    '["vitamin_d"]'::jsonb,
    '{"all":[{"lab_marker":"vitamin_d","operator":"lt","value":20,"unit":"ng/mL"}]}'::jsonb,
    '{"risk":"possible_severe_vitamin_d_insufficiency","recommendation_keys":["severe_vitamin_d_followup","vitamin_d_lifestyle_and_followup"],"summary":"Very low vitamin D may require focused follow-up and repeat testing."}'::jsonb,
    0.76,
    'high',
    false,
    'Vitamin D value ({{vitamin_d_value}} {{vitamin_d_unit}}) is very low and may require focused follow-up, context review, and repeat testing.',
    'clinical_guideline_placeholder',
    'https://example.org/vitamin-d-severe',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  ),
  (
    'rule_alt_ast_both_elevated',
    'ALT and AST both elevated',
    'ALT and AST together may indicate a stronger liver enzyme pattern than a single marker.',
    '["alt","ast"]'::jsonb,
    '{"all":[{"lab_marker":"alt","operator":"gt","value":55,"unit":"U/L"},{"lab_marker":"ast","operator":"gt","value":48,"unit":"U/L"}]}'::jsonb,
    '{"risk":"possible_liver_stress_pattern","recommendation_keys":["liver_pattern_context_review","liver_enzyme_medical_review"],"summary":"ALT and AST together may indicate liver enzyme elevation that requires context review."}'::jsonb,
    0.84,
    'high',
    true,
    'ALT ({{alt_value}} {{alt_unit}}) and AST ({{ast_value}} {{ast_unit}}) are both elevated and may indicate a liver enzyme pattern requiring clinician review.',
    'clinical_guideline_placeholder',
    'https://example.org/liver-pattern',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  ),
  (
    'rule_high_tsh',
    'High TSH',
    'High TSH may indicate a thyroid-axis pattern and should be interpreted with free T4 and symptoms.',
    '["tsh"]'::jsonb,
    '{"all":[{"lab_marker":"tsh","operator":"gte","value":4.5,"unit":"uIU/mL"}]}'::jsonb,
    '{"risk":"possible_thyroid_axis_pattern","recommendation_keys":["thyroid_axis_followup"],"summary":"High TSH may indicate a thyroid-axis pattern; interpret with free T4 and symptoms."}'::jsonb,
    0.76,
    'moderate',
    true,
    'TSH value ({{tsh_value}} {{tsh_unit}}) may indicate a thyroid-axis pattern. Review with free T4, symptoms, medication context, and a clinician.',
    'clinical_guideline_placeholder',
    'https://example.org/thyroid-axis',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  ),
  (
    'rule_low_tsh',
    'Low TSH',
    'Low TSH may indicate a thyroid-axis pattern and requires clinical context.',
    '["tsh"]'::jsonb,
    '{"all":[{"lab_marker":"tsh","operator":"lt","value":0.4,"unit":"uIU/mL"}]}'::jsonb,
    '{"risk":"possible_thyroid_axis_pattern","recommendation_keys":["thyroid_axis_followup"],"summary":"Low TSH may indicate a thyroid-axis pattern and requires clinical context."}'::jsonb,
    0.78,
    'high',
    true,
    'TSH value ({{tsh_value}} {{tsh_unit}}) is low and may indicate a thyroid-axis pattern. Discuss free T4/free T3, symptoms, medications, and clinical context.',
    'clinical_guideline_placeholder',
    'https://example.org/thyroid-axis',
    'active',
    now(),
    'stage_20_seed',
    'v1',
    true
  );

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
select
  src.key,
  src.name,
  src.description,
  src.input_entities,
  src.conditions,
  src.outputs,
  src.confidence,
  src.severity,
  src.requires_doctor,
  src.explanation_template,
  src.source,
  src.source_url,
  src.governance_status,
  src.medical_reviewed_at,
  src.change_note,
  src.version,
  src.active
from _stage20_rules src
where not exists (
  select 1 from public.knowledge_rules kr where kr.key = src.key
);

end $$;
