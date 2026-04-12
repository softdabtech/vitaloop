-- ============================================================
-- VITALOOP — Supabase SQL Migrations
-- Execute in Supabase SQL Editor in this exact order
-- ============================================================

-- 1. USERS (extends auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  age SMALLINT CHECK (age > 0 AND age < 130),
  sex TEXT CHECK (sex IN ('male', 'female', 'other')),
  timezone TEXT DEFAULT 'America/New_York',
  sub_status TEXT DEFAULT 'free'
    CHECK (sub_status IN ('free', 'active', 'cancelled')),
  sub_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. LAB UPLOADS (stores OCR text, never PDFs)
CREATE TABLE public.lab_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  extracted_text TEXT NOT NULL,
  lab_name TEXT,
  test_date DATE,
  ocr_confidence NUMERIC(5,2),
  analyze_prompt_version TEXT NOT NULL DEFAULT 'extract_v1',
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_uploads_user_id ON public.lab_uploads(user_id);
CREATE INDEX idx_lab_uploads_created_at ON public.lab_uploads(created_at DESC);

-- 3. BIOMARKERS
CREATE TABLE public.biomarkers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID REFERENCES public.lab_uploads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  value NUMERIC(10,3) NOT NULL,
  unit TEXT NOT NULL,
  ref_low NUMERIC(10,3),
  ref_high NUMERIC(10,3),
  status TEXT NOT NULL
    CHECK (status IN ('OPTIMAL','BORDERLINE','DEFICIENT','ELEVATED')),
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_biomarkers_upload_id ON public.biomarkers(upload_id);
CREATE INDEX idx_biomarkers_user_name ON public.biomarkers(user_id, name);
CREATE UNIQUE INDEX uq_biomarkers_upload_name ON public.biomarkers(upload_id, lower(name));

-- 4. SYMPTOMS
CREATE TABLE public.symptoms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  upload_id UUID REFERENCES public.lab_uploads(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  severity SMALLINT DEFAULT 5 CHECK (severity BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_symptoms_user_id ON public.symptoms(user_id);
CREATE INDEX idx_symptoms_created_at ON public.symptoms(created_at DESC);
CREATE INDEX idx_symptoms_tags_gin ON public.symptoms USING GIN(tags);

-- Optional helper for dashboard aggregation by symptom tags in a time window
CREATE OR REPLACE FUNCTION public.get_symptom_tag_summary(p_user_id UUID, p_days INT DEFAULT 30)
RETURNS TABLE(tag TEXT, count BIGINT, avg_severity NUMERIC)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    unnest(tags) AS tag,
    COUNT(*)::BIGINT AS count,
    ROUND(AVG(severity)::NUMERIC, 2) AS avg_severity
  FROM public.symptoms
  WHERE user_id = p_user_id
    AND created_at >= (NOW() - make_interval(days => GREATEST(1, LEAST(p_days, 365))))
  GROUP BY tag
  ORDER BY count DESC, avg_severity DESC;
$$;

-- 5. PROTOCOLS
CREATE TABLE public.protocols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  upload_id UUID REFERENCES public.lab_uploads(id) ON DELETE CASCADE NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]',
  prompt_version TEXT NOT NULL DEFAULT 'protocol_v1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_protocols_user_id ON public.protocols(user_id);
CREATE INDEX idx_protocols_upload_id ON public.protocols(upload_id);
CREATE UNIQUE INDEX uq_protocols_user_upload ON public.protocols(user_id, upload_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_uploads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biomarkers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptoms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocols     ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "Users: select own"
  ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users: insert own"
  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users: update own"
  ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- lab_uploads
CREATE POLICY "Lab uploads: select own"
  ON public.lab_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Lab uploads: insert own"
  ON public.lab_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Lab uploads: update own"
  ON public.lab_uploads FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- biomarkers
CREATE POLICY "Biomarkers: select own"
  ON public.biomarkers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Biomarkers: insert own"
  ON public.biomarkers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Biomarkers: update own"
  ON public.biomarkers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- symptoms
CREATE POLICY "Symptoms: select own"
  ON public.symptoms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Symptoms: insert own"
  ON public.symptoms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Symptoms: update own"
  ON public.symptoms FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- protocols
CREATE POLICY "Protocols: select own"
  ON public.protocols FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Protocols: insert own"
  ON public.protocols FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Protocols: update own"
  ON public.protocols FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- PHASE 2 — P0 TABLES FOR LONGITUDINAL HEALTH MANAGEMENT
-- ============================================================

-- 6. USER PROFILE (extended baseline)
CREATE TABLE public.user_profile (
  id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,1),
  goals TEXT[] DEFAULT '{}',
  current_supplements TEXT[] DEFAULT '{}',
  current_medications TEXT[] DEFAULT '{}',
  prior_diagnoses TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "UserProfile: select own" ON public.user_profile FOR SELECT USING (auth.uid() = id);
CREATE POLICY "UserProfile: insert own" ON public.user_profile FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "UserProfile: update own" ON public.user_profile FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create user_profile on registration
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profile (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_profile
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 7. USER LOCATIONS
CREATE TABLE public.user_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  district TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_locations_user_id ON public.user_locations(user_id);
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "UserLocations: select own" ON public.user_locations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "UserLocations: insert own" ON public.user_locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "UserLocations: update own" ON public.user_locations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. RECURRING COMPLAINTS
CREATE TABLE public.recurring_complaints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  complaint TEXT NOT NULL,
  duration_description TEXT,
  tried_interventions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recurring_complaints_user_id ON public.recurring_complaints(user_id);
ALTER TABLE public.recurring_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Complaints: select own" ON public.recurring_complaints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Complaints: insert own" ON public.recurring_complaints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Complaints: delete own" ON public.recurring_complaints FOR DELETE USING (auth.uid() = user_id);

-- 9. WEEKLY CHECK-INS
CREATE TABLE public.checkins_weekly (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  energy_score SMALLINT CHECK (energy_score BETWEEN 1 AND 10),
  sleep_quality SMALLINT CHECK (sleep_quality BETWEEN 1 AND 10),
  mood_score SMALLINT CHECK (mood_score BETWEEN 1 AND 10),
  symptom_changes TEXT,
  protocol_adherence SMALLINT CHECK (protocol_adherence BETWEEN 1 AND 10),
  new_complaints TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checkins_weekly_user_id ON public.checkins_weekly(user_id);
CREATE UNIQUE INDEX uq_checkins_weekly_user_week ON public.checkins_weekly(user_id, week_start);
ALTER TABLE public.checkins_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Checkins: select own" ON public.checkins_weekly FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Checkins: insert own" ON public.checkins_weekly FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Checkins: update own" ON public.checkins_weekly FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. RED FLAG EVENTS
CREATE TABLE public.red_flag_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('biomarker', 'symptom_severity', 'checkin_response', 'complaint_escalation', 'manual')),
  severity TEXT DEFAULT 'high' CHECK (severity IN ('medium', 'high', 'critical')),
  summary TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_red_flag_events_user_id ON public.red_flag_events(user_id);
CREATE INDEX idx_red_flag_events_acknowledged ON public.red_flag_events(acknowledged);
ALTER TABLE public.red_flag_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RedFlags: select own" ON public.red_flag_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "RedFlags: update own" ON public.red_flag_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Admin bypass via service role (backend uses service key)

-- 11. INSIGHTS
CREATE TABLE public.insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  insight_type TEXT NOT NULL
    CHECK (insight_type IN ('symptom_trend', 'biomarker_trend', 'adherence', 'retest_suggestion', 'general')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority SMALLINT DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insights_user_id ON public.insights(user_id);
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insights: select own" ON public.insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insights: update own" ON public.insights FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 12. NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('weekly_checkin', 'retest_reminder', 'red_flag', 'insight', 'general')),
  channel TEXT DEFAULT 'email' CHECK (channel IN ('email', 'in_app')),
  subject TEXT,
  body TEXT,
  delivery_status TEXT DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed', 'opened', 'clicked')),
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  followup_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_delivery_status ON public.notifications(delivery_status);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notifications: select own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notifications: update own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 13. TIMELINE EVENTS
CREATE TABLE public.timeline_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'onboarding_completed','profile_updated','symptoms_logged','complaint_added',
      'lab_uploaded','biomarkers_extracted','protocol_generated','weekly_checkin_submitted',
      'adherence_updated','insight_created','red_flag_triggered',
      'notification_sent','integration_synced'
    )),
  summary TEXT NOT NULL,
  source TEXT,
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timeline_user_id ON public.timeline_events(user_id);
CREATE INDEX idx_timeline_occurred_at ON public.timeline_events(occurred_at DESC);
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Timeline: select own" ON public.timeline_events FOR SELECT USING (auth.uid() = user_id);

-- 14. HEALTH SCORES
CREATE TABLE public.health_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  symptom_component NUMERIC(5,2),
  biomarker_component NUMERIC(5,2),
  adherence_component NUMERIC(5,2),
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_scores_user_id ON public.health_scores(user_id);
ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HealthScores: select own" ON public.health_scores FOR SELECT USING (auth.uid() = user_id);
