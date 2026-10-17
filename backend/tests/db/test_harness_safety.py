import pytest

from tests.db.safety import (
    CONFIRM_VALUE, SENTINEL_COMMENT, UnsafeTarget, validate_dsn, validate_server_state,
)

GOOD = "postgresql://localhost:5432/vitaloop_test_finalize"


def test_valid_target_accepted():
    assert validate_dsn(GOOD, CONFIRM_VALUE) == "vitaloop_test_finalize"


@pytest.mark.parametrize("dsn", [
    "postgresql://localhost/postgres",
    "postgresql://localhost/vitaloop",
    "postgresql://localhost/vitaloop_test_",
    "postgresql://localhost/VITALOOP_TEST_x",
    "postgresql://db.abc.supabase.co/vitaloop_test_x",
    "postgresql://10.0.0.5/vitaloop_test_x",
    "postgresql://prod.example.com/vitaloop_test_x",
    "",
])
def test_unsafe_dsn_rejected(dsn):
    with pytest.raises(UnsafeTarget):
        validate_dsn(dsn, CONFIRM_VALUE)


@pytest.mark.parametrize("confirm", [None, "", "yes"])
def test_confirmation_required(confirm):
    with pytest.raises(UnsafeTarget):
        validate_dsn(GOOD, confirm)


ROLES = ("anon", "authenticated", "service_role", "vitaloop_finalizer")
SAFE_FINALIZER_ATTRS = {"vitaloop_finalizer": {
    "rolcanlogin": False, "rolsuper": False, "rolbypassrls": False, "rolinherit": False,
    "rolcreatedb": False, "rolcreaterole": False, "rolreplication": False,
}}


def safe_state(**overrides):
    state = {
        "comment": SENTINEL_COMMENT,
        "schemas": ["public", "pg_catalog"],
        "public_objects": 0,
        "roles": ROLES,
        "role_attrs": SAFE_FINALIZER_ATTRS,
        "role_memberships": (),
    }
    state.update(overrides)
    return validate_server_state(**state)


def test_clean_server_state():
    assert safe_state(extensions=["plpgsql"], views=0, sequences=0, types_=0) == []


def test_system_schemas_allowed():
    """pg_toast and other PostgreSQL system schemas are implicitly allowed."""
    assert safe_state(schemas=["public", "pg_catalog", "information_schema", "pg_toast"]) == []


def test_unexpected_user_schema_rejected():
    """User-defined schemas (not pg_*) must be rejected."""
    p = safe_state(schemas=["public", "pg_catalog", "my_app_schema"])
    assert any("unexpected schemas" in x for x in p)


def test_role_attributes_validation():
    """Finalizer role must have correct attributes (NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT, NOCREATEDB, NOCREATEROLE, NOREPLICATION)."""
    # All attributes correct
    attrs_correct = SAFE_FINALIZER_ATTRS
    assert safe_state(role_attrs=attrs_correct) == []

    # Each violation detected individually
    for bad_attr, bad_value in [
        ("rolcanlogin", True),
        ("rolsuper", True),
        ("rolbypassrls", True),
        ("rolinherit", True),
        ("rolcreatedb", True),
        ("rolcreaterole", True),
        ("rolreplication", True)
    ]:
        attrs_bad = {"vitaloop_finalizer": {
            "rolcanlogin": False, "rolsuper": False, "rolbypassrls": False, "rolinherit": False,
            "rolcreatedb": False, "rolcreaterole": False, "rolreplication": False
        }}
        attrs_bad["vitaloop_finalizer"][bad_attr] = bad_value
        p = safe_state(role_attrs=attrs_bad)
        assert len(p) >= 1, f"Failed to detect {bad_attr}={bad_value}"


@pytest.mark.parametrize("attrs", [None, {}, {"vitaloop_finalizer": {}}, {
    "vitaloop_finalizer": {"rolcanlogin": False},
}])
def test_missing_finalizer_attributes_fail_closed(attrs):
    assert any("finalizer role must be" in p or "attributes unavailable" in p
               for p in safe_state(role_attrs=attrs))


@pytest.mark.parametrize("memberships", [
    ("pg_read_all_data",),
    ("trusted_group",),
    ("direct_role", "privileged_parent"),
])
def test_finalizer_direct_or_transitive_memberships_are_rejected(memberships):
    assert any("unexpected memberships" in p for p in safe_state(role_memberships=memberships))


@pytest.mark.parametrize("memberships", [None, ("role", "role"), ("",), ({"role": "x"},)])
def test_missing_or_malformed_membership_inspection_fails_closed(memberships):
    problems = safe_state(role_memberships=memberships)
    assert any("membership inspection unavailable" in p or "memberships malformed" in p for p in problems)


def test_server_state_violations():
    p = safe_state(comment=None, schemas=["public", "auth", "supabase_functions"],
                   public_objects=3, roles=["anon"], extensions=["uuid-ossp"],
                   views=2, sequences=1, types_=1)
    assert len(p) >= 7
    assert any("sentinel" in x for x in p)
    assert any("platform" in x for x in p)
    assert any("public schema is not empty" in x for x in p)
    assert any("roles missing" in x for x in p)
    assert any("extensions" in x for x in p)
    assert any("views" in x for x in p)
    assert any("sequences" in x for x in p)
    assert any("custom types" in x for x in p)


def test_plpgsql_extension_allowed():
    """plpgsql is the default PL and always present; it should not block tests."""
    assert safe_state(extensions=["plpgsql"]) == []


def test_unexpected_extension_rejected():
    """Any extension other than plpgsql is a sign of wrong target."""
    p = safe_state(extensions=["plpgsql", "uuid-ossp"])
    assert any("unexpected extensions" in x for x in p)
