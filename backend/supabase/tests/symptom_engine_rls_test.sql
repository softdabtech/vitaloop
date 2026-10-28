BEGIN;
SELECT plan(25);

SELECT ok(
  (SELECT count(*) = 5 FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('symptom_check_sessions', 'symptom_evidence', 'clinical_concept_mappings', 'symptom_provider_events', 'symptom_answer_submissions')),
  'all symptom engine tables exist'
);

SELECT ok(
  (SELECT count(*) = 5 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('symptom_check_sessions', 'symptom_evidence', 'clinical_concept_mappings', 'symptom_provider_events', 'symptom_answer_submissions')
     AND c.relrowsecurity),
  'RLS is enabled on every symptom engine table'
);

SELECT ok(
  (SELECT count(*) = 2 FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('symptom_check_sessions', 'symptom_evidence')
     AND cmd = 'SELECT'
     AND roles = ARRAY['authenticated']::name[]),
  'authenticated users have explicit read-own policies only on sessions and evidence'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name IN ('symptom_check_sessions', 'symptom_evidence', 'clinical_concept_mappings', 'symptom_provider_events', 'symptom_answer_submissions')
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ),
  'authenticated users cannot write symptom engine tables'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'anon'
      AND table_schema = 'public'
      AND table_name IN ('symptom_check_sessions', 'symptom_evidence', 'clinical_concept_mappings', 'symptom_provider_events', 'symptom_answer_submissions')
  ),
  'anonymous users have no symptom engine table privileges'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name IN ('clinical_concept_mappings', 'symptom_provider_events', 'symptom_answer_submissions')
  ),
  'mapping and provider event tables remain backend-only'
);

SELECT ok(
  (SELECT count(*) = 20 FROM information_schema.role_table_grants
   WHERE grantee = 'service_role'
     AND table_schema = 'public'
     AND table_name IN ('symptom_check_sessions', 'symptom_evidence', 'clinical_concept_mappings', 'symptom_provider_events', 'symptom_answer_submissions')
     AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
  'service role has the four required privileges on all four tables'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.reserve_symptom_answer_submission(uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'service role can reserve an answer submission atomically'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.reserve_symptom_answer_submission(uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated browser role cannot call the reservation function'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'symptom_evidence_session_owner_fk'
      AND contype = 'f'
  )
  AND EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'symptom_provider_events_session_owner_fk'
      AND contype = 'f'
  )
  AND EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'symptom_answer_submissions_session_owner_fk'
      AND contype = 'f'
  ),
  'evidence, provider events, and idempotency ledger enforce session ownership consistency'
);

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a1',
    'authenticated',
    'authenticated',
    'rls-a@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000b2',
    'authenticated',
    'authenticated',
    'rls-b@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

INSERT INTO public.symptom_check_sessions (
  id,
  user_id,
  locale,
  root_concern_id,
  provider_model,
  questionnaire_version
) VALUES
  (
    '10000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a1',
    'en',
    'fatigue_low_energy',
    'infermedica_test',
    'test-v1'
  ),
  (
    '10000000-0000-0000-0000-0000000000b2',
    '00000000-0000-0000-0000-0000000000b2',
    'en',
    'sleep_unrefreshing',
    'infermedica_test',
    'test-v1'
  );

INSERT INTO public.symptom_evidence (
  session_id,
  user_id,
  vitaloop_concept_id,
  concept_type,
  choice_id,
  source,
  question_sequence,
  display_name_en
) VALUES
  (
    '10000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a1',
    'test_concept_a',
    'symptom',
    'present',
    'initial',
    1,
    'Test concept A'
  ),
  (
    '10000000-0000-0000-0000-0000000000b2',
    '00000000-0000-0000-0000-0000000000b2',
    'test_concept_b',
    'symptom',
    'absent',
    'initial',
    1,
    'Test concept B'
  );

