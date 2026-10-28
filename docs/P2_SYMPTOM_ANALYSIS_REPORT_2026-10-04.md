# P2 — связь symptom check с анализом

Дата: 2026-10-04  
Статус: **DONE — все пункты P2 реализованы, протестированы и развёрнуты в production**

## Цель

Закрыт раздел `Structure.md` «P2. Реально связать symptom-check с анализом»:

1. использовать стабильные symptom concept IDs;
2. построить матрицу `симптом → домены → гипотезы → подтверждающие показатели`;
3. менять приоритет и содержание вывода на основании symptom check;
4. после нового symptom check явно предлагать пересчёт последнего отчёта;
5. показывать пользователю, какие ответы изменили вывод.

## Результат по пунктам

### 1. Стабильные concept IDs — DONE

- Анализ читает `vitaloop_concept_id`, `choice`, `mapping_status` и утверждённые `domain_keys` из frozen symptom snapshot.
- Текст отображения не участвует в сопоставлении клинического смысла.
- Старые свободные ответы получают воспроизводимый ID вида `unmapped_symptom_<sha256>`.
- `unmapped`-ответы не могут повысить confidence, изменить порядок гипотез или активировать старое текстовое сопоставление.
- Для старых отчётов без P2-контракта сохранена обратная совместимость; при наличии `symptom_analysis` текстовый fallback отключён.

Версия контракта: `symptom_analysis_v1`.

### 2. Матрица симптомов — DONE

Каждый report version сохраняет структурированную матрицу:

```text
symptom_concept_id
  → domains[]
  → hypotheses[].hypothesis_id + domain
  → hypotheses[].confirming_marker_ids[]
```

Матрица строится только по стабильным ID и доменам, ссылается на уже созданные движком гипотезы и их реальные supporting markers. Она сохраняется в immutable `report_versions.input_snapshot.symptom_analysis` вместе с source session, временем symptom check и version provenance.

Версия матрицы: `symptom_concept_matrix_v1`.

### 3. Влияние на вывод — DONE

- Присутствующий mapped symptom повышает приоритет гипотез своего домена.
- Ответ `absent` понижает их приоритет и сохраняется как ограничивающее свидетельство.
- После калибровки гипотезы сортируются по symptom support/absence, затем по calibrated score.
- Клинический score не подменяется скрытым числом: влияние хранится отдельно в `symptom_priority`, `priority_effects` и `conclusion_change`.
- `case_synthesis.main_conclusion` и `likely_explanations` используют новый порядок и добавляют ссылку на конкретный concept ID.
- Unit-сценарий с двумя гипотезами подтверждает реальное изменение ранга; сценарий `absent` подтверждает понижение и объяснение причины.

### 4. Обновление после нового symptom check — DONE

Все активные способы завершения symptom check возвращают `report_update`:

- завершение provider-backed adaptive flow;
- остановка provider-backed flow сразу после initial evidence;
- быстрый positive baseline `no_current_concern`;
- controlled fallback questionnaire.

Если symptom check новее последнего готового отчёта, backend возвращает действие:

```text
POST /analyze/{upload_id}/regenerate
→ /results/{upload_id}
```

Активный пользовательский маршрут `/questionnaire` (`SymptomCheck.jsx`) показывает карточку **Update latest report**, выполняет регенерацию и открывает обновлённый отчёт. Если отчёт уже новее symptom check, лишний пересчёт не предлагается.

### 5. Объяснение изменения пользователю — DONE

Страница результата показывает блок **What changed because of your answers**, если `case_synthesis.symptom_impact.changed=true`.

Блок содержит:

- затронутую гипотезу;
- названия stable symptom concepts;
- фактический ответ `reported present`, `reported absent` или `unsure`;
- предупреждение, что это меняет приоритет, но не доказывает причину.

## Автоматические проверки

- Целевой P2/backend/frontend contract suite: **33 passed**.
- Полный backend-suite после финального исправления: **1532 passed, 20 skipped, 0 failed**.
- ESLint изменённых frontend-файлов: **PASS**.
- Изолированная production frontend build: **PASS**.
- Серверная production frontend build с PWA/service worker: **PASS**.
- Backend image собран с `--no-cache`: **PASS**.
- `git diff --check`: **PASS**.

Полный общий frontend lint по-прежнему содержит ранее существовавшие ошибки в файлах вне P2 (`CookieConsent`, `NotificationPreferences`, `PaywallModal`, `wayforpayCheckout`, `Subscription`, `UaLanding`). Изменённые P2-файлы проходят lint отдельно.

