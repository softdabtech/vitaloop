# VITALOOP User Cabinet UX Audit & Symptom-First Redesign

Дата: 2026-05-27

Тестовый пользователь:

- Email: `a@a.com`
- Проверено в production: `https://vitaloop.today`

Цель: трансформировать кабинет пользователя под новую продуктовую парадигму:

> Пользователь может начать не с анализа, а с состояния или симптома. VITALOOP уточняет контекст, предлагает какие факторы и анализы стоит проверить, помогает понять направление врача, затем связывает загруженные анализы с симптомами, протоколом и weekly check-ins.

Важно: это UX/UI-аудит и продуктовый редизайн. На следующем этапе можно переходить к реализации страниц и компонентов.

## Executive Summary

Сейчас кабинет все еще lab-first. Он хорошо подходит пользователю, который уже имеет PDF с анализами, но слабо раскрывает новую ценность: "я плохо себя чувствую, что мне проверить?".

Главная проблема не в отдельных карточках, а в информационной архитектуре. В кабинете много полезных модулей, но они разложены как набор функций:

- Dashboard
- Upload Labs
- Lab Results
- Assignments
- Progress
- Health Insights
- Weekly Check-in
- Health Profile
- Subscription
- Account

Новый кабинет должен быть не набором функций, а маршрутом пользователя:

1. `Concern`: что меня беспокоит?
2. `Smart Questions`: какие уточнения нужны?
3. `Lab Plan`: что проверить и почему?
4. `Upload Results`: загрузить анализы под конкретный вопрос.
5. `Interpretation`: что показывают результаты?
6. `Protocol`: что делать дальше?
7. `Check-in`: стало лучше или хуже?
8. `Retest`: что перепроверить и когда?

## Production Audit Findings

### 1. Dashboard

Current impression:

- Визуально приятный, но слишком много мотивации и вторичных блоков в начале.
- Главная задача пользователя не ясна.
- Новый пользователь видит "Upload first lab", но не видит новый сценарий "Describe symptoms".
- Achievements и streaks занимают слишком высокое место, хотя пользователь еще не понял медицинскую/практическую ценность.
- Health Score есть, но не объясняет из чего он состоит и что с ним делать.

Observed issues:

- Dashboard показывает `17 lab uploads tracked`, а `/lab-results` показывает `No uploads yet`.
- План пользователя отображается конфликтно: Free Plan / Premium / Upgrade to Pro Premium.
- `Upload labs` остается главным CTA, хотя в новой стратегии первичный CTA должен быть `Start symptom check`.
- "Health Goals" содержит hardcoded-looking примеры, которые могут не соответствовать реальным данным.

Recommended role in new UX:

Dashboard должен стать `Today` page:

- one primary next action;
- active concern/status;
- current loop stage;
- health score components;
- lab plan readiness;
- protocol adherence;
- symptom trend since last check-in.

### 2. Upload Labs

Current impression:

- Страница понятная для PDF upload.
- Уже есть symptom selector, но он воспринимается как optional add-on, а не как начало продукта.
- Страница говорит "add optional symptoms", что противоречит новой стратегии.

Observed issues:

- Текст обещает PDF, photo, spreadsheet, а glossary ранее говорил не заявлять image/photo uploads. Нужно выбрать одно каноническое обещание.
- "Private first" и "processed locally first" могут конфликтовать с фактической AI pipeline архитектурой. Нужно юридически проверить формулировки.
- Инструкция "Upload PDF -> AI analysis -> Open results" слишком lab-first.

Recommended role in new UX:

Переименовать в `Upload Results`.

Новая логика страницы:

- Если есть active concern/lab plan: "Upload results for: leg pain / fatigue / sleep issue".
- Показывать "This upload will help answer".
- Симптомы не optional chips, а linked context: active concern, symptom severity, goal, current meds.
- Если нет active concern: предложить `Start symptom check first` рядом с upload.

### 3. Lab Results

Current impression:

- Хорошая идея как история анализов.
- Но при тестовом пользователе страница пустая, хотя dashboard/progress видят данные.

Observed issues:

- Data inconsistency with dashboard/progress.
- Empty state слишком generic: "No uploads yet" не предлагает symptom-first path.
- Lab Results и Progress пересекаются: обе страницы про uploads/trends.

