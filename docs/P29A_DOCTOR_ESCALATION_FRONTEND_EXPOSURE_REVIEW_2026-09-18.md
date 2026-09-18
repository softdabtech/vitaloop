# P29a — Doctor Escalation Precision Frontend Exposure Review (2026-09-18)

Review/QA pass, per the roadmap's own instruction not to build UI before
verifying exposure. One small backend data-exposure inconsistency was
found and fixed (see §7); no UI was built, no clinical logic changed.

## 1. Exact backend fields available

`doctor_escalation_precision` (P25, `backend/app/services/doctor_escalation_precision.py`):

```json
{
  "version": "p25_v1",
  "overall_level": "self|practitioner|doctor|urgent",
  "recommended_timing": "routine|soon|prompt|urgent|unknown",
  "escalations": [
    {
      "id": "...",
      "level": "self|practitioner|doctor|urgent",
      "recommended_timing": "routine|soon|prompt|urgent|unknown",
      "domain": "...",
      "reason_codes": ["doctor_flag_present", "confidence_limited_by_missing_context", "..."],
      "related_markers": ["ALT", "AST"],
      "related_symptoms": [],
      "related_hypotheses": ["hypothesis_id", "..."],
      "related_contradictions": ["contradiction message text"],
      "related_profiles": ["longevity_metabolic_optimization"],
      "pattern_escalation_reasons": ["..."],
      "human_readable_reason": "This finding should be discussed with a doctor because ...",
      "not_a_diagnosis": true
    }
  ],
  "summary": {"urgent_count": 0, "doctor_count": 1, "practitioner_count": 0, "self_count": 0}
}
```

## 2. Exact API paths checked

| Route | File | Used by Results/Protocol? | `response_model`? |
|---|---|---|---|
| `GET /results/{upload_id}` | `backend/app/routers/protocol/compatibility.py:57` (`get_results_by_upload`) | **Yes — both pages call this** | None (raw dict) |
| `GET /analyze/{upload_id}` | `backend/app/routers/analysis/analyze.py:1485` (`get_results`) | No (structurally identical sibling, not called by either page) | None (raw dict) |
| `POST /analyze`, `POST /analyze/manual`, `POST /analyze/{upload_id}/regenerate` | `backend/app/routers/analysis/analyze.py:889,1674,1839` | No — used only for the initial upload/regenerate action, not for the pages' own data load | `response_model=AnalyzeResponse` — **has no `doctor_escalation_precision` field, silently stripped** |
| `POST /protocol`, `GET /protocol/{upload_id}` | `backend/app/routers/protocol/protocol.py:56,178` | No — Protocol page calls `/results/{upload_id}`, not this | `response_model=ProtocolResponse` (`id, user_id, upload_id, recommendations, unified_safety_state` only) — never touches the pipeline/frozen response at all, so the field never enters this endpoint's data flow in the first place |

**Frontend call sites** (both confirmed via direct `grep`):
- `frontend/src/pages/Results.jsx:1308` — `api.get(`/results/${uploadId}`)`
- `frontend/src/pages/ProtocolPage.jsx:265` (inside `loadProtocolData`) — `api.get(`/results/${uploadId}`)`

Both pages load from the **same** compatibility endpoint. Neither page calls `/analyze/{upload_id}` or `/protocol/{upload_id}` for its main data.

## 3. Does a fresh report expose the field?

Yes, unconditionally, once the fix in §7 is applied. Before the fix:
present for a report with a persisted `report_versions` row (the normal
case, via `assemble_frozen_response`); **absent at the top level** (only
nested in `final_analysis`) for a brand-new/legacy upload with no frozen
version yet, on both `GET /results/{upload_id}` and `GET /analyze/{upload_id}`.

## 4. Does frozen/history return it, and do old reports return `None` safely?

Yes on both counts, unchanged and already correct — `backend/app/services/report_history.py:237`:

```python
"doctor_escalation_precision": input_snapshot.get("doctor_escalation_precision"),
```

