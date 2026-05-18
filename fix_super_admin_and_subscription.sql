-- FIX 1: Add is_super_admin flag to bombela1988@gmail.com
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{is_super_admin}',
  'true'::jsonb
)
WHERE email = 'bombela1988@gmail.com';

-- FIX 2: Check current status of both users
SELECT 
  id,
  email,
  raw_app_meta_data->>'is_super_admin' as is_super_admin,
  raw_app_meta_data->>'global_role' as global_role
FROM auth.users
WHERE email IN ('bombela1988@gmail.com', 'a@a.com');

-- FIX 3: Check subscription status for a@a.com
SELECT 
  u.id,
  u.email,
  s.id as subscription_id,
  s.status,
  s.plan_name,
  s.cancel_at_period_end,
  s.current_period_end,
  a.global_role
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id
LEFT JOIN public.user_accounts a ON u.id = a.user_id
WHERE u.email = 'a@a.com';

-- FIX 4: If a@a.com subscription is "canceled" or "inactive", check if should be active
-- (This requires manual review based on payment status)
SELECT 
  u.email,
  s.status,
  s.cancel_at_period_end,
  s.current_period_end,
  NOW() as current_time,
  CASE 
    WHEN s.cancel_at_period_end = true AND s.current_period_end > NOW() THEN 'Still in grace period (premium active)'
    WHEN s.cancel_at_period_end = true AND s.current_period_end <= NOW() THEN 'Period ended, subscription is now inactive'
    WHEN s.status = 'canceled' THEN 'Subscription canceled'
    WHEN s.status = 'active' AND s.cancel_at_period_end = false THEN 'Premium active'
    ELSE s.status
  END as effective_status
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id
WHERE u.email = 'a@a.com';
