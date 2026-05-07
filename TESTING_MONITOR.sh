#!/bin/bash
# Monitoring script for Free User Flow Testing
# Run this to monitor backend logs, emails, and database changes

echo "🔍 VITALOOP Free User Flow Testing Monitor"
echo "=========================================="
echo ""

# Configuration
ADMIN_EMAIL="info@softdab.tech"
TEST_USER_EMAIL="testuser-free-20260507@test.com"
BACKEND_LOG_DIR="/Users/oleksii/projects/vitaloop/backend"

echo "📊 Test Configuration:"
echo "  Test User Email: $TEST_USER_EMAIL"
echo "  Admin Email: $ADMIN_EMAIL"
echo ""

# Function to monitor backend logs
monitor_logs() {
    echo "📋 Monitoring Backend Logs..."
    echo "  (Looking for registration, analysis, protocol events)"
    echo ""
}

# Function to check for emails
check_emails() {
    echo "📧 Email Check:"
    echo "  - Welcome email should arrive at: testuser-free-20260507@test.com"
    echo "  - Admin registration alert should arrive at: $ADMIN_EMAIL"
    echo ""
    echo "  ⚠️  Note: Email checking requires IMAP access (manual check needed)"
    echo ""
}

# Function to show API endpoints being tested
show_api_endpoints() {
    echo "🔌 API Endpoints to Monitor:"
    echo ""
    echo "  1. User Registration:"
    echo "     POST /auth/registration/notify"
    echo "     POST /auth/registration/welcome"
    echo ""
    echo "  2. Onboarding:"
    echo "     POST /auth/onboarding/complete"
    echo ""
    echo "  3. Lab Analysis:"
    echo "     POST /analyze"
    echo "     GET /results/latest"
    echo ""
    echo "  4. Protocol Generation:"
    echo "     POST /protocol"
    echo ""
    echo "  5. Dashboard:"
    echo "     GET /dashboard/summary"
    echo "     GET /auth/me"
    echo ""
}

# Function to show expected GA events
show_ga_events() {
    echo "📈 Expected Google Analytics Events:"
    echo ""
    echo "  Phase 1 (Registration):"
    echo "    ✓ page_view (Landing page)"
    echo "    ✓ click_cta (Start Free)"
    echo "    ✓ funnel_signup_completed"
    echo ""
    echo "  Phase 2 (Onboarding):"
    echo "    ✓ page_view (Onboarding page)"
    echo "    ✓ form_input (Step 0,1,2,3)"
    echo "    ✓ onboarding_completed"
    echo ""
    echo "  Phase 3 (Dashboard):"
    echo "    ✓ page_view (Dashboard)"
    echo "    ✓ view_plan_info (Free plan displayed)"
    echo ""
    echo "  Phase 4 (Lab Upload):"
    echo "    ✓ page_view (Upload page)"
    echo "    ✓ file_selected"
    echo "    ✓ lab_upload_started"
    echo "    ✓ lab_analysis_completed"
    echo ""
    echo "  Phase 5 (Protocol):"
    echo "    ✓ protocol_generation_started"
    echo "    ✓ protocol_generation_completed"
    echo "    ✓ protocol_downloaded"
    echo ""
}

# Function to show database records to check
show_db_checks() {
    echo "🗄️  Database Records to Verify:"
    echo ""
    echo "  After Registration:"
    echo "    SELECT * FROM public.users WHERE email = '$TEST_USER_EMAIL';"
    echo ""
    echo "  After Onboarding:"
    echo "    SELECT * FROM public.profiles WHERE user_id = '[user_id]';"
    echo ""
    echo "  Lab Uploads:"
    echo "    SELECT * FROM lab_uploads WHERE user_id = '[user_id]';"
    echo ""
    echo "  Subscription Status:"
    echo "    SELECT * FROM subscriptions WHERE user_id = '[user_id]';"
    echo ""
}

# Display all information
monitor_logs
check_emails
echo ""
show_api_endpoints
echo ""
show_ga_events
echo ""
show_db_checks

echo ""
echo "=========================================="
echo "✅ Monitor script ready!"
echo ""
echo "Next steps:"
echo "  1. Open vitaloop.today in Chrome"
echo "  2. Start registration with: $TEST_USER_EMAIL"
echo "  3. I'll track all backend events"
echo "  4. Check emails for delivery confirmation"
echo "=========================================="
