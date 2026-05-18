#!/bin/bash

# Script to apply emergency fixes via backend API
# Usage: ./apply-emergency-fixes.sh <jwt_token>

set -e

if [ -z "$1" ]; then
    echo "❌ Error: JWT token required"
    echo "Usage: $0 <jwt_token>"
    echo ""
    echo "Get JWT token:"
    echo "  1. Login to https://app.vitaloop.today"
    echo "  2. Open browser DevTools → Application → Cookies"
    echo "  3. Find 'auth_token' or check localStorage"
    exit 1
fi

JWT_TOKEN="$1"
API_URL="${API_URL:-http://localhost:8004}"

echo "🔧 VITALOOP Emergency Fixes"
echo "================================"
echo "API: $API_URL"
echo ""

# FIX 1: Check bombela1988@gmail.com status
echo "1️⃣  Checking bombela1988@gmail.com..."
curl -s -X GET \
  "$API_URL/emergency/check-user/bombela1988@gmail.com" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "2️⃣  Fixing super admin access..."
curl -s -X POST \
  "$API_URL/emergency/fix-super-admin/bombela1988@gmail.com" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "3️⃣  Checking a@a.com..."
curl -s -X GET \
  "$API_URL/emergency/check-user/a@a.com" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "4️⃣  Fixing subscription..."
curl -s -X POST \
  "$API_URL/emergency/fix-subscription/a@a.com?plan_name=premium" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "================================"
echo "✅ Emergency fixes applied!"
echo ""
echo "Next steps:"
echo "  1. For bombela1988@gmail.com: Visit Supabase dashboard"
echo "     - Auth → Users → bombela1988@gmail.com"
echo "     - Edit user → App metadata → Add \"is_super_admin\": true"
echo "  2. User a@a.com should now show Premium"
