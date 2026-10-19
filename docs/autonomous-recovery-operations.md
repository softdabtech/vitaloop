# C4.1B-03 autonomous recovery operations

## Execution model

`recovery-worker` is the only autonomous recovery process. It is a separate
Docker Compose service that runs `python -m app.workers.autonomous_recovery`;
Uvicorn does not start a scheduler. The worker uses the backend's existing
server-side service-role client and the existing `analysis_followup_work` RLS
policy. It has no HTTP endpoint.

Every cycle discovers at most eight report owners, processes at most two at a
time, and waits 60 seconds before the next cycle. The environment variables
`RECOVERY_WORKER_INTERVAL_SECONDS`, `RECOVERY_WORKER_BATCH_SIZE`, and
`RECOVERY_WORKER_CONCURRENCY` are bounded in application configuration.

The worker only calls the existing frozen-ledger dispatcher. Each dispatcher
run revalidates the report owner, loads the hash-verified frozen payload, and
uses the existing per-effect SQL lease and idempotency keys. It never invokes
the analysis pipeline, an LLM, or knowledge evaluation.

## Database requirement

Apply `backend/migrations/20261019090000_autonomous_recovery_worker.sql` through
the established controlled role-handoff procedure before merging. It adds only
two partial global-discovery indexes and a service-role-only structural
preflight RPC. C4.1B-02 already supplies the required ledger RLS policy,
frozen-payload RPCs, lease handling, and unique downstream effect keys.

## Release sequence

1. Apply the C4.1B-03 additive migration after C4.1B-02, then verify both
   schema contracts using the protected production preflight job.
2. Merge this PR to `main`; CI builds immutable SHA-tagged backend/frontend
   images and starts `backend`, `recovery-worker`, and `frontend` with that
   exact tag.
3. Verify `docker ps` reports one healthy backend and one running
   `vitaloop-recovery-worker`; inspect only aggregate worker counters in logs.
4. Confirm `/health/ready` remains healthy and that the worker does not log
   configuration or credential errors.

`VITALOOP_IMAGE_TAG` is required by production Compose. There is intentionally
no `latest` fallback.

## Rollback

Roll back application images only to an explicit, previously deployed 40-character
Git SHA. On the production host, set the exact known-good release identifier and
recreate all three services without building:

```bash
PREVIOUS_RELEASE_SHA=<40-character previously deployed Git SHA>
VITALOOP_IMAGE_TAG="$PREVIOUS_RELEASE_SHA" docker compose -f docker-compose.prod.yml up -d --no-build --force-recreate backend recovery-worker frontend
```

Durable ledger rows are not deleted and remain safe for the restored worker or
the existing request-path fast path. Do not delete or mutate
`analysis_followup_work` rows as part of rollback.
