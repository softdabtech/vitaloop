# VITALOOP Structured Symptom Engine + Infermedica Integration

**Implementation specification for Claude**
**Status:** approved design draft; no production implementation yet
**Primary cabinet:** English (`en`)
**Secondary cabinet:** Ukrainian (`uk`) through a translation layer
**Last updated:** 2026-09-24

## 1. Objective

Replace the current free-text and generic 1–10 questionnaire with a structured,
adaptive symptom assessment that:

1. accepts only controlled clinical concepts and controlled answer values;
2. starts from a concrete primary concern rather than abstract wellness questions;
3. adapts subsequent questions to previously confirmed evidence;
4. distinguishes `present`, `absent`, and `unknown` evidence;
5. adds symptom-specific red-flag and triage support;
6. feeds every confirmed symptom fact into the existing VITALOOP lab-analysis,
   safety, confidence, reasoning, reporting, and longitudinal services;
7. preserves VITALOOP as the owner of the user journey, persistence, lab
   interpretation, safety policy, reports, and longitudinal health record;
8. uses Infermedica Engine API as an external medical ontology and adaptive
   interview provider, not as the VITALOOP source of truth.

The implementation must be EN-first. English copy and concept labels are the
canonical source. Ukrainian presentation must use the same stable clinical IDs
and answer codes, with only the displayed strings changing.

## 2. Product decisions that are already fixed

These are requirements, not implementation suggestions:

- Anthropometric/profile data is required before the user enters the cabinet.
- Symptom Check is optional after required onboarding and may be skipped.
- There are no free-text clinical fields in the new symptom flow.
- There is no `Other: type your answer` option.
- `Not sure` is allowed, but it is stored as `unknown`, not as `absent`.
- The user may report that there is no current problem and establish a positive
  baseline without starting an Infermedica interview.
- The user selects one primary concern. Secondary concerns can be recorded but
  must not compete for control of the first adaptive branch.
- Condition rankings returned by Infermedica are hypotheses, never diagnoses.
- Condition rankings must not directly drive supplements, treatment, health
  scores, or user-facing claims in v1.
- Infermedica may escalate VITALOOP safety, but it may never de-escalate an
  internal VITALOOP safety state.
- Raw PDF files and raw numeric lab results are not sent to Infermedica in v1.
- LLMs must not generate clinical questions or answer options in the new flow.
- Every stored answer must have a stable ID, a controlled value, provenance,
  and at least one defined downstream consumer.

## 3. Non-goals

Do not include the following in this implementation:

- replacing the VITALOOP lab analysis pipeline;
- showing a list of possible diagnoses to users;
- using Infermedica Conversational Triage API;
- using Infermedica `/parse` for free-text symptoms;
- migrating historical free-text concerns into structured concepts by guessing;
- building a complete medications or supplements terminology;
- sending names, email addresses, PDFs, lab values, or VITALOOP user IDs to
  Infermedica;
- removing the current questionnaire tables until the new flow has completed a
  monitored rollout;
- changing B2B questionnaire contracts as part of the first B2C release.

## 4. Current repository baseline

The implementation must work with the existing stack:

### Frontend

- React 18
- Vite 6
- JavaScript/JSX
- Axios through `frontend/src/lib/api.js`
- TanStack React Query 5
- React Router 6
- Tailwind and the existing Coach UI components
- Playwright for E2E tests
- Existing locale resolver in `frontend/src/lib/locale.js`

Do not introduce TypeScript or a new global state framework for this feature.
Do not add a full i18n dependency unless the existing dictionary approach proves
insufficient during implementation.

### Backend

- Python / FastAPI
- Pydantic v2
- `httpx` for external HTTP calls
- Supabase/Postgres persistence
- existing request IDs, structured logging, audit logs, rate limiting, and
  service-layer conventions
- pytest and pytest-asyncio

Do not add an Infermedica SDK. Use the existing `httpx` dependency so the
integration contract remains explicit, testable, and replaceable.

### Existing VITALOOP assets to preserve

- biomarker extraction and canonical normalization;
- analysis quality gate;
- knowledge rule packs;
- health state engine;
- hypothesis, contradiction, negative-evidence, confidence, evidence-debt,
  safety, priority, trend, personal-baseline, and report layers;
- frozen report snapshots and replay guarantees;
- audit logs and timeline events.

## 5. External provider choice

Use **Infermedica Engine API v3**, not Platform API.

Reasons:

- Engine API is stateless; VITALOOP owns session state and retention.
- Engine API supports bespoke UX and controlled data flow.
- It accepts structured evidence with `present`, `absent`, and `unknown` states.
- It returns adaptive questions and a `should_stop` recommendation.
- It provides red-flag suggestions and five-level triage.
- Provider credentials remain server-side.

Reference documentation:

