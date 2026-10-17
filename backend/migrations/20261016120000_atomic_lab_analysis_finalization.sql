-- C4.1B-02D-1C: atomic, idempotent finalization of a lab analysis.
-- Additive only. NOT applied to any environment by this change (no SQL has been executed).
--
-- One transaction (the function body): advisory lock on (user, operation_key) -> lock the
-- owner-scoped upload row -> replay lookup by operation key -> generation check (new
-- operations only) -> strict input/report validation -> replace biomarkers -> insert the
-- frozen report_versions row -> advance generation + mark upload done -> record operation.
-- Any error rolls back all of it.
--
-- Guarantees: idempotent OBSERVABLE result per (user_id, operation_key); NOT exactly-once
-- execution (KB/AI work happens before the call and may run twice). NOT atomic with retest
-- obligations, lab-plan fulfillment, safety events or the flat `protocols` row. Those stay
-- outside. This function atomically creates one durable follow-up row per effect for
-- the report version. A worker must claim and complete that row; append-only effects
-- still require their own unique(report_version_id, ...) / ON CONFLICT protection.
--
-- DATA CONTRACT
--   p_biomarkers  = persisted-biomarker projection: exactly the 10 biomarkers columns
--                   (name,value,unit,ref_low,ref_high,status,category,canonical_name,
--                   reference_source,unevaluated_reason); values are JSON numbers, 6-decimal
--                   exact (never rounded); names unique case-insensitively; statuses are the
--                   DB check values (nothing is fabricated).
--   p_report      = exactly {version,locale,status,input_snapshot,knowledge_report,protocol,
--                   safety_result,explainability}. input_snapshot is stored UNCHANGED; every
--                   projection row must match exactly one input_snapshot.biomarkers row.
--   input hash    = VLH1 digest (mirrored by app/services/analysis_input_digest.py) over
--                   (upload_id, locale, pipeline_version, projection). Consistency key only.
--   frozen evidence: explainability.frozen_protocol_evidence is REQUIRED and structurally
--                   verified here (schema, report id binding, key sets, hash shapes). The
--                   hash/rule verification and ALL clinical authorization stay in the trusted
--                   backend (protocol_pipeline_evidence.verify_persisted_frozen_evidence must
--                   pass BEFORE calling this RPC). The database never treats caller assertions
--                   as proof of clinical grounding.
--
-- RELEASE ORDER: backend integration calls this RPC only after this migration has been applied
-- and public.atomic_finalization_schema_preflight() has passed under service_role. The
-- operation key is server-derived from the authenticated principal, upload and request key;
-- it is persisted by this RPC. UNKNOWN/UNEVALUATED preserve their clinical reason, and a report
-- without recommendation-bearing rules carries the explicit non-authorizing frozen state.
--
-- ROLLBACK LIMIT: before any report is finalized, an operator may use an individually reviewed
-- down migration in a controlled environment. After report data or downstream effects exist,
-- rollback is forward repair or backup/PITR restore; this additive migration has no executable
-- down migration and must never be reversed by an incomplete ad-hoc DROP list.

-- Dedicated NOLOGIN function owner (created only if absent; no login, no superuser).
-- IMPORTANT: The migration runner (current_user) MUST already have vitaloop_finalizer
-- membership, provisioned by the operator. The migration does NOT auto-grant or auto-revoke.
-- See: tests/db/provision_cluster_roles.sql (operator manual script).
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'vitaloop_finalizer') then
    create role vitaloop_finalizer nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end $$;

alter table public.lab_uploads
  add column if not exists analysis_generation bigint not null default 0;

ALTER TABLE public.biomarkers
  ALTER COLUMN value TYPE numeric(18,6),
  ALTER COLUMN ref_low TYPE numeric(18,6),
  ALTER COLUMN ref_high TYPE numeric(18,6);

ALTER TABLE public.biomarkers
  DROP CONSTRAINT IF EXISTS biomarkers_status_check,
  ADD CONSTRAINT biomarkers_status_check CHECK (status IN ('OPTIMAL','BORDERLINE','DEFICIENT','ELEVATED','UNKNOWN','UNEVALUATED'));

create unique index if not exists uq_lab_uploads_id_user on public.lab_uploads(id, user_id);
create unique index if not exists uq_report_versions_id_user_upload on public.report_versions(id, user_id, upload_id);

create table if not exists public.analysis_operations (
  user_id uuid not null,
  operation_key uuid not null,
  upload_id uuid not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  report_version_id uuid not null,
  generation_before bigint not null,
  generation_after bigint not null check (generation_after = generation_before + 1),
  created_at timestamptz not null default now(),
  primary key (user_id, operation_key),
  unique (report_version_id),
  foreign key (upload_id, user_id) references public.lab_uploads(id, user_id) on delete cascade,
  foreign key (report_version_id, user_id, upload_id)
    references public.report_versions(id, user_id, upload_id) on delete restrict
);
create index if not exists idx_analysis_operations_upload on public.analysis_operations(upload_id);

alter table public.analysis_operations enable row level security;

-- Work is deliberately recorded with the immutable report version in the same
-- transaction as the report. It is a recovery ledger, not a claim that an effect
-- was executed exactly once. The writer for an append-only effect needs a matching
-- database uniqueness constraint before it may be retried after a worker crash.
create table if not exists public.analysis_followup_work (
  user_id uuid not null,
  upload_id uuid not null,
  report_version_id uuid not null,
  effect_type text not null check (effect_type in (
    'retest_obligations', 'retest_fulfillment', 'lab_plan_fulfillment',
    'safety_events', 'intelligence_artifacts', 'protocol', 'timeline', 'audit'
  )),
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'completed', 'failed', 'retryable'
  )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  -- Immutable per-effect input. Recovery never consults a regenerated
  -- pipeline result, mutable KB row, or caller-supplied context.
  work_payload jsonb not null,
  work_payload_hash text not null check (work_payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (report_version_id, effect_type),
  foreign key (report_version_id, user_id, upload_id)
    references public.report_versions(id, user_id, upload_id) on delete cascade
);
create index if not exists idx_analysis_followup_work_pending
  on public.analysis_followup_work(user_id, status, created_at);
