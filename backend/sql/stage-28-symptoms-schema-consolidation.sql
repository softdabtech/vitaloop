-- Stage 2H — schema & architecture consolidation.
-- Scope of this file: resolve the mixed-semantics `public.symptoms` table
-- ONLY. Do not execute against production without re-running the
-- precondition query immediately before and confirming the counts below
-- still hold (this migration is destructive to the dropped columns if any
-- row has since gained data in them).
--
-- FORENSIC TRACE (Stage 2H, verified against the LIVE schema via the
-- Supabase REST/PostgREST OpenAPI introspection endpoint and a live row
-- count — not from git history, which only shows the stage-18 half):
--
-- `public.symptoms` currently carries the union of two unrelated shapes:
--   1. A knowledge/catalog shape from sql/stage-18-knowledge-base-foundation.sql:
--        key text unique, name text, description text, severity_scale text,
--        metadata jsonb not null default '{}'::jsonb
--      Seeded once (line 306 of that file) but RLS-denied to anon/authenticated
--      (service-role only). Zero backend code anywhere reads `key`, `name`,
--      `description`, or `severity_scale` from this table (grepped
--      backend/app for `.table("symptoms")` — exactly 3 call sites, all in
--      app/services/supabase_service.py, none touching these columns).
--   2. A user-symptom-log shape that is NOT present in any tracked migration
--      file — it exists live only (schema drift): `user_id uuid not null
--      references users.id`, `upload_id uuid references lab_uploads.id`,
--      `tags text[] not null`, `severity smallint default 5`,
--      `created_at timestamptz default now()`. This is the shape
--      save_symptoms()/get_user_symptom_summary()/get_platform_symptom_summary()
--      (supabase_service.py) actually write/read, live-wired to
--      POST /symptoms, GET /symptoms/summary, GET /symptoms/summary/all
--      (app/routers/protocol/symptoms.py), consumed by ClientAdmin.jsx and by
--      Health Score's symptom component.
--
-- Live row count at time of this trace: 0 (both shapes). No data to lose, no
-- row semantics to guess, no discriminator needed — this is a pure schema
-- cleanup of dead/unused columns, not a data migration. No code changes are
-- required alongside this migration: existing readers/writers never
-- reference the dropped columns, so this file can be applied independently,
-- in either order relative to any deploy.
--
-- This migration intentionally does NOT: rename the table, touch RLS, or
-- change the `user_id`/`upload_id` FK behavior (both already enforced live,
-- confirmed via introspection, orphan count 0 for this table).
--
-- Stage 2H.1 additional review (before closing Stage 2H):
--   - Views/functions/triggers/RPCs: none reference public.symptoms at all
--     in tracked SQL (grepped every sql/*.sql for create view/function/
--     trigger near "symptoms"); confirmed live via the PostgREST OpenAPI
--     schema listing (only the base `symptoms` table and the unrelated
--     `symptom_assessments` table exist — no view, no RPC path containing
--     "symptom").
--   - Seed/bootstrap paths: grepped every backend script (scripts/*.py) and
--     the repo root for any `public.symptoms`/`"symptoms"` reference outside
--     app/services/supabase_service.py and this SQL file — none found; every
--     other "symptoms" hit in scripts is an unrelated request-payload field
--     (a list of symptom strings), not this table.
--   - Rollback cannot restore dropped catalog data if rows appear between
--     review and execution — this is why the DO block below aborts the
--     entire migration transaction if any row (catalog-shaped or not) is
--     found at the moment of execution, not relying on the count observed
--     during this review.

-- Stage 2H.1 review addendum: a manually-run precondition query is not
-- sufficient — a row can be inserted in the gap between checking and
-- applying. The DO block below re-checks INSIDE the same transaction,
-- immediately before the DDL, and ABORTS the whole migration (RAISE
-- EXCEPTION rolls back the transaction) if either check fails at execution
-- time, regardless of what was observed during review. This is not reliant
-- on today's observed count (0) — it is reliant on whatever is true at the
-- moment this file actually runs.

begin;

do $$
declare
  total_rows bigint;
  catalog_rows bigint;
begin
  select count(*) into total_rows from public.symptoms;
  select count(*) into catalog_rows from public.symptoms
    where key is not null or name is not null or description is not null
       or severity_scale is not null or metadata is distinct from '{}'::jsonb;

  if total_rows <> 0 then
    raise exception
      'stage-28 aborted: public.symptoms has % row(s) at execution time (expected 0) — '
      'this migration only drops columns proven unused at 0 rows; re-run the Stage 2H '
      'forensic trace before proceeding, do not simply re-run this file', total_rows;
  end if;

  if catalog_rows <> 0 then
    raise exception
      'stage-28 aborted: % row(s) in public.symptoms have catalog-shaped data '
      '(key/name/description/severity_scale/metadata populated) — dropping these '
      'columns would destroy that data and it is NOT recoverable via the rollback '
      'below, which only restores empty columns', catalog_rows;
  end if;
end $$;

alter table public.symptoms
  drop column if exists key,
  drop column if exists name,
  drop column if exists description,
  drop column if exists severity_scale,
  drop column if exists metadata;

drop index if exists public.idx_symptoms_key;

comment on table public.symptoms is
  'User-reported symptom log entries (user_id, upload_id, tags, severity, created_at). '
  'Stage 2H: this table previously also carried an unused knowledge/catalog shape '
  '(key/name/description/severity_scale/metadata) inherited from stage-18; those '
  'columns were dropped after confirming zero live rows and zero code consumers. '
  'This table is NOT a symptom knowledge catalog — see conditions/recommendations/'
  'knowledge_rules for that concept.';

commit;

-- POSTCONDITION (run after applying):
--   select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'symptoms' order by column_name;
--   -- Expected columns: created_at, id, severity, tags, upload_id, user_id
--   select count(*) from public.symptoms;
--   -- Expected: unchanged (0 at time of writing; whatever it is immediately
--   -- before running must equal this value after — no rows are touched)

-- ROLLBACK (reverses the column drop; catalog data itself is NOT
-- recoverable since it was empty at drop time — this only restores the
-- columns/index, not any pre-drop content, because there was none):
-- begin;
-- alter table public.symptoms
--   add column if not exists key text unique,
--   add column if not exists name text,
--   add column if not exists description text,
--   add column if not exists severity_scale text,
--   add column if not exists metadata jsonb not null default '{}'::jsonb;
-- create index if not exists idx_symptoms_key on public.symptoms(key);
-- comment on table public.symptoms is null;
-- commit;
