# START HERE: EXECUTION SPEC v1.0 → v1.1 SUMMARY

**Status:** READY FOR COMPATIBILITY REVIEW  
**Next Step:** Complete checklist below, THEN start coding  
**Owner:** Tech Lead + Product Lead  
**Timeline:** 2-3 days audit + corrections, then 4-6 weeks build

---

## WHAT WE BUILT

✅ **8 Strategic Docs** (00-07: Architecture, DB, Code, UX, Markets, Roadmap)  
✅ **6 Execution Specs** (Concrete implementation guides for EN iteration)  
✅ **1 Compatibility Review** (Pre-implementation audit)

---

## YOUR 4-6 WEEK GOAL

Transform **vitaloop.today** from:
```
Upload → See Results → Leave
```

Into:
```
Upload → See Results → Take Action → Check-In → Convert to Premium
```

**Success metrics:**
- 40%+ of report viewers complete a check-in
- 10%+ convert to premium within 30 days
- $2-3K MRR (month 2)
- >50% 7-day retention

---

## WHAT'S IN THE EXECUTION SPECS

### SPEC #1: Database Migrations
7 SQL migrations (copy-paste ready):
- `insights` — daily insight delivery
- `check_ins` — mood/energy tracking
- `protocols` — action plans
- `retest_recommendations` — scheduling
- `analytics_events` — tracking
- Subscription columns for users

**Status:** Assumes Supabase + standard RLS. ⚠️ Needs compatibility check.

---

### SPEC #2: Backend Endpoints
10 new FastAPI endpoints with JSON schemas:
- `POST /api/uploads/{id}/generate-report` — Immediate report
- `GET /api/reports/{id}` — Cached report
- `POST /api/check-ins` — Daily check-in
- `GET /api/check-ins/history` — Premium feature
- `GET /api/insights/{upload_id}` — Explanations
- `GET /api/protocols/{upload_id}` — Action plans
- `GET /api/retest-recommendations` — Scheduling
- + 3 more for analytics, archive, etc

**Status:** Assumes FastAPI structure. ⚠️ Needs route mapping.

---

### SPEC #3: UX Flow After Upload
Detailed wireframes (desktop + mobile) + component specs:
- Results page layout (priority summary → full table → explanations → protocols)
- Interaction flows (scroll → click → check-in → paywall)
- Paywall moment (after 3 free check-ins)
- Mobile-responsive design

**Status:** Conceptual. Ready for designer mockup.

---

### SPEC #4: Paywall Matrix
Monetization strategy:
- Free tier: 3 check-ins, then gate
- Premium: $9.99/month, unlimited tracking, trends
- 7-day free trial (choice: no-card or card-required)
- Email sequences (Day 0, 6, 7, post-expiration, etc)

**Status:** Conversion funnel designed. ⚠️ Trial model needs decision.

---

### SPEC #5: Copy Guide - Safe Health Claims
Legal safety library:
- 5 fundamental rules (never diagnose, stick to ranges, soft language, doctor pathway, disclaimers)
- Biomarker-specific explanations (ferritin, vitamin D, magnesium, TSH, glucose)
- Before/after examples
- Copy checklist for audit

**Status:** Comprehensive. ⚠️ Needs legal review, soften some claims.

---

### SPEC #6: Analytics Event Map
25+ events tracking full user journey:
- Upload → Report → Check-in → Paywall → Payment
- Implementation code (React + FastAPI)
- Dashboard metrics (funnel, retention, cohorts)
- Privacy guidelines (no PII, no health values)

**Status:** Detailed. ⚠️ Must remove specific marker names from analytics.

---

## SPEC v1.0 ISSUES (Before v1.1)

### 🔴 Critical (Must Fix Before Coding)

1. **RLS/user_id mapping unclear**
   - Spec assumes `auth.uid() = user_id` directly
   - Reality: may use internal users table
   - ⚠️ Action: Verify current auth model (Day 1 of audit)

2. **Endpoints may not exist**
   - Spec lists hypothetical `/api/uploads`, `/api/biomarkers`
   - Reality: may be `/analyze/pdf`, `/lab-results`, etc
   - ⚠️ Action: Map actual backend routes (Day 2)

3. **Reports storage undefined**
   - Spec uses `db.query(Report)` but no `reports` table designed
   - Reality: may need new table or derived from biomarkers
   - ⚠️ Action: Choose storage model (Day 3)

4. **Trial mechanics contradictory**
   - Says "no-card trial auto-converts" (impossible)
   - Must choose: no-card (manual) OR card-required (auto)
   - ⚠️ Action: Decide trial model

5. **Analytics contains PII**
   - Tracks specific marker names + values (health data)
   - GDPR risk: health info in analytics
   - ⚠️ Action: Remove markers, use categories instead

6. **Health copy too specific in places**
   - "Critically low", "Typical dose 25-50mg", "Works" without retest
   - ⚠️ Action: Legal review + soften language

---

### 🟡 Important (Should Fix in v1.1)

7. **Premium value lean**
   - Depends mostly on check-ins/trends
   - May not justify $9.99/month conversion
   - ⚠️ Action: Add compare reports, history export, templates

