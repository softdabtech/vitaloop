# P0 — аудит реального пользовательского кейса

Дата проверки: 3 октября 2026 года. Проверка выполнена на неизменяемой версии последнего завершённого EN-отчёта, содержащего symptom snapshot. Production-записи не изменялись, отчёт не пересчитывался. Идентификаторы аккаунта и загрузки заменены необратимым fingerprint `5de30170879f`.

В production нет надёжного признака `test account`, поэтому кейс выбран по воспроизводимому критерию: самый новый завершённый EN `report_versions`, в котором сохранён symptom snapshot. Для конкретного известного тестового кейса скрипт также принимает `--upload-id`.

## Результат `вход → решение движка → API → UI`

| Этап | Фактический результат | Статус после P0 |
|---|---|---|
| Распознавание | 2 extraction candidates, оба подтверждены; в snapshot сохранены 2 маркера | DONE |
| Canonical ID | Creatinine → `canonical_creatinine`; TSH → `canonical_tsh`; 2/2 соответствуют текущему canonical mapping | DONE |
| Knowledge Base | Creatinine явно исключён из numeric KB evaluation как `OPTIMAL`; TSH оценён; сработавших маркеров и matched rules — 0; необъяснимо потерянных eligible-маркеров — 0 | DONE |
| Symptom snapshot | Snapshot с session ID, временем завершения, 5 структурированными evidence items и 5 полями assessment вошёл в отчёт и доступен через API | DONE |
| Паттерны | Построен `thyroid_dysfunction` | DONE |
| Гипотезы | Построена `Thyroid function pattern` | DONE |
| AI/fallback | AI не запускался и fallback не выдавался. Состояние явно сохранено: `status=skipped`, `reason=generate_ai_protocol_disabled` | DONE |
| Backend → API → UI | Persisted biomarkers, symptom snapshot, interpreted report, hypotheses, health states, trend, quality и metadata доступны в ожидаемой frontend-форме | DONE |

Нулевое число KB rules не означает отсутствие анализа: в этом кейсе отдельный deterministic pattern engine построил thyroid pattern и hypothesis. P0 теперь показывает это различие явно.

## Найденные и исправленные разрывы

1. Frozen API брал маркеры из legacy-таблицы `biomarkers`, где нет `canonical_name` и `reference_source`. Теперь завершённый отчёт возвращает неизменяемый список маркеров из `report_versions.input_snapshot`; старый список используется только для legacy-версий без snapshot.
2. `health_context`, `health_states`, `trend_analysis`, `quality_snapshot`, `ai_orchestration` и `cost_metadata` сохранялись движком, но терялись в frozen API. Теперь они возвращаются без пересчёта.
3. `GET /results/{upload_id}`, который вызывает Results.jsx, не возвращал `final_analysis` для frozen-отчёта. Из-за этого `AnalysisCoreV2Panel` не получал quality/domain/trend, даже когда они были рассчитаны. Общий assembler теперь формирует одинаковый контракт для обоих results endpoints.
4. Normal/неполные маркеры исключались перед KB и исчезали из `marker_coverage`. Теперь каждый такой маркер получает `ineligible_markers.reason`, а `marker_coverage.excluded` показывает исключение явно. Даже полностью нормальный набор возвращает явное нулевое KB-решение вместо `None`.
5. Для новых отчётов точный `metadata` envelope сохраняется вместе с версией. Для старых версий API совместимо восстанавливает только те metadata-поля, которые уже были сохранены в snapshot; клинический результат не пересчитывается.
6. Добавлен read-only скрипт `backend/scripts/audit_real_user_case.py`. Он не выводит email, user ID или upload ID, не запускает pipeline и может завершаться с ошибкой при любом незакрытом P0-разрыве.

## Smoke test P0

Команда проверки реального кейса:

```bash
python scripts/audit_real_user_case.py --upload-id "$UPLOAD_ID" --require-symptom --fail-on-gap
```

Результат:

```text
DONE  recognized_markers       2 persisted markers; 2 extraction candidates
DONE  canonical_ids            2/2 mapped consistently
DONE  knowledge_rules          eligible=1, excluded=1, fired=0, matched_rules=0
DONE  symptom_snapshot         present=True, evidence=5
DONE  patterns_and_hypotheses  patterns=1, hypotheses=1
DONE  ai_or_fallback           status=skipped, reason=generate_ai_protocol_disabled
DONE  backend_api_ui_transfer  no persisted fields lost
SMOKE PASS
```

Проверки кода выполнены в одноразовом контейнере на текущем production backend image с локальными P0-файлами, подключёнными read-only:

- 39/39 — P0, frozen report и compatibility contract;
- 119/120 — расширенный затронутый backend-контур до синхронизации старого source-contract теста;
- полный набор после запуска без production env: 1 503 passed, 20 skipped и 4 устаревших frontend source-contract expectations;
- эти четыре теста синхронизированы с фактическим серверным контрактом: `Progress.jsx` удалён, `/progress` перенаправляет в `/lab-results`, а текст `No urgent red flags reported.` допустим как ключ локализации реального backend-сигнала, но не как default banner.
- финальный полный прогон после синхронизации ожиданий: **1 507 passed, 20 skipped, 0 failed**.

Итог P0: все семь пунктов аудита имеют явное, воспроизводимое состояние; smoke реального кейса проходит.
