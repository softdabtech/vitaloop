# Quick Reference: CRM Backend Local Testing

**Purpose:** Fast reference for developers to test Stage 5 CRM endpoints locally or in production.

---

## Prerequisites

### 1. Environment Setup

```bash
cd backend

# Create virtual env
python -m venv .venv
source .venv/bin/activate

# Install dependencies (no new packages needed)
pip install -r requirements.txt
```

### 2. Environment Variables

Already configured in `.env`. Ensure these exist:

```env
SUPABASE_URL=https://bfjxkzydonhwmafnyktt.supabase.co
SUPABASE_SERVICE_KEY=...
ANTHROPIC_API_KEY=...
STRIPE_SECRET_KEY=...
```

### 3. Database Migration

Execute SQL migration in Supabase:

```bash
# Copy stage-5-crm-tables.sql contents
cat sql/stage-5-crm-tables.sql

# Go to Supabase SQL Editor
# Paste entire file
# Click Execute
```

### 4. Start Backend

```bash
# From backend/ directory
uvicorn app.main:app --reload --host 0.0.0.0 --port 8004

# Output:
# INFO:     Uvicorn running on http://127.0.0.1:8004
# INFO:     Application startup complete
```

### 5. Access API Documentation

```
http://localhost:8004/docs
```

---

## Getting Test Tokens

### Option A: Use Supabase Test User

```bash
# 1. Go to Supabase Dashboard
# 2. Authentication → Users
# 3. Create test user with email: test@example.com
# 4. Find their ID (UUID)

# 2. Get JWT token for local testing
curl -X POST https://bfjxkzydonhwmafnyktt.supabase.co/auth/v1/token \
  -H "apikey: <SUPABASE_PUBLIC_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "password",
    "email": "test@example.com",
    "password": "TestPassword123!",
    "gotrue_meta_security": {}
  }'

# Save token from response
export TOKEN="eyJ..."
```

### Option B: Create Super_admin Token Locally

```python
# Quick Python script to generate a valid JWT
import jwt
import json
from datetime import datetime, timedelta

secret = "your_jwt_secret"  # From .env
payload = {
    "sub": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@vitaloop.today",
    "global_role": "super_admin",
    "aud": "authenticated",
    "exp": datetime.utcnow() + timedelta(hours=1)
}

token = jwt.encode(payload, secret, algorithm="HS256")
print(f"export TOKEN={token}")
```

---

## Test Flows (Copy-Paste Ready)

### Setup Variables

```bash
#!/bin/bash
API="http://localhost:8004"
TOKEN="your_token_here"

# Helper for requests
req() {
  local method=$1
  local path=$2
  local data=$3
  
  if [ -z "$data" ]; then
    curl -X $method "$API$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json"
  else
    curl -X $method "$API$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data"
  fi
}
```

### Flow 1: Create Program

```bash
# Create a program template
req POST "/crm/programs" '{
  "name": "7-Day Metabolic Reset",
  "category": "metabolic-optimization",
  "duration_days": 7,
  "description": "Quick start into metabolic health",
  "template_protocol": {
    "phase_1": {
      "days": "1-3",
      "focus": "Baseline & tracking setup"
    }
  },
  "checkpoint_intervals": [3, 7]
}'

# Save program_id from response
export PROGRAM_ID="..."
```

### Flow 2: Create Client

```bash
# Create client profile
req POST "/crm/clients" '{
  "user_id": "650e8400-e29b-41d4-a716-446655440000"
}'

# Save client_id from response
export CLIENT_ID="..."
```

### Flow 3: Assign Program to Client

```bash
# Create program assignment (client starts onboarding)
req POST "/crm/client-programs" '{
  "client_id": "'$CLIENT_ID'",
  "program_id": "'$PROGRAM_ID'",
  "notes": "Client ready, starting program"
}'

# Save assignment_id
export ASSIGNMENT_ID="..."
```

### Flow 4: Start Program

