# LLM Cost Audit — 2026-09-17 (P28)

Backend/ops stage of the Clinical Reasoning Engine uniqueness roadmap. This
is a **deterministic code audit**, not a live cost report — for live
spend, use `GET /crm/ops/openai-usage`. This document is the human-readable
companion to `backend/app/services/llm_cost_audit.py`'s static registry,
exposed read-only at `GET /crm/ops/llm-cost-audit` (super_admin only).

**Naming note up front**: despite the filenames, `claude_service.py` and
`claude_pdf_analyzer.py` do **not** call Anthropic/Claude — they call an
OpenAI-compatible `chat/completions` endpoint. There is no real Anthropic
SDK usage anywhere in this codebase. The `/crm/ops/claude-usage` endpoint
name is legacy for the same reason.

## Current known LLM paths

| Category | File | Trigger | Type | Logged? | Risk |
|---|---|---|---|---|---|
| Biomarker extraction (text) | `claude_service.py:641` | `POST /analyze` | clinical_production | ✅ | low |
| Questionnaire follow-up | `claude_service.py:854` | Questionnaire flow | clinical_production | ✅ | low |
| Questionnaire summary | `claude_service.py:907` | Questionnaire flow | clinical_production | ✅ | low |
| UA wellbeing assessment | `ua_wellbeing_openai.py:108` | `POST /assessment/ua-wellbeing` (public, no auth) | clinical_production | ✅ (duplicate impl.) | medium |
| PDF text extraction | `claude_pdf_analyzer.py` (`PDFTextAnalyzer`) | `POST /analyze/pdf`, `/analyze/upload` | ocr_vision | ❌ | **high** |
| PDF/image vision extraction | `claude_pdf_analyzer.py` (`ImageAnalyzer`/`PDFVisionAnalyzer`) | `POST /analyze/pdf`, `/analyze/upload` | ocr_vision | ❌ | **high** |
| CSV/XLSX table extraction | `table_analyzer.py` | `POST /analyze/pdf`, `/analyze/upload` | ocr_vision | ❌ | medium |
| Protocol generation | `claude_service.py:717` | Every pipeline run, `POST /protocol` | protocol_generation | ✅ | low |
| Premium health tips | `llm_consult.py:166` | `POST /llm/health-tips` (gated, background job) | protocol_generation | ✅ | low |
| Staging live smoke workflows | `test_staging_live_supabase_smoke.py`, `test_health_profile_live_smoke.py` | Scheduled/dispatch CI (`E2E_RUN_LIVE`) | smoke_test | n/a | low |
| Standalone smoke scripts | `backend/scripts/e2e_smoke_upload_analyze_protocol.py`, `smoke_partner_http_flow.py` | Manual only, **not wired into any CI workflow** | smoke_test | n/a | medium |
| Ops usage dashboards | `crm_ops.py` (`/openai-usage`, `/claude-usage`) | `GET /crm/ops/*` (super_admin) | ops | n/a | low |

Full detail (exact reasoning, model/env config, cacheability) lives in
`backend/app/services/llm_cost_audit.py` — this table is a summary of it.

## Protections already in place

- **`is_llm_configured()`** (`claude_service.py`) and a local duplicate in
  `ua_wellbeing_openai.py` gate every real call site — no LLM call fires
  without `settings.active_llm_api_key` set.
- **`llm_usage_events`** table + `_persist_usage_event()`
  (`claude_service.py`) / `_persist_openai_usage()` (`ua_wellbeing_openai.py`)
  log every text-completion call site (extraction, protocol, questionnaire,
  health tips, UA wellbeing) with `task_name`, `model`, token counts.
- **`GET /crm/ops/openai-usage`** — super_admin-only, read-only dashboard
  with totals, per-model/per-task breakdown, and a daily-spend-average
  threshold guard (`settings.openai_daily_spend_alert_threshold_usd`,
  default $5/day) — added specifically in response to the September 2026
  spend incident (see `crm_ops.py:495-496` and commits `fff66a3e`,
  `41ef8703`).
