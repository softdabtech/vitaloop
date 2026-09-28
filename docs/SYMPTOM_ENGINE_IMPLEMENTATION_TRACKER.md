# Symptom Engine — Implementation Tracker

Canonical specification: [INFERMEDICA_SYMPTOM_ENGINE_IMPLEMENTATION_SPEC.md](./INFERMEDICA_SYMPTOM_ENGINE_IMPLEMENTATION_SPEC.md)

**Status:** P0 implementation in progress
**Progress:** 3/8 milestones
**Rule:** EN is canonical; UA changes labels only, never clinical IDs or logic.

## P0 — Foundation and safety

- [x] **1. Baseline and contracts** — audit current onboarding, symptom, upload, and analysis paths; freeze API contracts and feature flags.
- [x] **2. Required onboarding** — require age/date of birth, biological sex, height, and weight before dashboard access; allow symptom check to be skipped.
- [x] **3. Data model** — add symptom sessions, structured evidence, mappings, provider events, indexes, and RLS through a reviewed Supabase migration.
- [ ] **4. Safety layer** — implement deterministic red flags and triage merging; external provider may escalate but never lower internal urgency.

## P1 — Core symptom flow

- [ ] **5. Backend orchestration** — add Infermedica adapter, controlled concept mapping, session API, idempotency, timeouts, fallback, and audit trail.
- [ ] **6. EN frontend** — build the three-stage adaptive flow using controlled selections only; no free-text medical answers.
- [ ] **7. Analysis integration** — create an immutable symptom snapshot and pass it through every B2C lab-analysis and report path.

## P2 — Release readiness

- [ ] **8. Verification and rollout** — unit, contract, pipeline, RLS, safety, and Playwright tests; add UA translations; release behind flags from allowlist to 100%.

## Execution order

`1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`

Milestones 4–6 may be developed in parallel only after the data contracts from milestone 3 are stable. Rollout is blocked until safety, RLS, and end-to-end tests pass.

## Mandatory milestone gate

Before work starts:

- [ ] DoR scope, dependencies, risks, rollback, test matrix, and acceptance mapping recorded.
- [ ] Missing clinical/provider/product inputs identified; work is limited to mocks/scaffolding where they are absent.

Before a milestone is checked complete:

- [ ] Implementation rechecked against the canonical plan with deviations documented.
- [ ] Every milestone acceptance criterion has a requirement → file → test/review → result trace.
- [ ] Targeted tests and affected regression suites pass; known unrelated failures are named.
- [ ] Security, RLS, privacy, failure, idempotency, and rollback checks pass where applicable.
- [ ] Required clinical/product/provider review is recorded explicitly.
- [ ] DoD has no unresolved critical/high defects and the tracker reflects reality.

An unchecked gate keeps the milestone open even if its code is present.

## Milestone acceptance control

