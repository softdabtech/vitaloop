# Vitaloop UX Flow - New Architecture
**Goal:** Redesign the user journey to be maximally effective for long-term engagement (1+ year retention)

---

## 🎯 Core User Journey Logic

### First Time User Path (Onboarding)
```
Sign Up → Health Profile (lite) → Upload First Lab → See Results → Create Protocol → First Week
```

### Regular User Path (Repeat)
```
Dashboard (see status) → Check-in (weekly) → New Data (optional upload) → Insights → Adjust Plan
```

---

## 📄 Dashboard (Home)
**Purpose:** One-screen health dashboard. "Where am I and what's next?"

### What Should Be There ✨
- **Health Score Card** (Top, big)
  - Single number 0-100 based on: adherence + biomarker trends + symptoms
  - Color-coded: Red/Yellow/Green
  - Tap to see breakdown

- **Next Action Block** (Contextual CTA)
  - If no upload: "🔼 Upload your first lab (2 min)"
  - If waiting results: "⏳ Your lab is being analyzed..."
  - If has protocol: "📋 Due today: Morning supplement"
  - If due check-in: "✅ Weekly check-in (3 min)"

- **Progress Strip** (Visual)
  - Last 3 biomarkers you care about + trend arrows (↑/↓/—)
  - Only 3, not 10. Show what's improving.
  - Tap to see full history

- **This Week Summary** (Mini)
  - Check-ins done: 1/1 ✅
  - Protocol adherence: 85%
  - New symptoms logged: 0

- **Upcoming** (Subtle)
  - Next check-in: Friday 6pm
  - Retest recommendation date

### Current State
- ⚠️ Has placeholder "Welcome back" block
- ⚠️ Tips panel is static, not personalized
- ⚠️ Stats not calculated from real data
- ⚠️ No "next action" CTA

### TODO
- [ ] Calculate real health score (backend)
- [ ] Show personalized next action (smart logic)
- [ ] Build progress strip from latest biomarkers
- [ ] Remove unused blocks

---

## 🔼 Upload (Ingest Lab)
**Purpose:** Fast, friction-free lab ingestion with smart context

### What Should Be There ✨
- **Smart Uploader**
  - Drag-drop or camera (mobile)
  - Shows: File type, size, confidence of OCR
  - Real-time preview: "Found X biomarkers"

- **Context Collection** (1 question per screen)
  1. When was this test taken? (date)
  2. How are you feeling? (3-4 emoji options)
  3. Any new symptoms? (free text or quick list)

- **Processing State**
  - Progress bar: Scanning → Extracting → Analyzing → Ready
  - Shows what AI is doing (transparency)
  - Auto-redirect to results when done

- **Result Preview**
  - "35 biomarkers found"
  - Flags: 3 normal, 2 borderline, 1 critical
  - "Your personalized protocol is ready" (button)

### Current State
- ✅ Works, OCR is fast
- ⚠️ Doesn't require health profile (risky, can't personalize)
- ⚠️ No processing state feedback
- ⚠️ Redirects to nowhere after upload

### TODO
- [ ] Add mandatory health profile check before upload
- [ ] Build processing state UI
- [ ] Auto-redirect to Lab Results on complete
- [ ] Show confidence score for OCR

---

## 📊 Lab Results (Detailed Breakdown)
**Purpose:** Understand WHAT is abnormal and WHY it matters

### What Should Be There ✨
- **Header**
  - Test date, lab name, "Reviewed by Dr. [name]" (if exists)
  - Action: "Download PDF" | "Share with practitioner"

- **Results by Category** (not alphabetical)
  1. **Flagged First** (Immediate attention)
     - Critical items: RED badge
     - Borderline items: YELLOW badge
     - Each with: value | reference range | trend arrow
     - One-line insight: "Vitamin D low (winter + limited sun?)"
  
  2. **Optimal** (Reassurance)
     - Green checkmarks
     - Collapsed by default (expand to see all)
  
  3. **New Markers** (FYI)
     - First-time detection
     - Light blue, informational only

- **Smart Insights** (AI-generated, per biomarker)
  - Not generic: "Vitamin D is low because..."
  - What to consider: food, supplements, sun exposure
  - When to retest

- **Personal Notes**
  - User can add their own notes
  - "I was sick that week" → AI remembers context for next upload

### Current State
- 🔴 **BROKEN** — Lab Results page fails to load for free users
- ⚠️ Only shows latest 1 upload for free (not ideal UX)
- ✅ Backend has biomarker data

