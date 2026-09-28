# Symptom Engine — EN Release Gate

This is the operational gate for the first EN pilot. It does not authorize a
deployment. The engine remains server-disabled by default and no rollout value
may be changed until every mandatory owner has recorded approval.

## Current verdict

**NO-GO for production. Local technical verification is complete; external
clinical, provider, legal/commercial, security, and alerting gates remain.**

## Rollout sequence

1. Keep `INFERMEDICA_ENABLED=false`, allowlist empty, rollout `0` during local work.
2. After every mandatory gate is approved, enable only named internal user IDs
   through `SYMPTOM_ENGINE_ALLOWLIST_USER_IDS`; keep percentage rollout at `0`.
3. Verify provider, safety, persistence, snapshot, and privacy telemetry for the
   internal cohort.
4. Expand with the stable server-side percentage bucket: `1 → 5 → 10 → 25 → 50 → 100`.
5. Stop expansion and set percentage back to `0` on any safety, persistence,
   mapping, authentication, or privacy alert. The explicit internal allowlist
   must also be cleared when a full shutdown is required.

`INFERMEDICA_ENABLED=false` is the hard kill switch and overrides both the
allowlist and percentage bucket.

## Acceptance matrix

| Gate | Required evidence | Current state | Owner / approval |
|---|---|---|---|
| Required anthropometrics | Server + route guard tests | PASS local | Product/engineering |
| Controlled EN interview | No medical free text; issued IDs only | PASS local | Product/engineering |
| Conservative safety | Internal/provider merge and emergency interrupt fixtures | PASS technical; clinical approval pending | Licensed clinician |
| EN safety copy | Exact emergency/urgent/insufficient copy | Candidate only | Licensed clinician + product/legal |
| Provider contract | Live synthetic `/info`, diagnosis, red-flags, triage in sandbox | BLOCKED — credentials/contract absent | Provider owner |
| Concept/domain mappings | Versioned approved rows with reviewer identity | BLOCKED — intentionally empty | Licensed clinician |
| Snapshot pipeline | Every B2C generation path freezes `symptom_snapshot_v1` | PASS local | Engineering |
| Privacy/DPA | Strict minimized request + technical control record; region, provider retention, subprocessors, lawful basis, and disclosure approval | PASS technical; external approval BLOCKED | Privacy/legal |
| Commercial terms | Licensed EN model and permitted label/cache persistence | BLOCKED | Commercial/legal |
| Security | Secret handling, RLS, deletion cascade, threat review | PASS local checks; formal review pending | Security |
| Observability | Provider/session/mapping/snapshot metrics and alert routing | PASS code; alert destination pending | Operations |
| EN browser E2E | Required profile, skip, three stages, resume, retry, unknown≠absent, double-submit, outage, emergency, lab link | PASS local, 8/8 | Product/QA |
| UA presentation | EN/UK key parity and same internal IDs | DEFERRED until EN stable | Product/localization |

## Mandatory stop conditions

- provider `401/403` or unexpected model-version change;
- mapping miss after model change;
- emergency result without successful persistence;
- finalized B2C report with an eligible completed session but no snapshot;
- provider outage represented as routine/self-care;
- raw provider body, credentials, condition candidates, or probabilities in
  logs, metrics, normal API responses, or browser assets;
- evidence ownership/RLS failure;
- any clinician-identified unsafe question, mapping, or copy.

## Local verification record

- Clean Supabase reset applies seven local migrations.
- pgTAP: `25/25` PASS including raw-payload rejection and account-deletion
  cascades; database lint: no schema errors.
- Strict provider/privacy plus rollout regression: `40/40` PASS.
- Local EN Playwright: `8/8` PASS, including the three-stage journey and
  emergency interruption.
- Executable rollout preflight: PASS for the disabled target; enabled targets
  fail closed until all attestation and operational gates are present.
- Full backend suite: `1498 passed`, `20 skipped`, `0 failed`. Three stale tests
  were corrected to preserve the intentional removal of the duplicate,
  unrouted `Progress.jsx`; the previously recorded B2B fixture failure no
  longer reproduces.
- Frontend changed-file lint and production build pass.
- Feature flags and rollout remain off; no production or remote migration was run.
- Technical privacy/security controls are recorded in
  `SYMPTOM_ENGINE_PRIVACY_SECURITY_IMPLEMENTATION.md`; DPA/legal/formal security
  approvals remain unresolved and block enablement.

## Rollback

1. Set `INFERMEDICA_ENABLED=false` (hard stop).
2. Set `SYMPTOM_ENGINE_ROLLOUT_PERCENT=0` and clear the server allowlist.
3. Preserve historical report versions; they remain readable without a current
   symptom session and older rows without a snapshot return `None`.
4. Revert application code and the local symptom migrations only in a planned
   rollback. Never delete user medical history as an ad-hoc rollback step.
