from __future__ import annotations

from datetime import datetime
from html import escape
from typing import Optional

import httpx

from app.config import settings


RESEND_ENDPOINT = "https://api.resend.com/emails"
SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send"


def _is_resend_configured() -> bool:
    return bool(settings.resend_api_key and settings.resend_from_email)


def _is_sendgrid_configured() -> bool:
    return bool(settings.sendgrid_api_key and settings.sendgrid_from_email)


def _is_email_configured() -> bool:
    return _is_resend_configured() or _is_sendgrid_configured()


def _safe(value: Optional[str]) -> str:
    return escape(value or "")


async def _deliver_html_email(*, to_email: str, subject: str, html: str) -> bool:
  if not _is_email_configured():
    return False

  try:
    async with httpx.AsyncClient(timeout=12.0) as client:
      if _is_resend_configured():
        resend_payload = {
          "from": settings.resend_from_email,
          "to": [to_email],
          "subject": subject,
          "html": html,
        }
        resend_headers = {
          "Authorization": f"Bearer {settings.resend_api_key}",
          "Content-Type": "application/json",
        }
        resp = await client.post(RESEND_ENDPOINT, headers=resend_headers, json=resend_payload)
        return 200 <= resp.status_code < 300

      if _is_sendgrid_configured():
        sendgrid_payload = {
          "personalizations": [
            {
              "to": [{"email": to_email}],
              "subject": subject,
            }
          ],
          "from": {"email": settings.sendgrid_from_email},
          "content": [
            {"type": "text/html", "value": html},
          ],
        }
        sendgrid_headers = {
          "Authorization": f"Bearer {settings.sendgrid_api_key}",
          "Content-Type": "application/json",
        }
        resp = await client.post(SENDGRID_ENDPOINT, headers=sendgrid_headers, json=sendgrid_payload)
        return 200 <= resp.status_code < 300

      return False
  except Exception:
    return False