```bash
# Transition: ONBOARDING → ACTIVE
req POST "/crm/client-programs/$ASSIGNMENT_ID/start"

# Response: assignment with status="active"
```

### Flow 5: Create & Submit Questionnaire

```bash
# Create questionnaire template
req POST "/crm/questionnaires" '{
  "name": "Day 3 Check-in",
  "template_type": "progress-check",
  "questions": {
    "q1": {
      "type": "text",
      "label": "How have you been feeling?",
      "required": true
    },
    "q2": {
      "type": "scale",
      "label": "Energy level (1-10)",
      "min": 1,
      "max": 10,
      "required": true
    }
  }
}'

export QUESTIONNAIRE_ID="..."

# Submit responses
req POST "/crm/questionnaires/submit" '{
  "client_id": "'$CLIENT_ID'",
  "questionnaire_id": "'$QUESTIONNAIRE_ID'",
  "responses": {
    "q1": "Feeling great, lots of energy!",
    "q2": 8
  }
}'

# Response: result with score=8.0
```

### Flow 6: Register Practitioner

```bash
# Create practitioner profile (OPS only)
req POST "/crm/practitioners" '{
  "user_id": "750e8400-e29b-41d4-a716-446655440001",
  "specialization": "nutrition",
  "bio": "Certified Nutritionist, 15 years experience",
  "max_clients": 30
}'

export PRACTITIONER_ID="..."
```

### Flow 7: Assign Practitioner to Client

```bash
# Assign practitioner for Personal tier support
req POST "/crm/practitioners/assign" '{
  "client_id": "'$CLIENT_ID'",
  "practitioner_id": "'$PRACTITIONER_ID'"
}'

# Response: client with assigned_practitioner_id populated
```

### Flow 8: Create Intervention

```bash
# Practitioner adjusts protocol
req POST "/crm/client-programs/$ASSIGNMENT_ID/interventions" '{
  "change_type": "protocol_update",
  "description": "Client reported hunger midday. Adjusted fasting window.",
  "changes": {
    "fasting_window": {
      "old": "16:8",
      "new": "14:10"
    }
  }
}'

# Response: intervention recorded
```

---

## Testing Error Cases

### 1. Access Denied (Non-Super Admin)

```bash
# Try to create program as end_user
export USER_TOKEN="end_user_token_here"

curl -X POST http://localhost:8004/crm/programs \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'

# Expected: 403 Forbidden - "Super admin access required"
```

### 2. Duplicate Active Program

```bash
# Try to assign program to client that already has one
req POST "/crm/client-programs" '{
  "client_id": "'$CLIENT_ID'",
  "program_id": "'$OTHER_PROGRAM_ID'"
}'

# Expected: 422 - "Client already has active program"
```

### 3. Practitioner at Capacity

```bash
# If practitioner.current_clients >= max_clients
req POST "/crm/practitioners/assign" '{
  "client_id": "'$CLIENT_ID'",
  "practitioner_id": "'$FULL_PRACTITIONER_ID'"
}'

# Expected: 422 - "Practitioner is at capacity"
```

### 4. Invalid State Transition

```bash
# Try to move program from COMPLETED back to ACTIVE
req PATCH "/crm/clients/$CLIENT_ID" '{
  "onboarding_status": "started"
}'

# If client is already COMPLETED:
# Expected: 422 - "Invalid transition: completed → started"
```

---

## Debugging

### 1. Check Logs

```bash
# In backend terminal
# Look for error output

# Or use journalctl if running as service
journalctl -u vitaloop-backend -n 50 --grep="ERROR"
```

### 2. Inspect Database State

```bash
# In Supabase SQL Editor

-- Check clients
SELECT * FROM public.clients ORDER BY created_at DESC LIMIT 10;

-- Check program assignments
SELECT cp.*, p.name, c.user_id 
FROM public.client_programs cp
JOIN public.programs p ON cp.program_id = p.id
JOIN public.clients c ON cp.client_id = c.id
ORDER BY cp.created_at DESC;

-- Check audit logs
SELECT * FROM public.audit_logs 
WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC;

-- Check subscriptions
SELECT * FROM public.subscriptions 
WHERE created_at > now() - interval '1 hour';
```

