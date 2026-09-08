# VITALOOP: production user-flow audit, 2026-09-08

## Verdict

NOT READY for a claim of reliable paid clinical output. Login, Premium access,
two uploads, extraction, confirmation, report navigation and protocol navigation
worked. Critical completeness and cross-page safety inconsistencies remain.
This was an audit; application code, deployment and service configuration were
not changed. Two synthetic CSV uploads were intentionally added to zzz@z.com.

## Test inputs and results

Existing account: zzz@z.com. Premium active, Personal access.
Existing symptom context was retained, not edited: severe fatigue, weakness,
dizziness, palpitations, brain fog, cramps and worsening symptoms.
Both files explicitly identify themselves as synthetic, not real patient data.
No new users, password reset or signup operations were performed. No payment
was made. Server-generated notification delivery was not independently verified.

| Item | Baseline | Follow-up |
| --- | --- | --- |
| File | vitaloop-audit-20260908-baseline.csv | vitaloop-audit-20260908-followup.csv |
| Lab date in source and history | 2026-08-10 | 2026-09-08 |
| Upload/result ID | 13f270f4-ba61-4844-be7d-f8c6d983b445 | b814d46b-b829-4fe2-91a7-7a0c59b86b94 |
| Input markers | 12 | 12 |
| Extracted candidates visibly reviewed | 12 | 12 |
| Confirmed in browser | 12 | 12 |
| Markers in final table after reopening | 10 | 10 |
| Result generated | Yes | Yes |
| Prompt medical review warning | Not shown | Shown |

Input values (baseline -> follow-up): hemoglobin 10.2 -> 8.9 g/dL;
platelets 118 -> 62 10^9/L; ANC 1.2 -> 0.45 10^9/L;
potassium 3.3 -> 2.6 mmol/L; ferritin 9 -> 5 ng/mL; MCV 74 -> 70 fL;
CRP 12 -> 48 mg/L; creatinine 1.2 -> 1.8 mg/dL; glucose 142 -> 186 mg/dL;
HbA1c 6.8 -> 7.6%; ALT 62 -> 98 U/L; albumin 3.3 -> 2.9 g/dL.
Laboratory reference ranges were supplied in both CSVs.

## P0 findings

1. **Confirmed hematology markers disappear.** Platelets and ANC are visible
   with correct values/units during confirmation but absent from BOTH final
   biomarker tables. Users receive no visible explanation of these exclusions.
   The history also reports only 10 review markers per new upload.
   Local code has a plausible mechanism: `_continue_confirmed_safe_subset()` in
   `backend/app/services/lab_analysis_pipeline.py` excludes integrity-conflicted
   markers after confirmation. `clinical_data_integrity.py` recognizes
   `x10^9/L`, but its listed families/aliases do not include the source's English
   `10^9/L` spelling. This is a code-supported hypothesis, not a traced live DB
   root cause. Persistence itself could not be independently queried.

2. **Urgency is not propagated to the dashboard.** After the follow-up report
   displayed prompt medical review guidance, Today still displayed
   `No urgent red flags reported.`, `Open Lab Plan` and `No action plan yet`.
   The report's action plan exists and opens. Even if the dashboard phrase
   refers only to symptom red flags, its unqualified Safety label is misleading.

3. **Urgent output conflicts with action/retest output.** Follow-up Results and
   Protocol both list potassium retest as `6-12 weeks`, while Results explicitly
   calls for prompt medical review. Protocol begins `Small actions to start with
   now` and gives liver/iron actions first, rather than carrying forward the
   report's urgent warning as its primary action. The observed inconsistency
   violates the application's intended urgent-review behavior; this audit does
   not prescribe an alternative clinical interval.

4. **User-facing protocol safety remains incomplete.** Follow-up Protocol shows
   `CKD Management Protocol` with `RAAS inhibition if proteinuric, BP < 130/80,
   dietary protein moderation`. Iron retains `morning with food`; Potassium
   retains `daily with meals` despite dosage-withheld notices. Hypokalaemia
   Correction is visibly corrupted: `K < 3.Discuss whether this step ...` and
   `... clinician.5 or symptomatic.` Exact previously reported potassium doses
   and IV replacement instructions were not visible in the inspected pages,
   but this is not a full-payload sanitizer PASS.

