# VITALOOP — Domain Model V2

Status: Target domain design for rebuild
Created: 2026-04-17
Reference: TECHNICAL_MODULES_IMPLEMENTATION.md, REBUILD_TARGET_ARCHITECTURE.md

---

## 1. Purpose

This document defines the canonical domain model for VITALOOP v2. It specifies:
- Bounded contexts and their aggregate roots
- Entity definitions with fields, invariants, and lifecycle states
- Relationships and ownership rules
- Events emitted by each context

This is the source of truth for typed DTOs, OpenAPI schemas, DB table design, and frontend API clients.

---

## 2. Bounded Context Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VITALOOP Domain                             │
│                                                                     │
│  ┌──────────┐   ┌───────────┐   ┌──────────────┐   ┌──────────┐  │
│  │   IAM    │   │    Lab    │   │   Clinical   │   │Engagement│  │
│  │          │   │ Ingestion │   │   Protocol   │   │& Tracking│  │
│  └────┬─────┘   └─────┬─────┘   └──────┬───────┘   └────┬─────┘  │
│       │               │                │                │         │
│  ┌────▼─────┐   ┌─────▼─────┐   ┌──────▼───────┐   ┌────▼─────┐  │
│  │Questionnaire  │  Billing  │   │     CRM      │   │Operations│  │
│  └──────────┘   └───────────┘   └──────────────┘   └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

Context interactions are event-driven or via explicit API calls — no direct cross-context DB joins in application code.

---

## 3. IAM Context

### 3.1 User (Aggregate Root)

| Field | Type | Notes |
|---|---|---|
| id | UUID | Supabase auth UID |
| email | string | unique, immutable after verification |
| created_at | timestamp | |
| updated_at | timestamp | |

Invariants:
- `email` must be verified before accessing protected routes.
- `id` maps 1:1 with Supabase auth user.

### 3.2 UserProfile

| Field | Type | Notes |
|---|---|---|
| user_id | UUID | FK → User.id, PK |
| full_name | string? | |
| date_of_birth | date? | |
| sex | enum: male / female / other / prefer_not | |
| timezone | string | IANA tz, default UTC |
| onboarding_completed | bool | default false |
| onboarding_step | string? | last completed step key |
| created_at | timestamp | |
| updated_at | timestamp | |

### 3.3 UserLocation

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| country | string | ISO 3166-1 alpha-2 |
| region | string? | |
| city | string? | |
| is_primary | bool | only one primary per user |
| created_at | timestamp | |

### 3.4 Subscription

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| tier | enum: free / premium / team | |
| status | enum: active / past_due / canceled / trialing | |
| stripe_customer_id | string? | |
| stripe_subscription_id | string? | |
| current_period_start | timestamp? | |
| current_period_end | timestamp? | |
| created_at | timestamp | |
| updated_at | timestamp | |

Invariants:
- A user may have at most one active subscription.
- `premium` tier required for analyze and protocol endpoints.

### 3.5 Role Model

Roles are embedded in JWT claims — no roles table required.

| Role | Scope | Permissions |
|---|---|---|
| `end_user` | Own data | Access own lab, protocol, progress, insights |
| `practitioner` | Org-scoped | Access assigned clients' data within org |
| `crm_admin` | Org-scoped | Org management, invitations, member ops |
| `super_admin` | Platform-wide | All endpoints including admin |

Role resolution order:
1. Decode JWT claims from Supabase.
2. Check `app_metadata.role` for global roles.
3. Check `organization_memberships` for org-scoped roles (DB fallback if not in claims).

### 3.6 IAM Domain Events

| Event | Trigger | Consumers |
|---|---|---|
| `user.registered` | new auth user | UserProfile auto-create, onboarding init |
| `user.email_verified` | Supabase email confirm | unlock analyze path |
| `subscription.activated` | Stripe webhook success | unlock premium paths |
| `subscription.canceled` | Stripe webhook cancel | restrict premium paths |

---

## 4. Lab Ingestion Context

### 4.1 LabUpload (Aggregate Root)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| filename | string | original filename |
| storage_path | string | Supabase Storage path |
| file_size_bytes | integer | |
| mime_type | string | |
| status | enum (see below) | |
| ocr_raw_text | text? | extracted raw content (retention policy applies) |
| extraction_error | string? | populated on failure |
| uploaded_at | timestamp | |
| processed_at | timestamp? | |
| deleted_at | timestamp? | soft delete for retention |

Status lifecycle:
```
pending → extracting → extracted → analyzing → analyzed
                          │
                       failed_extraction
                                         │
                                      failed_analysis
```

Invariants:
- `ocr_raw_text` is subject to retention policy (default 90 days, then redacted).
- Only one `analyzed` upload per user generates an active protocol (latest wins).

