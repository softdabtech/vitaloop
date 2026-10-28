# VITALOOP Security Fixes - Priority Execution Plan
**Date:** 2026-09-07  
**Status:** Ready to Execute  
**Server Status:** Backend running ✅

---

## FINDINGS FROM PRODUCTION AUDIT

### ✅ ALREADY SECURE
1. **IDOR Protection** - All endpoints verify user_id
   - `/results/{id}` → `assert_upload_belongs_to_user()`
   - `/insights/{id}` → `.eq("user_id", user_id)` filter
   
2. **Rate Limiting** - Implemented and configured
   - /auth: 60 req/min
   - /analyze: 30 req/min
   - /protocol: 30 req/min

3. **Security Headers** - Implemented
   - CSP: "default-src 'none'; frame-ancestors 'none'"
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - HSTS: max-age=31536000

4. **CORS** - Configured from environment (not wildcard)

5. **Authorization** - Premium tier gating with 402 responses

### ⚠️ NEEDS ATTENTION

1. **LLM Data Flow**
   - ⚠️ Biomarker VALUES sent to Claude API
   - File: `backend/app/services/claude_service.py:649`
   - Line: `prompt = EXTRACT_PROMPT.replace("{lab_text}", text)`
   - Issue: `text` contains raw lab values (e.g., "Ferritin: 18 ng/ml")
   - Fix: Need to verify Anthropic privacy policy + consider redaction

2. **Stripe Errors** 
   - ⚠️ 500 errors on `/webhooks/stripe`
   - Issue: Webhook handler failing (need to investigate)
   - Status: **SKIP** (no Stripe company account yet)

3. **Audit Logging**
   - ⚠️ SSL connection errors in logs
   - File: `backend-error.log`
   - Error: "EOF occurred in violation of protocol (_ssl.c:2426)"
   - Issue: Possible DB connection issue (Supabase)

4. **User Deletion**
   - ❌ No cascade delete implemented
   - Missing: When user deletes account, delete all related data
   - Action: Implement delete_user_cascade() function

---

## IMMEDIATE FIXES (Next 24 hours)

### FIX #1: VERIFY ANTHROPIC PRIVACY & CONSIDER REDACTION

**File:** `backend/app/services/claude_service.py`

**Action:**
```python
# Option A: Check Anthropic's data retention policy
# https://www.anthropic.com/privacy

# Option B: Implement redaction for sensitive values
def redact_sensitive_lab_text(text: str) -> str:
    """Remove actual biomarker values, keep only structure"""
    # Example: "Ferritin: 18 ng/ml" → "Ferritin: [VALUE] ng/ml"
    import re
    
    # Pattern: marker_name: number unit
    redacted = re.sub(
        r'([\w\s]+):\s*[\d.]+\s*(ng/ml|mg/dl|mmol/l|etc)',
        r'\1: [VALUE] \2',
        text,
        flags=re.IGNORECASE
    )
    return redacted
```

**Status:** 🔍 RESEARCH NEEDED
- Verify if Anthropic logs/trains on health data
- If YES → Implement redaction
- If NO → Document in security notes

---

### FIX #2: DB CONNECTION ERROR (SSL)

**Issue:** `audit_log_write_failed` errors with SSL violations

**Debug Steps:**
```bash
# On server:
curl -v https://bfjxkzydonhwmafnyktt.supabase.co/rest/v1/health -H "apikey: YOUR_ANON_KEY"

# Check SSL version
openssl s_client -connect bfjxkzydonhwmafnyktt.supabase.co:443
```

**Likely Cause:** Python SSL version mismatch or connection timeout

**Fix:**
```python
# backend/app/services/supabase_service.py
# Add SSL verification
import ssl
import httpx

# Ensure Python's SSL is up to date
# Or add: httpx.Client(verify=False) if self-signed (NOT recommended)
```

**Status:** 🔧 NEEDS INVESTIGATION

---

### FIX #3: USER DELETION CASCADE

**File:** `backend/app/services/supabase_service.py`

