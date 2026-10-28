# 🐛 VITALOOP QA TEST REPORT - Auth Flow Bugs Found

**Date:** June 2026  
**Tested By:** Senior QA Tester  
**Test Credentials:** zzz@z.com / Aaaaaaa8  
**Test Domains:** vitaloop.today, ua.vitaloop.today, crm.vitaloop.today

---

## ✅ COMPONENTS WORKING CORRECTLY

### 1. Supabase Authentication
- **Status:** ✅ WORKING
- **Test:** Sign-in with zzz@z.com / Aaaaaaa8
- **Result:** JWT token generated successfully
- **Token Type:** ES256 JWT with correct issuer
- **Token Issuer:** https://bfjxkzydonhwmafnyktt.supabase.co/auth/v1
- **Token Audience:** authenticated

### 2. Frontend `/auth/me` Endpoint
- **Status:** ✅ WORKING
- **Domains Tested:** vitaloop.today, ua.vitaloop.today
- **Response:** User context retrieved correctly
- **User Data Returned:**
  - User ID: 00a35d2f-92d4-41f5-9a27-c02f97e2f0db
  - Email: zzz@z.com
  - Global Role: end_user
  - Onboarding Completed: true
- **Response Time:** < 100ms

### 3. Frontend Login Component
- **Status:** ✅ WORKING (for end-users)
- **File:** `/vitaloop/frontend/src/pages/Login.jsx`
- **Features:** Email validation, password validation, error handling
- **Localization:** Ukrainian (ua.vitaloop.today) & English (vitaloop.today)

---

## 🔴 CRITICAL BUGS FOUND

### BUG #1: CRM Post-Login Redirect Loop for End-Users
**Severity:** HIGH  
**Status:** Open - Requires Fix

#### Description
When an `end_user` (role) attempts to POST their token to CRM `/auth/post-login`, the system incorrectly redirects them to `/admin` endpoint, resulting in a 403 Forbidden error instead of properly rejecting the request or redirecting to the frontend.

#### Flow Trace
```
1. POST /auth/post-login with token (end-user)
   ↓ [Status: 302]
2. CRM sets cookie `vo_access_token` ✅
   ↓ [Redirect: /auth/post-login]
3. GET /auth/post-login with cookie
   ↓ [Status: 302]
4. Token validation PASSES (token is valid) ✅
   ↓ [Redirect: /admin]
5. GET /admin with cookie
   ↓ [Status: 403] ❌ FORBIDDEN
   
   Expected: Should redirect to https://vitaloop.today/dashboard
   Actual: Returns 403 Forbidden
```

#### Root Cause
File: `/vitaloop/crm-mvc/Services/Auth/AuthRedirectService.cs` (Line 41)

```csharp
public string ResolvePostLoginRedirect(UserContext ctx)
{
    // Lines 10-39: Check for pending invites, super_admin, admin roles, practitioner roles
    
    return "/admin";  // ⚠️ BUG: Always returns /admin, even for users with NO CRM roles
}
```

The function **assumes** every authenticated user has some CRM role, but doesn't handle the `end_user` case who shouldn't access CRM at all.

#### Impact
- **Affected Users:** End-users who somehow access `/auth/post-login` directly
- **Fallback Scenario:** If frontend `/auth/me` fails, end-users might POST token to CRM
- **Current Workaround:** None - results in 403 error

#### Fix Required
```csharp
// Before final return statement, check if user has any CRM roles:
if (!activeMembers.Any())
{
    // No CRM roles - user should not be in CRM
    return "https://vitaloop.today/dashboard";  // Redirect to frontend
}
return "/admin";
```

---

### BUG #2: Frontend Post-Login Fallback May Route End-Users to CRM
**Severity:** MEDIUM  
**Status:** Open - Requires Review

#### Description
In `postLogin.js`, when `/auth/me` endpoint fails, the frontend attempts to resolve role from Supabase session directly. In certain edge cases, this could potentially route an end-user to the CRM handoff flow.

#### File & Location
`/vitaloop/frontend/src/auth/postLogin.js` (Lines 130-170)