- Quickstart: https://developer.infermedica.com/documentation/engine-api/
- Diagnosis: https://developer.infermedica.com/documentation/engine-api/build-your-solution/diagnosis/
- Suggest: https://developer.infermedica.com/documentation/engine-api/build-your-solution/suggest-related-concepts/
- Triage: https://developer.infermedica.com/documentation/engine-api/build-your-solution/triage/
- Basics and model versioning: https://developer.infermedica.com/documentation/engine-api/basics/
- Engine vs Platform: https://developer.infermedica.com/documentation/overview/platform-api-vs-engine-api/

## 6. High-level architecture

```text
Required onboarding profile
        |
        v
VITALOOP EN symptom UI
        |
        v
FastAPI symptom-check router
        |
        v
SymptomCheckService (workflow owner)
        |-------------------------------|
        v                               v
Infermedica Engine adapter       Supabase session/evidence store
        |                               |
        |-------------------------------|
                        |
                        v
              Normalized symptom snapshot
                        |
        |---------------|-------------------|
        v               v                   v
  Safety policy    Lab reasoning       Reports / trends
```

The frontend must never call Infermedica directly. The only public contract is
the VITALOOP FastAPI contract.

## 7. User journey

### 7.1 Required onboarding

Before the user can reach the dashboard, require:

- age as a validated integer or derived from date of birth;
- sex value required by lab reference ranges and the provider contract;
- height in centimetres;
- weight in kilograms.

Validation rules:

- age: `18..120` for the first release;
- height: `100..250 cm`;
- weight: `30..350 kg`;
- no silent defaults;
- do not infer missing sex or age;
- the user cannot complete onboarding while any required value is missing.

The first release is adult-only. Do not enable pediatric Infermedica paths until
VITALOOP reference ranges, safety, copy, consent, and clinical review explicitly
support them.

### 7.2 Dashboard entry

After onboarding, show the dashboard. Symptom Check is an optional primary CTA.
The user may also go directly to Upload Results.

If the user skips Symptom Check:

- record a `symptom_check_skipped` analytics event;
- do not create fake negative evidence;
- lab analysis proceeds with `symptom_snapshot.present = false`;
- reports explicitly describe symptom context as unavailable, not normal.

### 7.3 Symptom Check: three stages

#### Stage 1 — Root and initial evidence

Screen 1: overall state, for longitudinal baseline only:

- `good`
- `mostly_good`
- `reduced`
- `poor`

Screen 2: primary concern, selected from a controlled EN catalog:

- `no_current_concern`
- `fatigue_low_energy`
- `sleep_unrefreshing`
- `cognition_memory`
- `mood_stress`
- `weight_appetite_thirst_urination`
- `digestion_stool`
- `palpitations_breathlessness_exercise`
- `muscle_weakness_cramps_numbness`
- `hair_skin_nails_temperature`
- `pain_joints_inflammation`
- `menstrual_bleeding_reproductive`
- `unsupported_concern`

`unsupported_concern` is not a free-text field. It records that the current
catalog does not cover the user need and ends the automated assessment with a
clear limitation message.

Screen 3: concrete initial symptoms for the selected root. Values come from the
versioned `clinical_concept_mappings` table and are mapped to Infermedica symptom
IDs. The user selects up to three and chooses one as primary.

Screen 4: controlled duration bucket for the primary symptom:

- `today`
- `days_2_7`
- `weeks_1_4`
- `months_1_3`
- `months_3_plus`
- `intermittent`
- `unknown`

Duration is stored as a VITALOOP attribute. If Infermedica offers a semantically
equivalent duration-specific concept/question, preserve both the provider
evidence and the VITALOOP attribute without double-counting it downstream.

After the initial symptom evidence is collected, call Infermedica red-flag
suggestion/diagnosis logic. Red-flag questions must be concrete provider-backed
questions, not the existing seven generic checkboxes.

If `no_current_concern` is selected, do not call Infermedica. Save the positive
baseline and finish the symptom flow.

#### Stage 2 — Adaptive medical interview

For each provider question:

1. backend returns a normalized VITALOOP question DTO;
2. frontend renders only the supplied controlled options;
3. frontend posts selected option IDs;
4. backend validates that every submitted item belongs to the last issued
   question;
5. backend stores evidence;
6. backend resends the full accumulated evidence to `/diagnosis`;
7. backend returns the next question or completion state.

Supported answer states:

- `present`
- `absent`
- `unknown`

Do not label `unknown` as `No` in the UI.

The backend owns the interview state machine. The frontend must not decide which
question comes next and must not calculate medical scores.

#### Stage 3 — Completion and VITALOOP context

When Infermedica returns `should_stop = true`, or an emergency stop condition is
reached:

1. call `/triage` with the complete evidence set;
2. apply the VITALOOP safety merge policy;
3. build and persist the normalized symptom snapshot;
4. display a non-diagnostic summary:
   - primary concern;
   - confirmed observations;
   - explicitly absent observations;
   - unanswered/unknown evidence;
   - safety next step;
   - how this context will be used with lab results;
5. offer `Go to dashboard` and `Upload lab results`.

Do not display provider condition probabilities in v1.

## 8. Language and localization contract

### 8.1 Canonical language