- **Staging live smoke workflows are confirmed LLM-free** — they only
  exercise `/health`, `/auth/me`, and `/admin/*` endpoints; no `/analyze`,
  `/protocol`, or `/assessment/ua-wellbeing` coverage exists in CI today.
- **This audit's own endpoint (`/crm/ops/llm-cost-audit`)** is a pure
  static-registry read: no database call, no LLM call, super_admin-gated.

## Remaining risks

1. **PDF/vision/table extraction paths are not logged to `llm_usage_events`
   at all.** These are real, cost-incurring OpenAI calls (vision models are
   the most expensive per-call path in the system) that are completely
   invisible to `/crm/ops/openai-usage` today. This is the single biggest
   gap this audit found.
2. **`_persist_usage_event` (claude_service.py) and `_persist_openai_usage`
   (ua_wellbeing_openai.py) are near-duplicate implementations** of the
   same insert logic — not incorrect today, but a drift risk over time.
3. **UA wellbeing assessment is public and unauthenticated** — cost
   exposure here depends entirely on whatever rate limiting exists at the
   infra/WAF layer, which this audit did not verify.
4. **Two standalone smoke scripts exist that touch the analyze/protocol
   path** (`e2e_smoke_upload_analyze_protocol.py`, `smoke_partner_http_flow.py`)
   but are confirmed **not** wired into any `.github/workflows/*.yml`
   today. If either is ever scheduled without an explicit smoke-mode
   guard, it would incur real, repeating LLM cost.
5. **`/crm/ops/claude-usage` naming is legacy/confusing** given no real
   Claude/Anthropic usage exists anywhere — low priority, cosmetic.

## Proposed next actions (not implemented in this stage — audit only)

1. Add usage logging to `claude_pdf_analyzer.py`'s completion call sites
   (text and vision) and `table_analyzer.py`, reusing
   `claude_service._persist_usage_event` rather than writing a third
   implementation.
2. Consolidate `ua_wellbeing_openai.py`'s `_persist_openai_usage` into the
   shared `claude_service._persist_usage_event` helper.
3. Confirm/add rate limiting on `POST /assessment/ua-wellbeing` given its
   public, unauthenticated nature.
4. If either standalone smoke script is ever scheduled, add an explicit
   opt-in env-var guard (mirroring `E2E_RUN_LIVE`) before wiring it into CI.
5. Optional, low priority: rename `/crm/ops/claude-usage` to something
   accurate, or merge it into `/crm/ops/openai-usage` since they cover the
   same provider.

None of the above were implemented in this stage — P28's scope was audit
and read-only ops visibility only, per the roadmap instruction not to
change model choices or disable production LLM paths without a clearly
broken/smoke-only path being found (none was).

## Frozen replay boundary (explicit rule)

**Cost visibility must stay outside frozen clinical replay.** This audit
module (`llm_cost_audit.py`) and its endpoint are:

- **not** imported by `lab_analysis_pipeline.py` or `report_history.py`
  (verified by a source-text test — see
  `test_module_not_imported_by_clinical_pipeline_or_report_history` in
  `backend/tests/test_llm_cost_audit.py`),
- **not** added to `input_snapshot` — this stage made **zero** changes to
  either `lab_analysis_pipeline.py` or `report_history.py` (confirmed via
  `git diff` during implementation),
- entirely separate from the pre-existing `cost_metadata` field, which
  already lives in `input_snapshot` (added before this stage,
  `lab_analysis_pipeline.py:1680`) and is read by `report_quality_audit.py`
  as `cost_audit` — that pre-existing pattern is untouched and is not what
  P28 extends. P28 does not add a second, competing cost field into the
  clinical report contract.

A population profile, an escalation, or any other clinical reasoning field
must never depend on this audit's output, and this audit's output must
never become part of a frozen report snapshot.
