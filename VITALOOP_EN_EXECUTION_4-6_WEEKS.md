# VITALOOP.TODAY EN VERSION - EXECUTION GUIDE (4-6 WEEKS)

**Goal:** Transform `upload → results → leave` into `upload → results → action → checkin → premium`

**Timeline:** Weeks 0 (audit) + 1-6 (build)

**Success Metrics (Week 6):**
- 40%+ report viewers complete check-in
- 10%+ convert to premium within 30 days
- $2-3K MRR
- >50% 7-day retention

---

# 🔴 WEEK 0: PRE-IMPLEMENTATION AUDIT (DAYS 1-3)

**Status:** MUST COMPLETE BEFORE WEEK 1 CODING

## Day 1: Database & Auth Audit

### Questions to Answer

```
1. Auth Model
   ☐ Do we use Supabase Auth with UUID as primary key?
   ☐ OR internal users table (separate from auth)?
   ☐ Which RLS pattern: auth.uid() = user_id OR users.id = user_id?
   
2. Existing Tables
   ☐ users / profiles (what columns exist?)
   ☐ uploads (what columns?)
   ☐ biomarkers (what columns? lab_reference_min/max stored?)
   ☐ lab_results / results (does this exist?)
   ☐ subscriptions / customers (for Stripe integration?)
   
3. Biomarkers Storage
   ☐ Does biomarkers table have lab_reference_min, lab_reference_max?
   ☐ Where are reference ranges stored (DB or hardcoded)?
   ☐ Does PDF parsing extract them or need lookup table?
```

### Commands to Run

```bash
# Check tables
psql -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"

# Check auth structure
psql -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' OR table_name = 'profiles';"

# Check biomarkers schema
psql -c "\d public.biomarkers"

# Check RLS policies
psql -c "SELECT tablename, policyname FROM pg_policies ORDER BY tablename;"
```

### Output: Create File `AUDIT_01_SCHEMA.md`

```markdown
# Current Schema Audit

## Auth Model
[Your findings]

## Users/Profiles
[Column list from psql]

## Biomarkers
[Column list from psql]

## RLS Status
[Which tables have policies]
```

---

## Day 2: Backend Routes & PDF Processing Audit

### Questions to Answer

```
1. Backend Structure
   ☐ Is it FastAPI or Express or other?
   ☐ Route structure: app/routers/ or src/routes/?
   
2. Current Routes
   ☐ Where do users upload PDFs? (POST /xxx?)
   ☐ Where are results fetched? (GET /xxx?)
   ☐ Where is profile/subscription? (GET /xxx?)
   ☐ Where is Stripe integration? (POST /xxx/subscribe?)
   
3. PDF Processing
   ☐ How are biomarkers extracted? (Template? OCR? API?)
   ☐ Async (Celery/Cloud Functions) or synchronous?
   ☐ Are lab reference ranges extracted from PDF or looked up?
```

### Commands to Run

```bash
# Find upload routes
grep -r "def.*upload\|router.post.*upload" app/ --include="*.py"

# Find biomarker/result routes
grep -r "biomarker\|result\|lab" app/routers/ --include="*.py" | head -30

# Find Stripe routes
grep -r "stripe\|subscription\|payment" app/routers/ --include="*.py"

# Find PDF processing
grep -r "pdf\|parse\|extract" app/tasks/ --include="*.py"
```

### Output: Create File `AUDIT_02_ROUTES.md`

```markdown
# Current Backend Routes & Processing

## Existing Routes
- POST [path] — uploads
- GET [path] — fetch results
- POST [path] — Stripe subscription
- Other: [...]

## PDF Processing
[How biomarkers extracted]

## Async Tasks
[Celery/background job setup]
```

---

## Day 3: Technical Decisions

### Question 1: Reports Storage Model

**You must choose ONE:**

**Option A: Cache in `reports` table** (Recommended)
```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY,
    upload_id UUID,
    user_id UUID,
    priority_markers JSONB,  -- cached
    full_results JSONB,      -- cached
    protocol JSONB,          -- cached
    generated_at TIMESTAMP
);
```
✅ Fast retrieval
✅ Single source of truth
❌ Sync with biomarkers if changed

**Option B: Derive on-the-fly** (No new table)
```python
# Fetch biomarkers + insights + protocols
# Combine in endpoint response
# No reports table
```
✅ No extra storage
✅ Always up-to-date
❌ Slower (multiple queries)

**Decision: Choose A or B** → Document in `AUDIT_03_DECISIONS.md`

---

### Question 2: User ID Reference Pattern

**Choose ONE:**

**Option A: Direct Supabase UUID**
```sql
CREATE TABLE insights (
    user_id UUID NOT NULL REFERENCES auth.users(id)
);
```

**Option B: Internal users table mapping**
```sql
CREATE TABLE insights (
    user_id UUID NOT NULL REFERENCES public.users(id)
);
```

**Decision: A or B** → Document

---

### Question 3: Trial Mechanics

**Choose ONE:**

**Option A: No-Card Trial** (Lower friction, lower conversion)
```
Day 0: Email with promo code
Day 6: Reminder email
Day 7: "Your trial ends, add card to continue"
NO auto-convert
```

**Option B: Card-Required Trial** (Higher friction, higher conversion)
```
Day 0: User adds card
Day 7: Auto-convert, send confirmation email
Easy cancel in settings
```

**Decision: A or B** → Document

---

### Question 4: Analytics Privacy

**Biomarker tracking in analytics:**

❌ **WRONG:**
```python
track_event("priority_markers_viewed", {
    "markers": ["ferritin", "vitamin_d"],  # PII!
    "values": [12, 18]                      # PHI!
})
```

✅ **CORRECT:**
```python
track_event("priority_markers_viewed", {
    "priority_marker_count": 2,
    "has_iron_markers": True,
    "has_vitamin_markers": True,
    "out_of_range_count": 2
})
```

**Decision: How to anonymize markers?** → Document

---

### Output: Create File `AUDIT_03_DECISIONS.md`

```markdown
# Technical Decisions

## 1. Reports Storage
CHOSEN: [A or B]
REASON: [Why this choice]

## 2. User ID Reference
CHOSEN: [A or B]
AUTH MAPPING: [How it works]

## 3. Trial Model
CHOSEN: [A or B]
STRIPE SETUP: [Auto-convert? Manual?]

## 4. Analytics Privacy
APPROACH: [How we anonymize markers]
CATEGORIES: [Which marker groups we track]
```

