# Secrets Rotation Implementation - PHASE 2.2
**Date:** September 7, 2026  
**Phase:** 2.2 Data Protection  
**Status:** 🟢 READY TO IMPLEMENT

---

## OVERVIEW

Implement automated and scheduled secrets rotation to meet compliance requirements (HIPAA 1-year, SOC 2, PCI DSS).

**Current State:** Manual process  
**Desired State:** Automated with 90-day schedule  
**Risk:** Not rotating = exposed compromised keys

---

## SECRETS INVENTORY & ROTATION SCHEDULE

### 1. OpenAI API Key
```
Location: /etc/vitaloop/backend.env
Variable: OPENAI_API_KEY
Format: sk-proj-xxxxx
Usage: LLM biomarker extraction
Rotation: EVERY 90 DAYS (next: Jan 7, Apr 7, Jul 7, Oct 7)
Last Rotated: [TBD]
```

**Rotation Procedure:**
```bash
# 1. Generate new key in https://platform.openai.com/api-keys
# 2. Test on staging first
OPENAI_API_KEY=sk-proj-[NEW]

# 3. Update backend
ssh root@159.65.252.227
vi /etc/vitaloop/backend.env
# Change OPENAI_API_KEY=sk-proj-[NEW]

# 4. Restart backend
systemctl restart vitaloop-backend

# 5. Verify health check
curl https://api.vitaloop.today/health

# 6. Revoke old key in OpenAI console
# Verify no old key usage: check API usage logs
```

### 2. Supabase Service Role Key
```
Location: /etc/vitaloop/backend.env
Variable: SUPABASE_SERVICE_ROLE_KEY
Format: eyJhbGc...
Usage: Database access with elevated privileges
Rotation: EVERY 90 DAYS (next: Jan 15, Apr 15, Jul 15, Oct 15)
Last Rotated: [TBD]
```

**Rotation Procedure:**
```bash
# 1. Generate new key in Supabase console
#    Project Settings → API → Service Role Key → Regenerate

# 2. Test new key in staging environment FIRST
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...[NEW]

# 3. Update backend
ssh root@159.65.252.227
vi /etc/vitaloop/backend.env
# Change SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...[NEW]

# 4. Restart backend
systemctl restart vitaloop-backend

# 5. Monitor logs for errors
tail -f /var/log/vitaloop/backend.log | grep -i "auth\|supabase"

# 6. Revoke old key in Supabase
#    It will stop working immediately

# 7. Verify no broken queries in logs
```

### 3. Resend Email API Key
```
Location: /etc/vitaloop/backend.env
Variable: RESEND_API_KEY
Format: re_xxxxx
Usage: Email sending (password reset, confirmations)
Rotation: EVERY 90 DAYS (next: Jan 22, Apr 22, Jul 22, Oct 22)
Last Rotated: [TBD]
```

**Rotation Procedure:**
```bash
# 1. Generate new key in https://resend.com/api-keys
# 2. Test sending test email with new key
# 3. Update backend
ssh root@159.65.252.227
vi /etc/vitaloop/backend.env
# Change RESEND_API_KEY=re_[NEW]

# 4. Restart backend
systemctl restart vitaloop-backend

# 5. Test email sending
curl -X POST https://api.vitaloop.today/auth/send-test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 6. Revoke old key
```

### 4. Sentry DSN (If Enabled)
```
Location: /etc/vitaloop/backend.env
Variable: SENTRY_DSN
Usage: Error tracking and monitoring
Rotation: EVERY 180 DAYS (less frequent, less critical)
Last Rotated: [TBD]
```

**Rotation Procedure:**
```bash
# 1. Create new Sentry project token
# 2. Update backend
# 3. Restart backend
# 4. Verify errors still being reported
# 5. Delete old token
```

### 5. JWT Secret (If Applicable)
```
Location: [Check config]
Variable: JWT_SECRET
Usage: JWT token signing
Rotation: EVERY 180 DAYS (requires token invalidation)
Last Rotated: [TBD]

⚠️  WARNING: Rotating JWT secret invalidates all active tokens!
Requires coordination with frontend to handle expired sessions
```