## P1 and product findings

- Both reports expose unresolved `{{ast_value}} {{ast_unit}}` placeholders.
- `This month` contains `6-12 weeks`.
- `approved_with_warnings` is exposed as an unexplained implementation status.
- Low and very low ferritin produce repetitive recommendations and questions.
- Severe-case recommendations are not prioritized consistently with the warning.
- Protein advice attributes low albumin to intake/absorption without showing
  evidence supporting that attribution, alongside a separate protein-moderation
  recommendation. These recommendations require consistency review.
- All but one marker per clean CSV were labelled low confidence; one was medium.
  Confirmation is functional, but there is no explanation of why it is needed.
- Billing confirms Premium but still says `Upgrade when you are ready`.
- Homepage advertises $9.99/month; Billing offers only manually activated,
  invite-based Premium and an Email us button. No checkout is available.
- Desktop results were readable without obvious overlap in the inspected
  viewport. Information quality, repetition and prioritization are the larger
  defects. Mobile, export and a newly submitted check-in were not tested.

## Longitudinal behavior

The history retained both actual lab dates, not today's upload date. It showed
17 total uploads including pre-existing data. Clinical Progress compares latest
results with the nearest available historical samples: e.g. glucose 91 on
2026-09-07 -> 186 on 2026-09-08. It does NOT isolate this audit's 29-day pair.
That comparison is legitimate for the account's mixed history but must not be
reported as a clean two-file clinical experiment.

Platelets still showed an OLD comparison (2026-08-20 -> 2026-09-05), while the
new files' platelet values were absent from their final tables. ANC appeared
under not-yet-comparable markers. The changed-marker dates are visible, but the
page's generic latest-result description does not explain the missing new data.
The dashboard Track progress control routes to `/lab-results`.

## Technical observation and limits

- Browser login succeeded and Premium was visible.
- Local Upload.jsx uses POST `/analyze/pdf`, GET
  `/analyze/{id}/candidates`, then POST `/analyze/{id}/confirm-candidates`.
- Both browser uploads reached candidate review; confirming reached a final
  result that remained readable after opening a new tab.
- Local confirmation endpoint calls `run_lab_analysis_pipeline` with
  `persist_biomarkers=True`, `persist_report_version=True` and confirmed
  candidates. Frontend navigates after a successful confirmation request without
  checking the returned `analysis_status`; this is an additional code-review
  risk, not a reproduced blocked confirmation in this run.
- Local Results.jsx fetches `/results/{uploadId}`. Local report_history.py
  computes sanitized explainability but still returns raw explainability at
  line 177; this warrants a dedicated regression test. Live full-payload
  exposure was not verified in this run.
- Direct authenticated API reads from the audit script returned 403 for
  `/auth/me`, the first `/results/{id}` and candidates endpoint, while browser
  access worked. The reason (edge policy, request context or application policy)
  was not established. These 403s are NOT evidence that browser requests failed.
- No complete network trace, per-service timing, DB row counts or report-version
  checks were obtained. Do not treat this report as an all-endpoint PASS.

## Server incident observed

At 14:42 UTC, SSH read-only checks showed:

```text
vitaloop-backend.service:
MainPID=0
Result=exit-code
NRestarts=10027
ActiveState=activating
SubState=auto-restart
```

Journal entries repeatedly showed exit status 1 and scheduled restarts. Both
local port 8004 health and public `/health/ready` returned ready:true. The
process actually serving the healthy endpoint was not identified. A subsequent
SSH connection was refused; no recovery actions were attempted. This is a
serious monitoring/runtime ownership inconsistency, not proof of total outage.

## Recommended repair order

1. Identify which process serves port 8004 and why the systemd service loops.
2. Preserve valid platelet/ANC units through confirmation; show any exclusions.
3. Use one urgent safety state across Results, Protocol, Today and retest actions.
4. Sanitize every returned protocol field, including timing and frozen output;
   suppress incomplete templates and malformed text instead of displaying them.
5. Verify the same two saved reports after fixes, then test an isolated pair for
   longitudinal comparison. Align the advertised purchase flow with actual access.

No fixes, restarts, deployment or schema changes were performed during this audit.
