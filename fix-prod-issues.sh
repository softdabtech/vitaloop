#!/bin/bash
# Quick fix script for VITALOOP production issues
# Usage: ./fix-prod-issues.sh

set -e

echo "🚀 VITALOOP Production Fixes"
echo "============================"
echo ""

# We'll use the Supabase SQL API directly
SUPABASE_URL="https://bfjxkzydonhwmafnyktt.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmanhrenlkb25od21hZm55a3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjEyNDk3MjAsImV4cCI6MjAzNjgyOTcyMH0.0Pdy8O9IqDDnNpf6PiCWkgMtlV_nxDdj1R1LMNPnkUw"

echo "⚠️  This script requires Supabase credentials"
echo "❌ Direct client approach won't work with anon key"
echo ""
echo "✅ SOLUTION: Use Supabase Dashboard directly"
echo ""
echo "For bombela1988@gmail.com:"
echo "1. Go: https://app.supabase.com/project/bfjxkzydonhwmafnyktt/auth/users"
echo "2. Search: bombela1988@gmail.com"
echo "3. Edit → App metadata → Add: { \"is_super_admin\": true }"
echo "4. Save"
echo ""
echo "For a@a.com:"
echo "1. Go: https://app.supabase.com/project/bfjxkzydonhwmafnyktt/sql/new"
echo "2. Run SQL:"
echo ""
cat << 'EOF'
UPDATE public.subscriptions
SET 
  status = 'active',
  plan_name = 'premium',
  cancel_at_period_end = false,
  updated_at = NOW()
WHERE user_id = (
  SELECT id FROM public.users WHERE email = 'a@a.com'
)
ORDER BY updated_at DESC LIMIT 1;
EOF
echo ""
echo "3. Execute"
echo ""
echo "✅ Both users should be fixed!"
