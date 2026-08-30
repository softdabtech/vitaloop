# VITALOOP Full Cabinet Audit — Stage 1 (Live Environment + Journey)

**Date:** 2026-08-28
**Auditor mode:** Read-only forensic audit + one live, explicitly-approved write-capable pass against production using a user-supplied test account (`zzz@z.com`).
**Authoritative source of truth used throughout:** the currently deployed server code and live runtime behavior — not git history. Git drift is documented separately (§F) and scored no higher than P3 unless it demonstrably causes a live-runtime defect.
**No code, config, database schema, or infrastructure was modified. No deploy/restart was performed. No destructive action was taken.**

---

## A. Environment + Architecture Map (live-verified)

| Surface | Live path | Live process | Confirms |
|---|---|---|---|
| Backend (prod) | `/var/www/VITALOOP/backend` | `vitaloop-backend.service`, `uvicorn app.main:app --port 8004 --workers 2`, PID-verified | The uncommitted working-tree files ARE the running code — there is no separate build/deploy artifact step |
| Backend (staging) | `/opt/vitaloop-staging/backend` | `vitaloop-staging-api.service`, port 8011 | **Non-functional** — see §C |
| Frontend EN | `/var/www/VITALOOP/frontend/dist` | nginx `vitaloop.today`, `root` directive | `build-info.json`: commit `f838718`, branch `codex/ua-public-ux-fixes`, built 2026-08-27T09:48:26Z |
| Frontend UA | `/var/www/UAVITALOOP/frontend/dist` | nginx `ua.vitaloop.today` | Byte-identical `build-info.json` to EN — same build artifact, rsync'd, SEO-shell-only swap (`ua-index.html`) |
| CRM (.NET 8) | `/var/www/VITALOOP/crm-mvc/publish` | `vitaloop-crm-mvc.service`, `dotnet .../Vitaloop.Crm.Web.dll`, port 5090 | — |
| Analysis/OCR service | `/opt/analysis-service` | `analysis-service.service`, port 8006, tesseract | Running, but **dead code path** — main pipeline bypasses it entirely (F15) |
| Monitor | `/opt/vitaloop-monitor` | `vitaloop-monitor.service` | Running; proxied at `crm.vitaloop.today/ops/*` via port 9099 |
| Retention job | `backend/scripts/run_lab_retention_redaction.py` | `vitaloop-retention-redaction.timer` (daily) | Ran successfully same-day, 0 candidates (dataset too young for 180-day cutoff) — genuinely working, not dead code |
| Unrelated | `/var/www/sky/backend` | ports 8001/8002 | Not part of VITALOOP — noted only to avoid false attribution |
| nginx | `/etc/nginx/sites-enabled/{vitaloop.today,ua.vitaloop.today,api.vitaloop.today,crm.vitaloop.today}` | live nginx master | Read directly; controls 100% of live routing |
| Database | Supabase Postgres, prod project `bfjxkzydonhwmafnyktt.supabase.co` | reached via service-role key, read-only PostgREST introspection | 65 live tables/views confirmed by direct schema query (not migration-file inference) |

**AI provider (live-confirmed):** one active path — OpenAI (`gpt-4o-mini`) via `app/config.py`'s hardcoded `active_llm_*` properties. `DIGITALOCEAN_CLAUDE_*`, `ABACUS_AI_*`, `ROUTELLM_*` are present as env vars but empty and referenced by zero lines of code (F13).

**Entitlement (live-confirmed):** `users.subscription_status`/`sub_status` OR an active row in `subscriptions`, both set exclusively by manual CRM/admin writes — no live payment gateway exists on production (F21). The code additionally references `users.plan_tier`, which **does not exist as a column in the live database** (F10).

**Progress/trend (live-confirmed):** two parallel backend implementations exist. `/progress` (legacy, `get_user_progress()`, sorts by `created_at`) is the one the actual routed `/lab-results` page calls. `/progress/overview` (modern, `progress_overview.py`, correctly `test_date`-driven) is a separate, more advanced endpoint that the live journey proved works correctly — but the frontend page that's actually reachable through `/progress` doesn't appear to consume it. See F03.

---

## B. P0/P1 Findings — see [`VITALOOP_FINDINGS_REGISTER.md`](VITALOOP_FINDINGS_REGISTER.md) for the full table (22 findings: 3×P0, 9×P1, 7×P2, 3×P3, with git-drift/staging items correctly capped at P3 per your instruction).

Headline P0s, all live-reproduced against production during this audit:

1. **F01 — Quality gate never blocks.** A `decision:"block_or_confirm", requires_confirmation:true` result on the live journey's first upload did not stop a full report, protocol, and persisted biomarkers from being generated and served in the same response. Extraction candidates remain `status:"pending"` forever — the "confirmation" step is decorative.
2. **F02 — Safety engine never blocks the response.** A `high`-severity `pediatric_context` safety event (`doctor_discussion_required:true`) still produced `status:"approved_with_warnings"`, `blocked_items:[]`, and the full report was served unconditionally.
3. **F03 — The live-routed progress data path sorts by `created_at`, not lab test date.** `get_user_progress()` — which feeds both `/dashboard/summary` and the endpoint the actual `/lab-results` page calls — never applies the `test_date`/`collected_at`/`reported_at` fallback that the newer, unused-by-frontend `/progress/overview` correctly uses.

