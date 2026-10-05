# P5 — смысловые acceptance criteria

Начало: 2026-10-05  
Завершение: 2026-10-05  
Статус: **DONE — критерии реализованы, протестированы и развёрнуты в production**

## Цель

Закрыт раздел `Structure.md` «P5. Ввести смысловые acceptance criteria». Теперь каждый новый отчёт получает отдельный immutable-контракт `semantic_acceptance_v1`. Он проверяет полезность результата, а не только наличие JSON-полей.

Отчёт не проходит Definition of Done, если хотя бы один применимый критерий имеет статус `fail`.

## Реализованные критерии

| Критерий | Что проверяется | Статус |
|---|---|---|
| `report_specific_conclusion` | Главный вывод называет evidence текущего отчёта | DONE |
| `symptom_check_effect` | Завершённый symptom-check изменил приоритет или объяснение и сохранил evidence-link | DONE |
| `concrete_value_links` | Пользовательские утверждения связаны с измеренным значением biomarker | DONE |
| `report_specific_actions` | Есть хотя бы одно конкретное evidence-linked действие; одних wellness-фраз недостаточно | DONE |
| `action_priority_clarity` | Понятны порядок, timing, priority или ответственная роль | DONE |
| `user_facing_language` | В пользовательский текст не попадают внутренние названия движка | DONE |
| `ai_fallback_disclosure` | Deterministic fallback явно отмечен вместе с причиной | DONE |
| `safety_reason_specificity` | Safety-предупреждение связано с конкретным событием и элементом отчёта | DONE |

Каждый критерий возвращает `pass`, `fail` или `not_applicable`, стабильный code, пользовательское объяснение и минимальное evidence. Общий контракт содержит `passes_dod`, список failures и счётчики.

## Backend и persistence

- Добавлен детерминированный builder `backend/app/services/semantic_acceptance.py`.
- P5 запускается после P1 Case Synthesis и P3 Grounded AI Narrative.
- Версия сохраняется в `version_provenance.semantic_acceptance_version`.
- Полный результат сохраняется verbatim в `report_versions.input_snapshot`.
- Frozen history возвращает исходный P5-контракт без пересчёта новыми правилами.
- Контракт доступен top-level и внутри `final_analysis` в analyze, regenerate и compatibility results API.
- Старые report versions без P5 остаются читаемыми и возвращают `null`.
- Добавлен read-only audit `backend/scripts/audit_semantic_acceptance.py`, который проверяет структуру, статусы, failure list и точную воспроизводимость frozen результата.

## Пользовательский результат

- Внутренние фразы про stable concepts, domain links и hypotheses заменены пользовательскими объяснениями.
- Если P3 использовал deterministic fallback, первый пользовательский блок показывает заметную карточку `AI fallback` и объясняет, что вывод собран из проверенных данных отчёта.
- Safety-блок предпочитает конкретное событие с названием показателя, значением и единицей измерения.
- Срочный флаг symptom-check теперь создаёт отдельное critical safety event с источником и названием основного симптома; предупреждение больше не остаётся без причины.
- Технические модули остаются внутри закрытого раздела «Why the system reached this conclusion».

## Автоматические проверки

- P1–P5 targeted backend suite: **48 passed**.
- Полный backend regression suite: **1590 passed, 20 skipped, 0 failed**.
- Frontend adapter: **9 passed**.
- ESLint изменённых frontend-файлов: **PASS**.
- Frontend production build вместе с PWA service worker: **PASS**.
- `py_compile`: **PASS**.
- `git diff --check`: **PASS**.

Backend suite выполнялся с пустыми Supabase-переменными, поэтому тестовые fixtures не обращались к production database.

## Production deployment

- Implementation commit: `1a61d35ca8c0dc10c57685a82a94964160ac0a4a`.
- GitHub `main`: **PASS**.
- Серверный checkout обновлён fast-forward: **PASS**.
- Backup branch: `backup-p5-before-semantic-20261005101038`.
- Backend и frontend собраны с `--no-cache` и пересозданы: **PASS**.
- Оба контейнера после запуска: `healthy`.
- Public API `/health`: **200**.
- Public API `/health/ready`: `ready=true`.
- Public frontend: **200**; опубликованный build-info указывает на P5 commit.

## Production smoke на аккаунте Светланы

Проверен указанный владельцем проекта аккаунт. Учётные данные, user ID, upload ID и report version ID в отчёт не записывались.

### API и frozen persistence

- Авторизация: **PASS**.
- Найден и регенерирован полный кейс с 14 biomarkers.
- Создана ровно одна новая immutable report version.
- `semantic_acceptance_v1` сохранён и возвращён: **PASS**.
- Все 8 criteria присутствуют: **PASS**.
- Top-level alias и `final_analysis` идентичны: **PASS**.
- `GET /analyze/{upload}` и `GET /results/{upload}` возвращают один frozen-контракт: **PASS**.
- Структурная и воспроизводимая часть read-only P5 audit: **PASS**, технический список audit failures пуст.

Реальный отчёт получил **7 pass / 1 fail / 0 not applicable**:

- report-specific conclusion: pass;
- concrete value links: pass;
- report-specific actions: pass;
- action priority: pass;
- user-facing language: pass;
- AI fallback disclosure: pass;
- safety reason specificity: pass;
- symptom-check effect: **fail — `symptom_check_no_result_effect`**.

Причина последнего результата проверена: сохранённый legacy symptom answer не сопоставлен со stable clinical symptom concept (`no_mapped_concepts`), поэтому он не может безопасно менять медицинский вывод. P5 корректно оставляет `passes_dod=false`. Этот факт подтверждает работу acceptance gate: отчёт с присутствующим, но не влияющим symptom-check больше не получает ложный зелёный статус. Данные пользователя не переписывались и нерелевантный ответ не был искусственно превращён в симптом.

В этом же кейсе P3 использовал `deterministic_fallback`; marker и reason присутствуют, поэтому fallback-критерий прошёл. Срочное safety-предупреждение содержит отдельное report-specific event, поэтому safety-критерий также прошёл.

### Browser smoke

- Вход через production UI: **PASS**.
- Полный 14-marker Results route открыт: **PASS**.
- Все пять пользовательских P4-секций видимы: **PASS**.
- Карточка AI fallback видима и содержит объяснение verified-data fallback: **PASS**.
- Конкретная safety-причина видима: **PASS**.
- Технический disclosure закрыт по умолчанию: **PASS**.
- Browser/page errors: **0**.

## Итог

Все восемь требований P5 реализованы как единый версионированный semantic Definition of Done, сохранены во frozen report и проверены на API и UI. Положительные, отрицательные и backward-compatible сценарии покрыты тестами. Реальный аккаунт подтвердил и семь успешных критериев, и главное поведение P5: отчёт с symptom-check без доказанного влияния остаётся заблокированным по DoD.

P6 не начинался.
