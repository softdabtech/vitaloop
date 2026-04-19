-- Fix CRM visibility: Create client records for all registered users
-- This script fills the gap between auth.users and clients table

BEGIN;

-- Step 1: Create client records for users without them
INSERT INTO public.clients (user_id, onboarding_status, created_at, updated_at)
SELECT 
  u.id,
  'started' as onboarding_status,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.clients c WHERE c.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Create free subscriptions for clients without subscriptions
INSERT INTO public.subscriptions (user_id, plan_name, status, started_at, created_at)
SELECT 
  c.user_id,
  'free' as plan_name,
  'active' as status,
  NOW() as started_at,
  NOW() as created_at
FROM public.clients c
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s 
  WHERE s.user_id = c.user_id AND s.status = 'active'
)
ON CONFLICT (user_id, plan_name, status) DO NOTHING;

-- Step 3: Verify trigger function exists and is working
CREATE OR REPLACE FUNCTION public.handle_new_client()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if client already exists (might be created by API)
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = NEW.id) THEN
    INSERT INTO public.clients (user_id, onboarding_status, created_at, updated_at)
    VALUES (NEW.id, 'started', NOW(), NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger to ensure it works
DROP TRIGGER IF EXISTS on_auth_user_created_create_client ON auth.users;
CREATE TRIGGER on_auth_user_created_create_client
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client();

-- Step 4: Log completion
DO $$ 
DECLARE
  v_clients_created INTEGER;
  v_subs_created INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_clients_created FROM public.clients;
  SELECT COUNT(*) INTO v_subs_created FROM public.subscriptions WHERE status = 'active';
  RAISE NOTICE 'CRM Fix Complete: % clients, % active subscriptions', 
    v_clients_created, v_subs_created;
END $$;

COMMIT;
