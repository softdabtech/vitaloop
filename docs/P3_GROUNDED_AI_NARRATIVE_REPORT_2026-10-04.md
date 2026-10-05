# P3 — перестройка AI-слоя

Начало: 2026-10-04
Завершение: 2026-10-05
Статус: **DONE — все пункты P3 реализованы, протестированы и развёрнуты в production**

## Цель

Закрыт раздел `Structure.md` «P3. Перестроить AI-слой»:

1. AI получает только проверенный структурированный контекст движка;
2. модель не может добавить в narrative новый медицинский факт;
3. результат имеет обязательный JSON-контракт;
4. fallback собирается из данных конкретного отчёта без общих wellness-фраз.

## Реализация

### 1. Закрытая граница данных для LLM — DONE

Новый narrative строится только после `case_synthesis_v1`. Из него формируется allowlist-контекст:

```text
verified_case_synthesis_context_v1
  → candidates[section].statement_id + text + evidence_ids
  → evidence_registry[].evidence_id + проверенные поля evidence
```

В этот контекст не входят:

- сырой текст лабораторного документа;
- исходный questionnaire payload;
- свободный текст симптомов;
- полный user profile;
- неподтверждённые extraction candidates.

Старый AI-генератор протокола также закрыт этой границей. При наличии engine context в prompt попадает только allowlist полей `clinical_context`; сырые biomarkers, symptoms и profile не подставляются. Без проверенного engine context LLM вообще не вызывается, используется локальный fallback.

### 2. Модель не авторит медицинские факты — DONE

Модель возвращает только списки существующих `statement_id` и точный union используемых `evidence_id`. Она может выбрать и изменить порядок утверждений внутри соответствующего раздела, но не пишет и не переписывает текст.

После ответа выполняется строгая проверка:

- присутствуют ровно девять обязательных полей;
- каждый ID существует в allowlist текущего раздела;
- нет дублей и превышения лимитов;
- `evidence_links` точно совпадает с evidence выбранных statements;
- каждая ссылка существует в registry текущего отчёта.

Финальный текст материализуется сервером из `case_synthesis`, а не из свободного текста модели. Ответ с неизвестным statement/evidence ID, неправильной схемой или пустым обязательным выбором отклоняется целиком.

### 3. Обязательный JSON-контракт — DONE

Версия: `grounded_ai_narrative_v1`.

Контракт содержит все поля из `Structure.md`:

- `personalized_summary`;
- `key_connections`;
- `symptom_lab_correlations`;
- `ranked_explanations`;
- `uncertainties`;
- `next_actions`;
- `clinician_questions`;
- `retest_plan`;
- `evidence_links`.

Каждый narrative item содержит `statement_id`, точный текст из Case Synthesis и `evidence_ids`. `evidence_links` содержит дедуплицированный registry с типом, ID, label, availability и, когда они есть в frozen evidence, значением, единицей, статусом и reference range.

Дополнительный блок `grounding` фиксирует policy, число statements/evidence, source contract, факт fallback и его причину.

### 4. Персонализированный fallback — DONE

Fallback использует то же отображение разделов текущего `case_synthesis` и тот же evidence registry. Он не использует шаблоны вроде `Nutrition foundation`, hydration, exercise или sleep.

Проверенный сценарий fallback сохранил фактические данные тестового отчёта:

```text
Ferritin = 9 ng/mL
retest timing = 8-12 weeks
missing evidence = transferrin_saturation
```

При этом намеренно добавленные моделью неизвестные `invented:diagnosis` и `biomarker:invented:value` были отклонены, после чего вернулся grounded fallback без этих значений.

### 5. Persistence и API parity — DONE

`grounded_ai_narrative`:

- возвращается live pipeline;
- сохраняется verbatim в `report_versions.input_snapshot`;
- имеет `version_provenance.grounded_ai_narrative_version`;
- возвращается top-level и в `final_analysis`;
- читается из frozen report без повторного LLM-вызова и без пересчёта старой версии;
- доступен через основной analyze API и compatibility results API.

Старые report versions без P3-контракта остаются валидными и возвращают `null` для нового поля.

## Дополнительный закрытый regression

Полный suite выявил ранее существовавший красный тест в `protocol_enrichment`: managed domain с реальными marker/symptom evidence терял `knowledge_domain_context`, если его health score был `stable` и поэтому отсутствовал в `top_priorities`.

