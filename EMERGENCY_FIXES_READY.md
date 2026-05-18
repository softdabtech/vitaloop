# VITALOOP - Emergency Fixes Applied (2026-05-18)

## Status: ✅ READY FOR DEPLOYMENT

Backend emergency fix endpoints have been deployed to production.
Frontend UI fixes are already deployed.

---

## What Was Fixed

### ✅ Frontend (Already Deployed)
- Website button hover color (white → subtle gray)
- Check-in text overflow (added proper spacing)
- Tips persistence verified (uses localStorage)
- Dashboard CSS verified stable

### 🔧 Backend (Just Deployed)
- Added emergency fix endpoints for super admin and subscription fixes
- Endpoints protected with super admin access control
- Ready for use

---

## How to Apply Database Fixes

### Option 1: Via Backend API (Recommended for Remote)

**Prerequisites:**
- Your JWT token (get from browser localStorage after login)
- SSH access not needed

**Steps:**

1. Get your JWT token:
   - Open https://app.vitaloop.today
   - Open DevTools (F12) → Application → localStorage
   - Copy the auth token or JWT value

2. Apply fixes via curl:
   ```bash
   # Save your JWT token
   export JWT_TOKEN="your-jwt-token-here"
   export API_URL="https://api.vitaloop.today"
   
   # Fix super admin (sets global_role=super_admin in public.users)
   curl -X POST \
     "$API_URL/emergency/fix-super-admin/bombela1988@gmail.com" \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json"
   
   # Fix subscription for a@a.com
   curl -X POST \
     "$API_URL/emergency/fix-subscription/a@a.com?plan_name=premium" \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json"
   ```

3. **IMPORTANT MANUAL STEP for bombela1988@gmail.com:**
   - Above endpoint only updates `public.users.global_role`
   - Auth metadata requires manual fix in Supabase dashboard:
     1. Go to: https://app.supabase.com/project/bfjxkzydonhwmafnyktt/auth/users
     2. Find: `bombela1988@gmail.com`
     3. Click Edit
     4. In "App metadata" JSON, add:
        ```json
        { "is_super_admin": true }
        ```
     5. Save

---

### Option 2: Via Supabase SQL Editor (Most Direct)

Go to: https://app.supabase.com/project/bfjxkzydonhwmafnyktt/sql/new

**For bombela1988@gmail.com super admin access:**
```sql
-- Update public.users
UPDATE public.users
SET global_role = 'super_admin'
WHERE email = 'bombela1988@gmail.com';

-- Check result
SELECT id, email, global_role FROM public.users 
WHERE email = 'bombela1988@gmail.com';
```

**For a@a.com subscription fix:**
```sql
-- First, verify current status
SELECT s.id, s.status, s.plan_name, s.cancel_at_period_end, s.updated_at
FROM public.subscriptions s
LEFT JOIN public.users u ON s.user_id = u.id
WHERE u.email = 'a@a.com'
ORDER BY s.updated_at DESC LIMIT 1;

-- Then apply fix
UPDATE public.subscriptions
SET 
  status = 'active',
  plan_name = 'premium',
  cancel_at_period_end = false,
  updated_at = NOW()
WHERE user_id = (
  SELECT id FROM public.users WHERE email = 'a@a.com'
)
AND id = (
  SELECT id FROM public.subscriptions 
  WHERE user_id = (SELECT id FROM public.users WHERE email = 'a@a.com')
  ORDER BY updated_at DESC LIMIT 1
);

-- Verify fix
SELECT s.id, s.status, s.plan_name, s.cancel_at_period_end
FROM public.subscriptions s
LEFT JOIN public.users u ON s.user_id = u.id
WHERE u.email = 'a@a.com'
LIMIT 1;
```

---

## Verification

### After applying fixes, verify:

**For bombela1988@gmail.com:**
```bash
# Should be able to access CRM without redirect
curl https://crm.vitaloop.today -I

# JWT should contain is_super_admin: true
curl https://api.vitaloop.today/auth/me \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.global_role'
# Expected: "super_admin"
```

**For a@a.com:**
```bash
# Should show has_active_subscription: true
curl https://api.vitaloop.today/auth/me \
  -H "Authorization: Bearer <a@a.com_token>" | jq '.has_active_subscription'
# Expected: true

# Should show is_premium: true
curl https://api.vitaloop.today/billing/stripe/subscription \
  -H "Authorization: Bearer <a@a.com_token>" | jq '.is_premium'
# Expected: true
```

---

## Implementation Details

### Backend Changes
- **File:** `backend/app/routers/emergency_fixes.py` (NEW)
- **Modified:** `backend/app/main.py` (added router import)

### Endpoints Added (Protected with Super Admin)
1. `POST /emergency/fix-super-admin/{email}` - Set global_role
2. `POST /emergency/fix-subscription/{email}` - Fix subscription
3. `GET /emergency/check-user/{email}` - Check user status

### Security
- All endpoints require super admin authentication
- Uses JWT bearer token validation
- Changes are logged via Supabase audit

---

## Timeline

- ✅ 2026-05-18 09:00 - Frontend UI fixes deployed
- ✅ 2026-05-18 09:47 - Backend emergency endpoints deployed
- ⏳ PENDING - Manual Supabase auth metadata fix for bombela1988@gmail.com
- ⏳ PENDING - Verification that both users have proper access

---

## Troubleshooting

**If super admin can't access CRM after public.users fix:**
- Verify `raw_app_meta_data.is_super_admin = true` is set in Supabase auth.users
- Clear browser cache and try logout → login

**If a@a.com still shows as Free:**
- Run: `SELECT * FROM public.subscriptions WHERE user_id = (SELECT id FROM public.users WHERE email = 'a@a.com') LIMIT 1;`
- Verify: status='active', plan_name != 'free', cancel_at_period_end=false

**Backend won't restart after deploy:**
- Check SSH access: `ssh root@159.65.252.227`
- Check logs: `docker logs vitaloop-backend` on server
- Rollback: `./scripts/rollback.sh`

---

## Next Steps

1. ⏳ Execute one of the fix options above
2. ✅ Verify both users have proper access
3. ✅ Test CRM access for bombela1988@gmail.com
4. ✅ Test premium features for a@a.com
5. 📝 Update incident log

---

## Files Reference

- `/FIXES_DEPLOYMENT_2026-05-18.md` - Original fix documentation
- `/backend/app/routers/emergency_fixes.py` - New backend endpoints
- `/apply-emergency-fixes.sh` - Helper script
- `/fix_super_admin_and_subscription.sql` - SQL queries
- `/APPLY_FIXES_MANUAL.py` - Manual instructions

---

**Deploy Status:** ✅ BACKEND DEPLOYED & READY
**Frontend Status:** ✅ UI FIXES LIVE
**Database Fixes:** ⏳ MANUAL ACTION REQUIRED

Next action: Apply one of the fix options above, then verify both users have proper access.