- English is the canonical UI and copy source.
- Canonical internal IDs are language-neutral.
- Never use translated labels as identifiers.
- Never send UA labels into EN-only substring matching.

### 8.2 Frontend dictionaries

Create:

```text
frontend/src/features/symptom-check/i18n/en.js
frontend/src/features/symptom-check/i18n/uk.js
frontend/src/features/symptom-check/i18n/index.js
```

Every local string must have a stable key. Example:

```js
export const symptomCheckEn = {
  root: {
    fatigue_low_energy: 'Energy, fatigue or recovery',
  },
  answers: {
    present: 'Yes',
    absent: 'No',
    unknown: 'Not sure',
  },
}
```

`uk.js` must expose exactly the same key structure. Add a test that fails when
the key sets differ.

### 8.3 Provider model

- EN: use `Model: infermedica-en`.
- UK: prefer the licensed `infermedica-uk` model.
- If the Ukrainian provider model is unavailable, do not machine-translate
  dynamic clinical questions at runtime. Use human-reviewed translations keyed
  by provider concept/question IDs, otherwise fall back to English and log a
  translation coverage metric.

The EN rollout must not wait for the UA rollout, but all implementation code
must be locale-safe from the start.

## 9. Configuration

Add the following settings to `backend/app/config.py`:

```text
infermedica_enabled: bool = False
infermedica_app_id: str = ""
infermedica_app_key: str = ""
infermedica_base_url: str = "https://api.infermedica.com/v3"
infermedica_model_en: str = "infermedica-en"
infermedica_model_uk: str = "infermedica-uk"
infermedica_timeout_seconds: float = 15.0
infermedica_dev_mode: bool = True
infermedica_max_questions: int = 30
infermedica_store_condition_candidates: bool = False
symptom_engine_rollout_percent: int = 0
```

Rules:

- credentials must never use a `VITE_` prefix;
- credentials must never be returned through health/config endpoints;
- application startup must report only whether configuration is present;
- `infermedica_dev_mode` must remain true outside approved production traffic;
- production enablement requires commercial access, DPA/privacy review, and an
  explicit environment change;
- `symptom_engine_rollout_percent` must be validated as `0..100`.

## 10. Backend module layout

Create the following modules:

```text
backend/app/integrations/infermedica/
  __init__.py
  client.py
  schemas.py
  adapter.py
  exceptions.py

backend/app/services/
  symptom_check_service.py
  symptom_concept_mapping.py
  symptom_snapshot.py
  symptom_safety_policy.py

backend/app/routers/protocol/
  symptom_check.py
```

### 10.1 `client.py`

Responsibilities:

- create requests with `App-Id`, `App-Key`, `Interview-Id`, `Model`, and
  `Content-Type` headers;
- set `Dev-Mode: true` when configured;
- call `/info`, `/search`, `/suggest`, `/diagnosis`, `/triage`, and optionally
  `/recommend_specialist`;
- use a shared `httpx.AsyncClient` lifecycle;
- apply strict timeouts;
- retry idempotent requests once for `429`, `502`, `503`, and transport errors
  with bounded jitter;
- never log credentials, request bodies, response bodies, names, or medical
  evidence;
- expose typed provider exceptions.

### 10.2 `schemas.py`

Define Pydantic models for only the fields used by VITALOOP. Provider responses
must be parsed with `extra="allow"` so additive provider changes do not break the
flow, while required identifiers and choice values remain validated.

### 10.3 `adapter.py`

Responsibilities:

- translate Infermedica question types into a stable VITALOOP DTO;
- normalize provider triage levels;
- preserve provider evidence IDs and sources;
- strip condition rankings from the default user response;
- retain model/version metadata;
- reject provider questions that contain no controlled answer items.

### 10.4 `symptom_check_service.py`

This is the workflow owner. It must:

- validate required profile data;
- create/resume/complete sessions;
- enforce a single active session per user;
- validate answers against the last issued question;
- load the complete evidence list for every provider call;
- enforce idempotency for submitted answers;
- perform emergency interruption;
- call triage at completion;
- persist the normalized snapshot;
- write timeline and audit events;
- never make the frontend responsible for provider sequencing.

### 10.5 `symptom_safety_policy.py`

Map provider triage to VITALOOP safety:

| Infermedica | VITALOOP |
|---|---|
| `emergency_ambulance` | `critical_now` |
| `emergency` | `critical_now` |
| `consultation_24` | `urgent_24h` |
| `consultation` | `clinician_review` |
| `self_care` | `routine` |
| missing/error | `insufficient_data` |

Merge rule:

```text
final safety = most conservative(internal safety, provider safety)
```

Provider success must never overwrite an existing internal critical state.
Provider failure must never be interpreted as `routine` or `self_care`.

Provider red-flag collection must use `/suggest` with
`suggest_method=red_flags`; the standalone `/red_flags` endpoint is deprecated.
Persist answers from that question with `source=red_flags`. The safety resolver
must consider both the five-level `triage_level` and every typed
`serious[].seriousness` value. `root_cause=diagnosis_unknown` must not produce a
routine/self-care result.

