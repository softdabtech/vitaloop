#!/usr/bin/env python3
"""Full HTTP smoke test for Partner Layer against staging backend.

Required env:
  PARTNER_SMOKE_BASE_URL
  PARTNER_SMOKE_API_KEY

Optional env:
  PARTNER_SMOKE_PARTNER_SLUG (default: smartlab)
"""

from __future__ import annotations

import os
import time
import uuid

import httpx


BASE_URL = os.getenv("PARTNER_SMOKE_BASE_URL", "").rstrip("/")
API_KEY = os.getenv("PARTNER_SMOKE_API_KEY", "")
PARTNER_SLUG = os.getenv("PARTNER_SMOKE_PARTNER_SLUG", "smartlab")


def _require_env() -> None:
    missing = []
    if not BASE_URL:
        missing.append("PARTNER_SMOKE_BASE_URL")
    if not API_KEY:
        missing.append("PARTNER_SMOKE_API_KEY")
    if missing:
        raise SystemExit(f"Missing required env vars: {', '.join(missing)}")


def _headers() -> dict:
    return {
        "X-Partner-Api-Key": API_KEY,
        "Content-Type": "application/json",
    }


def main() -> None:
    _require_env()

    uniq = str(uuid.uuid4())[:8]
    external_patient_id = f"SMOKE-PAT-{uniq}"
    external_order_id = f"SMOKE-ORD-{uniq}"
    external_result_id = f"SMOKE-RES-{uniq}"

    ingest_payload = {
        "partner_slug": PARTNER_SLUG,
        "external_patient_id": external_patient_id,
        "external_order_id": external_order_id,
        "external_result_id": external_result_id,
        "lab_name": "smartlab",
        "lab_result": {
            "biomarkers": [
                {"name": "Vitamin D", "value": 21.0, "unit": "ng/mL", "ref_low": 30, "ref_high": 100},
                {"name": "Glucose", "value": 92, "unit": "mg/dL", "ref_low": 70, "ref_high": 99},
            ]
        },
    }

    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        # 1) ingest
        ingest = client.post("/partners/v1/results", headers=_headers(), json=ingest_payload)
        ingest.raise_for_status()
        ingest_data = ingest.json()
        partner_lab_result_id = ingest_data["partner_lab_result_id"]
        print("ingest.status=", ingest_data.get("status"))
        print("partner_lab_result_id=", partner_lab_result_id)

        # 2) get insight
        insight = client.get(
            f"/partners/v1/results/{partner_lab_result_id}/insights",
            headers=_headers(),
        )
        insight.raise_for_status()
        insight_data = insight.json()
        assert "summary" in insight_data and "health_score" in insight_data
        print("insight.health_score=", insight_data.get("health_score"))

        # 3) create embedded session
        embedded_session = client.post(
            "/partners/v1/embedded-sessions",
            headers=_headers(),
            json={
                "partner_patient_id": external_patient_id,
                "partner_lab_result_id": partner_lab_result_id,
                "ttl_seconds": 900,
            },
        )
        embedded_session.raise_for_status()
        embedded_data = embedded_session.json()
        token = embedded_data["token"]
        print("embedded.expires_at=", embedded_data.get("expires_at"))

        # 4) open embedded endpoint
        embedded = client.get(
            f"/partners/embed/{token}",
            headers={"X-Partner-Context": "smartlab-smoke"},
        )
        embedded.raise_for_status()
        embedded_payload = embedded.json()
        assert "biomarkers" in embedded_payload
        print("embedded.biomarkers=", len(embedded_payload.get("biomarkers", [])))

        # 5) partner event
        event_resp = client.post(
            "/partners/v1/events",
            headers=_headers(),
            json={
                "event_type": "recommendation_clicked",
                "partner_lab_result_id": partner_lab_result_id,
                "event_payload": {"cta": "view_protocol", "ts": int(time.time())},
            },
        )
        event_resp.raise_for_status()
        print("events.partner.ok=", event_resp.json().get("ok"))

        # 6) embedded event
        embedded_event_resp = client.post(
            "/partners/v1/embedded/events",
            headers={"X-Embedded-Token": token, "Content-Type": "application/json"},
            json={
                "event_type": "order_completed",
                "event_payload": {"order_ref": f"SMOKE-{uniq}"},
            },
        )
        embedded_event_resp.raise_for_status()
        print("events.embedded.ok=", embedded_event_resp.json().get("ok"))

    print("Partner HTTP smoke flow passed")


if __name__ == "__main__":
    main()
