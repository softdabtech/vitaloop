from __future__ import annotations

from typing import Any


def resolve_locale(request: Any | None = None, *, default: str = "en") -> str:
    """Resolve response locale from explicit headers, browser language, then domain."""
    if request is None:
        return default

    headers = getattr(request, "headers", {}) or {}

    explicit = str(headers.get("X-Vitaloop-Locale") or "").strip().lower()
    if explicit.startswith("uk"):
        return "uk"
    if explicit.startswith("en"):
        return "en"

    accept_language = str(headers.get("Accept-Language") or "").strip().lower()
    language_tokens = [token.split(";")[0].strip() for token in accept_language.split(",") if token.strip()]
    if any(token == "uk" or token.startswith("uk-") for token in language_tokens):
        return "uk"
    if any(token == "en" or token.startswith("en-") for token in language_tokens):
        return "en"

    origin = str(headers.get("Origin") or headers.get("Referer") or "").strip().lower()
    if "ua.vitaloop.today" in origin:
        return "uk"

    return default

