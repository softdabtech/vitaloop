# 🧪 Test Plan: Free User Registration & Full Flow

**Date:** May 7, 2026  
**Environment:** vitaloop.today (Production)  
**Test User Email:** testuser-free-20260507@test.com  
**Admin Notification Email:** info@softdab.tech  
**Purpose:** End-to-end testing of Free plan user journey for investor demonstrations  

---

## 📊 Test Objectives

1. ✅ Verify complete user registration flow
2. ✅ Confirm registration data logged to info@softdab.tech
3. ✅ Test onboarding with all required fields
4. ✅ Verify Free plan upload limits (1-2 analyses/month)
5. ✅ Test biomarker upload and OCR processing
6. ✅ Verify protocol generation and results
7. ✅ Document each step for Google Analytics tracking
8. ✅ Confirm all emails are delivered correctly

---

## 🔄 Complete User Flow with Checkpoints

### **PHASE 1: LANDING PAGE & SIGNUP**

#### Step 1.1: Access Landing Page
- **Action:** Navigate to https://vitaloop.today
- **Expected Result:** 
  - Landing page loads with hero section
  - "Start Free" button visible
  - Pricing plans displayed
- **Logging:** GA event `page_view` - Landing page
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 1.2: Click "Start Free" CTA
- **Action:** Click "Start Free" button
- **Expected Result:**
  - Redirected to /login with signup=true
  - Signup form displayed (email & password fields)
  - Toggle between "Sign In" and "Sign Up" visible
- **API Called:** None (client-side routing)
- **Logging:** GA event `click_cta` - "Start Free"
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 1.3: Enter Registration Details
- **Action:** 
  - Email: `testuser-free-20260507@test.com`
  - Password: `TestPass123!@#`
- **Expected Result:**
  - Form accepts input
  - No validation errors
  - Fields remain populated
- **Logging:** GA event `form_input` - email field
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 1.4: Submit Registration
- **Action:** Click "Create Account" button
- **Expected Result:**
  - Form submission in progress (loading state)
  - User account created in Supabase
  - Session established
- **API Called:** 
  - Supabase: `signUp()` 
  - Backend: `POST /auth/registration/notify` (admin alert)
  - Backend: `POST /auth/registration/welcome` (user welcome email)
- **Logging:** 
  - GA event `funnel_signup_completed`
  - GA event `user_property_set` (new_user=true)
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 1.5: Verify Welcome Email
- **Action:** Check email inbox (after 5-30 seconds)
- **Expected Result:**
  - Email from: `onboarding@vitaloop.today` (or SendGrid equivalent)
  - Subject: "Welcome to VITALOOP"
  - Content: Personalized greeting + dashboard link + getting started tips
  - Email body includes user name
- **Logging:** Email service confirms delivery
- **Status:** [ ] Pass [ ] Fail
- **Received at:** ___________
- **Notes:** ___________

#### Step 1.6: Verify Admin Registration Alert
- **Action:** Check info@softdab.tech inbox
- **Expected Result:**
  - Email from: vitaloop notification email
  - Subject: "New VITALOOP signup: testuser-free-20260507@test.com"
  - Content includes:
    - Email address
    - Full name (if provided)
    - User ID (UUID)
    - Registration timestamp
    - Signup flow (email_signup)
    - Link to ops dashboard
- **Logging:** Confirms registration logged to admin
- **Status:** [ ] Pass [ ] Fail
- **Received at:** ___________
- **Content Preview:**
  ```
  Email: testuser-free-20260507@test.com
  User ID: [UUID]
  Created at: [timestamp]
  Flow: email_signup
  ```
- **Notes:** ___________

#### Step 1.7: Email Confirmation (if applicable)
- **Action:** Check for Supabase confirmation email
- **Expected Result:**
  - May receive confirmation email (depends on Supabase settings)
  - Contains confirmation link
  - User can click to confirm email
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

---

### **PHASE 2: ONBOARDING**

#### Step 2.1: Redirect to Onboarding
- **Action:** Complete signup
- **Expected Result:**
  - Auto-redirect to /onboarding
  - Onboarding form visible
  - Step 0 (Basics) displayed
  - Progress indicator shows step 1/4
