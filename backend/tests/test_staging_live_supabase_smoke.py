import os
import time
import uuid

import httpx
import pytest


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _is_true(value: str) -> bool:
    return value.lower() in {"1", "true", "yes", "y", "on"}


RUN_LIVE = _is_true(_env("E2E_RUN_LIVE", "0"))

pytestmark = pytest.mark.skipif(
    not RUN_LIVE,
    reason="Live staging smoke is disabled. Set E2E_RUN_LIVE=1 to enable.",
)


@pytest.fixture(scope="session")
def live_config() -> dict:
    token = _env("E2E_BEARER_TOKEN")
    if not token:
        pytest.skip("Set E2E_BEARER_TOKEN to a valid Supabase access token.")

    return {
        "base_url": _env("E2E_API_BASE_URL", "https://api.vitaloop.today").rstrip("/"),
        "token": token,
        "org_id": _env("E2E_ORG_ID"),
        "invite_email": _env("E2E_INVITE_EMAIL"),
    }


@pytest.fixture(scope="session")
def client(live_config: dict):
    headers = {
        "Authorization": f"Bearer {live_config['token']}",
        "Content-Type": "application/json",
    }
    with httpx.Client(base_url=live_config["base_url"], headers=headers, timeout=20.0) as c:
        yield c


@pytest.fixture(scope="session")
def public_client(live_config: dict):
    with httpx.Client(base_url=live_config["base_url"], timeout=20.0) as c:
        yield c


def _resolve_org_id(client: httpx.Client, preferred_org_id: str) -> str:
    if preferred_org_id:
        return preferred_org_id

    resp = client.get("/admin/organizations")
    assert resp.status_code == 200, f"/admin/organizations failed: {resp.status_code} {resp.text}"

    rows = resp.json() or []
    if not rows:
        pytest.skip("No organizations available for the current user. Set E2E_ORG_ID explicitly.")

    org_id = str(rows[0].get("id") or "").strip()
    if not org_id:
        pytest.skip("Organization list returned rows without id.")

    return org_id


def test_live_health_endpoint(live_config: dict):
    with httpx.Client(base_url=live_config["base_url"], timeout=20.0) as c:
        resp = c.get("/health")

    assert resp.status_code == 200, f"/health failed: {resp.status_code} {resp.text}"
    payload = resp.json()
    assert payload.get("status") == "ok"


def test_live_auth_me(client: httpx.Client):
    resp = client.get("/auth/me")
    assert resp.status_code == 200, f"/auth/me failed: {resp.status_code} {resp.text}"

    data = resp.json()
    user = data.get("user") or {}
    assert user.get("id"), "Expected user.id in /auth/me response"
    assert "global_role" in user, "Expected user.global_role in /auth/me response"
    assert data.get("global_role") == user.get("global_role")
    assert isinstance(data.get("has_active_subscription"), bool)


def test_live_auth_me_requires_bearer(public_client: httpx.Client):
    resp = public_client.get("/auth/me")
    assert resp.status_code == 401, (
        f"Expected 401 without bearer, got {resp.status_code}: {resp.text}"
    )


def test_live_crm_reads(client: httpx.Client, live_config: dict):
    org_id = _resolve_org_id(client, live_config["org_id"])

    members_resp = client.get("/admin/members", params={"org_id": org_id})
    assert members_resp.status_code == 200, (
        f"/admin/members failed: {members_resp.status_code} {members_resp.text}"
    )

    invitations_resp = client.get("/admin/invitations", params={"org_id": org_id})
    assert invitations_resp.status_code == 200, (
        f"/admin/invitations failed: {invitations_resp.status_code} {invitations_resp.text}"
    )

    assignments_resp = client.get("/admin/assignments", params={"org_id": org_id})
    assert assignments_resp.status_code == 200, (
        f"/admin/assignments failed: {assignments_resp.status_code} {assignments_resp.text}"
    )


def test_live_admin_funnel_overview_role_aware(client: httpx.Client):
    resp = client.get(
        "/admin/funnel-overview",
        params={
            "days": 30,
            "min_dropoff_reached": 1,
            "dropoff_sort": "count",
            "dropoff_limit": 10,
        },
    )

    if resp.status_code == 403:
        pytest.skip("Current token is not super_admin for /admin/funnel-overview.")

    assert resp.status_code == 200, (
        f"/admin/funnel-overview failed: {resp.status_code} {resp.text}"
    )

    payload = resp.json() or {}
    assert "counts" in payload
    assert "rates" in payload
    assert "questionnaire" in payload


def test_live_invitation_accept_invalid_token(client: httpx.Client):
    bogus_token = f"e2e-invalid-{uuid.uuid4()}"
    resp = client.post("/admin/invitations/accept", json={"token": bogus_token})

    assert resp.status_code == 404, (
        f"Expected 404 for invalid token, got {resp.status_code}: {resp.text}"
    )


def test_live_invitation_create_and_revoke(client: httpx.Client, live_config: dict):
    invite_email = live_config["invite_email"]
    if not invite_email:
        pytest.skip("Set E2E_INVITE_EMAIL to run invitation create/revoke smoke test.")

    org_id = _resolve_org_id(client, live_config["org_id"])

    local_part, _, domain = invite_email.partition("@")
    unique_email = invite_email
    if local_part and domain:
        unique_email = f"{local_part}+e2e{int(time.time())}@{domain}"

    create_resp = client.post(
        "/admin/invitations",
        json={
            "org_id": org_id,
            "email": unique_email,
            "role": "member",
        },
    )

    if create_resp.status_code == 403:
        pytest.skip("Current token has no org-admin privileges for invitation create/revoke flow.")

    assert create_resp.status_code == 200, (
        f"/admin/invitations create failed: {create_resp.status_code} {create_resp.text}"
    )

    invitation = create_resp.json() or {}
    invitation_id = invitation.get("id")
    assert invitation_id, "Invitation create returned no id"

    revoke_resp = client.delete(f"/admin/invitations/{invitation_id}", params={"org_id": org_id})
    assert revoke_resp.status_code == 200, (
        f"/admin/invitations revoke failed: {revoke_resp.status_code} {revoke_resp.text}"
    )