alter table public.analysis_followup_work enable row level security;

-- Every append-only downstream row gets a nullable, immutable effect identity.
-- NULL preserves all historical rows exactly as they are; new analysis effects use
-- a SHA-256 key derived from (report_version_id, effect type, deterministic sub-key).
-- A normal unique index permits many historical NULLs while enforcing retries.
alter table public.intervention_events add column if not exists analysis_effect_key text;
alter table public.safety_events add column if not exists analysis_effect_key text;
alter table public.analysis_quality_gates add column if not exists analysis_effect_key text;
alter table public.clinical_data_integrity_events add column if not exists analysis_effect_key text;
alter table public.evidence_gaps add column if not exists analysis_effect_key text;
alter table public.health_state_versions add column if not exists analysis_effect_key text;
alter table public.protocols add column if not exists analysis_effect_key text;
alter table public.protocols add column if not exists source_report_version_id uuid;
alter table public.protocols add column if not exists source_analysis_generation bigint;
alter table public.timeline_events add column if not exists analysis_effect_key text;
alter table public.audit_logs add column if not exists analysis_effect_key text;

create unique index if not exists uq_intervention_events_effect_key on public.intervention_events(analysis_effect_key);
create unique index if not exists uq_safety_events_effect_key on public.safety_events(analysis_effect_key);
create unique index if not exists uq_analysis_quality_gates_effect_key on public.analysis_quality_gates(analysis_effect_key);
create unique index if not exists uq_clinical_data_integrity_effect_key on public.clinical_data_integrity_events(analysis_effect_key);
create unique index if not exists uq_evidence_gaps_effect_key on public.evidence_gaps(analysis_effect_key);
create unique index if not exists uq_health_state_versions_effect_key on public.health_state_versions(analysis_effect_key);
create unique index if not exists uq_protocols_effect_key on public.protocols(analysis_effect_key);
create unique index if not exists uq_timeline_events_effect_key on public.timeline_events(analysis_effect_key);
create unique index if not exists uq_audit_logs_effect_key on public.audit_logs(analysis_effect_key);

-- Minimal table privileges for the function owner. RLS applies to a non-owner definer,
-- so explicit role-scoped policies are required (no BYPASSRLS grant).
grant usage on schema public to vitaloop_finalizer;
grant select, insert, delete on public.biomarkers to vitaloop_finalizer;
grant select on public.lab_uploads to vitaloop_finalizer;
grant update (status, analysis_generation) on public.lab_uploads to vitaloop_finalizer;
grant select, insert on public.report_versions to vitaloop_finalizer;
grant select, insert on public.analysis_operations to vitaloop_finalizer;
grant select, insert, update on public.analysis_followup_work to vitaloop_finalizer;
grant select, insert, update on public.protocols to vitaloop_finalizer;
grant select, update on public.analysis_followup_work to service_role;

drop policy if exists vitaloop_finalizer_biomarkers on public.biomarkers;
create policy vitaloop_finalizer_biomarkers on public.biomarkers to vitaloop_finalizer using (true) with check (true);
drop policy if exists vitaloop_finalizer_lab_uploads on public.lab_uploads;
create policy vitaloop_finalizer_lab_uploads on public.lab_uploads to vitaloop_finalizer using (true) with check (true);
drop policy if exists vitaloop_finalizer_report_versions on public.report_versions;
create policy vitaloop_finalizer_report_versions on public.report_versions to vitaloop_finalizer using (true) with check (true);
drop policy if exists vitaloop_finalizer_analysis_operations on public.analysis_operations;
create policy vitaloop_finalizer_analysis_operations on public.analysis_operations to vitaloop_finalizer using (true) with check (true);
drop policy if exists vitaloop_finalizer_analysis_followup_work on public.analysis_followup_work;
create policy vitaloop_finalizer_analysis_followup_work on public.analysis_followup_work to vitaloop_finalizer using (true) with check (true);
drop policy if exists vitaloop_finalizer_protocols on public.protocols;
create policy vitaloop_finalizer_protocols on public.protocols to vitaloop_finalizer using (true) with check (true);
drop policy if exists service_role_analysis_followup_work on public.analysis_followup_work;
create policy service_role_analysis_followup_work on public.analysis_followup_work to service_role using (true) with check (true);

-- ---------------------------------------------------------------- helpers
create or replace function public.lab_analysis_enc(p text) returns text
language sql immutable set search_path = pg_catalog, public
as $$ select case when p is null then 'N;' else 'S' || pg_catalog.char_length(p)::text || ':' || p || ';' end $$;

