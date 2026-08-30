# VITALOOP Stage 2 — Database Change Plan (Revision 2)

**No migrations have been written or executed. This is a proposal only.** Every change below is evaluated against live schema state (confirmed via read-only Supabase PostgREST introspection this audit) and existing data volume, not assumptions.

**Revision 2 changes:** (1) The `users.plan_tier` addition (previously "Option A" in item 5) is **withdrawn entirely** — Stage 2 makes no change to `plan_tier` in any form. (2) A new item 0 documents the explicit decision **not** to add any confirmation/status column to `biomarkers` — traced this revision: the table has no such column today, all 6 live read paths consume it unconditionally, and the Stage 2B design instead defers the write itself rather than filtering the read, making a schema change unnecessary. Item numbers below otherwise unchanged from Revision 1.

---

## 0. `biomarkers` table — explicitly NO schema change (Stage 2B)

**Traced this revision:** live schema is `id, upload_id, user_id, name, value, unit, ref_low, ref_high, status[clinical HIGH/LOW/OPTIMAL flag], category, created_at` — no confirmation/moderation column exists. All 6 live read call sites (`get_biomarkers_by_upload`, `get_recent_biomarker_history`, `get_user_progress`, `calculate_health_score`, plus the two report/protocol-generation consumers of the first of these) read unconditionally with zero status filtering.

**Decision: do not add a column here.** The Stage 2B design instead defers the *write* (`save_biomarkers()`) until the gate decision is `auto_continue` or the user has confirmed — moving 4 scattered write call sites into 1 (inside the pipeline function itself). This makes every one of the 6 read paths correct by construction, with zero read-path changes and zero schema changes. This is the "smallest reliable alternative" requested, and it is smaller than adding a column + patching 6 read sites would have been.

**Rollback implication:** since this is a write-timing change in application code, not a schema change, rollback is a pure code revert — no migration to unwind.

---

## 1. `lab_uploads.analysis_status` (Stage 2B)