### TODO
- [ ] **FIX**: Ensure free users can see at least 1 lab (no 402 error)
- [ ] Build categorized display (flagged → optimal → new)
- [ ] Add AI micro-insights per biomarker
- [ ] Add note-taking feature
- [ ] Show trend comparison if multiple uploads exist

---

## 📋 Protocol (Auto-Generated Plan)
**Purpose:** Clear action plan based on lab results. "Here's what to do."

### What Should Be There ✨
- **Why This Protocol?**
  - "Based on: low Vitamin D, high inflammation, low energy symptom"
  - Shows the logic (transparency)

- **Daily Protocol** (Simple list, not overwhelming)
  - Each item: emoji + action + timing + reason
  - "🧈 Omega-3 fish oil 1000mg with breakfast (reduce inflammation)"
  - "💤 Sleep: 10:30pm bedtime (normalize cortisol)"
  - "☀️ Sunlight: 20min daily morning (boost Vitamin D)"

- **Duration & Retest**
  - "This protocol: 4 weeks"
  - "Next lab recommended: [date]"
  - Reason for retest

- **What NOT to do** (Optional, but powerful)
  - "Avoid: High-dose Vitamin A (you're borderline elevated)"

- **Q&A Section**
  - Tap on any item to see: why, how, alternatives
  - "Why omega-3? Because..."

### Current State
- ⚠️ Generated after upload but unclear if shown to user
- ⚠️ No clear UX to display protocol

### TODO
- [ ] Show protocol immediately after upload
- [ ] Build clean protocol display (not just raw JSON)
- [ ] Add "Why this?" explanations
- [ ] Connect to assignments (each protocol item = assignable task)
- [ ] Allow users to customize/reject items

---

## ✅ Assignments (Your Action Items)
**Purpose:** Gamified protocol adherence. "Did you do it today?"

### What Should Be There ✨
- **Today's Checklist** (Top)
  - Visual: incomplete items in blue, completed in green
  - "You're 3/7 done today — great start!"
  - Tap to mark as done (with emoji celebration)

- **This Week** (Below)
  - Calendar strip: Mon-Sun
  - Each day shows: X/7 items done
  - Tap to see which ones, mark retroactively
  - Weekly adherence %

- **Overdue or At-Risk** (Alert)
  - Red badge if missed yesterday
  - "Your sleep schedule is slipping — get back on track?"

- **Filter by Type** (Optional)
  - Supplements | Habits | Measurements | Labs
  - Helps find what user actually wants to do today

### Current State
- ⚠️ Shows data from backend but UI is sparse
- ⚠️ No gamification or positive feedback
- ✅ Has filter and status tracking

### TODO
- [ ] Build "Today's Checklist" component
- [ ] Add checkmark interaction with celebration
- [ ] Show weekly adherence graph
- [ ] Add smart reminders ("You always do this at 8am")
- [ ] Connect check-in logic (weekly review of adherence)

---

## 📈 Progress (Biomarker Tracking)
**Purpose:** See long-term improvement. "Is my protocol working?"

**KEY DECISION:** Should this be FREE or PREMIUM only?
- **Current:** Premium only (blocks free users from seeing trends)
- **Recommendation:** Make BASIC free, ADVANCED premium
  - Free: See your values over time (yes/no comparison)
  - Premium: Advanced analytics, percentile scores, retest predictions

### What Should Be There ✨
- **Trending Biomarkers** (Your Key 3)
  - Line chart: value over time
  - X-axis: upload date
  - Highlight: optimal range as green zone
  - Show: trend direction + % change since start
  - One-line interpretation: "Improving steadily ✅"

- **Personal Wins** (Motivation)
  - "Vitamin D: +32% in 8 weeks"
  - "Inflammation score: Moved from borderline to optimal"
  - Celebration messages

- **What's Still Needed** (Realistic)
  - "B12 still low. Keep supplementing."
  - Projected date to reach optimal

- **Retest Recommendation**
  - "Next test due: [date] — let's confirm improvements"
  - Button: "Schedule retest" (internal logic)

### Current State
- ⚠️ Premium-only barrier (might be intentional but hurts engagement)
- ⚠️ Data calculation unclear
- ⚠️ No real biomarker history shown

### TODO
- [ ] Allow FREE users to see basic trends (1-2 charts)
- [ ] Build comparison logic (upload 1 vs upload 2+)
- [ ] Add celebration copy for wins
- [ ] Calculate retest recommendations
- [ ] Show simple %-change metrics

---

## 💡 Insights (AI Analysis & Recommendations)
**Purpose:** Actionable intelligence. "What does this all mean for me?"