| Milestone | DoR | DoD / acceptance | Evidence or blocker |
|---|---|---|---|
| 1. Baseline and contracts | PASS | PASS | Canonical specification, route/data audit, server-only flags default off. |
| 2. Required onboarding | PASS | PASS | Shared server validator, client route guard, 15 focused backend tests, 2 EN Playwright scenarios, frontend build/lint. Four unrelated full-suite failures are recorded below. |
| 3. Data model | PASS | PASS | Clean local reset; five foundation/idempotency migrations plus the Milestone 7 safety-provenance migration; 20/20 pgTAP including two-user RLS and atomic idempotency reservation; schema lint clean; advisors have no warning/error findings; rollback documented. |
| 4. Safety layer | PASS (technical scope) | OPEN — release gates deferred | Provider + internal interruption, fail-closed behavior, synthetic fixtures, matrix, and sign-off packet are implemented. Product decision defers identified clinician signature and EN browser interruption E2E until the UI/service reaches the required level; neither gate is represented as complete. |
| 5. Backend orchestration | PASS (local technical scope) | OPEN — external readiness | Nine authenticated endpoints, adaptive state machine, atomic idempotency, safe summary/history, provider metadata events, audit/timeline, rate limit, metrics, and failure tests are implemented locally. Final DoD still requires approved concept mappings plus sandbox credentials/live synthetic provider verification. |
| 6. EN frontend | PASS (local technical scope) | OPEN — clinical copy approval | Three-stage controlled EN flow covers start/resume, positive wellbeing, initial evidence, adaptive dropdown answers, idempotent retry, skip, abandon, unsupported/provider-error, emergency interruption, and safe result states. Local browser E2E is now 8/8 PASS; final DoD remains open for approved EN safety copy. |
| 7. Analysis integration | PASS (local technical scope) | OPEN — approved mapping data | Immutable completed-session snapshots now flow through every current B2C pipeline source, health context, exact domain matching, persisted report versions, and frozen reads. Final real-data acceptance requires the clinically approved concept/domain mapping catalog already named by Milestone 5. |
| 8. Verification and rollout | PASS (local technical scope) | OPEN — release NO-GO | Local release matrix, executable fail-closed preflight, hard-off + internal allowlist + stable percentage rollout, content-free metrics, strict provider minimization, raw-payload DB guard, account deletion cascade, and 8/8 EN browser E2E pass. Production remains blocked by clinical, provider, privacy/DPA, commercial, formal security, alert-routing, and UA gates. |

## Progress update format

After each milestone, update this file with:

- checkbox and total progress;
- changed files and migrations;
- tests run and result;
- remaining risks or blockers;
- rollback instructions.

## Latest update — 2026-09-28

- Completed the local EN browser suite: `8/8` Playwright scenarios pass for required anthropometrics, skip, positive baseline, full three-stage fatigue flow, resume, unknown semantics, idempotent double-submit, provider retry, emergency interruption, and the upload link.
- Added an executable rollout preflight to the deployment safety script. Disabled deployments pass; any enabled rollout fails closed until provider, approved mapping, clinical, privacy, commercial, security, and alerting attestations are recorded. Percentage rollout also requires production provider mode and an approved rollout step.
- Added a strict outbound provider schema that rejects identity/free-text extras and requires HTTPS. The exact request test proves only sex, age, and controlled evidence leave VITALOOP.
- Added the seventh local migration: raw provider payload storage is prohibited by a database constraint. Account-deletion pgTAP now verifies cascades across sessions, evidence, provider metadata, and idempotency responses.
- Privacy/security verification: `40/40` focused backend tests, clean local reset, `25/25` pgTAP, and schema lint PASS. The technical control record is [SYMPTOM_ENGINE_PRIVACY_SECURITY_IMPLEMENTATION.md](./SYMPTOM_ENGINE_PRIVACY_SECURITY_IMPLEMENTATION.md); legal/DPA/provider-retention and formal security approvals remain explicit blockers.
- Final local smoke is green: full backend `1498 passed / 20 skipped / 0 failed`; changed frontend lint and production build PASS. The three former `Progress.jsx` failures were stale test debt: git history confirms the duplicate page was intentionally removed in commit `9e49cb93`, so the tests now protect its absence instead of demanding dead code.

