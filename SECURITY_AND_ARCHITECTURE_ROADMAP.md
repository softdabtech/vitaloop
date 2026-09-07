# VITALOOP Security & Architecture Roadmap
**Date:** September 7, 2026  
**Phase:** Post-Initial Security Fixes  
**Status:** Planning Next Priorities

---

## COMPLETED (Sep 7, 2026) ✅

- ✅ GDPR User Deletion Cascade
- ✅ Audit Logging PII Protection  
- ✅ SSL/DB Connection Resilience
- ✅ 835 tests passing

---

## NEXT PRIORITIES (Ranked by Risk & Impact)

### PHASE 1: CRITICAL SECURITY (Week 1-2)

#### 1.1 IDOR/BOLA Audit - CRITICAL
**Risk Level:** 🔴 CRITICAL  
**Effort:** 4-6 hours  
**Impact:** Prevent unauthorized data access

**Scope:**
- Audit all GET/PUT/DELETE endpoints with UUID parameters
- Verify user_id ownership checks on every endpoint
- Check: `/results/{id}`, `/insights/{id}`, `/uploads/{id}`, etc.
- Pattern: Every query must include `.eq("user_id", current_user_id)`

**Files to Review:**
```
backend/app/routers/analysis/analyze.py
backend/app/routers/analysis/insights.py
backend/app/routers/analysis/uploads.py
backend/app/routers/analysis/protocols.py
backend/app/routers/analysis/checkins.py
```

**Test Strategy:**
- Write test_idor_protection.py with negative cases
- Try accessing other user's data with cross-user IDs
- Verify 403/404 on unauthorized access

---

#### 1.2 Brute Force Protection - HIGH
**Risk Level:** 🟡 HIGH  
**Effort:** 2-3 hours  
**Impact:** Prevent credential compromise

**Current Status:** Unknown (likely missing)

**Implementation:**
```python
# backend/app/middleware/rate_limiting.py
# Add to login endpoint: 
# - 3 failed attempts = 15 min lockout
# - Log failed attempts with IP + email

@app.post("/auth/login")
@rate_limit(max_attempts=3, lockout_minutes=15)
async def login(credentials: LoginRequest):
    # Check if user is locked out
    # Log failed attempt
    # Return 429 Too Many Requests if locked
```

**Files to Create:**
- `backend/app/middleware/brute_force_protection.py`
- `backend/tests/test_brute_force_protection.py`

---

#### 1.3 Admin Routes Authorization - HIGH
**Risk Level:** 🟡 HIGH  
**Effort:** 2-3 hours  
**Impact:** Prevent unauthorized admin access

**Current Status:** Unknown (may have hidden UI buttons without backend checks)

**Implementation:**
```python
# backend/app/dependencies.py
async def require_super_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Verify user is super admin (backend check, not just JWT)"""
    supabase = _get_supabase()
    
    # Query database to verify admin role
    admin_check = await _run(
        lambda: supabase.table("user_roles")
        .select("*")
        .eq("user_id", current_user["sub"])
        .eq("role", "super_admin")
        .limit(1)
        .execute()
    )
    
    if not admin_check.data:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return current_user
```

**Tests:**
- test_admin_routes_require_auth.py
- Verify non-admin gets 403
- Verify admin gets 200

---

### PHASE 2: DATA PROTECTION (Week 2-3)

#### 2.1 Database Query Logging Audit - MEDIUM
**Risk Level:** 🟡 MEDIUM  
**Effort:** 1-2 hours  
**Impact:** Ensure no PII in DB logs

**Action:**
1. Check Supabase logging configuration
2. Verify query logging doesn't capture parameter values
3. Create test to confirm sensitive data not logged

---

#### 2.2 Secrets Rotation - MEDIUM
**Risk Level:** 🟡 MEDIUM  
**Effort:** 3-4 hours (after setup)  
**Impact:** Limit blast radius of key exposure

**Implementation:**
```
- OpenAI API key rotation every 90 days
- Supabase service key rotation
- Database credentials rotation (Supabase)
- Create automated rotation script
```

---

#### 2.3 Frontend Secrets Audit - MEDIUM
**Risk Level:** 🟡 MEDIUM  
**Effort:** 1-2 hours  
**Impact:** Prevent accidental key leakage to frontend

**Checks:**
```bash
# Should NOT find these in frontend:
grep -r "sk_" frontend/src --include="*.js" --include="*.jsx"
grep -r "SERVICE_ROLE" frontend/src
grep -r "SUPABASE_SERVICE_KEY" frontend/src

# Should ONLY have:
grep -r "VITE_SUPABASE_ANON_KEY" frontend/src  # OK
grep -r "VITE_SUPABASE_URL" frontend/src       # OK
grep -r "VITE_OPENAI_KEY" frontend/src         # WARN - should be backend only
```

---

### PHASE 3: INFRASTRUCTURE (Week 3-4)

#### 3.1 Redis Caching Security - MEDIUM
**Risk Level:** 🟡 MEDIUM  
**Effort:** 2-3 hours  
**Impact:** Secure cache layer

**Checks:**
- [ ] Redis requires authentication (ACL/password)
- [ ] Redis only accessible from backend (no public access)
- [ ] Cached data doesn't include PII
- [ ] Cache invalidation on sensitive updates

---