---

## C. End-to-End Journey Result (live production, account `zzz@z.com`)

**Staging could not be used** — its configured Supabase project (`dcmnnqlrcmhgmhqznpet.supabase.co`) has no public DNS record; every single authenticated request has failed for an unknown period (proven via the live staging error log, not inference). This is documented as F19 (P3, environment reliability) per your reclassification — it blocked the *staging* leg of this audit but not the audit itself, since we pivoted to production with your approval.

**Can a user complete the entire journey on the currently deployed system? — Yes, mechanically, with caveats.**

Executed live against `https://api.vitaloop.today`, one test account, every write scoped to that one `user_id`, zero 5xx errors encountered:

| Step | Result |
|---|---|
| Login (Supabase password grant) | ✅ 200 |
| `/auth/me` baseline | ✅ 200, already Premium (account pre-existed with `subscription_status=active`) |
| Profile update | ✅ 200 |
| Questionnaire (new session, 10 answers, complete) | ✅ 200 throughout |
| Lab upload #1 (`test_date=2026-07-28`, synthetic glucose/TSH/ferritin/vitamin-D/LDL panel, one abnormal value) | ✅ 200 — but see F01/F02/F04 for what's wrong with the result |
| Report / dashboard / progress-overview after upload #1 | ✅ 200, correctly `mode:"snapshot"`-equivalent state relative to new data (account had 7 prior uploads from earlier smoke tests, so true single-upload "snapshot" state could not be cleanly isolated — noted as a limitation, not a defect) |
| Check-in submission | ✅ 200, persisted — but dashboard didn't visibly change (F05) |
| Lab upload #2 (`test_date=2026-08-27`, vitamin D improved, LDL worsened, glucose unchanged, HbA1c added, ferritin omitted) | ✅ 200 |
| `/progress/overview` after upload #2 | ✅ 200, **correctly** shows `mode:"high_confidence_time_trend"`, `date_span_days:30`, `first_lab_date:"2026-07-28"`, `latest_lab_date:"2026-08-27"` |
| `/timeline` | ✅ 200 |

**Premium survives logout/login:** not separately re-tested this pass (account was already premium at session start and never logged out mid-session) — flagged as an item for the next live pass rather than asserted either way.

**Can upload #1 generate a trustworthy report?** No, not as currently deployed — it generates *a* report, but F01, F02, and F04 (a hallucinated "Report Date" biomarker with an absurd reference range) all fired on the very first real upload of this audit, and none of them prevented the report from reaching the user.

**Does check-in change anything meaningful?** Not observably within the same session (F05) — dashboard stats and `next_best_action` were byte-identical before/after a confirmed-persisted check-in. The backend code trace found check-in data does feed `calculate_health_score`'s adherence component and a dashboard-insights generator, but neither effect was visible live in this window — worth a longer-horizon re-check (e.g. next day) before concluding it's fully inert.

---

## D. Longitudinal / Month-Later Test Result

This is the strongest result in the audit — the *modern* progress engine works correctly:

- Lab #1 `test_date=2026-07-28`, Lab #2 `test_date=2026-08-27` — 30 days apart by design, but only ~3 minutes apart in actual wall-clock upload time (`created_at`). This is the exact scenario that distinguishes correct lab-date handling from the forbidden `created_at`-based shortcut.
- Direct read-only DB check on `lab_uploads` confirmed `test_date` and `date_source:"user_provided"` were stored correctly and independently of `created_at` for both rows.
- `/progress/overview`'s response was driven by the 30-day `test_date` gap, not the ~3-minute `created_at` gap: `date_span_days:30`, `mode:"high_confidence_time_trend"`.
- Per-marker deltas were real and matched intent: vitamin D 18.0→38.0 (`rising`/improved), LDL 105.0→128.0 (`rising`/worsened — correctly reported as a rise, though whether the UI would ever mislabel a rising LDL as "good" is exactly the dead-code risk in F06), glucose 92.0→93.0 (`stable`/unchanged), HbA1c newly tracked from first appearance, ferritin's `latest_date` correctly stayed pinned to the earlier upload that actually had it rather than advancing to the dateless-for-that-marker second upload.
- **Gap found:** the payload has no explicit `"new"`/`"missing"` marker field — new/missing status is only inferable indirectly from whether `latest_date` matches the newest upload's date. Not a correctness defect, but a completeness one for anyone consuming this API without backend-team tribal knowledge.
- **Caveat that limits full confidence:** all of this was proven for `/progress/overview`. The endpoint the live `/lab-results` route actually calls (`/progress`, legacy) was **not** independently forced into an out-of-order scenario this pass — F03 remains a code-confirmed, live-schema-plausible, but not yet live-behavior-reproduced defect specifically for the reachable page.