-- Canonical numeric text: JSON number only, exactly 6 decimals, never silently rounded.
create or replace function public.lab_analysis_canon_numeric(p_value jsonb) returns text
language plpgsql immutable set search_path = pg_catalog, public
as $$
declare v numeric;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) = 'null' then
    return null;
  end if;
  if pg_catalog.jsonb_typeof(p_value) <> 'number' then
    raise exception 'numeric_type' using errcode = 'VL422';
  end if;
  v := (p_value #>> '{}')::numeric;
  if pg_catalog.abs(v) >= 1000000000 then
    raise exception 'numeric_out_of_range' using errcode = 'VL422';
  end if;
  if v <> pg_catalog.round(v, 6) then
    raise exception 'numeric_precision_loss' using errcode = 'VL422';
  end if;
  if v = 0 then v := 0; end if;
  -- `0` is required before the decimal point: `FM...9.000000` formats zero as `.000000`.
  return to_char(pg_catalog.round(v, 6), 'FM9999999990.000000');
end;
$$;

create or replace function public.lab_analysis_num_eq(a jsonb, b jsonb) returns boolean
language plpgsql immutable set search_path = pg_catalog, public
as $$
begin
  if (a is null or pg_catalog.jsonb_typeof(a) = 'null') and (b is null or pg_catalog.jsonb_typeof(b) = 'null') then
    return true;
  end if;
  if a is null or b is null or pg_catalog.jsonb_typeof(a) <> 'number' or pg_catalog.jsonb_typeof(b) <> 'number' then
    return false;
  end if;
  return (a #>> '{}')::numeric = (b #>> '{}')::numeric;
end;
$$;

-- Strict projection validation: exact 10 fields, types, non-empty required text,
-- case-insensitively unique names (matches uq_biomarkers_upload_name).
create or replace function public.lab_analysis_validate_projection(p_rows jsonb) returns void
language plpgsql immutable set search_path = pg_catalog, public
as $$
declare
  el jsonb;
  f text;
begin
  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception 'projection_not_array' using errcode = 'VL422';
  end if;
  for el in select e from pg_catalog.jsonb_array_elements(p_rows) e loop
    if pg_catalog.jsonb_typeof(el) <> 'object'
       or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(el)) <> 10
       or not (el ?& array['name','value','unit','ref_low','ref_high','status','category',
                           'canonical_name','reference_source','unevaluated_reason']) then
      raise exception 'projection_fields' using errcode = 'VL422';
    end if;
    foreach f in array array['name','unit','status'] loop
      if pg_catalog.jsonb_typeof(el -> f) <> 'string' or pg_catalog.char_length(el ->> f) = 0 then
        raise exception 'projection_field_type' using errcode = 'VL422';
      end if;
    end loop;
    foreach f in array array['category','canonical_name','reference_source','unevaluated_reason'] loop
      if pg_catalog.jsonb_typeof(el -> f) not in ('string', 'null') then
        raise exception 'projection_field_type' using errcode = 'VL422';
      end if;
    end loop;
    if pg_catalog.jsonb_typeof(el -> 'value') <> 'number'
       or pg_catalog.jsonb_typeof(el -> 'ref_low') not in ('number', 'null')
       or pg_catalog.jsonb_typeof(el -> 'ref_high') not in ('number', 'null') then
      raise exception 'projection_field_type' using errcode = 'VL422';
    end if;
  end loop;

  if (select pg_catalog.count(distinct pg_catalog.lower(e ->> 'name')) from pg_catalog.jsonb_array_elements(p_rows) e)
     <> pg_catalog.jsonb_array_length(p_rows) then
    raise exception 'projection_duplicate_name' using errcode = 'VL422';
  end if;
end;
$$;

-- VLH1 digest. enc(NULL)='N;', enc(text)='S'||char_length||':'||text||';'
--   header = 'VLH1;' enc(upload_id) enc(locale) enc(pipeline_version) 'R'||count||';'
--   row    = enc(name) enc(canon value) enc(unit) enc(canon ref_low) enc(canon ref_high)
--            enc(status) enc(category) enc(canonical_name) enc(reference_source) enc(unevaluated_reason)
--   rows sorted by name in "C" collation; digest = lower hex sha256 of the UTF-8 bytes.
create or replace function public.lab_analysis_input_digest(
  p_upload_id uuid, p_locale text, p_pipeline_version text, p_rows jsonb
) returns text
language plpgsql immutable set search_path = pg_catalog, public
as $$
declare body text;
begin
  perform public.lab_analysis_validate_projection(p_rows);
  select coalesce(pg_catalog.string_agg(row_text, '' order by name_key collate "C"), '')
  into body
  from (
    select e ->> 'name' as name_key,
      public.lab_analysis_enc(e ->> 'name')
      || public.lab_analysis_enc(public.lab_analysis_canon_numeric(e -> 'value'))
      || public.lab_analysis_enc(e ->> 'unit')
      || public.lab_analysis_enc(public.lab_analysis_canon_numeric(e -> 'ref_low'))
      || public.lab_analysis_enc(public.lab_analysis_canon_numeric(e -> 'ref_high'))
      || public.lab_analysis_enc(e ->> 'status')
      || public.lab_analysis_enc(e ->> 'category')
      || public.lab_analysis_enc(e ->> 'canonical_name')
      || public.lab_analysis_enc(e ->> 'reference_source')
      || public.lab_analysis_enc(e ->> 'unevaluated_reason') as row_text
    from pg_catalog.jsonb_array_elements(p_rows) e
  ) q;
  body := 'VLH1;' || public.lab_analysis_enc(p_upload_id::text)
    || public.lab_analysis_enc(coalesce(p_locale, ''))
    || public.lab_analysis_enc(coalesce(p_pipeline_version, ''))
    || 'R' || pg_catalog.jsonb_array_length(p_rows)::text || ';' || body;
  return pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(body, 'UTF8')), 'hex');
end;
$$;

-- Structural report validation + frozen evidence shape/binding. Clinical authorization and
-- hash verification are NOT done here (trusted backend).
create or replace function public.lab_analysis_validate_report(
  p_report jsonb, p_report_version_id uuid, p_locale text, p_rows jsonb
) returns void
language plpgsql immutable set search_path = pg_catalog, public
as $$
declare
  fe jsonb;
  snap jsonb;
  el jsonb;
  matches int;