### 4.2 Biomarker

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| upload_id | UUID | FK → LabUpload.id |
| user_id | UUID | FK → User.id |
| name | string | canonical biomarker name |
| value | float | measured value |
| unit | string | measurement unit |
| reference_min | float? | lab reference range min |
| reference_max | float? | lab reference range max |
| status | enum: normal / low / high / critical_low / critical_high | |
| category | string | e.g. metabolic, hormonal, immune |
| source_text | string? | raw text segment it was extracted from |
| created_at | timestamp | |

Invariants:
- `value` must be a finite positive number.
- `status` is derived on write from value + reference range; never set independently.

### 4.3 Lab Domain Events

| Event | Trigger | Consumers |
|---|---|---|
| `lab.upload_received` | file accepted | OCR extraction job |
| `lab.extraction_completed` | OCR done, biomarkers written | Protocol context |
| `lab.extraction_failed` | OCR or parse error | Notification context (user alert) |
| `lab.retention_redacted` | retention job runs | Audit log |

---

## 5. Clinical Protocol Context

### 5.1 Protocol (Aggregate Root)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| upload_id | UUID | FK → LabUpload.id |
| user_id | UUID | FK → User.id |
| version | integer | auto-increment per upload |
| status | enum: generating / ready / failed | |
| llm_model | string | model used to generate |
| generated_at | timestamp? | |
| created_at | timestamp | |

### 5.2 ProtocolSection

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| protocol_id | UUID | FK → Protocol.id |
| section_type | enum: summary / deficiencies / recommendations / lifestyle / supplements / follow_up | |
| content | text | rendered markdown or structured JSON |
| sort_order | integer | display ordering |

### 5.3 HealthScore

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| upload_id | UUID | FK → LabUpload.id |
| overall_score | float | 0–100 |
| metabolic_score | float? | |
| hormonal_score | float? | |
| immune_score | float? | |
| cardiovascular_score | float? | |
| calculated_at | timestamp | |

### 5.4 HealthFailure

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| upload_id | UUID | FK → LabUpload.id |
| biomarker_id | UUID? | FK → Biomarker.id |
| failure_type | enum: critical_low / critical_high / pattern / composite | |
| severity | enum: warning / alert / critical | |
| description | string | |
| created_at | timestamp | |

### 5.5 Clinical Domain Events

| Event | Trigger | Consumers |
|---|---|---|
| `protocol.generation_started` | extraction_completed received | Status update, UI polling |
| `protocol.ready` | LLM response written | Engagement context (insight gen), Notification context |
| `protocol.failed` | LLM error | Notification context |
| `health_failure.detected` | critical biomarker on extraction | Red flag creation in Engagement |

---

## 6. Engagement and Tracking Context

### 6.1 WeeklyCheckIn (Aggregate Root)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| week_start | date | Monday of the check-in week |
| energy_score | integer | 1–10 |
| sleep_score | integer | 1–10 |
| mood_score | integer | 1–10 |
| digestion_score | integer | 1–10 |
| notes | text? | |
| submitted_at | timestamp | |

Invariants:
- One check-in per user per `week_start`.
- All score fields must be in range 1–10.

### 6.2 Symptom

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| symptom_key | string | canonical symptom identifier |
| label | string | display label |
| severity | enum: mild / moderate / severe | |
| reported_at | timestamp | |

### 6.3 RecurringComplaint

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| complaint_text | string | |
| first_reported_at | timestamp | |
| last_reported_at | timestamp | |
| occurrence_count | integer | |

### 6.4 Insight

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| insight_type | enum: biomarker / trend / recommendation / check_in / protocol | |
| title | string | |
| body | text | |
| priority | enum: low / medium / high / critical | |
| dismissed | bool | default false |
| dismissed_at | timestamp? | |
| source_ref | UUID? | reference to source entity (upload_id, checkin_id, etc.) |
| created_at | timestamp | |

### 6.5 RedFlagEvent

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| trigger_type | enum: health_failure / symptom_cluster / protocol_flag | |
| severity | enum: warning / alert / critical | |
| title | string | |
| description | text | |
| acknowledged | bool | default false |
| acknowledged_at | timestamp? | |
| source_ref | UUID? | |
| created_at | timestamp | |

### 6.6 TimelineEvent

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| event_type | enum: upload / protocol / checkin / symptom / insight / assignment | |
| title | string | |
| summary | string? | |
| occurred_at | timestamp | |
| source_ref | UUID? | |
| created_at | timestamp | |

### 6.7 Notification

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| notification_type | enum: system / protocol_ready / red_flag / check_in_reminder / assignment | |
| title | string | |
| body | string | |
| read | bool | default false |
| read_at | timestamp? | |
| action_url | string? | deep link |
| created_at | timestamp | |

### 6.8 Engagement Domain Events