- Installed and started Docker Desktop locally; started the full local Supabase stack. No remote or production command was run.
- Completed milestone 3 with five repository migrations: the symptom-engine foundation, ownership indexes, a separate root-concern field, a backend-only answer ledger, and atomic reservation for concurrent idempotent submissions.
- Added an intentionally empty seed file so every local reset is deterministic; clinical concept IDs remain unseeded until they are approved.
- Verified a clean local `supabase db reset`, migration application, and local service health.
- Expanded pgTAP coverage from schema inspection to real RLS behavior with two authenticated user IDs: each can read only its own session/evidence, while direct browser writes remain denied.
- Local database verification: `20/20` pgTAP tests passed; `supabase db lint` found no schema errors; refreshed Security and Performance Advisors each report `0 errors / 0 warnings`.
- Milestone 4 advanced: safety merge now distinguishes unavailable provider data from a real provider escalation, preserves `critical_now`, and exposes an explicit emergency interrupt.
- Milestone 4 provider path now uses current `/suggest` `red_flags` behavior, preserves controlled evidence source, evaluates typed serious observations/root cause, and asks red-flag questions before ordinary diagnosis questions.
- Added an exact-ID internal red-flag evaluator that executes approved rules only. The built-in active rule set remains empty until the draft clinical matrix is signed off.
- Wired accumulated internal evidence into the real completion/triage merge and added machine-readable provider-contract plus draft clinical safety fixtures.
- Prepared the [clinical and EN copy sign-off packet](./SYMPTOM_SAFETY_SIGNOFF_PACKET.md) with exact candidate copy, evidence sources, acceptance checks, synthetic-case review, and verifiable signature fields. It remains unsigned.
- Milestone 5 local technical scope advanced to nine authenticated `/symptom-check` endpoints: catalog, create/resume, current, initial evidence, adaptive answers, skip, abandon, non-diagnostic summary, and longitudinal history. Feature flags remain off by default.
- Adaptive submissions now acquire an atomic backend-only database reservation. Concurrent duplicates cannot both call the clinical provider; completed retries return the stored normalized response, body/key conflicts return `409`, and stale processing reservations self-recover.
- Provider calls now persist operational metadata and request/response hashes only; audit/timeline events, `/symptom-check` rate limiting, and content-free Prometheus metrics are connected.
- Question-cap completion can no longer convert an incomplete provider self-care result into `routine`; it returns the explicit `insufficient_data` limitation unless a higher safety escalation exists.
- Safe summary/history contracts expose VITALOOP controlled evidence and normalized safety only. Provider concept IDs, raw payloads, condition candidates, and probabilities are excluded and covered by tests.
- Milestone 6 EN UI now uses the server-owned symptom API and three visible stages. Medical inputs are dropdown-only; good wellbeing/no current concern is supported; skip returns to dashboard; unsupported concerns never open a free-text field; emergency interrupts cannot continue the interview.
- The frontend retries an unchanged adaptive answer with the same idempotency key, handles resumable provider errors without false reassurance, and consumes only normalized VITALOOP session/summary contracts.
- Milestone 7 adds `symptom_snapshot_v1`: only the newest completed session is eligible; present/absent/unknown evidence stays separate; condition candidates, probabilities, and raw provider payloads are never copied.
- Every current B2C pipeline source now captures a detached snapshot at generation time. Present canonical EN labels feed the temporary legacy symptom bridge; absent evidence cannot add a penalty; unknown remains an explicit evidence gap. B2B sources never auto-load consumer context.
- Approved mapping `domain_keys` provide exact structured matching in the health-state engine before legacy label aliases. This path is deliberately data-empty until the clinically approved mapping catalog is populated.
- Full server snapshots, including server-only provider provenance and internal/provider/final safety levels, are persisted in the immutable report-version input. Live and frozen client responses redact provider model/concept IDs and preserve the original database row.
- Milestone 8 adds a server-only internal-user allowlist that works while percentage rollout stays at `0`; `INFERMEDICA_ENABLED=false` remains the overriding hard kill switch. The later percentage cohort remains deterministic.
- Added content-free completion-rate, mapping-miss, finalized-analysis snapshot-presence, and snapshot evidence-count metrics. Metric labels are controlled and tests prove clinical IDs/content are not rendered.
- Added the [EN release gate](./SYMPTOM_ENGINE_RELEASE_GATE.md). Its current verdict is explicitly **NO-GO** and records owners, stop conditions, rollback, deferred gates, and the allowlist → percentage rollout sequence.
- Focused backend verification now passes `136/136` tests across symptom/API/frontend contracts plus pipeline/frozen-report/rollout/metrics regressions. The full backend suite returns the unchanged failure baseline `1508 passed / 20 skipped / 4 failed`; three failures require the already-missing legacy `frontend/src/pages/Progress.jsx`, and one is the pre-existing B2B protocol-domain fixture failure.
- Frontend changed-file lint and production build pass. The repository-wide lint still has six pre-existing errors in unrelated legacy files: `CookieConsent.jsx`, `NotificationPreferences.jsx`, `PaywallModal.jsx`, `wayforpayCheckout.js`, and `Subscription.jsx`.
- Fresh-database INFO notices for unused indexes and intentionally policy-free backend-only tables are expected and do not grant client access.
- Rollback: stop the local stack with `supabase stop --workdir backend`; revert the six local migrations and related service/router/test files before any future remote migration. Production remains unchanged.