Internal deterministic red-flag rules execute only after clinical approval.
Draft or clinical-review rules must be ignored at runtime. See
[SYMPTOM_RED_FLAG_CLINICAL_REVIEW_MATRIX.md](./SYMPTOM_RED_FLAG_CLINICAL_REVIEW_MATRIX.md).

## 11. Database design

Create a migration using the repository's Supabase migration workflow. Do not
invent a migration filename manually. Create it with `supabase migration new`
when implementation begins.

All new `public` tables must have RLS enabled. The browser must not write
clinical evidence directly; writes go through authenticated FastAPI endpoints
using the backend service role. Users may receive read access only to their own
session and evidence rows where required by existing architecture.

### 11.1 `symptom_check_sessions`

Required columns:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
status text not null check (status in (
  'active', 'completed', 'skipped', 'unsupported', 'abandoned', 'provider_error'
)),
provider text not null default 'infermedica_engine',
interview_id uuid not null unique,
locale text not null check (locale in ('en', 'uk')),
provider_model text not null,
provider_model_version text,
questionnaire_version text not null,
current_stage smallint not null default 1 check (current_stage between 1 and 3),
overall_wellbeing text,
root_concern_id text not null,
primary_concept_id text,
primary_provider_concept_id text,
duration_bucket text,
last_question jsonb,
last_question_sequence integer not null default 0,
should_stop boolean not null default false,
provider_triage_level text,
provider_triage_root_cause text,
final_safety_level text,
condition_candidates jsonb,
started_at timestamptz not null default now(),
completed_at timestamptz,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

`condition_candidates` must remain null unless both the environment flag and
the provider contract permit storage. It must not be returned by ordinary user
endpoints.

Indexes:

- `(user_id, created_at desc)`;
- partial unique index on `(user_id)` where `status = 'active'`;
- `(status, updated_at)` for cleanup/monitoring.

### 11.2 `symptom_evidence`

Required columns:

```sql
id uuid primary key default gen_random_uuid(),
session_id uuid not null references symptom_check_sessions(id) on delete cascade,
user_id uuid not null references auth.users(id) on delete cascade,
vitaloop_concept_id text not null,
provider_concept_id text,
concept_type text not null check (concept_type in (
  'symptom', 'risk_factor', 'attribute', 'positive_baseline'
)),
choice_id text not null check (choice_id in (
  'present', 'absent', 'unknown'
)),
source text not null check (source in (
  'initial', 'suggest', 'red_flags', 'diagnosis', 'predefined', 'baseline'
)),
is_primary boolean not null default false,
question_id text,
question_sequence integer not null,
display_name_en text not null,
provider_payload jsonb not null default '{}'::jsonb,
recorded_at timestamptz not null default now(),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

Constraints/indexes:

- unique `(session_id, provider_concept_id)` where provider ID is not null;
- unique `(session_id, vitaloop_concept_id, concept_type)` for local facts;
- `(user_id, recorded_at desc)`;
- `(session_id, question_sequence)`;
- `(vitaloop_concept_id, choice_id)` for downstream matching.

An updated answer must update the existing row and preserve an audit event. It
must not create contradictory active rows for the same concept.

### 11.3 `clinical_concept_mappings`

Required columns:

```sql
id uuid primary key default gen_random_uuid(),
vitaloop_concept_id text not null,
provider text not null,
provider_model text not null,
provider_concept_id text not null,
concept_type text not null,
display_name_en text not null,
display_name_uk text,
root_concern_id text,
domain_keys text[] not null default '{}',
active boolean not null default true,
mapping_version text not null,
review_status text not null check (review_status in (
  'draft', 'clinical_review', 'approved', 'retired'
)),
reviewed_by text,
reviewed_at timestamptz,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

Constraints:

- unique `(provider, provider_model, provider_concept_id, mapping_version)`;
- only mappings with `active = true` and `review_status = 'approved'` may be
  shown to production users;
- do not invent provider IDs. Discover them through sandbox `/search`, store the
  returned labels, and require clinical review.

### 11.4 `symptom_provider_events`

Store operational metadata only:

- session/user IDs;
- endpoint name;
- request sequence;
- HTTP status;
- latency;
- provider model/version;
- request/response hashes;
- normalized error code;
- timestamp.

Do not store full request or response bodies in logs or this table.

### 11.5 RLS requirements

- enable RLS on every new table;
- authenticated users may select only rows where `user_id = auth.uid()` for
  session/evidence tables if direct reads remain necessary;
- no authenticated insert/update/delete grants for evidence/session tables;
- concept mappings are read-only to authenticated users only if the frontend
  needs direct catalog access; preferred path is backend catalog endpoint;
- provider events are service-role only;
- verify policies with two different user IDs;
- run Supabase security/performance advisors before the migration is finalized.

### 11.6 `symptom_answer_submissions`

Use a backend-only idempotency ledger for adaptive-answer requests:

