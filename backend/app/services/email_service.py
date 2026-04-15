from __future__ import annotations

from datetime import datetime
from html import escape
from typing import Optional

import httpx

from app.config import settings


SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send"


def _is_email_configured() -> bool:
    return bool(settings.sendgrid_api_key and settings.sendgrid_from_email)


def _safe(value: Optional[str]) -> str:
    return escape(value or "")


async def send_invitation_email(
    *,
    to_email: str,
    organization_name: str,
    role: str,
    inviter_name: str,
    invitation_url: str,
    expires_at_iso: Optional[str] = None,
) -> bool:
    """Send a styled invitation email via SendGrid.

    Returns True on successful provider acceptance, False when email provider
    is not configured or request failed.
    """

    if not _is_email_configured():
        return False

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

    payload = {
        "personalizations": [
            {
                "to": [{"email": to_email}],
                "subject": f"Invitation to join {organization_name} on VITALOOP",
            }
        ],
        "from": {"email": settings.sendgrid_from_email},
        "content": [
            {"type": "text/html", "value": html},
        ],
    }

    headers = {
        "Authorization": f"Bearer {settings.sendgrid_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(SENDGRID_ENDPOINT, headers=headers, json=payload)
            return 200 <= resp.status_code < 300
    except Exception:
        return False
