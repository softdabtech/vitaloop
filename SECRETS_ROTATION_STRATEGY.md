# Secrets Rotation Strategy
**Date:** September 7, 2026  
**Status:** PLAN  
**Objective:** Implement regular rotation of API keys and credentials

---

## EXECUTIVE SUMMARY

**Why rotate secrets?**
- Limit blast radius if key is compromised
- Ensure no old keys can access new data
- Meet compliance requirements (HIPAA, GDPR, SOC 2)
- Industry best practice (every 90 days)

**Current secrets to rotate:**
- OpenAI API key
- Supabase service role key
- Database credentials
- JWT secret (if applicable)
- Email service API key (Resend)

---

## SECRETS INVENTORY

### 1. OpenAI API Key
```
Location: /etc/vitaloop/backend.env
Environment Variable: OPENAI_API_KEY
Format: sk-proj-xxxxx
Usage: LLM calls for biomarker extraction
Rotation: Every 90 days
Last Rotated: [TBD]
```

**Rotation Steps:**
1. Generate new key in OpenAI console
2. Update .env file
3. Restart backend
4. Verify new key works
5. Revoke old key in OpenAI console

### 2. Supabase Service Role Key
```
Location: /etc/vitaloop/backend.env
Environment Variable: SUPABASE_SERVICE_KEY
Format: eyJhbGc...
Usage: Database access with elevated privileges
Rotation: Every 90 days
Last Rotated: [TBD]
```

**Rotation Steps:**
1. Generate new key in Supabase console → API
2. Test new key first (on staging)
3. Update .env file
4. Restart backend
5. Monitor for errors
6. Revoke old key in Supabase

### 3. Database Password
```
Location: Supabase internal
Environment Variable: SUPABASE_DB_PASSWORD
Usage: Database authentication
Rotation: Every 90 days
Last Rotated: [TBD]
```

**Rotation Steps:**
1. Change password in Supabase → Database
2. Wait for replication (if applicable)
3. Update connection strings
4. Test connections
5. Restart services

### 4. Email Service Key (Resend)
```
Location: /etc/vitaloop/backend.env
Environment Variable: RESEND_API_KEY
Format: re_xxxxx
Usage: Sending emails
Rotation: Every 90 days
Last Rotated: [TBD]
```

**Rotation Steps:**
1. Generate new key in Resend console
2. Update .env file
3. Restart backend
4. Test email sending
5. Revoke old key

### 5. JWT Secret (if applicable)
```
Location: [TBD - check config]
Environment Variable: [TBD]
Usage: JWT token signing/verification
Rotation: Every 180 days (less frequent due to impact)
Last Rotated: [TBD]
```

---

## ROTATION SCHEDULE

### Monthly Audit (1st of each month)
```
- Check all secret expiration dates
- Review access logs for suspicious activity
- Check for unused secrets
- Plan rotation if needed
```

### Quarterly Rotation (Every 90 days)
```
Jan 7  → Rotate OpenAI API key
Apr 7  → Rotate OpenAI API key
Jul 7  → Rotate OpenAI API key
Oct 7  → Rotate OpenAI API key

Jan 15 → Rotate Supabase service key
Apr 15 → Rotate Supabase service key
Jul 15 → Rotate Supabase service key
Oct 15 → Rotate Supabase service key

Jan 22 → Rotate Resend API key
Apr 22 → Rotate Resend API key
Jul 22 → Rotate Resend API key
Oct 22 → Rotate Resend API key
```

### Semi-Annual Rotation (Every 180 days)
```
Jan 30 → Rotate JWT secret (if applicable)
Jul 30 → Rotate JWT secret (if applicable)
```

---

## ROTATION PROCEDURE

### Pre-Rotation Checklist
- [ ] Schedule maintenance window (low-traffic time)
- [ ] Notify team: "Secrets rotation happening in [X] hours"
- [ ] Take database backup
- [ ] Create rollback plan (old key kept for 24 hours)

