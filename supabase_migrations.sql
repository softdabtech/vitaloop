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

-- 4. SYMPTOMS
CREATE TABLE public.symptoms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  upload_id UUID REFERENCES public.lab_uploads(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  severity SMALLINT DEFAULT 5 CHECK (severity BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PROTOCOLS
CREATE TABLE public.protocols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  upload_id UUID REFERENCES public.lab_uploads(id) ON DELETE CASCADE NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_protocols_user_id ON public.protocols(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_uploads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biomarkers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptoms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocols     ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "Users: own row only"
  ON public.users FOR ALL USING (auth.uid() = id);

-- lab_uploads
CREATE POLICY "Lab uploads: own rows only"
  ON public.lab_uploads FOR ALL USING (auth.uid() = user_id);

-- biomarkers
CREATE POLICY "Biomarkers: own rows only"
  ON public.biomarkers FOR ALL USING (auth.uid() = user_id);

-- symptoms
CREATE POLICY "Symptoms: own rows only"
  ON public.symptoms FOR ALL USING (auth.uid() = user_id);

-- protocols
CREATE POLICY "Protocols: own rows only"
  ON public.protocols FOR ALL USING (auth.uid() = user_id);