### Milestone 4 checkpoint — DoR / DoD / Acceptance

- **DoR:** PASS for technical implementation only. Scope, current provider contract, risks, rollback, test matrix, and missing clinical inputs are recorded.
- **Plan conformance:** current Engine API `/suggest` red-flags flow, evidence source, five-level triage, serious-observation semantics, and fail-closed behavior are reflected in code and specification.
- **Automated evidence:** `59/59` focused tests pass; application compiles; seven `/symptom-check` routes register; diff hygiene passes.
- **Failure behavior:** provider errors persist `insufficient_data`, preserve the active session for retry, return a sanitized resumable 503, and never report self-care/routine.
- **Security/privacy:** provider credentials remain server-only; raw provider bodies and condition probabilities are not exposed; no LLM safety fallback exists; feature flags remain off.
- **Rollback:** remove the red-flag adapter/policy integration and retain the previously tested triage-only merge; no database or production rollback is required for this checkpoint.
- **Backend interruption:** PASS. The adaptive answer endpoint requires `X-Idempotency-Key`, validates the issued controlled question, rejects unapproved provider concepts, persists evidence once, and stops immediately on internal emergency. The repeat request returns the stored response.
- **DoD:** OPEN. Required blockers are named clinician approval of the rule matrix and EN copy, reviewed synthetic safety cases, and browser E2E interruption after the EN frontend exists.

### Milestone 5 checkpoint — DoR / DoD / Acceptance

- **DoR:** PASS for local technical implementation. State contracts, external dependencies, privacy constraints, rollback, failure behavior, and the provider-readiness gaps are recorded in the canonical specification.
- **API/state machine:** PASS locally. Nine authenticated routes are registered; controlled schemas reject free-text medical fields and unissued values; the synthetic FastAPI contract covers create → initial evidence → adaptive answer → summary/history.
- **Idempotency:** PASS locally. `reserve_symptom_answer_submission` atomically distinguishes `reserved`, `in_progress`, `conflict`, and `completed`; pgTAP proves browser roles cannot execute it and service-role retries return the stored normalized response.
- **Privacy/security:** PASS locally. RLS and ownership tests pass; summary/history exclude provider IDs, raw bodies, candidates, and probabilities; provider events contain hashes plus low-cardinality operational metadata only; flags remain disabled.
- **Failure/safety:** PASS locally with mocked provider contracts. Provider failure is resumable and fail-closed, internal emergency interrupts before another provider call, provider urgency cannot lower internal urgency, and question-cap exhaustion cannot become routine.
- **Audit/observability:** PASS locally. Medical reads/writes emit audit metadata; terminal state emits a generic timeline event; rate limiting and content-free metrics are registered.
- **Acceptance trace:** service/router contracts — `backend/app/services/symptom_check_service.py`, `backend/app/routers/symptom_check.py`; atomic ledger — `backend/supabase/migrations/20260928063548_symptom_answer_atomic_reservation.sql`; verification — `backend/tests/test_symptom_check_service.py`, `backend/tests/test_symptom_check_api.py`, `backend/tests/test_symptom_metrics.py`, `backend/supabase/tests/symptom_engine_rls_test.sql` — result `68/68` Milestone 5 focused tests and `20/20` pgTAP.
- **External blockers / honest DoD:** OPEN until an approved EN concept-mapping set and Infermedica sandbox credentials permit live synthetic `/info`, diagnosis, red-flags, and triage verification. Clinical signature and browser emergency interruption remain Milestone 4/6 release gates deferred by explicit product decision, not silently waived.
- **Rollback:** feature flags stay off; revert the symptom router/service/metrics additions and the atomic-reservation migration locally. No production migration, provider request, or deployment was performed.

