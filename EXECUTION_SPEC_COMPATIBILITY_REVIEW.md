# EXECUTION SPEC v1.1: COMPATIBILITY REVIEW

**Status:** DRAFT - DO NOT IMPLEMENT YET  
**Purpose:** Verify current Vitaloop codebase against execution specs before coding starts  
**Owner:** Tech Lead + Product  
**Duration:** 2-3 days

---

## CRITICAL UNKNOWNS (Must Verify First)

### ❓ 1. Authentication & User Model

**Assumption in spec:**
```sql
CREATE TABLE insights (
    user_id UUID NOT NULL REFERENCES auth.users(id),
    ...
)
```

**Reality check needed:**
- [ ] Do we use Supabase Auth with UUID as primary key?
- [ ] OR do we have internal `users.id` (INT or UUID) separate from auth?
- [ ] What's the mapping between `auth.users(id)` and `public.users(id)`?
- [ ] RLS policies: do they use `auth.uid()` or something else?

**If using internal users table:**
```sql
-- WRONG in current spec:
user_id UUID REFERENCES auth.users(id)

-- CORRECT:
user_id UUID REFERENCES public.users(id),
auth_user_id UUID REFERENCES auth.users(id) -- If needed
```

**Action:** Check `app/database.py` or `database.ts` for current auth pattern.

---

### ❓ 2. Current Backend Routes & Structure

**Assumption in spec:**
```
POST   /api/uploads
GET    /api/uploads/:id
GET    /api/biomarkers/:upload_id
GET    /api/user/profile
POST   /api/stripe/subscribe
```

**Reality check needed:**
- [ ] What are actual backend routes? (`/analyze/pdf`? `/lab-results`? `/cabinet/upload`?)
- [ ] Is it FastAPI or something else?
- [ ] What's the project structure? (`app/routers/` or `src/routes/`?)
- [ ] Do endpoints exist or were they hypothetical?

**Action:** Run:
```bash
grep -r "def.*upload" app/routers/ --include="*.py"
grep -r "router.post\|@app.post" app/routers/ --include="*.py"
```

---

### ❓ 3. Biomarkers Storage & Schema

**Assumption in spec:**
```
biomarkers table has columns:
  id, upload_id, marker_name, marker_value, 
  lab_reference_min, lab_reference_max, ...
```

**Reality check needed:**
- [ ] Does `biomarkers` table exist? What columns does it have?
- [ ] Is lab reference range stored? Or inferred from marker name?
- [ ] How is PDF parsing currently storing extracted data?
- [ ] Can we add columns or need to create new mapping table?

**Action:** Check database schema:
```bash
# Supabase
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'biomarkers';

# Or check schema file
cat db/schema.sql | grep -A 20 "CREATE TABLE biomarkers"
```

---

### ❓ 4. Existing Reports/Results Storage

**Assumption in spec:**
```python
@router.get("/reports/{upload_id}")
async def get_report(...):
    report = db.query(Report)  # <-- Does this table exist?
```

**Reality check needed:**
- [ ] Is there a `reports` table? If yes, what columns?
- [ ] OR are reports generated on-the-fly from existing data?
- [ ] How is current results page rendering? (Cached or generated?)
- [ ] Do we need new `reports` table or store insights in `uploads` table?

**Action:** 
```bash
# Check if reports table exists
psql -c "SELECT * FROM information_schema.tables WHERE table_name = 'reports';"

# Check how results currently generated
grep -r "results" app/routers/ --include="*.py" | head -20
```

---

### ❓ 5. Supabase RLS Policies Current State

**Assumption in spec:**
```sql
CREATE POLICY "Users can view own insights"
    ON insights FOR SELECT
    USING (auth.uid() = user_id);
```

**Reality check needed:**
- [ ] Are RLS policies already enabled on existing tables?
- [ ] Do they use `auth.uid()` or different mechanism?
- [ ] Any tables that DON'T have RLS (oversight)?
- [ ] Do we need to update existing policies or just add new ones?

**Action:**
```bash
# Check RLS status
psql -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" | \
  while read table; do 
    psql -c "SELECT count(*) FROM pg_policies WHERE tablename = '$table';"
  done
```

---

### ❓ 6. Current User Profile/Subscription Schema

