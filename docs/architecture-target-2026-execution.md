# VITALOOP Target Architecture 2026 - Execution Plan

## Scope
This document translates the target architecture direction into an incremental execution plan without a big-bang rewrite.

## Current State (as of 2026-04-16)
- Runtime: frontend (React + Vite), backend (FastAPI), CRM (ASP.NET MVC), Supabase (Auth + Postgres).
- Deployment: script-driven from local machine.
- Multi-tenancy: organization-based model present in CRM and backend access paths.
- Phase 0 hardening completed in this iteration:
  - Config-driven CORS origins.
  - Baseline API security headers middleware.
  - Path-based rate limiting middleware for auth/analyze/protocol.

## North Star Architecture
- Edge: Cloudflare CDN + WAF.
- API entry: gateway layer (Traefik/Kong).
- Backend: modular FastAPI first, then selective service extraction.
- Data: Supabase Postgres + RLS + pgvector.
- AI orchestration: Claude primary with controlled fallback.
- Async processing: queue-backed analysis pipeline.
- Observability: OpenTelemetry + metrics + error tracking.

## Migration Plan

### Phase 0 (1-2 weeks) - Safety and Reliability Baseline
Goals:
- Remove obvious single-point failures and unsafe defaults.
- Increase abuse resistance and operational visibility.

Backlog:
- [x] Enforce explicit deploy host and safer rollback scripts.
- [x] Add endpoint-level timeout/error hardening for analyze/protocol.
- [x] Add app-level security headers middleware.
- [x] Add app-level path rate limiting middleware.
- [x] Add request-id propagation and correlate logs across frontend/backend/CRM.
- [x] Add idempotency key support for expensive analysis operations.
- [x] Add retention jobs for raw upload artifacts (90-365 day policy).
- [ ] Add audit log coverage for all medical-data reads and writes.

Exit criteria:
- No hardcoded production hosts in scripts.
- Sensitive endpoints protected by throttling and timeouts.
- Production config fully env-driven.

### Phase 1 (1 month) - Modular Monolith
Goals:
- Restructure backend by bounded context while preserving one deploy unit.

Backlog:
- [ ] Split backend modules into identity, analysis, protocol, notifications, billing domains.
- [ ] Introduce explicit application service interfaces per domain.
- [ ] Adopt structured LLM workflow layer (LangGraph or equivalent orchestrator wrapper).
- [ ] Normalize response contracts for public/client endpoints.

Exit criteria:
- Bounded contexts are explicit in code and tests.
- Domain ownership is visible in folder boundaries and interfaces.

### Phase 2 (2-3 months) - Selective Service Extraction
Goals:
- Extract highest-load/high-risk workloads first.

Backlog:
- [ ] Extract analysis pipeline into separate deployable worker/service.
- [ ] Introduce queue for async OCR + extraction + recommendation steps.
- [ ] Add retries, dead-letter handling, and idempotent processing.
- [ ] Add autoscaling policy for worker pool.

Exit criteria:
- Analysis latency and failures do not impact core auth/profile API paths.
- Queue processing has measurable SLOs.

### Phase 3 - Compliance and Scale Hardening
Goals:
- Reach HIPAA/GDPR-ready operational posture where required.

Backlog:
- [ ] Complete data minimization and tokenization strategy for LLM payloads.
- [ ] Extend encryption controls to sensitive column-level fields where needed.
- [ ] Implement right-to-be-forgotten and retention policy automation.
- [ ] Evaluate private/model-hosted fallback path for sensitive workloads.

Exit criteria:
- Compliance controls mapped to operational runbooks and automated checks.

## Immediate Next Sprint
1. Extend audit log coverage for medical-data reads and writes.
2. Implement Redis-backed distributed rate limiter for multi-instance backend (design in `docs/redis-rate-limiter-plan.md`). (in progress: backend abstraction and Redis backend wiring completed)
3. Add retention run dashboard panel (last success/fail, rows updated). (completed: admin endpoint `/admin/retention/status` + job audit events)
4. Expand abuse tests to include auth/protocol prefixes and multi-IP behavior. (completed)

## Risks and Mitigations
- In-process limiter is per-instance only.
  - Mitigation: move to Redis-backed limiter when scaling beyond one backend instance.
- Script-based deploy remains human-dependent.
  - Mitigation: keep scripts deterministic now, then transition to CI/CD in later phase.
- LLM dependency introduces latency/cost volatility.
  - Mitigation: timeout budget, retries with guardrails, and provider fallback strategy.