---

## Before Week 1: Sign-Off Checklist

```
☐ Tech Lead: Reviewed schema audit, confirmed compatibility
☐ Backend: Mapped current routes, identified what exists vs new
☐ Product: Decided on trial model (A or B)
☐ All: Agreed on 3 technical decisions
☐ Legal: Reviewed health claims, approved safe copy
```

**IF ANY BOX UNCHECKED: DO NOT PROCEED TO WEEK 1**

---

# 📅 WEEK 1-2: DATABASE & BACKEND SETUP

## Database Migrations

### Migration 001: Insights Table

```sql
CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,  -- Based on Decision #2
    upload_id UUID NOT NULL,
    
    marker_name VARCHAR(100) NOT NULL,
    marker_value FLOAT,
    marker_unit VARCHAR(50),
    lab_reference_min FLOAT,
    lab_reference_max FLOAT,
    lab_name VARCHAR(255),
    
    status VARCHAR(50) NOT NULL,
    explanation TEXT,
    potential_causes TEXT ARRAY,
    recommended_action TEXT,
    lifestyle_actions TEXT ARRAY,
    supplement_note TEXT,
    
    retest_days_min INT,
    retest_days_max INT,
    
    read_at TIMESTAMP,
    archived_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    CONSTRAINT unique_insight_per_marker 
        UNIQUE (user_id, upload_id, marker_name),
    CONSTRAINT valid_status 
        CHECK (status IN ('critical', 'low', 'high', 'normal'))
);

CREATE INDEX idx_insights_user_created 
    ON insights(user_id, created_at DESC);
CREATE INDEX idx_insights_upload 
    ON insights(upload_id);

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
    ON insights FOR SELECT
    USING (auth.uid() = user_id);  -- Adjust based on Decision #2
```

**Test:**
```bash
psql -c "INSERT INTO insights (...) VALUES (...)"
psql -c "SELECT * FROM insights WHERE user_id = '...'"
```

---

### Migration 002: Check-Ins Table

```sql
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    
    mood VARCHAR(20),
    fatigue_level INT,
    sleep_hours INT,
    energy_level INT,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    CONSTRAINT unique_checkin_per_day 
        UNIQUE (user_id, date),
    CONSTRAINT valid_levels 
        CHECK (
            (fatigue_level IS NULL OR (fatigue_level >= 1 AND fatigue_level <= 10))
            AND (energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 10))
        )
);

CREATE INDEX idx_checkins_user_date 
    ON check_ins(user_id, date DESC);

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own check-ins"
    ON check_ins FOR ALL
    USING (auth.uid() = user_id);
```

---

### Migration 003: Protocols Table

```sql
CREATE TABLE protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    upload_id UUID NOT NULL,
    
    marker_name VARCHAR(100) NOT NULL,
    marker_value FLOAT,
    marker_status VARCHAR(50),
    
    action_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    details TEXT,
    duration_days INT,
    requires_doctor_discussion BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 2,
    
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    CONSTRAINT valid_action_type 
        CHECK (action_type IN ('lifestyle', 'supplement', 'medical', 'monitoring'))
);

CREATE INDEX idx_protocols_user_upload 
    ON protocols(user_id, upload_id);

ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own protocols"
    ON protocols FOR ALL
    USING (auth.uid() = user_id);
```

---

### Migration 004: Retest Recommendations

```sql
CREATE TABLE retest_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    upload_id UUID NOT NULL,
    
    marker_name VARCHAR(100) NOT NULL,
    recommended_date DATE NOT NULL,
    days_from_upload INT NOT NULL,
    reason TEXT NOT NULL,
    
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_retest_user_date 
    ON retest_recommendations(user_id, recommended_date);

ALTER TABLE retest_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own retest recommendations"
    ON retest_recommendations FOR ALL
    USING (auth.uid() = user_id);
```

---

### Migration 005: Analytics Events

```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    event_name VARCHAR(100) NOT NULL,
    upload_id UUID,
    properties JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    page_path VARCHAR(255),
    user_agent TEXT
);

CREATE INDEX idx_analytics_user_event 
    ON analytics_events(user_id, event_name, created_at DESC);

-- NO RLS on analytics_events (internal only, server-side tracking)
```

---

### Migration 006: Add Subscription Columns to Users

```sql
-- If using internal users table:
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Or if using profiles:
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
... (same columns)
```

---

### Migration 007: Reports Table (If Chosen Decision A)

```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID NOT NULL REFERENCES uploads(id),
    user_id UUID NOT NULL,
    
    priority_markers JSONB NOT NULL,
    full_results JSONB NOT NULL,
    protocol JSONB NOT NULL,
    
    generated_at TIMESTAMP DEFAULT NOW(),
    cached_until TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reports_upload 
    ON reports(upload_id);
CREATE INDEX idx_reports_user 
    ON reports(user_id, generated_at DESC);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
    ON reports FOR SELECT
    USING (auth.uid() = user_id);
```

---

## Deploy Migrations

```bash
# Week 1, Day 3-4

# Test on staging first
psql staging_db < migrations.sql

# Verify
psql staging_db -c "SELECT tablename FROM pg_tables WHERE tablename IN ('insights', 'check_ins', 'protocols', 'retest_recommendations', 'analytics_events');"

# Backup production
pg_dump production_db > backup_$(date +%Y%m%d).sql

# Deploy to production
psql production_db < migrations.sql

# Verify RLS
psql production_db -c "SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('insights', 'check_ins', 'protocols');"
```

---

## Backend Endpoints (Week 1-2)

All endpoints built in `app/routers/`:

### Endpoint 1: Generate Immediate Report