**Assumption in spec:**
```sql
ALTER TABLE profiles 
ADD COLUMN is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN subscription_status VARCHAR(50),
ADD COLUMN trial_started_at TIMESTAMP,
...
```

**Reality check needed:**
- [ ] Is there `public.profiles` or `public.users` table?
- [ ] Does it already have subscription columns?
- [ ] Where is Stripe subscription info currently stored?
- [ ] Can we add columns or need migration?

**Action:**
```bash
# Check current user/profile schema
psql -c "\d public.profiles"  # or public.users
```

---

### ❓ 7. PDF Parsing & Biomarker Extraction

**Assumption in spec:**
```
PDF → Parsing → Extract biomarkers → Store in DB → Ready for insights
```

**Reality check needed:**
- [ ] How does current system extract biomarkers from PDF?
- [ ] Does it use template matching, OCR, or manual?
- [ ] What format is extracted data? (List, JSON, database records?)
- [ ] Can we reuse existing parsing or does it need enhancement?
- [ ] Are lab reference ranges included in extraction?

**Action:**
```bash
grep -r "pdf\|parse\|extract" app/tasks/ --include="*.py" | head -20
```

---

## COMPATIBILITY CHECKLIST

Fill out BEFORE writing a single line of code:

### Auth & User Model
```
Current system uses:
☐ Supabase Auth (UUID) + internal users table
☐ Internal user IDs only (no Supabase Auth)
☐ Hybrid (Supabase Auth + own user mapping)
☐ Other: ________________

User ID type in biomarkers table:
☐ UUID (matches auth.users.id directly)
☐ INT (separate from auth)
☐ VARCHAR
☐ Other: ________________

RLS currently used?
☐ Yes (policies exist)
☐ No (all users can see all data)
☐ Partial (some tables protected)
```

### Database Schema
```
Tables that currently exist:
☐ users / profiles
☐ uploads
☐ biomarkers
☐ lab_results / results
☐ user_subscriptions / customers
☐ Other: ________________

Biomarkers table has columns:
☐ id, upload_id, marker_name, value, unit
☐ lab_reference_min, lab_reference_max
☐ lab_name
☐ status (critical/normal/etc)
☐ Other: ________________

Reference ranges stored where?
☐ In biomarkers table
☐ In separate markers_reference table
☐ Hardcoded in backend rules
☐ Fetched from external service
☐ Other: ________________
```

### Backend Structure
```
Framework:
☐ FastAPI (Python)
☐ Express (Node)
☐ Other: ________________

Route structure:
☐ app/routers/
☐ src/routes/
☐ Other: ________________

Current upload routes:
POST _________________ (where users upload PDFs)
GET __________________ (where we fetch results)
POST _________________ (where we trigger analysis)

Stripe integration:
☐ Already integrated
☐ Endpoints: ________________
☐ Not yet integrated
```

### Payments & Subscriptions
```
Stripe currently integrated?
☐ Yes - customer_id stored in: ____________
☐ Yes - subscription_id stored in: ____________
☐ No

Subscription status storage:
☐ In users/profiles table (column name: _________)
☐ In separate subscriptions table
☐ In Stripe only (not mirrored in DB)
☐ Not implemented yet

Free trial currently used?
☐ Yes (how: ________________)
☐ No
```

### PDF Processing
```
Current PDF parsing:
☐ Template-based matching
☐ OCR (Tesseract, etc)
☐ API integration (LabConnect, etc)
☐ Manual + structured upload
☐ Other: ________________

Biomarker extraction returns:
☐ List of {name, value, unit, reference}
☐ JSON: {biomarkers: [...]}
☐ Direct DB inserts
☐ Other: ________________

Lab reference ranges:
☐ Extracted from PDF
☐ Looked up from local database
☐ Hardcoded in code
☐ Other: ________________

Processing async?
☐ Yes - Celery / background task
☐ Yes - Cloud Functions / Lambda
☐ No - synchronous
☐ Other: ________________
```

---

## REQUIRED TECHNICAL DECISIONS

### 1. Reports Storage Model

**Option A: `reports` Table (Recommended for caching)**
```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY,
    upload_id UUID,
    user_id UUID,
    priority_markers JSONB,
    full_results JSONB,
    protocol JSONB,
    generated_at TIMESTAMP,
    ...
);

Pros:
+ Fast retrieval (cached)
+ Single source of truth for reports
+ Easy to track report history
- Additional table to maintain

Cons:
- Must sync with biomarkers changes
```

