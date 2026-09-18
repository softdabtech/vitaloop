# Post-P23 Reasoning / Governance / Cost Checkpoint — 2026-09-18

Factual QA checkpoint for the roadmap block built after P23 (Report
Quality Audit): P24.1–P24.3 (Population Profiles + selection), P25
(Doctor Escalation Precision 2.0), P26 (Rule Pack Quality Scoring), P27
(Clinical Disagreement Mode), and P28/P28.1 (LLM Cost Audit + usage
logging coverage fix). No code was changed to produce this document —
it is an inspection + verification pass only. All facts below were
re-confirmed directly against the current code on 2026-09-18, not
carried over from memory of the original implementation sessions.

## 1. What is LIVE in the pipeline (runs on every real report)

Wired into `backend/app/services/lab_analysis_pipeline.py`, in this order:

| Stage | Call | Line (build call) |
|---|---|---|
| P24.3 selection | `select_population_profiles(...)` | `lab_analysis_pipeline.py:1399` |
| P24.1/P24.2 overlays | `build_population_profile_overlays(profile_ids=population_profile_selection["active_profile_ids"], ...)` | `lab_analysis_pipeline.py:1410` |
| P25 escalation | `build_doctor_escalation_precision(...)` | `lab_analysis_pipeline.py:1549` |

- **`longevity_metabolic_optimization`** is the default-active profile
  (`_DEFAULT_PROFILE_IDS = [LONGEVITY_METABOLIC_OPTIMIZATION]`,
  `population_profile_selection.py:83`) — active on every report unless
  an explicit override is present.
- **`athlete_recovery`** is implemented and fully wired through the same
  selector/overlay path, but is **not** on that default list. It only
  activates via an explicit `source_metadata["population_profile_ids"]`
  override or a strong structured signal (a `training`-type
  `intervention_memory` event, or a sleep/stress/illness event whose own
  text names athletic context) — confirmed unchanged: no pipeline call
  site currently supplies either trigger, so no live report activates it
  automatically today.
- Both add `*_version` keys to `version_provenance`
  (`population_profile_overlays_version`, `population_profile_selection_version`,
  `doctor_escalation_precision_version` — `lab_analysis_pipeline.py:1507-1508,1563`).

**Not live / not called from the pipeline at all** (verified: `grep -c` for
each module's name against `lab_analysis_pipeline.py` and
`report_history.py` returns `0`):
- P26 `rule_pack_quality.py`
- P27 `clinical_disagreement.py`
- P28 `llm_cost_audit.py`

These three are intentionally internal/offline/ops-only modules — see
section 4.

## 2. What is persisted in `input_snapshot`

Confirmed present in the `input_snapshot` dict passed to
`supabase.save_report_version(...)` (`lab_analysis_pipeline.py:1670-1672`):

- `population_profile_overlays`
- `population_profile_selection`
- `doctor_escalation_precision`

**Not persisted** (never appear in `input_snapshot` at all):
- `rule_pack_quality` output (P26)
- `clinical_disagreement` output (P27)
- `llm_cost_audit` output (P28)

## 3. What is returned by frozen replay

Confirmed in `report_history.py::assemble_frozen_response`:

```python
"population_profile_overlays": input_snapshot.get("population_profile_overlays"),   # line 222
"population_profile_selection": input_snapshot.get("population_profile_selection"), # line 230
"doctor_escalation_precision": input_snapshot.get("doctor_escalation_precision"),   # line 237
```

All three read verbatim from `input_snapshot`, never recomputed — a
report generated before a given stage existed reads back `None` for that
field (test-covered per stage: `test_stage2g_frozen_report_reproducibility.py`).

P26/P27/P28 have **no** frozen-replay behavior because they were never
added to `input_snapshot` in the first place — there is nothing to read
back, by design, not by omission.

## 4. What is internal-only / offline

- **P26 Rule Pack Quality** (`app/services/knowledge/rule_pack_quality.py`):
  pure function over `rule_packs.py`'s existing pack grouping. Called
  on-demand only, by its own ops endpoint (below) or a direct import —
  never by the pipeline.
- **P27 Clinical Disagreement Mode** (`app/services/knowledge/clinical_disagreement.py`):
  pure function comparing already-computed `clinical_hypotheses` vs.
  `population_profile_overlays`. **No endpoint exists for this stage** —
  it is module + tests only, callable directly by a future internal tool
  or script. Not user-facing, not wired to any route.
- **P28 LLM Cost Audit** (`app/services/llm_cost_audit.py`): a static,
  hand-maintained registry (no I/O, no arguments) of known LLM call
  sites. Exposed via its own ops endpoint (below).