```python
# app/routers/reports.py

from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/api", tags=["reports"])

@router.post("/uploads/{upload_id}/generate-report")
async def generate_report(
    upload_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Generate immediate report with priority markers + protocol.
    Called after PDF parsing completes.
    """
    
    # Verify ownership
    upload = db.query(Upload).filter(
        Upload.id == upload_id,
        Upload.user_id == current_user.id
    ).first()
    
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    # Get biomarkers
    biomarkers = db.query(Biomarker).filter(
        Biomarker.upload_id == upload_id
    ).all()
    
    if not biomarkers:
        raise HTTPException(status_code=400, detail="No biomarkers extracted yet")
    
    # Generate report (use rules engine)
    report = generate_report_with_rules(biomarkers, upload)
    
    # Cache report if using Decision A (Reports table)
    if USING_REPORTS_TABLE:
        cached_report = Report(
            upload_id=upload_id,
            user_id=current_user.id,
            priority_markers=report['priority_markers'],
            full_results=report['full_results'],
            protocol=report['protocol'],
            generated_at=datetime.utcnow()
        )
        db.add(cached_report)
        db.commit()
    
    # Track analytics
    track_event(db, current_user.id, "report_generated", {
        "upload_id": upload_id,
        "marker_count": len(biomarkers),
        "priority_count": len(report['priority_markers'])
    })
    
    return report

def generate_report_with_rules(biomarkers, upload):
    """Rules engine for generating report from biomarkers"""
    
    priority_markers = []
    for bm in biomarkers:
        if bm.status in ['critical', 'low', 'high']:
            explanation = get_explanation(bm.marker_name)
            recommended_action = get_action(bm.marker_name, bm.status)
            
            priority_markers.append({
                'marker_name': bm.marker_name,
                'marker_value': bm.marker_value,
                'marker_unit': bm.marker_unit,
                'lab_reference_min': bm.lab_reference_min,
                'lab_reference_max': bm.lab_reference_max,
                'status': bm.status,
                'explanation': explanation,
                'recommended_action': recommended_action,
                'retest_days_min': get_retest_window(bm.marker_name)[0],
                'retest_days_max': get_retest_window(bm.marker_name)[1]
            })
    
    return {
        'priority_markers': priority_markers,
        'full_results': [bm.to_dict() for bm in biomarkers],
        'protocol': generate_protocols(biomarkers),
        'next_steps': "Track daily check-ins + schedule retest"
    }
```

