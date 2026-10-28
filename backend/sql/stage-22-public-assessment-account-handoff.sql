-- Stage 22: bind the main-site anonymous symptom-intake row to its owner
-- after authentication. The backend uses its service role and validates both
-- assessment id and anonymous session id before every update.

alter table public.symptom_assessments
  add column if not exists claimed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists claimed_at timestamptz;

create index if not exists idx_symptom_assessments_claimed_by_user
  on public.symptom_assessments(claimed_by_user_id, created_at desc)
  where claimed_by_user_id is not null;