- **Table:** `public.lab_uploads`
- **New column:** `analysis_status text not null default 'completed'`
- **Constraint:** `check (analysis_status in ('extracting','needs_confirmation','analyzing','completed','blocked','failed'))`
- **FK:** none (own-table state field)
- **Index:** `create index idx_lab_uploads_analysis_status on lab_uploads(user_id, analysis_status)` — supports the Stage 2D filter ("exclude non-completed uploads from progress") and a future dashboard "outstanding confirmations" query.
- **Nullability:** not null, defaulted — every existing row backfills to `'completed'` automatically via the column default, no separate `UPDATE` pass needed.
- **Default:** `'completed'` — chosen specifically so existing historical uploads (already served as complete reports for however long they've existed) are not retroactively hidden or reinterpreted. Only uploads processed *after* this migration get a real gate-driven value, because only the application code path (not the migration) sets anything other than the default.
- **RLS consequences:** none — same row-owner (`user_id`) RLS pattern as the rest of `lab_uploads`, no new access pattern introduced.
- **Backfill:** none required beyond the column default (see above) — this is a case where "default value = correct backfill value" holds, which is why this migration is safe to ship without a data pass.
- **Compatibility period:** the feature flag (`ENFORCE_QUALITY_GATE`, per the Implementation Plan) means the column can exist and be written correctly well before the *enforcement* behavior is turned on — recommend adding the column and starting to write real values (flag off, still always resolves effectively to `completed`-equivalent behavior) at least one deploy cycle before flipping enforcement on, so there's a chance to verify the values being computed look sane in production before they start actually gating anything.
- **Rollback:** drop the column; the application code's fallback (treat missing column as always-`completed`) should be written defensively enough that a rollback doesn't require an application-code revert in lockstep — worth confirming at implementation time, not assumed here.

---

## 2. FK constraints on the 7 `stage-25` pipeline tables (F09, Stage 2H)

**Tables:** `biomarker_extraction_candidates`, `report_versions`, `safety_events`, `analysis_quality_gates`, `clinical_data_integrity_events`, `evidence_gaps`, `health_state_versions` — all currently have `upload_id uuid not null` with no `references` clause.

**Proposed constraint (per table):** `alter table public.<t> add constraint fk_<t>_upload foreign key (upload_id) references public.lab_uploads(id) <ON DELETE behavior>;`

**The `ON DELETE` behavior is the actual decision this plan needs to make, per the brief's explicit instruction not to blindly cascade.** Three live-system facts govern the choice:

1. The retention/redaction job (`vitaloop-retention-redaction.timer`, confirmed running successfully in Stage 1) **redacts raw text in-place on `lab_uploads`** — it does not delete `lab_uploads` rows themselves (confirmed by its log output showing `updated` counts against existing rows, not deletions).
2. No code path in the traced backend calls a hard `DELETE` on `lab_uploads` at all (not found in any of the three deep traces this stage) — the only lifecycle event that exists today is redaction-in-place.
3. Historical report reproducibility (Stage 2G) explicitly requires old `report_versions`/`lab_uploads` pairs to remain queryable indefinitely (or at least for the retention window) — a `CASCADE` would silently destroy exactly the historical record Stage 2G is designed to preserve, if a deletion ever *did* happen.

**Recommendation:** `ON DELETE RESTRICT` for all 7 tables. Rationale: since nothing in the live system currently deletes `lab_uploads` rows, `RESTRICT` costs nothing today (no code path would ever hit the restriction) while (a) making any *future* accidental delete-uploads code loud-fail instead of silently orphaning/destroying pipeline history, and (b) staying consistent with the "historical reports must be reproducible" principle. If a genuine "user requests full account/data deletion" (GDPR-style) flow is ever built, it should be an explicit, audited, cascading *application-level* operation (delete children first, in a known order, with its own audit trail) — not something a blind DB-level `CASCADE` should be relied on to handle silently.

**Orphan-row check before adding constraints:** must run a read-only `SELECT` on each of the 7 tables for `upload_id` values with no matching `lab_uploads.id` before the `ALTER TABLE ADD CONSTRAINT` — a constraint add will fail outright if orphans already exist. **This check has not been run yet in this audit** (would require either direct Postgres access, unavailable per prior audit passes, or a paginated cross-reference via the REST API) — flagged as a required pre-implementation step, not assumed clean.

**Backfill:** none needed if the orphan check comes back clean; if orphans exist, they need a decision (delete the orphan rows — they're already unreachable via any real `upload_id` join — or set `upload_id` to a sentinel, though `not null` currently forbids `NULL` without also relaxing that constraint, which is a bigger decision than this plan should make unilaterally).

**Compatibility period:** none needed — adding a constraint doesn't change existing read/write code paths that were already respecting the implicit relationship.

**Rollback:** drop the constraint; trivial, no data impact either direction.

---

## 3. `checkins_weekly.report_version_id` (F12, Stage 2H)

- **Table:** `public.checkins_weekly`
- **New column:** `report_version_id uuid null`
- **FK:** `references public.report_versions(id) on delete set null` (not `restrict`/`cascade` — a check-in remains meaningful as a completion/adherence record even if its referenced report version is later redacted/removed; losing the *link* is acceptable, losing the *check-in* is not)
- **Index:** `create index idx_checkins_weekly_report_version on checkins_weekly(report_version_id) where report_version_id is not null`
- **Nullability:** nullable — historical check-ins (all of them, today) have no meaningful value to backfill; new check-ins populate it at submission time (the "currently active `report_versions` row for this user" at the moment of submission).
- **Default:** none (nullable, app-populated).
- **RLS consequences:** none new — same `user_id`-scoped RLS as today, this is an additional column on an already-protected table.
- **Backfill:** none — cannot be reconstructed retroactively with confidence (which report was "active" for a check-in submitted months ago isn't reliably inferable after the fact); leave existing rows `null`.
- **Compatibility period:** none needed — purely additive, nullable column.
- **Rollback:** drop the column.
- **`protocol_id` explicitly NOT added**, per the Implementation Plan's "prefer one durable link" guidance — a protocol is always generated alongside a report version in the current pipeline (confirmed in the Stage 2 pipeline trace), so `report_version_id` alone is sufficient to look up the associated protocol via the existing `protocols.upload_id` join if ever needed; adding a second redundant FK would just create another two-sources-of-truth risk of the exact kind this whole audit keeps finding.

---

## 4. `public.symptoms` split (F11, Stage 2H)

**Current live state (confirmed this session via read-only schema introspection): the table has 0 rows.** This materially changes the risk profile of this migration compared to how it would look against a populated table — there is no backfill-classification problem to solve today.

**Recommended approach given 0 rows: do NOT attempt a live data-preserving split/backfill (unnecessary complexity for zero rows).** Instead:
1. `DROP` the erroneous merged-shape columns that came from the knowledge-catalog migration (`key`, `name`, `description`, `severity_scale`, `metadata`) from `public.symptoms`, restoring it to the clean user-log shape (`id`, `user_id`, `upload_id`, `tags`, `severity`, `created_at`) that all 3 live call sites (`save_symptoms`, `get_user_symptom_summary`, `get_platform_symptom_summary`) already correctly assume.
2. Create a **new, separate** `public.symptom_catalog` table for the knowledge-catalog shape (`key`, `name`, `description`, `severity_scale`, `metadata`), if and when the knowledge-base feature that originally needed it (Stage 18's migration) is actually built out — confirmed this stage that **zero live code reads or writes the catalog-shape columns today**, so there is no existing functionality to migrate, only a schema mistake to undo.
3. Add `not null` back to `user_id` if it was ever relaxed to accommodate the merge (needs a quick check of current nullability at implementation time).

**FK/index/RLS:** unchanged from what already exists on the table for the log-shape columns (no evidence any of that is broken — only the extra columns are the problem).

**Rollback:** since this is a `DROP COLUMN` on empty data, rollback is simply re-adding the columns (empty again) — genuinely low-risk given the 0-row state. **This risk assessment would be completely different (and this plan would NOT recommend a drop) if the table had any rows** — re-verify row count immediately before implementation, since time will have passed since this audit.

---

## 5. Entitlement field consolidation (F10) — **explicitly OUT of Stage 2H, revised**

**Current live state:** `users.plan_tier` is read/written by application code (`entitlements.py`, `crm.py`, `admin.py`, defensively-handled in `supabase_service.py`) but **does not exist as a column** in the live database. Confirmed this stage: the fallback logic still functionally resolves entitlement correctly with `plan_tier` always empty/absent — this is not a live bug today, only a latent-confusion risk.

**Revision 2 decision: do nothing to `plan_tier` in Stage 2.** Adding the column (previously "Option A") is explicitly withdrawn — it would make the live database conform to an already-confusing multi-source entitlement model for no functional benefit, and risks being read later as tacit endorsement of a 4-field entitlement design (`sub_status`, `subscription_status`, `plan_tier`, `subscriptions.status`) that the code's own comments already flag as needing consolidation, not reinforcement.

**What happens instead:** nothing, in Stage 2. When entitlement consolidation gets deliberate design attention as its own effort (explicitly not part of Stage 2, per the brief), the resolution path is to **remove** the phantom `plan_tier` references from `entitlements.py`/`crm.py`/`admin.py`/`supabase_service.py` (the former "Option B"), not to add a column to match them — but that is a scoped future decision, not scheduled here, and only pursued if a real product requirement for a distinct plan-tier concept emerges (today, active/free is the only distinction anything actually uses).

**No schema action, no rollback needed — this section is documentation of a deliberate non-change.**

---

## Summary table

| # | Table | Change | Risk | Backfill needed | Blocking pre-check |
|---|---|---|---|---|---|
| 1 | `lab_uploads` | add `analysis_status` | Low | No (default covers it) | None |
| 2 | 7× `stage-25` tables | add FK `upload_id → lab_uploads.id`, `ON DELETE RESTRICT` | Low (given no live delete path exists) | Only if orphans found | **Orphan-row check required first — not yet run** |
| 3 | `checkins_weekly` | add nullable `report_version_id` FK | Low | No | None |
| 4 | `symptoms` | drop 5 erroneous catalog columns (0 rows today) | Low (**contingent on row count still being 0 at implementation time — re-verify**) | No | Re-verify row count immediately before running |
| 5 | `users` | **none — withdrawn this revision** | N/A | N/A | N/A |

None of these are executed as part of this planning document. Orphan-check (item 2) and row-count re-verify (item 4) are the only two items that need a fresh read-only check immediately before implementation, since time will have passed since this audit's live introspection. Item 0 (`biomarkers`, no schema change) requires no pre-check — it's a statement of what's deliberately *not* being done and why.