begin
  if p_report is null or pg_catalog.jsonb_typeof(p_report) <> 'object'
     or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_report)) <> 8
     or not (p_report ?& array['version','locale','status','input_snapshot','knowledge_report',
                               'protocol','safety_result','explainability']) then
    raise exception 'report_fields' using errcode = 'VL422';
  end if;
  if pg_catalog.jsonb_typeof(p_report -> 'version') <> 'string' or p_report ->> 'version' = ''
     or p_report ->> 'locale' is distinct from p_locale
     or p_report ->> 'status' not in ('completed', 'blocked')
     or pg_catalog.jsonb_typeof(p_report -> 'input_snapshot') <> 'object'
     or pg_catalog.jsonb_typeof(p_report -> 'knowledge_report') <> 'object'
     or pg_catalog.jsonb_typeof(p_report -> 'protocol') not in ('object', 'array')
     or pg_catalog.jsonb_typeof(p_report -> 'safety_result') <> 'object'
     or pg_catalog.jsonb_typeof(p_report -> 'explainability') <> 'object' then
    raise exception 'report_field_type' using errcode = 'VL422';
  end if;

  -- Projection <-> full snapshot: every projected row matches exactly one snapshot row.
  if pg_catalog.jsonb_typeof(p_report -> 'input_snapshot' -> 'biomarkers') <> 'array' then
    raise exception 'report_snapshot_biomarkers' using errcode = 'VL422';
  end if;
  for el in select e from pg_catalog.jsonb_array_elements(p_rows) e loop
    select pg_catalog.count(*) into matches
    from pg_catalog.jsonb_array_elements(p_report -> 'input_snapshot' -> 'biomarkers') s
    where pg_catalog.jsonb_typeof(s) = 'object'
      and s ->> 'name' = el ->> 'name'
      and public.lab_analysis_num_eq(s -> 'value', el -> 'value')
      and s ->> 'unit' = el ->> 'unit'
      and public.lab_analysis_num_eq(s -> 'ref_low', el -> 'ref_low')
      and public.lab_analysis_num_eq(s -> 'ref_high', el -> 'ref_high')
      and s ->> 'status' = el ->> 'status'
      and (s ->> 'category') is not distinct from (el ->> 'category')
      and (s ->> 'canonical_name') is not distinct from (el ->> 'canonical_name')
      and (s ->> 'reference_source') is not distinct from (el ->> 'reference_source')
      and (s ->> 'unevaluated_reason') is not distinct from (el ->> 'unevaluated_reason');
    if matches <> 1 then
      raise exception 'report_snapshot_mismatch' using errcode = 'VL422';
    end if;
  end loop;

  -- The upload-scoped protocols projection is frozen beside the historical
  -- sectioned protocol. It is never rebuilt from a later KB/AI run.
  if pg_catalog.jsonb_typeof(p_report -> 'input_snapshot' -> 'protocol_projection') <> 'array' then
    raise exception 'report_protocol_projection_missing' using errcode = 'VL422';
  end if;

  fe := p_report -> 'explainability' -> 'frozen_protocol_evidence';
  if fe is null or pg_catalog.jsonb_typeof(fe) <> 'object' then
    raise exception 'frozen_evidence_missing' using errcode = 'VL422';
  end if;
  -- Explicit non-authorizing state (valid report, no recommendation-bearing rules):
  -- input binding only, no entries/evidence; it can never ground an action.
  if fe ->> 'schema' = 'protocol_frozen_evidence_nonauthorizing_v1' then
    if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(fe)) <> 4
       or not (fe ?& array['schema','report_version_id','reason','input_context_hash'])
       or fe ->> 'report_version_id' is distinct from p_report_version_id::text
       or fe ->> 'reason' is distinct from 'no_action_authorizing_rules'
       or pg_catalog.jsonb_typeof(fe -> 'input_context_hash') <> 'string'
       or fe ->> 'input_context_hash' !~ '^[0-9a-f]{64}$' then
      raise exception 'frozen_evidence_malformed' using errcode = 'VL422';
    end if;
    return;
  end if;
  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(fe)) <> 3
     or not (fe ?& array['schema','report_version_id','snapshot'])
     or fe ->> 'schema' is distinct from 'protocol_frozen_evidence_v1'
     or fe ->> 'report_version_id' is distinct from p_report_version_id::text then
    raise exception 'frozen_evidence_malformed' using errcode = 'VL422';
  end if;
  snap := fe -> 'snapshot';
  if pg_catalog.jsonb_typeof(snap) <> 'object'
     or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(snap)) <> 5
     or not (snap ?& array['schema','report_version_id','input_context_hash','entries','integrity_hash'])
     or snap ->> 'schema' is distinct from 'protocol_action_evidence_snapshot_v1'
     or snap ->> 'report_version_id' is distinct from p_report_version_id::text
     or pg_catalog.jsonb_typeof(snap -> 'input_context_hash') <> 'string'
     or snap ->> 'input_context_hash' !~ '^[0-9a-f]{64}$'
     or pg_catalog.jsonb_typeof(snap -> 'integrity_hash') <> 'string'
     or snap ->> 'integrity_hash' !~ '^[0-9a-f]{64}$'
     or pg_catalog.jsonb_typeof(snap -> 'entries') <> 'array'
     or pg_catalog.jsonb_array_length(snap -> 'entries') = 0 then
    raise exception 'frozen_evidence_malformed' using errcode = 'VL422';
  end if;
end;
$$;

-- jsonb has a canonical textual representation, so this hash detects any
-- stored-payload change without accepting a caller-provided digest.
create or replace function public.lab_analysis_recovery_payload_hash(p_payload jsonb) returns text
language sql immutable set search_path = pg_catalog, public
as $$ select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload::text, 'UTF8')), 'hex') $$;

