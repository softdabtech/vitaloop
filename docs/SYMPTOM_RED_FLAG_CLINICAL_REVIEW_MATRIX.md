# Symptom Red-Flag Clinical Review Matrix

**Status:** DRAFT — NOT ACTIVE
**Milestone:** 4 — Safety layer
**Canonical UI:** EN
**Rule:** no row may enter `APPROVED_INTERNAL_RED_FLAG_RULES` until a clinician records approval, reviewer, date, exact concept IDs, urgency, and user-facing action.

## Technical contract already implemented

- Provider red-flag suggestions use Engine API `POST /suggest` with
  `suggest_method=red_flags`; the deprecated standalone `/red_flags` endpoint
  is not used.
- Answers are controlled `present / absent / unknown` values and preserve
  `source=red_flags`.
- Provider urgency considers `triage_level`, `serious[].seriousness`, and
  `root_cause=diagnosis_unknown`.
- Internal rules match exact stable concept IDs only. Labels, substring
  matching, free text, and LLM classification cannot trigger a rule.
- Only `review_status=approved` rules execute. The active built-in rule set is
  intentionally empty pending clinical review.
- External triage may raise urgency but may never lower an internal decision.
- Machine-readable technical and draft clinical cases live in
  `backend/tests/fixtures/symptom_safety_cases.json`.

## Authoritative contract sources

- Infermedica Engine API red flags:
  https://developer.infermedica.com/documentation/engine-api/build-your-solution/suggest-related-concepts/
- Infermedica five-level triage and serious observations:
  https://developer.infermedica.com/documentation/engine-api/build-your-solution/triage/
- Infermedica stateless diagnosis/evidence-source contract:
  https://developer.infermedica.com/documentation/engine-api/build-your-solution/diagnosis/
- NHS ambulance guidance examples:
  https://www.scas.nhs.uk/wp-content/uploads/2025/03/Easy-Read_When-should-I-call-999.pdf
- NHS clinical red-flag pathway reference:
  https://www.hweclinicalguidance.nhs.uk/all-clinical-areas-documents/download?checksum=f64bc3f6056a55cc6744d2342dd95aac&cid=2875&document=22&field=2

These sources support candidate review; they do not by themselves constitute
VITALOOP clinical approval.

## Candidate matrix for clinical decision

| Candidate rule ID | Proposed exact VITALOOP signal IDs | Proposed trigger | Draft level | Source basis | Clinical status | Required decision |
|---|---|---|---|---|---|---|
| `rf_breathing_severe` | `breathing_difficulty_severe_now` | single present | emergency | ambulance guidance | draft | Approve exact wording, exclusions, and action. |
| `rf_loss_of_consciousness` | `loss_of_consciousness_now` | single present | emergency | NHS red-flag pathway | draft | Define current vs recent episode and action. |
| `rf_stroke_face` | `new_facial_droop` | single present | emergency | FAST pathway | draft | Approve whether any single FAST sign interrupts. |
| `rf_stroke_arm` | `new_one_sided_weakness` | single present | emergency | FAST pathway | draft | Approve laterality/onset qualifiers. |
| `rf_stroke_speech` | `new_speech_difficulty` | single present | emergency | FAST pathway | draft | Approve exact controlled question. |
| `rf_chest_pain` | `chest_pain_persistent_now` | single present | emergency | NHS chest-pain guidance | draft | Define duration and associated-feature handling. |
| `rf_major_bleeding` | `major_uncontrolled_bleeding` | single present | emergency | ambulance guidance | draft | Define “major/uncontrolled” without free text. |
| `rf_gi_bleeding` | `vomiting_blood`, `black_tarry_stool`, `visible_blood_in_stool` | individual or combination | unresolved | synthetic-case requirement | draft | Choose emergency vs urgent-24h by exact signal/combination. |
| `rf_palpitations_syncope` | `palpitations`, `syncope_or_near_syncope` | combination | unresolved | synthetic-case requirement | draft | Approve urgency and timing qualifiers. |

## Review record required per approved rule

- stable rule ID and exact stable concept IDs;
- controlled EN question and answer choices;
- individual/combination logic;
- urgency and interruption behavior;
- exclusions, age/sex/pregnancy modifiers, and unknown-answer behavior;
- evidence/reference identifier;
- clinician name/role, review date, and mapping version;
- synthetic positive, negative, boundary, and conflict fixtures;
- approved EN emergency/urgent copy;
- rollback instruction.

## Milestone 4 acceptance trace

| Acceptance requirement | Implementation evidence | Test evidence | Status |
|---|---|---|---|
| Provider cannot de-escalate internal urgency | `symptom_safety_policy.py` | `test_provider_can_never_deescalate_internal_emergency` | PASS |
| Completion path evaluates accumulated internal evidence | `symptom_check_service.py` | integrated internal-emergency/provider-self-care workflow test | PASS |
| Missing/unknown provider result is not self-care | `resolve_provider_safety()` | provider failure and `diagnosis_unknown` tests | PASS |
| Provider outage is sanitized and resumable | `submit_initial_evidence()` fail-closed boundary | provider-unavailable workflow test | PASS |
| Provider serious observations can escalate | typed triage schema + safety merge | emergency serious-observation test | PASS |
| Use current provider red-flag flow | `InfermedicaClient.red_flags()` | `/suggest` method contract test | PASS |
| Controlled red-flag answers only | `normalize_red_flag_question()` | controlled-choice adapter test | PASS |
| Red flags precede ordinary diagnosis question | `submit_initial_evidence()` | workflow ordering test | PASS |
| Only approved internal rules execute | `symptom_red_flag_policy.py` | draft/approved/exact-ID tests | PASS |
| Emergency interrupts interview | safety decision `interrupt` | emergency merge/rule tests | PASS (unit) |
| Adaptive answer interrupts and is idempotent | `/symptom-check/sessions/{id}/answers` | backend emergency-interruption/idempotency workflow test | PASS (backend) |
| Clinical matrix approved | this document | named clinician review | BLOCKED |
| Synthetic clinical cases represented | `symptom_safety_cases.json` | fixture completeness + contract-matrix tests | PASS (technical) |
| Synthetic clinical cases reviewed end-to-end | draft fixtures/pilot | clinician sign-off | BLOCKED |
| EN emergency copy drafted | `SYMPTOM_SAFETY_SIGNOFF_PACKET.md` | mandatory copy checklist | PASS (draft) |
| EN emergency copy approved | sign-off packet | product + clinical signatures | BLOCKED |
| Browser emergency interruption | pending EN frontend | Playwright | BLOCKED |

Milestone 4 remains open until all three blocked rows are complete.