**Answering directly: does the second lab actually change the user's health interpretation?** Yes, for the metrics the modern progress engine surfaces (`/progress/overview`) — genuinely, correctly, date-driven. Whether that correct data reaches the actual dashboard/report a user sees, versus the legacy `created_at`-sorted path, is the open question F03 leaves unresolved and is the top item for the next live pass.

---

## E. Billing / Entitlement Trace (production vs staging, live-confirmed)

| | Production | Staging |
|---|---|---|
| Payment gateway | **None.** No `STRIPE_*`/`PADDLE_*` keys in live env. A Paddle migration was attempted 2026-08-24 and rolled back 2026-08-25 (env backup files on disk prove this timeline). | Stripe fully wired: `stripe_router.py` present, `main.py` mounts it, `.env.staging` has live `STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID`/`STRIPE_WEBHOOK_SECRET` — but unreachable anyway since staging auth is fully broken (F19). |
| Entitlement source of truth | Manual: an admin/CRM operator sets `users.subscription_status`/`sub_status` directly, or writes a `subscriptions` row. Confirmed live: `zzz@z.com` was already `subscription_status:"active"` from a prior manual grant — no payment event in its history. | Same DB fields, but the code resolving them is the **pre-bug-fix version** — see below. |
| Entitlement resolution logic | Working-tree `entitlements.py` has an active-looking bug fix (`paid_from_account` no longer incorrectly disabled whenever *any* row exists in `subscriptions`, even a free one) — this is what's actually running in production right now. | Still has the **old, buggy** version of the same function — confirmed by direct file diff between the two live deployments. |
| `plan_tier` column | Referenced by code (`entitlements.py`, `crm.py`, `admin.py`, defensively-handled in `supabase_service.py`), **does not exist** in the live database schema (confirmed via read-only PostgREST introspection). Functionally harmless today only because the fallback boolean logic happens to still resolve correctly when the field is always empty. | Not independently checked — staging points at a different, unreachable Supabase project. |

**Is production billing currently production-safe?** Yes — "safe" in the sense that nothing is broken-in-place or exploitable; there is simply no live payment collection at all right now, by design, mid-migration. This is a revenue-blocking product state, not a security or safety defect (F21).

**Structurally broken vs intentionally disabled — verdict: intentionally disabled, mid-migration**, evidenced by the coherent, matching Stripe-removal diff across `config.py`, `main.py`, `billing/__init__.py`, and the frontend `Paywall*`/`Subscription.jsx` components, plus the dated Paddle attempt-and-rollback env backups.

---

## F. Git Drift Analysis (P3/maintenance only, per your instruction — not scored as defects)

Documented for completeness; none of these are treated as audit findings unless cross-referenced above as a live-runtime issue.

- ~123 files in the working tree differ from the last commit (`main`@`12d9419`, Jun 30). Content-level diffing (not just filenames) shows this is **one coherent, in-progress refactor**: removing Stripe and replacing it with manual entitlement management, plus active pipeline/entitlement bug fixes — not random unrelated drift.
- The deployed frontend build (`commit f838718`, branch `codex/ua-public-ux-fixes`) isn't reachable from the currently checked-out `main` branch — a live fact worth knowing when grepping `main` for frontend logic, but not itself a defect.
- The live nginx file differs from both git HEAD and the tracked working-tree copy of `nginx.vitaloop.conf` — a third, hand-edited version controls real production routing, including what appears to be a deliberate bug fix (`/dashboard` correctly redirects to the SPA now, with a comment referencing a previously-broken behavior). Per your instruction, this is not scored as a defect — it's simply undocumented-in-git, which only matters if someone tries to "restore from git" and doesn't realize live nginx has since diverged.
- `frontend/tests/` (13 Playwright specs) and `crm-mvc/tests/Vitaloop.Crm.Web.Tests/` are absent from the working tree. Reclassified per your instruction: relevant only insofar as it means **the live system currently has no working automated E2E regression coverage** (`playwright.config.ts` points at a directory that doesn't exist) — carried forward as F20 (P3, test-coverage gap), not as a repo-hygiene complaint.

---

## Open items for the next live pass (not yet proven either way)

1. Force an out-of-order upload (`test_date` older than an existing upload's `test_date`, uploaded second) specifically against the legacy `/progress` endpoint to prove or disprove F03's user-visible impact.
2. Re-check `/dashboard/summary` a day+ after the check-in (F05) to see if the effect the backend trace found (adherence component, insights) is simply delayed rather than absent.
3. Test Premium survival across logout/login and password reset explicitly (not exercised this pass since the account started already-authenticated and premium).
4. Attempt a deliberately extreme/dangerous lab value (e.g., glucose=9999) to see whether a true hard `blocked` safety verdict exists anywhere in the live system, since both real uploads this pass only reached `approved_with_warnings`.

No refactoring has begun. Findings register and this document are ready for your review before any implementation work starts.
