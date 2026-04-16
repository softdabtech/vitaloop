# Redis Rate Limiter Plan (Phase 0 -> Phase 1 Bridge)

## Goal
Replace in-process limiter state with Redis-backed shared state so limits remain correct across multiple backend instances.

## Why
- Current limiter is process-local and can be bypassed when traffic is distributed.
- Multi-instance deployment needs a shared counter store.

## Proposed Approach
1. Keep current `PathRateLimitMiddleware` interface.
2. Add limiter backend abstraction:
   - `InMemoryLimiterBackend` (current default)
   - `RedisLimiterBackend` (new)
3. Use atomic Redis script for fixed-window counters:
   - Key pattern: `rl:{prefix}:{ip}:{window_start}`
   - `INCR` + `EXPIRE` in one operation.
4. Preserve current response contract:
   - `429`
   - JSON `{ "detail": "Rate limit exceeded", "code": "RATE_LIMITED" }`
   - `Retry-After` header.

## Config Additions (planned)
- `RATE_LIMIT_BACKEND=inmemory|redis`
- `RATE_LIMIT_REDIS_URL=redis://...`
- `RATE_LIMIT_REDIS_PREFIX=rl`

## Rollout Steps
1. Implement backend abstraction and Redis backend.
2. Keep `inmemory` as default for local/dev.
3. Enable `redis` in staging and run abuse tests.
4. Enable `redis` in production behind feature flag.
5. Monitor 429 rates and latency impact.

## Risks
- Redis availability impacts request path.
  - Mitigation: fail-open with warning, plus SLO alerting.
- Clock/window edge behavior differences.
  - Mitigation: integration tests around boundary seconds.

## Acceptance Criteria
- Rate limit behavior consistent with current contract.
- Multi-instance traffic cannot bypass configured limits.
- Added integration tests for auth/analyze/protocol prefixes.