### What Should Be There ✨
- **Hot Topics** (What AI found most relevant)
  1. "Your energy is low + Vitamin D deficient → likely connected"
  2. "Sleep quality improved +15% since protocol started"
  3. "Inflammation markers trending wrong way — adjust protocol?"

- **Biomarker Connections** (Context)
  - "These 3 biomarkers work together"
  - "B12 affects: energy, mood, cognitive function"
  - Interactive education

- **Alerts** (Early warning)
  - "Ferritin dropped sharply. Watch for fatigue."
  - "Cortisol pattern suggests stress. Consider adaptation?"

- **For You** (Personalized suggestions)
  - "Since you mentioned travel, here's how to maintain your protocol"
  - "You missed supplements Friday — here's a catch-up plan"

- **Learn More**
  - Each insight links to detailed article (if exists)
  - Not required for core UX, but nice-to-have

### Current State
- ⚠️ Exists but can be empty if no data
- ⚠️ May show placeholder/dummy insights
- ✅ Has tabs: insights | alerts | trends

### TODO
- [ ] Build smart AI logic for "hot topics"
- [ ] Connect biomarkers to user symptoms (2-way link)
- [ ] Add alert threshold system
- [ ] Generate personalized suggestions from protocol state
- [ ] Build alerts display

---

## 🔄 Check-Ins (Weekly Engagement)
**Purpose:** Keep user engaged, provide context for AI, gather adherence data

### What Should Be There ✨
- **Triggered by:** Email reminder Friday afternoon "Your weekly check-in is ready (3 min)"

- **Step 1: How are you feeling?** (1 question)
  - 4 options: Drained | Off-balance | Steady | Great
  - Emoji + description

- **Step 2: Sleep quality** (1-5 star rating)
  - Optional: "What helped/hurt?"

