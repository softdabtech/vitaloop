# Auth Flow Debugging Guide

## ✅ Deployed Changes

The frontend has been updated with **comprehensive console logging at every step** of the authentication flow. The logging captures the exact path taken from login form submission to CRM handoff.

### Console Log Sequence Expected

When you log in, you should see these logs in your browser's DevTools Console (in order):

```
[STEP 0] Form submission started
[STEP 0B] Calling signInWithEmail
[STEP 0C] Auth response received: {hasError: false, errorMsg: undefined}
[STEP 1] Login successful, preparing CRM handoff
[STEP 1B] Return URL from search params: null
[STEP 2] Getting Supabase session
[STEP 2B] Session received: {hasSession: true, hasToken: true}
[STEP 2C] Calling resolvePostLoginDestination
[STEP 3A] Fetching /auth/me
[STEP 3B] User context fetched successfully: {...user data...}
[STEP 3E] Getting Supabase session...
[STEP 3G] Access token obtained, length: 845
[STEP 3H] Resolved target URL: https://crm.vitaloop.today/auth/post-login
[STEP 3I] Destination resolved, returning result
[STEP 2D] resolvePostLoginDestination returned: {url: "https://crm.vitaloop.today/auth/post-login", method: "POST"}
[STEP 2E] Calling navigateToResolvedPath
[STEP 4] navigateToResolvedPath called: {destination: {...}, hasMethod: true}
[STEP 5] POST method detected, initiating handoff
[STEP 5A] Creating form for CRM handoff: {url: "https://crm.vitaloop.today/auth/post-login", tokenLength: 845}
[STEP 5B] Form created and token input added: {formAction: "https://crm.vitaloop.today/auth/post-login"}
[STEP 5C] Form appended to body, about to submit
[STEP 5D] Form target: {action: "https://crm.vitaloop.today/auth/post-login", method: "POST"}
[STEP 5E] Form submitted!
[STEP 2F] navigateToResolvedPath completed - user should be redirected to CRM
```

## 🔍 How to Debug

### Step 1: Open Developer Tools
1. Go to https://vitaloop.today/login
2. **Windows:** Press `F12`
3. **Mac:** Press `Cmd + Option + I`
4. Click **Console** tab

### Step 2: Clear Console
1. Right-click in the Console area
2. Select "Clear console"

### Step 3: Attempt Login
1. Enter your test credentials
2. Click Sign In
3. Watch the Console for logs appearing in real-time

### Step 4: Identify Where Flow Breaks

**Report the Last Console Log You See:**

For example, if you see logs up to `[STEP 5A]` but then no more logs and the page stays on /login, then:
- ✅ Form creation worked
- ✅ Token was obtained
- ❌ Form submission might have been blocked

## 🎯 Common Failure Scenarios

### Scenario A: Flow stops at STEP 0C with error
```
[STEP 0C] Auth response received: {hasError: true, errorMsg: "Invalid login credentials"}
```
**Issue:** Incorrect email/password  
**Fix:** Use correct credentials

### Scenario B: Flow stops at STEP 2B with no session
```
[STEP 2B] Session received: {hasSession: false, hasToken: false}
```
**Issue:** Supabase login didn't set session  
**Fix:** Check Supabase configuration or try again

### Scenario C: Flow stops at STEP 3A or 3B
```
[STEP 3B] Failed to fetch /auth/me context: Network error
```
**Issue:** Backend /auth/me endpoint unreachable or return 401  
**Fix:** This is OK! The flow should continue to STEP 3E

### Scenario D: Flow stops at STEP 3F
```
[STEP 3F] No access token in session! {sessionData: {...}}
```
**Issue:** Session exists but no access_token inside it  
**Fix:** Supabase session structure issue - report full sessionData

### Scenario E: Flow reaches STEP 5E but page doesn't redirect
```
[STEP 5E] Form submitted!
[STEP 2F] navigateToResolvedPath completed - user should be redirected to CRM
```
**But still on /login page**  
**Issue:** Browser is preventing form submission to different domain  
**Fix:** Check CORS headers, browser privacy settings

## 📊 Network Tab Inspection

### To verify the handoff request:

1. Open DevTools → **Network** tab
2. Attempt login
3. Look for requests to `crm.vitaloop.today`
4. You should see:
   - **POST** `/auth/post-login` → Response: **302 Found** → Location: `/ops`
   - If you see a **GET** `/auth/post-login` → The form submission might be reloading instead of POSTing

## 🔗 Verify Cookie Attachment

After login, if you see the CRM POST request:

1. Click on the **POST** `/auth/post-login` request in Network tab
2. Go to **Request Headers** tab
3. Check for:
   ```
   Cookie: vo_access_token=eyJ...
   ```
   - If present → ✅ CRM is setting and sending cookies correctly
   - If absent → ❌ Browser cookie policy might be blocking it

## 📝 Reporting Issues

When you perform a test login, please share:

1. **Last console log line** printed (the STEP number and exact message)
2. **Any red error messages** in the Console
3. **Screenshot** of the Network tab showing requests to `crm.vitaloop.today`
4. **Browser** (Chrome, Safari, Firefox, etc.)
5. **URL** where you tested (https://vitaloop.today/login vs localhost)

## ✅ Success Criteria

Login is working correctly when:
1. Console shows all logs up to `[STEP 5E] Form submitted!`
2. Browser redirects to CRM (`crm.vitaloop.today`)
3. CRM shows your dashboard without "Session validation failed"
4. Network tab shows:
   - ✅ GET `/auth/me` → 200 or 401 (both OK)
   - ✅ POST `/auth/post-login` → 302
   - ✅ Potentially GET  `/ops` → 200

## 🚀 Next Steps After Testing

After you've tested and reported:
1. I'll analyze the console logs
2. Identify the exact breakpoint
3. Apply targeted fix to that specific step
4. Deploy and retest

---

**Frontend Deployment Date:** April 15, 2026  
**Commit:** c7cf714 (logging), 00d5bcd (syntax fix)
