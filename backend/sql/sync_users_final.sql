-- Final sync script for CRM user visibility
-- This script syncs all orphaned users from auth.users to public.clients table
-- and ensures the trigger for future signups is active

-- 1. Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_new_client()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = NEW.id) THEN
    INSERT INTO public.clients (user_id, onboarding_status, created_at, updated_at)
    VALUES (NEW.id, 'started', NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created_create_client ON auth.users;
CREATE TRIGGER on_auth_user_created_create_client
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client();

-- 3. Sync existing orphaned users (those without client records)
INSERT INTO public.clients (user_id, onboarding_status, created_at, updated_at)
SELECT 
  u.id,
  'started' as onboarding_status,
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Verify the sync
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM public.clients) as total_clients,
  (SELECT COUNT(*) FROM auth.users au 
   WHERE NOT EXISTS (SELECT 1 FROM public.clients pc WHERE pc.user_id = au.id)) as orphaned_remaining;