- session/user ownership foreign key;
- SHA-256 idempotency-key hash and normalized request hash;
- normalized VITALOOP response payload only, never a raw provider body;
- unique `(session_id, idempotency_key_hash)`;
- RLS enabled with no browser grants or policies;
- service-role access only.

## 12. VITALOOP API contract

Create router prefix `/symptom-check`.

### `GET /symptom-check/catalog/root-concerns`

Returns locale-aware root concerns from approved mappings.

```json
{
  "version": "symptom_catalog_v1",
  "items": [
    {
      "id": "fatigue_low_energy",
      "label": "Energy, fatigue or recovery",
      "available": true
    }
  ]
}
```

### `POST /symptom-check/sessions`

Request:

```json
{
  "overall_wellbeing": "reduced",
  "primary_concern_id": "fatigue_low_energy",
  "locale": "en"
}
```

Response contains session state and controlled initial symptom options. It must
not return provider credentials or provider condition rankings.

### `GET /symptom-check/sessions/current`

Returns an active session, resumable question, and current stage. If there is no
active session, return `session: null`; do not create one as a side effect.

### `POST /symptom-check/sessions/{session_id}/initial-evidence`

Request:

```json
{
  "primary_concept_id": "fatigue",
  "secondary_concept_ids": ["exercise_intolerance"],
  "duration_bucket": "months_1_3"
}
```

The backend maps approved internal concepts to provider evidence, starts the
provider interview, persists the issued question, and returns the first adaptive
question or a safety stop.

### `POST /symptom-check/sessions/{session_id}/answers`

Request:

```json
{
  "question_id": "provider-question-id",
  "answers": [
    {"item_id": "s_123", "choice_id": "present"},
    {"item_id": "s_456", "choice_id": "absent"}
  ]
}
```

Requirements:

- require `X-Idempotency-Key`;
- verify session ownership;
- verify the question matches `last_question`;
- verify every item is allowed by `last_question`;
- reject arbitrary concept IDs and arbitrary answer strings;
- persist atomically before advancing;
- return the same result for an idempotent retry.

Normalized response:

```json
{
  "session_id": "uuid",
  "stage": 2,
  "question": {
    "id": "provider-question-id",
    "type": "single",
    "text": "Do you feel short of breath during normal activity?",
    "items": [
      {"id": "s_123", "label": "Shortness of breath", "allowed_choices": ["present", "absent", "unknown"]}
    ]
  },
  "answered_count": 6,
  "should_stop": false,
  "safety": {"level": "routine", "interrupt": false}
}
```

### `POST /symptom-check/sessions/{session_id}/skip`

May only be used before initial evidence exists. Records an explicit skip and
does not create negative evidence.

### `POST /symptom-check/sessions/{session_id}/abandon`

Marks an incomplete session abandoned. It must not mark onboarding incomplete.

### `GET /symptom-check/sessions/{session_id}/summary`

Returns a non-diagnostic structured summary. Do not return condition candidates
or provider probabilities.

### `GET /symptom-check/history`

Returns completed/skipped sessions for longitudinal display, newest first.

## 13. Provider call contract

Every Infermedica request must use:

```text
App-Id: server secret
App-Key: server secret
Interview-Id: session.interview_id
Model: infermedica-en or infermedica-uk
Content-Type: application/json
Dev-Mode: true in dev/test/synthetic pilot
```

The diagnosis request must include:

- provider-compatible age;
- provider-compatible sex;
- the complete accumulated evidence array;
- one or more `present` initial symptoms;
- evidence `source` exactly as required by the provider;
- the selected interview mode.

Use standard diagnosis mode for the initial pilot because VITALOOP needs richer
symptom evidence, not only the shortest triage. `short_triage` may be evaluated
as a separate experiment, not silently enabled in production.

## 14. Normalized symptom snapshot

Create a stable snapshot builder in `symptom_snapshot.py`.

Contract:

```json
{
  "version": "symptom_snapshot_v1",
  "session_id": "uuid",
  "questionnaire_version": "symptom_check_v3",
  "provider": "infermedica_engine",
  "provider_model": "infermedica-en",
  "provider_model_version": "timestamp-or-version",
  "primary_concern": {
    "vitaloop_concept_id": "fatigue",
    "provider_concept_id": "s_xxx"
  },
  "overall_wellbeing": "reduced",
  "duration_bucket": "months_1_3",
  "evidence": {
    "present": [],
    "absent": [],
    "unknown": []
  },
  "triage": {
    "provider_level": "consultation",
    "root_cause": "consultation_condition_likely"
  },
  "safety": {
    "internal_level": "routine",
    "provider_level": "clinician_review",
    "final_level": "clinician_review"
  },
  "completed_at": "ISO-8601"
}
```

The snapshot is immutable once embedded into a finalized report version. Later
changes create a new symptom session/snapshot; they do not rewrite old reports.

## 15. Integration with the lab analysis pipeline

### 15.1 Required change

Extend `run_lab_analysis_pipeline()` with:

