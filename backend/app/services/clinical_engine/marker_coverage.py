"""Marker coverage accounting.

Единая функция для классификации судьбы каждого маркера:
  - evaluated: правило KB покрывает маркер (может не сработать, но проверяет)
  - fired: правило KB покрывает И сработало
  - unit_blocked: правило есть, но юнит не совпал — маркер пропущен
  - no_matching_rule: ни одно правило KB не ссылается на маркер
  - unknown_status: маркер получил статус UNKNOWN (нет референса нигде)

Результат evaluate_input_with_rules() уже содержит первые 4 категории.
Этот модуль добавляет unknown_status из нормализованных биомаркеров.
"""

from __future__ import annotations

from typing import Any, Dict, List


def enrich_coverage(
    rule_coverage: Dict[str, Any],
    normalized_biomarkers: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Дополнить coverage из evaluator категорией unknown_status."""
    coverage = dict(rule_coverage)
    coverage["unknown_status"] = [
        bio["canonical_name"]
        for bio in normalized_biomarkers
        if bio.get("status") == "UNKNOWN"
    ]
    return coverage
