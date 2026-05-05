import os
import time

import httpx
import pytest


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _is_true(value: str) -> bool:
    return value.lower() in {"1", "true", "yes", "y", "on"}


RUN_LIVE = _is_true(_env("E2E_RUN_LIVE", "0"))

pytestmark = pytest.mark.skipif(
    not RUN_LIVE,
    reason="Live health-profile smoke is disabled. Set E2E_RUN_LIVE=1 to enable.",
)


def _request_json(
    client: httpx.Client,
    method: str,
    path: str,
    *,
    headers: dict | None = None,
    json_body: dict | None = None,
) -> tuple[int, object, str]:
    response = client.request(method, path, headers=headers, json=json_body)
    text = response.text
    try:
        payload = response.json() if text else None
    except ValueError:
        payload = text
    return response.status_code, payload, text


@pytest.fixture(scope="session")
def live_profile_config() -> dict:
    api_base_url = _env("E2E_API_BASE_URL", "https://api.vitaloop.today").rstrip("/")
    supabase_url = _env("E2E_SUPABASE_URL")
    service_role_key = _env("E2E_SUPABASE_SERVICE_ROLE_KEY")
    anon_key = _env("E2E_SUPABASE_ANON_KEY")

    missing = [
        name
        for name, value in {
            "E2E_SUPABASE_URL": supabase_url,
            "E2E_SUPABASE_SERVICE_ROLE_KEY": service_role_key,
            "E2E_SUPABASE_ANON_KEY": anon_key,
        }.items()
        if not value
    ]
    if missing:
        pytest.skip(f"Missing live smoke secrets: {', '.join(missing)}")

    return {
        "api_base_url": api_base_url,
        "supabase_url": supabase_url.rstrip("/"),
        "service_role_key": service_role_key,
        "anon_key": anon_key,
    }


@pytest.fixture(scope="session")
def live_profile_token(live_profile_config: dict) -> str:
    timestamp = int(time.time())
    email = f"smoke-health-profile-{timestamp}@example.com"
    password = f"Smoke!{timestamp}Aa"

    supabase_headers = {"apikey": live_profile_config["anon_key"]}
    admin_headers = {
        "apikey": live_profile_config["service_role_key"],
        "Authorization": f"Bearer {live_profile_config['service_role_key']}",
    }

    with httpx.Client(base_url=live_profile_config["supabase_url"], timeout=30.0) as client:
        signup_status, signup_payload, signup_text = _request_json(
            client,
            "POST",
            "/auth/v1/signup",
            headers=supabase_headers,
            json_body={"email": email, "password": password},
        )
        assert signup_status in (200, 201), (
            f"Supabase signup failed: {signup_status} {signup_text}"
        )

        user = (signup_payload or {}).get("user") or {}
        user_id = user.get("id")
        assert user_id, f"Supabase signup returned no user id: {signup_payload}"

        try:
            confirm_status, _, confirm_text = _request_json(
                client,
                "PUT",
                f"/auth/v1/admin/users/{user_id}",
                headers=admin_headers,
                json_body={"email_confirm": True},
            )
            assert confirm_status == 200, (
                f"Supabase confirm failed: {confirm_status} {confirm_text}"
            )

            signin_status, signin_payload, signin_text = _request_json(
                client,
                "POST",
                "/auth/v1/token?grant_type=password",
                headers=supabase_headers,
                json_body={"email": email, "password": password},
            )
            assert signin_status == 200, (
                f"Supabase sign-in failed: {signin_status} {signin_text}"
            )

            access_token = (signin_payload or {}).get("access_token")
            assert access_token, f"Sign-in returned no access token: {signin_payload}"
            yield access_token
        finally:
            _request_json(
                client,
                "DELETE",
                f"/auth/v1/admin/users/{user_id}",
                headers=admin_headers,
            )


def test_live_health_profile_accepts_legacy_sex_values(live_profile_config: dict, live_profile_token: str):
    headers = {"Authorization": f"Bearer {live_profile_token}"}
    checks = [
        ("get_profile_initial", "GET", "/profile", None),
        ("patch_age_sex_valid", "PATCH", "/profile", {"age": 34, "sex": "male"}),
        ("patch_age_sex_M", "PATCH", "/profile", {"age": 35, "sex": "M"}),
        ("patch_age_sex_F", "PATCH", "/profile", {"age": 35, "sex": "F"}),
        ("patch_age_sex_O", "PATCH", "/profile", {"age": 35, "sex": "O"}),
        ("patch_height_weight", "PATCH", "/profile", {"height_cm": 181, "weight_kg": 79.5}),
        (
            "patch_goals_tz",
            "PATCH",
            "/profile",
            {"goals": ["More energy", "Better sleep"], "timezone": "Europe/Kiev"},
        ),
        (
            "patch_medical_flags",
            "PATCH",
            "/profile",
            {"medications": "none", "allergies": "none", "pregnancy_status": "none"},
        ),
        (
            "patch_supplements",
            "PATCH",
            "/profile",
            {
                "current_supplements": ["Magnesium"],
                "current_medications": ["None"],
                "prior_diagnoses": "none",
            },
        ),
        ("patch_onboarding_complete", "PATCH", "/profile", {"onboarding_complete": True}),
        ("get_profile_final", "GET", "/profile", None),
    ]

    failures = []
    with httpx.Client(base_url=live_profile_config["api_base_url"], timeout=30.0) as client:
        for name, method, path, payload in checks:
            status_code, response_payload, response_text = _request_json(
                client,
                method,
                path,
                headers=headers,
                json_body=payload,
            )
            if status_code >= 400:
                failures.append(
                    f"{name}: {status_code} {response_text or response_payload}"
                )

    assert not failures, "Health-profile live smoke failed:\n" + "\n".join(failures)