| Event | Trigger | Consumers |
|---|---|---|
| `insight.created` | protocol.ready or trend detection | Notification context |
| `red_flag.detected` | health_failure.detected | Notification context, email dispatch |
| `checkin.submitted` | user submits check-in | Timeline context, Insight generation |
| `notification.read` | user marks read | Analytics |

---

## 7. Questionnaire Context

### 7.1 Questionnaire (Catalog Entity)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| title | string | |
| description | string? | |
| version | integer | |
| is_active | bool | |
| created_at | timestamp | |

### 7.2 QuestionnaireQuestion (Catalog Entity)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| questionnaire_id | UUID | FK → Questionnaire.id |
| text | string | question prompt |
| dimension | enum: energy / sleep / mood / digestion / stress / cognitive / hormonal / immune | |
| response_type | enum: scale_1_10 / text / multiple_choice | |
| sort_order | integer | |
| is_followup_eligible | bool | true = LLM follow-up enabled for low scores |
| low_score_threshold | integer | default 4 — triggers follow-up |

### 7.3 QuestionnaireSession (Aggregate Root)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User.id |
| questionnaire_id | UUID | FK → Questionnaire.id |
| status | enum: in_progress / completed / abandoned | |
| completion_score | float? | 0–100, calculated on completion |
| dimension_scores | jsonb | map of dimension → score (0–100) |
| llm_summary | text? | generated on completion |
| started_at | timestamp | |
| completed_at | timestamp? | |

### 7.4 QuestionnaireAnswer

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| session_id | UUID | FK → QuestionnaireSession.id |
| question_id | UUID | FK → QuestionnaireQuestion.id |
| answer_value | integer? | for scale responses |
| answer_text | text? | for text/free responses |
| is_followup | bool | true if LLM-generated follow-up |
| followup_to_answer_id | UUID? | parent answer this follows up on |
| answered_at | timestamp | |

Invariants:
- `answer_value` must be 1–10 for `scale_1_10` type.
- A `is_followup = true` answer must have `followup_to_answer_id` set.
- Sessions with `completed` status must have `completion_score` and `dimension_scores` populated.

### 7.5 Questionnaire Domain Events

| Event | Trigger | Consumers |
|---|---|---|
| `session.completed` | all questions answered | Engagement context (insight gen), Timeline event |
| `session.followup_generated` | LLM follow-up created | Session state update |

---

## 8. CRM Operations Context

### 8.1 Organization (Aggregate Root)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| name | string | |
| slug | string | URL-safe identifier, unique |
| plan | enum: starter / professional / enterprise | |
| owner_user_id | UUID | FK → User.id |
| is_active | bool | |
| created_at | timestamp | |
| updated_at | timestamp | |

### 8.2 OrganizationMember

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| org_id | UUID | FK → Organization.id |
| user_id | UUID | FK → User.id |
| role | enum: admin / practitioner / viewer | |
| joined_at | timestamp | |
| is_active | bool | |

Invariants:
- A user may belong to multiple organizations with different roles.
- Only one `admin` per organization may exist as the primary owner (owner_user_id).

### 8.3 Invitation

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| org_id | UUID | FK → Organization.id |
| invited_by_user_id | UUID | FK → User.id |
| email | string | invitee email |
| role | enum: admin / practitioner / viewer | |
| token | string | secure random token |
| status | enum: pending / accepted / expired / revoked | |
| expires_at | timestamp | |
| accepted_at | timestamp? | |
| created_at | timestamp | |

### 8.4 Client (End User under CRM scope)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| org_id | UUID | FK → Organization.id |
| user_id | UUID? | FK → User.id, null if not yet registered |
| external_id | string? | org's own reference ID |
| full_name | string | |
| email | string | |
| status | enum: active / inactive / onboarding | |
| created_at | timestamp | |
| updated_at | timestamp | |

### 8.5 Practitioner

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| org_id | UUID | FK → Organization.id |
| user_id | UUID | FK → User.id |
| specialty | string? | |
| bio | text? | |
| is_active | bool | |
| created_at | timestamp | |

### 8.6 PractitionerAssignment

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| org_id | UUID | FK → Organization.id |
| practitioner_id | UUID | FK → Practitioner.id |
| client_id | UUID | FK → Client.id |
| assigned_by_user_id | UUID | FK → User.id |
| status | enum: active / completed / paused | |
| notes | text? | |
| assigned_at | timestamp | |
| ended_at | timestamp? | |

### 8.7 Program

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| org_id | UUID | FK → Organization.id |
| name | string | |
| description | text? | |
| duration_weeks | integer? | |
| is_template | bool | false = instance, true = reusable template |
| created_by_user_id | UUID | FK → User.id |
| created_at | timestamp | |