-- ---------------------------------------------------------------- the RPC
create or replace function public.finalize_lab_analysis(
  p_user_id uuid, p_upload_id uuid, p_operation_key uuid, p_input_hash text,
  p_base_generation bigint, p_report_version_id uuid, p_locale text, p_pipeline_version text,
  p_biomarkers jsonb, p_report jsonb
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  cur_gen bigint;
  op public.analysis_operations%rowtype;
  new_gen bigint;
begin
  if p_user_id is null or p_upload_id is null or p_operation_key is null
     or p_report_version_id is null or p_base_generation is null or p_input_hash is null
     or p_locale is null or p_pipeline_version is null then
    raise exception 'invalid_arguments' using errcode = 'VL422';
  end if;

  -- 0. Serialize on the operation identity first (covers the same key used on different uploads).
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('vl:op:' || p_user_id::text || ':' || p_operation_key::text, 0));

  -- 1. Lock the owner-scoped upload row (serializes every operation on this upload).
  select u.analysis_generation into cur_gen
  from public.lab_uploads u
  where u.id = p_upload_id and u.user_id = p_user_id
  for update;
  if not found then
    raise exception 'upload_not_found' using errcode = 'VL404';
  end if;

  -- 2. Replay lookup FIRST, before any generation check or validation.
  select * into op from public.analysis_operations o
  where o.user_id = p_user_id and o.operation_key = p_operation_key;
  if found then
    if op.upload_id = p_upload_id and op.input_hash = p_input_hash then
      return pg_catalog.jsonb_build_object('status', 'committed', 'replay', true,
        'report_version_id', op.report_version_id, 'generation', op.generation_after);
    end if;
    raise exception 'idempotency_conflict' using errcode = 'VL409';
  end if;

  -- 3. New operation only: stale writers are rejected without writes.
  if cur_gen <> p_base_generation then
    raise exception 'stale_operation' using errcode = 'VL409';
  end if;

  -- 4. Strict input validation (hash recomputed here; never trusted as supplied).
  perform public.lab_analysis_validate_projection(p_biomarkers);
  if pg_catalog.jsonb_array_length(p_biomarkers) = 0 then
    raise exception 'empty_biomarkers' using errcode = 'VL422';
  end if;
  if public.lab_analysis_input_digest(p_upload_id, p_locale, p_pipeline_version, p_biomarkers)
     is distinct from p_input_hash then
    raise exception 'input_hash_mismatch' using errcode = 'VL422';
  end if;
  perform public.lab_analysis_validate_report(p_report, p_report_version_id, p_locale, p_biomarkers);

  -- 5. Atomic replacement.
  delete from public.biomarkers b where b.upload_id = p_upload_id and b.user_id = p_user_id;
  insert into public.biomarkers
    (upload_id, user_id, name, value, unit, ref_low, ref_high, status, category,
     canonical_name, reference_source, unevaluated_reason)
  select p_upload_id, p_user_id, r.name, r.value, r.unit, r.ref_low, r.ref_high, r.status, r.category,
         r.canonical_name, r.reference_source, r.unevaluated_reason
  from pg_catalog.jsonb_to_recordset(p_biomarkers) as r(
    name text, value numeric(18,6), unit text, ref_low numeric(18,6), ref_high numeric(18,6),
    status text, category text, canonical_name text, reference_source text, unevaluated_reason text);

  -- 6. Frozen report: plain insert (duplicate id fails and rolls back; never overwrites).
  insert into public.report_versions
    (id, user_id, upload_id, version, locale, input_snapshot, knowledge_report, protocol,
     safety_result, explainability, status)
  values (p_report_version_id, p_user_id, p_upload_id, p_report ->> 'version', p_locale,
          p_report -> 'input_snapshot', p_report -> 'knowledge_report', p_report -> 'protocol',
          p_report -> 'safety_result', p_report -> 'explainability', p_report ->> 'status');

  -- 7. Advance generation, mark done, record the operation.
  new_gen := cur_gen + 1;
  update public.lab_uploads set analysis_generation = new_gen, status = 'done'
  where id = p_upload_id and user_id = p_user_id;
  insert into public.analysis_operations
    (user_id, operation_key, upload_id, input_hash, report_version_id, generation_before, generation_after)
  values (p_user_id, p_operation_key, p_upload_id, p_input_hash, p_report_version_id, cur_gen, new_gen);

  -- 8. Durable recovery foundation. Each payload is frozen in this same
  -- transaction; recovery never observes this request's regenerated output.
  insert into public.analysis_followup_work
    (user_id, upload_id, report_version_id, effect_type, status, work_payload, work_payload_hash)
  select p_user_id, p_upload_id, p_report_version_id, effect_type, 'pending', payload,
         public.lab_analysis_recovery_payload_hash(payload)
  from (
    select effect_type,
      pg_catalog.jsonb_build_object(
        'schema', 'analysis_recovery_work_payload_v1',
        'report_version_id', p_report_version_id::text,
        'user_id', p_user_id::text,
        'upload_id', p_upload_id::text,
        'effect_type', effect_type,
        'input_hash', p_input_hash,
        'data', case effect_type
          when 'retest_obligations' then pg_catalog.jsonb_build_object(
            'retest_plan', coalesce(p_report -> 'knowledge_report' -> 'retest_plan', '[]'::jsonb))
          when 'retest_fulfillment' then pg_catalog.jsonb_build_object(
            'biomarkers', p_biomarkers,
            'source_metadata', coalesce(p_report -> 'input_snapshot' -> 'source', '{}'::jsonb))
          when 'lab_plan_fulfillment' then pg_catalog.jsonb_build_object('biomarkers', p_biomarkers)
          when 'safety_events' then pg_catalog.jsonb_build_object(
            'safety_events', coalesce(p_report -> 'safety_result' -> 'safety_events', '[]'::jsonb))
          when 'intelligence_artifacts' then pg_catalog.jsonb_build_object(
            'analysis_input_quality_gate', p_report -> 'input_snapshot' -> 'analysis_input_quality_gate',
            'clinical_data_integrity', p_report -> 'input_snapshot' -> 'clinical_data_integrity',
            'evidence_gaps', p_report -> 'input_snapshot' -> 'evidence_gaps',
            'health_states', p_report -> 'input_snapshot' -> 'health_states')
          when 'protocol' then pg_catalog.jsonb_build_object(
            'historical_protocol', p_report -> 'protocol',
            'projection', p_report -> 'input_snapshot' -> 'protocol_projection')
          when 'timeline' then pg_catalog.jsonb_build_object(
            'event_type', 'lab_analyzed',
            'summary', 'Lab report analyzed',
            'metadata', pg_catalog.jsonb_build_object(
              'upload_id', p_upload_id::text,
              'report_version_id', p_report_version_id::text,
              'biomarker_count', pg_catalog.jsonb_array_length(p_biomarkers)))
          when 'audit' then pg_catalog.jsonb_build_object(
            'action', 'create', 'entity_type', 'report_version',
            'entity_id', p_report_version_id::text,
            'new_value', pg_catalog.jsonb_build_object('upload_id', p_upload_id::text,
                                                        'biomarker_count', pg_catalog.jsonb_array_length(p_biomarkers)))
        end
      ) as payload
    from pg_catalog.unnest(array[
      'retest_obligations', 'retest_fulfillment', 'lab_plan_fulfillment',
      'safety_events', 'intelligence_artifacts', 'protocol', 'timeline', 'audit'
    ]::text[]) as effect_type
  ) frozen_work;

  return pg_catalog.jsonb_build_object('status', 'committed', 'replay', false,
    'report_version_id', p_report_version_id, 'generation', new_gen);
end;
$$;