- **API Called:** `GET /auth/onboarding/state` (check status)
- **Logging:** GA event `page_view` - Onboarding (step 0)
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 2.2: Step 0 - Personal Information
- **Action:** Fill in:
  - Height: 180 cm
  - Weight: 75 kg
  - Supplements: Select 2-3 from dropdown list
- **Expected Result:**
  - Fields accept input
  - Dropdown filters as user types
  - Selection shows in field
  - "Next" button enabled
- **API Called:** None (local state)
- **Logging:** GA event `form_input` - onboarding_step_0
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 2.3: Step 1 - Health Goals
- **Action:** 
  - Click "Next"
  - Select 3 health goals (checkboxes)
- **Expected Result:**
  - Progress updates to step 2/4
  - Checkbox options visible
  - Multiple selection works
  - "Next" button available
- **API Called:** None (local state)
- **Logging:** GA event `onboarding_step_1_completed`
- **Status:** [ ] Pass [ ] Fail
- **Selected Goals:** 
  - [ ] Energy & Vitality
  - [ ] Weight Management
  - [ ] Athletic Performance
- **Notes:** ___________

#### Step 2.4: Step 2 - Location
- **Action:**
  - Click "Next"
  - Select Country: Ukraine (or local country)
  - Select City: Kyiv (or local city)
- **Expected Result:**
  - Country dropdown shows filtered list
  - City dropdown appears after country selection
  - Cities filtered by country
  - Selection persists
  - "Next" button works
- **API Called:** None (local state + dropdown data)
- **Logging:** GA event `onboarding_step_2_completed` with location data
- **Status:** [ ] Pass [ ] Fail
- **Location Selected:** Ukraine, Kyiv
- **Notes:** ___________

#### Step 2.5: Step 3 - Symptoms/Complaints
- **Action:**
  - Click "Next"
  - Search and select symptoms: "Fatigue", "Brain Fog", "Sleep"
- **Expected Result:**
  - Search field filters symptoms as user types
  - Suggestions appear (autocomplete)
  - Multiple selections work
  - Selected items show as badges
  - Can remove items by clicking X
- **API Called:** None (local state)
- **Logging:** GA event `onboarding_step_3_completed` with selected symptoms
- **Status:** [ ] Pass [ ] Fail
- **Selected Symptoms:**
  - [ ] Fatigue
  - [ ] Brain Fog  
  - [ ] Poor Sleep Quality
- **Notes:** ___________

#### Step 2.6: Complete Onboarding
- **Action:** Click "Complete Onboarding" button
- **Expected Result:**
  - Form submitted successfully
  - Loading state briefly shows
  - Redirect to /dashboard
  - Welcome message displays: "Welcome, [User Name]"
  - No "Welcome back" shown (first login)
- **API Called:** `POST /auth/onboarding/complete`
- **Database:** User `requires_onboarding` set to false
- **Logging:** 
  - GA event `onboarding_completed`
  - Backend logs registration data
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

---

### **PHASE 3: DASHBOARD (First Visit)**

#### Step 3.1: Dashboard Loads
- **Action:** Auto-loaded after onboarding completion
- **Expected Result:**
  - Dashboard page displays
  - Welcome message: "Welcome, [Name]"
  - Free plan limits displayed (1-2 analyses/month)
  - "Upload first lab" CTA visible
  - Health ring or status cards visible
  - No loading spinner (after cache)
- **API Called:** 
  - `GET /auth/me` (user info)
  - `GET /dashboard/summary` (dashboard data)
  - `GET /auth/subscription` (plan info - should be FREE)
- **Logging:** GA event `page_view` - Dashboard (first_visit=true)
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 3.2: Verify Free Plan Display
- **Action:** Look at plan information on dashboard
- **Expected Result:**
  - Shows: "Free / Starter Plan"
  - Displays limits: "1-2 analyses per month"
  - Shows upgrade CTA to Premium ($19.99/mo)
  - Displays "Basic flags and summary" as included feature
- **Logging:** GA event `view_plan_info` - plan_type=free
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 3.3: Navigate to Upload
- **Action:** Click "Upload Lab Results" or "Upload first lab" button
- **Expected Result:**
  - Route to /upload page
  - Upload interface displays
  - File picker visible
  - Instructions visible
  - No paywall blocking (Free plan can upload 1 file)
- **API Called:** None (page load)
- **Logging:** GA event `page_view` - Upload page
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

---

### **PHASE 4: BIOMARKER DATA ENTRY/UPLOAD**

