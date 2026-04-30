#!/usr/bin/env python3
import argparse
import json
import mimetypes
import pathlib
import statistics
import time

import requests


def detect_content_type(path: pathlib.Path) -> str:
    ctype, _ = mimetypes.guess_type(str(path))
    return ctype or "application/octet-stream"


def run_one(base_url: str, path: pathlib.Path) -> dict:
    with path.open("rb") as f:
        files = {"file": (path.name, f, detect_content_type(path))}
        started = time.perf_counter()
        response = requests.post(f"{base_url.rstrip('/')}/api/v1/analyze", files=files, timeout=120)
        latency_ms = int((time.perf_counter() - started) * 1000)

    row = {
        "file": path.name,
        "status_code": response.status_code,
        "latency_ms": latency_ms,
        "ocr_chars": 0,
        "biomarkers": 0,
        "ok": False,
    }

    if response.status_code != 200:
        row["error"] = response.text[:240]
        return row

    payload = response.json()
    text = (payload.get("extracted_text") or "").strip()
    biomarkers = payload.get("biomarkers") or []

    row["ocr_chars"] = len(text)
    row["biomarkers"] = len(biomarkers)
    row["ok"] = len(text) >= 80 and len(biomarkers) >= 1
    return row


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark OCR extraction via analysis-service endpoint")
    parser.add_argument("--base-url", default="https://vitaloop.today", help="API public base URL")
    parser.add_argument("--fixtures", nargs="+", required=True, help="Paths/globs to fixture files")
    parser.add_argument("--json", dest="json_out", default="", help="Optional path to JSON output report")
    args = parser.parse_args()

    paths = []
    for item in args.fixtures:
        p = pathlib.Path(item)
        if any(ch in item for ch in "*?[]"):
            paths.extend(sorted(pathlib.Path().glob(item)))
        elif p.exists():
            paths.append(p)

    if not paths:
        print("No fixture files found")
        return 1

    rows = [run_one(args.base_url, path) for path in paths]

    ok_rows = [r for r in rows if r["ok"]]
    fail_rows = [r for r in rows if not r["ok"]]
    latencies = [r["latency_ms"] for r in rows if r["status_code"] == 200]

    print("OCR benchmark summary")
    print(f"total={len(rows)} ok={len(ok_rows)} fail={len(fail_rows)}")
    if latencies:
        print(f"latency_ms p50={int(statistics.median(latencies))} max={max(latencies)}")

    for row in rows:
        print(json.dumps(row, ensure_ascii=False))

    if args.json_out:
        out_path = pathlib.Path(args.json_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps({"rows": rows}, ensure_ascii=False, indent=2))
        print(f"report_written={out_path}")

    return 0 if not fail_rows else 2


if __name__ == "__main__":
    raise SystemExit(main())
