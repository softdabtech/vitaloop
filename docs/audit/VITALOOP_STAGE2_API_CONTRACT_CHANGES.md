# VITALOOP Stage 2 — API Contract Changes (Revision 2)

Planning document only. No endpoint has been modified. All changes below are additive/backward-compatible unless explicitly marked otherwise.

**Revision 2 note:** §1's `needs_confirmation` behavior is unchanged in *contract* (fields still omitted as described) but is now backed by a different *mechanism* — the canonical `biomarkers` rows genuinely do not exist yet in this state (deferred write, per the revised Stage 2B design), rather than existing-but-hidden behind a status filter. No `biomarkers`-table schema change accompanies this document's changes anywhere. §2 additionally now guarantees that `protocols.recommendations` and `report_versions.protocol` contain identically-sanitized content once Stage 2C ships (previously-undiscovered gap, see Implementation Plan §Stage 2C item 2).

Enum vocabulary reuses what already exists live wherever possible (per the brief's instruction to inspect before inventing): `analysis_status` naming is taken directly from the existing B2B convention (`app/services/b2b/analyze_labs.py`); `decision` values (`auto_continue`/`confirm`/`block_or_confirm`) and `safety_result.status` values (`approved`/`approved_with_warnings`/`blocked`) are unchanged from what's already live — this document does not introduce a competing enum for either.

---

## 1. `analysis_status` — new field, consumer-facing endpoints

**Values:** `extracting` | `needs_confirmation` | `analyzing` | `completed` | `blocked` | `failed` (consumer). B2B gets its own value in the same field name: `needs_review` (see §5).

**CURRENT CONTRACT** — `POST /analyze`, `POST /analyze/pdf`, `POST /analyze/upload`, `POST /analyze/manual`, `GET /{upload_id}`: response always includes `interpreted_report`, `protocol`, `knowledge_report`, `safety_result`, `analysis_input_quality_gate`, `clinical_data_integrity`, unconditionally, regardless of gate/candidate state.

**NEW CONTRACT:** response gains a top-level `analysis_status` field.
- When `completed`: shape unchanged (all fields present as today).
- When `needs_confirmation`: `interpreted_report`, `protocol`, `knowledge_report` are **omitted** (not `null` — omitted, so existing frontend code that does `data.interpreted_report.something` fails loudly instead of silently rendering with a `null`-shaped hole — intentional, forces explicit frontend handling). `biomarker_extraction_candidates` (already fetchable via the existing `GET /{upload_id}/candidates` endpoint) becomes the thing the frontend should render instead. `analysis_input_quality_gate` and `clinical_data_integrity` remain present (they're the reason confirmation is needed).
- When `blocked`/`failed`: similar omission, plus a `status_reason` string (human-readable, locale-aware) explaining what's needed (re-upload, correction, etc.).

**BACKWARD COMPATIBILITY:** Existing frontend code built against "these fields are always present" will break for the `needs_confirmation`/`blocked`/`failed` cases — this is intentional per the Implementation Plan's feature-flag rollout (`ENFORCE_QUALITY_GATE`), which keeps today's always-`completed`-shaped behavior until the frontend's confirmation UX (Stage 2B, item 7) is confirmed deployed.

**FRONTEND CONSUMERS:** `frontend/src/pages/Results.jsx`, `frontend/src/pages/Upload.jsx` (post-upload redirect logic), `frontend/src/pages/UserDashboard.jsx` (outstanding-confirmation indicator).

**CRM/B2B EFFECT:** none for consumer-side field (B2B has its own value, §5).

**ERROR STATUS:** no new HTTP error codes — `analysis_status` is a body field, not a status-code change. `GET /{upload_id}` continues to return `200` even in `needs_confirmation`/`blocked` states (the *upload* was found and processed to the extent it could be; the *content* is what's gated).

**EXAMPLE RESPONSE** (`needs_confirmation`):
```json
{
  "upload_id": "150aa777-...",
  "analysis_status": "needs_confirmation",
  "analysis_input_quality_gate": {
    "decision": "block_or_confirm",
    "requires_confirmation": true,
    "score": 0.808,
    "label": "medium",
    "blockers": [
      {"key": "low_confidence_candidates", "count": 1},
      {"key": "unit_or_plausibility_conflict", "count": 1}
    ]
  },
  "clinical_data_integrity": { "status": "review_required", "...": "..." },
  "candidates_url": "/analyze/150aa777-.../candidates"
}
```

---

## 2. `POST /{upload_id}/confirm-candidates` — contract tightening

**CURRENT CONTRACT:** accepts candidate corrections, always re-runs the pipeline and persists a new `report_versions` row on every call.

**NEW CONTRACT:** unchanged request shape. Response now includes the resulting `analysis_status` (should transition to `completed`, or back to `needs_confirmation` if the corrected data still fails the gate — see Implementation Plan's 3-attempt cap proposal). Idempotency guarantee added: calling this endpoint twice with identical confirmed values does not create a second `report_versions` row (checks for an existing `completed` version matching the current confirmed-candidate set first).

**BACKWARD COMPATIBILITY:** fully additive — existing callers get the same fields plus one new one (`analysis_status`).

**FRONTEND CONSUMERS:** the new confirmation UX (Stage 2B).

**CRM/B2B EFFECT:** none — consumer-only endpoint.

**ERROR STATUS:** new `409 Conflict` if called on an upload already in `completed` state with no candidates in `pending`/`corrected` status (nothing to confirm) — currently this would silently just re-run the pipeline pointlessly.

**EXAMPLE RESPONSE:**
```json
{
  "upload_id": "150aa777-...",
  "analysis_status": "completed",
  "report_version_id": "e4ea40f3-...",
  "candidates_confirmed": 4,
  "candidates_rejected": 1
}
```

---

## 3. `GET /{upload_id}` — reproducibility change (Stage 2G)

**CURRENT CONTRACT:** always recomputes via a fresh pipeline run; separately attaches the persisted `report_version` object informationally.

**NEW CONTRACT:** when a `completed` `report_versions` row exists, its stored content becomes the primary source for `interpreted_report`/`protocol`/`knowledge_report`/`explainability`/`analysis_input_quality_gate`/`clinical_data_integrity`/`evidence_gaps` (read back out of `input_snapshot`, no schema change needed per the Implementation Plan). Falls back to fresh computation only when no completed version exists yet (matches the `needs_confirmation` case naturally, since no version was ever persisted for that state).

**NEW query parameter:** `?locale=en|uk` — re-applies only the copy-selection layer to the frozen version's data, does not trigger recomputation or a new version (Implementation Plan §Stage 2G locale note).

**NEW query parameter (optional, additive):** `?version=N` — fetch a specific historical version rather than latest, if `get_latest_report_version` doesn't already support this (needs confirmation at implementation time; if it only fetches latest today, this is a genuinely new capability, not just a contract change).

**BACKWARD COMPATIBILITY:** response *shape* unchanged; response *content* becomes frozen instead of always-fresh — for any upload where no KB/prompt/model change has happened since generation, behavior is identical to today (the common case). Only diverges from today's behavior in the specific scenario Stage 2G exists to fix.

**FRONTEND CONSUMERS:** `Results.jsx` — no code change required if it only reads existing fields; optional UI addition of a version indicator ("Generated on {date}, current knowledge base may differ — regenerate") is a nice-to-have, not required.

**CRM/B2B EFFECT:** none (B2B doesn't call this consumer endpoint).

**ERROR STATUS:** unchanged.

---

## 4. `GET /dashboard/summary` — `latest_lab_result` field addition (Stage 2D)

**CURRENT CONTRACT:** `blocks.latest_upload` = most recent upload by `created_at` (conflates "just uploaded" with "most recent actual result").

**NEW CONTRACT:** adds `blocks.latest_lab_result` = most recent upload by `test_date` (falling back to `collected_at`/`reported_at`). `blocks.latest_upload` is **kept unchanged** for one deprecation cycle (still `created_at`-based) to avoid breaking any consumer relying on its current (admittedly conflated) meaning; frontend is updated to read the new field.

**BACKWARD COMPATIBILITY:** fully additive.

**FRONTEND CONSUMERS:** `frontend/src/pages/UserDashboard.jsx:47`.

**CRM/B2B EFFECT:** none.

**ERROR STATUS:** unchanged.

**EXAMPLE RESPONSE (excerpt):**
```json
{
  "blocks": {
    "latest_upload": { "id": "d368b8e5-...", "created_at": "2026-08-28T14:04:28Z" },
    "latest_lab_result": { "id": "150aa777-...", "test_date": "2026-08-27", "date_source": "user_provided" }
  }
}
```

---

## 5. `POST /v1/b2b/analyze-labs` — `needs_review` (Stage 2B, B2B leg)

**CURRENT CONTRACT:** unconditionally sets `"status": "completed"` and `"analysis_status": "completed"` regardless of the gate's decision; no `report_versions` persisted.

**NEW CONTRACT:** when `analysis_input_quality_gate.decision != "auto_continue"`, sets `analysis_status: "needs_review"` (distinct from consumer `needs_confirmation` — partners get the full computed-but-flagged data back, not a withheld response, since they're a machine consumer, not a human needing a confirmation UI) and includes the gate/integrity details as today (unchanged — these fields are already returned).

**BACKWARD COMPATIBILITY:** **breaking for partners who only check `status == "completed"` as their sole success signal without inspecting `analysis_status` nuance** — flagged explicitly; requires partner-facing changelog/notice before deployment, not a silent change. Partners who already inspect `analysis_input_quality_gate.decision` themselves (if any do) are unaffected.

**FRONTEND CONSUMERS:** none (server-to-server).

**CRM/B2B EFFECT:** direct — this is the B2B contract itself. Requires partner communication before Stage 2B ships its B2B leg; recommend shipping the B2C leg of 2B first, B2B leg as a clearly-separated sub-deploy with its own notice period.

**ERROR STATUS:** unchanged (still `200`, informational field change only, not an error).

---

## 6. `/progress` and `/progress/overview` — `comparison_status` field (Stage 2D-2, deferred)

Not part of the Stage 2 minimum fix set (Stage 2D-1 only fixes sort order), but specified here since the brief asked for explicit field design:

**NEW field, additive, on `/progress/overview`'s per-marker entries:**
```json
{
  "marker": "ldl",
  "direction": "rising",
  "comparison_status": "worsened",
  "clinical_context_note": "Rising LDL is unfavorable in most contexts."
}
```
`direction` (`rising`/`falling`/`stable`) stays purely arithmetic, unchanged from today. `comparison_status` (`improved`/`worsened`/`stable`/`new`/`missing`/`incomparable`/`insufficient_history`) is the new backend-owned clinical-interpretation field the brief explicitly asked be kept separate from raw direction — this is what would let a future Insights "Trends" tab (Stage 2D-2 rebuild, post Stage 2A.5's removal) be genuinely backend-sourced instead of reconstructed client-side.

This field requires a per-marker "which direction is favorable" table — a real clinical-content design task, out of scope for Stage 2's minimum fix set, tracked as the concrete reason Stage 2D-2 is deferred rather than bundled.
