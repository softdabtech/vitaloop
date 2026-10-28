# Symptom Engine — Privacy, Legal, and Security Control Record

This record separates implemented engineering controls from approvals that only
an accountable human or provider contract can supply. It is not legal advice,
a DPA, a DPIA approval, or a security certification.

## Data flow and minimization

The browser sends controlled VITALOOP IDs and `present / absent / unknown`
choices to the authenticated VITALOOP backend. The backend resolves approved
provider mappings and may send only this strict request body to Infermedica:

- biological sex: `female` or `male`;
- age in completed years;
- provider symptom/risk-factor IDs with controlled choices and evidence source.

The provider receives a random interview UUID and server credentials in request
headers. The request contract rejects extra fields. It does not permit name,
email, account ID, IP address, location, free text, medication narrative, lab
document, biomarker value, or report content. Provider transport must use HTTPS.

## Storage and observability

- VITALOOP stores structured evidence and the normalized safety result.
- Raw provider request and response bodies are not stored in provider events;
  only endpoint, status, duration, model/version, normalized error type, and
  SHA-256 request/response hashes are retained.
- A database check constraint forces the compatibility
  `symptom_evidence.provider_payload` field to remain `{}`.
- Condition candidates and probabilities are disabled for rollout, excluded
  from normal API responses, metrics, and browser assets, and are not copied to
  report snapshots.
- Metrics use controlled low-cardinality labels and contain no user ID,
  clinical concept ID, symptom label, or answer content.

## Access and lifecycle

- Browser roles cannot write symptom tables.
- Authenticated users may read only their own session/evidence rows through RLS.
- Mapping, provider-event, and idempotency tables are backend-only.
- Every user-owned symptom table cascades from `auth.users`; local pgTAP deletes
  a test account and verifies removal of sessions, evidence, provider metadata,
  and idempotency responses.
- Application retention is account-bound until a separate approved retention
  period is defined. Provider-side retention and deletion are unresolved
  contractual inputs, not assumptions made by the application.

## Executable release controls

The pre-deploy command runs
`backend/scripts/check_symptom_rollout_readiness.py`. A disabled deployment can
pass. Any enabled internal or percentage rollout fails closed unless provider
credentials, HTTPS, approved mappings, disabled candidate storage, alerting,
and recorded clinical, privacy, commercial, and security approvals are present.
The recorded flags are attestations that reviews happened; they do not replace
the reviews. Percentage rollout additionally requires production provider mode
and a supported step (`1/5/10/25/50/100`).

## Human/contract decisions still required

| Decision | Evidence required | State |
|---|---|---|
| Lawful basis and health-data disclosure | Counsel-approved EN policy/copy | BLOCKED |
| Provider roles and DPA | Signed DPA/controller-processor allocation | BLOCKED |
| Processing region and transfer mechanism | Contract and infrastructure evidence | BLOCKED |
| Provider retention/deletion and subprocessors | Contractual schedule/list | BLOCKED |
| Model licensing and permitted caching/labels | Commercial/provider approval | BLOCKED |
| Threat review and incident ownership | Named security approver and review | BLOCKED |
| Clinical mappings and safety copy | Identified licensed clinician | BLOCKED |

Until all mandatory items are recorded, keep `INFERMEDICA_ENABLED=false`,
rollout at `0`, and the allowlist empty. Do not publish provider-specific legal
claims that have not been verified against the executed agreement.

## Verification evidence

- strict outbound contract and HTTPS tests: `test_infermedica_adapter.py`;
- metadata-only event tests: `test_symptom_check_service.py`;
- RLS, raw-payload guard, and deletion cascade: `symptom_engine_rls_test.sql`;
- fail-closed rollout matrix: `test_symptom_rollout.py`;
- release decision: `SYMPTOM_ENGINE_RELEASE_GATE.md`.