**Test:**
```bash
curl -X POST http://localhost:8000/api/uploads/abc123/generate-report \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Endpoint 2: Get Report (Cached or Derived)

```python
@router.get("/reports/{upload_id}")
async def get_report(
    upload_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Fetch cached report or derive from biomarkers + insights"""
    
    if USING_REPORTS_TABLE:
        # Option A: Get cached report
        report = db.query(Report).filter(
            Report.upload_id == upload_id,
            Report.user_id == current_user.id
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return report.to_dict()
    
    else:
        # Option B: Derive on-the-fly
        biomarkers = db.query(Biomarker).filter(
            Biomarker.upload_id == upload_id
        ).all()
        
        insights = db.query(Insight).filter(
            Insight.upload_id == upload_id
        ).all()
        
        protocols = db.query(Protocol).filter(
            Protocol.upload_id == upload_id
        ).all()
        
        return {
            'priority_markers': [b for b in biomarkers if b.status != 'normal'],
            'full_results': [b.to_dict() for b in biomarkers],
            'insights': [i.to_dict() for i in insights],
            'protocols': [p.to_dict() for p in protocols]
        }
    
    # Track viewing
    track_event(db, current_user.id, "report_viewed", {
        "upload_id": upload_id
    })
```

---

### Endpoint 3-10: Other Endpoints

```python
# app/routers/checkins.py

@router.post("/check-ins")
async def create_checkin(
    data: CheckInData,  # mood, fatigue_level, sleep_hours, etc
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create daily check-in"""
    
    # Verify free tier limit (3 free check-ins)
    if not current_user.is_premium:
        checkin_count = db.query(CheckIn).filter(
            CheckIn.user_id == current_user.id
        ).count()
        
        if checkin_count >= 3:
            # Return 402 Payment Required
            raise HTTPException(
                status_code=402,
                detail="Free tier limited to 3 check-ins. Upgrade to Premium.",
                headers={"X-Paywall-Reason": "free_tier_limit"}
            )
    
    # Create check-in
    checkin = CheckIn(
        user_id=current_user.id,
        date=date.today(),
        mood=data.mood,
        fatigue_level=data.fatigue_level,
        sleep_hours=data.sleep_hours,
        energy_level=data.energy_level
    )
    
    db.add(checkin)
    db.commit()
    
    # Track event
    track_event(db, current_user.id, "checkin_completed", {
        "mood": data.mood,
        "had_details": data.fatigue_level is not None
    })
    
    return {
        "id": checkin.id,
        "status": "success",
        "free_checkins_remaining": max(0, 3 - (checkin_count + 1)) if not current_user.is_premium else None
    }

@router.get("/check-ins/history")
async def get_checkin_history(
    days: int = 30,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get check-in history (Premium feature only)"""
    
    if not current_user.is_premium:
        raise HTTPException(
            status_code=403,
            detail="Premium feature. Upgrade to see history."
        )
    
    start_date = date.today() - timedelta(days=days)
    
    checkins = db.query(CheckIn).filter(
        CheckIn.user_id == current_user.id,
        CheckIn.date >= start_date,
        CheckIn.deleted_at.is_(None)
    ).order_by(CheckIn.date.desc()).all()
    
    return {
        "checkins": [c.to_dict() for c in checkins],
        "summary": calculate_summary(checkins)
    }

# More endpoints:
# POST /insights (generate from rules)
# GET /insights (fetch for upload)
# GET /protocols
# GET /retest-recommendations
# PATCH /insights/:id (mark as read)
# POST /analytics/events (track events)
```

---

### Stripe Integration (Trial Logic)

```python
# app/routers/stripe.py

from stripe import stripe

STRIPE_API_KEY = os.getenv("STRIPE_API_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_PREMIUM")

if TRIAL_MODEL == "NO_CARD":
    # No-card trial: User gets 7-day code
    @router.post("/stripe/start-trial")
    async def start_trial(
        current_user = Depends(get_current_user),
        db = Depends(get_db)
    ):
        """Start 7-day free trial (no card required)"""
        
        # Update user
        current_user.is_premium = True
        current_user.trial_started_at = datetime.utcnow()
        current_user.trial_expires_at = datetime.utcnow() + timedelta(days=7)
        current_user.subscription_status = "trial"
        db.commit()
        
        return {"status": "trial_started", "days": 7}

elif TRIAL_MODEL == "CARD_REQUIRED":
    # Card trial: Stripe handles auto-convert
    @router.post("/stripe/create-subscription")
    async def create_subscription(
        current_user = Depends(get_current_user),
        db = Depends(get_db)
    ):
        """Create subscription with 7-day trial (card required)"""
        
        # Create Stripe customer
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(email=current_user.email)
            current_user.stripe_customer_id = customer.id
            db.commit()
        
        # Create subscription with trial
        subscription = stripe.Subscription.create(
            customer=current_user.stripe_customer_id,
            items=[{"price": STRIPE_PRICE_ID}],
            trial_period_days=7,
            trial_settings={
                "end_behavior": {
                    "missing_payment_method": "cancel"
                }
            }
        )
        
        current_user.stripe_subscription_id = subscription.id
        current_user.subscription_status = "trial"
        current_user.trial_started_at = datetime.utcnow()
        current_user.trial_expires_at = datetime.utcnow() + timedelta(days=7)
        db.commit()
        
        return {"status": "subscription_created", "subscription_id": subscription.id}

# Webhook for subscription events
@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, db = Depends(get_db)):
    """Handle Stripe events: payment_intent.succeeded, customer.subscription.updated, etc"""
    
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    if event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        user = db.query(User).filter(
            User.stripe_subscription_id == subscription.id
        ).first()
        
        if user:
            # Trial ended, auto-converted to paid
            if subscription.trial_end and subscription.trial_end < datetime.utcnow().timestamp():
                user.subscription_status = "active"
                user.is_premium = True
                user.subscription_starts_at = datetime.fromtimestamp(subscription.current_period_start)
                user.subscription_renews_at = datetime.fromtimestamp(subscription.current_period_end)
                db.commit()
                
                # Send email: subscription started
                send_email(user.email, "subscription_started")
    
    elif event["type"] == "customer.subscription.deleted":
        # User canceled subscription
        subscription = event["data"]["object"]
        user = db.query(User).filter(
            User.stripe_subscription_id == subscription.id
        ).first()
        
        if user:
            user.subscription_status = "canceled"
            user.is_premium = False
            db.commit()
    
    return {"status": "received"}
```

---

## Deploy Backend Week 1-2

```bash
# Day 1-2: Write migrations
# Day 3-4: Test on staging
# Day 5: Deploy to production
# Day 6-7: Deploy backend endpoints, test live

# Deploy checklist
☐ All migrations passed on staging
☐ All new tables have RLS policies
☐ Stripe webhook configured and tested
☐ Analytics tracking enabled
☐ Test full flow: upload → report → checkin → paywall
```

---

# 📱 WEEK 2-3: FRONTEND & UX

## Results Page Layout

### Desktop View (1025px+)

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Lab Results | Jun 2, 2026 | Share | Download       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ SECTION 1: PRIORITY SUMMARY (Hero)                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🚨 4 Markers Need Attention                            │ │
│ │                                                         │ │
│ │ [Card] Ferritin: 12 μg/L                               │ │
│ │ [Status Badge: CRITICAL] [Expand button]               │ │
│ │                                                         │ │
│ │ [Card] Vitamin D: 18 ng/mL                             │ │
│ │ [Status Badge: LOW] [Expand button]                    │ │
│ │                                                         │ │
│ │ [... 2 more cards ...]                                 │ │
│ │                                                         │ │
│ │ ✓ 15 other markers are normal                          │ │
│ │                                                         │ │
│ │ [BUTTON] Track Progress Daily                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ SECTION 2: ALL RESULTS (Expandable)                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ▼ All Results (19 markers)                             │ │
│ │ [Table with columns: Marker, Value, Ref Range, Status] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ SECTION 3: EXPLANATIONS (Each Expandable)                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ▼ Ferritin: 12 μg/L (LOW)                             │ │
│ │   ┌─────────────────────────────────────────────────┐  │ │
│ │   │ What it means:                                  │  │ │
│ │   │ Ferritin measures iron stored in your body.   │  │ │
│ │   │ Low levels may cause: fatigue, weak immune... │  │ │
│ │   │                                                │  │ │
│ │   │ Your value: 12 (lab's normal: 30-150)         │  │ │
│ │   │ Status: CRITICALLY LOW                        │  │ │
│ │   │                                                │  │ │
│ │   │ What to discuss with your doctor:             │  │ │
│ │   │ ☐ Iron supplementation (25-50mg daily)        │  │ │
│ │   │ ☐ Dietary sources (red meat, spinach)         │  │ │
│ │   │ ☐ Underlying causes                           │  │ │
│ │   │                                                │  │ │
│ │   │ ⚠️ This is educational. Your doctor diagnoses. │  │ │
│ │   └─────────────────────────────────────────────────┘  │ │
│ │                                                         │ │
│ │ ▼ Vitamin D: 18 ng/mL (LOW)                           │ │
│ │ [... similar expandable ...]                           │ │
│ │                                                         │ │
│ │ [+ 2 more markers ...]                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ SECTION 4: PERSONAL ACTION PLAN                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ▼ Your Action Plan                                     │ │
│ │                                                         │ │
│ │ FERRITIN (Priority: HIGH)                             │ │
│ │ ├─ Lifestyle:                                          │ │
│ │ │  ☐ Eat iron-rich foods 2-3x per week                │ │
│ │ │    (red meat, spinach, beans, fortified cereals)   │ │
│ │ │                                                       │ │
│ │ ├─ Supplements (discuss with doctor):                 │ │
│ │ │  ⚠️ Iron supplement: 25-50mg elemental iron         │ │
│ │ │     Take with vitamin C. Separate from tea/coffee  │ │
│ │ │                                                       │ │
│ │ ├─ Timeline:                                           │ │
│ │ │  Duration: 8 weeks                                  │ │
│ │ │  Next retest: August 1, 2026                        │ │
│ │ │                                                       │ │
│ │ ├─ Your doctor should:                                │ │
│ │ │  • Check for underlying causes                      │ │
│ │ │  • Monitor for side effects                         │ │
│ │ │  • Confirm supplementation plan                     │ │
│ │                                                         │ │
│ │ VITAMIN D (Priority: MEDIUM)                          │ │
│ │ [... similar structure ...]                            │ │
│ │                                                         │ │
│ │ MAGNESIUM (Priority: MEDIUM)                          │ │
│ │ [... similar structure ...]                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ SECTION 5: NEXT STEPS                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ▼ What To Do Next                                      │ │
│ │                                                         │ │
│ │ 1. Track Your Progress                                │ │
│ │    Log daily check-ins (5 seconds each)               │ │
│ │    [BUTTON] Start Check-In                            │ │
│ │                                                         │ │
│ │ 2. Schedule Your Retest                               │ │
│ │    Return August 1 to upload new results              │ │
│ │    We'll send reminder                                │ │
│ │                                                         │ │
│ │ 3. Work With Your Doctor                              │ │
│ │    Share this report and discuss action plan          │ │
│ │    [BUTTON] Download PDF Report                       │ │
│ │    [BUTTON] Share with Doctor                         │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Mobile View (320-640px)

```
Single column, sections stack vertically:

┌───────────────────────────┐
│ ← Results | Share         │
├───────────────────────────┤
│                            │
│ 🚨 4 Markers Need Care    │
│                            │
│ [Card - full width]        │
│ Ferritin: 12 (CRITICAL)   │
│ [Expand button]            │
│                            │
│ [Card]                     │
│ Vitamin D: 18 (LOW)       │
│                            │
│ [BUTTON - full width]      │
│ Track Progress            │
│                            │
│ ▼ All Results             │
│ [Expandable table]         │
│                            │
│ ▼ What It Means           │
│ [Expandable sections]     │
│                            │
│ ▼ Your Action Plan        │
│ [Expandable]              │
│                            │
│ ▼ Next Steps              │
│ [Expandable]              │
│                            │
└───────────────────────────┘
```

---

## React Components (Week 2-3)

### Component 1: PriorityMarkerCard

```jsx
// src/components/PriorityMarkerCard.jsx

export default function PriorityMarkerCard({ marker, onExpand }) {
  const statusColor = {
    'critical': 'bg-red-100 text-red-800',
    'low': 'bg-yellow-100 text-yellow-800',
    'high': 'bg-orange-100 text-orange-800',
    'normal': 'bg-green-100 text-green-800'
  }[marker.status]
  
  const statusLabel = marker.status.toUpperCase()
  
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-bold">{marker.marker_name}</h3>
        <span className={`${statusColor} px-3 py-1 rounded-full text-sm font-bold`}>
          {statusLabel}
        </span>
      </div>
      
      <div className="text-3xl font-bold text-gray-900 mb-2">
        {marker.marker_value}{' '}
        <span className="text-lg text-gray-500">{marker.marker_unit}</span>
      </div>
      
      <div className="text-sm text-gray-600 mb-4">
        Normal range: {marker.lab_reference_min}-{marker.lab_reference_max} {marker.marker_unit}
      </div>
      
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div 
          className={marker.status === 'critical' ? 'h-full bg-red-500' : 'h-full bg-yellow-500'}
          style={{width: `${Math.min(100, (marker.marker_value / marker.lab_reference_max) * 100)}%`}}
        ></div>
      </div>
      
      <p className="text-sm text-gray-700 mb-3">
        {marker.potential_causes?.join(', ')}
      </p>
      
      <button 
        onClick={() => onExpand(marker.marker_name)}
        className="text-teal-600 text-sm font-semibold hover:underline"
      >
        What this means →
      </button>
    </div>
  )
}
```

### Component 2: CheckInComponent

```jsx
// src/pages/Cabinet/CheckIn.jsx

import { useState } from 'react'
import { trackEvent } from '@/utils/analytics'

export default function CheckIn() {
  const [mood, setMood] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [fatigue, setFatigue] = useState(5)
  const [sleep, setSleep] = useState(null)
  const [energy, setEnergy] = useState(5)
  const [loading, setLoading] = useState(false)
  
  async function handleSubmit() {
    setLoading(true)
    
    try {
      trackEvent('checkin_started', { mood })
      
      const response = await fetch('/api/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          mood,
          fatigue_level: expanded ? fatigue : null,
          sleep_hours: expanded ? sleep : null,
          energy_level: expanded ? energy : null
        })
      })
      
      if (response.status === 402) {
        // Paywall triggered
        showPaywallModal()
        return
      }
      
      const data = await response.json()
      
      trackEvent('checkin_completed', {
        mood,
        had_details: expanded
      })
      
      // Show success message + pattern if available
      showToast('Check-in saved!')
      
      if (data.pattern) {
        showPatternCard(data.pattern)
      }
      
    } catch (error) {
      showToast('Error saving check-in', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">How are you feeling today?</h2>
      
      {/* Quick mood selection */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setMood('worse')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-lg transition ${
            mood === 'worse' 
              ? 'bg-red-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          😞 Worse
        </button>
        <button
          onClick={() => setMood('same')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-lg transition ${
            mood === 'same' 
              ? 'bg-yellow-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          😐 Same
        </button>
        <button
          onClick={() => setMood('better')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-lg transition ${
            mood === 'better' 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          😊 Better
        </button>
      </div>
      
      {/* Optional expanded details */}
      <details className="mb-6 cursor-pointer">
        <summary className="font-semibold text-gray-900 mb-3">
          Tell us more... (optional)
        </summary>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Fatigue: {fatigue}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={fatigue}
              onChange={(e) => setFatigue(Number(e.target.value))}
              className="w-full accent-teal-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Sleep last night
            </label>
            <select 
              value={sleep || ''} 
              onChange={(e) => setSleep(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select...</option>
              <option value="4">4 hours</option>
              <option value="5">5 hours</option>
              <option value="6">6 hours</option>
              <option value="7">7 hours</option>
              <option value="8">8+ hours</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Energy: {energy}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="w-full accent-teal-500"
            />
          </div>
        </div>
      </details>
      
      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!mood || loading}
        className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Check-In'}
      </button>
      
      <p className="text-sm text-gray-600 mt-4 text-center">
        Takes 15 seconds. Come back tomorrow to track progress.
      </p>
    </div>
  )
}
```

### Component 3: Paywall Modal

```jsx
// src/components/PaywallModal.jsx

export default function PaywallModal({ reason, onClose }) {
  const [loading, setLoading] = useState(false)
  
  async function handleStartTrial() {
    setLoading(true)
    
    try {
      const response = await fetch('/api/stripe/start-trial', {
        method: 'POST'
      })
      
      if (response.ok) {
        trackEvent('trial_started')
        showToast('Welcome to Premium! You have 7 days free.')
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
        
        <h2 className="text-2xl font-bold mb-4">
          {reason === 'free_tier_limit' ? 'Track Your Progress More Often' : 'See Your Trends'}
        </h2>
        
        <p className="text-gray-700 mb-6">
          {reason === 'free_tier_limit' 
            ? "You've used 3 free check-ins. Upgrade to Premium to track daily progress."
            : "Upgrade to Premium to see your 30-day mood and energy trends."
          }
        </p>
        
        <div className="bg-teal-50 rounded-lg p-4 mb-6">
          <h3 className="font-bold mb-2">With Premium:</h3>
          <ul className="text-sm space-y-1">
            <li>✓ Unlimited daily check-ins</li>
            <li>✓ See 30-day trends and patterns</li>
            <li>✓ Get retest reminders</li>
            <li>✓ Compare multiple reports</li>
          </ul>
        </div>
        
        <div className="mb-6">
          <div className="text-2xl font-bold">$9.99/month</div>
          <div className="text-sm text-gray-600">
            7-day free trial. Cancel anytime. No card required.
          </div>
        </div>
        
        <button
          onClick={handleStartTrial}
          disabled={loading}
          className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-700 mb-3 disabled:opacity-50"
        >
          {loading ? 'Starting trial...' : 'Start Free Trial'}
        </button>
        
        <button
          onClick={onClose}
          className="w-full bg-gray-100 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-200"
        >
          Maybe Later
        </button>
        
        <p className="text-xs text-gray-500 text-center mt-4">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
```

---

## Deploy Frontend Week 2-3

```bash
# Day 1-3: Build all components
# Day 4-5: Integration testing with backend
# Day 6: Performance optimization
# Day 7: Deploy to staging

# Checklist
☐ Results page loads < 2 seconds
☐ Check-in form saves without errors
☐ Paywall modal appears on 4th check-in
☐ All links work (Share, Download PDF)
☐ Mobile responsive on all viewports
☐ Analytics events firing correctly
```

---

# 💰 WEEK 3-4: PAYWALL & MONETIZATION

## Safe Copy Library

**RULE 1: Never diagnose**

❌ WRONG: "You have iron deficiency anemia"
✅ RIGHT: "Your ferritin is 12 (normal 30-150). This is low."

**RULE 2: Stick to lab reference ranges**

❌ WRONG: "Optimal ferritin is 75"
✅ RIGHT: "Lab reference range: 30-150. Your value is 12."

**RULE 3: Use soft language**

❌ WRONG: "This causes your fatigue"
✅ RIGHT: "Low ferritin may contribute to fatigue"

**RULE 4: Doctor involvement required**

❌ WRONG: "Take iron supplement 25mg daily"
✅ RIGHT: "Discuss iron supplementation (25-50mg range) with your doctor"

**RULE 5: Add disclaimers**

⚠️ Always end health claims with: "This is educational. Your doctor diagnoses and treats."

---

## Biomarker-Specific Copy

### FERRITIN (Iron Storage)

**Safe Explanation:**
```
Your ferritin: 12 μg/L
Lab reference: 30-150 μg/L
Status: Low

What ferritin does:
Ferritin measures iron stored in your body.
Iron is needed for energy, immunity, and hair health.

Why it matters:
Low ferritin may be related to:
• Fatigue and low energy
• Weak immune system
• Hair loss or thinning
• Difficulty concentrating

What might cause low ferritin:
• Not enough iron in diet
• Absorption problems (celiac, IBS, etc)
• Blood loss
• Pregnancy

What to discuss with your doctor:
✓ Iron supplementation (typical: 25-50mg daily)
✓ Iron-rich foods (red meat, spinach, beans, fortified cereals)
✓ Underlying causes (should be evaluated)
✓ Timeline for improvement (usually 6-8 weeks)

⚠️ Talk to your doctor before starting any supplement.
Iron supplements can interact with medications.
```

### VITAMIN D (Bone & Immune Health)

**Safe Explanation:**
```
Your vitamin D: 18 ng/mL
Lab reference: 30-100 ng/mL
Status: Low

What vitamin D does:
Vitamin D supports bone health, immunity, and mood.

Why it matters:
Low vitamin D may be related to:
• Mood changes
• Weak bones
• Immune challenges
• Seasonal pattern (winter months)

What might cause low vitamin D:
• Limited sun exposure
• Darker skin tone (requires more sun)
• Dietary intake (fatty fish, fortified milk)
• Absorption issues

What to discuss with your doctor:
✓ Sun exposure (15-30 min daily, no sunscreen)
✓ Vitamin D3 supplement (typical: 1000-2000 IU daily)
✓ Food sources (fatty fish, fortified milk, egg yolks)
✓ Retest timeline (8-12 weeks to assess response)

⚠️ Effects vary by person. Work with your doctor on dosage.
```

### MAGNESIUM (Muscle & Sleep Support)

**Safe Explanation:**
```
Your magnesium: 1.8 mmol/L
Lab reference: 2.2-2.6 mmol/L
Status: Low

What magnesium does:
Magnesium supports muscles, nerves, sleep, and blood pressure.

Why it matters:
Low magnesium may be related to:
• Muscle cramps or weakness
• Sleep disruption
• Headaches or tension
• Fatigue or restlessness

What might cause low magnesium:
• Diet low in leafy greens, nuts, seeds
• Stress (depletes magnesium)
• Digestive issues (poor absorption)
• Certain medications

What to discuss with your doctor:
✓ Magnesium supplement (typical: 200-400mg daily)
✓ Food sources (almonds, spinach, pumpkin seeds, whole grains)
✓ Best form (glycinate absorbs better than oxide)
✓ Timing (some take before bed to support sleep)

⚠️ High doses can cause digestive upset. Start low, increase gradually.
Talk to your doctor, especially if taking other medications.
```

### TSH (Thyroid Function)

**IF NORMAL:**
```
Your TSH: 2.1 mIU/L
Lab reference: 0.4-4.0 mIU/L
Status: Normal

Your thyroid is working well.

Continue monitoring:
• Routine retest in 1-2 years
• Sooner if you experience: unusual fatigue, weight changes, mood changes, cold intolerance

Questions? Discuss with your doctor.
```

**IF ABNORMAL (HIGH):**
```
Your TSH: 5.2 mIU/L
Lab reference: 0.4-4.0 mIU/L
Status: Elevated

⚠️ IMPORTANT: This requires medical evaluation.

Your doctor should:
✓ Check free T3 and free T4 levels
✓ Evaluate thyroid antibodies
✓ Consider thyroid ultrasound if indicated
✓ Discuss treatment options

DO NOT:
❌ Start iodine supplementation without testing
❌ Self-diagnose thyroid disease
❌ Start thyroid medication without doctor

This may indicate multiple conditions. Only your doctor can diagnose.

SCHEDULE AN APPOINTMENT WITH YOUR DOCTOR.
```

---

## Email Sequences

### Day 0: Welcome + First Insights

```
Subject: Your lab results are ready! 🔬

Hi [Name],

Your Vitaloop analysis is complete.

QUICK SUMMARY:
✓ 4 markers need attention (ferritin, vitamin D, magnesium, TSH)
✓ 15 markers are normal
✓ Personalized action plan ready

[BUTTON] View Your Results

What's next:
1. Review your results (5 min read)
2. See personalized actions (lifestyle + doctor discussion)
3. Start daily check-ins to track progress

Questions? Reply to this email.

Best,
Vitaloop Team
```

### Day 2: Deep Dive on Top Marker

```
Subject: Understanding your ferritin (low iron) 🔍

Hi [Name],

Your results show ferritin at 12 (normal: 30-150).

Here's what this means:
Ferritin measures iron stored in your body. Low levels may cause:
• Fatigue (most common symptom users report)
• Weak immune system
• Hair loss

Many people improve ferritin in 6-8 weeks with:
1. Iron-rich foods (red meat 2-3x per week)
2. Vitamin C (citrus, tomato sauce) with meals
3. Iron supplement (discuss with doctor: 25-50mg daily)

Next step: Start daily check-ins to track your energy level.
[BUTTON] Start Check-In

Talk to your doctor before starting any supplement.

Best,
Vitaloop
```

### Day 5: Lifestyle Tips

```
Subject: Quick win: Foods that support iron absorption 🥬

Hi [Name],

Iron from plant sources (spinach, beans) absorbs better when eaten with vitamin C.

Try this week:
• Red meat + orange juice
• Spinach salad + lemon dressing
• Beans + tomato sauce

This simple combo can help your body absorb iron better.

Still tracking your energy? [BUTTON] Check In Today

Best,
Vitaloop
```

### Day 6: Trial Reminder

```
Subject: Your trial expires tomorrow ⏰

Hi [Name],

Your 7-day Premium trial ends tomorrow!

You've checked in [X] times. That's great progress tracking.

Benefits you'll lose after tomorrow:
✓ Check-in history (30-day trends)
✓ Mood graphs and patterns
✓ Retest reminders
✓ Compare multiple reports

Want to continue?
[BUTTON] Continue Premium - $9.99/month
[BUTTON] Downgrade to Free

You can cancel anytime. No questions asked.

Best,
Vitaloop
```

### Day 8 (if not converted): Win-Back

```
Subject: We miss you 👋

Hi [Name],

Your Premium trial ended.

Your 3 free check-ins are still available.
But you've seen the value of daily tracking.

If you want to continue Premium:
[BUTTON] Resubscribe - $9.99/month

Or if price is a concern, let us know! 💙

Best,
Vitaloop
```

---

## Paywall Implementation (Week 3-4)

### Frontend: Paywall Modal Trigger

```jsx
// In check-in endpoint
if (response.status === 402) {
  const data = await response.json()
  
  // Show paywall
  <PaywallModal 
    reason={data.payload.reason}  // "free_tier_limit"
    trial_days={7}
    pricing={9.99}
    onClose={() => setShowPaywall(false)}
  />
}
```

### Backend: 402 Response Format

```python
# When user hits free tier limit
raise HTTPException(
    status_code=402,
    detail={
        "error": "payment_required",
        "reason": "free_tier_limit_exceeded",
        "free_checkins_allowed": 3,
        "free_checkins_used": 3,
        "trial_available": True,
        "trial_days": 7,
        "pricing": {
            "monthly": 9.99,
            "currency": "USD"
        }
    }
)
```

### Trial Mechanics (Choose A or B)

**Option A: No-Card Trial (No auto-convert)**

```python
# Day 0: Start trial
user.is_premium = True
user.trial_started_at = datetime.now()
user.trial_expires_at = datetime.now() + timedelta(days=7)

# Day 6: Email reminder
send_email("trial_expiring_soon")

# Day 7: Trial ends
user.is_premium = False
user.subscription_status = "free"

# User must manually add card to continue
# No automatic charge
```

**Option B: Card-Required Trial (Auto-convert)**

```python
# Day 0: Create Stripe subscription with trial
subscription = stripe.Subscription.create(
    customer=user.stripe_customer_id,
    items=[{"price": STRIPE_PRICE_ID}],
    trial_period_days=7
)

# Day 7: Stripe auto-converts
# Webhook receives: customer.subscription.updated
# Check if trial_end < now() → charge user

# User can cancel in settings anytime
```

---

# 📊 WEEK 4-5: ANALYTICS & TESTING

## Analytics Event Map

**Track entire user journey:**

```python
# Week 1: Upload
track_event(user_id, "upload_started", {})
track_event(user_id, "upload_completed", {
    "upload_id": "abc123",
    "biomarker_count": 19,
    "lab_name": "Quest Diagnostics"
})

# Week 2: Report
track_event(user_id, "report_viewed", {
    "upload_id": "abc123",
    "device": "mobile",
    "time_to_view_seconds": 180
})

track_event(user_id, "priority_markers_viewed", {
    "marker_count": 4,
    "priority_marker_count": 4,
    "has_iron_low": True
})

# Week 2-3: Engagement
track_event(user_id, "marker_details_opened", {
    "marker_name": "ferritin",  # ⚠️ Safe - not health data
    "marker_status": "critical"  # ⚠️ Remove this!
})

# Week 3: Check-in
track_event(user_id, "checkin_started", {})
track_event(user_id, "checkin_completed", {
    "checkin_number": 1,
    "mood": "better",
    "had_details": True,
    "time_to_complete_seconds": 45
})

# Week 3: Paywall
track_event(user_id, "paywall_shown", {
    "triggered_by": "free_tier_limit_exceeded",
    "free_checkins_used": 3
})

track_event(user_id, "trial_started", {
    "trial_days": 7,
    "from_paywall": True
})

# Week 3-4: Payment
track_event(user_id, "payment_attempted", {
    "amount": 9.99,
    "payment_method": "card"
})

track_event(user_id, "payment_succeeded", {
    "amount": 9.99,
    "subscription_id": "sub_123"
})
```

**Privacy-safe approach:**
```python
# ✅ Safe to track:
- marker_count (not which markers)
- has_iron_low (category, not value)
- mood (self-reported feeling)
- checkin_count (engagement metric)
- payment_amount (not user's medical data)

# ❌ DO NOT track:
- marker_name (e.g., "ferritin" is identifying health info)
- marker_value (e.g., "12" is PHI)
- marker_status (e.g., "critical" is medical assessment)
- explanation_text (contains health advice)
```

---

## Testing Checklist (Week 4-5)

### Functional Testing

```
☐ Upload PDF → Report generates within 60 seconds
☐ Report shows priority markers with explanations
☐ Action plan displays correctly formatted
☐ User can expand/collapse sections on mobile
☐ Check-in form saves without errors
☐ Free check-ins limited to 3, then paywall shows
☐ Paywall CTA button clicks correctly
☐ Trial starts and email sent
☐ Payment processing works
☐ Subscription status syncs correctly
☐ PDF download works
☐ Share with doctor button appears
```

### Integration Testing

```
☐ Upload triggers biomarker extraction
☐ Biomarkers populate insights table
☐ Insights appear in report within 60 sec
☐ Protocols generated correctly
☐ Check-in RLS allows only user to see their data
☐ Paywall correctly checks is_premium flag
☐ Stripe webhook updates subscription status
☐ Emails send on correct schedule
☐ Analytics events stored in database
```

### Performance Testing

```
☐ Report page loads < 2 seconds (desktop)
☐ Report page loads < 3 seconds (mobile)
☐ Check-in form responds < 500ms
☐ Payment modal appears instantly
☐ Database queries use indexes (no N+1)
☐ API endpoints return < 200ms
```

### Security Testing

```
☐ User A cannot see User B's data
☐ RLS policies enforce user_id filtering
☐ JWT token validation works
☐ Stripe API key not exposed in frontend
☐ No PHI/PII in analytics
☐ CORS properly configured
☐ SQL injection protected (parameterized queries)
```

### User Acceptance Testing (Week 5)

Test with 5-10 beta users:
```
☐ Can complete full journey in <15 minutes
☐ Understand value immediately (priority markers)
☐ Find check-in feature intuitively
☐ Convert to premium when prompted
☐ No confusing error messages
☐ Copy is clear (no medical jargon)
☐ Copy is safe (no diagnosis claims)
```

---

# 🚀 WEEK 6: LAUNCH PREPARATION

## Pre-Launch Checklist

### Product
```
☐ Copy approved by lawyer
☐ Paywall copy tested with users
☐ Email templates finalized
☐ Support docs written
☐ FAQ page created
☐ Refund policy published
☐ Terms of service updated
```

### Technical
```
☐ All endpoints tested
☐ Database backups automated
☐ Monitoring configured (Sentry, DataDog)
☐ Analytics dashboard live
☐ Performance benchmarks met
☐ Security audit passed
☐ Deployment plan documented
☐ Rollback procedure tested
```

### Team
```
☐ Support team trained
☐ Escalation process defined
☐ Monitoring on-call schedule
☐ Communication plan for outages
☐ Success metrics dashboards ready
☐ Daily sync scheduled Week 1
```

---

## Launch Day (Week 6, Day 5-6)

### Morning (Day 5)

```
8 AM:
☐ Final database backup
☐ Deploy to production (off-peak)
☐ Run smoke tests
☐ Check all endpoints responding
☐ Verify RLS policies active
☐ Test Stripe webhook

10 AM:
☐ Announce to team (internal)
☐ Soft launch (10% of users)
☐ Monitor error rates
☐ Check analytics data flowing
☐ Monitor Stripe transactions
```

### First Day (Day 6)

```
Morning:
☐ Monitor signup rate
☐ Monitor report generation
☐ Monitor check-in completion
☐ Monitor paywall conversion
☐ Check email deliverability
☐ Daily standup with team

Afternoon:
☐ Ramp to 50% of users if metrics healthy
☐ Monitor for any issues
☐ Respond to support tickets
☐ Track key metrics

Evening:
☐ Full rollout to 100% of users
☐ Continue monitoring
☐ Prepare for Week 1 ramp
```

---

## Success Metrics (Week 1-2)

Monitor daily:

```
Activation:
├─ Sign-up to upload: <2 days
├─ Upload to report view: <5 minutes
├─ Report view to check-in start: <30 minutes
└─ Check-in to paywall: 3 attempts

Engagement:
├─ Report view rate: 70%+ of uploads
├─ Check-in attempt rate: 40%+ of report viewers
├─ Check-in completion rate: >80%
└─ Paywall encounter rate: >80% of 3+ check-in users

Monetization:
├─ Trial start rate: >20% of paywall
├─ Trial to paid conversion: >30%
├─ Payment error rate: <1%
└─ Weekly MRR: $500+

Retention:
├─ 1-day return: 50%+
├─ 7-day return: 30%+
└─ 30-day return: 15%+
```

If any metric below target:
1. Investigate root cause (UX issue? Paywall wording? Feature missing?)
2. Adjust and re-test
3. Document learnings

---

## Post-Launch (Week 2+)

### Week 2
- Monitor metrics daily
- Respond to user feedback
- Fix any bugs
- Optimize copy/UX if needed
- Start planning next iteration

### Week 3-4
- Analyze cohort retention
- Calculate CAC and LTV
- Run A/B test on pricing ($9.99 vs $14.99?)
- Plan feature additions (compare reports, export, etc)

---

# 📋 FINAL CHECKLIST

**Before Week 1 coding:**
```
☐ AUDIT complete (Day 3 of Week 0)
☐ Technical decisions made (3 critical choices)
☐ All team members read EXECUTION_SPEC_01-06
☐ Design mockups approved
☐ Copy approved by lawyer
☐ Stripe account configured
☐ Email provider set up (SendGrid, etc)
☐ Analytics tool chosen (Mixpanel, PostHog, etc)
☐ Database backups automated
☐ Monitoring configured
☐ Support plan ready
```

**At end of each week:**
```
☐ Standup with full team (15 min)
☐ Demo of progress
☐ Blockers identified and unblocked
☐ Next week's priorities confirmed
☐ Metrics tracked and reviewed
```

**Week 6 (Launch):**
```
☐ All QA tests passing
☐ Performance benchmarks met
☐ Security audit passed
☐ Legal review approved
☐ Support team ready
☐ Rollback plan documented
☐ Monitoring alerting configured
☐ Go/no-go decision made
```

---

# 🎯 SUMMARY

**4-6 weeks to transform:**
```
Upload → Results → Leave
    ↓
Upload → Results → Action Plan → Check-in → Premium
```

**Key milestones:**
- Week 0: Audit & decisions
- Week 1-2: DB + Backend
- Week 2-3: Frontend + UX
- Week 3-4: Paywall + Copy
- Week 4-5: Analytics + Testing
- Week 6: Launch

**Success = 40% report viewers checkin + 10% convert to premium**

**Now: Start the audit on Week 0, Day 1.**

Good luck. 🚀