**Option B: Derived on-the-fly (No new table)**
```python
@router.get("/reports/{upload_id}")
def get_report(upload_id):
    biomarkers = db.query(Biomarker).filter(upload_id=upload_id)
    insights = db.query(Insight).filter(upload_id=upload_id)
    protocols = db.query(Protocol).filter(upload_id=upload_id)
    
    return {
        'priority_markers': [b for b in biomarkers if not b.in_range],
        'full_results': biomarkers,
        'protocol': protocols
    }

Pros:
+ No additional storage
+ Always up-to-date
- Slower (must query multiple tables)
- Logic lives in code, not DB
```

**Decision needed:** Which approach?

---

### 2. User ID Reference

**Option A: Single UUID (Supabase Auth direct)**
```sql
-- If we ONLY use auth.users.id
CREATE TABLE insights (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ...
);
```

**Option B: Internal users table + auth mapping**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id),
    ...
);

CREATE TABLE insights (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    ...
);
```

**Decision needed:** Which pattern do we use currently?

---

### 3. Trial Mechanics

**Option A: No-Card Trial (Lower conversion, higher signups)**
```python
# User gets promo code, code gives 7 days
# Day 7: Must add card to continue
# No auto-convert

Pros:
+ Lower friction
+ More trial signups
- Manual conversion required
```

**Option B: Card-Required Trial (Higher conversion, lower signups)**
```python
# User adds card for trial
# Day 7: Auto-convert with clear consent
# Easy to cancel

Pros:
+ Higher conversion rate
+ Simpler engineering
- More friction upfront
```

**Decision needed:** Which trial model?

---

### 4. Analytics PII Strategy

**Current spec (WRONG for GDPR):**
```python
track_event("priority_markers_viewed", {
    "marker_count": 4,
    "markers": ["ferritin", "vitamin_d", "magnesium"],  # ← PII!
    "marker_values": [12, 18, 1.8]  # ← PII!
})
```

**CORRECT (Privacy-safe):**
```python
track_event("priority_markers_viewed", {
    "marker_count": 4,  # OK
    "has_iron_low": True,  # OK
    "has_vitamin_low": True,  # OK
    "has_metabolic_abnormal": False,  # OK
    # NO specific values, NO specific markers
})
```

**Decision needed:** How do we categorize markers for analytics without exposing health data?

---

## IMMEDIATE ACTIONS (Next 2-3 Days)

### Day 1: Database Audit

```bash
# Check auth setup
psql << EOF
  SELECT column_name, data_type FROM information_schema.columns 
  WHERE table_name IN ('users', 'profiles', 'auth.users');
  
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  
  SELECT tablename FROM pg_tables WHERE schemaname = 'auth';
EOF

# Check RLS status
psql << EOF
  SELECT tablename, count(*) as policy_count FROM pg_policies 
  GROUP BY tablename ORDER BY policy_count DESC;
EOF

# Check what columns exist in biomarkers
psql << EOF
  \d public.biomarkers
EOF
```

**Document:** Create file `CURRENT_SCHEMA_AUDIT.md`

---

### Day 2: Endpoint Mapping

```bash
# Find all routes
grep -r "@router\|@app\." backend/ --include="*.py" | grep -E "post|get|put|patch" > CURRENT_ROUTES.txt

# Check Stripe integration
grep -r "stripe\|subscription\|premium" backend/ --include="*.py" > CURRENT_STRIPE.txt

