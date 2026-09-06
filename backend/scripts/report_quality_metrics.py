"""Report-quality metric: real-LLM vs local-fallback rate across generated reports.

The pipeline (app/services/ai_orchestrator.py -> app/services/ai/openai_service.py
-> app/services/claude_service.py) already tags every report with
`analysis_source` ("llm" or "fallback") and this IS durably persisted today —
nested at report_versions.input_snapshot.ai_orchestration.metadata.analysis_source
for every row. Nothing reads it back in aggregate, so the actual fallback rate
has been invisible in practice. This script is that missing read side: no
schema change, no new write path — just makes the existing signal queryable.

Usage:
    python3 scripts/report_quality_metrics.py [--days 30] [--json]
"""
import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.supabase_service import _get_supabase  # noqa: E402


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=30, help="Look back this many days (default 30).")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON instead of a text summary.")
    return parser


def compute_metrics(days: int) -> dict:
    supabase = _get_supabase()
    resp = supabase.table("report_versions").select("created_at,input_snapshot,status").execute()
    rows = resp.data or []

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    in_window = []
    for row in rows:
        created_at = row.get("created_at")
        try:
            created_dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            continue
        if created_dt >= cutoff:
            in_window.append(row)

    def source_of(row: dict) -> str:
        snapshot = row.get("input_snapshot") or {}
        meta = (snapshot.get("ai_orchestration") or {}).get("metadata") or {}
        return meta.get("analysis_source") or "unknown"

    all_time_counts = Counter(source_of(r) for r in rows)
    window_counts = Counter(source_of(r) for r in in_window)
    status_counts = Counter(r.get("status") or "unknown" for r in in_window)

    def rate(counts: Counter) -> dict:
        total = sum(counts.values())
        if total == 0:
            return {"total": 0, "llm_pct": None, "fallback_pct": None, "counts": dict(counts)}
        return {
            "total": total,
            "llm_pct": round(100 * counts.get("llm", 0) / total, 1),
            "fallback_pct": round(100 * counts.get("fallback", 0) / total, 1),
            "counts": dict(counts),
        }

    return {
        "window_days": days,
        "all_time": rate(all_time_counts),
        "window": rate(window_counts),
        "window_status_breakdown": dict(status_counts),
    }


def main() -> None:
    args = _build_parser().parse_args()
    metrics = compute_metrics(args.days)

    if args.json:
        print(json.dumps(metrics, indent=2))
        return

    print(f"Report quality — last {metrics['window_days']} days")
    print("-" * 40)
    w = metrics["window"]
    if w["total"] == 0:
        print("No reports generated in this window.")
    else:
        print(f"Reports: {w['total']}")
        print(f"  Real LLM:      {w['llm_pct']}%  ({w['counts'].get('llm', 0)})")
        print(f"  Local fallback: {w['fallback_pct']}%  ({w['counts'].get('fallback', 0)})")
        unknown = w["counts"].get("unknown", 0)
        if unknown:
            print(f"  Unknown (pre-instrumentation rows): {unknown}")
        print(f"  Status breakdown: {metrics['window_status_breakdown']}")

    a = metrics["all_time"]
    print()
    print(f"All-time: {a['total']} reports, {a['llm_pct']}% LLM / {a['fallback_pct']}% fallback")


if __name__ == "__main__":
    main()
