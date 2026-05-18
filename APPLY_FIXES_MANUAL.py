#!/usr/bin/env python3
"""
Manual fix for VITALOOP bugs:
1. Set is_super_admin for bombela1988@gmail.com
2. Fix subscription for a@a.com

Note: Requires SUPABASE_SERVICE_ROLE_KEY to be set in environment.
Get this from: Supabase Dashboard → Settings → API → Service Role Secret
"""

import os
import sys

def main():
    print("""
╔════════════════════════════════════════════════════════════════════════╗
║          VITALOOP - Manual Bug Fix Instructions                        ║
╚════════════════════════════════════════════════════════════════════════╝

This script helps you apply the required database fixes. You need the
Supabase Service Role Key to proceed.

STEP 1: Get Service Role Key
═════════════════════════════════════════════════════════════════════════
1. Go to: https://app.supabase.com/project/bfjxkzydonhwmafnyktt/settings/api
2. Copy the "service_role secret" (NOT the anon key)
3. Paste it below when prompted

STEP 2: Apply Fixes
═════════════════════════════════════════════════════════════════════════

FIX #1: Super Admin Access (bombela1988@gmail.com)
───────────────────────────────────────────────
Go to Supabase Dashboard:
  1. Authentication → Users
  2. Search: bombela1988@gmail.com
  3. Click Edit user
  4. In "App metadata" JSON, add:
     { "is_super_admin": true }
  5. Save

Result: User can immediately access CRM

FIX #2: Subscription Status (a@a.com)
──────────────────────────────────────
Go to Supabase SQL Editor and run:

-- First, check current status:
SELECT 
  s.id, s.status, s.plan_name, s.cancel_at_period_end,
  s.current_period_end
FROM public.subscriptions s
LEFT JOIN auth.users u ON s.user_id = u.id
WHERE u.email = 'a@a.com'
ORDER BY s.updated_at DESC LIMIT 1;

-- If status is not 'active' or plan_name is 'free', run:
UPDATE public.subscriptions
SET 
  status = 'active',
  plan_name = 'premium',
  cancel_at_period_end = false,
  updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'a@a.com'
)
AND id = (
  SELECT id FROM public.subscriptions 
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'a@a.com')
  ORDER BY updated_at DESC LIMIT 1
);

STEP 3: Verify Fixes
═════════════════════════════════════════════════════════════════════════

For bombela1988@gmail.com:
  - Try accessing CRM at: https://crm.vitaloop.today
  - Should NOT redirect to login

For a@a.com:
  - GET /auth/me should return: "has_active_subscription": true
  - GET /billing/stripe/subscription should show: "is_premium": true

═════════════════════════════════════════════════════════════════════════

Notes:
  • Both fixes require Supabase admin access
  • Changes take effect immediately after save
  • No backend restart needed
  • JWT tokens are validated on next API call

Questions? Check: ./FIXES_DEPLOYMENT_2026-05-18.md

═════════════════════════════════════════════════════════════════════════
    """)

if __name__ == '__main__':
    main()
