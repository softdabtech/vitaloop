# P6 — проверка на эталонных сценариях

Начало: 2026-10-05  
Завершение: 2026-10-05  
Статус: **DONE — эталонная матрица, shadow-проверка, production rollout и единый пользовательский flow завершены**

## Цель

Закрыт раздел `Structure.md` «P6. Проверить на эталонных сценариях». Создана фиксированная матрица из 20 случаев. Для каждого случая заранее записан ожидаемый смысл результата: паттерны и их тяжесть, evidence главного вывода, влияние симптомов, safety-события, недостающие показатели, динамика, P5 acceptance и раскрытие fallback.

Проверка запускает полный `run_lab_analysis_pipeline`, поэтому оценивает общую цепочку P0–P5, а не отдельный helper или форму JSON.

## Эталонная матрица

| Категория | Кейсов | Покрытие |
|---|---:|---|
| Нормальные показатели | 1 | стабильная панель без ложных паттернов |
| Одиночное отклонение | 2 | низкий ferritin, высокий LDL |
| Несколько связанных отклонений | 7 | iron/anemia, metabolic, inflammation, thyroid, micronutrients, liver, kidney/electrolytes |
| Симптом подтверждает паттерн | 1 | fatigue усиливает подтверждённый iron-pattern |
| Симптом противоречит паттерну | 1 | отсутствие joint pain снижает приоритет inflammation-pattern |
| Недостаточно показателей | 2 | unmapped symptom без ложного влияния, ограниченная iron-панель |
| Safety | 3 | критическая glucose, критический potassium, urgent symptom |
| Повторный анализ и динамика | 3 | ferritin improving, LDL worsening, hemoglobin stable с нормализацией единиц |
| **Всего** | **20** | **все обязательные классы P6** |

Fixtures хранятся в `backend/tests/fixtures/p6_reference_scenarios.json`. Meaning-level validator находится в `backend/app/services/reference_scenario_audit.py`; CLI-аудит — в `backend/scripts/audit_reference_scenarios.py`; полный pipeline-test — в `backend/tests/test_p6_reference_scenarios.py`.

## Что проверяет каждый кейс

- pipeline завершён;
- Case Synthesis имеет статус `complete` и не содержит незаземлённых утверждений;
- обязательные паттерны присутствуют, запрещённые отсутствуют, severity совпадает;
- главный вывод ссылается на заранее указанные наблюдаемые biomarkers;
- symptom status, stable concept, изменение вывода и эффект соответствуют ожидаемому смыслу;
- urgent flag и конкретные safety events совпадают с ожиданием;
- evidence gaps содержат ожидаемые недостающие markers;
- направление динамики соответствует повторному анализу;
- точный набор P5 pass/fail совпадает с fixture;
- deterministic fallback всегда содержит marker и причину.

## Фиксы, найденные матрицей

Первый полноценный shadow-run обнаружил две общие смысловые потери. Они исправлены до production rollout:

1. Отсутствующий, но сопоставленный stable symptom теперь создаёт evidence-linked объяснение `domain_weakened`: пользователю явно сообщается, почему приоритет паттерна снижен.
2. Завершённый отчёт без действия, созданного конкретным паттерном, теперь получает report-specific fallback action. Для отклонения действие ссылается на точный marker/value и клинически подходящий follow-up; для стабильного значения фиксирует точный baseline для следующего сравнения. Действие содержит role, priority, timeframe и evidence.

После этих исправлений матрица не требует ослабления ожиданий и проходит по исходно заданному смыслу.

## Автоматические проверки до rollout

- Read-only shadow matrix с production knowledge-конфигурацией: **20/20 PASS**.
- P0–P6 contract suite: **75 passed**.
- Полный backend regression suite: **1593 passed, 20 skipped, 0 failed**.
- Focused P2 + P6 suite: **12 passed**.
- `py_compile`, JSON fixture validation и `git diff --check`: **PASS**.

Pipeline shadow-run выполнялся без user ID, без persistence и без генерации внешнего AI-текста. Production database не изменялась.

## Production deployment

