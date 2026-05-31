#!/usr/bin/env python3
"""Stage 18 Knowledge Base staging smoke.

Required env:
  STAGING_API_URL
  STAGING_SUPER_ADMIN_BEARER
  STAGING_SUPER_ADMIN_USER_ID  (UUID)

This smoke validates:
1) POST /knowledge/evaluate
2) GET /knowledge/rules under super-admin
3) create draft rule -> submit review -> approve
4) evaluator sees only governance_status=active

Notes:
- Uses a unique temporary rule key on each run.
- Deprecates the temporary rule at the end to keep staging tidy.
"""

from __future__ import annotations

import datetime as dt
import os
import uuid
from typing import Any
from urllib.parse import urlparse

import httpx


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def _iso_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _assert_status(resp: httpx.Response, expected: int, *, context: str) -> None:
    if resp.status_code != expected:
        raise SystemExit(
            f"{context} failed: status={resp.status_code} expected={expected} body={resp.text[:1200]}"
        )


def _is_production_api_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host in {"api.vitaloop.today", "vitaloop.today", "www.vitaloop.today"}


def _looks_like_supabase_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host.endswith(".supabase.co")


def _looks_like_jwt(token: str) -> bool:
    # JWT must have three dot-separated segments.
    return token.count(".") == 2


def _admin_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _evaluate_payload(glucose_value: float) -> dict[str, Any]:
    return {
        "lab_results": {
            "glucose": {"value": glucose_value, "unit": "mg/dL"},
            "ferritin": {"value": 18, "unit": "ng/mL"},
        },
        "symptoms": ["fatigue"],
        "context": {"data_age_days": 10},
    }


