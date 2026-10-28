"""Low-cardinality, symptom-content-free operational metrics."""

from __future__ import annotations

from collections import defaultdict
from threading import Lock


_lock = Lock()
_counters: dict[tuple[str, tuple[tuple[str, str], ...]], float] = defaultdict(float)
_question_buckets = (1, 3, 5, 10, 20, 30)


def _labels(**labels: object) -> tuple[tuple[str, str], ...]:
    return tuple(sorted((key, str(value or "unknown")) for key, value in labels.items()))


def _inc(metric: str, value: float = 1, **labels: object) -> None:
    with _lock:
        _counters[(metric, _labels(**labels))] += value


def record_provider_call(*, endpoint: str, status: int | None, duration_seconds: float) -> None:
    status_label = str(status) if status is not None else "unknown"
    _inc("infermedica_requests_total", endpoint=endpoint, status=status_label)
    _inc("infermedica_request_duration_seconds_sum", duration_seconds, endpoint=endpoint)
    _inc("infermedica_request_duration_seconds_count", endpoint=endpoint)


def record_provider_error(*, error_type: str) -> None:
    _inc("infermedica_errors_total", type=error_type)


def record_mapping_miss(*, model: str) -> None:
    _inc("symptom_mapping_miss_total", model=model)


def record_lab_analysis_snapshot(
    *, source: str, snapshot: dict[str, object] | None
) -> None:
    normalized_source = str(source or "unknown").strip().lower()
    allowed = {
        "b2c_file",
        "b2c_text",
        "b2c_manual",
        "legacy_multipart_pdf",
        "candidate_confirmation",
        "report_regeneration",
    }
    source_label = normalized_source if normalized_source in allowed else "other"
    _inc(
        "lab_analyses_with_symptom_snapshot_total",
        source=source_label,
        present="true" if snapshot else "false",
    )
    evidence = snapshot.get("evidence") if isinstance(snapshot, dict) else {}
    for choice in ("present", "absent", "unknown"):
        values = evidence.get(choice) if isinstance(evidence, dict) else []
        _inc("symptom_snapshot_evidence_count_sum", len(values or []), choice=choice)
        _inc("symptom_snapshot_evidence_count_count", choice=choice)


def record_session_terminal(
    *, status: str, locale: str, safety_level: str | None, question_count: int
) -> None:
    _inc("symptom_check_sessions_total", status=status, locale=locale)
    if safety_level:
        _inc("symptom_check_triage_total", level=safety_level)
    for bucket in _question_buckets:
        if question_count <= bucket:
            _inc("symptom_check_questions_count_bucket", locale=locale, le=bucket)
    _inc("symptom_check_questions_count_bucket", locale=locale, le="+Inf")
    _inc("symptom_check_questions_count_sum", question_count, locale=locale)
    _inc("symptom_check_questions_count_count", locale=locale)


def render_symptom_metrics() -> str:
    help_lines = [
        "# HELP infermedica_requests_total Infermedica calls by endpoint and normalized HTTP status.",
        "# TYPE infermedica_requests_total counter",
        "# HELP infermedica_request_duration_seconds Provider call duration summary.",
        "# TYPE infermedica_request_duration_seconds summary",
        "# HELP infermedica_errors_total Infermedica errors by normalized type.",
        "# TYPE infermedica_errors_total counter",
        "# HELP symptom_mapping_miss_total Missing approved concept mappings by provider model.",
        "# TYPE symptom_mapping_miss_total counter",
        "# HELP symptom_check_sessions_total Terminal symptom-check sessions by state and locale.",
        "# TYPE symptom_check_sessions_total counter",
        "# HELP symptom_check_triage_total Terminal normalized safety levels.",
        "# TYPE symptom_check_triage_total counter",
        "# HELP symptom_check_questions_count Number of controlled adaptive questions per terminal session.",
        "# TYPE symptom_check_questions_count histogram",
        "# HELP symptom_check_completion_rate Completed fraction of terminal symptom sessions by locale.",
        "# TYPE symptom_check_completion_rate gauge",
        "# HELP lab_analyses_with_symptom_snapshot_total Finalized B2C analyses by snapshot presence.",
        "# TYPE lab_analyses_with_symptom_snapshot_total counter",
        "# HELP symptom_snapshot_evidence_count Evidence count per finalized snapshot and controlled choice.",
        "# TYPE symptom_snapshot_evidence_count summary",
    ]
    with _lock:
        snapshot = sorted(_counters.items())
    for (metric, labels), value in snapshot:
        label_text = ",".join(f'{key}="{label}"' for key, label in labels)
        suffix = f"{{{label_text}}}" if label_text else ""
        rendered = int(value) if float(value).is_integer() else f"{value:.6f}"
        help_lines.append(f"{metric}{suffix} {rendered}")
    session_counts: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for (metric, labels), value in snapshot:
        if metric != "symptom_check_sessions_total":
            continue
        label_map = dict(labels)
        session_counts[label_map.get("locale", "unknown")][label_map.get("status", "unknown")] += value
    for locale, counts in sorted(session_counts.items()):
        total = sum(counts.values())
        rate = counts.get("completed", 0.0) / total if total else 0.0
        help_lines.append(f'symptom_check_completion_rate{{locale="{locale}"}} {rate:.6f}')
    return "\n".join(help_lines) + "\n"


def _reset_symptom_metrics_for_tests() -> None:
    with _lock:
        _counters.clear()