#### Step 4.1: Upload Lab File
- **Action:** 
  - Click "Choose File" 
  - Select a PDF file with lab results
- **Expected Result:**
  - File picker opens
  - File selected (PDF format)
  - File name displays
  - Upload button becomes active
- **API Called:** None (file selection)
- **Logging:** GA event `file_selected` with file_type=pdf, file_size
- **Status:** [ ] Pass [ ] Fail
- **File Used:** lab_results_sample.pdf
- **Notes:** ___________

#### Step 4.2: Submit Lab File
- **Action:** Click "Upload and Analyze" button
- **Expected Result:**
  - Loading state shows "Processing..."
  - File uploads to backend
  - OCR processing begins
  - Progress indicator updates
- **API Called:** `POST /analyze` (file upload + OCR)
- **Logging:** GA event `lab_upload_started`
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 4.3: OCR & Biomarker Extraction
- **Action:** Wait for processing (30-60 seconds)
- **Expected Result:**
  - Extracted biomarkers displayed
  - Results show: name, value, reference range, status (optimal/warning/critical)
  - Biomarkers include: glucose, cholesterol, vitamins, etc.
  - Loading spinner disappears
  - Results page shows extracted data
- **API Called:** Backend processes OCR, extracts biomarkers
- **Logging:** 
  - GA event `lab_analysis_completed`
  - Backend logs extracted biomarkers
- **Status:** [ ] Pass [ ] Fail
- **Biomarkers Extracted:** [count] items
- **Notes:** ___________

#### Step 4.4: Review Extracted Results
- **Action:** Scroll through extracted biomarkers
- **Expected Result:**
  - Each biomarker shows:
    - Name (e.g., "Vitamin D")
    - Current value
    - Reference range
    - Status color (red/yellow/green)
    - Interpretation
  - Ability to edit/correct values
  - "Generate Protocol" button visible
- **Logging:** GA event `view_lab_results`
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

---

### **PHASE 5: PROTOCOL GENERATION**

#### Step 5.1: Click "Generate Protocol"
- **Action:** Click "Generate Protocol" button
- **Expected Result:**
  - Modal or redirect to protocol page
  - "Generating your personalized protocol..." message
  - Loading spinner shows
  - Backend calls Claude AI
- **API Called:** `POST /protocol` (AI analysis)
- **Logging:** GA event `protocol_generation_started`
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 5.2: AI Analysis Processing
- **Action:** Wait for AI to analyze biomarkers
- **Expected Result:**
  - Processing takes 30-120 seconds
  - Progress updates ("Analyzing... 60%")
  - Loading spinner continues
  - No timeout errors
- **Backend:** Claude AI analyzes biomarkers
- **Logging:** Backend logs AI processing
- **Status:** [ ] Pass [ ] Fail
- **Processing Time:** _____ seconds
- **Notes:** ___________

#### Step 5.3: Protocol Generation Complete
- **Action:** Wait for results
- **Expected Result:**
  - Protocol page displays results
  - Shows: 
    - **Problem Priority List** (prioritized by severity)
    - **Personalized Recommendations** (specific actions)
    - **Supplement Protocol** (recommended supplements with dosages)
    - **Lifestyle Changes** (diet, sleep, exercise)
    - **Follow-up Timeline** (when to retest)
  - PDF export button available
- **API Called:** Backend returns protocol data
- **Logging:** GA event `protocol_generation_completed`
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 5.4: View Protocol Details
- **Action:** Scroll through protocol page
- **Expected Result:**
  - Priority problems ranked 1-5
  - Each problem has:
    - Name and severity
    - Current biomarker values
    - Recommended action
    - Expected improvement timeline
  - Supplement list shows:
    - Name
    - Dosage
    - Frequency
    - Expected benefit
    - Where to buy (iHerb affiliate link)
- **Logging:** GA event `view_protocol_details`
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 5.5: Download Protocol as PDF
- **Action:** Click "Download Protocol" button
- **Expected Result:**
  - PDF generates (5-10 seconds)
  - File downloads to computer
  - Filename format: "Protocol_VIT_{date}_{user_id}.pdf"
  - PDF contains all protocol information
  - Branded with VITALOOP logo
- **API Called:** Backend generates PDF
- **Logging:** GA event `protocol_downloaded` with file_size
- **Status:** [ ] Pass [ ] Fail
- **Downloaded Filename:** ___________
- **Notes:** ___________

