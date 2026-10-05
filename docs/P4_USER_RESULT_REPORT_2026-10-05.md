# P4 — пользовательский результат

Начало: 2026-10-05  
Завершение: 2026-10-05  
Статус: **DONE — все пункты P4 реализованы, протестированы и развёрнуты в production**

## Цель

Закрыт раздел `Structure.md` «P4. Переделать пользовательский результат»:

1. на первом уровне результата показано, что обнаружено в анализах;
2. отдельно показана возможная связь с самочувствием;
3. выделены максимум три приоритетные действия;
4. явно показано, каких данных не хватает;
5. отдельно указано, когда нужна консультация;
6. evidence debt, confidence calibration и engine trace убраны в раскрываемый технический раздел.

## Реализация

### 1. Единый P4 presentation contract — DONE

Добавлен чистый адаптер `buildResultOverview`. Он не создаёт медицинские выводы и использует существующие данные в следующем порядке:

```text
grounded_ai_narrative_v1
  → case_synthesis_v1
  → role/action and evidence-gap contracts
  → legacy frozen report fields
```

Для P3 narrative каждый `evidence_id` разрешается через `evidence_links`. UI получает уже связанный объект evidence с label, availability, значением и единицей измерения, если они присутствуют во frozen report.

Дубли удаляются по тексту с сохранением первого проверенного утверждения. Неполные и malformed данные безопасно отбрасываются. Старый отчёт без P1/P3 не падает и сохраняет report-specific summary, findings, action plan и doctor discussion из legacy contract.

### 2. Пять пользовательских блоков — DONE

Сразу после краткого hero отображаются пять постоянных блоков:

- `What your results show`;
- `How this may connect to how you feel`;
- `Three priority actions`;
- `What information is missing`;
- `When to seek clinical advice`.

Для украинской локали добавлены соответствующие переводы.

Каждый блок имеет спокойный empty state и поэтому не исчезает при отсутствии данных. Это позволяет пользователю отличить «ничего не обнаружено» от ошибки загрузки.

### 3. Ровно три приоритетных действия — DONE

Действия ранжируются уже существующими backend-контрактами. Frontend показывает первые три проверенных пункта и никогда не расширяет этот блок сверх трёх. Если отчёт содержит меньше трёх report-specific действий, UI не придумывает недостающие.

### 4. Симптомы и evidence — DONE

P2-блок `What changed because of your answers` сохранён и перенесён внутрь блока связи с самочувствием. Его contract (`impact.changed`, stable symptom concept IDs и hypothesis links) не изменён.

Утверждения P3 показывают короткие evidence chips. Для missing evidence используется явная отметка `Missing`, а для observed biomarkers — label и фактическое значение с unit.

### 5. Клиническая консультация и safety — DONE

Блок консультации объединяет существующие проверенные источники в безопасном порядке:

1. urgent warning из `safety_result`;
2. `doctor_escalation_precision` уровней urgent/doctor;
3. report safety alerts;
4. P3 clinician questions или P1 clinician discussion.

Urgent content отображается первым и получает усиленный визуальный тон. При отсутствии сигнала выводится спокойное пояснение о новых, выраженных или ухудшающихся симптомах.

### 6. Технический раздел — DONE

Технические данные больше не конкурируют с пользовательским итогом. Они находятся внутри закрытого по умолчанию раздела:

`Why the system reached this conclusion`

Внутри сохранены:

- evidence debt с overall score, доменами и reason codes;
- confidence calibration с overall score, calibrated items и reason codes;
- Health Intelligence Engine domain states;
- Clinical Reasoning Map;
- Evidence Gaps;
- полный Clinical Reasoning engine trace.

Данные не удалены и доступны по одному раскрытию.

## Изменённые компоненты

- `frontend/src/pages/Results.jsx` — новая иерархия страницы, пять блоков, evidence UI и технический disclosure;
- `frontend/src/lib/resultOverview.js` — безопасный presentation adapter P1/P3/legacy;
- `frontend/src/lib/__tests__/resultOverview.test.js` — unit tests адаптера;
- `backend/tests/test_p4_results_frontend_contract.py` — source-contract regression для пяти блоков и disclosure.

## Автоматические проверки

- `resultOverview` unit tests: **7 passed**;
- P2 + P4 frontend contract tests: **6 passed**;
- ESLint изменённых frontend-файлов: **PASS**;
- frontend production build: **PASS**;
- полный backend regression suite: **1567 passed, 20 skipped, 0 failed**;
- `git diff --check`: **PASS**.

Полный backend suite запускался с пустой тестовой конфигурацией Supabase. Это исключило обращения unit/integration fixtures с фиктивными `user-*` ID к production database.

## Production deployment

- Commit: `88d0c81d4743c34c7cd2d4d871202895bc63be4a`;
- GitHub `main`: **PASS**;
- сервер обновлён fast-forward до того же commit: **PASS**;
- backup branch: `backup-p4-before-user-result-20261005050752`;
- frontend image собран с `--no-cache`: **PASS**;
- frontend container пересоздан и имеет статус `healthy`;
- internal frontend: **HTTP 200**;
- public `https://vitaloop.today/`: **HTTP 200**;
- public API `/health`: **HTTP 200**;
- public API `/health/ready`: **ready=true**;
- production asset содержит новый P4 Results chunk: **PASS**.

После сборки удалён Docker build cache. Свободное место восстановлено примерно с 145 MB до 3.3 GB.

## Production smoke на аккаунте Светланы

Проверен указанный владельцем проекта аккаунт. Email, пароль, user ID, upload ID и report version ID в отчёт не записывались.

### API/data smoke

- авторизация: **PASS**;
- доступно 9 отчётов;
- найден полный frozen-кейс с 14 biomarkers;
- Case Synthesis: `case_synthesis_v1`;
- Grounded Narrative: `grounded_ai_narrative_v1`;
- narrative source: `llm_selection`;
- полный P3 JSON contract: **PASS**;
- полный кейс содержит 3 actions, 5 missing-information пунктов, 2 clinician questions и 1 engine trace;
- evidence debt и confidence calibration присутствуют.

### Browser smoke

- login через production UI: **PASS**;
- полный отчёт открыт через production Results route: **PASS**;
- все пять P4-заголовков видимы: **PASS**;
- `Three priority actions`: **3 элемента**;
- actions capped at three: **PASS**;
- evidence chips: **36**;
- технический disclosure изначально закрыт: **PASS**;
- disclosure открывается: **PASS**;
- внутри видны Evidence debt, Confidence calibration и Clinical Reasoning trace: **PASS**;
- browser/page errors: **0**.

Визуальный screenshot полного production-результата дополнительно проверен: порядок блоков, safety tone, evidence chips, раскрытый технический раздел, biomarker table и нижние пользовательские секции отображаются корректно.

## Итог

P4 закрыт полностью. Верх результата теперь отвечает на пять пользовательских вопросов и опирается на frozen P1/P3 evidence. Технические детали сохранены, но скрыты до осознанного раскрытия. Старые отчёты продолжают показывать доступный report-specific контент. Production UI и полный аккаунтный кейс подтверждены автоматическим browser smoke.
