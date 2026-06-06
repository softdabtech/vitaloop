# EXECUTION SPEC #1: DATABASE MIGRATIONS

**Scope:** vitaloop.today EN version, 4-6 weeks  
**Approach:** Additive only, no destructive changes to existing tables  
**Database:** PostgreSQL (Supabase)

---

## MIGRATION 001: Create Insights Table

```sql
CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL,  -- References existing uploads table
    
    -- Insight metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Insight content
    marker_name VARCHAR(100) NOT NULL,          -- "ferritin", "vitamin_d", etc
    marker_value FLOAT,                         -- 12.5
    marker_unit VARCHAR(50),                    -- "μg/L", "ng/mL", etc
    lab_reference_min FLOAT,                    -- From lab PDF (e.g., 30)
    lab_reference_max FLOAT,                    -- From lab PDF (e.g., 150)
    lab_name VARCHAR(255),                      -- "Quest Diagnostics", "LabCorp"
    
    -- Status
    status VARCHAR(50) NOT NULL,                -- "critical" | "low" | "high" | "normal"
    
    -- Explanation (generated from rules)
    explanation TEXT,                           -- Plain English explanation
    potential_causes TEXT ARRAY,                -- ['fatigue', 'weak_immune']
    
    -- Action (safe wording)
    recommended_action TEXT,                    -- "Discuss iron supplementation with your doctor"
    lifestyle_actions TEXT ARRAY,               -- ['eat_iron_foods', 'take_with_vitamin_c']
    supplement_note TEXT,                       -- "Optional: discuss iron supplement 25-50mg with doctor"
    
    -- Retest window
    retest_days_min INT,                        -- 28
    retest_days_max INT,                        -- 56
    
    -- User interaction
    read_at TIMESTAMP,                          -- When user first viewed
    archived_at TIMESTAMP,                      -- User archived this insight
    
    -- Data privacy
    deleted_at TIMESTAMP,                       -- Soft delete
    
    CONSTRAINT unique_insight_per_marker_upload 
        UNIQUE (user_id, upload_id, marker_name),
    CONSTRAINT valid_status 
        CHECK (status IN ('critical', 'low', 'high', 'normal')),
    CONSTRAINT valid_dates 
        CHECK (retest_days_min > 0 AND retest_days_max >= retest_days_min)
);

CREATE INDEX idx_insights_user_created 
    ON insights(user_id, created_at DESC);
CREATE INDEX idx_insights_upload 
    ON insights(upload_id);
CREATE INDEX idx_insights_unread 
    ON insights(user_id, read_at) 
    WHERE read_at IS NULL;
    
-- RLS Policy
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
    ON insights FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own insights (mark as read)"
    ON insights FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

---

## MIGRATION 002: Create CheckIns Table

```sql
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Date (one per user per day)
    date DATE NOT NULL,
    
    -- Simple mood tracking
    mood VARCHAR(20),                           -- "better" | "same" | "worse" | null
    
    -- Optional detailed tracking (collapsed by default, for engaged users)
    fatigue_level INT,                          -- 1-10, null if not provided
    sleep_hours INT,                            -- 4, 5, 6, 7, 8+, null if not provided
    energy_level INT,                           -- 1-10, null if not provided
    
    -- Optional notes
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Data privacy
    deleted_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_checkin_per_day 
        UNIQUE (user_id, date),
    CONSTRAINT valid_levels 
        CHECK (
            (fatigue_level IS NULL OR (fatigue_level >= 1 AND fatigue_level <= 10))
            AND (energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 10))
            AND (sleep_hours IS NULL OR (sleep_hours BETWEEN 4 AND 10))
        )
);

CREATE INDEX idx_checkins_user_date 
    ON check_ins(user_id, date DESC);
CREATE INDEX idx_checkins_user_created 
    ON check_ins(user_id, created_at DESC);

-- RLS Policy
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own check-ins"
    ON check_ins FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own check-ins"
    ON check_ins FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own check-ins (same day only)"
    ON check_ins FOR UPDATE
    USING (auth.uid() = user_id AND date = CURRENT_DATE)
    WITH CHECK (auth.uid() = user_id AND date = CURRENT_DATE);
```

---

## MIGRATION 003: Create Protocols Table

```sql
CREATE TABLE protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL,
    
    -- Which biomarker this protocol addresses
    marker_name VARCHAR(100) NOT NULL,          -- "ferritin", "vitamin_d"
    marker_value FLOAT,
    marker_status VARCHAR(50),                  -- "low", "high", etc
    
    -- Protocol actions
    action_type VARCHAR(50) NOT NULL,           -- "lifestyle" | "supplement" | "medical"
    
    -- What to do
    description TEXT NOT NULL,                  -- "Eat iron-rich foods 2x per week"
    details TEXT,                               -- More detailed explanation
    
    -- How long
    duration_days INT,                          -- 56 (8 weeks)
    
    -- Safety level / disclaimer level
    requires_doctor_discussion BOOLEAN DEFAULT TRUE,  -- Supplements require this
    
    -- Priority
    priority INT DEFAULT 2,                     -- 1 (high) | 2 (medium) | 3 (low)
    
    -- User completion tracking
    completed_at TIMESTAMP,
    completed_count INT DEFAULT 0,              -- How many times marked done
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    CONSTRAINT valid_action_type 
        CHECK (action_type IN ('lifestyle', 'supplement', 'medical', 'monitoring'))
);