```python
symptom_snapshot: Optional[Dict[str, Any]] = None
```

Do not overload the existing ambiguous `questionnaire` argument.

### 15.2 B2C entry points

Before every B2C pipeline call, load the latest eligible symptom snapshot:

- normal file/PDF upload;
- manual biomarker entry;
- candidate confirmation;
- compatibility/retry paths;
- any background re-analysis that creates a new report version.

The current normal file upload sends no saved questionnaire context. This must
be corrected as part of this implementation.

### 15.3 Backward compatibility

For modules that still accept `List[str] symptoms`:

- derive the list only from snapshot `present` evidence;
- use canonical EN names, never localized labels;
- keep existing string-alias matching as a temporary fallback;
- add exact `vitaloop_concept_id` matching to the domain registry and health
  state engine;
- remove substring matching from the primary path after coverage tests pass.

### 15.4 Downstream consumers

Update these consumers to use the structured snapshot:

- `health_context.py`;
- knowledge evaluation integration;
- `health_state_engine.py`;
- report interpretation symptom links;
- clinical priority planner;
- safety resolver;
- confidence calibration;
- evidence gaps/debt;
- next-best-test and lab-plan services;
- frozen report input snapshot;
- CRM practitioner clinical summary where permitted.

Required rule:

```text
present evidence may support a pattern
absent evidence may weaken a hypothesis
unknown evidence creates an evidence gap
```

Do not convert absent or unknown evidence into symptom penalties.

## 16. Frontend implementation

Create a feature folder:

```text
frontend/src/features/symptom-check/
  api.js
  constants.js
  i18n/
    en.js
    uk.js
    index.js
  components/
    OverallWellbeingStep.jsx
    RootConcernStep.jsx
    InitialEvidenceStep.jsx
    AdaptiveQuestionCard.jsx
    SafetyInterrupt.jsx
    SymptomCheckSummary.jsx
  hooks/
    useSymptomCheckSession.js
```

Refactor `frontend/src/pages/Questionnaire.jsx` into a thin page shell or create
`SymptomCheck.jsx` and route the existing path to it. Do not keep the old and new
clinical intake forms simultaneously visible.

Frontend rules:

- no clinical textarea;
- no numeric 1–10 global severity scale;
- no client-computed domain scores;
- no client-computed urgency;
- no LLM question generation;
- all option values come from backend IDs;
- show one question group at a time;
- support back only where the backend can safely revise evidence;
- resume an interrupted session;
- disable double submission;
- use idempotency keys;
- show provider outage as `Assessment temporarily unavailable`, never as a safe
  result;
- emergency safety screen interrupts the interview and hides ordinary next-step
  controls.

## 17. Existing questionnaire migration strategy

Do not destructively change the existing questionnaire tables in phase 1.

Migration path:

1. add the new tables and API behind a feature flag;
2. preserve old `/questionnaire` endpoints for old sessions/tests;
3. route opted-in EN users to `/symptom-check`;
4. do not automatically map historical free text;
5. keep a read-only legacy summary fallback for reports created before v3;
6. after production validation, stop creating old B2C questionnaire sessions;
7. remove old LLM follow-up generation in a later cleanup release;
8. retain historical rows according to the product retention policy.

## 18. Error handling and fallback

### Provider unavailable

- keep already saved evidence;
- mark the session resumable, not completed;
- return `503 SYMPTOM_PROVIDER_UNAVAILABLE`;
- do not generate a replacement LLM question;
- do not infer `self_care`;
- allow the user to return to the dashboard or retry later;
- lab upload remains available and uses the last completed snapshot only.

### Provider authentication failure

- return a generic user message;
- emit a critical operational alert;
- do not retry `401/403`;
- never expose provider response text containing credentials/configuration.

### Rate limit

- honor `Retry-After` where present;
- retry once server-side;
- return a resumable `429` response if still limited.

### Model mapping drift

- if a provider concept no longer resolves, disable that mapping;
- do not substitute a similar concept automatically;
- alert operations;
- require mapping review before reactivation.

### Question cap

If `infermedica_max_questions` is reached before `should_stop`:

- mark the assessment `insufficient_data`;
- run triage only if the provider supports it for the accumulated evidence;
- do not claim the assessment is complete;
- preserve the evidence for clinician/lab context with a limitation flag.

## 19. Security and privacy

- Provider keys are backend-only secrets.
- Generate a random `Interview-Id`; never reuse the VITALOOP user ID.
- Send only age, provider-compatible sex, and coded evidence.
- Do not send email, name, location, auth tokens, PDFs, or raw lab data.
- Do not log clinical request/response bodies.
- Store operational hashes and metadata instead.
- Apply existing audit logging to reads and writes of medical evidence.
- Apply rate limits to `/symptom-check` endpoints.
- Confirm Infermedica DPA, processing region, retention, subcontractors, and
  request-analysis behavior before production.
- Confirm contract rules for caching concept labels and persisting condition
  candidates.
- Add the external processor to privacy disclosures before rollout.
- Maintain user deletion cascade through `auth.users` foreign keys.

