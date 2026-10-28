# C4.1B-03 autonomous recovery E2E validation

## Environment

- Isolated local PostgreSQL cluster created with `initdb`; no Supabase or
  production endpoint/credential was used.
- Disposable database: `vitaloop_test_recovery` on local port `55434`, with
  the required `vitaloop-disposable-test-database` sentinel comment.
- The existing `tests/db/safety.py` checks ran before schema setup: local DSN,
  sentinel, empty public schema, approved roles, finalizer posture, no role
  memberships, and no unexpected extensions/schemas.
- The harness applied the real C4.1B-02 atomic-finalization migration and the
  real C4.1B-03 autonomous-recovery migration. Test records used generated
  UUIDs and the existing synthetic biomarker/report contracts.

## Tests executed

```text
VITALOOP_TEST_PG_DSN=postgresql://localhost:55434/vitaloop_test_recovery \
VITALOOP_TEST_PG_CONFIRM_DISPOSABLE=i-understand-this-database-is-disposable \
pytest -q backend/tests/db/test_finalize_lab_analysis_pg.py

54 passed in 0.56s
```

The new parameterized E2E test is
`test_autonomous_worker_recovers_committed_timeline_without_a_new_request`.
It starts with a real `finalize_lab_analysis` commit, leaves one frozen
`timeline` ledger effect outstanding, then starts `run_worker` independently.
It does not make a request-path recovery call.

The test adapter invokes the real PostgreSQL claim, payload-load, and
completion RPCs. It writes the downstream `timeline_events` effect through
the database's real unique `analysis_effect_key` constraint. The adapter is
limited to replacing Supabase REST transport; it does not manufacture ledger
rows, payloads, claims, completion results, or downstream outcomes.

## Results and evidence

| Scenario | Result | Persisted evidence |
| --- | --- | --- |
| Pending work | PASS | Atomic finalization created `timeline=pending, attempt_count=0`; the worker discovered one report and completed it with attempt `1`. |
| Retryable work | PASS | A real claim/completion RPC set the row to `retryable`; the independent worker reclaimed it and completed it at attempt `2`. |
| Active lease | PASS | `test_concurrent_followup_claims_allow_exactly_one_dispatcher` proves one SQL claimant wins and the other observes `processing`. |
| Expired lease | PASS | An interrupted claimant left `timeline=processing`; after only its lease clock expired, the worker discovered it, reclaimed it, and completed it at attempt `2`. |
| Completed effect | PASS | `test_followup_lease_prevents_completed_effect_from_being_reclaimed` proves a completed row is never claimable again. |
| Concurrent recovery | PASS at the database boundary | Concurrent claim test permits exactly one owner; the unique downstream-effect test permits exactly one persisted timeline row. |
| Worker interrupted mid-operation | PASS | The expired-lease E2E case models a worker that claims then terminates before acknowledgement; a later independent cycle completes the same frozen effect. |
| Frozen clinical evidence | PASS | `load_analysis_followup_work_payload` validates payload shape, binding, operation input hash, and payload hash before the handler sees it. No AI or pipeline call exists in the worker path. |
| Invalid owner binding | PASS | The owner-scoped payload RPC rejects a different synthetic owner with `VL404`. |
| Invalid payload hash / input binding | PASS | Tampered payload and recomputed-but-wrong input hash are rejected with `VL422`; no downstream write follows. |
| No user request | PASS | The E2E worker task starts after finalization returns and processes discovery independently; no request-path recovery function is invoked. |

For each E2E parameter, assertions include all of the following, not just the
worker counter:

1. Initial ledger status and attempt count.
2. Worker cycle counter: `discovered=1 processed=1 failed=0`.
3. Final ledger row: `completed`, expected attempt count, cleared lease token,
   and non-null completion timestamp.
4. Exactly one committed `timeline_events` row with the durable effect key.

Sanitized worker log evidence is limited to these non-identifying messages:

```text
autonomous_recovery_worker_started
autonomous_recovery_cycle discovered=1 processed=1 failed=0
autonomous_recovery_worker_stopped
```

The test asserts that neither the synthetic user UUID nor report UUID occurs
in captured logs.

## Observability review

The worker emits its lifecycle and counter events at `INFO` to stdout. The
current `httpx` logger can still emit request URLs at `INFO`; that is not
needed for recovery monitoring and should be set to `WARNING` in the dedicated
worker logging setup. This operational-only change is intentionally isolated
to a separate PR from this validation test/report work.

## Remaining risks

- The integration harness uses a direct disposable PostgreSQL transport in
  place of a local PostgREST/Supabase container. SQL RPC semantics, RLS, lease
  transitions, payload verification, and downstream uniqueness are exercised,
  but the Supabase HTTP client itself is not part of this local E2E run.
- The concurrent-worker proof is at the authoritative database claim and
  effect-key boundary. A two-container race is not required to establish
  correctness of that boundary, but remains useful as a deployment-environment
  smoke test.
- No production records, credentials, configuration, containers, deployment,
  or merge were touched.

## Final verdict

**PASS.** The success criterion was demonstrated on an isolated disposable
database: an interrupted or outstanding downstream effect was automatically
discovered and completed with a persisted, idempotent downstream result and
without a new user request.
