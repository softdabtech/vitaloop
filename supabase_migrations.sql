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