- **Step 3: Protocol adherence** (1 question)
  - "Did you follow your protocol this week?"
  - Yes, daily | Partially | Not yet | N/A (wasn't ready)

- **Step 4: Anything new?** (1 free text)
  - "New symptoms, changes, or questions?"
  - Optional

- **Summary & Praise**
  - "Great adherence this week! 🎉"
  - OR "No worries, building habits takes time. Let's reset..."

- **Auto-Action**
  - If adherence low: suggest protocol adjustment
  - If feeling great: celebrate & take photo for progress

### Current State
- ✅ Works, UI is clean
- ✅ 4-step flow is good
- ⚠️ Data might not feed back into dashboard/insights

### TODO
- [ ] Connect check-in data → dashboard health score
- [ ] Add optional progress photo feature
- [ ] Suggest protocol tweaks based on adherence
- [ ] Show streak counter ("5 weeks in a row! 🔥")

---

## 👤 Health Profile (Baseline Information)
**Purpose:** Personalization. "Tell us about you so we can be smart."

### What Should Be There ✨
- **Personal Baseline** (2-column layout)
  - Left: Demographics
    - Age, Sex, Height, Weight (BMI auto-calc)
    - Timezone
    - Location (optional, for sun exposure context)
  
  - Right: Health Goals
    - Checkboxes: More energy | Better sleep | Hormone balance | etc.
    - Max 3 primary goals
    - Used for protocol prioritization

- **Red Flags** (Optional but smart)
  - "Any current medications?"
  - "Any allergies?"
  - "Pregnancy or breastfeeding?"
  - These inform biomarker interpretation

- **Updated Quarterly**
  - Prompt after 3 months: "Let's update your profile"
  - Weight, energy level, adherence self-report

### Current State
- ⚠️ Exists but layout is broken (full width, needs 2-col)
- ⚠️ Unclear if data is used for personalization
- ⚠️ No red flag collection

### TODO
- [ ] Fix layout: 2-column on desktop, stack on mobile
- [ ] Add red flag collection (medications, allergies)
- [ ] Ensure data feeds into protocol generation
- [ ] Add quarterly update prompts
- [ ] Show "Data used for: protocol + insights + risk assessment"

---

## 💳 Subscription (Plans & Paywall)
**Purpose:** Clear monetization. Give free value, unlock premium for power users.

### What Should Be There ✨
- **Three-Plan Model**
  
  **FREE**
  - 1 active upload per month
  - See latest lab results (not history)
  - Basic biomarker summary
  - Weekly check-ins
  - Dashboard (limited)
  - CTAssistant: "Upgrade to track progress"

  **PREMIUM ($9.99/mo or $95/yr)**
  - Unlimited uploads
  - Full lab history & comparison
  - Personalized protocol
  - AI insights & alerts
  - Progress tracking (charts)
  - Email support
  - Advanced check-in features

  **ENTERPRISE ($99+/mo)**
  - Team seats
  - Practitioner CRM
  - API access
  - Custom workflows

- **Upgrade Prompts** (Smart placement)
  - NOT on every screen
  - Only when hitting limit: "You've used your 1 free upload. Upgrade to continue."
  - OR in Progress page: "Want to see your trends? Upgrade."
  - NOT on Settings or Subscription page itself

- **Money-Back Guarantee**
  - "30-day guarantee. If not improving, full refund."
  - Builds trust

### Current State
- ✅ Plans defined
- ⚠️ **BUG:** Premium users see upgrade prompt (wrong logic)
- ⚠️ Lab Results shows 402 error to free users (hostile)

### TODO
- [ ] **FIX:** Remove upgrade prompts from Premium user journey
- [ ] **FIX:** Show free users results, just limit to 1 upload
- [ ] Build smart paywall logic (show after value, not before)
- [ ] Add money-back guarantee copy
- [ ] Track upgrade conversion by placement

---

## ⚙️ Settings (Account & Preferences)
**Purpose:** User control. Privacy, notifications, account safety.

### What Should Be There ✨
- **Notifications** (Toggles)
  - Weekly digest (labs, protocol, check-in reminder)
  - Check-in reminders (Friday 6pm)
  - New insights available
  - Protocol adjustments suggested

- **Privacy**
  - Data storage: "Your data is stored encrypted on [location]"
  - Share protocol/results with practitioner (toggle + invite)
  - HIPAA compliance badge

- **Account**
  - Email (read-only, change via Supabase)
  - Password change
  - 2FA (optional)
  - Connected devices

- **Danger Zone**
  - Delete account (with 30-day recovery)
  - Download my data (GDPR export)
  - Sign out all devices

- **About**
  - App version
  - Support: email | chat | FAQ

### Current State
- ✅ Basic settings work
- ⚠️ Notifications not well integrated
- ⚠️ No HIPAA/privacy messaging

### TODO
- [ ] Add notification preferences (more granular)
- [ ] Build privacy reassurance section
- [ ] Add "share with practitioner" feature skeleton
- [ ] Implement data download (GDPR)
- [ ] Add app version & support links

---

## 🚀 New Navigation Structure

```
BOTTOM TAB BAR (Mobile) / SIDEBAR (Desktop)
├─ Dashboard (📊) — Home
├─ Upload (🔼) — New lab
├─ My Labs (📄) — Results history
├─ Protocol (📋) — Your plan
├─ Check-In (✅) — Weekly
├─ Progress (📈) — Trends
├─ Insights (💡) — AI analysis
├─ Profile (👤) — Health info
├─ Account (⚙️)
│  ├─ Settings
│  ├─ Subscription
│  └─ Sign out
```

**Rationale:**
- Primary actions (Upload, Check-in) are tabs, not buried in menu
- Dashboard remains home for quick status check
- Profile/Account separate because less frequent

---

## ✅ Implementation Priority

### Phase 1 (Critical, blocks engagement)
- [ ] Fix Lab Results (free users can see results)
- [ ] Fix Progress page (allow free users basic trends)
- [ ] Fix Progress prompts (don't show upgrade on Premium)
- [ ] Build "Next Action" CTA on Dashboard
- [ ] Build Health Score calculation

### Phase 2 (Core UX improvements)
- [ ] Health Profile: fix layout, add red flags
- [ ] Build biomarker insights (AI)
- [ ] Connect check-in data → dashboard
- [ ] Build assignments UI (today's checklist)
- [ ] Add progress celebration features

### Phase 3 (Polish & retention)
- [ ] Add progress photo feature
- [ ] Build notifications system (in-app + email)
- [ ] Add practitioner share feature
- [ ] Build health tips personalization
- [ ] Add streak counters & badges

---

## 📊 Success Metrics to Track

1. **Onboarding completion** (Sign up → First upload → See results)
2. **Weekly check-in completion** (Should be 70%+)
3. **Protocol adherence** (Self-reported, should trend up)
4. **Upload frequency** (Ideally 1 per month after first)
5. **Premium conversion** (Free → paid rate)
6. **Retention** (30-day, 90-day, 1-year)
7. **NPS** (Net Promoter Score feedback)

---

## 🎯 Core Philosophy for This New Flow

**"Make the health journey feel rewarding, not overwhelming."**

- Show ONE number (Health Score), not 100
- Ask for ONE action, not a list
- Celebrate small wins loudly
- Make data feel personal, not clinical
- Remove friction where possible
- Keep free tier useful (build trust)
- Upgrade prompts only when needed
