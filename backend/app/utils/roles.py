"""
Shared role-resolution utilities.

Single source of truth for CRM role constants and normalization helpers
used across routers (auth, dashboard), dependencies_crm, and tests.
"""

from typing import Any

from app.constants import CRM_ROLES


def normalize_global_role(*values: Any) -> str:
    """Return the first recognisable business role found in *values*.

    Falls back to 'end_user' when nothing matches.
    """
    for value in values:
        role = str(value or "").strip().lower()
        if not role:
            continue
        if role in CRM_ROLES or role == "end_user":
            return role
    return "end_user"


def as_bool(value: Any) -> bool:
    """Coerce various truthy representations to bool."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes"}
    if isinstance(value, (int, float)):
        return value != 0
    return False