-- ---------------------------------------------------------------- recovery ledger lifecycle
-- A claim is serialised on its one (report_version_id, effect_type) row. A
-- completed effect is never claimable again; a crashed worker becomes
-- recoverable only after its short lease expires. This is deliberately not an
-- exactly-once substitute for append-only writers: those writers must add an
-- effect-specific uniqueness constraint before the recovery worker is enabled.
create or replace function public.claim_analysis_followup_work(
  p_user_id uuid, p_report_version_id uuid, p_effect_type text, p_lease_token uuid
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare work public.analysis_followup_work%rowtype;
begin
  if p_user_id is null or p_report_version_id is null or p_lease_token is null
     or p_effect_type is null or p_effect_type not in (
       'retest_obligations', 'retest_fulfillment', 'lab_plan_fulfillment',
       'safety_events', 'intelligence_artifacts', 'protocol', 'timeline', 'audit'
     ) then
    raise exception 'invalid_followup_claim' using errcode = 'VL422';
  end if;
  select * into work from public.analysis_followup_work
  where user_id = p_user_id and report_version_id = p_report_version_id and effect_type = p_effect_type
  for update;
  if not found then
    raise exception 'followup_work_not_found' using errcode = 'VL404';
  end if;
  if work.status = 'completed' then
    return pg_catalog.jsonb_build_object('claimed', false, 'status', 'completed', 'attempt_count', work.attempt_count);
  end if;
  if work.status = 'failed' then
    return pg_catalog.jsonb_build_object('claimed', false, 'status', 'failed', 'attempt_count', work.attempt_count);
  end if;
  if work.attempt_count >= 5 then
    update public.analysis_followup_work
    set status = 'failed', lease_token = null, lease_expires_at = null,
        last_error_code = 'retry_limit_reached', updated_at = pg_catalog.clock_timestamp()
    where report_version_id = p_report_version_id and effect_type = p_effect_type;
    return pg_catalog.jsonb_build_object('claimed', false, 'status', 'failed', 'attempt_count', work.attempt_count);
  end if;
  if work.status = 'processing' and work.lease_expires_at is not null
     and work.lease_expires_at > pg_catalog.clock_timestamp() then
    return pg_catalog.jsonb_build_object('claimed', false, 'status', 'processing', 'attempt_count', work.attempt_count);
  end if;
  update public.analysis_followup_work
  set status = 'processing', attempt_count = attempt_count + 1, lease_token = p_lease_token,
      lease_expires_at = pg_catalog.clock_timestamp() + interval '5 minutes',
      updated_at = pg_catalog.clock_timestamp(), last_error_code = null
  where report_version_id = p_report_version_id and effect_type = p_effect_type;
  return pg_catalog.jsonb_build_object('claimed', true, 'status', 'processing', 'attempt_count', work.attempt_count + 1);
end;
$$;

create or replace function public.complete_analysis_followup_work(
  p_user_id uuid, p_report_version_id uuid, p_effect_type text, p_lease_token uuid,
  p_status text, p_error_code text default null
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare work public.analysis_followup_work%rowtype;
begin
  if p_user_id is null or p_report_version_id is null or p_lease_token is null
     or p_effect_type is null or p_status not in ('completed', 'failed', 'retryable') then
    raise exception 'invalid_followup_completion' using errcode = 'VL422';
  end if;
  select * into work from public.analysis_followup_work
  where user_id = p_user_id and report_version_id = p_report_version_id and effect_type = p_effect_type
  for update;
  if not found then
    raise exception 'followup_work_not_found' using errcode = 'VL404';
  end if;
  if work.status <> 'processing' or work.lease_token is distinct from p_lease_token
     or work.lease_expires_at is null or work.lease_expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'followup_work_lease_conflict' using errcode = 'VL409';
  end if;
  update public.analysis_followup_work
  set status = p_status, lease_token = null, lease_expires_at = null,
      last_error_code = case when p_status = 'completed' then null else left(coalesce(p_error_code, 'followup_failed'), 120) end,
      completed_at = case when p_status = 'completed' then pg_catalog.clock_timestamp() else null end,
      updated_at = pg_catalog.clock_timestamp()
  where report_version_id = p_report_version_id and effect_type = p_effect_type;
  return pg_catalog.jsonb_build_object('completed', p_status = 'completed', 'status', p_status);
end;
$$;

-- Return only an owner-scoped, hash-verified recovery payload. This is the
-- recovery read boundary; consumers must not use a caller-provided equivalent.
create or replace function public.load_analysis_followup_work_payload(
  p_user_id uuid, p_report_version_id uuid, p_effect_type text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare work public.analysis_followup_work%rowtype;
declare operation_input_hash text;
begin
  if p_user_id is null or p_report_version_id is null
     or p_effect_type not in ('retest_obligations', 'retest_fulfillment', 'lab_plan_fulfillment',
                              'safety_events', 'intelligence_artifacts', 'protocol', 'timeline', 'audit') then
    raise exception 'invalid_followup_payload_request' using errcode = 'VL422';
  end if;
  select * into work from public.analysis_followup_work
  where user_id = p_user_id and report_version_id = p_report_version_id and effect_type = p_effect_type;
  if not found then
    raise exception 'followup_work_not_found' using errcode = 'VL404';
  end if;
  select o.input_hash into operation_input_hash
  from public.analysis_operations o
  where o.user_id = work.user_id
    and o.upload_id = work.upload_id
    and o.report_version_id = work.report_version_id;
  if not found then
    raise exception 'followup_payload_operation_missing' using errcode = 'VL422';
  end if;
  if pg_catalog.jsonb_typeof(work.work_payload) <> 'object'
     or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(work.work_payload)) <> 7
     or not (work.work_payload ?& array['schema','report_version_id','user_id','upload_id','effect_type','input_hash','data'])
     or work.work_payload ->> 'schema' is distinct from 'analysis_recovery_work_payload_v1'
     or work.work_payload ->> 'report_version_id' is distinct from work.report_version_id::text
     or work.work_payload ->> 'user_id' is distinct from work.user_id::text
     or work.work_payload ->> 'upload_id' is distinct from work.upload_id::text
     or work.work_payload ->> 'effect_type' is distinct from work.effect_type
     or work.work_payload ->> 'input_hash' is distinct from operation_input_hash
     or pg_catalog.jsonb_typeof(work.work_payload -> 'data') <> 'object'
     or work.work_payload_hash is distinct from public.lab_analysis_recovery_payload_hash(work.work_payload) then
    raise exception 'followup_payload_inconsistent' using errcode = 'VL422';
  end if;
  return work.work_payload;
end;
$$;

-- `protocols` is deliberately only a current upload projection. The immutable
-- source is report_versions.protocol plus its frozen projection payload. A
-- per-upload advisory lock serializes concurrent projections, and an unknown
-- legacy row fails closed rather than being overwritten.
create or replace function public.project_report_protocol(
  p_user_id uuid, p_upload_id uuid, p_report_version_id uuid
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  work_payload jsonb;
  source_generation bigint;
  historical_protocol jsonb;
  projection jsonb;
  current public.protocols%rowtype;
  effect_key text;
begin
  if p_user_id is null or p_upload_id is null or p_report_version_id is null then
    raise exception 'invalid_protocol_projection_request' using errcode = 'VL422';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('vl:protocol:' || p_user_id::text || ':' || p_upload_id::text, 0));

  work_payload := public.load_analysis_followup_work_payload(
    p_user_id, p_report_version_id, 'protocol');
  select o.generation_after, r.protocol into source_generation, historical_protocol
  from public.analysis_operations o
  join public.report_versions r
    on r.id = o.report_version_id and r.user_id = o.user_id and r.upload_id = o.upload_id
  where o.user_id = p_user_id and o.upload_id = p_upload_id and o.report_version_id = p_report_version_id;
  if not found or source_generation is null
     or work_payload -> 'data' -> 'historical_protocol' is distinct from historical_protocol
     or pg_catalog.jsonb_typeof(work_payload -> 'data' -> 'projection') <> 'array' then
    raise exception 'protocol_projection_inconsistent' using errcode = 'VL422';
  end if;
  projection := work_payload -> 'data' -> 'projection';
  effect_key := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    'vitaloop-downstream-effect-v1:' || p_report_version_id::text || ':protocol:', 'UTF8')), 'hex');

  select * into current from public.protocols
  where user_id = p_user_id and upload_id = p_upload_id for update;
  if found then
    if current.source_report_version_id is null or current.source_analysis_generation is null then
      raise exception 'protocol_projection_legacy_unknown' using errcode = 'VL409';
    end if;
    if current.source_analysis_generation > source_generation then
      return pg_catalog.jsonb_build_object('status', 'newer_projection', 'applied', false,
        'id', current.id, 'source_report_version_id', current.source_report_version_id,
        'recommendations', current.recommendations);
    end if;
    if current.source_analysis_generation = source_generation then
      if current.source_report_version_id is distinct from p_report_version_id then
        raise exception 'protocol_projection_generation_conflict' using errcode = 'VL409';
      end if;
      return pg_catalog.jsonb_build_object('status', 'already_projected', 'applied', false,
        'id', current.id, 'source_report_version_id', current.source_report_version_id,
        'recommendations', current.recommendations);
    end if;
    update public.protocols set recommendations = projection,
      prompt_version = 'frozen_report_v1', source_report_version_id = p_report_version_id,
      source_analysis_generation = source_generation, analysis_effect_key = effect_key
    where id = current.id;
  else
    insert into public.protocols
      (user_id, upload_id, recommendations, prompt_version, source_report_version_id,
       source_analysis_generation, analysis_effect_key)
    values (p_user_id, p_upload_id, projection, 'frozen_report_v1', p_report_version_id,
            source_generation, effect_key);
  end if;
  select * into current from public.protocols where user_id = p_user_id and upload_id = p_upload_id;
  return pg_catalog.jsonb_build_object('status', 'applied', 'applied', true,
    'id', current.id, 'source_report_version_id', current.source_report_version_id,
    'recommendations', current.recommendations);