- Implementation commit: `bdd80b1c00c32718808fe1c3d31df747de87963a`.
- GitHub `main` и серверный checkout совпадают: **PASS**.
- Backup branch: `backup-p6-before-reference-matrix-20261005110509`.
- Backend собран с `--no-cache` и пересоздан: **PASS**.
- Backend container: `healthy`.
- Public API `/health`: **200**.
- Public API `/health/ready`: `ready=true`.
- Public frontend: **200**.
- Та же эталонная матрица внутри нового production backend image: **20/20 PASS**.

Frontend в P6 не менялся и не требовал новой сборки.

## Единый production-flow аккаунта Светланы: P0–P6

Проверен указанный владельцем проекта аккаунт. Учётные данные, user ID, upload ID и report version ID в отчёт не записывались.

Для smoke выбран наиболее полный доступный кейс с 14 biomarkers. Выполнена одна контролируемая регенерация; создана ровно одна новая immutable report version.

### P0 — реальный путь данных

- Авторизация и чтение принадлежащего пользователю анализа: **PASS**.
- Все biomarkers имеют canonical mapping: **PASS**.
- Knowledge evaluation, interpreted patterns и clinical hypotheses присутствуют: **PASS**.
- Сохранённый symptom snapshot дошёл до frozen report: **PASS**.
- Источник AI или fallback указан явно: **PASS**.

### P1 — Case Synthesis

- `case_synthesis_v1`, status `complete`: **PASS**.
- Все обязательные смысловые секции присутствуют: **PASS**.
- `all_statements_grounded=true`, незаземлённых утверждений нет: **PASS**.
- Три текущих действия имеют evidence links: **PASS**.

### P2 — симптомный контекст

- `symptom_analysis_v1` сохранён и возвращён: **PASS**.
- Legacy symptom корректно имеет статус `no_mapped_concepts`; вывод не изменён без доказанного stable clinical concept: **PASS**.
- Пользовательские данные не переписывались и симптом не был искусственно сопоставлен.

### P3 — Grounded AI Narrative

- `grounded_ai_narrative_v1`, status `complete`: **PASS**.
- Все девять содержательных полей присутствуют: **PASS**.
- `all_statements_grounded=true`: **PASS**.
- Использованный `deterministic_fallback` содержит marker и конкретную причину: **PASS**.

### P4 — кабинет и экран результата

- Вход через production UI и открытие Dashboard: **PASS**.
- Results route полного кейса: **PASS**.
- Все пять пользовательских секций отображаются: **PASS**.
- AI fallback и объяснение видимы: **PASS**.
- Конкретная safety-причина видима: **PASS**.
- Технический disclosure закрыт по умолчанию: **PASS**.
- Browser/page errors: **0**; console errors: **0**.

### P5 — semantic acceptance

- `semantic_acceptance_v1`, все 8 criteria: **PASS**.
- Точная воспроизводимость frozen acceptance: технические audit failures отсутствуют.
- Реальный отчёт: **7 pass / 1 fail / 0 not applicable**.
- Единственный fail: `symptom_check_effect` с code `symptom_check_no_result_effect`.
- Fallback disclosure и safety reason specificity: **PASS**.

Этот fail ожидаем для сохранённого legacy symptom: он присутствует, но не сопоставлен со stable concept и поэтому не может безопасно менять приоритет или объяснение. Gate корректно оставляет `passes_dod=false`, вместо ложного зелёного результата.

### Frozen API и P6

- `POST /analyze/{upload}/regenerate`, `GET /analyze/{upload}` и `GET /results/{upload}` возвращают один и тот же P1/P2/P3/P5-контракт: **PASS**.
- Оба read endpoints указывают на одну frozen report version: **PASS**.
- P6 production matrix подтверждает смысловое поведение полной цепочки на всех 20 эталонных сценариях: **PASS**.

## Итог

Все требования P6 реализованы и проверены до и после rollout. Матрица содержит 20 фиксированных сценариев всех обязательных типов и проверяет ожидаемый смысл результата. Production-flow реального пользователя подтверждает связную работу P0–P6 через API, immutable persistence и кабинет. Единственный красный semantic criterion в реальном legacy-кейсе является ожидаемой и безопасной работой P5 gate, а не регрессией P6.

P6 завершён. Следующий этап не начинался.
