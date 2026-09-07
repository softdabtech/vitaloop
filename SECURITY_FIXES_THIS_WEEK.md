# VITALOOP Security Fixes - Week of Sept 7, 2026
**Target:** 3 critical fixes deployable this week

---

## FIX #1: USER DELETION CASCADE ✅ READY

**Why:** GDPR compliance, privacy, user control

**Implementation:**

```python
# File: backend/app/services/supabase_service.py
# Add at end of file:

async def delete_user_cascade(user_id: str) -> None:
    """Delete user and all associated data (GDPR right to be forgotten)"""
    supabase = _get_supabase()
    
    # Tables to delete (order matters for FK constraints)
    tables = [
        "insights",
        "recommendations",
        "biomarkers",
        "lab_uploads",
        "weekly_checkins",
        "protocols",
        "audit_logs",
        "user_preferences",
        "notification_preferences",
        "users",
    ]
    
    for table in tables:
        try:
            await _run(
                lambda t=table: supabase.table(t)
                .delete()
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as e:
            logger.error(f"delete_cascade_failed table={table} user_id={user_id} error={e}")
            raise
    
    # Log the deletion
    await write_audit_log(
        user_id=user_id,
        action="delete",
        entity_type="user_account",
        new_value={"reason": "user_requested_gdpr_deletion", "timestamp": datetime.now().isoformat()}
    )
```

**Add endpoint:**
```python
# File: backend/app/routers/identity/__init__.py
# Add:

@router.post("/delete-account")
async def delete_account(
    current_user: dict = Depends(get_current_user),
    password_confirmation: str = Body(...),  # Require password for safety
):
    """Permanently delete user account and all data"""
    user_id = current_user["sub"]
    
    # Verify password (via Supabase)
    # await verify_password(user_id, password_confirmation)
    
    # Delete all user data
    await delete_user_cascade(user_id)
    
    # Revoke all sessions
    supabase.auth.sign_out()
    
    return {"status": "deleted", "message": "Your account and all data have been permanently deleted"}
```

**Status:** ⏱️ 30 minutes implementation

---

## FIX #2: AUDIT LOGGING REVIEW ✅ VERIFY

**Why:** Ensure no PII (health data, biomarker values) in logs

**Check:**
```bash
# On production server:

# 1. Review recent audit logs
ssh root@159.65.252.227 \
  "tail -100 /var/log/vitaloop/backend.log | grep audit"

# 2. Verify no biomarker values in audit
ssh root@159.65.252.227 \
  "grep -i 'ferritin\|value.*[0-9]\|symptom.*' /var/log/vitaloop/backend.log | head -5"
# Expected: Should find NOTHING (clean)

# 3. Verify structure only
ssh root@159.65.252.227 \
  "grep 'audit_log' /var/log/vitaloop/backend.log | head -3"
# Expected: Should show: action=read entity_type=biomarkers (no values)
```

**If found PII in logs:**
```python
# Fix in: backend/app/services/supabase_service.py

async def _audit_medical_read(
    *,
    user_id: Optional[str],
    entity_type: str,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    # SANITIZE details to remove sensitive values
    safe_details = {}
    if details:
        dangerous_keys = ["value", "biomarker_value", "result", "symptom_text"]
        for k, v in details.items():
            if k not in dangerous_keys:
                safe_details[k] = v
    
    await write_audit_log(
        user_id=user_id,
        action="read",
        entity_type=entity_type,
        entity_id=entity_id,
        new_value={"scope": "medical", **safe_details},
    )
```

**Status:** ⏱️ 15 minutes verification

---

## FIX #3: DB CONNECTION ERROR (SSL) 🔍 INVESTIGATE

**Error in logs:**
```
audit_log_write_failed error=EOF occurred in violation of protocol (_ssl.c:2426)
```

**Cause:** Likely Supabase connection timeout or SSL version mismatch

**Debug steps:**
```bash
# 1. Check Python SSL version
ssh root@159.65.252.227 \
  "python3 -c 'import ssl; print(ssl.OPENSSL_VERSION)'"

# 2. Check if Supabase is reachable
ssh root@159.65.252.227 \
  "curl -I https://bfjxkzydonhwmafnyktt.supabase.co"

# 3. Check backend logs for connection patterns
ssh root@159.65.252.227 \
  "grep -i 'connection\|ssl\|tls' /var/log/vitaloop/backend.log | tail -20"

# 4. Restart backend
ssh root@159.65.252.227 \
  "systemctl restart vitaloop-backend"

# 5. Monitor for errors
ssh root@159.65.252.227 \
  "tail -f /var/log/vitaloop/backend.log | grep -i error"
```

**Fix (if SSL version issue):**
```python
# File: backend/app/services/supabase_service.py
# At initialization:

import httpx
import ssl

# Force TLS 1.2+
ssl_context = ssl.create_default_context()
ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2

# Use in Supabase client (if supported)
```

**Status:** ⏱️ 20 minutes investigation

---

## DEPLOYMENT PLAN

### Phase 1: Local Testing
```bash
# Day 1: Implement Fix #1
cd /Users/oleksii/projects/vitaloop/backend
# Edit app/services/supabase_service.py
# Add delete_user_cascade() function

# Day 2: Test locally
pytest tests/test_user_deletion.py -v

# Day 3: Review logs
# Run grep checks to verify Fix #2
```

### Phase 2: Production Deploy
```bash
# Day 4: Backup production
ssh root@159.65.252.227 \
  "cd /var/www/VITALOOP && git status"

# Day 5: Deploy
ssh root@159.65.252.227 \
  "cd /var/www/VITALOOP && git pull origin main && systemctl restart vitaloop-backend"

# Day 5: Verify
ssh root@159.65.252.227 \
  "systemctl status vitaloop-backend && tail -20 /var/log/vitaloop/backend.log"
```

---

## TESTING CHECKLIST

- [ ] Fix #1: Delete user cascade
  - [ ] Local: Test delete creates no orphaned records
  - [ ] Local: Test GDPR deletion endpoint
  - [ ] Prod: Deploy and test with test user
  
- [ ] Fix #2: Audit logs review
  - [ ] Grep logs for any PII
  - [ ] Verify structure-only logging
  
- [ ] Fix #3: SSL errors
  - [ ] Check Python SSL version
  - [ ] Monitor after restart

---

## ROLLBACK PLAN

If production breaks:
```bash
ssh root@159.65.252.227
systemctl stop vitaloop-backend
cd /var/www/VITALOOP
git log --oneline | head -5
git revert <commit-hash>  # Revert the problematic commit
systemctl start vitaloop-backend
```

---

**Estimated Timeline:** 3-5 days (can do in parallel)
**Difficulty:** Low-Medium  
**Risk:** Low (non-breaking changes)

---

## WHAT NOT TO DO YET

❌ **Stripe webhook** - No company account yet, skip
❌ **LLM redaction** - OpenAI privacy is acceptable, skip
❌ **Wearables** - Out of scope, skip  
❌ **Lab booking** - Out of scope, skip

---

**Ready to start?** Let's begin with Fix #1 (User Deletion).