### 3. Enable Debug Logging

In `app/main.py`, add:

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("app")
```

Or in individual services:

```python
logger = logging.getLogger("crm.service")
logger.setLevel(logging.DEBUG)
```

---

## Common Issues & Fixes

### Issue: "Invalid token" or "401 Unauthorized"

**Cause:** Token is expired or malformed

**Fix:**
```bash
# Regenerate token
# Verify format: Bearer eyJ...

# If local, check token generation script
python -c "import jwt; ..."
```

### Issue: "No active subscription" (402)

**Cause:** User tried to access locked feature without subscription

**Fix:**
```bash
# Create subscription
curl -X POST http://localhost:8004/crm/subscriptions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "user_id": "'$USER_ID'",
    "plan_name": "personal"
  }'
```

### Issue: "Questionnaire not found" (404)

**Cause:** Used wrong questionnaire_id

**Fix:**
```bash
# List all questionnaires
curl http://localhost:8004/crm/questionnaires \
  -H "Authorization: Bearer $TOKEN"

# Get correct ID and retry
```

### Issue: Tables don't exist (500 error)

**Cause:** SQL migration not executed

**Fix:**
```bash
# Go to Supabase SQL Editor
# Execute: cat backend/sql/stage-5-crm-tables.sql
# Copy entire file and run

# Verify:
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('clients', 'practitioners', 'programs');
```

---

## Useful SQL Queries

### See All Created Records

```sql
-- Recent clients
SELECT id, user_id, onboarding_status FROM public.clients ORDER BY created_at DESC LIMIT 5;

-- Recent programs
SELECT id, name, category FROM public.programs ORDER BY created_at DESC LIMIT 5;

-- Recent assignments
SELECT id, client_id, program_id, status FROM public.client_programs ORDER BY created_at DESC LIMIT 5;

-- All questionnaires
SELECT id, name, template_type FROM public.questionnaires;

-- Recent responses
SELECT id, client_id, score FROM public.client_questionnaires ORDER BY completed_at DESC LIMIT 5;

-- All audit entries (last hour)
SELECT user_id, action, entity_type, entity_id, created_at 
FROM public.audit_logs 
WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC;
```

### Reset Test Data

```sql
-- DELETE all test data (WARNING: destructive)
DELETE FROM public.audit_logs;
DELETE FROM public.client_questionnaires;
DELETE FROM public.interventions;
DELETE FROM public.client_programs;
DELETE FROM public.questionnaires;
DELETE FROM public.subscriptions;
DELETE FROM public.clients;
DELETE FROM public.practitioners;
DELETE FROM public.programs;

-- Verify
SELECT COUNT(*) FROM public.clients;
SELECT COUNT(*) FROM public.programs;
```

---

## Performance Tips

### 1. Use Indexes Effectively

```sql
-- All indexes are auto-created by migration
-- Check what's indexed:
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
```

### 2. Batch Requests

```bash
# Instead of 100 individual POST requests:
# Create bulk endpoint in future

# For now, use GET /crm/programs to list all at once
curl http://localhost:8004/crm/programs?limit=100
```

### 3. Monitor Query Performance

```sql
-- In Supabase, enable query logging
-- Check slow queries:
SELECT * FROM pg_stat_statements WHERE mean_exec_time > 100;
```

---

## Next: Integration Testing

After manual testing, write pytest tests:

```python
# tests/test_crm_endpoints.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_create_program(client):
    response = client.post(
        "/crm/programs",
        json={"name": "Test", ...},
        headers={"Authorization": f"Bearer {TOKEN}"}
    )
    assert response.status_code == 201
    assert response.json()["id"]
```

---

**Quick Reference Compiled: Ready to Test!** ✅