**Add:**
```python
async def delete_user_cascade(user_id: str) -> None:
    """Delete user and all associated data (GDPR compliance)"""
    supabase = _get_supabase()
    
    # Define deletion order (respect foreign keys)
    tables_to_delete = [
        "insights",
        "recommendations", 
        "biomarkers",
        "lab_uploads",
        "weekly_checkins",
        "protocols",
        "audit_logs",
        "user_preferences",
        "users",  # Last
    ]
    
    for table in tables_to_delete:
        await _run(
            lambda: supabase.table(table)
            .delete()
            .eq("user_id", user_id)
            .execute()
        )
    
    # Also delete from Supabase Auth
    admin = _get_supabase_admin()
    admin.auth.admin.delete_user(user_id)
    
    # Log deletion
    await write_audit_log(
        user_id=user_id,
        action="delete",
        entity_type="user",
        entity_id=user_id,
        new_value={"reason": "user_requested_deletion"}
    )
```

**Status:** 📝 READY TO IMPLEMENT

---

### FIX #4: AUDIT LOGGING VERIFICATION

**Action:**
```python
# Audit logging is already implemented
# But verify it doesn't log sensitive data:

# ✅ OK to log:
- action: "read", "create", "update", "delete"
- entity_type: "biomarkers", "uploads"
- entity_id: UUID (not the actual data)

# ❌ NOT OK to log:
- biomarker_value: 18  # No actual values!
- symptom_text: "HIV test"  # No sensitive symptoms!
- password: "..."  # NEVER

# Verify: grep for sensitive fields in audit calls
grep -r "biomarker_value\|symptom_text\|password" \
  backend/app/services/supabase_service.py | grep _audit

# Expected: NOTHING found (clean)
```

**Status:** ✅ VERIFY (likely OK)

---

## DEPLOYMENT CHECKLIST

### Before deploying:
- [ ] Local test: `pytest tests/test_security_*.py`
- [ ] Code review: Check no PII in logs
- [ ] Production backup: `pg_dump vitaloop > backup.sql`
- [ ] Verify Supabase RLS policies active
- [ ] Check Anthropic privacy policy documented

### Deployment steps:
```bash
# On local:
1. Make changes to backend/app/services/
2. Run tests: pytest -v
3. Commit: git commit -m "security: add user deletion cascade"

# On server (via SSH):
1. cd /var/www/VITALOOP
2. git pull origin main
3. systemctl restart vitaloop-backend
4. tail -f /var/log/vitaloop/backend.log
5. Test: curl http://localhost:8004/health
```

---

## PRIORITY RANKING

| Fix | Severity | Effort | Impact | Status |
|-----|----------|--------|--------|--------|
| **LLM Privacy** | 🔴 HIGH | 2h | Health data protection | 🔍 RESEARCH |
| **User Deletion** | 🔴 HIGH | 1h | GDPR compliance | 📝 READY |
| **DB SSL Error** | 🟡 MEDIUM | 2h | System stability | 🔧 INVESTIGATE |
| **Audit Logging** | 🟡 MEDIUM | 1h | PII protection | ✅ VERIFY |

---

## EXECUTION ORDER

### Week 1:
- [ ] Research Anthropic privacy + implement redaction if needed
- [ ] Implement user deletion cascade
- [ ] Verify audit logging has no PII
- [ ] Test all fixes locally

### Week 2:
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Document security measures

### Ongoing:
- [ ] Investigate SSL connection errors
- [ ] Monitor Stripe errors (when company ready)

---

## TESTING

```python
# test_security_fixes.py

def test_no_pii_in_audit_logs():
    """Verify audit logs don't contain biomarker values"""
    logs = get_audit_logs(limit=100)
    
    forbidden_terms = [
        "ferritin", "vitamin_d", "tsh", "b12",  # biomarker names
        "hiv", "diabetes", "thyroid",  # diagnoses
        "value=", "18", "ng/ml",  # actual values
    ]
    
    for log in logs:
        for term in forbidden_terms:
            assert term not in log["details"].lower(), \
                f"Found PII: {term} in {log}"

def test_user_deletion_cascade():
    """Verify user deletion removes all data"""
    user_id = "test_user_123"
    
    # Create test data
    upload = create_test_upload(user_id)
    biomarker = create_test_biomarker(upload_id=upload["id"], user_id=user_id)
    
    # Delete user
    delete_user_cascade(user_id)
    
    # Verify all deleted
    assert not get_uploads(user_id)
    assert not get_biomarkers(user_id)
    assert not get_user_record(user_id)
```

---

**Next Step:** Choose which fix to implement first!