---

## ROTATION CALENDAR

### Q4 2026 (Oct-Dec)
```
Oct 7  → OpenAI API key
Oct 15 → Supabase service role key
Oct 22 → Resend API key
Oct 30 → JWT secret (if applicable)
```

### Q1 2027 (Jan-Mar)
```
Jan 7  → OpenAI API key
Jan 15 → Supabase service role key
Jan 22 → Resend API key
Jan 30 → JWT secret (if applicable)
```

### Q2 2027 (Apr-Jun)
```
Apr 7  → OpenAI API key
Apr 15 → Supabase service role key
Apr 22 → Resend API key
Apr 30 → JWT secret (if applicable)
```

**Setup in Calendar:**
```bash
# Create calendar reminders (Google Calendar, Outlook, etc.)
# Set for: 30 days BEFORE due date
# Example: Sep 7 reminder for Oct 7 rotation

Title: [SECURITY] Rotate OpenAI API key
Date: Oct 7, 2026
Reminder: 30 days before (Sep 7)
Attendees: DevOps team
Description: See SECRETS_ROTATION_IMPLEMENTATION.md
```

---

## AUTOMATED ROTATION (Future - Phase 3)

### Option 1: Using HashiCorp Vault
```yaml
# vault-config.hcl
database "postgresql" {
  connection_url = "postgresql://..."
  allowed_roles  = ["openai", "supabase", "resend"]
}

# Rotation policies
path "auth/creds/openai" {
  capabilities = ["read"]
  ttl = "7776000s"  # 90 days
}
```

### Option 2: Using AWS Secrets Manager
```python
# Python Lambda for automated rotation
import boto3

def rotate_secret(secret_id, rotation_token, step):
    client = boto3.client('secretsmanager')
    
    if step == "create":
        # Generate new key from provider
        new_key = openai_client.regenerate_key()
    elif step == "set":
        # Update backend .env
        update_backend_env(secret_id, new_key)
    elif step == "test":
        # Test new key works
        verify_api_key(new_key)
    elif step == "finish":
        # Revoke old key
        revoke_old_key(secret_id)
```

---

## MANUAL ROTATION CHECKLIST

### Pre-Rotation (30 days before)
- [ ] Create calendar reminders for team
- [ ] Prepare rotation runbook
- [ ] Identify team member responsible
- [ ] Schedule maintenance window
- [ ] Notify ops team

### During Rotation
- [ ] Back up current .env file
- [ ] Generate new key from provider
- [ ] Test new key in staging (if applicable)
- [ ] Update /etc/vitaloop/backend.env
- [ ] Restart affected service
- [ ] Monitor error logs (5 min)
- [ ] Verify health checks pass
- [ ] Confirm no broken functionality

### Post-Rotation (After Success)
- [ ] Revoke old key in provider
- [ ] Document rotation in log
- [ ] Update rotation calendar
- [ ] Update SECRETS_INVENTORY.md
- [ ] Send to team: "Rotation complete"

### Rollback Plan (If Issues)
- [ ] Revert to previous .env
- [ ] Restart service
- [ ] Verify old key still works
- [ ] Debug issue
- [ ] Schedule retry

---

## ROTATION TRACKING

### Secrets Inventory Spreadsheet
Keep this updated after each rotation:

| Secret | Last Rotated | Next Due | Status | Notes |
|--------|-------------|----------|--------|-------|
| OpenAI API | Sep 7 | Dec 7 | ✅ | - |
| Supabase Key | Sep 7 | Dec 15 | ✅ | - |
| Resend API | Sep 7 | Dec 22 | ✅ | - |
| Sentry DSN | Jul 1 | Jan 1 | ⏳ | OK |
| JWT Secret | May 1 | Nov 1 | ⏳ | OK |

**File Location:** `/etc/vitaloop/SECRETS_INVENTORY.txt`  
**Backup Location:** Shared drive / LastPass / 1Password (encrypted)

---

## EMERGENCY ROTATION

If key is compromised:

