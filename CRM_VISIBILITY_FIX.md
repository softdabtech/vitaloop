# CRM User Visibility Fix - Quick Start

## Problem
Registered users from the cabinet don't appear in CRM. This happens when:
- User registers via `/auth/signup`
- `auth.users` record is created
- **BUT** `clients` table record is NOT created (trigger failure or was not applied)
- CRM `/crm/clients` endpoint returns empty list or only subset of users

## Root Cause
The SQL trigger `on_auth_user_created_create_client` (from stage-5-crm-tables.sql) may not have been applied to production Supabase.

## Solution: 4-Step Fix

### Step 1: Run the Diagnostic (optional)
```bash
cd /var/www/VITALOOP/backend
source .venv/bin/activate
python3 scripts/diagnose_crm_users.py
```

This will show:
- Total registered users
- Total client records
- How many users are "orphaned" (no client record)

### Step 2: Apply the Fix via Supabase SQL Editor

**Option A: Using Supabase Dashboard**
1. Go to: https://app.supabase.com → Your Project → SQL Editor
2. Create new query
3. Copy entire content from: `backend/sql/fix_crm_visibility.sql`
4. Run

**Option B: Using CLI (if available)**
```bash
psql postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres < backend/sql/fix_crm_visibility.sql
```

### Step 3: Verify the Fix
```bash
# SSH to production server
ssh root@159.65.252.227

# Test API endpoint
curl -H "Authorization: Bearer $SUPABASE_JWT" \
  https://vitaloop.today/api/crm/clients

# Should return users with email and display_name
```

### Step 4: Verify Trigger is Active
In Supabase SQL Editor, run:
```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%client%';
```

Should show: `on_auth_user_created_create_client` with `INSERT` event on `auth.users`

---

## What the Fix Does

### Creates Client Records
```sql
INSERT INTO public.clients (user_id, onboarding_status, created_at)
SELECT id, 'started', NOW() FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = u.id)
```
- Finds all auth.users without corresponding clients record
- Creates client record with `onboarding_status = 'started'`

### Creates Free Subscriptions
```sql
INSERT INTO public.subscriptions (user_id, plan_name, status)
SELECT user_id, 'free', 'active' FROM public.clients c
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = c.user_id)
```
- Ensures each client has an active free subscription

### Recreates the Trigger
```sql
CREATE TRIGGER on_auth_user_created_create_client
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client();
```
- Future registrations will automatically create client records

---

## Expected Results After Fix

### Before:
```
GET /crm/clients → []  (empty list)
Total users: 15
CRM visible: 0
```

### After:
```
GET /crm/clients → [
  { id: "uuid1", user_id: "uuid1", email: "user1@example.com", display_name: "John", ... },
  { id: "uuid2", user_id: "uuid2", email: "user2@example.com", display_name: "Jane", ... },
  ...
]
Total users: 15
CRM visible: 15
```

---

## Testing Checklist

- [ ] Ran diagnostic script (saw orphaned user count)
- [ ] Applied fix_crm_visibility.sql via Supabase
- [ ] Verified trigger exists in information_schema
- [ ] GET /crm/clients returns all users
- [ ] Each user has email + display_name
- [ ] New signup creates client record automatically
- [ ] Visited https://crm.vitaloop.today/crm/clients and see all users

---

## If Issue Persists

### Check 1: Trigger is Disabled
```sql
-- Re-enable trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created_create_client;
```

### Check 2: Function has wrong search_path
```sql
-- Fix search_path
ALTER FUNCTION public.handle_new_client() SET search_path = public;
```

### Check 3: RLS Policies Blocking Inserts
```sql
-- Check if RLS is preventing client inserts
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'clients';

-- If "rowsecurity" = true, check policies:
SELECT * FROM pg_policies WHERE tablename = 'clients';
```

### Check 4: Manual Insert Test
```sql
-- Test if you can manually insert a client record
INSERT INTO public.clients (user_id, onboarding_status)
VALUES (gen_random_uuid(), 'started');

-- If error: "violates row level security policy" → disable RLS or fix policies
```

---

## Advanced: Monitor Trigger Execution

Create a trigger log table:
```sql
CREATE TABLE IF NOT EXISTS trigger_logs (
  id BIGSERIAL PRIMARY KEY,
  trigger_name TEXT,
  event_time TIMESTAMP DEFAULT NOW(),
  user_id UUID,
  status TEXT
);

-- Modify handle_new_client to log:
INSERT INTO public.trigger_logs (trigger_name, user_id, status)
VALUES ('handle_new_client', NEW.id, 'success');
```

Then check:
```sql
SELECT * FROM trigger_logs ORDER BY event_time DESC LIMIT 20;
```

---

## Deployment Timeline

1. ✅ Created fix script: `fix_crm_visibility.sql`
2. ⏳ **Apply via Supabase SQL Editor** (manual step - requires dashboard access)
3. ⏳ Verify with `GET /crm/clients` API endpoint
4. ⏳ Test new user registration creates client record automatically

---

**Status:** Ready to apply  
**Risk:** Low (uses ON CONFLICT to prevent duplicates)  
**Rollback:** None needed (idempotent fix)