end;
$$;

-- ---------------------------------------------------------------- release preflight
-- Service-role-only, read-only schema proof consumed by the protected deploy job.
-- It reveals no patient data and fails closed with one generic error.
create or replace function public.atomic_finalization_schema_preflight()
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  finalizer_oid oid;
  required_functions text[] := array[
    'lab_analysis_enc', 'lab_analysis_canon_numeric', 'lab_analysis_num_eq',
    'lab_analysis_validate_projection', 'lab_analysis_input_digest',
    'lab_analysis_validate_report', 'lab_analysis_recovery_payload_hash',
    'finalize_lab_analysis', 'claim_analysis_followup_work',
    'complete_analysis_followup_work', 'load_analysis_followup_work_payload',
    'project_report_protocol', 'atomic_finalization_schema_preflight'
  ];
  exposed_rpcs text[] := array[
    'finalize_lab_analysis', 'claim_analysis_followup_work',
    'complete_analysis_followup_work', 'load_analysis_followup_work_payload',
    'project_report_protocol', 'atomic_finalization_schema_preflight'
  ];
begin
  select oid into finalizer_oid
  from pg_catalog.pg_roles
  where rolname = 'vitaloop_finalizer'
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit
    and not rolcreatedb and not rolcreaterole and not rolreplication;
  if finalizer_oid is null then
    raise exception 'atomic_finalization_schema_not_ready';
  end if;

  if exists (
    with recursive memberships(oid) as (
      select membership.roleid
      from pg_catalog.pg_auth_members membership
      join pg_catalog.pg_roles member on member.oid = membership.member
      where member.rolname = 'vitaloop_finalizer'
      union
      select membership.roleid
      from memberships inherited
      join pg_catalog.pg_auth_members membership on membership.member = inherited.oid
    )
    select 1 from memberships
  ) then
    raise exception 'atomic_finalization_schema_not_ready';
  end if;

  if (select count(*) from pg_catalog.pg_class
      where oid in ('public.analysis_operations'::regclass, 'public.analysis_followup_work'::regclass)
        and relrowsecurity) <> 2 then
    raise exception 'atomic_finalization_schema_not_ready';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any(required_functions)
      and (
        p.proowner <> finalizer_oid
        or p.proconfig is null
        or (p.proname = any(exposed_rpcs) and not p.prosecdef)
        or (p.proname <> all(exposed_rpcs) and p.prosecdef)
      )
  ) or (select count(*) from pg_catalog.pg_proc
         where pronamespace = 'public'::regnamespace and proname = any(required_functions))
       <> array_length(required_functions, 1) then
    raise exception 'atomic_finalization_schema_not_ready';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any(required_functions)
      and acl.privilege_type = 'EXECUTE'
      and (
        acl.grantee = 0
        or acl.grantee in (select oid from pg_catalog.pg_roles where rolname in ('anon', 'authenticated'))
        or (p.proname = any(exposed_rpcs)
            and acl.grantee <> p.proowner
            and acl.grantee not in (select oid from pg_catalog.pg_roles where rolname = 'service_role'))
        or (p.proname <> all(exposed_rpcs) and acl.grantee <> p.proowner)
      )
  ) then
    raise exception 'atomic_finalization_schema_not_ready';
  end if;

  return pg_catalog.jsonb_build_object(
    'schema_ready', true,
    'migration_contract', '20261016120000_atomic_lab_analysis_finalization'
  );
