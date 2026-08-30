# VITALOOP Stage 2 — Implementation Plan (Revision 2)

**Status: PLAN ONLY. Nothing implemented.** This revises the prior plan per explicit corrections. Source of truth remains live deployed code, re-verified this revision with one additional targeted trace (biomarker-table consumers, `protocols` vs `report_versions.protocol`).

---

## Summary of what changed in this revision

1. **Stage 2A scoped down** to exactly: prompt exclusion + one metadata-field classifier + uncommon-marker regression fixtures. No `_PLAUSIBLE_LIMITS` consolidation, no unknown-marker taxonomy, no physiological-validation architecture — those are removed from 2A and not scheduled anywhere in Stage 2.
2. **Stage 2B redesigned around a traced fact, not a proposed column:** the live `biomarkers` table has **no** confirmation/status field (schema confirmed: `id, upload_id, user_id, name, value, unit, ref_low, ref_high, status[clinical flag], category, created_at`), and all 6 live read paths (dashboard, progress, insights/health-score, report generation, protocol generation via `get_biomarkers_by_upload`/`get_recent_biomarker_history`/`get_user_progress`/`calculate_health_score`) read `biomarkers` **unconditionally, with no status filter**. Adding a new column and retrofitting 6 read sites is *more* invasive than the alternative: **defer the `save_biomarkers` write itself until the gate decision is known**, reusing the pattern the confirm-candidates endpoint already correctly implements. This means pending/unconfirmed values are structurally incapable of leaking into any consumer, because they're never written to the canonical table in the first place — no read-path auditing of 6 call sites required, no new column required.
3. **New Stage 2PRE** — minimum regression harness, first in the order, resolving the contradiction between "tests required before 2B" and "test infra restoration is 2I."
4. **`users.plan_tier` addition dropped entirely from Stage 2H.** Nothing touches it in Stage 2. Tracked as a future entitlement-consolidation decision only.
5. **2D-2 reclassified from deferred/optional to a required product-completion stage**, sequenced after 2G, before 2H.
6. **Stage 2C's test design is now concrete** (not "needs a design pass"): two-tier — direct unit tests against `safety_engine.py` functions with synthetic text (deterministic, doesn't depend on LLM stochasticity) for the diagnosis-like-wording trigger, plus one end-to-end pediatric/iron-deficiency fixture for the dosage-redaction trigger via the deterministic rule-based protocol path.
7. **New finding surfaced by this revision's trace, folded into Stage 2C:** `protocols.recommendations` (what `get_results` actually serves today) is **never safety-sanitized at all** — only `report_versions.protocol` (which nothing currently reads) goes through `sanitize_protocol_for_safety`. This means Stage 2C's redaction work would have **zero live effect** unless it also fixes what gets saved into `protocols`. Folded into Stage 2C's scope below — this is a small, contained addition, not a new stage.
8. **Stage 2G's protocol question is now answered from live evidence, not deferred:** `protocols` and `report_versions.protocol` are not a deliberate live/frozen split — they diverge because of an apparent oversight (different variables wired to each write), and **no per-item completion-state UX exists anywhere in the backend** (no `protocol_completions` table, no per-item mutation found), so switching `get_results`'s read source cannot "revert checked-off items" because no such state exists to revert. See Stage 2G below for the resolved design.

---

## A. Revised priority table

| Tier | Item |
|---|---|
| **MUST FIX** | Quality gate must withhold reports, via deferred canonical-biomarker persistence (F01) · Safety `blocked` must withhold/redact content, **including the newly-found `protocols` sanitization gap** (F02) · Metadata-as-biomarker filtering, minimal scope (F04) · Legacy `/progress` sort fix (F03) · `Insights.jsx` live client-side clinical judgments |
| **REQUIRED, sequenced after MUST-FIX** | 2D-2: wire the canonical `test_date`-driven longitudinal engine into an actual user-visible surface — reclassified from optional cleanup to required product completion, since without it VITALOOP has no live surface at all showing correct longitudinal trends |
| **SHOULD FIX NEXT** | Check-in loop wiring (F05) · Dashboard fake-metric bugs (F07) · Report reproducibility (F08) · B2B `needs_review` · entitlement session-cache hygiene |
| **STRUCTURAL CLEANUP** | FKs on 7 pipeline tables (F09) · `symptoms` table split (F11) · check-in↔report linkage (F12) · dead frontend clinical-logic files · duplicate API routes. **`plan_tier` addition removed from this tier — do nothing to it in Stage 2.** |
| **DEFERRED** | Dead AI-provider env vars, vestigial naming, unused OCR service, stale Stripe remnants, staging repair, test-suite restoration (full Playwright/xUnit), git/doc drift, future `plan_tier` reference removal (entitlement consolidation, not in Stage 2) |

