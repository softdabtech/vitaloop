from app.services.lab_adapters.smartlab import SmartlabAdapter


def get_adapter(name: str):
    normalized = (name or "smartlab").strip().lower()
    if normalized == "smartlab":
        return SmartlabAdapter()
    # Fallback to smartlab parser for MVP partner onboarding.
    return SmartlabAdapter()
