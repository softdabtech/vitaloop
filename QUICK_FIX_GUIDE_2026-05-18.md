# 🚀 QUICK FIX GUIDE - Production Issues 2026-05-18

## ✅ What's Done
- Frontend UI fixes deployed ✅
- Backend emergency endpoints deployed ✅
- Database fixes prepared ✅

## 🔥 CRITICAL: 2 Issues to Fix NOW

### Issue #1: bombela1988@gmail.com - CRM Access Blocked
**Status:** Super admin completely locked out

**Fix (2 min):**
1. Open: https://app.supabase.com/project/bfjxkzydonhwmafnyktt/auth/users
2. Search: `bombela1988@gmail.com`
3. Click **Edit**
4. Scroll to **App metadata** (JSON section)
5. Add this:
   ```json
   { "is_super_admin": true }
   ```
6. Click **Save**

**Verify:**
- User should be able to access CRM at https://crm.vitaloop.today

---

### Issue #2: a@a.com - Shows Free Instead of Premium
**Status:** User has active subscription but shows Free plan

**Fix (2 min):**
1. Open: https://app.supabase.com/project/bfjxkzydonhwmafnyktt/sql/new
2. Paste this SQL:
   ```sql
   UPDATE public.subscriptions
   SET status = 'active', plan_name = 'premium', cancel_at_period_end = false
   WHERE user_id = (SELECT id FROM public.users WHERE email = 'a@a.com')
   ORDER BY updated_at DESC LIMIT 1;
   ```
3. Click **Execute** (Run icon)

**Verify:**
- User should see Premium features unlocked in cabinet

---

## 🧪 Final Verification

After applying both fixes, run these checks:

```bash
# Check if fixes applied (these will show user data)
# Note: Replace TOKEN with actual auth token

# bombela1988@gmail.com should show super_admin role
curl -H "Authorization: Bearer $TOKEN" \
  https://api.vitaloop.today/auth/me | jq '.global_role'

# a@a.com should show premium
curl -H "Authorization: Bearer $TOKEN" \
  https://api.vitaloop.today/billing/stripe/subscription | jq '.is_premium'
```

---

## 🎯 FASTEST PATH

1. **2 min** - Fix bombela1988@gmail.com via Supabase Auth dashboard
2. **2 min** - Fix a@a.com via SQL editor
3. **1 min** - Test both users in production
4. **Done** ✅

**Total: 5 minutes max**

---

## 📚 If Issues Persist

- **CRM still blocked?** → Check browser cache (Ctrl+F5), try incognito window
- **Still shows Free?** → Users need to logout/login for JWT refresh
- **SQL won't execute?** → Copy/paste carefully, ensure email is exact

---

## 🚨 If Something Goes Wrong

### Rollback backend:
```bash
ssh root@159.65.252.227
cd /var/www/VITALOOP
./scripts/rollback.sh
```

### Restore database from backup:
Ask in Supabase dashboard for point-in-time recovery

---

**Last Updated:** 2026-05-18 09:47 UTC
**Status:** Ready for manual fixes ✅
