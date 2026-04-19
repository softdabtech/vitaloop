#!/usr/bin/env bash
# Manual CRM visibility fix - run this to sync all registered users to CRM

set -e

echo "=================================="
echo "CRM VISIBILITY AUTO-FIX"
echo "=================================="

# Get to the right directory
cd "$(dirname "$0")/.."

# Load environment
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set"
    exit 1
fi

echo "✅ Supabase credentials found"
echo ""

# Run Python diagnostic script
echo "[1/2] Running diagnostic..."
python3 scripts/diagnose_crm_users.py

# Ask for confirmation before applying fix
echo ""
echo "[2/2] Would you like to apply the fix? (y/n)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Applying fix via Supabase SQL..."
echo "⚠️  This will create client records for orphaned users"
echo ""

# Create a temporary SQL file from template
cat > /tmp/fix_crm_temp.sql << 'EOF'
BEGIN;

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

COMMIT;
EOF

# Use Python to execute via Supabase API
python3 << 'PYEOF'
import os
import sys
from supabase import create_client

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not supabase_url or not supabase_key:
    print("❌ Missing Supabase credentials")
    sys.exit(1)

client = create_client(supabase_url, supabase_key)

# Read the SQL file
with open('/tmp/fix_crm_temp.sql', 'r') as f:
    sql = f.read()

try:
    # Execute SQL
    result = client.rpc('exec_sql', {'sql': sql})
    print("✅ Fix applied successfully!")
except Exception as e:
    print(f"⚠️  RPC method not available. Use Supabase Dashboard instead.")
    print(f"Error: {e}")
    print("")
    print("Manual steps:")
    print("1. Go to https://app.supabase.com")
    print("2. Your Project → SQL Editor")
    print("3. Create new query and paste content from: backend/sql/fix_crm_visibility.sql")
    print("4. Run")
PYEOF

echo ""
echo "Run diagnostic again to verify:"
echo "  python3 scripts/diagnose_crm_users.py"