### 8.8 ClientProgram

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| program_id | UUID | FK → Program.id |
| client_id | UUID | FK → Client.id |
| practitioner_id | UUID | FK → Practitioner.id |
| status | enum: active / completed / paused / canceled | |
| start_date | date | |
| end_date | date? | |
| created_at | timestamp | |

### 8.9 Intervention

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| program_id | UUID | FK → Program.id |
| title | string | |
| description | text? | |
| intervention_type | enum: supplement / lifestyle / dietary / clinical / exercise | |
| frequency | string? | e.g. "daily", "3x per week" |
| sort_order | integer | |

### 8.10 ClientQuestionnaire

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| org_id | UUID | FK → Organization.id |
| client_id | UUID | FK → Client.id |
| practitioner_id | UUID | FK → Practitioner.id |
| questionnaire_id | UUID | FK → Questionnaire.id |
| session_id | UUID? | FK → QuestionnaireSession.id |
| assigned_at | timestamp | |
| due_date | date? | |
| status | enum: assigned / in_progress / completed / overdue | |

### 8.11 CRM Domain Events

| Event | Trigger | Consumers |
|---|---|---|
| `org.created` | new organization | Billing context (plan init) |
| `member.invited` | invitation sent | Email dispatch |
| `member.joined` | invitation accepted | Org membership created |
| `assignment.created` | practitioner assigned to client | Timeline event for client |
| `program.started` | client program activated | Timeline event |
| `questionnaire.assigned` | client questionnaire created | Notification to client |

---

## 9. Billing Context

### 9.1 StripeEvent (Append-Only Log)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| stripe_event_id | string | Stripe event ID (idempotency key) |
| event_type | string | e.g. `customer.subscription.updated` |
| payload | jsonb | full Stripe event payload |
| processed | bool | |
| processed_at | timestamp? | |
| created_at | timestamp | |

Invariants:
- `stripe_event_id` must be unique (deduplicate replay).
- Payload stored immutably — never mutated after insert.

### 9.2 Billing Domain Events

| Event | Trigger | Consumers |
|---|---|---|
| `subscription.activated` | Stripe checkout.session.completed | IAM context: subscription upsert |
| `subscription.updated` | Stripe subscription update event | IAM context: tier/status update |
| `subscription.canceled` | Stripe cancellation event | IAM context: status → canceled |

---

## 10. Cross-Context Relationship Map

```
User (IAM)
  ├── UserProfile (IAM)
  ├── Subscription (IAM)
  ├── LabUpload (Lab) ──→ Biomarker (Lab)
  │                   └─→ Protocol (Clinical) ──→ ProtocolSection
  │                   └─→ HealthScore (Clinical)
  │                   └─→ HealthFailure (Clinical) ──→ RedFlagEvent (Engagement)
  ├── WeeklyCheckIn (Engagement)
  ├── Symptom (Engagement)
  ├── Insight (Engagement)
  ├── TimelineEvent (Engagement)
  ├── Notification (Engagement)
  └── QuestionnaireSession (Questionnaire) ──→ QuestionnaireAnswer

Organization (CRM)
  ├── OrganizationMember (CRM) ──→ User (IAM ref)
  ├── Invitation (CRM)
  ├── Client (CRM) ──→ User (IAM ref, optional)
  ├── Practitioner (CRM) ──→ User (IAM ref)
  ├── PractitionerAssignment (CRM)
  ├── Program (CRM) ──→ Intervention
  ├── ClientProgram (CRM)
  └── ClientQuestionnaire (CRM) ──→ QuestionnaireSession (Questionnaire ref)
```

Cross-context references use UUID only. No ORM joins across context boundaries in application code.

---

## 11. Invariant Summary

| Invariant | Context | Enforcement Point |
|---|---|---|
| One active subscription per user | IAM | Subscription insert/update handler |
| Premium required for analyze | IAM | `dependencies.py` subscription gate |
| Upload status follows defined lifecycle | Lab | `LabUpload` status transition validation |
| One check-in per user per week | Engagement | DB unique constraint on (user_id, week_start) |
| Scores must be 1–10 | Engagement, Questionnaire | Schema validation (Pydantic) |
| StripeEvent deduplicated by event ID | Billing | DB unique constraint on stripe_event_id |
| Session completion requires all scores | Questionnaire | Service-layer guard before status = completed |
| Org slug unique | CRM | DB unique constraint |

---

## 12. Entity Versioning and Audit

All aggregate root mutations must produce an `audit_logs` record:

| Field | Type |
|---|---|
| id | UUID |
| actor_user_id | UUID |
| action | string (e.g. `lab_upload.created`, `subscription.canceled`) |
| entity_type | string |
| entity_id | UUID |
| before_state | jsonb? |
| after_state | jsonb? |
| request_id | string |
| created_at | timestamp |

Enforcement: service-layer decorator or mixin — not at repository layer.