8. **No fallback for missing biomarker reference ranges**
   - Assumes lab PDFs always extract ranges
   - Reality: may need hardcoded or lookup table
   - ⚠️ Action: Plan for missing data

---

## NEXT 3 DAYS: COMPATIBILITY AUDIT CHECKLIST

### Day 1: Database Audit
```bash
☐ Check auth structure (Supabase UUID or internal?)
☐ List all existing tables (what's already in DB?)
☐ Check biomarkers schema (what columns exist?)
☐ Check RLS status (policies in place?)
☐ Verify user/profile/subscription schema

Output: CURRENT_SCHEMA_AUDIT.md
```

### Day 2: Code Audit
```bash
☐ List all backend routes (POST /xxx, GET /xxx)
☐ Find PDF parsing logic
☐ Check Stripe integration status
☐ Check if reports table exists
☐ Review current auth pattern

Output: CURRENT_ROUTES_INVENTORY.md
```

### Day 3: Decisions
```bash
☐ Auth model: Single UUID or internal users?
☐ Reports storage: Table or derived?
☐ Trial model: No-card or card-required?
☐ Analytics privacy: How to anonymize?
☐ Reference ranges: Where sourced?

Output: TECHNICAL_DECISIONS.md
```

---

## TASK DISTRIBUTION

### Backend Team (3 people)
**Reads:**
1. EXECUTION_SPEC_01_DATABASE_MIGRATIONS.md
2. EXECUTION_SPEC_02_BACKEND_ENDPOINTS.md
3. EXECUTION_SPEC_COMPATIBILITY_REVIEW.md

**Does:**
- [ ] Run Day 1-2 audits
- [ ] Create/update migrations
- [ ] Build 10 endpoints
- [ ] Integrate Stripe trial logic
- [ ] Deploy analytics tracking

**Timeline:** Weeks 1-6 (parallel with frontend)

---

### Frontend Team (2 people)
**Reads:**
1. EXECUTION_SPEC_03_UX_FLOW_AFTER_UPLOAD.md
2. EXECUTION_SPEC_04_PAYWALL_MATRIX.md
3. EXECUTION_SPEC_05_COPY_GUIDE_SAFE_CLAIMS.md

**Does:**
- [ ] Design/mock results page
- [ ] Build report components
- [ ] Build check-in component
- [ ] Implement paywall modal
- [ ] Payment flow with Stripe

**Timeline:** Weeks 1-5 (before Week 6 polish)

---

### Product/Copy (1 person)
**Reads:**
1. EXECUTION_SPEC_05_COPY_GUIDE_SAFE_CLAIMS.md
2. EXECUTION_SPEC_04_PAYWALL_MATRIX.md

**Does:**
- [ ] Final safety review of all health claims
- [ ] Draft email sequences
- [ ] Legal review of claims
- [ ] Finalize paywall copy
- [ ] Create support docs

**Timeline:** Weeks 1-4, then Week 5-6 final review

---

### QA (1 person)
**Reads:**
1. EXECUTION_SPEC_06_ANALYTICS_EVENT_MAP.md
2. All other specs (for coverage)

**Does:**
- [ ] Create test plan for each endpoint
- [ ] Test full user journey (upload → conversion)
- [ ] Analytics events verification
- [ ] Paywall logic testing
- [ ] Edge cases (failed payments, expired trials, etc)

**Timeline:** Weeks 2-6

---

## BEFORE YOU START CODING: SIGN-OFF CHECKLIST

**All boxes must be ☑️ before Week 1 coding begins:**

```
☐ Tech Lead: Reviewed COMPATIBILITY_REVIEW, confirmed schema/auth/endpoints
☐ Product: Decided on trial model (no-card vs card-required)
☐ Backend: Mapped current routes, identified migration strategy
☐ Legal/Copy: Reviewed health claims, approved safe language
☐ DevOps: Confirmed database access, backup strategy, deployment plan
☐ Product: Prioritized features (insurance retest, compare reports, etc)
☐ Design: Ready to mockup UX flows
☐ All: Agreed on Week 6 launch date
```

**If any box unchecked: STOP, resolve first.**

---

## PHASE BREAKDOWN

### Phase 1: Audit (Days 1-3)
- Tech audit of current system
- Decision on key questions
- Create CORRECTED v1.1 specs

### Phase 2: Setup (Days 4-7)
- DB migrations to staging
- Test infrastructure ready
- Team aligned on changes

### Phase 3: Build (Weeks 1-5)
- Parallel development (backend + frontend)
- Weekly demos
- Daily standup on blockers

### Phase 4: QA & Launch (Week 6)
- Full system testing
- Performance optimization
- Go-live preparation
- Monitor metrics

---

## SUCCESS CRITERIA (Week 6)

**Product:**
- ✅ Immediate report shows in 60 seconds
- ✅ Priority markers clearly highlighted
- ✅ Action plan is actionable (not vague)
- ✅ Check-in takes <30 seconds
- ✅ Paywall appears after value (not before)

