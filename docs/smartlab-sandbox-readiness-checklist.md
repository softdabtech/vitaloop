# Smartlab Sandbox Readiness Checklist

## VITALOOP Readiness
- [ ] Staging API health returns `200` on `GET /health`.
- [ ] Partner routes are enabled in staging runtime.
- [ ] Sandbox partner API key is provisioned and active.
- [ ] Seed data path is tested at least once in current staging window.
- [ ] Logs/monitoring path is available for request tracing.
- [ ] Demo fallback payload and expected responses are prepared.

## Smartlab Readiness
- [ ] Technical owner assigned for API integration.
- [ ] Postman collection imported and environment variables configured.
- [ ] Test payload fields mapped to Smartlab source schema.
- [ ] Non-production identifiers are used for all test entities.
- [ ] Event types to be emitted are aligned with VITALOOP contract.
- [ ] Demo call participants and timeline confirmed.

## Security Checklist
- [ ] API key shared only through secure channel.
- [ ] No production keys/tokens used in sandbox.
- [ ] No real personal data sent to staging.
- [ ] Local test artifacts containing secrets are excluded from VCS.
- [ ] Access to staging endpoints is limited to authorized operators.
- [ ] Request/response logs are reviewed for accidental sensitive fields.

## Sandbox PASS Acceptance Criteria
- [ ] Ingest request returns `status=processed` and `partner_lab_result_id`.
- [ ] Insight endpoint returns valid `health_score` and recommendation structure.
- [ ] Embedded session is created and token-based view opens successfully.
- [ ] Event tracking endpoint accepts event and returns confirmation.
- [ ] End-to-end flow can be repeated without contract-breaking errors.
- [ ] Both teams sign off on payload contract and next pilot step.
