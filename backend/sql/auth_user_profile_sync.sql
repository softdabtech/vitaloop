-- VITALOOP auth -> public.users profile sync
-- Goal: ensure every new auth.users row gets a matching public.users row
-- so foreign keys and profile lookups work for fresh signups.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'subscription_status'
  ) THEN
    INSERT INTO public.users (id, email, sub_status, subscription_status)
    VALUES (NEW.id, NEW.email, 'free', 'free')
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  ELSE
    INSERT INTO public.users (id, email, sub_status)
    VALUES (NEW.id, NEW.email, 'free')
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profile (id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_profile ON public.users;

CREATE TRIGGER on_user_created_profile
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

COMMIT;