#### Current Logic
```javascript
if (authMeFailed) {
    const sessionRole = resolveRoleFromSessionUser(sessionUser)
    
    if (sessionRole !== 'end_user') {
        // POST token to CRM
        return {
            url: AUTH_POST_LOGIN_PATH,
            method: 'POST',
            token: accessToken,
        }
    }
    // ... else handle end_user
}
```

#### Potential Issue
- If Supabase session data is corrupted or role metadata is missing
- The fallback logic might incorrectly classify an end-user
- This could trigger the BUG #1 scenario

#### Recommendation
Add logging to track when `/auth/me` fails and fallback logic is triggered.

---

## ✅ VERIFIED WORKING: Frontend Auth Logic

### End-User Login Path (Correct)
```javascript
// postLogin.js checks: "Is this user an end-user?"
if (authMe && resolveGlobalRole(authMe) === 'end_user') {
    // ✅ CORRECT: Stay on frontend, don't POST to CRM
    return {
        url: APP_BASE_URL + '/dashboard',  // 100% frontend
        method: 'GET',
    }
}
```

### CRM User Login Path
```javascript
// postLogin.js checks: "Does user have CRM roles?"
if (sessionRole !== 'end_user') {
    // ✅ Should POST token to CRM /auth/post-login
    return {
        url: AUTH_POST_LOGIN_PATH,
        method: 'POST',
        token: accessToken,
    }
}
```

---

## 🧪 TEST RESULTS SUMMARY

| Component | Status | Notes |
|-----------|--------|-------|
| Supabase Sign-In | ✅ PASS | JWT generated with ES256, correct issuer/audience |
| /auth/me (vitaloop.today) | ✅ PASS | Returns end_user context correctly |
| /auth/me (ua.vitaloop.today) | ✅ PASS | Identical to main domain |
| CRM Token Validation | ✅ PASS | Cookie set correctly, JWT signature valid |
| CRM /auth/post-login → /admin | 🔴 FAIL | Returns 403 for end-users instead of error/redirect |
| Frontend auth flow (end-user) | ✅ PASS | Does NOT call CRM, stays on frontend |

---

## 🔧 RECOMMENDED FIXES (Priority Order)

### 1. **CRITICAL:** Fix AuthRedirectService (CRM)
```csharp
// File: /vitaloop/crm-mvc/Services/Auth/AuthRedirectService.cs
// Add check before final return statement:

if (!activeMembers.Any() && 
    !string.Equals(ctx.GlobalRole, "super_admin", StringComparison.OrdinalIgnoreCase))
{
    // End-user or user with no CRM role - should not be here
    // Return frontend URL or throw appropriate error
    throw new InvalidOperationException($"User {ctx.UserId} has no CRM roles and should not be in CRM.");
}
```

### 2. **HIGH:** Add logging to post-login fallback (Frontend)
```javascript
// File: /vitaloop/frontend/src/auth/postLogin.js
// Add console.warn when authMeFailed:
if (authMeFailed) {
    console.warn('[Auth] /auth/me failed, using fallback session resolution');
    // ... rest of logic
}
```

### 3. **MEDIUM:** Document role resolution logic
Create documentation explaining:
- What constitutes a "CRM role"
- When post-login redirects to CRM vs Frontend
- How to test with different role types

---

## 📝 NEXT STEPS FOR TESTING

1. ✅ Test end-user login on vitaloop.today - **DONE (WORKING)**
2. ⏳ Test with CRM admin user (create test account with org_admin role)
3. ⏳ Test practitioner user login flow
4. ⏳ Manual browser testing on vitaloop.today
5. ⏳ Manual browser testing on ua.vitaloop.today
6. ⏳ Test `/auth/me` failure scenario (kill backend temporarily)

---

## 🎯 CONCLUSION

**Overall Status:** 🟡 **PARTIALLY WORKING**

**Summary:**
- ✅ Core auth infrastructure works (Supabase, JWT validation)
- ✅ Frontend handles end-user flow correctly
- 🔴 CRM incorrectly handles end-user edge case
- ⚠️ Need to test CRM user flows (admin/practitioner) to confirm they work

**Blocking Issues:** None for normal end-user flow  
**Critical Bugs:** 1 (BUG #1 - requires CRM fix)  
**Medium Bugs:** 1 (BUG #2 - requires frontend review)

---

*Generated: QA Testing Session 2026-06-30*  
*Test Engineer: Senior QA Tester*