Read verbatim from `input_snapshot`, never recomputed. A report generated
before P25 existed has no such key in its `input_snapshot`, so `.get()`
returns `None` — confirmed by the existing
`test_frozen_response_handles_missing_doctor_escalation_precision_gracefully`
test (from the P25 stage), re-run clean in this review.

## 5. Can the Results page access the field TODAY (in the browser, as JS)?

**Conditionally yes, but nothing renders it.** `Results.jsx` sets a
`finalAnalysis` state variable directly from the response's
`final_analysis` field (`Results.jsx:1320`,
`setFinalAnalysis(data.final_analysis ?? null)`), and `final_analysis` on
both response branches already contains `doctor_escalation_precision`
(frozen: a full copy of the response dict; live: the raw
`pipeline_result`). `finalAnalysis` state is passed whole into
`<AnalysisCoreV2Panel finalAnalysis={finalAnalysis} .../>`
(`Results.jsx:1571`), which currently only destructures
`health_states`, `quality_snapshot`, `trend_analysis`, and `metadata`
from it (`Results.jsx:1222-1225`) — **no code path in `Results.jsx`
reads `.doctor_escalation_precision` off that object today**, so it is
present in memory but invisible in the rendered UI.

## 6. Can the Protocol page access the field TODAY?

**No — fully unreachable**, independent of the backend fix in §7.
`ProtocolPage.jsx`'s `loadProtocolData` (`ProtocolPage.jsx:263-291`) is a
strict field-whitelist adapter: it destructures exactly
`biomarkers, protocol, doctorDiscussion, retestPlan, safetyAlerts,
shoppingLinks, knowledgeReport, clinicalReasoningTraces,
progressIntelligence` out of the raw response and discards everything
else — the raw `data`/`final_analysis` object does not survive past this
function. Adding `doctor_escalation_precision` to a P29 Protocol UI would
require first adding one line to this function
(`doctorEscalationPrecision: data?.doctor_escalation_precision ?? data?.final_analysis?.doctor_escalation_precision ?? null`)
before any rendering could happen.

## 7. Filters/schemas/adapters found — and the one bug fixed

Found and fixed one small, real data-exposure inconsistency (not a
crash, not a security issue, not a clinical-behavior change):

