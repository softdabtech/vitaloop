-- VITALOOP Final Migration Bundle
-- Order:
-- 1) users subscription columns
-- 2) auth.users -> public.users sync trigger

BEGIN;

-- ============================================================
-- 1) USERS subscription fields
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- ============================================================
-- 2) AUTH -> PUBLIC user profile sync trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, sub_status, subscription_status)
  VALUES (NEW.id, NEW.email, 'free', 'free')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

COMMIT;
