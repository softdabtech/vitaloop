# VITALOOP Stage 2 — Acceptance Test Matrix (Revision 2)

Planning document only — no tests have been executed as part of producing this document beyond what Stage 1 already ran live (cited where relevant). None of these are run without separate explicit approval, especially Test E (safety) and any test involving the shared production database.

**Revision 2 changes:** Tests A, B, C/C1, D, F are promoted into **Stage 2PRE** (see Implementation Plan) as small backend-level `pytest` integration/unit tests, required to exist and be runnable **before** Stage 2A/2B/2C/2D-1 deploy — not deferred to full Playwright/staging restoration in 2I. Test B's expected outcome is revised to match the persistence-timing design (Stage 2B, Revision 2): a `needs_confirmation` upload has **no `biomarkers` rows written at all** (not merely "hidden" via a status filter), since Stage 2B defers the `save_biomarkers()` write itself rather than adding a confirmation column. Test E's fixtures are now concretely specified (see below) rather than left as an open design item.

All tests assume one dedicated, clearly-tagged synthetic account per test (or reuse of the already-approved `zzz@z.com` account where a pre-existing account is more convenient), never real user data.

| Test | Setup | Steps | Expected outcome | Status prior to Stage 2 (from Stage 1 evidence) |
|---|---|---|---|---|
| **A — Clean high-confidence analysis** | New test user, complete profile+questionnaire | Upload a clean lab (all markers canonical, plausible values, clear reference ranges) | `analysis_status="completed"` immediately; `interpreted_report`+`protocol`+one `report_versions` row generated; no confirmation step required | **Passes today** (this is the "happy path" — Stage 1's live journey confirmed uploads complete mechanically without 5xx) — must remain passing after Stage 2B ships (regression guard for "don't break the working case while fixing the broken one") |
| **B — Low-confidence confirmation** | Same user | Upload a lab with one ambiguous/low-confidence marker | Gate returns `confirm`/`block_or_confirm`; `analysis_status="needs_confirmation"`; **no `biomarkers` rows exist yet for this upload** (`save_biomarkers()` deferred, not merely hidden — verify via a direct read-only check on the `biomarkers` table, not just the API response); **no** `interpreted_report`/`protocol`/`report_versions` row exists yet; candidate shown for review; user calls `confirm-candidates`; pipeline resumes once; `biomarkers` rows now written; final report generated; candidate `status="confirmed"`; exactly one `report_versions` row created (no duplicate) | **Fails today** — live-reproduced in Stage 1: gate said `block_or_confirm`, full report was returned anyway, and (confirmed this revision) canonical `biomarkers` rows were already persisted before the gate even ran. This is F01/Stage 2B's core regression target. Part of Stage 2PRE. |
| **C — Metadata not biomarker** | Same/new user | Upload a lab containing a "Report Date: 2026-07-29" line alongside real markers | Date correctly populates `test_date`/`date_source`; **no** biomarker candidate named "Report Date"/similar is created; the real markers (glucose, TSH, ferritin, vitamin D, LDL) are still extracted correctly | **Fails today** — live-reproduced in Stage 1 exactly as described (F04). Core regression target for Stage 2A. |
| **C.1 — Uncommon legitimate biomarker** | Same | Upload a lab with one marker not in `_CANONICAL_MAP` (e.g. an uncommon specialty marker) plus common ones | Uncommon marker still appears as a candidate (`plausible_unknown` bucket, not silently dropped), common markers unaffected | Not yet tested — new fixture required for Stage 2A (guards against over-filtering) |
| **C.2 — Format variations** | Same | Repeat Test C's document as: plain text, PDF, scanned image (OCR path), simple markdown/table, EU date format (`29.07.2026`), US date format (`07/29/2026`) | All variants correctly separate date metadata from biomarkers | Not yet tested — required fixture set for Stage 2A before deployment |
| **D — Safety warning, no block** | Pediatric-profile test user (age<18), non-dangerous lab values | Upload | `safety_result.status="approved_with_warnings"`, `pediatric_context` event present, `doctor_discussion_required` visible in UI (banner) | **Partially fails today** — the field is computed and present in the API response (Stage 1 live evidence), but frontend rendering of the banner was not confirmed either way; must be verified before/after Stage 2C |
| **E — Hard safety block/redaction** | Two sub-tests, both now concretely specified (Implementation Plan §Stage 2C item 5): **E1** — direct unit test calling `safety_engine.validate_report()` with synthetic text `"Based on your results, you have early-stage diabetes."` (no live upload needed). **E2** — pediatric profile (age<18) + biomarker values known to trigger the deterministic rule-based (non-AI) protocol template for low ferritin/low vitamin D, via the audit test account or a fresh tagged one. | E1: `status=="blocked"`, diagnosis-like flag in `blocked_items`, redaction helper produces expected neutral text. E2: `sanitize_protocol_for_safety` redacts the dosage text; **the same redacted content appears in both `protocols.recommendations` and `report_versions.protocol`** (regression guard for the newly-found sanitization gap, Implementation Plan §Stage 2C item 2-3). | **Fails today** by definition — no hard-block content consequence exists yet, and (new finding this revision) `protocols.recommendations` — what `get_results` actually serves — bypasses sanitization entirely even where it's already computed. **E1 has no live-account risk (pure unit test) and can run as soon as Stage 2C code exists; E2 uses only synthetic/tagged data per existing audit discipline and still requires separate explicit approval before running against any shared environment.** |
| **E.3 — `severity:"high"` alone does not hard-block** | Pediatric profile, no sensitive-dosage/diagnosis content | Upload | `status=="approved_with_warnings"`, not `blocked` | Confirmed correct today (regression guard, not a fix target) — must stay true after Stage 2C ships |
| **F — Longitudinal correct order** | Test user with no prior uploads (or a fresh account, to isolate from audit-test noise) | Upload A: `test_date=2026-08-20`. Upload B (uploaded second, chronologically earlier lab): `test_date=2026-07-20` | `/progress` (the live-reachable endpoint) shows chronology July→August, not upload order; `dashboard.summary.latest_lab_result` reflects the August date, not whichever was uploaded last | **Fails today** on the live-reachable `/progress` endpoint (F03, confirmed via code trace, not yet forced live in this exact configuration) — `/progress/overview` already passes this class of test (Stage 1 live-verified) |
| **G — Month-later trend** | Same test user as F, or fresh | Upload two labs 30 days apart by `test_date`: one marker improved, one worsened, one stable, one new, one missing from the second | Correct `date_span_days`; correct `direction` per marker; correct clinical `comparison_status` (see API contract doc — `improved`/`worsened`/`stable`/`new`/`missing`, explicitly distinct from raw `direction`); explicit new/missing state (not just inferred from date staleness) | **Partially passes today** — Stage 1 live-verified `/progress/overview` gets direction/dates right; explicit `comparison_status`/new/missing fields do not exist yet (API contract doc, new fields) |
| **H — Check-in loop** | Test user with an active protocol | `POST /checkins` | Check-in marked completed; `next_best_action` changes (no longer "Run weekly check-in" for the current week); timeline reflects the event; no fabricated clinical/biomarker score change; legitimate adherence-component score change is fine | **Fails today** — live-reproduced in Stage 1: dashboard was byte-identical before/after (F05) |
| **I — Historical report version** | Test user with one completed report (V1) | Note V1 content. In a controlled test-only config, bump a KB/prompt-version constant. `GET` the same `upload_id` again | V1 content unchanged. Then explicitly call `regenerate`: V2 created, V1 still separately fetchable, UI indicates version/date | **Fails today** — confirmed via code trace: `get_results` always recomputes fresh against current config (F08) |
| **J — Entitlement session durability** | Premium test user | login → logout → login → password reset → login | Premium status unchanged throughout, since entitlement is account-bound not session-bound | **Not fully tested in Stage 1** (account was already logged in and premium at session start) — code trace this stage confirms entitlement writes can't be accidentally touched by onboarding/password-reset flows, but the full login/logout/reset/login sequence needs an explicit live pass. Separately: confirm the React Query cache-clear-on-logout fix (Implementation Plan §B, entitlement session hygiene) so a *different* user logging in on the same tab doesn't see stale cached entitlements — this is a distinct sub-case from "does my own premium survive," worth its own assertion. |
| **K — User isolation** | Two distinct test users, A and B | As A, attempt to fetch B's uploads, report versions, biomarkers, check-ins, progress, profile by ID/enumeration | All attempts fail (403/404, not data leakage) | **Not tested in Stage 1** — flagged as an explicit gap; should run before any Stage 2 deployment as a baseline security regression check, independent of the functional fixes above |
| **L — EN/UA medical parity** | Same underlying report/data | Fetch the same report/analysis via EN and UA locale | Identical biomarkers, statuses, health states, safety verdict, evidence, trend meaning; only wording/labels differ | **Passes today** — confirmed at the code level in both Stage 1 and this stage's re-check (no locale branches any numeric threshold or decision). Should still be included as an automated regression test so it stays true after Stage 2 changes land (especially Stage 2C's redaction text, which must exist correctly in both locales). |