```bash
# 1. IMMEDIATELY revoke in provider console
# 2. Generate new key ASAP
# 3. Update backend
ssh root@159.65.252.227
vi /etc/vitaloop/backend.env
# Set new key

# 4. Restart service
systemctl restart vitaloop-backend

# 5. Monitor for attacks
tail -f /var/log/vitaloop/backend.log | grep -i "error\|denied"

# 6. Review access logs
# Check for unauthorized API calls
# Example: OpenAI API - check usage in past 24h

# 7. Notify security team
# Document incident
# Compliance report
```

---

## COMPLIANCE DOCUMENTATION

### HIPAA Requirements
- ✅ Rotate annually (we do every 90 days - exceeds requirement)
- ✅ Document all rotations
- ✅ Maintain audit trail
- ✅ Emergency procedure (same day)

### SOC 2 Requirements
- ✅ Regular rotation schedule documented
- ✅ Change management process
- ✅ Audit trail of all changes
- ✅ Segregation of duties (DevOps makes change, Security verifies)

### PCI DSS Requirements (If handling payments)
- ✅ Change secrets regularly
- ✅ No shared secrets
- ✅ Secure storage (not in git)
- ✅ Access controls

---

## IMPLEMENTATION STEPS

### Week 1: Setup
```bash
# 1. Create rotation calendar in Google Calendar
#    Schedule 30 days before each rotation date

# 2. Create backup of current secrets
cp /etc/vitaloop/backend.env /etc/vitaloop/backend.env.backup.2026-09-07

# 3. Test rotation procedure with one non-critical key
#    (Or create test key)

# 4. Document team assignments
#    Who: Alex (DevOps lead)
#    Backup: [Your team member]
```

### Week 2: First Rotation
```bash
# Start with least critical: Sentry DSN (if exists)
# Then: Resend (less critical)
# Then: OpenAI (moderate)
# Last: Supabase (most critical)

# For each:
# 1. Follow rotation procedure
# 2. Document time taken
# 3. Note any issues
# 4. Refine procedure
```

### Week 3-4: Automation
```bash
# Create automation scripts:
# - Pre-rotation checklist
# - Restart scripts
# - Health check scripts
# - Notification scripts
```

---

## NOTIFICATION TEMPLATE

### To Team (After successful rotation)
```
✅ SECURITY: API Key Rotation Complete

Service: [OpenAI/Supabase/Resend]
Time: [HH:MM UTC]
Status: ✅ Success
Duration: [X minutes]

What changed:
- [Service] API key rotated
- Backend restarted
- Health checks passed
- Old key revoked

No action needed.

Next rotation: [Date]
```

### To Security/Compliance
```
🔐 Secrets Rotation Log Entry

Date: September 7, 2026
Service: [Service Name]
Old Key: [Last 4 digits: xxx1234]
New Key: [Last 4 digits: xxx5678]
Rotated By: [Name]
Verified By: [Name]
Time: [HH:MM UTC]
Status: ✅ Success

Evidence:
- [Link to logs]
- Health check: ✅ Passed
- No errors: ✅ Verified
```

---

## WHAT'S NEXT

### Immediate (This Week)
- [ ] Create rotation calendar
- [ ] Set reminders for Oct 7 (OpenAI)
- [ ] Document current state
- [ ] Brief team on procedure

### Short Term (This Month)
- [ ] Execute first rotation (non-critical key)
- [ ] Refine procedure based on lessons
- [ ] Update runbook
- [ ] Test rollback plan

### Medium Term (Q4 2026)
- [ ] Execute all quarterly rotations
- [ ] Document all rotations
- [ ] Prepare for compliance audit
- [ ] Plan automation

### Long Term (2027+)
- [ ] Implement automated rotation (Vault/Secrets Manager)
- [ ] Eliminate manual process
- [ ] Zero-downtime rotation
- [ ] Real-time monitoring

---

## RELATED DOCUMENTS

- [[SECRETS_ROTATION_STRATEGY]] - Original plan
- [[FRONTEND_SECRETS_CLEANUP]] - Paddle token rotation (example)
- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html

---

**Status:** ✅ READY TO IMPLEMENT  
**Owner:** DevOps/Security  
**Next Review:** September 14, 2026  
**Last Updated:** September 7, 2026
