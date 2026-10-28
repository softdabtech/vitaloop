# 🎯 User Testing Guide - VitaLoop Production

## Quick Start

### 1️⃣ **Access the Application**

**Frontend:** https://vitaloop.today  
**API:** https://api.vitaloop.today  
**CRM:** https://crm.vitaloop.today  

### 2️⃣ **Test Account Credentials**

```
Email:    a@a.com
Password: Aaaaaa
Status:   Premium subscription (active)
```

### 3️⃣ **Sign In**

1. Go to https://vitaloop.today
2. Click "Sign In"
3. Enter email: `a@a.com`
4. Enter password: `Aaaaaa`
5. Click "Sign In" button

---

## 🧪 Test Scenarios

### ✅ Scenario 1: Profile Management

**Goal:** Update user profile information

**Steps:**
1. Sign in with test account
2. Click profile icon (top right)
3. Go to "Settings" or "Profile"
4. Update fields:
   - First name
   - Last name
   - Timezone
   - Preferences
5. Click "Save"
6. Verify changes persisted (refresh page)

**Expected Result:** ✅ Profile updated and saved

---

### ✅ Scenario 2: Lab Upload & Analysis

**Goal:** Upload lab results and get biomarker analysis

**Steps:**
1. Sign in
2. Go to "Upload Lab Results" or "Analysis" tab
3. Click "New Upload"
4. Paste or type lab results text:

```
Complete Blood Count
Hemoglobin 14.2 g/dL (13.5-17.5)
WBC 6.1 x10^9/L (4.0-11.0)
Platelets 250 x10^9/L (150-400)

Metabolic Panel
Glucose 92 mg/dL (70-99)
Creatinine 0.95 mg/dL (0.7-1.3)

Lipid Panel
Total Cholesterol 182 mg/dL
HDL 58 mg/dL
LDL 103 mg/dL
Triglycerides 105 mg/dL
```

5. Add optional details:
   - Lab name (e.g., "Quest Diagnostics")
   - Test date
   - Symptoms: select any symptoms
6. Click "Analyze"
7. Wait for results (extracting biomarkers...)

**Expected Result:** ✅ Biomarkers extracted and displayed

---

### ✅ Scenario 3: View Progress

**Goal:** See lab history and health tracking

**Steps:**
1. Sign in
2. Go to "Progress" or "My Labs" tab
3. Verify you see:
   - List of uploaded labs
   - Test dates
   - Biomarker data
   - Trend visualization (if available)

**Expected Result:** ✅ Lab history visible with all uploads

---

### ✅ Scenario 4: Get Health Insights

**Goal:** View personalized health recommendations

**Steps:**
1. Sign in
2. Go to "Insights" tab
3. Check for:
   - Health score (0-100)
   - Key health metrics
   - Recommendations
   - Risk flags (if any)

**Expected Result:** ✅ Insights calculated and displayed

---

### ✅ Scenario 5: View Timeline

**Goal:** See chronological health events

**Steps:**
1. Sign in
2. Go to "Timeline" tab
3. Verify you see:
   - List of health events
   - Dates and descriptions
   - Chronological order
4. Click on event for details (if available)

**Expected Result:** ✅ Timeline shows health history

---

### ✅ Scenario 6: Complete Questionnaire

**Goal:** Answer health questionnaire

**Steps:**
1. Sign in
2. Go to "Questionnaire" or "Assessment" tab
3. Click "Start New Assessment"
4. Answer questions:
   - Select answers from options
   - Some questions may have follow-ups
5. Continue until complete
6. Submit assessment
7. View results/score

**Expected Result:** ✅ Questionnaire completes and stores answers

---

### ✅ Scenario 7: Subscription Status

**Goal:** Verify premium subscription

**Steps:**
1. Sign in
2. Go to "Settings" → "Subscription" or profile menu
3. Verify status shows:
   - Plan: Premium
   - Status: Active
   - Features unlocked

**Expected Result:** ✅ Subscription shows as active

---

## 🔍 Key Features to Test