## Notes on execution order

- Tests A, C, C.1, C.2 should be automated and passing **before** Stage 2A deploys (they define the fix).
- Test B should be automated and passing before Stage 2B deploys; Test A must be re-run as a regression guard in the same CI pass (a fix to the broken path must not break the working path).
- Test D should be checked (frontend banner presence) before Stage 2C; Test E's exact synthetic scenario needs a short design pass (see Implementation Plan) and separate explicit approval before it is ever run, even in a test environment, since it deliberately probes safety-critical content generation.
- Test F must be automated and passing before Stage 2D-1 deploys.
- Test H before Stage 2E; Test I before Stage 2G; Test J and K are environment/security baseline checks that should run once staging is repaired (Stage 2I) and then on every subsequent stage as a standing regression suite, not stage-specific.
- Test L should run as a standing parity check across every stage that touches report/safety content (2A, 2C, 2G especially).

## Fixture design (for Stage 2A specifically, per the Implementation Plan)

Each fixture is a plain-text lab document (image/PDF variants generated from the same text where the OCR path needs separate coverage):

```
Fixture: clean_panel_v1.txt
Patient: AUDIT-TEST
Report Date: 2026-07-28
Glucose: 92 mg/dL (Ref: 70-99)
TSH: 2.1 mIU/L (Ref: 0.4-4.0)
Ferritin: 45 ng/mL (Ref: 20-250)
Vitamin D, 25-OH: 18 ng/mL (Ref: 30-100)   [abnormal - low]
LDL Cholesterol: 105 mg/dL (Ref: <130)
```

```
Fixture: uncommon_marker_v1.txt
(same header)
Lipoprotein(a): 45 nmol/L (Ref: <75)   [uncommon, not in canonical alias map]
Glucose: 92 mg/dL (Ref: 70-99)
```

```
Fixture: eu_date_format_v1.txt
Дата звіту: 29.07.2026
Глюкоза: 5.1 ммоль/л (Норма: 3.9-5.5)
```

Second-lab-later fixtures (for Tests F/G): identical structure, `test_date` fields set 30 days apart, with the specific improved/worsened/stable/new/missing marker pattern the Implementation Plan's Stage 2D section specifies (mirrors what Stage 1's live journey already successfully constructed and validated against `/progress/overview`).
