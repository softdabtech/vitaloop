# P3 — перестройка AI-слоя

Дата: 2026-10-04  
Статус: **IMPLEMENTED — локальный и изолированный production-config suite зелёный; production deployment/account smoke фиксируются ниже после развёртывания**

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

Будет заполнено после commit/push, серверной сборки и проверки аккаунта владельца проекта.

## Основные изменённые компоненты

- `backend/app/services/grounded_ai_narrative.py` — allowlist context, selection schema, validator, materialization и fallback;
- `backend/app/services/claude_service.py` — запрет raw-input LLM protocol path и allowlist engine context;
- `backend/app/services/lab_analysis_pipeline.py` — запуск P3 после Case Synthesis, result/persistence/provenance;
- `backend/app/services/report_history.py` — immutable frozen replay;
- `backend/app/routers/analysis/analyze.py` — response model и top-level aliases;
- `backend/app/routers/protocol/compatibility.py` — parity live/legacy results;
- `backend/app/services/protocol_enrichment.py` — восстановление evidence-backed managed domain context;
- `backend/scripts/audit_grounded_ai_narrative.py` — read-only production audit без персональных данных.