---

### **PHASE 6: RESULTS & NAVIGATION**

#### Step 6.1: Navigate to Results Page
- **Action:** Click "Lab Results" in sidebar or navigate to /lab-results
- **Expected Result:**
  - Results page shows uploaded file history
  - Shows: date, filename, status (processed/analyzing)
  - Results list shows all uploads
  - Pagination if multiple uploads
- **API Called:** `GET /results/latest`
- **Logging:** GA event `page_view` - Lab Results page
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 6.2: View Individual Result
- **Action:** Click on uploaded lab result
- **Expected Result:**
  - Opens result detail page
  - Shows extracted biomarkers
  - Shows protocol link
  - Shows generation date/time
  - Can re-download protocol
- **API Called:** `GET /results/{uploadId}`
- **Logging:** GA event `view_result_detail`
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 6.3: Check Progress Page
- **Action:** Navigate to /progress
- **Expected Result:**
  - Shows biomarker trends over time
  - If only 1 upload: shows baseline data
  - Charts display if multiple uploads available
  - Comparison shows changes over time
- **API Called:** `GET /progress`
- **Logging:** GA event `page_view` - Progress page
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

---

### **PHASE 7: VERIFICATION & LOGGING**

#### Step 7.1: Verify Database Registration
- **Action:** Check backend logs/database
- **Expected Result:**
  - User record created in public.users table
  - Fields: id, email, global_role (end_user), created_at
  - Onboarding data stored in profiles table
  - Subscription status: free
- **Status:** [ ] Pass [ ] Fail
- **Database Records:**
  - Users table: ✅
  - Profiles table: ✅
  - Subscriptions table: ✅
- **Notes:** ___________

#### Step 7.2: Verify Admin Email Received
- **Action:** Check info@softdab.tech inbox
- **Expected Result:**
  - Registration alert email received
  - Contains all user details
  - Timestamp matches registration
  - Can be used for investor demos
- **Email Details:**
  - Subject: "New VITALOOP signup: testuser-free-20260507@test.com"
  - From: vitaloop notification
  - Date: [when received]
  - Full Details Received: ✅
- **Status:** [ ] Pass [ ] Fail
- **Notes:** ___________

#### Step 7.3: Google Analytics Events Logged
- **Action:** Check GA in real-time
- **Expected Result:**
  - Events captured:
    - page_view (landing, signup, onboarding, dashboard)
    - click_cta (Start Free button)
    - funnel_signup_completed
    - onboarding_completed
    - lab_upload_started
    - lab_analysis_completed
    - protocol_generation_completed
    - protocol_downloaded
  - User properties set
  - Session duration tracked
- **Logging:** All GA events visible in GA dashboard
- **Status:** [ ] Pass [ ] Fail
- **GA Events Logged:** _____ count
- **Notes:** ___________

#### Step 7.4: Backend Logs Analysis
- **Action:** Check backend logs
- **Expected Result:**
  - Registration logged with timestamp
  - API calls logged for each step
  - OCR processing logged
  - AI analysis logged
  - Errors (if any) captured
- **Status:** [ ] Pass [ ] Fail
- **Log Entries:** _____ items
- **Notes:** ___________

---

## 📈 Expected Metrics (After Complete Flow)

| Metric | Expected Value | Actual Value |
|--------|----------------|--------------|
| Time to register | < 2 min | _____ |
| Time to complete onboarding | 3-5 min | _____ |
| Time to upload & process | 1-2 min | _____ |
| Time for protocol generation | 1-2 min | _____ |
| Total flow time | 7-15 min | _____ |
| GA events captured | 12+ | _____ |
| Emails received | 2 (welcome + admin) | _____ |
| API calls made | 15+ | _____ |

---

## 🐛 Issues Found

### Critical Issues
- [ ] None found

### Non-Critical Issues  
- [ ] None found

---

## ✅ Summary

**Overall Status:** [ ] PASS [ ] FAIL

**What Worked:**
- ___________

**What Needs Fixing:**
- ___________

**Investor-Ready:** [ ] Yes [ ] No

**Notes for Next Version:**
- ___________

---

**Test Completed By:** Claude Haiku 4.5  
**Test Date:** May 7, 2026  
**Test Duration:** _____ minutes