## 5. Ops/knowledge endpoints added

| Endpoint | Method | Auth | Stage | Notes |
|---|---|---|---|---|
| `/knowledge/rules/pack-quality` | GET | `require_super_admin` | P26 | `app/routers/knowledge.py:102`, registered before `/rules/{rule_id}` (route-ordering-test-verified) |
| `/crm/ops/llm-cost-audit` | GET | `require_super_admin` | P28 | `app/routers/crm/crm_ops.py:525`, zero DB calls, pure static-registry read |

**No endpoint exists for P27** (Clinical Disagreement Mode) — deliberately
deferred; see the P27 report/commit message for the reasoning (a real
endpoint would need to fetch a specific report's persisted snapshot
cross-user, a higher-stakes addition than the two read-only aggregate
endpoints above).

**No endpoint exists for P24/P25** beyond what's already in the report
response itself — `population_profile_overlays`, `population_profile_selection`,
and `doctor_escalation_precision` are visible wherever the analysis
result/frozen report is already returned; no separate route was added
for them.

## 6. What changed in LLM usage logging (P28.1)

- `claude_pdf_analyzer.py`'s `OpenAIFileAnalyzer` gained optional
  `user_id`/`upload_id` (default `None`) and a `USAGE_TASK_NAME` class
  attribute (`pdf_text_extraction` on `PDFTextAnalyzer`,
  `pdf_vision_extraction` on `ImageAnalyzer`/`PDFVisionAnalyzer`/`TIFFAnalyzer`).
  Both completion methods now log via a new `_persist_analyzer_usage()`
  right after a successful HTTP response.
- `table_analyzer.py`'s `TableAnalyzer.USAGE_TASK_NAME = "table_extraction"`
  — gets logging for free via the shared base-class method.
- `claude_service.py::_persist_usage_event` gained a `provider` param
  (default `"openai"`, preserving every pre-existing caller's behavior
  exactly) and no longer silently skips logging when a response carries
  no `usage` block — it now always writes a row with
  `prompt_tokens`/`completion_tokens`/`total_tokens` at the schema's own
  `NOT NULL DEFAULT 0` plus an explicit `meta.usage_reported: false`
  flag, never a guessed nonzero value.
- `analyze.py`'s one `create_file_analyzer(...)` call site now threads
  `user_id`/`upload_id` through.
- **Result**: `pdf_text_extraction`, `pdf_vision_extraction`, and
  `table_extraction` are now logged to `llm_usage_events` and visible in
  `/crm/ops/openai-usage`'s existing `provider in ["openai","openai-vision"]`
  filter, which previously had nothing to find for the vision provider
  value. `llm_cost_audit.py`'s registry reflects this: all three
  categories show `already_logged: true`, `risk_level: "low"`;
  `known_gaps` is empty.

## 7. What did NOT change

- **Clinical outputs**: no pattern-detection, hypothesis-scoring,
  contradiction, calibration, evidence-gap, evidence-debt, or safety
  logic was modified anywhere in P24–P28.
- **Model choices**: no `settings.active_llm_model`/`openai_vision_model`
  default or selection logic was touched.
- **Prompts**: no system/user prompt text was modified in any LLM call
  site (only logging was added, after the API call completes).
- **Frozen replay contract for pre-P24 fields**: every existing
  frozen-replay field (`clinical_hypotheses`, `evidence_gaps`,
  `evidence_debt`, `report_quality_audit`, etc.) is unchanged; P24/P25
  only ADDED three new keys, never modified an existing one.
- **UI/frontend/CRM**: zero frontend or CRM-UI files were touched across
  P24–P28. (Unrelated, pre-existing UA-redesign work from outside this
  engagement remains in the working tree, untouched and unstaged — see
  section 9.)

## 8. Known baseline backend failures (unchanged across every P24–P28 stage)

Confirmed identical set, same 9 test names, on every full-suite run
throughout this entire engagement (P24.1 through this checkpoint):

```
app/tests/test_b2b_analyze_labs.py::test_b2c_pipeline_shape_not_broken
tests/test_admin_runtime_readiness.py::test_runtime_readiness_marks_redis_url_as_missing_when_redis_backend
tests/test_idor_bola_protection.py::TestIDORProtection::test_cannot_access_other_user_upload
tests/test_idor_bola_protection.py::TestIDORProtection::test_cannot_delete_other_user_upload
tests/test_idor_bola_protection.py::TestIDORProtection::test_cannot_access_other_user_protocol
tests/test_idor_bola_protection.py::TestBOLAProtection::test_numeric_id_enumeration_prevention
tests/test_idor_bola_protection.py::TestBOLAProtection::test_admin_cannot_access_user_data_without_permission
tests/test_idor_bola_protection.py::TestIDORVectorPatterns::test_uuid_not_guessable
tests/test_stage2f2_domain_scores_provenance.py::test_g2_b2c_analyze_router_never_passes_questionnaire_kwarg
```

