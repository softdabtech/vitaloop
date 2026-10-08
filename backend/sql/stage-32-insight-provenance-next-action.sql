-- Stage 32: persisted insight provenance and next action.
-- Additive only: existing insight rows remain readable with explicit unknown
-- provenance until they are regenerated.

alter table public.insights
  add column if not exists provenance jsonb,
  add column if not exists next_action jsonb;

comment on column public.insights.provenance is
  'Structured source context for why the insight exists; unknown is allowed when no source row is identifiable.';
comment on column public.insights.next_action is
  'One safe, concrete in-product action with a route and safety level.';