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
    """Send a styled welcome email to a newly registered VITALOOP user."""

    safe_name = _safe(user_name)
    safe_email = _safe(to_email)
    safe_url = _safe(dashboard_url)
    login_url = _safe(dashboard_url.replace("/dashboard", "/login"))

    html = f"""
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Welcome to VITALOOP</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f8;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f4f7f8;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0b4033 0%,#0f6e56 50%,#1d9e75 100%);padding:36px 32px 32px;text-align:center;">
              <!-- Logo -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 20px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="https://vitaloop.today/icons/icon-192.png" alt="VITALOOP" width="44" height="44"
                      style="display:block;border-radius:10px;border:2px solid rgba(255,255,255,0.25);"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:22px;font-weight:800;letter-spacing:0.1em;color:#ffffff;text-transform:uppercase;">VITA<span style="color:#86efcb;">LOOP</span></span>
                  </td>
                </tr>
              </table>
              <div style="font-size:11px;letter-spacing:0.18em;font-weight:600;text-transform:uppercase;color:rgba(180,255,220,0.7);margin-bottom:12px;">Health Intelligence Platform</div>
              <h1 style="margin:0;font-size:28px;font-weight:700;line-height:1.2;color:#ffffff;">
                Welcome, {safe_name}!
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:rgba(200,255,230,0.8);line-height:1.5;">
                Your personal health intelligence cabinet is ready.
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:32px 32px 24px;">

              <!-- Login info block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#f0fdf9;border:1px solid #a7f3d0;border-radius:12px;padding:18px 20px;">
                    <div style="font-size:11px;letter-spacing:0.12em;font-weight:700;text-transform:uppercase;color:#0f6e56;margin-bottom:10px;">Your account credentials</div>
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:13px;color:#64748b;padding-bottom:6px;padding-right:16px;white-space:nowrap;">Login (email):</td>
                        <td style="font-size:13px;font-weight:600;color:#0f172a;padding-bottom:6px;">{safe_email}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#64748b;padding-right:16px;white-space:nowrap;">Password:</td>
                        <td style="font-size:13px;color:#64748b;">The password you set during registration</td>
                      </tr>
                    </table>
                    <div style="margin-top:12px;">
                      <a href="{login_url}" style="font-size:13px;color:#1d9e75;text-decoration:none;font-weight:600;">→ Sign in at vitaloop.today</a>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- How to get started heading -->
              <div style="font-size:11px;letter-spacing:0.15em;font-weight:700;text-transform:uppercase;color:#1d9e75;margin-bottom:18px;">How to get started</div>

              <!-- Step 1 -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
                <tr>
                  <td width="48" style="vertical-align:top;padding-top:1px;">
                    <div style="width:34px;height:34px;border-radius:50%;background:#1d9e75;text-align:center;line-height:34px;font-size:14px;font-weight:800;color:#ffffff;">1</div>
                  </td>
                  <td style="vertical-align:top;">
                    <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">Upload your lab report</div>
                    <div style="font-size:13px;color:#475569;line-height:1.6;">
                      Drop any PDF or image with blood/urine test results in <strong style="color:#0f6e56;">Dashboard → Upload Lab Report</strong>. AI extracts 85+ biomarkers automatically in under 60 seconds.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Step 2 -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
                <tr>
                  <td width="48" style="vertical-align:top;padding-top:1px;">
                    <div style="width:34px;height:34px;border-radius:50%;background:#1d9e75;text-align:center;line-height:34px;font-size:14px;font-weight:800;color:#ffffff;">2</div>
                  </td>
                  <td style="vertical-align:top;">
                    <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">Get AI-powered analysis</div>
                    <div style="font-size:13px;color:#475569;line-height:1.6;">
                      VITALOOP flags deficiencies, risks, and trends ranked by severity. Free plan includes standard analysis; <strong style="color:#0f6e56;">Premium</strong> unlocks exact dosage protocols.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Step 3 -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td width="48" style="vertical-align:top;padding-top:1px;">
                    <div style="width:34px;height:34px;border-radius:50%;background:#1d9e75;text-align:center;line-height:34px;font-size:14px;font-weight:800;color:#ffffff;">3</div>
                  </td>
                  <td style="vertical-align:top;">
                    <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">Follow your personal protocol</div>
                    <div style="font-size:13px;color:#475569;line-height:1.6;">
                      Open <strong style="color:#0f6e56;">Protocols</strong> for personalized supplement and lifestyle recommendations — exact dosages, timing, and 12-week milestones.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="{safe_url}" style="display:inline-block;padding:15px 44px;border-radius:999px;background:#1d9e75;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:0.02em;">Open My Dashboard →</a>
                  </td>
                </tr>
              </table>

              <!-- Tips block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #1d9e75;border-radius:0 8px 8px 0;padding:14px 16px;">
                    <div style="font-size:13px;color:#475569;line-height:1.6;">
                      <strong style="color:#1d9e75;">💡 Tip:</strong>
                      Fill in your <strong style="color:#334155;">Health Profile</strong> (age, sex, weight) for more accurate AI analysis. You can also enter biomarkers manually without uploading a file.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Help Center block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                <tr>
                  <td style="background:#f0fdf9;border:1px solid #a7f3d0;border-radius:10px;padding:16px 20px;text-align:center;">
                    <div style="font-size:13px;color:#475569;line-height:1.6;">
                      <span style="font-size:16px;">📖</span>&nbsp;
                      <strong style="color:#0f6e56;">New to VITALOOP?</strong>
                      Visit our
                      <a href="https://vitaloop.today/help" style="color:#1d9e75;font-weight:600;text-decoration:none;">Help Center</a>
                      — step-by-step guides on uploading labs, reading your results, and getting the most out of your protocol.
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <div style="font-size:12px;color:#94a3b8;line-height:1.7;">
                You received this email because you registered at
                <a href="https://vitaloop.today" style="color:#1d9e75;text-decoration:none;">vitaloop.today</a>.<br/>
                Questions? Reply to this email or contact <a href="mailto:info@softdab.tech" style="color:#1d9e75;text-decoration:none;">info@softdab.tech</a>
              </div>
              <div style="margin-top:14px;">
                <img src="https://vitaloop.today/icons/icon-192.png" alt="" width="24" height="24"
                  style="display:inline-block;border-radius:6px;vertical-align:middle;margin-right:6px;opacity:0.5;"/>
                <span style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#cbd5e1;vertical-align:middle;">
                  VITALOOP · Health Intelligence Platform
                </span>
              </div>
              <div style="margin-top:8px;font-size:11px;color:#cbd5e1;">
                NOT MEDICAL ADVICE. Always work with a qualified clinician for diagnosis and treatment.
              </div>
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
        subject="Welcome to VITALOOP — Your health cabinet is ready",
        html=html,
    )


async def send_premium_analysis_ready_email(
    *,
    to_email: str,
    user_name: Optional[str],
    dashboard_url: str,
    eta_minutes: int = 10,
    top_recommendations: Optional[list[str]] = None,
) -> bool:
    """Send branded VITALOOP email when deferred premium analysis is ready."""

    safe_name = _safe(user_name) or "there"
    safe_url = _safe(dashboard_url)
    safe_eta = max(1, int(eta_minutes))

    recommendations = [r for r in (top_recommendations or []) if str(r).strip()][:3]
    rec_html = ""
    if recommendations:
        items = "".join(
            f'<li style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.5;">{_safe(item)}</li>'
            for item in recommendations
        )
        rec_html = f"""
                <div style="margin:18px 0 0;padding:14px 16px;border:1px solid #d1fae5;background:#f0fdf4;border-radius:12px;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#047857;margin:0 0 8px;">Top recommendations</div>
                  <ul style="margin:0;padding-left:18px;">{items}</ul>
                </div>
