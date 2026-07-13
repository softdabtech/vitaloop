from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict

_cost_counters: dict[tuple[str, str], float] = defaultdict(float)


def _label(value: Any, *, fallback: str = "unknown") -> str:
    text = str(value or "").strip()
    return text or fallback


def record_analysis_cost(
    *,
    source: str,
    cost_metadata: Dict[str, Any] | None,
    analysis_id: str | None = None,
    locale: str | None = None,
) -> None:
    metadata = cost_metadata or {}
    source_label = _label(source)
    locale_label = _label(locale, fallback="unset")
    model_label = _label(metadata.get("model"))
    estimated_label = "true" if metadata.get("estimated", True) else "false"

    prompt_tokens = float(metadata.get("ai_prompt_tokens") or 0)
    completion_tokens = float(metadata.get("ai_completion_tokens") or 0)
    total_tokens = float(metadata.get("ai_total_tokens") or (prompt_tokens + completion_tokens))
    estimated_cost = float(metadata.get("estimated_cost_usd") or 0)

    labels = f'source="{source_label}",locale="{locale_label}",model="{model_label}",estimated="{estimated_label}"'
    _cost_counters[("analyses_total", labels)] += 1
    _cost_counters[("prompt_tokens_total", labels)] += prompt_tokens
    _cost_counters[("completion_tokens_total", labels)] += completion_tokens
    _cost_counters[("tokens_total", labels)] += total_tokens
    _cost_counters[("estimated_cost_usd_total", labels)] += estimated_cost

    if analysis_id:
        last_labels = f'analysis_id="{_label(analysis_id)}",source="{source_label}",locale="{locale_label}",model="{model_label}",estimated="{estimated_label}"'
        _cost_counters[("last_analysis_estimated_cost_usd", last_labels)] = estimated_cost


def render_cost_metrics() -> str:
    lines = [
        "# HELP vitaloop_analysis_cost_analyses_total Analysis count by source, locale, model, and estimated flag.",
        "# TYPE vitaloop_analysis_cost_analyses_total counter",
    ]
    for (metric, labels), value in sorted(_cost_counters.items()):
        if metric == "analyses_total":
            lines.append(f"vitaloop_analysis_cost_analyses_total{{{labels}}} {int(value)}")

    lines.extend(
        [
            "# HELP vitaloop_analysis_cost_tokens_total Estimated or exact total LLM tokens by source, locale, and model.",
            "# TYPE vitaloop_analysis_cost_tokens_total counter",
        ]
    )
    for (metric, labels), value in sorted(_cost_counters.items()):
        if metric == "tokens_total":
            lines.append(f"vitaloop_analysis_cost_tokens_total{{{labels}}} {int(value)}")

    lines.extend(
        [
            "# HELP vitaloop_analysis_cost_prompt_tokens_total Estimated or exact prompt tokens by source, locale, and model.",
            "# TYPE vitaloop_analysis_cost_prompt_tokens_total counter",
        ]
    )
    for (metric, labels), value in sorted(_cost_counters.items()):
        if metric == "prompt_tokens_total":
            lines.append(f"vitaloop_analysis_cost_prompt_tokens_total{{{labels}}} {int(value)}")

    lines.extend(
        [
            "# HELP vitaloop_analysis_cost_completion_tokens_total Estimated or exact completion tokens by source, locale, and model.",
            "# TYPE vitaloop_analysis_cost_completion_tokens_total counter",
        ]
    )
    for (metric, labels), value in sorted(_cost_counters.items()):
        if metric == "completion_tokens_total":
            lines.append(f"vitaloop_analysis_cost_completion_tokens_total{{{labels}}} {int(value)}")

    lines.extend(
        [
            "# HELP vitaloop_analysis_cost_estimated_usd_total Estimated or exact LLM cost in USD by source, locale, and model.",
            "# TYPE vitaloop_analysis_cost_estimated_usd_total counter",
        ]
    )
    for (metric, labels), value in sorted(_cost_counters.items()):
        if metric == "estimated_cost_usd_total":
            lines.append(f"vitaloop_analysis_cost_estimated_usd_total{{{labels}}} {value:.6f}")

    lines.extend(
        [
            "# HELP vitaloop_analysis_cost_last_analysis_estimated_usd Last analysis estimated or exact cost by analysis id.",
            "# TYPE vitaloop_analysis_cost_last_analysis_estimated_usd gauge",
        ]
    )
    for (metric, labels), value in sorted(_cost_counters.items()):
        if metric == "last_analysis_estimated_cost_usd":
            lines.append(f"vitaloop_analysis_cost_last_analysis_estimated_usd{{{labels}}} {value:.6f}")

    return "\n".join(lines) + "\n"