Recommended role in new UX:

Слить `Lab Results` и значительную часть `Progress` в одну страницу `Results & Trends`.

Страница должна показывать:

- active/result cycles;
- latest upload quality;
- priority biomarkers;
- symptom-linked markers;
- retest plan;
- trend cards;
- raw table only ниже.

### 4. Assignments

Current impression:

- Сейчас это task list, но без контекста задачи.
- При пустом состоянии предлагает questionnaire, но не объясняет зачем.

Observed issues:

- Нет связи с concern/lab plan/protocol stage.
- Empty state "Try another filter or complete the questionnaire" слабый.

Recommended role in new UX:

Переименовать в `Action Plan` или встроить в `Protocol`.

Задачи должны группироваться:

- `Before labs`: answer questions, book lab, discuss doctor direction.
- `After labs`: supplement/nutrition/lifestyle actions.
- `Follow-up`: check-in, retest, share with clinician.

### 5. Progress

Current impression:

- Визуально современнее многих страниц.
- Но дублирует Dashboard, Lab Results и Protocol.
- "Biomarker Overview" выглядит как отдельный dashboard внутри dashboard.

Observed issues:

- Слишком много крупных карточек без связи с симптомами.
- Protocol embedded here duplicates Protocol page.
- Retest timeline is useful but hidden too low.

Recommended role in new UX:

Разделить:

- Biomarker trends -> `Results & Trends`
- Protocol summary -> `Protocol`
- Retest schedule -> top module inside `Lab Plan` or `Results & Trends`
- Progress photos -> optional later module, not core top-level route.

### 6. Health Insights

Current impression:

- Хорошая концепция, но сейчас это empty/placeholder-heavy layer.
- Табы Insights/Alerts/Health Tips/Trends/Timeline дублируют Results, Progress, Dashboard.

Observed issues:

- "Risk context" формулировка рискованна; лучше `Priority context` or `Safety context`.
- Пользователь видит много интерфейса, но мало результата.

Recommended role in new UX:

Либо сделать `Insights` частью Today page, либо превратить в `Review`:

- "What changed?"
- "What explains symptoms?"
- "What should be checked next?"
- "What should be discussed with clinician?"

### 7. Weekly Check-in

Current impression:

- Простой 4-step flow: feeling, sleep, adherence, changes.
- Хорошо для удержания, но слабо для новой symptom-first парадигмы.

Observed issues:

- Не спрашивает active symptoms по шкалам.
- Не связывает check-in с active concern или протоколом.
- "How are you feeling?" слишком общий вопрос.

Recommended role in new UX:

Переименовать в `Check-in` или `Symptom Check-in`.

Новая структура:

1. Active concern status: better / same / worse.
2. Symptom severity sliders per active symptom.
3. Sleep/energy/mood/recovery.
4. Protocol adherence and side effects.
5. New symptoms / red flags.
6. Next adjustment suggestion.

### 8. Health Profile

Current impression:

- Важная страница, но выглядит как длинная форма.
- Completion 17% полезен, но не объясняет что именно улучшит рекомендации.

Observed issues:

- Нет symptom-first секций: current concerns, medical constraints, medications relevance.
- Goals отделены от symptoms.
- Profile completion indicator слишком простой.

Recommended role in new UX:

Сделать `Profile & Safety`.

Разделить на карты:

- Basics
- Goals
- Current concerns
- Medications & supplements
- Conditions & contraindications
- Location / doctor referral context
- Data completeness score

### 9. Subscription

Current impression:

- Достаточно понятная billing page.
- Но value proposition по тарифам еще lab-first.

Observed issues:

- В кабинете есть конфликт: sidebar предлагает Upgrade to Pro Premium, а Subscription показывает Premium Active.
- Features list не раскрывает symptom-first value.

Recommended role in new UX:

Показывать не "what you pay for", а "which loop stages are unlocked":

- Symptom intake
- Lab direction plan
- Upload analysis
- Protocol
- Weekly adaptation
- Retest tracking
- Practitioner sharing

### 10. Settings / Account

Current impression:

- Техническая страница, выглядит нормально.
- Notification preferences полезные.

