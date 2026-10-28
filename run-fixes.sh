#!/bin/bash

# VITALOOP FIXES: Super Admin Access + Subscription Debug
# Run this script to diagnose and fix CRM access and subscription issues

set -e

echo "🔧 VITALOOP - Super Admin & Subscription Fixes"
echo "================================================"
echo ""

# Функция для выполнения SQL через supabase-cli
run_sql() {
    local sql="$1"
    echo "📝 Executing SQL..."
    echo "$sql" | npx supabase sql --local
}

# FIX 1: Проверка текущего статуса bombela1988@gmail.com
echo "1️⃣  Checking super admin status for bombela1988@gmail.com..."
cat > /tmp/check_super_admin.sql << 'EOF'
SELECT 
  id,
  email,
  raw_app_meta_data->>'is_super_admin' as is_super_admin,
  raw_app_meta_data->>'global_role' as global_role,
  created_at
FROM auth.users
WHERE email = 'bombela1988@gmail.com';
EOF
echo "Query saved to /tmp/check_super_admin.sql"
echo ""

# FIX 2: Добавить флаг super_admin
echo "2️⃣  Setting is_super_admin flag for bombela1988@gmail.com..."
cat > /tmp/set_super_admin.sql << 'EOF'
-- Set is_super_admin for bombela1988@gmail.com
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{is_super_admin}',
  'true'::jsonb
)
WHERE email = 'bombela1988@gmail.com'
RETURNING id, email, raw_app_meta_data->>'is_super_admin' as is_super_admin;
EOF
echo "Query saved to /tmp/set_super_admin.sql"
echo ""

# FIX 3: Проверка subscription для a@a.com
echo "3️⃣  Checking subscription status for a@a.com..."
cat > /tmp/check_subscription.sql << 'EOF'
SELECT 
  u.id,
  u.email,
  s.id as subscription_id,
  s.status,
  s.plan_name,
  s.cancel_at_period_end,
  s.current_period_end,
  s.stripe_status,
  s.updated_at,
  ua.global_role
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id
LEFT JOIN public.users ua ON u.id = ua.id
WHERE u.email = 'a@a.com'
ORDER BY s.updated_at DESC;
EOF
echo "Query saved to /tmp/check_subscription.sql"
echo ""

# FIX 4: Если нужно исправить subscription
cat > /tmp/fix_subscription.sql << 'EOF'
-- If subscription needs to be reset to premium:
-- UPDATE public.subscriptions
-- SET status = 'active',
--     plan_name = 'premium',
--     cancel_at_period_end = false,
--     updated_at = NOW()
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'a@a.com')
-- AND status != 'active';

-- View current state without modification
SELECT 
  'ANALYSIS FOR a@a.com' as title,
  u.email,
  s.status as subscription_status,
  s.plan_name,
  s.cancel_at_period_end,
  CASE 
    WHEN s.status = 'active' AND NOT s.cancel_at_period_end THEN 'Premium active ✅'
    WHEN s.status = 'active' AND s.cancel_at_period_end THEN 'Premium but canceled - in grace period'
    WHEN s.status IN ('cancelled', 'past_due') THEN 'Not premium ❌'
    ELSE 'Unknown status'
  END as effective_status
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id
WHERE u.email = 'a@a.com';
EOF
echo "Query saved to /tmp/fix_subscription.sql"
echo ""

echo "✅ SQL scripts ready at /tmp/"
echo ""
echo "Next steps:"
echo "1. View /tmp/check_super_admin.sql output to see current status"
echo "2. Run /tmp/set_super_admin.sql to fix super admin access"
echo "3. View /tmp/check_subscription.sql output to see a@a.com subscription"
echo "4. If needed, modify /tmp/fix_subscription.sql and run it"
echo ""
echo "To execute these in Supabase:"
echo "- Option A: Copy/paste SQL into Supabase SQL Editor"
echo "- Option B: Use supabase-cli: supabase sql < /tmp/set_super_admin.sql"