**Before:** on both `GET /results/{upload_id}`
(`compatibility.py::get_results_by_upload`) and `GET /analyze/{upload_id}`
(`analyze.py::get_results`), the **frozen-report branch** exposed
`doctor_escalation_precision` at the top level of the JSON response (it's
part of `assemble_frozen_response`'s own return dict), but the
**live/legacy-fallback branch** (a separately hand-built dict, used when
no frozen `report_versions` row exists yet) only had it nested inside
`final_analysis`, not at the top level. Same underlying data, two
different response *shapes* depending on report state — exactly the kind
of inconsistency that silently breaks a future consumer who reads the
top-level key directly (works for frozen reports, `undefined` for
brand-new/legacy ones).

**Fix (this review, backend-only, additive):** both live/legacy-fallback
branches now also alias the same already-computed value at the top
level:

```python
"doctor_escalation_precision": pipeline_result.get("doctor_escalation_precision"),
```

- `backend/app/routers/protocol/compatibility.py` (`get_results_by_upload`'s live/legacy-fallback return dict)
- `backend/app/routers/analysis/analyze.py` (`get_results`'s live/legacy-fallback return dict)

No key removed, no existing value changed, no clinical logic touched —
this only adds a second, top-level pointer to data that was already
present (nested) in the same response.

**Confirmed still stripped, NOT fixed (out of scope for this review):**
`AnalyzeResponse` (used by `POST /analyze`, `/analyze/manual`,
`/analyze/{id}/regenerate`) still has no `doctor_escalation_precision`
field and will keep silently stripping it via Pydantic's `response_model`
filtering. This was not touched because neither Results nor Protocol
page reads its main display data from these POST responses — they
immediately re-fetch via `GET /results/{upload_id}` after any
upload/regenerate action. Documented as a non-blocking risk in §9, not
fixed, since widening `AnalyzeResponse` affects other consumers of those
specific endpoints and is a separate, broader decision.

**`ProtocolResponse`** (`protocol.py:35-40`) was inspected and is
correctly narrow by design — it never touches the pipeline/frozen
response at all, so there's nothing to "fix" there; see §6.

## 8. Safety/copy readiness

`human_readable_reason` strings use fixed templates
(`_human_readable_reason` in `doctor_escalation_precision.py`) —
"should be discussed", "may need review", "can limit interpretation"
style phrasing, confirmed forbidden-wording-free by P25's own test suite
(`test_forbidden_wording_absent_from_generated_text`). Every escalation
carries `"not_a_diagnosis": true`.

**Safe for direct user-facing display, as-is, no rewording needed:**
- `overall_level`, `recommended_timing`
- `escalations[].level`, `escalations[].recommended_timing`
- `escalations[].human_readable_reason` (already cautious, complete sentences)
- `escalations[].related_markers`, `escalations[].related_symptoms` (plain marker/symptom names)
- `escalations[].not_a_diagnosis` (a boolean flag — useful for the UI to always render its own fixed disclaimer next to any escalation content, not to display literally)

**Recommend practitioner-only or hidden from a first pass of end-user UI:**
- `escalations[].reason_codes` — internal enum strings
  (`confidence_limited_by_calibration`, `pattern_doctor_escalation`, etc.);
  meaningful to a practitioner/ops reviewer, not directly presentable to
  an end user without a translation layer. Fine to send to the client
  (nothing sensitive), but the *default* consumer UI shouldn't render the
  raw codes — `human_readable_reason` already exists specifically to
  cover this for end users.
- `escalations[].related_hypotheses` (internal hypothesis ids) and
  `escalations[].pattern_escalation_reasons` (verbatim internal pattern
  strings, already cautious text but written for a clinician audience,
  e.g. quoting specific lab thresholds) — reasonable to surface in a
  practitioner/CRM-facing view later, not necessarily in a first
  consumer-facing pass.
- `escalations[].related_contradictions` — free-text contradiction
  messages; same "clinician-oriented phrasing" consideration as above.
- `escalations[].related_profiles` — population-profile ids
  (`longevity_metabolic_optimization`); meaningful only once P29 UI also
  explains what a population profile is — premature to surface alone.

None of the above are a *security* concern (nothing here is more
sensitive than data the user already sees elsewhere in their own
report) — this is a UX/copy sequencing recommendation, not an access
control finding.

## 9. Proposed P29 UI implementation plan

1. **Protocol page first** (or in parallel): add one line to
   `loadProtocolData` in `ProtocolPage.jsx` to pass
   `doctor_escalation_precision` through (see §6) — currently the only
   hard blocker for that page.
2. **Results page**: read `finalAnalysis?.doctor_escalation_precision`
   directly (already present, see §5) into a dedicated `useState`
   (matching the existing per-field pattern already used for
   `clinical_hypotheses`, `evidence_gaps`, etc.), rather than expecting
   `AnalysisCoreV2Panel` to reach into the whole `finalAnalysis` object
   for it.
3. Render `overall_level` + `recommended_timing` as a small summary
   banner/badge (self/practitioner/doctor/urgent → routine/soon/prompt/urgent),
   reusing whatever visual language the existing safety/urgency UI
   already uses elsewhere on the page (`unified_safety_state` is already
   rendered somewhere in `Results.jsx` — check that component for a
   consistent visual pattern to reuse rather than inventing a new one).
4. For each `escalations[]` entry, render `human_readable_reason` as the
   primary user-facing text; keep `reason_codes`/`related_hypotheses`/
   `pattern_escalation_reasons`/`related_contradictions` out of the
   default view (§8) — consider a practitioner-mode/CRM-only expansion
   later, not in the first consumer pass.
5. Add an explicit, fixed disclaimer near any rendered escalation content
   (e.g. "This is an educational summary, not a diagnosis or treatment
   plan.") rather than relying on `not_a_diagnosis: true` to be
   self-explanatory to an end user.
6. Do not attempt to surface `related_profiles` until population-profile
   context has its own explainer somewhere in the product.

## 10. Risks / non-blockers

1. **`AnalyzeResponse` still silently strips the field** on 3 POST
   routes (§7) — not currently consumed by either page's main data load,
   so not a blocker for P29 UI, but a latent trap for any *future*
   feature that reads `doctor_escalation_precision` directly off a POST
   response instead of the follow-up GET. Worth widening
   `AnalyzeResponse` in a future, separately-scoped change.
2. **`GET /analyze/{upload_id}`** (`analyze.py::get_results`) is not
   currently called by either page — the fix in §7 was still applied
   there too, for consistency and to avoid this becoming a second latent
   trap if a future frontend change starts using it instead of the
   compatibility route.
3. **No UI exists yet** — by design of this review stage. P29 UI work is
   still fully pending; see §9 for the proposed plan.
4. **Copy sequencing** (§8) is a recommendation, not a technical
   constraint — nothing in the current field set is unsafe to transmit
   to an already-authenticated user viewing their own report.

## 11. Tests added in this review (P29a)

- `backend/tests/test_results_compatibility.py::test_results_by_upload_success` —
  extended to assert `doctor_escalation_precision` is present at the top
  level (not just nested in `final_analysis`) for a legacy/live-fallback
  report.
- `backend/tests/test_stage2h_schema_and_architecture.py::test_p29a_doctor_escalation_precision_exposed_top_level_on_both_get_endpoints` —
  a source-inspection test proving both `get_results` (analyze.py) and
  `get_results_by_upload` (compatibility.py) alias
  `doctor_escalation_precision` at the top level in their live/legacy-
  fallback return dicts, so a future edit to either function that
  accidentally drops this line will fail CI immediately.

## Tests recommended for P29 (UI stage, not added here)

- Results.jsx: a test/story confirming the new escalation state is set
  from `finalAnalysis.doctor_escalation_precision` and renders
  `overall_level`/`recommended_timing`/`human_readable_reason` correctly
  for both frozen and live-fallback response shapes.
- ProtocolPage.jsx: a test confirming `loadProtocolData` now passes
  `doctor_escalation_precision` (or a UI-friendly derived field) through
  to the component.
- A visual/copy review confirming the disclaimer (§9 item 5) renders
  adjacent to any escalation content, not just embedded in
  `human_readable_reason`'s own text.

## Verification performed

- Focused regression set: `test_results_compatibility.py`,
  `test_stage2h_schema_and_architecture.py`,
  `test_stage2g_frozen_report_reproducibility.py`,
  `test_doctor_escalation_precision.py`,
  `test_doctor_escalation_precision_pipeline_integration.py`,
  `test_analyze_legacy_multipart_compat.py`,
  `test_e2e_upload_analyze_protocol.py`,
  `test_free_user_complete_flow.py` — **71 passed, 1 skipped** (the skip
  is pre-existing and unrelated).
- Full backend suite: **1377 passed, 20 skipped, 9 failed** — the 9
  failures are the same pre-existing, unrelated baseline confirmed
  identical throughout every prior P24–P28 stage of this engagement
  (`test_b2b_analyze_labs.py::test_b2c_pipeline_shape_not_broken`,
  `test_admin_runtime_readiness.py::test_runtime_readiness_marks_redis_url_as_missing_when_redis_backend`,
  6× `test_idor_bola_protection.py`,
  `test_stage2f2_domain_scores_provenance.py::test_g2_b2c_analyze_router_never_passes_questionnaire_kwarg`).
- No clinical behavior changed: the fix only adds a top-level dict key
  aliasing data already present elsewhere in the same response; no
  pipeline stage, model, prompt, or scoring logic was touched.
- No frontend/CRM files were changed in this review.