## 20. Observability

Add metrics without symptom content:

- `infermedica_requests_total{endpoint,status}`;
- `infermedica_request_duration_seconds{endpoint}`;
- `infermedica_errors_total{type}`;
- `symptom_check_sessions_total{status,locale}`;
- `symptom_check_completion_rate{locale}`;
- `symptom_check_questions_count` histogram;
- `symptom_check_triage_total{level}`;
- `symptom_mapping_miss_total{model}`;
- `lab_analyses_with_symptom_snapshot_total`;
- `symptom_snapshot_evidence_count{choice}`;
- translation coverage for UA dynamic questions.

Alerts:

- any sustained provider `401/403`;
- provider 5xx/error rate above threshold;
- model version changed;
- mapping misses after a model version change;
- emergency triage without successful persistence;
- main lab upload completing without loading an available completed snapshot.

## 21. Testing requirements

### 21.1 Unit tests

Cover:

- provider request headers without secret leakage;
- provider schema parsing;
- question normalization;
- evidence merge/update behavior;
- `present/absent/unknown` distinction;
- source preservation;
- session ownership;
- idempotent answer submission;
- exact concept mapping;
- triage-to-safety mapping;
- most-conservative safety merge;
- snapshot immutability;
- EN/UK translation key parity;
- no condition candidates in ordinary responses;
- no free-text fields in request schemas.

### 21.2 Provider contract tests

Use `httpx` mocks/fixtures. Do not require live credentials in the normal test
suite.

Fixtures must cover:

- single question;
- grouped question;
- multiple-choice question;
- `should_stop` true/false;
- emergency evidence;
- all five triage levels;
- provider 401, 429, 500, timeout, invalid JSON;
- additive unknown response fields;
- removed/missing mapped concept.

### 21.3 Pipeline tests

Prove that:

- normal PDF upload loads the completed symptom snapshot;
- manual entry loads the snapshot;
- candidate confirmation loads the same snapshot;
- reports freeze the exact snapshot used;
- present evidence reaches domain matching;
- absent evidence can weaken but not support hypotheses;
- unknown evidence creates a gap;
- skipped symptom-check remains distinguishable from no symptoms;
- old reports replay without the new snapshot.

### 21.4 Frontend E2E tests

EN Playwright scenarios:

1. required anthropometrics block onboarding completion;
2. skip symptom-check and reach dashboard;
3. no-current-concern positive baseline;
4. select fatigue root and complete an adaptive interview;
5. choose `Not sure` and verify it is not treated as `No`;
6. resume after refresh;
7. double-click does not duplicate evidence;
8. provider outage gives a resumable error;
9. emergency answer interrupts the flow;
10. upload labs after symptom completion and verify linked context.

UA tests are added after EN behavior is stable and must reuse the same backend
concept IDs.

### 21.5 Clinical validation fixtures

Create synthetic cases for at least:

- fatigue + iron-loss context;
- fatigue + poor sleep;
- thirst + frequent urination + weight loss;
- palpitations + breathlessness;
- hair loss + cold intolerance + weight gain;
- digestive symptoms + blood/black stool red flag;
- numbness/weakness;
- heavy menstrual bleeding;
- good wellbeing/no concern;
- insufficient/unknown answers.

Clinical review must assess question relevance, red flags, triage, interview
length, and conflicts with VITALOOP internal safety.

## 22. Acceptance criteria

The feature is ready for an EN pilot only when all of the following are true:

- required onboarding data is enforced server-side and client-side;
- the new symptom flow contains no clinical free-text input;
- every answer uses stable IDs and controlled values;
- all provider traffic passes through the backend;
- keys never appear in browser bundles, logs, API responses, or tests;
- the interview is resumable and idempotent;
- emergency answers interrupt safely;
- provider failure never produces a false safe result;
- normal PDF upload consumes the latest completed symptom snapshot;
- all B2C lab entry paths use the same snapshot contract;
- structured evidence reaches the internal reasoning services;
- frozen reports preserve provider/model/mapping/snapshot versions;
- condition probabilities are not shown to users;
- legacy users and reports continue working;
- unit, integration, pipeline, security, and EN E2E tests pass;
- a clinician has reviewed the initial root concept mappings and synthetic
  safety cases;
- privacy/DPA/commercial review is complete;
- rollout remains behind a feature flag.

### 22.1 Milestone quality gate

Every milestone must pass the following gate independently. Writing code is
not sufficient to mark a milestone complete.

**Definition of Ready (DoR)**

- scope, non-goals, contracts, dependencies, and owner decisions are explicit;
- required product, clinical, provider, privacy, and infrastructure inputs are
  available, or the milestone is explicitly limited to mock/scaffold work;
- risks, rollback, affected paths, and the required test matrix are recorded;
- acceptance criteria are mapped to executable tests or a named manual review;
- feature flags remain off and no production mutation is required.

**Verification during implementation**

