# Smartlab Demo Runbook

## Demo Objective
Show Smartlab how lab data is ingested, transformed into insights, and exposed via embedded flow in a sandbox-safe environment.

## Audience Split
### Business Team Focus
- Integration value proposition and workflow simplicity.
- Typical turnaround from raw result to explainable insight.
- Expected user-facing outputs from embedded view.

### Technical Team Focus
- Endpoint sequence and required headers.
- Payload contracts and required identifiers.
- Error handling expectations and event tracking confirmation.

## Live Demo Scenario (Recommended)
1. Confirm health endpoint returns `200`.
2. Send synthetic lab result payload.
3. Capture returned `partner_lab_result_id`.
4. Fetch insight for that result.
5. Create embedded session and capture `embedded_token`.
6. Open embedded view by token.
7. Send `partner.insight_viewed` event.
8. Confirm all responses and summarize outputs.

## Expected Outputs
- Ingest response with `status=processed` and unique result ID.
- Insight response with health score and recommendation objects.
- Embedded session response with token and expiry.
- Embedded view response with biomarker/insight payload.
- Event tracking response confirming acceptance.

## What To Show Business Team
- Before/after: raw biomarkers to interpreted insight.
- Clarity of risk flags and recommendation structure.
- Integration readiness status and pilot next-step criteria.

## What To Show Technical Team
- Postman collection execution order.
- Variable flow: `partner_lab_result_id` and `embedded_token`.
- Contract stability expectations during pilot.
- Troubleshooting points: auth header, schema mismatch, unknown event types.

## Fallback Plan (API Temporarily Unavailable)
1. Use prepared static request/response examples from sandbox samples doc.
2. Walk through endpoint contracts and variable dependencies offline.
3. Demonstrate expected response structures from recorded successful run.
4. Reschedule live API validation window and keep Q and A focused on contract details.

## Post-Demo Hand-off
- Share quickstart, sample payloads, readiness checklist, and Postman collection.
- Confirm single communication channel for issue triage.
- Track open contract questions and assign owners with target dates.
