import json
import os
import sys

import requests


def main() -> int:
    analyze_url = os.getenv("SMOKE_ANALYZE_URL", "https://vitaloop.today/api/v1/analyze")
    access_token = os.getenv("SMOKE_BEARER_TOKEN", "").strip()

    if not access_token:
        print("SMOKE_BEARER_TOKEN is required")
        return 2

    extracted_text = (
        "Complete blood count: WBC 5.5 x10^9/L, Hemoglobin 13.8 g/dL, "
        "Platelets 240 x10^9/L, Vitamin D 20 ng/mL"
    )
    payload = {
        "extracted_text": extracted_text,
        "lab_name": "Smoke Test Lab",
        "test_date": "2026-04-30",
        "symptoms": ["fatigue"],
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    print(f"Sending request to {analyze_url}")
    response = requests.post(analyze_url, headers=headers, json=payload, timeout=60)

    print(f"Status Code: {response.status_code}")
    print("Response Body:")
    try:
        body = response.json()
        print(json.dumps(body, indent=2, ensure_ascii=True))
    except json.JSONDecodeError:
        print(response.text)
        body = {}

    if response.status_code == 200 and body.get("upload_id"):
        print("\nSmoke test PASSED")
        return 0

    print("\nSmoke test FAILED")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