Исправление использует evidence-backed `health_states.states` только когда `top_priorities` пуст. Домены без contributing biomarkers и symptom signals по-прежнему не добавляются. Baseline-тест, падавший и на неизменённом production image, теперь зелёный.

## Автоматические проверки

- P3 contract/grounding/audit tests: **10 passed**.
- P1/P2/P3 + pipeline + frozen replay related suite: **60 passed**.
- Regression для найденного baseline-дефекта: **3 passed**.
- Полный backend suite: **1563 passed, 20 skipped, 0 failed**.
- `git diff --check`: **PASS**.

Первый полный запуск в изолированном backend image не смог собрать пять source-contract тестов, потому что image не содержит ожидаемые абсолютные `/frontend` и `/backend`. После read-only mount этих каталогов suite выполнился полностью. Это было ограничение тестового окружения, а не ошибка приложения.

## Реальный LLM smoke до деплоя

Через production LLM configuration выполнен неперсистируемый синтетический smoke. Внешний вывод содержал только агрегатные поля:

```text
version=grounded_ai_narrative_v1
source=llm_selection
statements=4
evidence=2
grounded=true
fallback_reason=null
```

Это подтверждает, что реальный provider возвращает валидный selection-контракт и результат проходит server-side grounding validation без fallback.

## Production deployment и smoke

- Commit `d1a8a6a54501db9eeedb538d050b3dd9372968fb` отправлен в GitHub `main`: **PASS**.
- Сервер обновлён fast-forward до того же commit: **PASS**.
- Backup branch: `backup-p3-before-grounded-ai-20261004185127`.
- Backend image собран с `--no-cache`: **PASS**.
- Backend container после recreate: `healthy`.
- Internal `/health`: **200**, `status=ok`.
- Public `https://api.vitaloop.today/health`: **200**.
- Knowledge readiness: **PASS**, 69 active rules, 91 recommendations, evaluator ok.
- LLM readiness: **PASS**, provider reachable, model `gpt-4o-mini`.
- Frontend `https://vitaloop.today/`: **200**. Frontend не пересобирался, поскольку P3 меняет только backend/API contract.

## Production-проверка аккаунта

Проверен аккаунт, указанный владельцем проекта. Email, пароль, user ID, upload ID и report version ID в отчёт не записывались. Кейс обозначен SHA-256 fingerprint: `00d5aa86ac68`.

- Авторизация: **PASS**.
- До регенерации последняя frozen-версия ещё не содержала P3: подтверждено.
- `POST /analyze/{upload}/regenerate`: **200**.
- Создана ровно одна новая report version; предыдущая immutable-версия сохранена: **PASS**.
- Narrative version: `grounded_ai_narrative_v1`.
- Narrative status: `complete`.
- Реальный источник: `llm_selection`, fallback не использовался.
- Все девять обязательных полей: **PASS**.
- Statements: 6.
- Evidence records: 3.
- `all_statements_grounded=true`.
- Read-only P3 audit: **SMOKE PASS**, failures отсутствуют.
- Повторный `GET /analyze/{upload}` вернул идентичный frozen P3 contract: **PASS**.
- `GET /results/{upload}` вернул тот же контракт: **PASS**.
- Frozen report source после регенерации: `frozen`.

## Основные изменённые компоненты

- `backend/app/services/grounded_ai_narrative.py` — allowlist context, selection schema, validator, materialization и fallback;
- `backend/app/services/claude_service.py` — запрет raw-input LLM protocol path и allowlist engine context;
- `backend/app/services/lab_analysis_pipeline.py` — запуск P3 после Case Synthesis, result/persistence/provenance;
- `backend/app/services/report_history.py` — immutable frozen replay;
- `backend/app/routers/analysis/analyze.py` — response model и top-level aliases;
- `backend/app/routers/protocol/compatibility.py` — parity live/legacy results;
- `backend/app/services/protocol_enrichment.py` — восстановление evidence-backed managed domain context;
- `backend/scripts/audit_grounded_ai_narrative.py` — read-only production audit без персональных данных.

## Итог

P3 закрыт полностью. AI narrative и AI protocol path теперь работают через проверенную структурированную границу. Narrative-модель не создаёт медицинский текст: она выбирает только ID утверждений текущего Case Synthesis, после чего сервер валидирует ссылки и материализует текст из frozen evidence. Ошибка или неподдерживаемый ID приводит к персонализированному fallback из данных этого же отчёта. Контракт сохраняется как immutable artifact и одинаково выдаётся всеми results endpoints.
