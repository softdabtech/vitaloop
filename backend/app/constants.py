"""
Shared application-level constants.

Import from here instead of defining per-module to avoid silent drift.
"""

# Input validation limits (shared between analyze and protocol routers)
MAX_SYMPTOMS: int = 20
MAX_SYMPTOM_LENGTH: int = 60
MAX_EXTRACTED_TEXT_LENGTH: int = 100_000
MIN_EXTRACTED_TEXT_LENGTH: int = 20

# Timeouts
ANALYZE_EXTRACT_TIMEOUT_SECONDS: int = 75
PROTOCOL_GENERATION_TIMEOUT_SECONDS: int = 75

# Rate limiting (per-user, independent from middleware path-level limits)
ANALYZE_REQUESTS_PER_MINUTE: int = 12
ANALYZE_WINDOW_SECONDS: float = 60.0
ANALYZE_IDEMPOTENCY_TTL_SECONDS: float = 900.0
MAX_IDEMPOTENCY_KEY_LENGTH: int = 128

# CRM role set (used across routers, dependencies, and dashboard)
CRM_ROLES: frozenset[str] = frozenset({
    "super_admin", "admin", "org_admin", "org_owner",
    "client_admin", "manager", "practitioner",
})