#### 3.2 CORS Configuration - MEDIUM
**Risk Level:** 🟡 MEDIUM  
**Effort:** 1 hour  
**Impact:** Prevent cross-origin attacks

**Current:** From environment (GOOD)  
**Verify:**
```python
# backend/app/main.py
CORSMiddleware(
    allow_origins=settings.cors_allowed_origins,  # Not "*"
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

---

#### 3.3 Security Headers Complete Audit - LOW
**Risk Level:** 🟢 LOW  
**Effort:** 1-2 hours  
**Impact:** Defense in depth

**Current Headers (verify):**
- [x] CSP: "default-src 'none'; frame-ancestors 'none'" 
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] HSTS: max-age=31536000

**Add:**
- [ ] X-Permitted-Cross-Domain-Policies: none
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy: geolocation=(), microphone=(), camera=()

---

### PHASE 4: COMPLIANCE & MONITORING (Week 4+)

#### 4.1 Audit Logging Expansion - MEDIUM
**Current:** ✅ Structure verified  
**Enhancements:**
- [ ] Log all authentication attempts (success + failure)
- [ ] Log data exports (medical history downloads)
- [ ] Log admin actions (user suspension, data access)
- [ ] Log API key usage (which app/token accessed what)

---

#### 4.2 Intrusion Detection - LOW (Future)
**Risk Level:** 🟢 LOW  
**Effort:** 8+ hours  
**Impact:** Detect and alert on suspicious activity

**Future considerations:**
```
- Detect: Multiple failed login attempts from same IP
- Detect: Unusual data access patterns (export all data)
- Detect: Rate limit spikes
- Detect: SQL injection attempts
- Alert: Send to Slack/email on suspicious activity
```

---

#### 4.3 Penetration Testing - MEDIUM (After Phase 3)
**Risk Level:** 🟡 MEDIUM  
**Effort:** 8+ hours (external)  
**Impact:** Find unknown vulnerabilities

**Plan:**
1. Complete all Phase 1-3 fixes
2. Hire security firm for PT
3. Fix any findings
4. Document and publish security policy

---

## QUICK WIN FIXES (Can do immediately)

```
⏱️ 15 min:  Add X-Permitted-Cross-Domain-Policies header
⏱️ 30 min:  Add Referrer-Policy header  
⏱️ 1 hour:  Audit all /admin routes for authorization
⏱️ 1 hour:  Create IDOR test suite skeleton
⏱️ 2 hours: Implement brute force protection
```

---

## ARCHITECTURE IMPROVEMENTS

### A1. Cache Layer Optimization
**Current:** Redis (if configured)  
**Improvement:**
- [ ] Cache invalidation strategy per entity
- [ ] Cache TTL tuning (biomarkers vs insights)
- [ ] Cache warming on startup

### A2. Database Connection Pooling
**Current:** Via Supabase  
**Check:**
- [ ] Connection pool size optimal
- [ ] Connection timeout settings
- [ ] Pool exhaustion monitoring

### A3. API Rate Limiting Enhancement
**Current:** Configured (60/30/30)  
**Improvement:**
- [ ] User-based limits (premium: higher limit)
- [ ] IP-based limits (prevent scanning)
- [ ] Endpoint-specific limits (expensive ops: lower)

### A4. Error Handling & Logging
**Current:** Basic logging  
**Improvement:**
- [ ] Structured logging (JSON format)
- [ ] Error tracking with Sentry (if not already)
- [ ] Request tracing (correlation IDs)
- [ ] Performance monitoring (slow queries)

### A5. Database Query Optimization
**Future Audit:**
- [ ] Identify N+1 query problems
- [ ] Add missing database indexes
- [ ] Optimize complex biomarker queries

---

## RECOMMENDED EXECUTION ORDER

```
Week 1:
  Day 1-2: IDOR/BOLA audit + fix
  Day 3:   Brute force protection
  Day 4:   Admin authorization audit
  Day 5:   Testing & deployment

Week 2:
  Day 1-2: Database logging audit
  Day 3-4: Frontend secrets audit
  Day 5:   Quick win header additions

Week 3:
  Day 1-2: Redis caching security
  Day 3:   CORS configuration verify
  Day 4:   Security headers complete
  Day 5:   Audit logging expansion

Week 4+:
  Intrusion detection (if priority)
  Penetration testing (before production)
```

---

## SUCCESS METRICS

✅ PHASE 1 (Critical): All IDOR vulnerabilities closed, brute force protected  
✅ PHASE 2 (Data): No PII leakage, secrets managed, frontend clean  
✅ PHASE 3 (Infra): CORS/headers/caching secure, monitoring enabled  
✅ PHASE 4 (Compliance): Complete audit trail, ready for security audit  

---

## TESTING STRATEGY

For each fix:
1. Write unit tests (happy path + edge cases)
2. Write negative tests (unauthorized access = 403)
3. Manual testing on staging
4. Production canary (1% of users)
5. Full production rollout

---

## DOCUMENTATION

- [ ] Create SECURITY_POLICY.md for users
- [ ] Create SECURITY_ARCHITECTURE.md for developers
- [ ] Update API docs with security requirements
- [ ] Create incident response runbook

---

## BLOCKERS & DEPENDENCIES

- Stripe: Waiting for company account (skip webhook security for now)
- Wearables: Out of scope
- Lab booking: Out of scope
- MFA: Can be added later (not MVP critical)

---

**Next Step:** Choose which PHASE 1 item to start with!