As of this checkpoint: **1376 passed, 20 skipped, 9 failed** (this
checkpoint's own re-run). Pre-existing, unrelated to P24–P28; none of
these tests touch any file this roadmap block created or modified.

## 9. Verification performed for this checkpoint

- Focused suite across all seven stages (172 tests):
  `test_population_profiles.py`, `test_population_profile_selection.py`,
  `test_population_profile_selection_pipeline_integration.py`,
  `test_doctor_escalation_precision.py`,
  `test_doctor_escalation_precision_pipeline_integration.py`,
  `test_rule_pack_quality.py`, `test_knowledge_rule_pack_quality_endpoint.py`,
  `test_clinical_disagreement.py`, `test_llm_cost_audit.py`,
  `test_crm_ops_llm_cost_audit_endpoint.py`,
  `test_file_analyzer_usage_logging.py`,
  `test_stage2g_frozen_report_reproducibility.py` — **172/172 passed**.
- Full backend suite: 1376 passed, 20 skipped, 9 failed (baseline,
  confirmed identical to section 8).
- `git status`/`git diff --cached` confirmed: nothing staged, and the
  only unstaged changes in the working tree are pre-existing,
  unrelated UA-redesign files from outside this engagement
  (`frontend/index.html`, `frontend/src/App.jsx`,
  `frontend/src/pages/Ua*.jsx`, `frontend/scripts/*.mjs`,
  `scripts/deploy-ua-frontend-dist.sh`) plus `.DS_Store` noise — none of
  it touched, staged, or included by this checkpoint.
- Re-confirmed via direct source inspection (not memory) that P26/P27/P28
  are absent from `lab_analysis_pipeline.py` and `report_history.py`
  (`grep -c` returns `0` for all three module names in both files).

## 10. Risk register / non-blockers

None of the following block current production use; listed for future
planning:

1. **`athlete_recovery` has no activation UI/API surface yet.** It can
   only be reached via `source_metadata["population_profile_ids"]` (an
   internal/manual override) or structured `intervention_memory`
   inference. No product decision has been made about surfacing profile
   selection to users or practitioners.
2. **P27 has no endpoint.** It is currently only reachable by direct
   Python import — useful for ad hoc internal analysis/product research,
   not yet wired into any ops tool. See section 5 for why an endpoint
   was deliberately deferred (cross-user report access is higher stakes
   than the two aggregate-only endpoints that did ship).
3. **P26/P27/P28 outputs are not persisted anywhere** — every call
   recomputes from live/current data. This is correct for P28 (a static
   registry) and P26 (aggregate governance stats change constantly), but
   means P27's disagreement analysis for a specific historical report
   can only be reproduced if the same `clinical_hypotheses`/
   `population_profile_overlays` inputs are re-supplied — there is no
   "P27 result as of report generation time" to look back at, unlike
   P24/P25 which are frozen-replay-safe.
4. **The pre-existing PDF/vision `_persist_openai_usage`
   (ua_wellbeing_openai.py) duplication was not consolidated** — flagged
   in the P28 audit as a proposed next action, not done in P28.1 (P28.1
   scope was closing the actual coverage gap, not refactoring the
   already-working UA wellbeing logging path).
5. **`/crm/ops/claude-usage` naming remains legacy** (no real
   Claude/Anthropic usage exists anywhere in this codebase) — cosmetic,
   proposed-not-implemented per the P28 audit.

## 11. Recommended next steps

1. Decide whether/how `athlete_recovery` should ever become
   selectable by a real user or practitioner (product decision, not a
   technical blocker).
2. If P27 (Clinical Disagreement Mode) proves useful for internal
   research, design a scoped, single-report, cross-user-access-audited
   endpoint for it rather than leaving it import-only.
3. Consider consolidating `_persist_openai_usage`
   (`ua_wellbeing_openai.py`) into `claude_service._persist_usage_event`
   to remove the last usage-logging duplication (P28's proposed action
   #2, not yet implemented).
4. No urgent action required on the 9 baseline failures — they predate
   this roadmap block and are unrelated to any file it touches.
