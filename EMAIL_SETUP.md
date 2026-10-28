# Email Notification System Setup

## Overview
New users now receive a welcome email upon registration. The system uses Resend as the primary email service (with SendGrid as a fallback).

## Components

### Backend Changes
**File:** `backend/app/routers/identity/auth.py`
- **New Endpoint:** `POST /auth/registration/welcome`
  - Sends personalized welcome email to newly registered user
  - Includes user name and dashboard link
  - Only accessible by authenticated users
  - Returns: `{ "ok": true, "sent": true, "recipient": "user@email.com" }`

**Email Service:** `backend/app/services/email_service.py`
- **Function:** `send_welcome_email()`
  - Creates branded welcome email with premium styling
  - Parameters:
    - `to_email`: Recipient email address
    - `user_name`: User's display name
    - `organization_name`: Organization name (default: "VITALOOP")
    - `dashboard_url`: Link to user's dashboard
  - Returns: `True` if sent successfully, `False` if email service not configured

### Frontend Changes
**File:** `frontend/src/auth/registrationAlert.js`
- **New Function:** `sendWelcomeEmail()`
  - Calls backend `/auth/registration/welcome` endpoint
  - Requires active session with valid access token
  - Returns: `True` if email sent, `False` if failed

**File:** `frontend/src/pages/Login.jsx`
- **Updated:** Email signup flow (lines ~311)
  - Now calls `sendWelcomeEmail()` after successful registration
  - Occurs before navigation to onboarding page

## Environment Configuration

### Required Environment Variables
```bash
# Resend (primary email service)
RESEND_API_KEY=re_xxxxxxxx...        # Get from https://resend.com/api-keys
RESEND_FROM_EMAIL=onboarding@...     # Email address to send from

# Alternative: SendGrid
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=VITALOOP <noreply@vitaloop.today>

# Registration alerts
REGISTRATION_ALERT_EMAIL=info@vitaloop.today   # Admin receives registration notifications
```

### Setup Steps

#### 1. Resend Configuration (Recommended)
1. Create account at https://resend.com
2. Verify a sending domain (e.g., noreply@vitaloop.today)
3. Get API key from dashboard
4. Set environment variables:
   ```bash
   RESEND_API_KEY=re_your_api_key_here
   RESEND_FROM_EMAIL=onboarding@your-domain.com
   ```

#### 2. SendGrid Configuration (Alternative)
1. Create account at https://sendgrid.com
2. Create API key
3. Verify sender domain
4. Set environment variables:
   ```bash
   SENDGRID_API_KEY=your_api_key_here
   SENDGRID_FROM_EMAIL=VITALOOP <noreply@your-domain.com>
   ```

#### 3. Registration Alerts
- Admin alerts are sent to `REGISTRATION_ALERT_EMAIL`
- Triggered by: `POST /auth/registration/notify`
- Called automatically during email signup

## Email Flow

### User Registration (Email)
```
1. User fills signup form
2. Frontend calls signUpWithEmail()
3. Supabase creates account & session
4. Frontend calls notifyRegistrationAlert() → Admin alert email sent
5. Frontend calls sendWelcomeEmail() → User welcome email sent ✨
6. User navigated to onboarding
```

### Email Templates

#### Welcome Email
- Sent to: User's registered email
- Subject: "Welcome to VITALOOP"
- Content:
  - Personalized greeting with user name
  - Organization name
  - Quick tips for getting started
  - Call-to-action button to dashboard
  - Footer with support contact info

#### Registration Alert Email
- Sent to: Admin (`REGISTRATION_ALERT_EMAIL`)
- Subject: "New VITALOOP signup: {email}"
- Content:
  - User email, name, ID
  - Registration timestamp
  - Flow type (email_signup, google_oauth, etc.)
  - Link to ops dashboard

## Testing

### Local Testing
1. Ensure `.env` has valid Resend or SendGrid credentials
2. Register a new user account
3. Check email inbox for welcome email
4. Verify admin receives registration alert

### Troubleshooting

| Issue | Solution |
|-------|----------|
| No email received | Check RESEND_API_KEY and RESEND_FROM_EMAIL are set |
| "Email service not configured" | Verify at least one email provider (Resend or SendGrid) is configured |
| Email sent but bounced | Verify sender email domain is verified in Resend/SendGrid |
| Slow email delivery | Welcome email is sent async, may take 30-60 seconds |

## Related Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/registration/notify` | Send admin registration alert |
| `POST /auth/registration/welcome` | Send welcome email to user |
| `POST /auth/me` | Get current user (verifies auth) |

## Future Enhancements
- [ ] Welcome email templates customizable per organization
- [ ] Email preference management (users can opt-in/out)
- [ ] Analytics tracking (email opens, clicks)
- [ ] Automated onboarding email sequences
- [ ] Welcome email customization based on signup source (OAuth vs email)
- [ ] Multi-language email templates

## Notes
- Email is sent asynchronously (doesn't block signup flow)
- If email service fails, signup still succeeds (non-blocking)
- Email templates use premium styling consistent with landing page
- Sender email must be verified in email service to prevent bounces
