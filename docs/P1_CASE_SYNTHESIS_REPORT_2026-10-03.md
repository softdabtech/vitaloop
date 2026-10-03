# P1 — Единый Case Synthesis

Дата проверки: 2026-10-03  
Проект: VITALOOP EN  
Статус: **DONE — локальные фиксы и read-only production smoke прошли**

## Цель

Backend формирует один детерминированный итог анализа `case_synthesis`, который собирает уже рассчитанные факты и решения движка. Новый слой не вводит дополнительные клинические пороги и не ставит диагноз.

Каждое пользовательское утверждение содержит массив `evidence` минимум с одной конкретной ссылкой типа:

- `biomarker` — canonical ID, название, значение, единица, статус и доступность;
- `symptom` — стабильный нормализованный идентификатор и название;
- `profile` — поле профиля и признак `provided` или `missing`.

Утверждения без таких ссылок не включаются в synthesis.

## Реализованный контракт

| Требование из Structure.md | Поле `case_synthesis` | Результат |
|---|---|---|
| Главный вывод, 2–4 предложения | `main_conclusion` | DONE |
| Что обнаружено: показатели и сочетания | `what_was_found` | DONE |
| Связь с симптомами | `symptom_connections` | DONE |
| Наиболее вероятные объяснения без диагноза | `likely_explanations` | DONE |
| Противоречия и ограничения | `contradictions_and_limits` | DONE |
| Недостающие данные | `missing_information` | DONE |
| Что делать сейчас | `actions_now` | DONE |
| Что обсудить с врачом | `clinician_discussion` | DONE |
| Что и когда перепроверить | `retest_plan` | DONE |
| Evidence у каждого утверждения | `grounding` | DONE |

`grounding` содержит машинно-проверяемые поля:

- `policy=every_statement_references_biomarker_symptom_or_profile`;
- `statement_count`;
- `ungrounded_statement_count`;
- `all_statements_grounded`;
- `allowed_evidence_types`.

## Интеграция

1. `build_case_synthesis()` запускается после формирования паттернов, гипотез, калибровки confidence, противоречий, evidence gaps, role-based action plan и retest suggestions.
2. Live pipeline возвращает `case_synthesis` на верхнем уровне результата.
3. Точный объект сохраняется в immutable `report_versions.input_snapshot`.
4. Frozen API возвращает сохранённый объект без повторного расчёта.
5. Старые report versions возвращают `case_synthesis: null`; исторический результат не пересчитывается новыми правилами.
6. `version_provenance.case_synthesis_version` фиксирует `case_synthesis_v1`.
7. P0 transfer audit учитывает `case_synthesis` при проверке потерь между snapshot и API.

## Тестирование

Целевые тесты:

```text
9 passed
```

Проверено:

- наличие всех девяти секций;
- 2–4 элемента в `main_conclusion`;
- конкретные значения и единицы биомаркеров;
- связь симптома с marker pattern;
- non-diagnostic wording вероятных объяснений;
- ссылки на противоречащие показатели;
- явное обозначение отсутствующего маркера;
- конкретный срок повторной проверки;
- детерминированность и отсутствие мутации входных данных;
- отсутствие выдуманных утверждений при недостатке evidence;
- сохранение и выдача `case_synthesis` через frozen response;
- формирование контракта полным lab-analysis pipeline.

Полный backend suite:

```text
1512 passed, 20 skipped, 0 failed
```

## Read-only smoke на production snapshot

Аудит выполнен из изолированного контейнера на последнем завершённом EN report version с symptom snapshot. Production-код и данные не изменялись.

```text
P1 Case Synthesis audit 5de30170879f
synthesis=case_synthesis_v1 status=complete
main_conclusion              4
what_was_found               2
symptom_connections          5
likely_explanations          1
contradictions_and_limits    1
missing_information          7
actions_now                  2
clinician_discussion         4
retest_plan                  9
grounding statements=35 ungrounded=0
SMOKE PASS
```

Production-аудит не выводит account ID, user ID или upload ID; используется SHA-256 fingerprint.

## Изменённые компоненты

- `backend/app/services/case_synthesis.py` — единый контракт и grounding policy;
- `backend/app/services/lab_analysis_pipeline.py` — формирование, выдача, provenance и persistence;
- `backend/app/services/report_history.py` — immutable frozen read;
- `backend/app/services/real_case_audit.py` — контроль передачи нового поля;
- `backend/scripts/audit_case_synthesis.py` — read-only P1 smoke;
- `backend/tests/test_case_synthesis.py` — смысловые и контрактные тесты;
- интеграционные проверки pipeline и frozen response.

## Границы P1

P1 создаёт единый backend-контракт. Изменение приоритетов на основе stable symptom concept IDs относится к P2, grounded AI narrative — к P3, новый первый экран результата — к P4.