"""

    html = f"""
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe7ef;">
            <tr>
              <td style="background:linear-gradient(135deg,#0b4033,#1d9e75);padding:26px 24px;color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="https://vitaloop.today/icons/icon-192.png" alt="VITALOOP" width="34" height="34" style="display:block;border-radius:8px;border:1px solid rgba(255,255,255,0.35);background:#ffffff;padding:2px;" />
                    </td>
                    <td style="padding-left:10px;vertical-align:middle;">
                      <div style="font-size:11px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;opacity:.9;">VITALOOP Premium</div>
                      <div style="margin-top:2px;font-size:16px;font-weight:700;">Your analysis is ready</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#334155;">
                  Hi <strong style="color:#0f172a;">{safe_name}</strong>, your detailed VITALOOP premium analysis is complete.
                </p>
                <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#475569;">
                  We processed your uploaded lab report and prepared a personalized recommendation set in your cabinet.
                </p>
                <div style="padding:12px 14px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:13px;line-height:1.5;">
                  Processing window used: approximately {safe_eta} minutes for higher-quality recommendations.
                </div>
                {rec_html}
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 10px;">
                  <tr>
                    <td>
                      <a href="{safe_url}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#1d9e75;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;">Open My Premium Insights</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                  You are receiving this because premium analysis notifications are enabled for your account.
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
        subject="Your VITALOOP Premium Analysis Is Ready",
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


async def send_analysis_ready_email(
    to_email: str,
    file_name: str,
    dashboard_url: str = "https://vitaloop.today/lab-results",
) -> bool:
    """Send email notification that lab analysis is ready."""
    html = f"""
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Your Lab Analysis is Ready</title>
      </head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:40px 0;background:#f8fafc;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
                <tr>
                  <td style="padding:40px;background:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <h1 style="margin:0 0 16px 0;font-size:28px;font-weight:700;color:#0f172a;">
                      Your Lab Analysis is Ready! 🎉
                    </h1>
                    <p style="margin:0 0 24px 0;font-size:16px;color:#475569;line-height:1.6;">
                      Great news! We've completed the analysis of your lab results from <strong>{_safe(file_name)}</strong>.
                    </p>
                    <p style="margin:0 0 24px 0;font-size:16px;color:#475569;line-height:1.6;">
                      Your personalized biomarker breakdown is now available in your VITALOOP dashboard.
                      View detailed insights, see your health metrics, and get AI-powered recommendations for optimization.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:32px 0;">
                      <tr>
                        <td>
                          <a href="{dashboard_url}" style="display:inline-block;padding:14px 32px;border-radius:8px;background:#1d9e75;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;">View Your Results</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:32px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
                      <strong>What's included:</strong><br>
                      ✓ Detailed biomarker analysis<br>
                      ✓ Personalized supplement protocol<br>
                      ✓ Health optimization recommendations<br>
                      ✓ Comparison to reference ranges
                    </p>
                    <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;">
                    <p style="margin:16px 0;font-size:12px;color:#94a3b8;line-height:1.6;">
                      VITALOOP Team | <a href="https://vitaloop.today" style="color:#1d9e75;text-decoration:none;">vitaloop.today</a>
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
        subject="Your Lab Analysis is Ready - VITALOOP",
        html=html,
    )