---

## B. Final stage order

```
Stage 2PRE  Minimum regression harness
Stage 2A    Metadata filtering — minimal only
Stage 2A.5  Disable live frontend clinical judgments (Insights.jsx tabs)
Stage 2B    Quality gate + confirmation + canonical-biomarker persistence boundary
Stage 2C    Existing safety verdict enforcement (+ protocols-table sanitization fix)
Stage 2D-1  Legacy /progress chronology fix
Stage 2E    Check-in loop
Stage 2F    Dashboard integrity
Stage 2G    Frozen report reproducibility (protocol-source resolved)
Stage 2D-2  Wire canonical longitudinal engine into real UX — REQUIRED, not deferred
Stage 2H    Schema cleanup (FKs, symptoms split, checkin linkage — excludes plan_tier)
Stage 2I    Full staging/tests/dead-code/ops cleanup
```

No dependency evidence this revision argues for a different order than requested; the one internal reorder (2D-2 after 2G, before 2H) matches the given structure exactly.

---

## Stage 2PRE — Minimum Regression Harness

**1. Objective:** Have a reliably repeatable (not necessarily full-Playwright) test for the specific behaviors 2A–2D-1 change, before any of them ships.

**2. Scope — exactly 5 test cases, backend-level, not full E2E:**
- **A** (clean high-confidence) — a `pytest` integration test calling `run_lab_analysis_pipeline` (or the `/analyze` route directly against a local/staging-once-repaired backend) with a clean fixture, asserting `analysis_status == "completed"` and report/protocol present.
- **B** (confirmation flow) — same, with a deliberately ambiguous fixture, asserting `analysis_status == "needs_confirmation"`, no `interpreted_report` in the response, then calling `confirm-candidates` and asserting exactly one `report_versions` row results.
- **C/C1** (metadata vs. legitimate uncommon biomarker) — pure unit tests against the new classifier function (Stage 2A) with the fixture set from the acceptance-test doc; no live HTTP call needed, fastest and most reliable tier.
- **D** (safety warning baseline) — unit test against `safety_engine.validate_report`/`validate_protocol` directly with synthetic pediatric-profile input, asserting `approved_with_warnings` + `doctor_discussion_required`, no `blocked_items`.
- **F** (out-of-order lab dates) — integration test against `get_user_progress` directly (function-level, not full HTTP round-trip) with two synthetic `lab_uploads` rows inserted with out-of-order `test_date`s, asserting return order.

**3. Explicitly NOT required for 2PRE:** Playwright, xUnit CRM suite, full staging environment repair (staging's dead Supabase project is a separate, larger fix, tracked in 2I). These tests can run against `backend/tests/` using the existing pytest infrastructure (already present and largely intact per Stage 1's finding — only the *frontend* Playwright and *CRM* xUnit suites were found missing; the Python backend test directory itself was not reported missing) plus a local/dev DB or a lightweight fixture-based approach that doesn't require a fully-repaired staging Supabase project for the pure-unit tests (C/C1, D).

**4. Where this runs:** For A/B/F (which need a real DB round-trip), the cleanest option is a disposable test schema/project rather than waiting on staging's full repair — flagged as an open decision (§C, unresolved decisions) since it affects timeline: either (a) fast-track just the staging Supabase DNS fix as a narrow pre-step ahead of full 2I, or (b) use a temporary local Postgres/Supabase-CLI ephemeral instance for these specific tests. C/C1 and D need no DB at all (pure function-level unit tests) and can start immediately regardless of that decision.