exception when others then
  raise exception 'atomic_finalization_schema_not_ready' using errcode = 'VL503';
end;
$$;

-- ---------------------------------------------------------------- ownership and ACLs
alter function public.lab_analysis_enc(text) owner to vitaloop_finalizer;
alter function public.lab_analysis_canon_numeric(jsonb) owner to vitaloop_finalizer;
alter function public.lab_analysis_num_eq(jsonb, jsonb) owner to vitaloop_finalizer;
alter function public.lab_analysis_validate_projection(jsonb) owner to vitaloop_finalizer;
alter function public.lab_analysis_input_digest(uuid, text, text, jsonb) owner to vitaloop_finalizer;
alter function public.lab_analysis_validate_report(jsonb, uuid, text, jsonb) owner to vitaloop_finalizer;
alter function public.lab_analysis_recovery_payload_hash(jsonb) owner to vitaloop_finalizer;
alter function public.finalize_lab_analysis(uuid, uuid, uuid, text, bigint, uuid, text, text, jsonb, jsonb)
  owner to vitaloop_finalizer;
alter function public.claim_analysis_followup_work(uuid, uuid, text, uuid) owner to vitaloop_finalizer;
alter function public.complete_analysis_followup_work(uuid, uuid, text, uuid, text, text) owner to vitaloop_finalizer;
alter function public.load_analysis_followup_work_payload(uuid, uuid, text) owner to vitaloop_finalizer;
alter function public.project_report_protocol(uuid, uuid, uuid) owner to vitaloop_finalizer;
alter function public.atomic_finalization_schema_preflight() owner to vitaloop_finalizer;

revoke all on function public.lab_analysis_enc(text) from public, anon, authenticated, service_role;
revoke all on function public.lab_analysis_canon_numeric(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.lab_analysis_num_eq(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.lab_analysis_validate_projection(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.lab_analysis_input_digest(uuid, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.lab_analysis_validate_report(jsonb, uuid, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.lab_analysis_recovery_payload_hash(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.finalize_lab_analysis(uuid, uuid, uuid, text, bigint, uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.claim_analysis_followup_work(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_analysis_followup_work(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.load_analysis_followup_work_payload(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.project_report_protocol(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.atomic_finalization_schema_preflight() from public, anon, authenticated;
grant execute on function public.finalize_lab_analysis(uuid, uuid, uuid, text, bigint, uuid, text, text, jsonb, jsonb)
  to service_role;
grant execute on function public.claim_analysis_followup_work(uuid, uuid, text, uuid) to service_role;
grant execute on function public.complete_analysis_followup_work(uuid, uuid, text, uuid, text, text) to service_role;
grant execute on function public.load_analysis_followup_work_payload(uuid, uuid, text) to service_role;
grant execute on function public.project_report_protocol(uuid, uuid, uuid) to service_role;
grant execute on function public.atomic_finalization_schema_preflight() to service_role;

-- Self-audit: fail the migration if any ACL or owner property is wrong.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_roles r
    where r.rolname = 'vitaloop_finalizer' and (r.rolsuper or r.rolcanlogin or r.rolbypassrls or r.rolcreaterole)
  ) then
    raise exception 'acl_audit_failed: finalizer role is over-privileged';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    where p.pronamespace = 'public'::regnamespace
      and (p.proname like 'lab_analysis\_%' or p.proname in ('finalize_lab_analysis', 'claim_analysis_followup_work', 'complete_analysis_followup_work', 'load_analysis_followup_work_payload', 'project_report_protocol', 'atomic_finalization_schema_preflight'))
      and a.privilege_type = 'EXECUTE'
      and (
        a.grantee = 0
        or a.grantee in (select oid from pg_catalog.pg_roles where rolname in ('anon', 'authenticated'))
        or (p.proname not in ('finalize_lab_analysis', 'claim_analysis_followup_work', 'complete_analysis_followup_work', 'load_analysis_followup_work_payload', 'project_report_protocol', 'atomic_finalization_schema_preflight') and a.grantee <> p.proowner)
        or (p.proname in ('finalize_lab_analysis', 'claim_analysis_followup_work', 'complete_analysis_followup_work', 'load_analysis_followup_work_payload', 'project_report_protocol', 'atomic_finalization_schema_preflight') and a.grantee <> p.proowner
            and a.grantee not in (select oid from pg_catalog.pg_roles where rolname = 'service_role'))
      )
  ) then
    raise exception 'acl_audit_failed: unexpected EXECUTE grantee';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and (p.proname like 'lab_analysis\_%' or p.proname in ('finalize_lab_analysis', 'claim_analysis_followup_work', 'complete_analysis_followup_work', 'load_analysis_followup_work_payload', 'project_report_protocol', 'atomic_finalization_schema_preflight'))
      and (p.proowner <> (select oid from pg_catalog.pg_roles where rolname = 'vitaloop_finalizer')
           or (p.proname in ('finalize_lab_analysis', 'claim_analysis_followup_work', 'complete_analysis_followup_work', 'load_analysis_followup_work_payload', 'project_report_protocol', 'atomic_finalization_schema_preflight') and not p.prosecdef)
           or p.proconfig is null)
  ) then
    raise exception 'acl_audit_failed: owner/security definer/search_path';
  end if;
end $$;

notify pgrst, 'reload schema';