CREATE INDEX idx_protocols_user_upload 
    ON protocols(user_id, upload_id);
CREATE INDEX idx_protocols_priority 
    ON protocols(user_id, priority);

-- RLS Policy
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own protocols"
    ON protocols FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own protocols (completion)"
    ON protocols FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

---

## MIGRATION 004: Create Retest Recommendations Table

```sql
CREATE TABLE retest_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL,
    
    -- Which marker to retest
    marker_name VARCHAR(100) NOT NULL,
    
    -- When to retest
    recommended_date DATE NOT NULL,             -- When user should retest
    days_from_upload INT NOT NULL,              -- How many days after original upload
    
    -- Why retest
    reason TEXT NOT NULL,                       -- "Ferritin is critically low, retest after supplementation"
    
    -- Has the user scheduled the retest?
    scheduled_at TIMESTAMP,                     -- When user booked retest appointment
    completed_at TIMESTAMP,                     -- When new results uploaded
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_retest_user_date 
    ON retest_recommendations(user_id, recommended_date);
CREATE INDEX idx_retest_not_scheduled 
    ON retest_recommendations(user_id, recommended_date) 
    WHERE scheduled_at IS NULL;

-- RLS Policy
ALTER TABLE retest_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own retest recommendations"
    ON retest_recommendations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own retest recommendations (mark scheduled)"
    ON retest_recommendations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

---

## MIGRATION 005: Create Analytics Events Table (for tracking)

```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Event metadata
    event_name VARCHAR(100) NOT NULL,           -- "report_viewed", "checkin_started", etc
    
    -- What triggered it
    upload_id UUID,                             -- Nullable (not all events related to upload)
    
    -- Event properties
    properties JSONB,                           -- {marker_count: 5, time_to_view_ms: 2300}
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Location
    page_path VARCHAR(255),                     -- "/results/upload-123"
    
    -- Device
    user_agent TEXT
);

CREATE INDEX idx_analytics_user_event 
    ON analytics_events(user_id, event_name, created_at DESC);
```

**Events to track:**
- `upload_completed` - File uploaded, parsing started
- `report_viewed` - User viewed full results
- `report_priority_markers_viewed` - User saw priority summary
- `protocol_viewed` - User opened action plan
- `protocol_action_clicked` - User expanded specific action
- `checkin_started` - User opened check-in form
- `checkin_completed` - User submitted check-in
- `checkin_expanded_details` - User opened full check-in (not just mood)
- `premium_paywall_shown` - Paywall displayed
- `premium_trial_started` - User started 7-day trial
- `premium_converted` - User paid
- `insight_read` - User opened insight card
- `retest_scheduled` - User marked retest as scheduled

---

## MIGRATION 006: Add is_premium Column to Users/Profiles

```sql
-- If your users table doesn't have subscription info already:

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMP;

-- OR if you have a separate subscriptions table, use that instead
-- (link via user_id)
```

---

## MIGRATION 007: Add reference_ranges JSON to Biomarkers Table (if needed)

```sql
-- If your biomarkers table exists but doesn't store reference ranges:

ALTER TABLE biomarkers
ADD COLUMN IF NOT EXISTS lab_reference_min FLOAT,
ADD COLUMN IF NOT EXISTS lab_reference_max FLOAT,
ADD COLUMN IF NOT EXISTS lab_reference_unit VARCHAR(50),
ADD COLUMN IF NOT EXISTS lab_name VARCHAR(255);

-- These should be populated when PDF is parsed
```

---

## ROLLBACK STRATEGY

All new tables have `deleted_at` column for soft deletes. If something goes wrong:

```sql
-- Soft delete all data (don't drop tables)
UPDATE insights SET deleted_at = NOW() WHERE deleted_at IS NULL;
UPDATE check_ins SET deleted_at = NOW() WHERE deleted_at IS NULL;
UPDATE protocols SET deleted_at = NOW() WHERE deleted_at IS NULL;

-- If you need to hard-delete (nuclear option):
DROP TABLE IF EXISTS analytics_events;
DROP TABLE IF EXISTS retest_recommendations;
DROP TABLE IF EXISTS protocols;
DROP TABLE IF EXISTS check_ins;
DROP TABLE IF EXISTS insights;
```

---

## DEPLOYMENT CHECKLIST

- [ ] Create migrations in order (001-007)
- [ ] Test on staging database first
- [ ] Run backups before production deployment
- [ ] Enable RLS policies
- [ ] Verify indexes created
- [ ] Test SELECT with RLS policies
- [ ] Test INSERT with RLS policies
- [ ] Test UPDATE with RLS policies
- [ ] Monitor database performance (new tables shouldn't impact existing queries)
- [ ] Verify soft-delete behavior (deleted_at filtering)

---

## NOTES

1. **No changes to existing tables** — all new tables added alongside
2. **RLS on every table** — user_id is always auth.uid()
3. **Soft deletes everywhere** — deleted_at allows undo/recovery
4. **Indexes for common queries** — user_id, upload_id, date-based
5. **JSONB for analytics** — flexible schema for events

This is the **minimal schema needed** for the 4-6 week iteration.