### Milestone 6 checkpoint — DoR / DoD / Acceptance

- **DoR:** PASS for local implementation. Milestone 5 response/state contracts are stable and the remaining clinical/browser gates are explicitly identified.
- **Three-stage UX:** PASS in code. Stage 1 captures overall wellbeing and one root concern; Stage 2 captures one primary, up to two secondary controlled concepts, and duration; Stage 3 renders provider-issued controlled questions adaptively.
- **No discarded medical text:** PASS. The active EN route contains no `textarea`, content-editable field, or arbitrary medical-details payload. All medical answers originate from backend-provided IDs and choices.
- **State coverage:** PASS in code for resume, no-current-concern, skip-to-dashboard, unsupported concern, provider retry, abandon, routine/insufficient/review/urgent result, and blocking emergency interruption.
- **Idempotent UI retry:** PASS. An unchanged failed adaptive submission retains its original `X-Idempotency-Key`; changing an answer generates a new key.
- **Privacy:** PASS. UI does not request/render provider candidates or probabilities and does not expose credentials/provider IDs.
- **Verification:** changed-file ESLint PASS; production Vite/PWA build PASS; four frontend contract tests PASS. Browser interaction/E2E is deliberately not claimed.
- **DoD:** OPEN. Candidate emergency copy is wired exactly from the unsigned sign-off packet, but approval remains pending. Browser E2E covering resume, retry, and emergency interruption remains deferred by explicit product decision until the service reaches the agreed maturity.
- **Acceptance trace:** active route — `frontend/src/App.jsx`; API client — `frontend/src/api/symptomCheck.js`; page/state machine — `frontend/src/pages/SymptomCheck.jsx`; contract checks — `backend/tests/test_symptom_check_frontend_contract.py`.
- **Rollback:** point the `/questionnaire` lazy import back to the legacy page and remove the new API/page files. Backend flags remain off, so no production user is exposed by this local implementation.

### Milestone 7 checkpoint — DoR / DoD / Acceptance

- **DoR:** PASS for local technical implementation. The normalized session/evidence contract from Milestone 5 is stable; scope, privacy boundaries, B2C source inventory, backward compatibility, rollback, and missing approved mapping data are recorded.
- **Snapshot eligibility/immutability:** PASS. Only `status=completed` sessions with `completed_at` are loaded. The builder allowlists stable facts into a detached object; later session/evidence changes cannot mutate a persisted report version.
- **B2C coverage:** PASS in code. `b2c_file`, `b2c_text`, `b2c_manual`, legacy PDF, candidate review/confirmation, results compatibility/read, and report regeneration all auto-load the newest eligible snapshot. B2B does not.
- **Clinical semantics:** PASS in code. Only present canonical EN labels enter the legacy `List[str]` bridge. Structured present evidence may support an exact approved domain; absent and unknown evidence remain separate and never create symptom penalties.
- **Privacy/security:** PASS. Stored snapshots exclude raw provider bodies and condition candidates/probabilities. Client-safe live/frozen projections additionally redact provider model and provider concept IDs without mutating the stored row.
- **Frozen reproducibility:** PASS. The full snapshot is inserted into `report_versions.input_snapshot`; historical reads surface the frozen client-safe projection and never reload the user's latest symptom session.
- **Safety provenance:** PASS locally. The sixth migration stores pre-merge internal/provider safety levels alongside final safety, allowing a report snapshot to retain all three decisions.
- **Verification:** clean local database reset applied all six migrations; pgTAP `20/20` PASS; schema lint clean; Milestone 7 focused tests `8/8` PASS; combined affected regression `135/135` PASS; full backend `1506 passed / 20 skipped / 4` unchanged pre-existing failures.
- **Acceptance trace:** builder/loader/redaction — `backend/app/services/symptom_snapshot.py`; B2C pipeline/frozen persistence — `backend/app/services/lab_analysis_pipeline.py`, `backend/app/services/report_history.py`; structured downstream context/exact-domain match — `backend/app/services/health_context.py`, `backend/app/services/health_state_engine.py`; provenance migration — `backend/supabase/migrations/20260928072000_symptom_safety_provenance.sql`; verification — `backend/tests/test_symptom_snapshot.py`.
- **DoD:** OPEN only for real approved mapping data. Technical behavior is complete locally, but exact-domain production acceptance cannot be claimed while the clinically approved concept/domain catalog is intentionally empty.
- **Rollback:** feature flags remain off. Revert the snapshot service/pipeline/context changes and the safety-provenance migration; existing report versions written before this work remain backward-compatible because missing snapshots read as `None`.