- compare each change with the canonical specification and milestone scope;
- add tests in the same change as the behavior;
- record deviations before implementing them;
- keep a trace from requirement to changed file, test, result, and remaining
  risk in the implementation tracker.

**Definition of Done (DoD)**

- every milestone acceptance criterion has objective evidence;
- targeted unit, contract, integration, security, and relevant E2E tests pass;
- affected regression suites have run and unrelated known failures are listed;
- security, RLS, privacy, failure, idempotency, and rollback behavior have been
  checked where applicable;
- documentation and the implementation tracker reflect the actual state;
- there are no unresolved critical or high-severity defects;
- required clinical/product/provider review is recorded, not inferred;
- the milestone has a tested rollback and does not depend on an unrecorded
  manual production change.

If DoR is incomplete, only explicitly scoped discovery, mocks, contracts, and
reversible scaffolding may proceed. If DoD or acceptance evidence is incomplete,
the milestone remains open.

## 23. Implementation phases for Claude

Claude must implement one phase at a time and verify it before moving forward.

### Phase 0 — Provider and product readiness

- obtain sandbox credentials;
- confirm access to EN model and required endpoints;
- confirm contract, DPA, persistence, and caching terms;
- build the approved root-concept mapping sheet;
- do not touch production traffic.

**Exit:** approved mapping list and working synthetic `/info` request.

### Phase 1 — Persistence and provider adapter

- create Supabase migration;
- add configuration;
- implement provider client/schemas/adapter;
- implement mock-based tests;
- add model-version monitoring.

**Exit:** no UI; provider adapter and schema tests pass.

### Phase 2 — Backend symptom state machine

- implement router/service/safety/snapshot modules;
- implement RLS and ownership tests;
- implement idempotency;
- implement audit/timeline/metrics;
- keep feature flag off.

**Exit:** complete synthetic interview through FastAPI tests.

### Phase 3 — Mandatory onboarding profile

- add age and sex to EN onboarding;
- make age, sex, height, and weight required;
- enforce requirements in backend onboarding completion;
- preserve organization/admin onboarding behavior.

**Exit:** new B2C user cannot reach dashboard with missing required profile data.

### Phase 4 — EN frontend symptom flow

- replace old B2C questionnaire UI with the three-stage flow;
- use EN dictionaries;
- implement resume, skip, unsupported, provider-error, and emergency states;
- remove clinical textareas and local medical scoring.

**Exit:** EN Playwright flow passes against mocked provider responses.

### Phase 5 — Lab pipeline integration

- introduce `symptom_snapshot` contract;
- wire all B2C analysis entry points;
- update structured downstream consumers;
- freeze snapshot into reports;
- preserve legacy behavior.

**Exit:** pipeline tests prove that no completed symptom evidence is lost.

### Phase 6 — EN sandbox pilot

- enable only for internal/test accounts;
- run synthetic clinical matrix;
- review provider/internal safety disagreements;
- measure latency, completion, interview length, mapping misses, and cost;
- keep condition candidates hidden.

**Exit:** documented clinical and technical go/no-go decision.

### Phase 7 — UA presentation layer

- add UK translation dictionary;
- enable official provider UK model if licensed;
- verify concept-ID parity;
- add UA E2E and translation coverage tests.

**Exit:** UA changes labels only; stored evidence and downstream behavior match EN.

### Phase 8 — Gradual production rollout

- 1% internal/allowlist;
- 5%;
- 25%;
- 50%;
- 100% only after safety and completion metrics remain acceptable.

Every step must have a rollback to the previous percentage. Rollback must not
delete sessions or snapshots.

## 24. Claude implementation rules

When executing this specification, Claude must:

1. inspect the current implementation before editing;
2. preserve unrelated user changes and dirty-worktree files;
3. create migrations using the Supabase migration workflow;
4. never apply production migrations without explicit authorization;
5. keep the feature disabled by default;
6. implement tests in the same phase as code;
7. use deterministic mapping and safety logic;
8. never replace a failed provider call with LLM-generated medical content;
9. never expose provider credentials or raw medical payloads in logs;
10. never treat provider condition candidates as confirmed diagnoses;
11. never silently map an unknown or removed provider concept;
12. document any deviation from this specification before implementing it;
13. stop and request product/clinical direction if a required mapping or safety
    decision is ambiguous;
14. finish each phase with changed-file list, tests run, remaining risks, and
    rollback instructions.

## 25. Definition of done

The project is complete when a new EN user can:

1. register;
2. provide required anthropometric/profile data;
3. reach the dashboard;
4. optionally start a structured symptom check;
5. select a primary concern without free text;
6. answer adaptive controlled questions;
7. receive a safe, non-diagnostic next step;
8. upload a lab report;
9. have the exact symptom snapshot included in the lab reasoning pipeline;
10. receive a report that explains symptom–biomarker relationships with
    provenance, confidence, limitations, and evidence gaps;
11. return later and compare new symptoms/labs without rewriting historical
    snapshots.

UA is considered complete when the same journey produces identical internal
concept IDs and decisions while displaying approved Ukrainian copy.