| Feature | Location | Expected Behavior |
|---------|----------|-------------------|
| **Sign In** | Main page | Email/password auth works |
| **Profile** | Settings | Can update and save |
| **Lab Upload** | Analysis tab | Accepts lab text, extracts biomarkers |
| **Progress** | Dashboard | Shows uploaded labs |
| **Insights** | Insights tab | Displays health recommendations |
| **Timeline** | Timeline tab | Shows health events |
| **Questionnaire** | Assessment tab | Multi-question flow works |
| **Subscription** | Settings | Shows "Premium" status |

---

## 🐛 Reporting Issues

When you find a problem, please document:

### 1. **Basic Info**
- Your test account email
- Timestamp of issue
- Browser/device information

### 2. **Steps to Reproduce**
- Exact steps that caused the issue
- What you clicked/entered
- What happened vs expected

### 3. **Evidence**
- Screenshot of error
- Error message (if any)
- HTTP status code (if API error)
- Network tab logs (if needed)

### 4. **Example Report Format**
```
Issue: Lab upload fails with 422 error
Timestamp: April 19, 2026 11:05 UTC
Steps:
1. Go to Upload tab
2. Paste lab text
3. Click Analyze
Result: Error message "Invalid format"
Expected: Biomarkers extracted
```

---

## 📱 Browser Support

**Tested & Working:**
- ✅ Chrome/Chromium (latest)
- ✅ Safari (latest)
- ✅ Firefox (latest)
- ✅ Edge (latest)

**Mobile:**
- ✅ iOS Safari
- ✅ Android Chrome

---

## ⚡ Performance Expectations

| Operation | Expected Time |
|-----------|---------------|
| Sign in | < 2 seconds |
| Profile save | < 1 second |
| Lab analysis | 5-10 seconds |
| Load progress | < 1 second |
| Get insights | < 2 seconds |
| Complete questionnaire | < 5 seconds |

---

## 🆘 Troubleshooting

### Issue: Can't sign in
**Solution:**
- Verify email: `a@a.com`
- Verify password: `Aaaaaa` (case-sensitive)
- Check for space characters
- Try clearing browser cookies
- Try incognito/private window

### Issue: Lab upload shows error
**Solution:**
- Verify you're logged in
- Check that lab text is readable
- Try uploading sample text (provided above)
- Check browser console for errors (F12)

### Issue: Insights not loading
**Solution:**
- Ensure you have uploaded labs
- Wait 5-10 seconds for calculation
- Refresh page
- Check that subscription is active

### Issue: API calls fail
**Solution:**
- Verify URL: https://api.vitaloop.today
- Check network connection
- Look for CORS errors in browser console
- Ensure Bearer token is present (if making API calls)

---

## 📞 Getting Help

If you encounter issues:
1. Check troubleshooting section above
2. Take screenshots of error
3. Note the exact steps to reproduce
4. Report with timestamp
5. Include browser/device info

---

## ✅ Sign-Off Checklist

After testing, verify:

- [ ] Able to sign in
- [ ] Profile can be updated
- [ ] Lab upload works
- [ ] Biomarkers extracted
- [ ] Progress shows uploads
- [ ] Insights display
- [ ] Timeline shows events
- [ ] Questionnaire completes
- [ ] Subscription shows as active
- [ ] No broken links
- [ ] No console errors
- [ ] Responsive on mobile (if testing)

---

## 📊 Test Coverage

**Areas Covered:**
- ✅ Authentication (login, profile)
- ✅ Core features (upload, analysis, progress)
- ✅ User engagement (questionnaire, insights)
- ✅ Subscription (premium features)
- ✅ API (health, readiness)

**Notes:**
- Test account has premium subscription enabled
- All features should be accessible
- Lab data is persisted in database
- Previous uploads remain visible

---

**Ready to Start Testing?**

👉 **Go to: https://vitaloop.today**

Sign in with:
- Email: `a@a.com`
- Password: `Aaaaaa`

Good luck! 🚀