Recommended role in new UX:

Оставить как `Account`.

Обновить notification labels:

- Weekly Check-in Reminder -> Symptom check-in reminder
- Re-test Reminder -> Lab retest reminder
- New Insight Published -> New next-step insight
- Biomarker Alerts -> Biomarker / safety alerts

### 11. Questionnaire

Current impression:

- Хорошая база для smart follow-ups.
- Но сейчас находится отдельно и называется generic `Adaptive Questionnaire`.

Observed issues:

- Вопросы слишком общие: energy, sleep, stress, digestion.
- Нет свободного symptom-first входа: "у меня болит нога".
- Не формирует видимый lab plan.

Recommended role in new UX:

Пересобрать в `Symptom Check`.

Он должен начинаться с:

> What is the main thing you want to understand or improve?

Дальше:

- free-text concern;
- severity/duration;
- location/body system;
- related symptoms;
- current supplements/meds;
- what user tried;
- red-flag screen;
- lab plan output.

## Main Duplication Map

| Current Area | Duplicates With | Recommendation |
| --- | --- | --- |
| Dashboard biomarker trends | Progress, Lab Results | Dashboard only shows summary and next action |
| Progress biomarker cards | Lab Results, Insights | Move to Results & Trends |
| Progress protocol block | Protocol page | Remove from Progress; show protocol summary only |
| Insights tabs | Results, Progress, Dashboard | Convert to contextual insight cards |
| Assignments | Protocol tasks | Merge into Protocol / Action Plan |
| Questionnaire | Onboarding, Check-in | Make it Symptom Check / Concern Intake |
| Health Profile goals | Onboarding goals | Single source of profile data |
| Subscription status | Sidebar/topbar/subscription page | One subscription source and one display component |

## New Information Architecture

Recommended sidebar:

1. `Today`
   Main dashboard and next best action.

2. `Symptom Check`
   Start with a concern, answer smart questions, get context.

3. `Lab Plan`
   Recommended labs, doctor direction, status of each item.

4. `Upload Results`
   Upload PDFs/results connected to a concern or lab plan.

5. `Results & Trends`
   Biomarker interpretation, history, priority markers, symptom correlation.

6. `Protocol`
   Current protocol cycle, supplements, nutrition, lifestyle, assignments.

7. `Check-in`
   Weekly symptom and adherence feedback.

8. `Care Team`
   Doctor/practitioner sharing and referral direction. Can be hidden until ready.

9. `Profile & Safety`
   Medical context, medications, goals, contraindications.

10. `Billing`

11. `Account`

Optional:

- Keep `Insights` only if it becomes a strong review page. Otherwise merge insights into Today and Results.

## New Dashboard: Today Page

Primary purpose:

> Tell the user what to do next and why.

Top structure:

1. `Health Loop Status`
   A horizontal stepper:
   `Concern -> Questions -> Lab Plan -> Results -> Protocol -> Check-in -> Retest`

2. `Current Focus`
   Example:
   `Leg pain and fatigue`
   Status: `Need 3 answers before lab plan`
   CTA: `Continue symptom check`

3. `Next Best Action`
   One CTA only. Avoid multiple equal CTAs.

4. `Health Signal Score`
   Modern score component with subcomponents:
   - Symptoms
   - Biomarkers
   - Adherence
   - Safety/Profile completeness

5. `Safety / Red Flag`
   Compact banner:
   - `No urgent red flags reported`
   - or `Some answers suggest medical review should not wait`

6. `Lab Readiness`
   Shows:
   - recommended labs ready;
   - results uploaded;
   - missing context.

7. `Protocol Cycle`
   Shows current cycle:
   - Day 3 of 14;
   - adherence;
   - side effects;
   - next check-in.

8. `Recent Changes`
   One small timeline:
   - symptom check completed;
   - lab plan created;
   - upload analyzed;
   - protocol updated.

What to remove from top:

- Achievements
- Social sharing
- Generic streak block
- Duplicated upload counts

These can move lower or become optional.

## New Page Specs

### Symptom Check

Purpose:

> Turn "I feel X" into structured context and a safe next step.

Layout:

- Left: conversational/step intake.
- Right: live summary panel.

Sections:

1. Main concern:
   `What are you trying to understand?`

2. Symptom details:
   - duration;
   - severity;
   - location;
   - triggers;
   - what improves it;
   - related symptoms.

3. Safety screen:
   - sudden/severe onset;
   - fever;
   - swelling;
   - numbness/weakness;
   - chest pain/shortness of breath;
   - trauma;
   - pregnancy context where relevant.

4. Context:
   - meds;
   - supplements;
   - diagnoses;
   - recent labs;
   - goals.

Output:

- `Possible contributing areas`
- `What to check next`
- `Doctor direction`
- `Urgency guidance`
- `What to track this week`

Modern indicators:

- symptom severity meter;
- duration chip;
- body area selector;
- red-flag safety indicator;
- confidence/readiness score: `Lab plan readiness: 72%`.

### Lab Plan

Purpose:

> Give the user a practical testing plan before upload.

Layout:

- Header: linked concern.
- Cards: Core labs, optional labs, doctor direction.
- Status table: suggested / ordered / uploaded / reviewed.

Lab card structure:

- Test name
- Why it matters
- Related symptoms
- Priority: Core / Optional / Discuss with clinician
- Status

Example sections:

- `Core first-pass labs`
- `If symptoms persist`
- `Discuss with doctor`
- `Not needed yet`

Modern indicators:

- priority stack;
- lab plan completeness;
- cost/effort indicator if available later;
- "answers this question" labels.

### Upload Results

Purpose:

> Upload results in context, not as a standalone file action.

Changes:

- Title: `Upload Results`
- If active lab plan exists:
  `Upload results for: leg pain / fatigue investigation`
- Show matching checklist:
  - CBC uploaded?
  - Ferritin uploaded?
  - CRP uploaded?
  - Vitamin D uploaded?

Modern indicators:

- data quality indicator;
- expected markers found;
- missing recommended markers;
- upload-to-plan match score.

### Results & Trends

Purpose:

> Interpret biomarkers and show movement over time.

Top:

- `What changed?`
- `What needs attention?`
- `What matches your symptoms?`
- `What to retest?`

Marker cards:

- value;
- reference range;
- optimal range if used;
- prior value;
- trend arrow;
- symptom relevance chip;
- action link.

Tabs:

- Priority
- By system
- All markers
- History
- Retest

Modern indicators:

- range bar with current marker;
- trend sparkline;
- marker confidence/data quality;
- symptom-correlation chip: `May relate to fatigue`.

### Protocol

Purpose:

> Current action plan, not just supplement list.

Structure:

1. `Current cycle`
   - dates;
   - goal;
   - linked concern;
   - linked upload.

2. `Priority actions`
   - Top 3 actions only first.

3. `Supplements`
   - dosage;
   - timing;
   - rationale;
   - safety notes;
   - what symptom/marker it targets.

4. `Nutrition`

5. `Lifestyle`

6. `Track this`
   - symptoms to monitor;
   - side effects;
   - when to stop/discuss.

7. `Retest`

Modern indicators:

- adherence ring;
- cycle timeline;
- action impact score;
- caution badges;
- symptom target labels.

### Check-in

Purpose:

> Measure whether the plan is working.

Flow:

1. Active concern status.
2. Symptom severity sliders.
3. Sleep / energy / mood / digestion / recovery.
4. Protocol adherence.
5. Side effects.
6. New symptoms/red flags.
7. Output: next adjustment or continue.

Modern indicators:

- before/after symptom trend;
- small line charts per symptom;
- "changed since last check-in";
- adherence + symptom response matrix.

### Profile & Safety

Purpose:

> Improve personalization and prevent unsafe recommendations.

Structure:

- Completion score with missing sections.
- Medical safety cards.
- Medications/supplements interaction context.
- Goals connected to concerns.
- Location for future doctor/lab suggestions.

Modern indicators:

- profile completeness by domain;
- safety readiness score;
- "recommendation quality improves when completed".

## Visual Design Direction

Current cabinet style is clean but too card-heavy and somewhat repetitive. The redesign should feel like a modern health operating system.

Recommendations:

- Use one main content rail with a right context rail on desktop.
- Reduce nested cards.
- Prefer section bands and compact panels over many equal cards.
- Use progress indicators that explain state, not just decoration.
- Use fewer emojis in product-critical UI.
- Replace generic badges with semantic chips:
  - `Needs answers`
  - `Lab plan ready`
  - `Results uploaded`
  - `Protocol active`
  - `Check-in overdue`
  - `Retest due`

Modern indicator library:

1. `Health Loop Stepper`
   Shows stage and next action.

2. `Signal Score`
   One score with 4 components:
   - Symptoms
   - Biomarkers
   - Adherence
   - Safety/Profile

3. `Symptom Severity Trend`
   Small line/area chart.

4. `Lab Plan Readiness`
   Percent based on answered questions + profile + existing labs.

5. `Priority Stack`
   Top 3 problems/actions.

6. `Retest Countdown`
   Days until suggested retest.

7. `Data Quality Badge`
   Upload parsed successfully / partial / missing recommended markers.

8. `Safety Banner`
   Clear non-alarmist medical review guidance.

## Data Consistency Problems To Fix First

Before redesign, fix these because they damage trust:

1. Subscription state must use one canonical source.
   Current observed conflict:
   - Dashboard/top/sidebar: Free / Upgrade
   - Subscription page: Premium Active

2. Upload count must use one canonical source.
   Current observed conflict:
   - Dashboard: 17 uploads / trends visible
   - Lab Results: No uploads yet
   - Progress: biomarker data visible

3. File support claims must be consistent.
   Current observed conflict:
   - Upload page says PDF, image, spreadsheet
   - Existing glossary warns not to claim image/photo upload unless supported.

4. Privacy claims must be legally accurate.
   Current observed conflict:
   - "processed locally first"
   - "PDF never leaves your device"
   - upload flow posts file to `/analyze/pdf`

5. Free/Premium lock display should not show upgrade cards for active premium users.

## Proposed Implementation Phases

### Phase 0: Trust Fixes

- Canonical subscription display component.
- Canonical upload history source.
- Remove inconsistent local-processing/privacy claims until verified.
- Update sidebar labels.
- Remove duplicate upgrade prompts when active premium.

### Phase 1: New Cabinet IA Without New Backend

Use existing data:

- Dashboard -> Today.
- Questionnaire -> Symptom Check.
- Upload -> Upload Results.
- Lab Results + Progress -> Results & Trends.
- Assignments + Protocol -> Protocol / Action Plan.
- Weekly Check-in -> Check-in.
- Health Profile -> Profile & Safety.

This can be mostly frontend copy/layout and route-label work.

### Phase 2: Symptom-First MVP

Add frontend flow:

- free-text concern;
- smart follow-up question bank;
- red-flag screen;
- lab plan output;
- saved active concern.

Backend entities recommended:

- `health_concerns`
- `health_concern_answers`
- `lab_plan_recommendations`
- `concern_upload_links`
- `symptom_checkins`

### Phase 3: Lab Plan Intelligence

- Generate lab plan from symptoms/profile.
- Connect uploaded biomarkers to lab plan.
- Show missing recommended markers.
- Generate clinician discussion summary.

### Phase 4: Adaptive Protocol Loop

- Protocol adjusts based on:
  - biomarkers;
  - symptom change;
  - adherence;
  - side effects;
  - retest results.

## Priority UX Changes

If implementing only the highest-impact changes first:

1. Rename Dashboard to `Today`.
2. Add top `Health Loop Status` component.
3. Add `Start symptom check` as primary CTA.
4. Convert Questionnaire into `Symptom Check`.
5. Replace Upload page copy with contextual `Upload Results`.
6. Merge Lab Results + Progress conceptually into `Results & Trends`.
7. Move achievements/streaks lower.
8. Remove conflicting subscription/upload counts.
9. Add symptom severity tracking to Check-in.
10. Add lab plan page.

## Success Criteria

After redesign, a user should immediately understand:

1. They can start without lab results.
2. The system helps clarify symptoms before testing.
3. The system suggests what labs may be useful and why.
4. Uploads become more valuable because they are linked to a concern.
5. Protocol actions are tied to both biomarkers and symptoms.
6. Weekly check-ins measure whether the protocol is working.
7. The cabinet shows one coherent health loop instead of disconnected pages.