async def send_invitation_email(
    *,
    to_email: str,
    organization_name: str,
    role: str,
    inviter_name: str,
    invitation_url: str,
    expires_at_iso: Optional[str] = None,
) -> bool:
    """Send a styled invitation email via Resend (fallback: SendGrid).

    Returns True on successful provider acceptance, False when email provider
    is not configured or request failed.
    """

    expires_human = ""
    if expires_at_iso:
        try:
            expires_human = datetime.fromisoformat(expires_at_iso.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M UTC")
        except Exception:
            expires_human = expires_at_iso

    safe_org = _safe(organization_name)
    safe_role = _safe(role)
    safe_inviter = _safe(inviter_name)
    safe_url = _safe(invitation_url)

    html = f"""
<!doctype html>
<html lang=\"en\">
  <body style=\"margin:0;padding:0;background:#f4f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;\">
    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"padding:24px 12px;\">
      <tr>
        <td align=\"center\">
          <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;\">
            <tr>
              <td style=\"background:linear-gradient(135deg,#0b4033,#1d9e75);padding:28px 28px 24px;color:#ffffff;\">
                <div style=\"font-size:12px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;opacity:.85;\">VITALOOP Team Invitation</div>
                <h1 style=\"margin:10px 0 0;font-size:26px;line-height:1.2;\">You're invited to join {safe_org}</h1>
              </td>
            </tr>
            <tr>
              <td style=\"padding:28px;\">
                <p style=\"margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;\">
                  {safe_inviter} invited you to join the <strong>{safe_org}</strong> workspace on VITALOOP.
                </p>
                <p style=\"margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;\">
                  Assigned role: <strong>{safe_role}</strong>
                </p>
                <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:22px 0;\">
                  <tr>
                    <td>
                      <a href=\"{safe_url}\" style=\"display:inline-block;padding:13px 22px;border-radius:999px;background:#1d9e75;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;\">Accept Invitation</a>
                    </td>
                  </tr>
                </table>
                <p style=\"margin:0 0 12px;font-size:13px;color:#64748b;line-height:1.6;\">
                  If the button does not work, copy and paste this URL into your browser:
                </p>
                <p style=\"margin:0 0 12px;font-size:13px;color:#0f172a;line-height:1.6;word-break:break-all;\">{safe_url}</p>
                <p style=\"margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.6;\">
                  {('Invitation expires: ' + _safe(expires_human)) if expires_human else ''}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()

    return await _deliver_html_email(
        to_email=to_email,
        subject=f"Invitation to join {organization_name} on VITALOOP",
        html=html,
    )


async def send_invitation_accepted_email(
    *,
    to_email: str,
    organization_name: str,
    accepted_user_name: str,
) -> bool:
    """Notify inviter that the invitation has been accepted."""

    safe_org = _safe(organization_name)
    safe_name = _safe(accepted_user_name)

    html = f"""
<!doctype html>
<html lang=\"en\">
  <body style=\"margin:0;padding:0;background:#f4f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;\">
    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"padding:24px 12px;\">
      <tr>
        <td align=\"center\">
          <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;\">
            <tr>
              <td style=\"background:linear-gradient(135deg,#0b4033,#1d9e75);padding:24px;color:#ffffff;\">
                <div style=\"font-size:12px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;opacity:.85;\">VITALOOP Invitation Update</div>
                <h1 style=\"margin:10px 0 0;font-size:24px;line-height:1.2;\">Invitation accepted</h1>
              </td>
            </tr>
            <tr>
              <td style=\"padding:24px;\">
                <p style=\"margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;\">
                  <strong>{safe_name}</strong> has accepted your invitation and joined <strong>{safe_org}</strong>.
                </p>
                <p style=\"margin:0;font-size:13px;line-height:1.6;color:#64748b;\">
                  You can now manage assignments and collaboration in CRM.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()

    return await _deliver_html_email(
        to_email=to_email,
        subject=f"Invitation accepted in {organization_name}",
        html=html,
    )


async def send_welcome_email(
    *,
    to_email: str,
    user_name: str,
    organization_name: str,
    dashboard_url: str,
) -> bool:
    """Send a styled welcome email to new team member."""

    safe_name = _safe(user_name)
    safe_org = _safe(organization_name)
    safe_url = _safe(dashboard_url)

    html = f"""
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:linear-gradient(135deg,#0b4033,#1d9e75);padding:32px 28px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;opacity:.85;">Welcome to VITALOOP</div>
                <h1 style="margin:16px 0 0;font-size:28px;line-height:1.2;">Welcome, {safe_name}!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">
                  You're now part of the <strong>{safe_org}</strong> team on VITALOOP.
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">
                  Get started by exploring your team's biomarker data, progress tracking, and personalized protocols in your dashboard.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0;">
                  <tr>
                    <td>
                      <a href="{safe_url}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#1d9e75;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;">Go to Dashboard</a>
                    </td>
                  </tr>
                </table>
                <div style="background:#f1f5f9;border-left:4px solid #1d9e75;padding:16px;border-radius:6px;margin:24px 0;">
                  <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
                    <strong style="color:#1d9e75;">Quick tips:</strong><br/>
                    • View team health metrics in the Funnel overview<br/>
                    • Track individual progress with assignments<br/>
                    • Generate personalized protocols based on biomarkers
                  </p>
                </div>
                <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
                  Have questions? Contact your team administrator for support.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()

    return await _deliver_html_email(
        to_email=to_email,
        subject=f"Welcome to {organization_name} on VITALOOP",
        html=html,
    )


async def send_ops_alert_email(
    *,
    to_email: str,
    organization_name: str,
    alert_title: str,
    alert_message: str,
    alert_level: str = "warning",  # "warning", "critical", "info"
    action_url: Optional[str] = None,
) -> bool:
    """Send an operational alert email to team admins.
    
    Alert levels:
    - warning: yellow/orange accent
    - critical: red accent
    - info: blue accent
    """

    safe_org = _safe(organization_name)
    safe_title = _safe(alert_title)
    safe_message = _safe(alert_message)

    # Color scheme by alert level
    color_map = {
        "critical": "#dc2626",
        "warning": "#ea580c",
        "info": "#0284c7",
    }
    accent_color = color_map.get(alert_level, "#ea580c")
    gradient_start = "#0b4033" if alert_level == "info" else accent_color
    gradient_end = "#1d9e75" if alert_level == "info" else accent_color

    button_html = ""
    if action_url:
        safe_url = _safe(action_url)
        button_html = f"""
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0;">
                  <tr>
                    <td>
                      <a href="{safe_url}" style="display:inline-block;padding:12px 24px;border-radius:6px;background:{accent_color};color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;">Review Alert</a>
                    </td>
                  </tr>
                </table>
"""

    html = f"""
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:linear-gradient(135deg,{gradient_start},{gradient_end});padding:24px;color:#ffffff;">
                <div style="font-size:11px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;opacity:.85;">VITALOOP Alert</div>
                <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;">{safe_title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
                  <strong>Organization:</strong> {safe_org}
                </p>
                <div style="background:#f8fafc;border-left:3px solid {accent_color};padding:14px;border-radius:4px;margin:16px 0;">
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
                    {safe_message}
                  </p>
                </div>
                {button_html}
                <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.6;">
                  This is an automated alert from VITALOOP operations. Please do not reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()

    return await _deliver_html_email(
        to_email=to_email,
        subject=f"[{alert_level.upper()}] {alert_title} - {organization_name}",
        html=html,
    )


async def send_registration_alert_email(
    *,
    to_email: str,
    registered_email: str,
    user_id: str,
    flow: str,
    full_name: Optional[str] = None,
    created_at_iso: Optional[str] = None,
) -> bool:
    """Notify operations when a new end-user registration completes."""

    safe_email = _safe(registered_email)
    safe_user_id = _safe(user_id)
    safe_flow = _safe(flow)
    safe_name = _safe(full_name)
    safe_created_at = _safe(created_at_iso)
    users_url = _safe(f"{settings.frontend_base_url.rstrip('/')}/ops")

    html = f"""
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:linear-gradient(135deg,#0b4033,#1d9e75);padding:24px;color:#ffffff;">
                <div style="font-size:11px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;opacity:.85;">VITALOOP Registration</div>
                <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;">New end-user signup detected</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
                  A new standard VITALOOP user has completed the registration flow.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;">{safe_email}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Full name</td><td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;">{safe_name or '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">User ID</td><td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;word-break:break-all;">{safe_user_id}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Flow</td><td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;">{safe_flow}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Created at</td><td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;">{safe_created_at or '—'}</td></tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0;">
                  <tr>
                    <td>
                      <a href="{users_url}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#1d9e75;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;">Open Ops Dashboard</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.6;">
                  This is an automated internal notification for signup monitoring.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()

    return await _deliver_html_email(
        to_email=to_email,
        subject=f"New VITALOOP signup: {registered_email}",
        html=html,
    )
