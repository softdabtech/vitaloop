# 🔧 How to Fix CRM User Visibility - Step by Step

## ⚠️ Problem Description

Users registered in the application cabinet are NOT appearing in the CRM. This means:
- ✅ Users can register and login
- ✅ Users appear in Supabase `auth.users` table  
- ❌ Users DO NOT appear in CRM at https://crm.vitaloop.today/crm/clients
- ❌ CRM shows "No clients yet"

**Root Cause:** Registered users don't have corresponding records in the `clients` table (CRM registration was never triggered).

---

## 🚀 Solution: 3 Steps

### Step 1: Verify the Problem (Optional)

```bash
# SSH to production server
ssh root@159.65.252.227

# Check backend logs
tail -50 /var/log/syslog | grep "crm\|client"

# Test API directly
curl -H "Authorization: Bearer test" \
  https://vitaloop.today/api/crm/clients
# Should return: {"items": [], "total": 0}
```

---

### Step 2: Apply the Fix via Supabase Dashboard

**Duration:** ~2 minutes

1. **Open Supabase Console**
   - Go to: https://app.supabase.com
   - Select your project (VitaLoop)

2. **Open SQL Editor**
   - Click: "SQL Editor" (left sidebar)
   - Click: "New Query"

3. **Copy & Paste the Fix**
   - Copy this entire SQL block:

```sql
-- FIX: Create client records for all registered users
BEGIN;

-- Step 1: Create missing client records
INSERT INTO public.clients (user_id, onboarding_status, created_at, updated_at)
SELECT 
  u.id,
  'started' as onboarding_status,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.clients c WHERE c.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Create free subscriptions  
INSERT INTO public.subscriptions (user_id, plan_name, status, started_at, created_at)
SELECT 
  c.user_id,
  'free' as plan_name,
  'active' as status,
  NOW() as started_at,
  NOW() as created_at
FROM public.clients c
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s 
  WHERE s.user_id = c.user_id AND s.status = 'active'
)
ON CONFLICT (user_id, plan_name, status) DO NOTHING;

-- Step 3: Ensure trigger is active for future registrations
CREATE OR REPLACE FUNCTION public.handle_new_client()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = NEW.id) THEN
    INSERT INTO public.clients (user_id, onboarding_status, created_at, updated_at)
    VALUES (NEW.id, 'started', NOW(), NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_create_client ON auth.users;
CREATE TRIGGER on_auth_user_created_create_client
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client();

COMMIT;
```

4. **Execute**
   - Paste into the editor
   - Click: "Run" button (Cmd+Enter)
   - Wait for success message ✅

5. **Verify Success**
   ```sql
   -- Run this to check results:
   SELECT COUNT(*) as total_users FROM auth.users;
   SELECT COUNT(*) as total_clients FROM public.clients;
   SELECT COUNT(*) as active_subs FROM public.subscriptions WHERE status = 'active';
   ```

---

### Step 3: Verify in CRM

**Test immediately:**

1. **Open CRM Admin**: https://crm.vitaloop.today
2. **Login** with super_admin credentials
3. **Go to Clients**: https://crm.vitaloop.today/crm/clients
4. **Verify:**
   - ✅ Users now appear in the table
   - ✅ Email column shows user emails
   - ✅ Display Name shows (if filled in user profile)

---

## 📊 Expected Results

### Before Fix:
```
GET /api/crm/clients
→ { "items": [], "total": 0 }

CRM Screenshot:
┌─────────────────────────┐
│ No clients yet          │
│ Clients will appear ... │
└─────────────────────────┘
```

### After Fix:
```
GET /api/crm/clients
→ {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": "...",
        "email": "john.doe@gmail.com",
        "display_name": "John Doe",
        "onboarding_status": "started",
        "created_at": "2026-04-19T10:00:00Z"
      },
      { ... more users ... }
    ],
    "total": 15
  }

CRM Screenshot:
┌──────────────────────────────────────────────┐
│ Email               │ Display Name │ Status  │
├──────────────────────────────────────────────┤
│ john.doe@gmail.com  │ John Doe     │ started │
│ jane.smith@example  │ Jane Smith   │ started │
│ ... (all 15 users)                           │
└──────────────────────────────────────────────┘
```

---

## 🔍 Troubleshooting

### Issue 1: Still No Users After Running SQL

**Check:** Did the query execute successfully?
- ✅ You should see green checkmark
- ❌ If red error → check error message

**Solution:**
```sql
-- Check how many users were created
SELECT COUNT(*) as orphaned_users 
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = u.id);

-- If > 0, the fix didn't work. Try:
INSERT INTO public.clients (user_id, onboarding_status)
SELECT id, 'started' FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.users.id);
```

### Issue 2: "Permission Denied" Error

**Cause:** RLS policies preventing inserts

**Fix:**
```sql
-- Check current RLS
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('clients', 'subscriptions');

-- If rowsecurity = true, need to update RLS policies
-- Contact Supabase support or check RLS configuration
```

### Issue 3: Trigger Not Working for New Users

**Check:**
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name = 'on_auth_user_created_create_client';
```

Should return a result. If empty → trigger wasn't created.

**Fix:** Re-run the SQL script or:
```sql
-- Re-create manually
CREATE TRIGGER on_auth_user_created_create_client
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client();
```

---

## 📈 Verification Checklist

After applying the fix, verify:

- [ ] Run SQL in Supabase Dashboard
- [ ] See success message (no errors)
- [ ] Query shows: `SELECT COUNT(*) FROM public.clients` > 0
- [ ] Login to CRM with super_admin
- [ ] Visit /crm/clients
- [ ] See list of all registered users
- [ ] Each user has email + display_name visible
- [ ] New user signup automatically creates client record (optional: test with new account)

---

## 🔐 What This Fix Does

| Action | Details |
|--------|---------|
| **Creates missing client records** | For every `auth.users` that doesn't have a `clients` entry |
| **Assigns free subscription** | Every client gets a free subscription (status='active') |
| **Enables trigger** | Future signups will automatically create client records |
| **No data loss** | Uses `ON CONFLICT` to avoid duplicates |

---

## 🚨 Important: Why This Happened

The migration `stage-5-crm-tables.sql` includes a trigger to auto-create client records. However:

1. **Scenario A:** Migration was NOT applied to production Supabase
   - → Existing users have no client records
   - → Fix: Apply the SQL above

2. **Scenario B:** Migration was applied but trigger was disabled/removed
   - → Existing users fine, but new registrations fail
   - → Fix: SQL script re-creates the trigger

3. **Scenario C:** New users registered BEFORE migration was applied
   - → All existing users orphaned
   - → Fix: SQL creates backlog + restores trigger

The SQL fix handles all 3 scenarios.

---

## 📞 Support

If you still have issues:

1. **Check logs:**
   ```bash
   ssh root@159.65.252.227
   tail -100 /var/log/syslog | grep crm
   ```

2. **Check database directly:**
   ```sql
   -- Supabase Dashboard → SQL Editor
   SELECT COUNT(*) as auth_users FROM auth.users;
   SELECT COUNT(*) as crm_clients FROM public.clients;
   SELECT COUNT(*) as missing FROM auth.users 
   WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.users.id);
   ```

3. **Test API:**
   ```bash
   curl https://vitaloop.today/api/crm/clients \
     -H "Authorization: Bearer $JWT_TOKEN"
   ```

---

**Status:** Ready to apply ✅  
**Risk Level:** Low (uses ON CONFLICT to prevent duplicates)  
**Estimated Time:** 5 minutes  
**Requires:** Supabase dashboard access
