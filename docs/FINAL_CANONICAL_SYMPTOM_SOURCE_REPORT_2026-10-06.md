# Финальный этап — новый Symptom Checker как единый источник данных

Дата проверки: 2026-10-06  
Проект: VITALOOP EN  
Production commit: `4a317efad826b4afb5cdce3bef585582c67b4b79`  
Статус реализации: **DONE**  
Статус персонального acceptance на аккаунте Светланы: **BLOCKED — новый Symptom Checker ещё не завершён пользователем**

## Цель

Все B2C-выводы должны зависеть от одного завершённого нового Symptom Checker. Старые свободные строки, незавершённая legacy-анкета и переданные клиентом симптомы больше не могут незаметно влиять на отчёт, Case Synthesis, narrative, safety, dashboard или onboarding.

## Единая цепочка данных

```text
New Symptom Checker
  ├─ provider structured session
  └─ controlled fallback with stable concept IDs
              ↓
eligible immutable symptom_snapshot
              ↓
lab analysis input snapshot
              ↓
symptom analysis → Case Synthesis → grounded narrative → result screen
              ↓
immutable report version + semantic acceptance + dashboard/onboarding
```

В цепочку допускается только завершённая структурированная сессия:

- provider session со статусом `completed`, стабильными concept IDs и сохранённым evidence;
- новый controlled fallback со схемой `controlled_symptom_fallback_v1`, режимом `controlled_only`, валидными enum-ответами и стабильными concept IDs;
- если такой сессии нет, `symptom_snapshot=null`, а система явно считает симптомный контекст отсутствующим;
- unstructured legacy questionnaire отклоняется и не преобразуется в фиктивные symptom IDs.

## Реализованные гарантии

1. Для всех B2C-входов pipeline самостоятельно загружает последний допустимый snapshot пользователя.
2. `symptoms`, `questionnaire` и `symptom_context`, переданные B2C-клиентом, не смешиваются с каноническим источником.
3. Upload, text input, candidate review/confirmation, прямое создание protocol, results read, compatibility read и regeneration используют одинаковое правило источника.
4. Snapshot сохраняется в immutable report version; последующее изменение symptom checker не переписывает старый отчёт.
5. `source_type` и `symptom_snapshot_version` входят в metadata/provenance.
6. Dashboard получает symptom state из `summary.blocks.latest_questionnaire.symptom_snapshot` и больше не выполняет отдельный legacy-запрос `/questionnaire/session`.
7. Onboarding считает questionnaire завершённым только при наличии допустимого канонического snapshot.
8. Cache dashboard сбрасывается после завершения symptom checker.
9. Quality gate учитывает snapshot как реальный symptom context.
10. Semantic acceptance требует, чтобы mapped symptom concepts влияли на результат; `no_mapped_concepts` больше не маскирует дефект как `N/A`.
11. B2B и offline-анализы сохраняют свои явно переданные симптомы и не подменяются B2C snapshot.

## Соответствие финальному приоритету

| Этап | Результат |
|---|---|
| 1. Аудит последнего реального аккаунта | DONE: состояние Светланы проверено read-only |
| 2. Case Synthesis contract | DONE: получает симптомы только из canonical snapshot |
| 3. Пересчёт отчёта с symptom snapshot | READY: код готов; персональный пересчёт ожидает реальные ответы Светланы |
| 4. Grounded AI narrative и fallback | DONE: работают на том же snapshot; legacy context исключён |
| 5. Новый экран результата | DONE: dashboard/result chain использует сохранённый snapshot |
| 6. Смысловые E2E и эталонная матрица | DONE: canonical, legacy-rejection и safety-сценарии зелёные |
| 7. Shadow и production rollout | DONE: релиз собран, развёрнут и проверен |

## Проверки до production rollout

Backend full suite:

```text
1578 passed, 20 skipped, 0 failed
```

Целевые backend-проверки canonical symptom flow:

```text
62 passed, 0 failed
```

Frontend:

```text
touched-files ESLint: PASS
production build: PASS
Symptom Checker Playwright: 9 passed
Dashboard semantic Playwright: 63/64 passed in batch;
the single loading-race scenario passed on isolated rerun
```

Проверено отдельными сценариями:

- structured snapshot отображается и влияет на результат;
- unstructured legacy answers игнорируются;
- safety state берётся из canonical snapshot;
- B2C request symptoms не обходят snapshot;
- controlled fallback принимает только закрытый контракт;
- B2B explicit symptoms сохранены;
- отсутствие нового checker остаётся явным отсутствием контекста.

## Production rollout

- создана серверная backup-ветка `backup-before-canonical-symptom-source-20261006061539`;
- `main` fast-forward обновлён до `4a317efad826b4afb5cdce3bef585582c67b4b79`;
- backend и frontend пересобраны и перезапущены;
- backend container: `healthy`;
- frontend container: `healthy`;
- `GET /health`: `200`;
- `GET /health/ready`: `200`, Supabase check `ok`;
- production frontend: `200`.

## Read-only smoke аккаунта Светланы

Авторизация пользователя и защищённые production API прошли. Персональные идентификаторы и медицинские значения в отчёт не выводились.

```text
/auth/me                         200
/auth/onboarding/state           200
/dashboard/summary               200
/symptom-check/sessions/current  404
/symptom-check/history           404
```

Фактическое состояние:

- 9 lab uploads доступны;
- latest lab result существует;
- latest ready report: `ready`;
- plan для ready report существует;
- canonical `latest_questionnaire`: отсутствует;
- canonical `symptom_snapshot`: отсутствует;
- `questionnaire_completed=false`;
- `first_health_loop_complete=false`;
- provider-backed checker недоступен в этой конфигурации, а новый controlled fallback ещё не завершён.

Это подтверждает основную защиту релиза: прежние legacy-ответы Светланы не были приняты за новый symptom snapshot. Production не показывает ложное состояние completed и не подмешивает старый контекст в новую цепочку.

## Единственный оставшийся блокер

Для финального персонального acceptance Светлана должна самостоятельно пройти текущий Symptom Checker с реальными ответами. После этого необходимо:

1. подтвердить `questionnaire_completed=true` и наличие `source_type`;
2. пересчитать её последний отчёт с новым immutable snapshot;
3. проверить, что session ID и provenance отчёта соответствуют завершённому checker;
4. повторить P0–P6 smoke одной цепочкой: snapshot → synthesis → narrative → result UI → semantic acceptance.

До получения реальных symptom answers пересчёт намеренно не запускался. Изменений медицинских данных аккаунта во время production smoke не выполнялось.