## Production-проверка аккаунта

Проверен аккаунт, указанный владельцем проекта. Email, пароль, user ID, upload ID и report version ID в отчёт не записывались. Кейс обозначен SHA-256 fingerprint: `e7edae673a6c`.

### Фактический аккаунт

- Авторизация: **PASS**.
- В отчёте: 14 сохранённых biomarkers и 14 extraction candidates.
- Регенерация последнего EN-отчёта: **PASS**.
- Создана ровно одна новая report version; предыдущая immutable-версия сохранилась: **PASS**.
- `POST /analyze/{upload}/regenerate`, `GET /analyze/{upload}` и `GET /results/{upload}` возвращают одинаковый frozen P2-контракт: **PASS**.
- P0 real-case audit: **SMOKE PASS**.
- P1 Case Synthesis audit: **SMOKE PASS**, 30 grounded statements, 0 ungrounded.
- P2 symptom analysis audit: **SMOKE PASS**.

Фактический symptom snapshot этого аккаунта содержит один старый свободный ответ, созданный до controlled concept flow:

```text
concepts=1
mapped=0
unmapped=1
matrix_rows=1
linked_hypotheses=0
priority_effects=0
conclusion_changed=false
```

Это ожидаемое безопасное поведение. Неизвестный текст получил стабильный `unmapped` ID, но не был интерпретирован как медицинский симптом и не изменил вывод. Для проверки нельзя было приписывать пользователю вымышленный симптом.

### Mapped-сценарий на данных этого отчёта

Дополнительно выполнен read-only shadow test в production image на frozen biomarkers/hypothesis этого же отчёта. В базу ничего не записывалось. В тест подан стабильный provider concept ID с утверждённым доменом текущей гипотезы:

```text
actual_hypotheses=1
matched_hypotheses=1
confirming_markers=2
priority_effects=1
conclusion_changed=true
case_synthesis_explains_change=true
```

Также подтверждено:

- текущий реальный отчёт новее symptom snapshot → `report_update.status=current`;
- symptom check с более поздним временем → `report_update.status=update_available` и POST action на regeneration.

## Production smoke после финального деплоя

- Backend container: `healthy`.
- Internal `/health`: **200**.
- Public `https://api.vitaloop.today/health`: **200**.
- Knowledge readiness: `status=ok`.
- LLM probe при основном P2-деплое: `status=ok`, provider reachable.
- Frontend `https://vitaloop.today/`: **200**.
- Production build-info: commit `f39bfeee65328b74ab09bb06f78795a16746eae3`, branch `main`.
- `SymptomCheck` production asset содержит активную карточку обновления: **PASS**.
- `Results` production asset содержит объяснение изменения вывода: **PASS**.

## Коммиты и rollback

- `8209737892c295bb2d98a1735a471574780306d4` — `P2: connect symptom check to analysis`.
- `f39bfeee65328b74ab09bb06f78795a16746eae3` — `P2: surface report refresh in active symptom check`.
- Серверные backup branches:
  - `backup-p2-before-symptom-analysis-20261004181253`;
  - `backup-p2-before-active-refresh-ui-20261004182746`.

## Основные изменённые компоненты

- `backend/app/services/symptom_analysis.py` — stable IDs, matrix, priority effects и trace;
- `backend/app/services/lab_analysis_pipeline.py` — интеграция, persistence и provenance;
- `backend/app/services/case_synthesis.py` — symptom connections и объяснение изменения;
- `backend/app/services/confidence_calibration.py` — stable concept matching без text fallback для P2;
- `backend/app/services/symptom_report_update.py` — решение о пересчёте;
- `backend/app/services/symptom_check_service.py` и questionnaire router — `report_update` во всех completion paths;
- `backend/app/services/report_history.py` — frozen read без пересчёта старых версий;
- `frontend/src/pages/SymptomCheck.jsx` — действие обновления в активном flow;
- `frontend/src/pages/Results.jsx` — пользовательское объяснение изменения;
- `backend/scripts/audit_symptom_analysis.py` — read-only production audit.

## Итог

Все пять пунктов P2 закрыты. Symptom check теперь входит в отчёт как версионированный структурированный контекст, может изменить порядок и содержание объяснений, оставляет проверяемый trace и даёт пользователю явное действие для пересчёта после новых ответов. Legacy free text остаётся безопасно unmapped и не влияет на клинический вывод.
