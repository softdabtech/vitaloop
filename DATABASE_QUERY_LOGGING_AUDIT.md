# Database Query Logging Audit Report
**Date:** September 7, 2026  
**Status:** AUDIT PLAN  
**Objective:** Verify Supabase query logs don't expose PII/health data

---

## EXECUTIVE SUMMARY

⚠️ **KEY QUESTION:** Does Supabase log SQL query parameters?
- If YES → Need to disable parameter logging for sensitive data
- If NO → Already safe (logging only query structure)

---

## WHAT TO CHECK

### 1. Supabase Logging Configuration

**Risk:** Query parameters logged include actual PII
```sql
-- DANGEROUS (if logged):
SELECT * FROM biomarkers 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000' 
AND value = 42.5;

-- Parameters logged:
-- - user_id: '550e8400-e29b-41d4-a716-446655440000' (PII)
-- - value: 42.5 (health data)
```

**Safe:** Only query structure logged, not parameters
```
Query: SELECT * FROM biomarkers WHERE user_id = ? AND value = ?
No parameter values logged
```

### 2. Supabase Configuration File

**Location:** Supabase console → Project Settings → Database → Logs

**Check:**
- [ ] Query logging level (should be minimal)
- [ ] Parameter logging enabled? (should be OFF for production)
- [ ] Slow query log threshold (should be high, e.g., 5 seconds)

### 3. Who Has Access to Logs

**Risk:** Database logs contain sensitive data

**Current Access:**
- [ ] Project owner
- [ ] Database admin
- [ ] All authenticated users? (SHOULD NOT BE)

### 4. Log Retention

**Risk:** Old logs with sensitive data stay around

**Configuration:**
- [ ] Log retention period (should be minimal, e.g., 7 days)
- [ ] Automatic cleanup enabled?
- [ ] Archive to long-term storage?

---

## AUDIT CHECKLIST

### Supabase Configuration

- [ ] **Query Logging**
  - [ ] Enabled? (Yes/No)
  - [ ] Logs query text? (Yes/No)  
  - [ ] Logs parameters? (Yes/No)
  - [ ] Min log duration: ___ seconds
  - [ ] Recommended: 2 seconds minimum (avoids logging fast queries)

- [ ] **Access Control**
  - [ ] Only project owner can view logs? (Should be YES)
  - [ ] Logged-in users cannot access logs? (Should be YES)
  - [ ] Service role cannot access logs? (Should be YES)

- [ ] **Log Retention**
  - [ ] Retention period: ___ days
  - [ ] Recommended: 7 days for production
  - [ ] Automatic cleanup: Yes/No

### Application Code

- [ ] **Sensitive Queries**
  - [ ] Passwords logged? (Should be NO)
  - [ ] Biomarker values logged? (Should be NO)
  - [ ] Email addresses logged? (Should be NO)
  - [ ] Medical data logged? (Should be NO)

- [ ] **Audit Logging** (our custom logs)
  - [ ] Sanitized before logging? (Should be YES)
  - [ ] No PII in new_value field? (Should be YES)
  - [ ] No diagnosis in entity_type? (Should be YES)

---

## SENSITIVE DATA TO PROTECT

### Health Data (Must NOT be logged)
```
- biomarker values: 42.5, "OPTIMAL", "DEFICIENT"
- test results: "positive", "negative"
- diagnoses: "hypertension", "diabetes"
- symptoms: "fatigue", "brain_fog", "anxiety"
- medical history entries
```

### PII (Must NOT be logged)
```
- email addresses (user@example.com)
- full names
- phone numbers
- SSN/passport numbers
- IP addresses (in some cases)
```

### Safe to Log
```
- Table names: "biomarkers", "users", "insights"
- Column names (without values)
- User IDs (UUIDs only, not emails)
- Query types: SELECT, INSERT, UPDATE, DELETE
- Performance metrics: query_time_ms
- Row counts: rows_affected
```

---

## VERIFICATION STEPS

### Step 1: Check Supabase Console
```
1. Go to supabase.com/dashboard
2. Select project: vitaloop
3. Go to Settings → Database → Logs
4. Check configuration
5. Try to view logs
```

### Step 2: Review Application Logging
```
# Check our audit logging doesn't have PII
grep -r "biomarker_value\|symptom_text\|password" \
  backend/app/services/supabase_service.py | grep audit
# Expected: Should find NOTHING

# Check audit log fields
grep -n "new_value\|old_value" \
  backend/app/services/supabase_service.py | head -20
# Expected: Only structural data, no values
```

### Step 3: Check Error Logs
```
# Application error logs shouldn't contain PII
tail -100 /var/log/vitaloop/backend.log | \
  grep -i "ferritin\|tsh\|vitamin\|password"
# Expected: Should find NOTHING
```

### Step 4: Monitor Query Patterns
```
# Look for slow queries that might indicate issues
# In Supabase console → Logs → Filter by duration > 5s
# Check if any queries contain suspicious patterns
```

---

## FINDINGS TEMPLATE

After audit, fill in:

### Current State
- [ ] Supabase query logging: **[ENABLED/DISABLED]**
- [ ] Parameter logging: **[ENABLED/DISABLED]**
- [ ] Access to logs: **[WHO CAN SEE]**
- [ ] Log retention: **[N DAYS]**
- [ ] Sensitive data in logs: **[YES/NO]**

### Risk Level
- 🟢 GREEN: No logging of sensitive data
- 🟡 YELLOW: Logging of parameters, need access restrictions
- 🔴 RED: Sensitive data logged and accessible to unauthorized users

### Recommendations
1. ...
2. ...
3. ...

---

## SAMPLE SAFE LOGGING

```python
# GOOD: Supabase logging with disabled parameter logging
# Query sent to database:
# "SELECT * FROM biomarkers WHERE user_id = $1 AND status = $2"
# Logs show:
# - Query text (no parameter values)
# - Query time: 125ms
# - Rows returned: 5
# NO PII or health data exposed

# BAD: Query logging with parameters
# Query sent: "SELECT * FROM biomarkers WHERE user_id = 'abc-123' AND value = 42.5"
# Logs show: EVERYTHING including health data
# PII and medical data EXPOSED
```

---

## COMPLIANCE REQUIREMENTS

| Regulation | Requirement | Status |
|------------|-------------|--------|
| HIPAA | No health data in logs | TBD |
| GDPR | No PII in accessible logs | TBD |
| CCPA | Data subjects can request deletion | TBD |
| SOC 2 | Logging controls in place | TBD |

---

## ACTION ITEMS

### Immediate (This Week)
- [ ] Check Supabase logging configuration
- [ ] Verify parameter logging is disabled
- [ ] Check access restrictions on logs
- [ ] Review application error logs for PII

### Short Term (Week 2)
- [ ] Document logging policy
- [ ] Set up log retention cleanup
- [ ] Create monitoring alerts for suspicious queries
- [ ] Update security documentation

### Medium Term (Week 3+)
- [ ] Implement log encryption at rest
- [ ] Add query redaction middleware (if needed)
- [ ] Set up automated log analysis for PII detection
- [ ] Implement audit trail for who accessed logs

---

## NEXT STEPS

1. **Access Supabase Console**
   - Check current logging configuration
   - Screenshot the settings
   - Document findings

2. **Review Application Logs**
   - Check for any sensitive data leaks
   - Verify audit logging is sanitized

3. **Create Log Access Policy**
   - Who can view logs
   - How long to retain
   - Notification if accessed

4. **Document Findings**
   - Update this report with actual findings
   - Create remediation plan if needed
   - Implement improvements

---

**Report Template:** Complete by September 14, 2026
**Next Review:** September 21, 2026
