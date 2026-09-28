# VITALOOP Symptom Safety — Clinical and Copy Sign-off Packet

**Status:** AWAITING NAMED CLINICAL AND PRODUCT APPROVERS
**Scope:** EN cabinet, Milestone 4
**Production status:** disabled by feature flags
**Related matrix:** [SYMPTOM_RED_FLAG_CLINICAL_REVIEW_MATRIX.md](./SYMPTOM_RED_FLAG_CLINICAL_REVIEW_MATRIX.md)

## 1. What the approvers are signing

The clinical approver confirms that:

1. each approved exact-ID rule has an appropriate urgency and interruption behavior;
2. controlled EN questions capture the intended warning sign without free text;
3. `unknown` is not treated as `absent`;
4. provider triage may escalate but never lower internal urgency;
5. the emergency/urgent copy below is safe, non-diagnostic, and does not create false reassurance;
6. the synthetic cases cover positive, negative, boundary, provider-failure, and conflict scenarios.

The product approver confirms that the approved copy and blocking interaction
will be used unchanged in the EN cabinet.

## 2. Evidence basis

- Infermedica five-level triage and serious-observation contract:
  https://developer.infermedica.com/documentation/engine-api/build-your-solution/triage/
- Infermedica red flags through `/suggest`:
  https://developer.infermedica.com/documentation/engine-api/build-your-solution/suggest-related-concepts/
- NHS emergency-service guidance:
  https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/
- NHS heart-attack/emergency symptom guidance:
  https://www.nhs.uk/conditions/heart-attack/
- CDC stroke action guidance:
  https://www.cdc.gov/stroke/signs-symptoms/index.html
- American Heart Association heart-attack warning guidance:
  https://www.heart.org/en/health-topics/heart-attack/warning-signs-of-a-heart-attack

The sources are evidence inputs, not a substitute for the named clinical
approver's review of VITALOOP's exact rules and copy.

## 3. Proposed EN safety copy

All text is a candidate until both approval sections are signed.

### `emergency_ambulance`

- **Title:** `Get emergency help now`
- **Body:** `Your answers may indicate a serious medical emergency. This symptom check cannot determine the cause.`
- **Action:** `Call your local emergency number now. Do not drive yourself. If possible, ask someone to stay with you and follow the emergency dispatcher’s instructions.`
- **Primary action label:** `Call emergency services`
- **Interaction:** blocking; hide ordinary Next/Back/Upload actions.

### `emergency`

- **Title:** `Seek emergency care now`
- **Body:** `Your answers may indicate a serious problem that needs emergency assessment.`
- **Action:** `Go to the nearest emergency department now. If you cannot get there safely, call your local emergency number. Do not drive yourself.`
- **Primary action label:** `Get emergency help`
- **Interaction:** blocking; hide ordinary Next/Back/Upload actions.

### `urgent_24h`

- **Title:** `Contact a medical professional within 24 hours`
- **Body:** `Your answers indicate that prompt medical assessment is appropriate.`
- **Action:** `Arrange medical care within 24 hours. If symptoms suddenly worsen or you develop an emergency warning sign, call your local emergency number.`
- **Primary action label:** `View next steps`

### `clinician_review`

- **Title:** `Arrange a medical consultation`
- **Body:** `A medical professional should review these symptoms.`
- **Action:** `Schedule a consultation. Seek urgent help sooner if symptoms worsen.`
- **Primary action label:** `View next steps`

### `insufficient_data`

- **Title:** `We could not complete a safe assessment`
- **Body:** `This does not mean that nothing is wrong.`
- **Action:** `Try the symptom check again or contact a medical professional. If symptoms are severe or rapidly worsening, call your local emergency number.`
- **Primary action label:** `Try again`
- **Interaction:** never display self-care reassurance.

### `routine`

- **Title:** `Monitor how you feel`
- **Body:** `Your answers did not trigger an urgent next step in this symptom check.`
- **Action:** `Monitor your symptoms and contact a medical professional if they persist, worsen, or new symptoms appear.`
- **Primary action label:** `Continue`
- **Constraint:** do not say “you are healthy,” “nothing is wrong,” or “no medical care is needed.”

## 4. Mandatory copy acceptance checks

- [ ] Uses “may indicate”; never states or implies a diagnosis.
- [ ] Uses “local emergency number”; does not hard-code 911/999/112 globally.
- [ ] Emergency states clearly advise against driving oneself.
- [ ] `insufficient_data` cannot render routine/self-care copy.
- [ ] Emergency UI is blocking and cannot continue the interview.
- [ ] No condition probabilities or suspected diagnosis names are shown.
- [ ] Copy remains understandable without knowing the provider triage terms.
- [ ] Accessibility review covers focus, screen-reader announcement, color independence, and keyboard control.
- [ ] Legal/privacy review confirms no additional sensitive data is exposed.

## 5. Clinical-rule review

For every row promoted from draft to approved in the clinical matrix, record:

| Rule ID | Decision | Final urgency | Approved question/version | Evidence reference | Notes |
|---|---|---|---|---|---|
|  | approve / reject / revise |  |  |  |  |

No blank or unsigned row may be copied into
`APPROVED_INTERNAL_RED_FLAG_RULES`.

## 6. Synthetic-case review

Machine-readable cases:
`backend/tests/fixtures/symptom_safety_cases.json`

| Case ID | Expected decision clinically correct? | Question relevance | Copy/action correct? | Notes |
|---|---|---|---|---|
| `digestive_black_stool` |  |  |  |  |
| `palpitations_with_syncope` |  |  |  |  |
| `heavy_menstrual_bleeding` |  |  |  |  |
| `severe_breathing_difficulty` |  |  |  |  |
| `good_wellbeing_no_concern` |  |  |  |  |
| `insufficient_unknown_answers` |  |  |  |  |

## 7. Required signatures

### Clinical approval

- Name:
- Professional title/specialty:
- Registration/licence jurisdiction and identifier:
- Organization:
- Decision: `APPROVED / APPROVED WITH CHANGES / REJECTED`
- Approved matrix version:
- Approved EN copy version:
- Required changes:
- Date:
- Signature or verifiable approval reference:

### Product approval

- Name:
- Role:
- Decision: `APPROVED / APPROVED WITH CHANGES / REJECTED`
- Required changes:
- Date:
- Signature or verifiable approval reference:

### Engineering verification after approval

- Approved rows copied exactly into runtime registry:
- Copy keys copied exactly into EN dictionary:
- Unit/contract/E2E run reference:
- Feature flags remain off:
- Reviewer:
- Date:

Current pre-approval engineering evidence: the backend adaptive-answer path
interrupts on internal emergency and is idempotent under retry. Browser-level
blocking behavior remains pending the EN symptom-check UI.

## 8. Approval integrity rule

Codex/Claude/LLM output, repository authorship, automated tests, and source
citations do not count as clinical sign-off. Approval is complete only when a
named qualified clinician provides a verifiable decision for the exact matrix
and copy version above.
