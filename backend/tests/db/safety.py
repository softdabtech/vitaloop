"""Fail-closed target validation for the optional PostgreSQL test harness.

Pure functions (no driver, no network) so they are unit-tested in the normal suite.
Nothing here creates roles or drops shared schemas.
"""
from __future__ import annotations

import re
from typing import Iterable, List
from urllib.parse import unquote, urlparse

DB_NAME_RE = re.compile(r"^vitaloop_test_[a-z0-9_]{1,40}$")
SENTINEL_COMMENT = "vitaloop-disposable-test-database"
CONFIRM_ENV = "VITALOOP_TEST_PG_CONFIRM_DISPOSABLE"
CONFIRM_VALUE = "i-understand-this-database-is-disposable"
REQUIRED_ROLES = ("anon", "authenticated", "service_role", "vitaloop_finalizer")
FORBIDDEN_SCHEMAS = ("auth", "storage", "realtime", "vault", "extensions", "graphql")
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", ""}


class UnsafeTarget(Exception):
    pass


def validate_dsn(dsn: str, confirm: str | None) -> str:
    """Return the database name or raise UnsafeTarget. Runs before any connection."""
    if confirm != CONFIRM_VALUE:
        raise UnsafeTarget("missing disposable-database confirmation")
    if not dsn or not dsn.startswith(("postgres://", "postgresql://")):
        raise UnsafeTarget("DSN must be a postgres URL")
    parsed = urlparse(dsn)
    host = (parsed.hostname or "").lower()
    if host not in _LOCAL_HOSTS and not host.startswith("/"):
        raise UnsafeTarget("non-local host rejected")
    if any(s in dsn.lower() for s in ("supabase", "prod", "amazonaws", "azure", "neon.tech")):
        raise UnsafeTarget("production-looking target rejected")
    name = unquote((parsed.path or "").lstrip("/"))
    if not DB_NAME_RE.match(name):
        raise UnsafeTarget("database name must match vitaloop_test_*")
    return name


def validate_server_state(
    *, comment: str | None, schemas: Iterable[str], public_objects: int, roles: Iterable[str],
    extensions: Iterable[str] | None = None, views: int = 0, sequences: int = 0, types_: int = 0,
    role_attrs: dict | None = None, role_memberships: Iterable[str] | None = None,
    unexpected_schemas: int = 0,
) -> List[str]:
    """Return the list of violations; empty means the target is an empty, sentinel-marked db.

    Checks sentinel, all schemas (no unexpected), empty public, required roles with correct
    attributes and memberships (finalizer: nologin, nosuperuser, nobypassrls, noinherit,
    nocreatedb, nocreaterole, noreplication, and no granted roles), and no unexpected objects
    (extensions except plpgsql, views, sequences, types). Fail-closed before DDL.
    """
    problems = []
    if comment != SENTINEL_COMMENT:
        problems.append("sentinel database comment missing")

    present = set(schemas)
    # Check for forbidden platform schemas
    bad_platform = [s for s in present if s in FORBIDDEN_SCHEMAS or s.startswith("supabase_")]
    if bad_platform:
        problems.append(f"platform schemas present: {sorted(bad_platform)}")

    # Check for unexpected arbitrary schemas (not PostgreSQL system or public)
    allowed_system_schemas = {"pg_catalog", "information_schema", "pg_toast", "public"}
    unexpected = [s for s in present if s not in allowed_system_schemas and s not in FORBIDDEN_SCHEMAS
                  and not s.startswith("supabase_") and not s.startswith("pg_")]
    if unexpected:
        problems.append(f"unexpected schemas: {sorted(unexpected)}")

    if unexpected_schemas:
        problems.append(f"unexpected schema count: {unexpected_schemas}")

    if public_objects:
        problems.append("public schema is not empty")

    missing = [r for r in REQUIRED_ROLES if r not in set(roles)]
    if missing:
        problems.append(f"operator-provisioned roles missing: {missing}")

    # Missing catalog data must not be interpreted as a safe role configuration.
    required_attrs = {
        "rolcanlogin": "NOLOGIN",
        "rolsuper": "NOSUPERUSER",
        "rolbypassrls": "NOBYPASSRLS",
        "rolinherit": "NOINHERIT",
        "rolcreatedb": "NOCREATEDB",
        "rolcreaterole": "NOCREATEROLE",
        "rolreplication": "NOREPLICATION",
    }
    attrs = role_attrs.get("vitaloop_finalizer") if role_attrs else None
    if not isinstance(attrs, dict):
        problems.append("finalizer role attributes unavailable")
    else:
        for attr, expected in required_attrs.items():
            if attrs.get(attr) is not False:
                problems.append(f"finalizer role must be {expected}")

    # Any role granted to the SECURITY DEFINER owner changes its effective authority.
    # The fixture supplies the complete recursive (direct and transitive) membership closure.
    if role_memberships is None:
        problems.append("finalizer role membership inspection unavailable")
    else:
        membership_rows = list(role_memberships)
        if any(not isinstance(role, str) or not role for role in membership_rows):
            problems.append("finalizer role memberships malformed")
            memberships = []
        else:
            memberships = sorted(set(membership_rows))
            if len(memberships) != len(membership_rows):
                problems.append("finalizer role memberships malformed")
        if memberships:
            problems.append(f"finalizer role has unexpected memberships: {memberships}")

    if extensions:
        unexpected_ext = [e for e in extensions if e not in ("plpgsql",)]
        if unexpected_ext:
            problems.append(f"unexpected extensions: {sorted(unexpected_ext)}")
    if views:
        problems.append(f"unexpected views found: {views}")
    if sequences:
        problems.append(f"unexpected sequences found: {sequences}")
    if types_:
        problems.append(f"unexpected custom types found: {types_}")
    return problems
