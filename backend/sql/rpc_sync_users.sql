-- RPC function to sync orphaned users to CRM
-- Called by POST /crm/ops/sync-users endpoint

CREATE OR REPLACE FUNCTION public.sync_orphaned_users_to_crm()
RETURNS json AS $$
DECLARE
  v_orphaned_count int;
  v_total_users int;
  v_total_clients int;
BEGIN
  -- Count before
  SELECT COUNT(*) INTO v_total_users FROM auth.users;
  SELECT COUNT(*) INTO v_total_clients FROM public.clients;
  
  -- Sync orphaned users
  INSERT INTO public.clients (user_id, onboarding_status, created_at, updated_at)
  SELECT 
    u.id,
    'started',
    COALESCE(u.created_at, NOW()),
    NOW()
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = u.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Count orphaned after sync
  SELECT COUNT(*) INTO v_orphaned_count FROM auth.users au 
  WHERE NOT EXISTS (SELECT 1 FROM public.clients pc WHERE pc.user_id = au.id);

  RETURN json_build_object(
    'status', 'success',
    'total_users', v_total_users,
    'total_clients_before', v_total_clients,
    'total_clients_after', (SELECT COUNT(*) FROM public.clients),
    'orphaned_remaining', v_orphaned_count,
    'synced_count', (SELECT COUNT(*) FROM public.clients) - v_total_clients
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.sync_orphaned_users_to_crm() TO authenticated;
