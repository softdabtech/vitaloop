-- Stage 22: consented, de-identified cohort avatars for Knowledge Base learning.
-- Raw identifiers and exact anthropometric values remain in user_profile and
-- are never exposed through the cohort view.

begin;

alter table if exists public.user_profile
  add column if not exists knowledge_learning_consent boolean not null default false;

comment on column public.user_profile.knowledge_learning_consent is
  'Explicit opt-in for de-identified cohort learning. Does not affect personalized analysis.';

create or replace view public.knowledge_cohort_observations
with (security_invoker = true)
as
select
  re.created_at,
  re.input_snapshot #>> '{context,person_avatar,age_band}' as age_band,
  re.input_snapshot #>> '{context,person_avatar,sex}' as sex,
  re.input_snapshot #>> '{context,person_avatar,bmi_band}' as bmi_band,
  coalesce(re.input_snapshot #> '{context,person_avatar,goals}', '[]'::jsonb) as goals,
  coalesce(re.input_snapshot -> 'symptoms', '[]'::jsonb) as symptoms,
  coalesce(re.input_snapshot -> 'lab_results', '{}'::jsonb) as lab_results,
  re.result
from public.rule_evaluations re
where coalesce(
  (re.input_snapshot #>> '{context,cohort_learning_allowed}')::boolean,
  false
);

revoke all on public.knowledge_cohort_observations from anon, authenticated;
grant select on public.knowledge_cohort_observations to service_role;

commit;
