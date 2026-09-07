# VITALOOP Security Audit Checklist
**Date:** 2026-06-10  
**Status:** Pre-Production Security Review  
**Scope:** 13 core + 13 extended security domains

---

## CORE SECURITY (13 Mandatory Areas)

### 1. AUTHENTICATION
**Focus:** Brute force, weak passwords, MFA, login rate limiting

- [ ] **Brute Force Protection**
  - Status: ⚠️ UNKNOWN - Need to check FastAPI auth endpoints
  - Files to check: `backend/app/routers/auth.py`, `backend/app/dependencies.py`
  - Required: Rate limiting on login attempts (3 fails = 15min lockout)
  - Action: Implement slowapi or similar

- [ ] **Password Validation**
  - Status: ⚠️ UNKNOWN
  - Required: Min 12 chars, uppercase, digits, special chars
  - Supabase handles this: YES/NO?
  - Action: Verify Supabase password policy

- [ ] **MFA Support**
  - Status: ❌ NOT FOUND
  - Files searched: No MFA implementation found
  - Required: Optional MFA for accounts (TOTP)
  - Action: Add MFA support (non-critical for MVP, but flag it)

- [ ] **Session Timeout**
  - Status: ✅ MENTIONED in memory
  - File: Session timeout implemented in API client
  - Verify: Check exact timeout values (should be 15-30 min for health data)

---

### 2. AUTHORIZATION / Broken Access Control
**Focus:** IDOR, BOLA, ownership checks, role checks

- [ ] **IDOR Protection**
  - Status: ⚠️ CRITICAL TO CHECK
  - Vulnerability: Users accessing other users' uploads by ID
  - Files to check: 
    - `backend/app/routers/analysis/uploads.py`
    - `backend/app/routers/analysis/insights.py`
  - Required: Every GET/PUT/DELETE must verify user_id
  - Action: Audit all endpoints with UUID parameters

- [ ] **Ownership Verification**
  - Status: ⚠️ NEED TO VERIFY
  - Pattern: `await db.query("SELECT * FROM uploads WHERE id = ? AND user_id = ?", [id, current_user_id])`
  - Check: Do all endpoints do this?
  - Action: Grep for missing user_id checks

- [ ] **Role-Based Access Control**
  - Status: ✅ PARTIALLY DONE
  - Implementation: `@Depends(require_active_subscription)` for premium features
  - Check: Are all premium endpoints protected?
  - Missing: Admin role (for super admin operations)
  - Action: Create admin dependency, audit admin endpoints

- [ ] **Premium Tier Gating**
  - Status: ✅ IMPLEMENTED
  - Pattern: 402 Payment Required for free tier overflow
  - Verify: check-ins, insights, progress endpoints
  - Action: Audit all premium features

---

### 3. ADMIN SECURITY
**Focus:** Backend authorization vs hidden UI buttons

- [ ] **Admin Routes Protected**
  - Status: ⚠️ NEED TO CHECK
  - Files to check: `backend/app/routers/admin/`
  - Required: Admin routes must check role in backend, NOT just hide UI
  - Action: Find all /admin routes and verify authorization

- [ ] **Super Admin Dependency**
  - Status: ⚠️ UNKNOWN
  - Required: `@Depends(require_super_admin)` decorator
  - Check: `backend/app/dependencies_crm.py`
  - Action: Verify it checks user role in database, not just JWT claim

- [ ] **Admin Action Logging**
  - Status: ❌ UNKNOWN IF EXISTS
  - Required: All admin actions logged (who did what when)
  - Action: Check if admin logs exist

---

### 4. SECRETS MANAGEMENT
**Focus:** API keys, DB credentials, .env, Git history

- [ ] **Environment Variables**
  - Status: ⚠️ PARTIAL
  - Check: `backend/.env` exists but what about frontend?
  - Verified: Database credentials should NOT be in frontend
  - Action: Verify no secrets in frontend/.env

- [ ] **API Keys in Code**
  - Status: ⚠️ CRITICAL TO CHECK
  - Action: `grep -r "sk_\|pk_\|apiKey\|api_key" backend/app --include="*.py" | grep -v "settings."`
  - Required: All keys should come from `settings.py` (env vars)

