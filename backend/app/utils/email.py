import httpx
from app.config import settings

def send_email(to: str, subject: str, body: str):
    # Пример для Resend API, можно заменить на другой email-сервис
    api_key = settings.resend_api_key
    if not api_key:
        raise RuntimeError("RESEND_API_KEY not set")
    payload = {
        "from": settings.resend_from_email,
        "to": [to],
        "subject": subject,
        "text": body,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    resp = httpx.post("https://api.resend.com/emails", json=payload, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()
