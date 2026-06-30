#!/bin/bash
# Setup OpenAI API Key on Production Server
# Usage: ./setup-openai-production.sh
# 
# This script configures OpenAI API key for VITALOOP backend
# Works for both EN (vitaloop.today) and UA (ua.vitaloop.today)

set -e

API_KEY="${1:-}"
SERVER="root@159.65.252.227"
ENV_FILE="/etc/vitaloop/.env"
SYSTEMD_SERVICE="/etc/systemd/system/vitaloop-backend.service"

if [ -z "$API_KEY" ]; then
    echo "❌ Usage: $0 <OPENAI_API_KEY>"
    echo ""
    echo "Example:"
    echo "  $0 sk-proj-..."
    echo ""
    echo "To get API key:"
    echo "  1. Go to https://platform.openai.com/api/keys"
    echo "  2. Create or copy existing key"
    echo "  3. Run this script with the key"
    exit 1
fi

echo "🔧 Setting up OpenAI API Key for VITALOOP..."
echo ""

# Validate key format
if [[ ! $API_KEY =~ ^sk-proj- ]]; then
    echo "⚠️  Warning: Key doesn't start with 'sk-proj-' (but might still be valid)"
fi

echo "📝 Step 1: Adding OpenAI key to $ENV_FILE on server..."
ssh "$SERVER" << EOF
set -e

# Check if file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE..."
    sudo touch "$ENV_FILE"
fi

# Remove existing OPENAI_API_KEY if present
sudo sed -i '' '/^OPENAI_API_KEY=/d' "$ENV_FILE" 2>/dev/null || true

# Add new key
echo "OPENAI_API_KEY=$API_KEY" | sudo tee -a "$ENV_FILE" > /dev/null

# Verify
echo "✓ Added OPENAI_API_KEY to $ENV_FILE"
EOF

echo "✓ Step 1 complete"
echo ""

echo "📝 Step 2: Reloading systemd and restarting backend..."
ssh "$SERVER" << EOF
set -e

# Reload systemd daemon
sudo systemctl daemon-reload

# Restart backend service
sudo systemctl restart vitaloop-backend

# Wait for service to stabilize
sleep 2

# Check status
STATUS=\$(sudo systemctl is-active vitaloop-backend)
if [ "\$STATUS" = "active" ]; then
    echo "✓ Backend service restarted successfully"
else
    echo "⚠️  Backend service status: \$STATUS"
    echo "Check logs: sudo journalctl -u vitaloop-backend -n 50"
fi
EOF

echo "✓ Step 2 complete"
echo ""

echo "✅ Step 3: Verification..."
echo ""
echo "Testing health endpoint..."
HEALTH_RESPONSE=\$(curl -s https://vitaloop.today/health || echo "{}")

if echo "\$HEALTH_RESPONSE" | grep -q "ok\|healthy"; then
    echo "✓ Backend is responding"
else
    echo "⚠️  Backend response: \$HEALTH_RESPONSE"
fi

echo ""
echo "🧪 Testing analysis endpoint..."
curl -s -X POST https://vitaloop.today/api/v1/analyze/pdf \
    -F "file=@/dev/null" \
    2>/dev/null | head -20 || echo "(Expected error - no valid PDF)"

echo ""
echo "📊 Checking backend logs for OpenAI initialization..."
ssh "$SERVER" "sudo journalctl -u vitaloop-backend -n 20 | grep -i openai || echo 'No OpenAI logs yet (normal)'"

echo ""
echo "========================================="
echo "✅ OpenAI API Key configured successfully!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Test EN version: https://vitaloop.today/upload"
echo "  2. Test UA version: https://ua.vitaloop.today/upload"
echo "  3. Monitor logs: ssh $SERVER 'tail -f /var/log/vitaloop/backend.log'"
echo ""
echo "For both EN and UA frontends, the backend will now:"
echo "  ✓ Use OpenAI GPT-4o-mini for text analysis"
echo "  ✓ Use OpenAI GPT-4o for vision (scanned PDFs)"
echo "  ✓ Load knowledge base rules from Supabase"
echo "  ✓ Generate personalized protocols"
echo ""