- [ ] **Git History Cleanup**
  - Status: ❌ UNKNOWN
  - Action: `git log -p backend/app | grep -i "password\|key\|secret" | head`
  - If found: Use `git-filter-branch` or `bfg-repo-cleaner`

- [ ] **Supabase Service Role in Frontend**
  - Status: ❌ CRITICAL - Do NOT expose service role to frontend
  - Check: Frontend should use anon key only, never service role
  - Action: Audit `frontend/src/lib/supabase.js`

- [ ] **Stripe Keys**
  - Status: ⚠️ UNKNOWN
  - Required: Publishable key in frontend OK, secret key ONLY in backend
  - Action: Check `backend/app/routers/billing/`

---

### 5. DATABASE SECURITY
**Focus:** Minimal privileges, no direct frontend access

- [ ] **RLS (Row Level Security)**
  - Status: ✅ LIKELY IMPLEMENTED (Supabase enforces it)
  - Check: Verify RLS policies exist on all tables
  - Files: `backend/sql/*.sql`
  - Required: Every table should have RLS policies per user_id
  - Action: Audit SQL migrations for RLS

- [ ] **Minimal Database Privileges**
  - Status: ⚠️ UNKNOWN
  - Check: Does backend user have only SELECT/INSERT/UPDATE/DELETE?
  - Not needed: ALTER TABLE, DROP, CREATE
  - Action: Review Supabase database role

- [ ] **No Direct Frontend DB Access**
  - Status: ✅ CORRECT
  - Frontend uses API, not direct Supabase SQL
  - Verify: `frontend/src/lib/api.js` uses `/api/` endpoints

- [ ] **Sensitive Data Not in Supabase Logs**
  - Status: ❌ NEED TO CHECK
  - Risk: Passwords, medical data appearing in query logs
  - Action: Verify Supabase query logging doesn't log sensitive parameters

---

### 6. SQL INJECTION
**Focus:** Parameterized queries / ORM

- [ ] **Parameterized Queries**
  - Status: ✅ MOSTLY SAFE (using Supabase client)
  - Check: FastAPI routes should use `supabase.table().select().eq()`
  - NOT safe: String interpolation like `f"SELECT * FROM users WHERE id = {id}"`
  - Action: Grep for f-strings with SQL

- [ ] **ORM Usage**
  - Status: ✅ USING SUPABASE CLIENT (not raw SQL)
  - Pattern: `await supabase.table("uploads").select().eq("id", upload_id).execute()`
  - This is parameterized: YES
  - Action: Verify no raw SQL queries in app code

---

### 7. PAYMENT SECURITY
**Focus:** Webhook signature verification, server-side payment state

- [ ] **Webhook Signature Verification**
  - Status: ⚠️ CRITICAL TO CHECK
  - Files: `backend/app/routers/billing/stripe_router.py`
  - Required: Every webhook must verify Stripe signature
  - Action: Check `_verify_stripe_signature()` function

- [ ] **Server-Side Payment State**
  - Status: ⚠️ NEED TO VERIFY
  - Required: Subscription status checked in database, not JWT
  - Pattern: `SELECT is_premium FROM users WHERE id = ? AND subscription_status = 'active'`
  - Action: Verify premium gating checks database state

- [ ] **Idempotent Webhooks**
  - Status: ⚠️ UNKNOWN
  - Required: Same webhook shouldn't charge twice if received twice
  - Action: Check if webhook has idempotency key handling

- [ ] **No Client-Side Payment Verification**
  - Status: ⚠️ NEED TO CHECK
  - Risk: Frontend saying "you're premium" without backend verification
  - Action: Verify frontend doesn't trust JWT claim alone

---

### 8. DEPENDENCIES / SUPPLY CHAIN
**Focus:** CVE, npm/pip dependencies, Dependabot/Snyk

- [ ] **Dependency Scanning**
  - Status: ⚠️ UNKNOWN
  - Required: Regular `npm audit`, `pip check`
  - Action: Run these now
  - Tools to add: Dependabot, Snyk, or OSV-Scanner

- [ ] **Vulnerable Dependencies**
  - Status: ⚠️ UNKNOWN
  - Action: `npm audit --audit-level=moderate` in frontend
  - Action: `safety check` in backend

- [ ] **Pinned Versions**
  - Status: ⚠️ NEED TO CHECK
  - Check: `package-lock.json`, `requirements.txt`
  - Required: All versions should be pinned (not `^1.0.0`)
  - Action: Verify no floating version numbers