def main() -> None:
    base_url = _require_env("STAGING_API_URL").rstrip("/")
    token = _require_env("STAGING_SUPER_ADMIN_BEARER")
    admin_user_id = _require_env("STAGING_SUPER_ADMIN_USER_ID")

    if _is_production_api_url(base_url):
        raise SystemExit("Refusing to run smoke against production API URL")

    if _looks_like_supabase_url(base_url):
        raise SystemExit(
            "STAGING_API_URL looks like Supabase project URL (.supabase.co). "
            "Use FastAPI backend URL (for example: https://staging-api...)."
        )

    if not _looks_like_jwt(token):
        raise SystemExit(
            "STAGING_SUPER_ADMIN_BEARER does not look like a user JWT. "
            "Use staging user access token (service_role key is not valid here)."
        )

    try:
        uuid.UUID(admin_user_id)
    except Exception as exc:  # pragma: no cover - operator input validation
        raise SystemExit(f"STAGING_SUPER_ADMIN_USER_ID must be UUID: {exc}")

    unique = str(uuid.uuid4())[:8]
    rule_key = f"smoke_stage18_glucose_{unique}"
    created_rule_id: str | None = None
    approved = False

    with httpx.Client(base_url=base_url, timeout=30.0) as client:
        headers = _admin_headers(token)

        # Preflight: verify token resolves to the expected super-admin user.
        auth_me_resp = client.get("/auth/me", headers=headers)
        _assert_status(auth_me_resp, 200, context="GET /auth/me preflight")
        auth_me_data = auth_me_resp.json()
        user = auth_me_data.get("user") if isinstance(auth_me_data, dict) else None
        if not isinstance(user, dict):
            raise SystemExit("/auth/me preflight returned unexpected payload (missing user object)")

        actual_user_id = str(user.get("id") or "")
        if actual_user_id != admin_user_id:
            raise SystemExit(
                "Super-admin preflight mismatch: STAGING_SUPER_ADMIN_USER_ID does not match /auth/me user.id "
                f"(expected {admin_user_id}, got {actual_user_id})"
            )

        actual_role = str(user.get("global_role") or auth_me_data.get("global_role") or "").lower()
        if actual_role != "super_admin":
            raise SystemExit(
                "Super-admin preflight failed: /auth/me global_role is not super_admin "
                f"(got {actual_role or 'empty'})"
            )
        print("ok: /auth/me preflight confirms expected super-admin token")

        # 1) API smoke: POST /knowledge/evaluate
        eval_resp = client.post("/knowledge/evaluate", headers=headers, json=_evaluate_payload(1200))
        _assert_status(eval_resp, 200, context="POST /knowledge/evaluate")
        eval_json = eval_resp.json()
        assert "matched_rules" in eval_json and isinstance(eval_json["matched_rules"], list)
        print("ok: POST /knowledge/evaluate")

        # 2) GET /knowledge/rules under super-admin
        list_resp = client.get("/knowledge/rules", headers=headers)
        _assert_status(list_resp, 200, context="GET /knowledge/rules")
        rules = list_resp.json()
        assert isinstance(rules, list)
        print(f"ok: GET /knowledge/rules count={len(rules)}")

        # Governance API must not be open without super-admin token.
        unauth_resp = client.get("/knowledge/rules")
        if unauth_resp.status_code not in (401, 403):
            raise SystemExit(
                "Governance endpoint should be protected; expected 401/403 without token, "
                f"got {unauth_resp.status_code}"
            )
        print("ok: governance endpoint is protected without super-admin token")

        # 3) create draft rule
        create_payload = {
            "key": rule_key,
            "name": f"Stage18 smoke rule {unique}",
            "description": "Temporary smoke rule for governance flow",
            "input_entities": ["glucose"],
            "conditions": {
                "all": [
                    {"lab_marker": "glucose", "operator": "gte", "value": 999, "unit": "mg/dL"}
                ]
            },
            "outputs": {
                "risk": "smoke_possible_glucose_risk",
                "summary": "Glucose may indicate possible risk (smoke)",
                "recommendation_keys": ["smoke_rec_key_unused"],
            },
            "confidence": 0.61,
            "severity": "moderate",
            "requires_doctor": False,
            "explanation_template": "Smoke glucose rule matched for {{glucose_value}} {{glucose_unit}}",
            "source": "smoke_test",
            "source_url": "https://example.org/smoke-stage18",
            "governance_status": "draft",
            "last_modified_by": admin_user_id,
            "change_note": "stage18 smoke create draft",
            "version": "v1",
            "auto_update_allowed": False,
        }

        create_resp = client.post("/knowledge/rules", headers=headers, json=create_payload)
        _assert_status(create_resp, 200, context="POST /knowledge/rules create draft")
        created = create_resp.json()
        created_rule_id = str(created.get("id") or "")
        if not created_rule_id:
            raise SystemExit("Create draft did not return rule id")
        if str(created.get("governance_status")) != "draft":
            raise SystemExit(f"Expected draft status after create, got {created.get('governance_status')}")
        print(f"ok: draft created rule_id={created_rule_id}")

        # 5a) Evaluator must not see draft/reviewed rule.
        before_resp = client.post("/knowledge/evaluate", headers=headers, json=_evaluate_payload(1200))
        _assert_status(before_resp, 200, context="POST /knowledge/evaluate before approval")
        before_rules = before_resp.json().get("matched_rules", [])
        if any(str(item.get("rule_key")) == rule_key for item in before_rules):
            raise SystemExit("Evaluator matched draft rule before approval (should only match active)")
        print("ok: evaluator ignores non-active rule before approval")

        # 4a) submit review
        submit_payload = {
            "last_modified_by": admin_user_id,
            "change_note": "stage18 smoke submit review",
        }
        submit_resp = client.post(
            f"/knowledge/rules/{created_rule_id}/submit-review",
            headers=headers,
            json=submit_payload,
        )
        _assert_status(submit_resp, 200, context="POST submit-review")
        submitted = submit_resp.json()
        if str(submitted.get("governance_status")) != "reviewed":
            raise SystemExit(f"Expected reviewed after submit-review, got {submitted.get('governance_status')}")
        print("ok: submit-review")

        # 4b) approve
        approve_payload = {
            "medical_reviewed_by": admin_user_id,
            "medical_reviewed_at": _iso_now(),
            "change_note": "stage18 smoke approve",
        }
        approve_resp = client.post(
            f"/knowledge/rules/{created_rule_id}/approve",
            headers=headers,
            json=approve_payload,
        )
        _assert_status(approve_resp, 200, context="POST approve")
        approved_data = approve_resp.json()
        if str(approved_data.get("governance_status")) != "active":
            raise SystemExit(f"Expected active after approve, got {approved_data.get('governance_status')}")
        approved = True
        print("ok: approve")

        # 5b) Evaluator must now see newly active rule.
        after_resp = client.post("/knowledge/evaluate", headers=headers, json=_evaluate_payload(1200))
        _assert_status(after_resp, 200, context="POST /knowledge/evaluate after approval")
        after_rules = after_resp.json().get("matched_rules", [])
        if not any(str(item.get("rule_key")) == rule_key for item in after_rules):
            raise SystemExit("Evaluator did not match active rule after approval")
        print("ok: evaluator sees active rule after approval")

        # Optional cleanup: deprecate temporary rule so staging state stays clean.
        if approved and created_rule_id:
            dep_payload = {
                "last_modified_by": admin_user_id,
                "change_note": "stage18 smoke cleanup deprecate temp rule",
            }
            dep_resp = client.post(
                f"/knowledge/rules/{created_rule_id}/deprecate",
                headers=headers,
                json=dep_payload,
            )
            _assert_status(dep_resp, 200, context="POST deprecate cleanup")
            print("ok: cleanup deprecate temporary rule")

    print("PASS: Stage 18 staging knowledge smoke completed")


if __name__ == "__main__":
    main()