### During Rotation
```bash
# 1. Generate new secret in provider console
echo "1. New key generated in [provider]"

# 2. Update local .env file
sudo nano /etc/vitaloop/backend.env
# Change: OLD_KEY=xxx → NEW_KEY=yyy

# 3. Test on staging first (if available)
# Run: backend tests with new key

# 4. Restart backend service
sudo systemctl restart vitaloop-backend

# 5. Monitor logs for errors
tail -f /var/log/vitaloop/backend.log | grep -i "error\|key"

# 6. Verify functionality
# Test: GET /health
# Test: Make test API call

# 7. Revoke old key in provider console
echo "Old key revoked"

# 8. Document in changelog
git commit -m "chore: rotate [service] secrets (date)"
```

### Post-Rotation Verification
- [ ] Backend service running ✅
- [ ] No error logs from key failures ✅
- [ ] Health check passes ✅
- [ ] Sample API call succeeds ✅
- [ ] Old key revoked ✅
- [ ] Rotation logged in audit trail ✅

---

## AUTOMATED ROTATION (Future)

### Using HashiCorp Vault
```
Benefits:
- Automatic rotation based on schedule
- No manual intervention needed
- Audit trail of all rotations
- Rollback capability

Setup:
1. Install Vault agent on server
2. Configure rotation policies
3. Update .env file to pull from Vault
4. Test automation
```

### Using AWS Secrets Manager
```
Benefits:
- Automatic rotation for supported services
- Integration with Lambda functions
- Audit logging built-in
- Multi-secret coordination

Setup:
1. Move secrets to Secrets Manager
2. Configure rotation Lambda
3. Update application to use SDK
4. Test rotation
```

---

## COMPLIANCE CHECKLIST

| Regulation | Requirement | Status |
|-----------|-------------|--------|
| **HIPAA** | Rotate keys annually | ⏳ TODO |
| **GDPR** | Document access controls | ⏳ TODO |
| **SOC 2** | Audit trail of rotations | ⏳ TODO |
| **PCI DSS** | Change secrets regularly | ⏳ TODO |

---

## EMERGENCY ROTATION

**If key is compromised:**

```
1. IMMEDIATELY revoke key in provider console
2. Generate new key ASAP
3. Update .env file
4. Restart backend
5. Monitor for unauthorized access
6. Notify security team
7. Review audit logs (last 30 days)
8. Consider full password reset if needed
```

---

## DOCUMENTATION TEMPLATE

### Rotation Log

```
Date: [Date]
Service: [OpenAI/Supabase/Email/Database]
Old Key: [Last 4 digits only: xxx1234]
New Key: [Last 4 digits only: xxx5678]
Reason: Scheduled quarterly rotation
Status: ✅ Success / ❌ Failed
Verified By: [Name]
Time to Complete: [Minutes]
Issues: [Any issues encountered]
```

### Checklist Template
```
- [ ] Pre-rotation backup taken
- [ ] New key generated
- [ ] .env file updated
- [ ] Backend restarted
- [ ] Health check passes
- [ ] Sample request succeeds
- [ ] Old key revoked
- [ ] Rotation logged
- [ ] Team notified
- [ ] Documentation updated
```

---

## MONITORING & ALERTING

### What to Monitor
```
- API calls using old key (should be 0)
- Failed authentication attempts (spikes = concern)
- Successful authentication with new key
- Service uptime during rotation
```

### Alerts to Set Up
```
- Key rotation due (30 days before)
- Failed API calls with revoked key
- Unusual API usage patterns
- Unauthorized access attempts
```

---

## NEXT STEPS

### This Week
- [ ] Audit all current secrets
- [ ] Document last rotation dates
- [ ] Create rotation schedule
- [ ] Brief team on procedure

### Next Week
- [ ] Perform first rotation (OpenAI key)
- [ ] Document rotation process
- [ ] Test recovery procedure
- [ ] Update runbook

### This Month
- [ ] Complete all outstanding rotations
- [ ] Set calendar reminders
- [ ] Automate via cron/Lambda (if possible)
- [ ] Monitor for issues

---

**Status:** Plan created, awaiting implementation  
**Owner:** DevOps/Security team  
**Last Updated:** September 7, 2026  
**Next Review:** September 14, 2026