**5. Acceptance criteria for 2PRE itself:** all 5 tests exist, are runnable on demand (CI or manual), and are RED (failing) against current production code for B, C, C1 (metadata case), and F — confirming they actually exercise the bugs Stage 2 fixes, not false-positive passes. Test A and D should already be GREEN against current code (regression guards for the working paths).

**6. Risk/rollback:** N/A — test-only, no production code touched.

**7. Dependency:** blocks 2A/2B/2C/2D-1 deployment per the Deployment Order doc; does not block 2A.5 (pure frontend removal, no backend test dependency).

---

## Stage 2A — Metadata filtering (minimal scope only)

**1. Objective:** Metadata (dates, IDs, patient info) must not become biomarkers. Nothing else changes in this stage.

**2. User-visible problem:** Live-reproduced "Report Date" → fake biomarker (Stage 1).

**3. Current live behavior:** No prompt exclusion instruction; no name/plausibility filtering anywhere in the pipeline (confirmed: `_validate_biomarker_payload`, `_normalize_biomarker_item`, `_sanitize_extracted_biomarkers`, `normalize_biomarkers` all only check name/value/unit presence).

**4. Desired behavior — exactly two layers, nothing more:**
- **Layer 1 (prompt):** add an explicit exclusion instruction to `backend/app/prompts/extract_biomarkers.txt` naming the metadata categories from the brief (Report Date, Collection Date, Order Date, DOB, Patient ID, Specimen ID, Accession Number, Lab Number, Page Number, Age, Phone, Address, Provider, Doctor, Reference Number) with 2-3 concrete inline examples.
- **Layer 2 (one reusable classifier, one call site):** add a single function `is_metadata_field(raw_name: str, value, unit, ref_low, ref_high) -> bool` to `backend/app/services/lab_normalization/biomarker_mapping.py` (new function in the existing file — not a new module, not a rewrite of `to_canonical_name`). Mechanism: (a) denylist match against the metadata-category terms above (EN + UA/RU equivalents, mirroring the existing alias-table pattern already in the file) OR (b) a narrow structural check: value in the 1900–2100 range (year-like) combined with a reference range matching a calendar bound (`ref_low`/`ref_high` within 1–31 or 1–12 or a 4-digit-year span). This is the *only* new logic added — no consolidation of `_PLAUSIBLE_LIMITS`, no new confidence taxonomy. Call this function from exactly one place: `normalize_biomarkers()` in `lab_analysis_pipeline.py`, immediately excluding a match from the candidate list before anything else in that function runs, with an `metadata_fields_excluded` counter for observability.
- **Explicitly unchanged in this stage:** `_PLAUSIBLE_LIMITS` stays exactly where it is (`clinical_data_integrity.py`, untouched); unknown-marker handling stays exactly as it is today (unrecognized names still fall through `to_canonical_name`'s existing slugify-fallback and are accepted as candidates, unchanged) — this is precisely how uncommon legitimate biomarkers continue to pass through untouched, since Layer 2 only excludes things that match the metadata check, not things that merely fail to match the canonical dictionary.

**5. Exact live files/functions:** `backend/app/prompts/extract_biomarkers.txt` (prompt text only); `backend/app/services/lab_normalization/biomarker_mapping.py` (one new function); `backend/app/services/lab_analysis_pipeline.py:218-278` (`normalize_biomarkers`, one new filter call at the top of the loop).

**6–14. (Backend/frontend/DB/API/migration/compatibility/B2B/locale/security):** Unchanged from Revision 1 — no schema, no API contract change, no B2B/locale impact, purely a candidate-list filter.

**15. Tests required before deployment:** Stage 2PRE's C/C1 unit tests, plus the fixture set in the acceptance-test doc (format variations, EU/US dates). These are the *only* tests gating this stage — no broader regression suite required given the narrow scope.

**16–23:** Unchanged from Revision 1 (low risk, no dependencies, ships first).

---

## Stage 2A.5 — Disable live frontend clinical judgments

Unchanged from Revision 1 — see prior plan content (remove/unmount `Insights.jsx`'s Trends/Alerts tabs; no backend dependency; low risk; ships independently).

---

## Stage 2B — Quality gate + confirmation + canonical-biomarker persistence boundary

**1. Objective:** Make `analysis_input_quality_gate.decision` actually govern whether data becomes a trusted canonical `biomarkers` row and whether a confident report/protocol is generated — resolved via **persistence timing**, not a new status column, per the traced evidence that no read path filters on any such column today.

**2. User-visible problem:** Unchanged from Revision 1.

**3. Current live behavior (re-confirmed this revision):**
- `biomarker_extraction_candidates` are written first, unconditionally (unchanged finding).
- Canonical `biomarkers` rows are written by `save_biomarkers()` **before** the pipeline (and therefore the gate) is invoked, at 3 of 4 call sites (`analyze.py:561` file-upload, `:928` legacy multipart-to-`/analyze`, `:1150` text path) — the 4th (`:1357`, `confirm-candidates`) already correctly writes biomarkers only *after* the user has acted, which is the pattern this stage generalizes.
- `biomarkers` table schema has **no confirmation/status column** — the only `status` field present is the required clinical flag (HIGH/LOW/OPTIMAL), set at insert time, unrelated to confirmation.
- All 6 live consumers of `biomarkers` (`get_biomarkers_by_upload` → report/protocol generation; `get_recent_biomarker_history` → trend evaluation inside the pipeline; `get_user_progress` → progress + dashboard; `calculate_health_score` → dashboard/insights health score) read unconditionally, with zero status filtering at read time.

**4. Desired behavior (per the target state you specified):**
```
Extraction → candidates persisted (unchanged, unconditional — raw capture stays low-risk)
Gate: auto_continue → candidates' values promoted → save_biomarkers() called → pipeline continues → report/protocol/report_version generated
Gate: confirm / block_or_confirm → candidate rows persist as today → save_biomarkers() is NOT called → no report/protocol/report_version → analysis_status = "needs_confirmation"
User confirms → confirm-candidates promotes confirmed values → save_biomarkers() called (already correct today at this call site) → pipeline resumes once → report/protocol/version generated
```
Because `save_biomarkers()` is the *only* write path into the table every one of the 6 read consumers relies on, and it is now called **only** on `auto_continue` or post-confirmation, **no read path anywhere in the system can ever see unconfirmed data** — the boundary is enforced structurally at the single write chokepoint, not by auditing/patching 6 separate read call sites. This directly satisfies "the canonical-vs-pending data boundary must be correct system-wide" without a schema change.

**5. Exact live files/functions:**
- `backend/app/services/lab_analysis_pipeline.py:694-1001` (`run_lab_analysis_pipeline`) — restructure so the gate (currently computed at line 713-719 using only in-memory normalized biomarkers/candidates, **no DB round-trip required** for this computation) runs, and the function branches immediately after: on `confirm`/`block_or_confirm`, return an abbreviated result (candidates + gate + integrity only, no `save_biomarkers` call, no `interpreted_report`/`protocol`/`report_versions` construction); on `auto_continue` (or when called with `confirmation_override=True` from the confirm-candidates path), proceed exactly as today including calling `save_biomarkers()` **from within the pipeline function itself** (moved here from the 4 scattered call sites in `analyze.py`, so there is exactly one write chokepoint instead of four).
- `backend/app/routers/analysis/analyze.py`: remove the 3 pre-pipeline `save_biomarkers()` calls (lines ~561, ~928, ~1150) — the pipeline now owns this write. Keep candidate persistence (`build_candidate_payloads`/`save_biomarker_extraction_candidates`) exactly where it is, unconditional, before the pipeline call.
- `POST /{upload_id}/confirm-candidates` (`analyze.py:1330-1397`): pass `confirmation_override=True` into the pipeline call (already calls the pipeline with persistence flags today — add the new parameter).
- `GET /{upload_id}` (`get_results`, `analyze.py:1400-1490`): check `lab_uploads.analysis_status` before deciding what to build/return — if `needs_confirmation`/`blocked`/`failed`, return the abbreviated state instead of invoking the full pipeline.
- New `lab_uploads.analysis_status` column (DB change plan, unchanged from Revision 1 — this one *is* still needed, it's the upload-level state tracker; only the `biomarkers`-table status idea is dropped).

**6. Backend changes:** As above — this is a moderate, contained control-flow reorganization (moving 4 scattered write call sites into 1, inside a function whose gate-computation step already runs before any of them), not a rewrite of extraction/normalization logic.

**Idempotency / duplicate-report prevention, "user leaves and returns," historical pending rows, B2B `needs_review`:** unchanged from Revision 1 — see that plan's reasoning, still valid under this revised persistence-timing design.

**7–14 (Frontend/DB/API/migration/compatibility/B2B/locale/security):** Unchanged from Revision 1 except: no `biomarkers`-table schema change of any kind (dropped); `lab_uploads.analysis_status` unchanged from Revision 1's DB plan.

**15–18 (Tests/verification/rollback):** Stage 2PRE's Test A + Test B become the primary before/after gate for this stage (already scoped for exactly this). Feature-flag (`ENFORCE_QUALITY_GATE`) retained from Revision 1 given this remains the highest-risk stage.

**19. Risk level:** Medium-High (unchanged assessment — still the stage with the most user-visible behavior change for a subset of uploads), but the actual code change is now *smaller* than Revision 1's plan implied (moving 4 call sites to 1, not introducing a new column threaded through 6 read paths).

**20-23:** Unchanged from Revision 1.

---

## Stage 2C — Safety verdict enforcement (existing semantics only, + protocols-sanitization fix)

**1. Objective:** Enforce the `blocked`/redaction consequences the safety engine *already computes*, using only existing severity/status semantics. **No new thresholds (no potassium/hemoglobin/etc.) — confirmed out of scope, unchanged from Revision 1.**

**2. New finding this revision, folded into scope:** `protocols.recommendations` (the flat list `get_results` actually serves to users **today**) is built from the **pre-sanitization** `recommendations` variable in `lab_analysis_pipeline.py:776-779` and is **never** passed through `sanitize_protocol_for_safety` — only the separately-constructed, doubly-sanitized `protocol` object (which flows into `report_versions.protocol`, itself confirmed **never read by any live router today**) gets sanitized. **This means the safety redaction this stage is meant to enforce currently has no live effect at all**, regardless of what Stage 2C does to `sanitize_protocol_for_safety` itself, unless the fix also reaches what's saved into `protocols`.

**3. Fix (small, contained addition to this stage's existing scope):** Apply the same sanitization (`sanitize_protocol_for_safety`, or a shared helper extracted from it) to the flat `recommendations` list in `lab_analysis_pipeline.py` **before** it's returned/passed to every `save_protocol`/`save_protocol_for_upload` call site, so both `protocols.recommendations` and `report_versions.protocol` reflect the same sanitized content. This does not change the sanitization logic itself (no new triggers, no new thresholds) — it only closes the gap where one of the two storage locations was bypassing it.

**4. Diagnosis-like-wording redaction (report-text level):** extend the same pattern — when `validate_report`'s `blocked_items` contains a diagnosis-like-wording flag, redact/rewrite the specific offending sentence(s) in `interpreted_report`'s text fields (not withhold the whole report), using the existing locale-aware replacement-text pattern (`_clinician_review_dosage_text` style) already established for the dosage case.

**5. Concrete, deterministic test fixtures (resolved this revision, not deferred):**
- **Diagnosis-like wording trigger:** since this depends on LLM-generated free text (non-deterministic), the reliable regression test is a **direct unit test calling `safety_engine.validate_report()`** with a synthetic report-text string containing a known-matching pattern (e.g. `"Based on your results, you have early-stage diabetes."`) — asserts `status == "blocked"`, `blocked_items` contains the diagnosis-like flag, and (post-fix) the redaction helper produces the expected neutral replacement text. This does not depend on ever getting the live LLM to reliably reproduce such phrasing.
- **Sensitive-supplement-dosage-in-pediatric-context trigger:** use the **deterministic rule-based protocol path** (`_protocol_sections_from_ai_and_rules`, not the AI-orchestrated path, which is non-deterministic) with a pediatric profile (`age < 18`) and a biomarker combination known to trigger the existing low-ferritin/low-vitamin-D rule template (needs one direct read of the rule template content to confirm it currently emits explicit numeric dosage language — flagged as a one-file verification step before finalizing the exact fixture values, not a design unknown, just an unconfirmed detail). Asserts `sanitize_protocol_for_safety` redacts the dosage text for this profile, and that the *same* redacted content now appears in both `protocols.recommendations` and `report_versions.protocol` (regression guard for the fix in item 3 above).
- **`severity: "high"` alone must not trigger a hard block** — regression-tested by asserting a plain `pediatric_context` event with *no* sensitive-dosage/diagnosis-wording content still resolves to `approved_with_warnings`, not `blocked` (this is already the correct live behavior per the traced code — the test exists to guard against regressing it, not to change it).

**6-14:** Unchanged from Revision 1's safety matrix and impact analysis, with the `protocols`-sanitization fix folded in as described above (touches `lab_analysis_pipeline.py` and the `save_protocol*` call sites — same files already in scope, no new file surface).

**15-23:** Unchanged from Revision 1, using the concrete fixtures above instead of the previously-open test-design item.

---

## Stage 2D-1 — Legacy `/progress` chronology fix

Unchanged from Revision 1: `.order()` fix on `get_user_progress`, plus (now more precisely specified) a filter that excludes uploads whose `analysis_status != "completed"` — which, given Stage 2B's persistence-timing fix, is actually **redundant-but-harmless defense in depth**: since unconfirmed uploads never get `biomarkers` rows written in the first place under the new Stage 2B design, `get_user_progress`'s join against `biomarkers` would already naturally exclude them (an upload with zero biomarker rows contributes nothing to the progress list). The explicit `analysis_status` filter is kept anyway as an intentional, readable guard rather than relying on an implicit join-emptiness side effect.

---

## Stage 2E — Check-in loop

Unchanged from Revision 1. Explicit restatement of the constraint per your correction: **completion visible, `next_best_action` changes, next check-in timing clear, timeline/adherence-component score may update — the clinical/biomarker-derived components of any score must not move without a real biomarker-derived cause.**

---

## Stage 2F — Dashboard integrity

Unchanged from Revision 1.

---

## Stage 2G — Frozen report reproducibility (protocol-source question resolved)

**1-3. Objective/problem/current behavior:** Unchanged core objective. **Resolved this revision, from live trace, not deferred:**
- `protocols` and `report_versions.protocol` are **not** a deliberate live/mutable-vs-frozen split. `protocols` has no completion/interactivity columns at all (`id, user_id, upload_id, recommendations, prompt_version, created_at` only); it is create-once and only silently rewritten when the pipeline reruns for the same upload — never by user interaction.
- **No per-item completion-state UX exists anywhere in the live backend** — no `protocol_completions` table, no per-item mutation endpoint, `timeline_events` writes are generic feed entries only (e.g. `"protocol_generated"`), never a "mark item N done" event.
- **Therefore: switching `get_results`'s primary read source from `protocols` to `report_versions.protocol` cannot revert any checked-off state, because no such state is persisted anywhere today.** The only real consequence of the switch is a **content** change: users would start seeing the safety-sanitized version instead of the raw one — which, after Stage 2C's fix (item 3 above, sanitizing both storage locations identically), is a non-issue, since both would contain the same content by the time 2G ships.

**4. Desired/target behavior:** `report_versions.protocol` becomes the canonical read source for historical `GET /{upload_id}` views (consistent with `input_snapshot` already being the source for the gate/integrity/evidence fields, per Revision 1's plan). The separate `protocols` table write can remain as-is for now (no schema change required this stage) — it simply stops being the *primary read source*; whether to deprecate it entirely is a follow-up decision, not required for reproducibility itself.

**5-23:** Unchanged from Revision 1's Stage 2G section otherwise (locale-as-rendering-parameter design, regenerate-creates-new-version behavior, etc.) — the one previously-open dependency (the protocol-source trace) is now resolved and no longer blocks implementation planning for this stage.

---

## Stage 2D-2 — Wire the canonical longitudinal engine into a real user-visible surface (REQUIRED)

**Reclassified per your correction: this is a required product-completion stage, not optional cleanup.**

**1. Objective:** `/progress/overview` (the correct, `test_date`-driven, per-marker-comparison engine, live-verified accurate in Stage 1) currently has **zero frontend consumers** and its would-be UI (`Progress.jsx`) is dead/unrouted. Without this stage, VITALOOP has 2D-1's minimally-correct legacy sort order, but **no user-visible surface anywhere that shows the actually-rich, correct longitudinal comparison** (improved/worsened/stable/new/missing per marker) that Stage 1 proved the backend can already produce correctly.

**2. User-visible problem:** A user who does everything right (uploads two labs a month apart) still cannot *see* a proper trend comparison anywhere in the live product — the only reachable page (`/lab-results`) shows a flat list, not a comparison.

**3. Target state (per your instruction — do not build a third engine):** One canonical backend engine (`/progress/overview`, already correct — extend with `comparison_status` per the Stage 2 API contract doc's §6, deferred field design, now promoted to required scope here since this stage needs it), one real frontend surface consuming it. Two implementation options, to be decided at implementation time based on product/design bandwidth, not engineering constraint:
   - **(a) Revive and correct `Progress.jsx`**, replacing its currently-dead-code arithmetic-sign "Improving" logic (F06) with a thin renderer over `/progress/overview`'s backend-computed `comparison_status`, then re-add its route.
   - **(b) Extend `LabResultsList.jsx`** (the currently-live page) to consume `/progress/overview` directly instead of (or alongside) legacy `/progress`, adding a trend/comparison section to the existing page rather than reviving a separate one.
   - Recommendation: (b) is lower-risk (extends an already-correct, already-live page rather than reviving dead code with a known-bad pattern in it), but (a) may better match existing design/navigation expectations — flagged as a product decision, not an engineering one.

**4-23:** Full 23-field breakdown deferred to implementation-time detailed design (this stage was previously not planned to this depth since it was misclassified as optional debt) — but its REQUIRED status is now reflected in the stage order (B) and priority table (A) above. It depends on 2A.5 having already removed the competing/misleading client-side "Trends" tab, and benefits from 2G's reproducibility work being stable first (though not strictly blocking).

---

## Stage 2H — Schema cleanup (excludes `plan_tier`)

Unchanged from Revision 1 **except item 5 (entitlement consolidation) is removed from this stage entirely.** `users.plan_tier` is left exactly as it is today (referenced by code, absent from the live schema, functionally inert given the confirmed fallback-logic behavior) — no column added, no code touched. This is tracked purely as future work: *when* entitlement consolidation gets deliberate design attention (not part of Stage 2), the resolution is to remove the phantom `plan_tier` references from code (`entitlements.py`, `crm.py`, `admin.py`, `supabase_service.py`), not to retrofit the database to match them. Items 1-4 (FKs, `checkins_weekly` linkage, `symptoms` split) unchanged from Revision 1.

---

## Stage 2I — Full staging/tests/dead-code/ops cleanup

Unchanged from Revision 1, minus the 5 tests now covered earlier by 2PRE (2I still owns full Playwright/xUnit restoration and the staging Supabase DNS/LLM-key fix, which 2PRE explicitly does not require for its narrower scope).

---

## H. Risks that remain after Stage 2 (unchanged from Revision 1, plus one addition)

All Revision 1 items stand. **Addition:** the `protocols`-table sanitization gap found this revision (§Stage 2C item 2) is a reminder that "a fix exists in the pipeline" and "a fix reaches the user" are not the same claim — worth a standing practice, not just a one-time fix, of tracing every write destination a piece of pipeline output reaches before declaring a safety/integrity fix complete.

## I. Findings explicitly NOT fixed in Stage 2

Unchanged from Revision 1. `plan_tier` code-reference removal is added to this list explicitly (previously implied via Option B being "tracked as follow-up"; now stated directly since Option A is fully withdrawn).

## J. Unresolved decisions needing your approval

See final response.