SELECT throws_ok(
  $$
    UPDATE public.symptom_evidence
    SET provider_payload = '{"raw": "forbidden"}'::jsonb
    WHERE session_id = '10000000-0000-0000-0000-0000000000a1'
  $$,
  '23514',
  'new row for relation "symptom_evidence" violates check constraint "symptom_evidence_provider_payload_empty_check"',
  'database rejects raw provider payload storage'
);

INSERT INTO public.symptom_provider_events (
  session_id, user_id, endpoint_name, request_sequence, provider_model
) VALUES (
  '10000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a1',
  'diagnosis',
  1,
  'infermedica_test'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

SELECT is(
  (SELECT count(*) FROM public.symptom_check_sessions),
  1::bigint,
  'user A sees exactly one own session'
);

SELECT is(
  (SELECT user_id FROM public.symptom_check_sessions LIMIT 1),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'user A cannot read user B session'
);

SELECT is(
  (SELECT count(*) FROM public.symptom_evidence),
  1::bigint,
  'user A sees exactly one own evidence fact'
);

SELECT throws_ok(
  $$
    INSERT INTO public.symptom_check_sessions (
      user_id,
      locale,
      root_concern_id,
      provider_model,
      questionnaire_version
    ) VALUES (
      '00000000-0000-0000-0000-0000000000a1',
      'en',
      'fatigue_low_energy',
      'infermedica_test',
      'test-v1'
    )
  $$,
  '42501',
  'permission denied for table symptom_check_sessions',
  'authenticated browser role cannot create symptom sessions directly'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';

SELECT is(
  (SELECT count(*) FROM public.symptom_check_sessions),
  1::bigint,
  'user B sees exactly one own session'
);

SELECT is(
  (SELECT user_id FROM public.symptom_check_sessions LIMIT 1),
  '00000000-0000-0000-0000-0000000000b2'::uuid,
  'user B cannot read user A session'
);

RESET ROLE;

SET LOCAL ROLE service_role;

SELECT is(
  (SELECT reservation_state FROM public.reserve_symptom_answer_submission(
    '10000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a1',
    'key-hash-a',
    'request-hash-a'
  )),
  'reserved',
  'first answer request obtains the atomic reservation'
);

SELECT is(
  (SELECT reservation_state FROM public.reserve_symptom_answer_submission(
    '10000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a1',
    'key-hash-a',
    'request-hash-a'
  )),
  'in_progress',
  'concurrent duplicate does not obtain a second reservation'
);

SELECT is(
  (SELECT reservation_state FROM public.reserve_symptom_answer_submission(
    '10000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a1',
    'key-hash-a',
    'different-request-hash'
  )),
  'conflict',
  'same idempotency key with a different body is rejected'
);

UPDATE public.symptom_answer_submissions
SET state = 'completed', response_payload = '{"ok": true}'::jsonb, updated_at = now()
WHERE session_id = '10000000-0000-0000-0000-0000000000a1'
  AND idempotency_key_hash = 'key-hash-a';

SELECT is(
  (SELECT stored_response_payload->>'ok' FROM public.reserve_symptom_answer_submission(
    '10000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a1',
    'key-hash-a',
    'request-hash-a'
  )),
  'true',
  'completed duplicate receives the stored normalized response'
);

RESET ROLE;

DELETE FROM auth.users
WHERE id = '00000000-0000-0000-0000-0000000000a1';

SELECT is((SELECT count(*) FROM public.symptom_check_sessions WHERE user_id = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'account deletion removes symptom sessions');
SELECT is((SELECT count(*) FROM public.symptom_evidence WHERE user_id = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'account deletion removes symptom evidence');
SELECT is((SELECT count(*) FROM public.symptom_provider_events WHERE user_id = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'account deletion removes provider metadata');
SELECT is((SELECT count(*) FROM public.symptom_answer_submissions WHERE user_id = '00000000-0000-0000-0000-0000000000a1'), 0::bigint, 'account deletion removes idempotency responses');

SELECT * FROM finish();
ROLLBACK;