**Metrics:**
- ✅ 40%+ of report viewers attempt check-in
- ✅ 20%+ of check-in starters hit paywall (on 4th attempt)
- ✅ 10%+ of paywall users start trial
- ✅ 50%+ of trial users convert to paid
- ✅ <1% payment errors

**Technical:**
- ✅ All endpoints tested
- ✅ RLS policies protect user data
- ✅ Analytics tracking 100% of user journey
- ✅ <2 sec page load time
- ✅ No GDPR/privacy issues

**Legal:**
- ✅ All claims reviewed by lawyer
- ✅ No "diagnosis" language
- ✅ "Discuss with doctor" on every action
- ✅ Disclaimers visible
- ✅ Terms & refund policy published

---

## RED FLAGS (If You See These, STOP)

🚩 **Schema is completely different** from assumptions  
→ Don't force specs, redesign them

🚩 **Auth system is fundamentally different** (JWT vs sessions vs other)  
→ Rewrite endpoints for actual auth

🚩 **No Stripe integration** and you planned to build it Week 3  
→ Start with free trial first, add payment later

🚩 **PDF parsing doesn't extract reference ranges**  
→ Build reference lookup, don't assume it exists

🚩 **Backend wants to use different framework** (Node instead Python)  
→ Rewrite code examples for actual stack

🚩 **Health copy gets flagged by legal** for claims  
→ More softening needed, don't fight it

---

## FINAL DECISION MATRIX

|  | IF... | THEN... |
|---|---|---|
| **Auth** | Internal users table | Update all REFERENCES, add mapping table |
| **Routes** | Different from spec | Map spec endpoints to actual routes |
| **Reports** | No table exists | Create caching table OR derive on-the-fly |
| **Trial** | No-card preferred | Manual conversion Day 7, no auto-charge |
| **References** | Not in PDF | Build hardcoded lookup table per lab |
| **Analytics** | Mixpanel not chosen | Use PostHog or Segment instead, same events |

---

## RESOURCES TO KEEP OPEN

While building, keep these docs open:

1. **EXECUTION_SPEC_05_COPY_GUIDE_SAFE_CLAIMS.md** ← Check every health claim
2. **EXECUTION_SPEC_06_ANALYTICS_EVENT_MAP.md** ← Track everything
3. **EXECUTION_SPEC_04_PAYWALL_MATRIX.md** ← Never charge before value
4. **EXECUTION_SPEC_COMPATIBILITY_REVIEW.md** ← Reference real schema

---

## HOW TO USE THESE DOCS

### For Backend Team:
1. Read SPEC #1 (migrations)
2. Read SPEC #2 (endpoints)
3. Run COMPATIBILITY_REVIEW audit
4. Correct #1 & #2 based on audit findings
5. Build week-by-week from corrected specs

### For Frontend Team:
1. Read SPEC #3 (UX flows)
2. Read SPEC #4 (paywall copy)
3. Wait for UX mockup approval
4. Build components from approved mockups
5. Integrate with backend endpoints

### For Product/Copy:
1. Read SPEC #5 (safe claims)
2. Work with legal/medical advisor
3. Finalize all health claims
4. Get sign-off before Week 1
5. Copy goes into frontend in Weeks 2-3

### For QA:
1. Read SPEC #6 (analytics + testing)
2. Read all specs (for coverage awareness)
3. Write test cases Week 1
4. Start testing Week 2 (against staging endpoints)
5. Run full E2E Week 4+

---

## ONE FINAL THING

**This is NOT a spec you can just hand to a junior and say "build it".**

These docs are **blueprints that need customization to your actual codebase.**

The compatibility review step is CRITICAL. It's the difference between:
- ✅ "We're 2 weeks in and realized our auth model doesn't match"
- ❌ "We built everything and now have to rewrite it"

**Invest 3 days in audit. Save 3 weeks of rework.**

---

## NEXT ACTION

```
TODAY:
1. Read this summary
2. Print EXECUTION_SPEC_COMPATIBILITY_REVIEW.md
3. Schedule 30-min team sync to discuss

TOMORROW:
1. Tech Lead: Start Day 1 audit (schema, RLS, auth)
2. Product: Start Day 2 audit (endpoints, PDF parsing)
3. All: Identify Decision Makers for Day 3

NEXT 3 DAYS:
1. Complete all audit checkboxes
2. Answer all 7 critical questions
3. Update corrected EXECUTION_SPEC_v1.1

WEEK 2:
1. Build with v1.1 specs
2. Daily standup on blockers
3. Weekly demo to confirm product direction
```

---

## CONTACT & QUESTIONS

- **Architecture questions:** See 01_ARCHITECTURE_LAYERS.md
- **Code examples:** See 03_BACKEND_IMPLEMENTATION.md, 04_FRONTEND_IMPLEMENTATION.md
- **Health/copy safety:** See 05_COPY_GUIDE_SAFE_CLAIMS.md
- **Analytics setup:** See 06_ANALYTICS_EVENT_MAP.md
- **Before you code:** See EXECUTION_SPEC_COMPATIBILITY_REVIEW.md

---

**🎯 Ready? Run the audit. Fix the issues. Then build.**

**Time estimate:** 3 days audit + corrections, 4-6 weeks build + launch.

**Go.** 🚀