### Milestone 8 checkpoint — DoR / DoD / Acceptance

- **DoR:** PASS for local verification and rollout scaffolding. Milestones 4–7 have locally testable contracts; every unavailable external/clinical/legal input is named and treated as a release blocker.
- **Feature control:** PASS locally. Backend default is disabled, rollout is `0`, the hard switch overrides all cohorts, a comma-separated server-only allowlist enables named internal users before percentage rollout, and percentage assignment is stable.
- **Observability:** PASS in code for provider calls/errors, terminal sessions/questions/triage, completion rate, mapping misses, finalized B2C snapshot presence, and present/absent/unknown snapshot counts. No symptom label, concept ID, provider body, or user ID is a metric label.
- **Security/privacy checks:** PASS locally for RLS/grants, backend-only provider credentials, client-safe snapshot redaction, no frontend credential references, medical-content-free operational events, and deletion cascades. Formal security and DPA reviews remain external gates.
- **Release governance:** PASS as a document, not as approval. `docs/SYMPTOM_ENGINE_RELEASE_GATE.md` records a current `NO-GO`, mandatory owners/evidence, stop conditions, hard rollback, and staged internal allowlist → `1/5/10/25/50/100%` expansion.
- **Verification:** Python compile PASS; affected regression `136/136` PASS; clean database reset, pgTAP `20/20`, and schema lint PASS; full backend `1508 passed / 20 skipped / 4` unchanged pre-existing failures; frontend secret-reference scan is empty; diff whitespace check PASS.
- **DoD:** OPEN / production NO-GO. Remaining blockers: identified clinician signature and approved EN emergency copy, approved concept/domain mappings, provider sandbox/live synthetic verification, privacy/DPA/commercial approval, formal security review, operational alert destination, deferred EN browser E2E, and UA presentation/parity after EN stabilizes.
- **Rollback:** `INFERMEDICA_ENABLED=false` is the hard stop; also set percentage to `0` and clear allowlist. No production flag, remote migration, external provider request, or deployment was performed.

## Previous update — 2026-09-27

- Completed the route and API audit; the symptom engine flags are server-only and default to disabled with `0%` rollout.
- Replaced the old skippable B2C setup with required age, sex, height, and weight; Symptom Check remains optional after dashboard entry.
- Added one canonical backend validator used by onboarding state, dashboard state, and lab-analysis access.
- Closed direct-link and stale `onboarding_complete` bypasses; preserved the separate organization-admin setup path.
- Local verification: frontend build passed; changed-file lint passed; 15 focused backend tests passed; 2 Playwright onboarding tests passed.
- Full backend result: `1431 passed, 20 skipped, 4 failed`. The four failures are pre-existing and unrelated: three require the already-missing legacy `frontend/src/pages/Progress.jsx`; one is an independent B2C pipeline fixture failure.
- Rollback: revert the milestone-2 frontend route/onboarding changes and the shared profile validator. No database or production state was changed.
- Milestone 3 started: Supabase CLI created the local foundation migration, RLS/grants, static migration tests, and a pgTAP suite.
- Milestones 4–5 started: deterministic provider/internal safety merge and a disabled-by-default Infermedica v3 client/adapter now have mock-based tests. No provider credentials or live API calls were used.
- Current new-test verification: `26 passed` across onboarding, migration contracts, safety merge, and provider adapter.