---

### 9. SESSIONS & TOKENS
**Focus:** Cookie security, token theft, expiration, rotation, revocation

- [ ] **JWT Token Expiration**
  - Status: ⚠️ UNKNOWN
  - Required: Access token < 15 min, refresh token < 7 days
  - Check: `backend/app/services/supabase_service.py`
  - Action: Verify token TTL settings

- [ ] **Secure Cookies**
  - Status: ⚠️ UNKNOWN
  - If using cookies: httpOnly=true, Secure=true, SameSite=Strict
  - Check: Supabase auth session handling
  - Action: Verify cookie flags in auth middleware

- [ ] **Token Revocation**
  - Status: ⚠️ UNKNOWN
  - Required: Ability to logout (invalidate all sessions)
  - Action: Check if Supabase supports session revocation

- [ ] **Token Rotation**
  - Status: ⚠️ UNKNOWN
  - Advanced: Refresh token should return new refresh token each time
  - Action: Check Supabase refresh token behavior

---

### 10. XSS-RELATED TOKEN EXPOSURE
**Focus:** Don't store critical tokens where JavaScript can read them

- [ ] **JWT Storage Location**
  - Status: ⚠️ NEED TO CHECK
  - Safe: HttpOnly cookies (JS can't read)
  - Unsafe: localStorage (vulnerable to XSS)
  - Check: `frontend/src/lib/api.js` - where is token stored?
  - Action: Verify token is in HttpOnly cookie or sessionStorage

- [ ] **Long-Lived Tokens in localStorage**
  - Status: ❌ DO NOT DO THIS
  - If refresh token stored in localStorage + XSS = account takeover
  - Action: Verify refresh token NOT in localStorage

- [ ] **XSS Protection (CSP Headers)**
  - Status: ⚠️ UNKNOWN
  - Required: Content-Security-Policy header to prevent inline scripts
  - Action: Check `backend/app/main.py` for security headers

---

### 11. SSRF (Server-Side Request Forgery)
**Focus:** URL fetch, avatars, imports, webhooks, remote files

- [ ] **PDF Upload Processing**
  - Status: ⚠️ CRITICAL TO CHECK
  - File: `backend/app/services/pdf_parser.py`
  - Risk: Can attacker upload malicious PDF that fetches internal URLs?
  - Action: Verify PDF parser doesn't fetch remote URLs

- [ ] **Avatar Upload**
  - Status: ⚠️ UNKNOWN
  - Risk: Can attacker provide URL like `http://169.254.169.254/` (AWS metadata)?
  - Required: Only allow file uploads, not URLs
  - Action: Check `frontend/src/pages/UserProfile.jsx`

- [ ] **Webhook URL Validation**
  - Status: ⚠️ UNKNOWN
  - Risk: Can attacker register webhook to internal IP?
  - Required: Whitelist allowed webhook domains
  - Action: Check admin webhook configuration

- [ ] **No Arbitrary URL Fetching**
  - Status: ⚠️ CHECK ALL
  - Grep: `requests.get()`, `httpx.get()`, `curl` in backend
  - Required: Validate all URLs, blacklist internal ranges (127.0.0.1, 10.0.0.0/8, 172.16.0.0/12)
  - Action: Create `is_safe_url()` helper function

---

### 12. BACKUPS & RECOVERY
**Focus:** PITR, restore testing, independent backups

- [ ] **Automated Backups**
  - Status: ⚠️ UNKNOWN
  - Required: Daily backups of Supabase database
  - Action: Check Supabase backup settings

- [ ] **Point-in-Time Recovery (PITR)**
  - Status: ⚠️ UNKNOWN
  - Required: Ability to restore to any point in last 7 days
  - Action: Verify Supabase PITR enabled

- [ ] **Restore Testing**
  - Status: ❌ NOT DONE
  - Required: Monthly test restore to verify backups work
  - Action: Schedule monthly restore tests

- [ ] **Independent Backups**
  - Status: ⚠️ UNKNOWN
  - Recommended: Separate backup storage (S3, different region)
  - Action: Set up automated backup to S3

- [ ] **Encryption at Rest**
  - Status: ⚠️ UNKNOWN
  - Check: Supabase encryption settings
  - Action: Verify database encrypted at rest

---

### 13. MONITORING / INCIDENT RESPONSE
**Focus:** Audit logs, anomalous activity, alerts, ability to revoke keys

- [ ] **Audit Logging**
  - Status: ⚠️ UNKNOWN
  - Required: Log all sensitive actions (login, password reset, payment, permission changes)
  - Action: Check `backend/app/services/audit_log.py` if exists

- [ ] **Anomaly Detection**
  - Status: ❌ NOT IMPLEMENTED
  - Examples: Multiple failed logins, unusual API usage, geographic impossibility
  - Action: Consider adding Sentry alerts

- [ ] **Alert System**
  - Status: ⚠️ PARTIAL
  - Check: Sentry, email alerts configured?
  - Required: Alerts for failed logins, API errors, payment failures
  - Action: Configure alert thresholds

- [ ] **Key Revocation**
  - Status: ⚠️ UNKNOWN
  - Required: Ability to revoke API keys, sessions without full redeploy
  - Action: Check admin API key management

- [ ] **Incident Response Plan**
  - Status: ❌ NOT FOUND
  - Required: Plan for breach (who to notify, steps to take)
  - Action: Create incident response runbook

---

## EXTENDED SECURITY (13 Additional Domains)

### 14. CSRF (Cross-Site Request Forgery)

- [ ] **CSRF Tokens**
  - Status: ⚠️ UNKNOWN
  - Frontend forms should include CSRF token for state-changing operations
  - Check: POST endpoints verify origin
  - Action: Verify Supabase auth handles CSRF

- [ ] **SameSite Cookies**
  - Status: ⚠️ UNKNOWN
  - Required: `SameSite=Strict` for session cookies
  - Action: Check auth cookie settings

---

### 15. XSS (Cross-Site Scripting)

- [ ] **Output Encoding**
  - Status: ⚠️ LIKELY SAFE (React auto-escapes)
  - Check: No `dangerouslySetInnerHTML` usage
  - Action: Grep for dangerous patterns

- [ ] **Content-Security-Policy Header**
  - Status: ❌ NOT FOUND
  - Required: `Content-Security-Policy: default-src 'self'; script-src 'self'`
  - Action: Add CSP header in backend

- [ ] **User Input Sanitization**
  - Status: ⚠️ CHECK
  - Risk: User can enter `<script>alert('xss')</script>` in symptom text?
  - Action: Verify all user input sanitized

---

### 16. CORS (Cross-Origin Resource Sharing)

- [ ] **CORS Configuration**
  - Status: ⚠️ UNKNOWN
  - Check: `backend/app/main.py`
  - Required: Only allow vitaloop.today, not `*`
  - Action: Verify CORS whitelist

- [ ] **Credentials in CORS**
  - Status: ⚠️ UNKNOWN
  - Required: `allow_credentials=True` only with specific origins
  - Action: Audit CORS settings

---

### 17. Security Headers

- [ ] **X-Frame-Options**
  - Status: ❌ UNKNOWN
  - Required: `X-Frame-Options: DENY` (prevent clickjacking)
  - Action: Add to FastAPI middleware

- [ ] **X-Content-Type-Options**
  - Status: ❌ UNKNOWN
  - Required: `X-Content-Type-Options: nosniff`
  - Action: Add to middleware

- [ ] **Strict-Transport-Security (HSTS)**
  - Status: ❌ UNKNOWN
  - Required: `Strict-Transport-Security: max-age=31536000` for HTTPS
  - Action: Add to middleware

- [ ] **X-XSS-Protection**
  - Status: ❌ UNKNOWN
  - Required: `X-XSS-Protection: 1; mode=block`
  - Action: Add to middleware

---

### 18. File Upload Security

- [ ] **File Type Validation**
  - Status: ⚠️ PARTIAL
  - Check: PDF uploads validated?
  - Required: Check file magic bytes, not just extension
  - Files: `backend/app/services/pdf_parser.py`
  - Action: Verify MIME type checking

- [ ] **File Size Limits**
  - Status: ⚠️ UNKNOWN
  - Required: Max PDF size (e.g., 50MB)
  - Action: Add file size validation

- [ ] **Filename Sanitization**
  - Status: ⚠️ UNKNOWN
  - Risk: Filename like `../../../etc/passwd.pdf`
  - Required: Use UUID for stored filenames
  - Action: Verify filenames are UUIDs, not user input

- [ ] **Quarantine/Scan Uploads**
  - Status: ❌ NOT IMPLEMENTED
  - Recommended: Scan uploads with ClamAV or similar
  - Action: Consider for sensitive health data

---

### 19. Path Traversal

- [ ] **No Path Concatenation**
  - Status: ⚠️ CHECK
  - Risk: `/api/file?path=../../etc/passwd`
  - Required: Never concatenate user input to file paths
  - Action: Grep for path operations

---

### 20. Unrestricted API Consumption (DoS)

- [ ] **Rate Limiting**
  - Status: ⚠️ UNKNOWN
  - Required: Per-user or per-IP rate limits
  - Tools: FastAPI + slowapi
  - Action: Implement rate limiting (100 req/min per user)

- [ ] **Query Complexity Limits**
  - Status: ⚠️ UNKNOWN
  - Risk: User requests all biomarkers for all uploads (expensive query)
  - Action: Add pagination, query depth limits

- [ ] **API Quota Per User**
  - Status: ✅ PARTIALLY (free tier limited uploads)
  - Check: Are check-ins limited per user per day?
  - Action: Verify quota enforcement

---

### 21. Mass Assignment / Over-Posting

- [ ] **Input Validation**
  - Status: ⚠️ LIKELY SAFE (Pydantic models)
  - Check: Do POST endpoints accept only expected fields?
  - Example: Can user set `is_admin=true` in their profile?
  - Action: Audit Pydantic schemas for all endpoints

---

### 22. JWT Validation

- [ ] **JWT Signature Verification**
  - Status: ✅ LIKELY (Supabase verifies)
  - Check: `backend/app/dependencies.py` verifies JWT
  - Action: Verify signature validation enabled

- [ ] **JWT Claims Validation**
  - Status: ⚠️ CHECK
  - Required: Verify `user_id` claim matches requesting user
  - Action: Ensure claims are validated

- [ ] **JWT Algorithm**
  - Status: ⚠️ UNKNOWN
  - Required: Use RS256 (asymmetric), not HS256 (symmetric)
  - Action: Check Supabase JWT algorithm

---

### 23. Password Reset Flaws

- [ ] **Secure Reset Link**
  - Status: ⚠️ UNKNOWN
  - Required: Reset link has 30-min expiration, random token
  - Action: Check password reset implementation

- [ ] **No Username/Email Enumeration**
  - Status: ⚠️ NEED TO CHECK
  - Risk: "User not found" vs "Reset sent" reveals if email registered
  - Required: Both cases should say "If account exists, we sent email"
  - Action: Verify auth endpoints don't leak user existence

---

### 24. Email Enumeration

- [ ] **Consistent Auth Messages**
  - Status: ⚠️ NEED TO CHECK
  - Required: Login and password reset should not distinguish between:
    - User doesn't exist
    - User exists, wrong password
  - Action: Audit auth endpoints

---

### 25. Open Redirects

- [ ] **No Redirect Parameter**
  - Status: ⚠️ UNKNOWN
  - Risk: `/login?redirect=http://evil.com` redirects after login
  - Required: Only redirect to whitelisted domains
  - Action: Audit any redirect logic

---

### 26. Race Conditions

- [ ] **Atomic Operations**
  - Status: ⚠️ CHECK PAYMENT LOGIC
  - Risk: Two requests process payment simultaneously
  - Required: Database transactions for payment processing
  - Action: Audit Stripe webhook handling

---

### 27. Object Storage Permissions

- [ ] **S3 / Storage Bucket ACLs**
  - Status: ⚠️ UNKNOWN
  - Check: Supabase Storage permissions
  - Required: Uploads should be private, not public by default
  - Action: Verify bucket policies

---

### 28. Supabase RLS (Row Level Security)

- [ ] **RLS Policies Comprehensive**
  - Status: ⚠️ NEED FULL AUDIT
  - Required: Every table has RLS policies
  - Examples:
    - `users` table: users can only read/update their own row
    - `uploads` table: users can only read uploads where user_id = auth.uid()
    - `biomarkers` table: can only read own biomarkers
  - Action: Full RLS policy audit in SQL files

---

## MEDICAL/HEALTH DATA SPECIFIC (HIPAA-adjacent)

### 29. PII / Health Data Exposure

- [ ] **No PII in Logs**
  - Status: ⚠️ CRITICAL FOR HEALTH DATA
  - Risk: Symptoms like "HIV test", "diabetes" in logs = privacy breach
  - Action: Audit all logs, remove PII/sensitive health info

- [ ] **No Sensitive Data in Error Messages**
  - Status: ⚠️ CHECK
  - Risk: Error like "No test results found for upload_123" reveals user actions
  - Action: Generic error messages ("Something went wrong")

- [ ] **No Biomarker Values in Analytics**
  - Status: ⚠️ UNKNOWN
  - Risk: Sending biomarker values to Sentry/Google Analytics
  - Action: Audit what data is sent to 3rd party services

---

### 30. Document Upload / PDF Processing

- [ ] **PDF Malware Scanning**
  - Status: ❌ NOT IMPLEMENTED
  - Required: Scan uploaded PDFs for malware
  - Action: Add ClamAV or similar

- [ ] **PDF Parsing Safety**
  - Status: ⚠️ CHECK
  - Risk: Malicious PDF crashes parser (DoS)
  - File: `backend/app/services/pdf_parser.py`
  - Action: Verify safe PDF parsing (timeouts, resource limits)

---

### 31. LLM Data Flow

- [ ] **No Sensitive Data to Claude**
  - Status: ⚠️ CRITICAL
  - Risk: Sending biomarker values + symptoms to Claude API
  - Check: `backend/app/services/claude_service.py`
  - Action: Verify only non-sensitive data sent to LLM (patterns, not values)

- [ ] **Claude API Logs**
  - Status: ⚠️ UNKNOWN
  - Required: Understand Anthropic's data retention policy
  - Action: Review Anthropic privacy policy before using for health data

---

### 32. Admin Access

- [ ] **Admin Audit Trail**
  - Status: ❌ NOT FOUND
  - Required: All admin actions logged (view user data, delete account)
  - Action: Create admin audit log table

- [ ] **No Shared Admin Accounts**
  - Status: ⚠️ UNKNOWN
  - Required: Each admin has own account, no shared passwords
  - Action: Verify admin account policy

---

### 33. User Data Deletion

- [ ] **Right to Be Forgotten**
  - Status: ⚠️ UNKNOWN
  - Required: User can request full deletion
  - Action: Implement cascade delete for user data

- [ ] **Backup Retention After Deletion**
  - Status: ⚠️ UNKNOWN
  - Required: Define how long deleted data kept in backups
  - Action: Set backup retention policy (e.g., 30 days post-delete)

---

## SUMMARY & PRIORITY

### 🔴 CRITICAL (Do Before Production)

```
1. Authentication - Rate limiting on login
2. Authorization - Audit all endpoints for IDOR
3. Payment Security - Verify webhook signatures
4. SQL Injection - Grep for unsafe queries
5. Secrets Management - Ensure no keys in code/git
6. Security Headers - Add to backend
7. SSRF - Validate URLs in PDF processing
8. RLS - Full audit of all table policies
9. Health Data Security - No PII in logs
10. LLM Data Flow - Don't send biomarker values to Claude
```

### 🟡 HIGH (Before Launch)

```
1. Session/Token Security - Verify JWT settings
2. CSRF Protection - Check CORS config
3. Rate Limiting - API quota enforcement
4. File Upload - MIME type validation
5. Monitoring - Set up Sentry alerts
6. User Deletion - Implement cascade delete
7. Audit Logging - Log sensitive actions
```

### 🟢 MEDIUM (Plan for v1.1)

```
1. MFA Support
2. Backup Testing
3. Malware Scanning for PDFs
4. Incident Response Plan
5. Advanced Rate Limiting
```

---

## NEXT STEPS

**This week:**
1. Run `/security-review` on backend
2. Audit all endpoints for IDOR (check user_id verification)
3. Verify RLS policies in Supabase
4. Check for secrets in git history
5. Add security headers middleware

**This sprint:**
1. Implement rate limiting
2. Add audit logging
3. Webhook signature verification
4. PDF processing safety

**Before production:**
1. Full penetration test
2. Medical data compliance review (HIPAA-adjacent)
3. Security headers complete
4. Monitoring/alerting active

---

**Status:** Need detailed code audit  
**Confidence:** Many areas unknown - requires investigation  
**Risk Level:** HIGH for production health data service
