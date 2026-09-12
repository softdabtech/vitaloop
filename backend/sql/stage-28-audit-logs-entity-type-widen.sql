-- VITALOOP Stage 28: widen audit_logs.entity_type / drop the legacy
-- action/entity_id constraints that no longer match how this table is used.
-- Safe to run multiple times.
--
-- Root cause (2026-09-12 investigation): stage-5-crm-tables.sql created
-- audit_logs as a narrow CRM-only table:
--   entity_type CHECK IN ('client','practitioner','program','subscription',
--                          'questionnaire','client_program','intervention')
--   entity_id UUID NOT NULL
-- write_audit_log() in supabase_service.py is now called platform-wide with
-- ~26 distinct entity_type values (onboarding_state, health_scores,
-- knowledge_output, lab_upload, questionnaire_session, user_profile, ...),
-- none of which satisfy that CHECK. Every one of those inserts throws a
-- Postgres constraint violation on the primary insert, falls through
-- write_audit_log's own 3-tier fallback to a "legacy" shape that forces
-- entity_type to 'client' and entity_id to a random uuid4() (since the real
-- entity_id is very often NOT a UUID either — e.g. a lab_upload id that IS a
-- uuid works, but "biomarkers"/"insights" entity_ids can be composite
-- strings) — collapsing ~26 real categories into one generic bucket and
-- discarding the real entity_id, which is most of why this table looked
-- like 138k near-identical "read/client" rows with no diagnostic value.
--
-- Fix: entity_type becomes free-form TEXT (still NOT NULL — every write
-- site already supplies one, and write_audit_log()'s own wrapper defaults
-- entity_id to uuid4() when the caller doesn't have one), matching how the
-- application code actually treats it (an arbitrary categorization string,
-- not a foreign-key-backed enum). entity_id becomes TEXT instead of UUID,
-- since real entity_ids are frequently composite strings, e.g.
-- f"{org_id}:{user_id}" or f"{session_id}:{question_id}" (see
-- crm.py/questionnaire.py) — never UUID-shaped, so the column type itself
-- was rejecting them before the value ever reached the entity_type check.
-- action's CHECK is left as-is (create/read/update/delete/assign/reassign
-- already covers every call site — see supabase_service.py's own
-- allowed_actions set).

alter table public.audit_logs
  drop constraint if exists audit_logs_entity_type_check;

alter table public.audit_logs
  alter column entity_id type text using entity_id::text;
