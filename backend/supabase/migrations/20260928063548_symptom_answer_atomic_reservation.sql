alter table public.symptom_answer_submissions
  alter column response_payload drop not null,
  add column state text not null default 'completed'
    check (state in ('processing', 'completed')),
  add column updated_at timestamptz not null default now();

create index symptom_answer_submissions_processing_idx
  on public.symptom_answer_submissions(updated_at)
  where state = 'processing';

create or replace function public.reserve_symptom_answer_submission(
  p_session_id uuid,
  p_user_id uuid,
  p_idempotency_key_hash text,
  p_request_hash text
)
returns table (
  reservation_state text,
  stored_request_hash text,
  stored_response_payload jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted_id uuid;
  v_existing public.symptom_answer_submissions%rowtype;
begin
  insert into public.symptom_answer_submissions (
    session_id,
    user_id,
    idempotency_key_hash,
    request_hash,
    response_payload,
    state
  ) values (
    p_session_id,
    p_user_id,
    p_idempotency_key_hash,
    p_request_hash,
    null,
    'processing'
  )
  on conflict (session_id, idempotency_key_hash) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    return query select 'reserved'::text, p_request_hash, null::jsonb;
    return;
  end if;

  select * into v_existing
  from public.symptom_answer_submissions
  where session_id = p_session_id
    and idempotency_key_hash = p_idempotency_key_hash;

  if v_existing.request_hash <> p_request_hash then
    return query select 'conflict'::text, v_existing.request_hash, null::jsonb;
    return;
  end if;

  if v_existing.state = 'completed' then
    return query select 'completed'::text, v_existing.request_hash, v_existing.response_payload;
    return;
  end if;

  -- Recover a reservation left behind by a crashed worker. The provider
  -- timeout/retry budget is well below this interval.
  if v_existing.updated_at < now() - interval '5 minutes' then
    update public.symptom_answer_submissions
    set updated_at = now()
    where id = v_existing.id
      and state = 'processing'
      and updated_at = v_existing.updated_at;
    if found then
      return query select 'reserved'::text, p_request_hash, null::jsonb;
      return;
    end if;
  end if;

  return query select 'in_progress'::text, v_existing.request_hash, null::jsonb;
end;
$$;

revoke all on function public.reserve_symptom_answer_submission(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_symptom_answer_submission(uuid, uuid, text, text)
  to service_role;

comment on function public.reserve_symptom_answer_submission(uuid, uuid, text, text) is
  'Atomically reserves one adaptive-answer request. Service-role only; returns normalized ledger state, never provider data.';

notify pgrst, 'reload schema';
