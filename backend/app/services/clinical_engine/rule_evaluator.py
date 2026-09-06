"""Детерминированный оценщик KB-правил.

Делегирует в knowledge/evaluator.evaluate_input_with_rules() (который
владеет деревом условий, evidence, unevaluated_markers), но импортирует
unit-логику из единого units.py.

Этот модуль — чистая обёртка:  evaluate_rules() принимает lab_results dict
и правила, возвращает результат с matched_rules + marker_coverage.
Async-часть (загрузка правил из Supabase, persist) живёт в
knowledge/evaluator.evaluate_health_input() и вызывается оркестратором,
а не этим модулем.
"""

from __future__ import annotations

from typing import Any, Dict, List

from app.services.knowledge.evaluator import evaluate_input_with_rules


def evaluate_rules(
    lab_results: Dict[str, Dict[str, Any]],
    symptoms: list[str],
    rules: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Оценить правила KB на наборе лаб-результатов.

    Чистая, синхронная, детерминированная функция.
    Возвращает dict с ключами:
      matched_rules, recommendation_keys, requires_doctor, max_confidence,
      source_references, unevaluated_markers, marker_coverage
    """
    input_data = {
        "lab_results": lab_results,
        "symptoms": symptoms,
    }
    return evaluate_input_with_rules(input_data, rules)