# Check PDF processing
grep -r "pdf\|parse\|biomarker" backend/ --include="*.py" > CURRENT_PDF_PROCESSING.txt
```

**Document:** Create file `CURRENT_ROUTES_INVENTORY.md`

---

### Day 3: Decision Verification

1. **Auth model:** Which pattern?
   - Single Supabase UUID or
   - Internal users + auth mapping?

2. **Reports storage:** Table or derived?
   - Cached `reports` table or
   - On-the-fly from biomarkers + insights?

3. **Trial mechanics:** Which model?
   - No-card trial (lower conversion) or
   - Card-required trial (higher conversion)?

4. **Analytics privacy:** How to anonymize?
   - Marker categories instead of names?
   - Symptom flags instead of values?

5. **Biomarker reference ranges:** Where stored?
   - In DB or hardcoded?

---

## REVISED EXECUTION SPEC SECTIONS (After Audit)

### IF using internal users table:
```sql
-- NEW MIGRATION (adjust from spec)
CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- NOT auth.users!
    ...
);
```

### IF reports table doesn't exist:
```sql
-- NEW: Create reports table for caching
CREATE TABLE reports (
    id UUID PRIMARY KEY,
    upload_id UUID NOT NULL REFERENCES uploads(id),
    user_id UUID NOT NULL,
    generated_at TIMESTAMP,
    priority_markers JSONB,  -- cached version
    full_results JSONB,      -- cached version
    ...
);
```

### IF PDF processing doesn't extract reference ranges:
```python
# NEW: Add reference range lookup
REFERENCE_RANGES = {
    'ferritin': {'min': 30, 'max': 150, 'unit': 'μg/L'},
    'vitamin_d': {'min': 30, 'max': 100, 'unit': 'ng/mL'},
    ...
}

# During parsing
biomarker = {
    'name': 'ferritin',
    'value': 12,
    'reference': REFERENCE_RANGES['ferritin'],
    'status': 'critical' if 12 < 30 else 'normal'
}
```

---

## SAFETY FIXES NEEDED (Before v1.1 Final)

### Fix #1: Remove Specific Markers from Analytics

```python
# REMOVE from analytics:
- "markers": ["ferritin", "vitamin_d"]
- "marker_value": 12
- "marker_status": "critical"

# REPLACE with:
- "has_iron_markers": True
- "has_vitamin_markers": True
- "has_out_of_range": True
- "out_of_range_count": 4
```

### Fix #2: Soften Health Copy Doxologies

```
REMOVE:
- "critically low"
- "Typical dose: 25-50mg"
- "Supplementation is working"
- "Energy improves"

REPLACE:
- "below normal range"
- "Common range discussed: 25-50mg (ask your doctor)"
- "May help (based on reference ranges)"
- "May support energy (varies by person)"
```

### Fix #3: Trial Auto-Conversion Logic

```python
# If using no-card trial:
# - Day 0: Email with promo code
# - Day 6: Reminder email
# - Day 7: "Trial ends, add card to continue"
# - NO automatic conversion

# If using card trial:
# - Day 0: User adds card (auth)
# - Day 7: Auto-convert with email "Your subscription starts"
# - Easy cancel in settings

# Pick ONE model clearly
```

### Fix #4: Premium Value Addition

```
Current Free:
✓ Upload, see report, actions, download PDF
✓ 3 check-ins

TOO LEAN. Add to Premium:
✓ Full check-in history (30 days)
✓ Mood/energy trends (graphs)
✓ Retest reminders (email)
✓ Protocol templates library
✓ Export as CSV
✓ Compare multiple reports (if uploaded 2+)

This makes Premium more defensible ($9.99/mo).
```

---

## OUTPUT: REVISED v1.1 TIMELINE

**If all audits pass (auth, schema, endpoints are compatible):**
- Weeks 1-2: Implement with minor adjustments
- Weeks 3-6: Full rollout

**If conflicts found (e.g., internal users table, no RLS):**
- Week 1: Fix underlying issues
- Weeks 2-3: Implement execution spec with corrections
- Weeks 4-6: Rollout

**If major structural differences (e.g., no Supabase, Express instead FastAPI):**
- STOP
- Rewrite execution spec for actual stack
- Then proceed

---

## SIGN-OFF REQUIRED BEFORE IMPLEMENTATION

Before ANY engineer opens `/app/routers/new_endpoint.py`:

- [ ] Tech Lead: Confirms current schema matches assumptions
- [ ] Product: Confirms trial model choice
- [ ] Backend: Confirms endpoint compatibility
- [ ] DevOps/DBA: Confirms migration strategy
- [ ] Legal: Reviews final health copy

**Without these sign-offs, specs are still theoretical.**

---

## CONCLUSION

This v1.1 review is the **bridge between strategy and code**.

It answers:
- ✅ Does our technical vision fit the current system?
- ✅ What needs to change in execution specs?
- ✅ What technical decisions are blocking?
- ✅ Is v1.0 spec actionable or theoretical?

**After this review, v1.0 execution specs become v1.1 (implementable).**

**Without it, you're writing code based on guesses.** 🎯
