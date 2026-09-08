# VITALOOP Audit Fixes Plan
**Date:** September 8, 2026  
**Priority Order:** Critical → High → Medium → Low → Polish  
**Status:** PLANNING

---

## 🚨 P0: CRITICAL - Backend Service Incident (Blocker)

**Issue:** Backend service restarts continuously (NRestarts=10027), health-check reports `ready:true` despite crashes

**Root Cause Investigation Required:**
- [ ] Determine which process actually serves port 8004 / `/health/ready`
  - Docker container vs systemd service mismatch?
  - Port conflict between docker-proxy and uvicorn?
- [ ] Extract actual error logs from journal around 15:42-15:43 UTC (exit code 1)
- [ ] Verify health-check is monitoring the same PID that crashes

**Fix Steps:**
1. Check journalctl for actual error message (not just "exit-code 1")
2. Verify docker container logs: `docker logs vitaloop-backend`
3. Confirm health-check endpoint is querying active container (not stale process)
4. Fix: Either docker config or systemd service file (one source of truth)

**Ready When:**
- ✅ Service stable for 2+ hours without restart
- ✅ Health check synchronized with actual serving process
- ✅ Logging shows clear startup/shutdown cycle
- ✅ `/health/ready` returns accurate state

**Blocker For:** All other fixes below (can't test anything if backend is crashing)

---

## 📊 P1: HIGH - Lost Biomarkers (Platelets, ANC)

**Issue:** Confirmed baseline/follow-up markers disappear from Results page after confirmation

**Root Cause Hypothesis:**
- `clinical_data_integrity.py` rejects `10^9/L` format (only accepts `x10^9/L`)
- `_continue_confirmed_safe_subset()` silently drops unrecognized units
- User confirms markers → database accepts → Results page filters them out

**Fix Steps:**
1. [ ] Audit `clinical_data_integrity.py::normalize_units()` for unit aliases
   - Add: `'10^9/L': 'x10^9/L'` (and other common variations)
2. [ ] Trace confirmed marker through pipeline:
   - Upload CSV → parse → confirm → save to `biomarkers_confirmed` table → query Results → render
   - Add logging at each step
3. [ ] Add user-facing message: "Marker filtered due to unit format" (don't silently drop)
4. [ ] Test with actual zzz@z.com baseline/follow-up: expect 12/12 markers, not 10/12

**Code Files:**
- `backend/app/services/clinical_data_integrity.py` (normalize_units)
- `backend/app/api/routes/biomarkers.py` (results query)
- `backend/app/database/models/biomarker_models.py` (confirmed table)

**Ready When:**
- ✅ Upload baseline CSV with `10^9/L` → confirm → Results shows all 12 markers
- ✅ History tab shows "12/12 confirmed", not "10/12"
- ✅ Test with platelet + ANC specifically (not just generic)

**Dependency:** Requires P0 to pass (backend must be stable)

---

## 🔔 P2: HIGH - Unified Urgency State

**Issue:** Same case shows different urgency levels:
- Results: "prompt medical review" (red alert)
- Today: no warning shown
- Protocol: "6–12 weeks" (contradicts red alert)
- Retest interval: suggests delayed follow-up

**Root Cause:**
- No single source of truth for safety state
- Each page independently calculates/renders urgency
- Logic not synchronized across views

**Fix Steps:**
1. [ ] Define single `SafetyState` enum (or similar):
   - `IMMEDIATE` (prompt medical review needed)
   - `HIGH` (within 1–2 weeks)
   - `ROUTINE` (baseline/monitoring)
2. [ ] Implement state resolver in backend:
   - Input: biomarker values + thresholds
   - Output: SafetyState + recommended interval + message
3. [ ] Propagate to all views:
   - Results: render SafetyState color + icon
   - Today: show SafetyState if any IMMEDIATE biomarkers exist
   - Protocol: adjust language from "6–12 weeks" to match SafetyState interval
   - Retest: calculate from SafetyState, not independently
4. [ ] Add validation: if SafetyState=IMMEDIATE, protocol can't say "6–12 weeks"

**Code Files:**
- `backend/app/models/safety_state.py` (new file)
- `backend/app/api/routes/results.py`, `protocol.py`, `retest.py`
- `frontend/src/components/Results.jsx`, `Today.jsx`, `Protocol.jsx`

**Ready When:**
- ✅ Same marker set in Results / Today / Protocol all show same urgency level
- ✅ No contradictions (e.g., red alert + 6-week suggestion together)
- ✅ Retest interval matches SafetyState recommendation

**Dependency:** Requires P0 (backend stable) + P1 (markers not disappearing)

---

## 📝 P3: HIGH - Protocol Content Sanitization

**Issue:** Protocol page shows:
- Unrendered template placeholders: `{{ast_value}} {{ast_unit}}`
- Broken text (Hypokalaemia): `K < 3.Discuss whether this step ... clinician.5 or symptomatic.` (missing spaces/punctuation)

**Root Cause:**
- Template substitution fails silently
- No validation before serving to frontend
- `report_history.py` line 177 returns raw explainability instead of sanitized

**Fix Steps:**
1. [ ] Audit `backend/app/templates/protocol_templates.py`:
   - Find all `{{...}}` placeholders
   - Ensure all are substituted before rendering
   - Add validation: if placeholder remains → log error + use fallback text
2. [ ] Fix Hypokalaemia text generation:
   - Identify where `K < 3.Discuss` comes from (likely missing newline/period)
   - Add proper punctuation/spacing
   - Test: output should read naturally
3. [ ] Add pre-render check:
   - Scan protocol text for `{{` + `}}`
   - If found, don't show to user; log and fallback
4. [ ] Fix `report_history.py` line 177:
   - Change: return raw explainability
   - To: return sanitized/escaped version
   - Add regression test
5. [ ] Manual QA pass:
   - Go through every protocol scenario (K, Na, Ca, etc.)
   - Screenshot: zero broken/template text

**Code Files:**
- `backend/app/templates/protocol_templates.py` (main)
- `backend/app/services/report_history.py` (line 177)
- `backend/app/api/routes/protocol.py` (sanitization before serve)
- `frontend/src/components/Protocol.jsx` (render validation)

**Ready When:**
- ✅ Full manual protocol page review → zero `{{...}}` visible
- ✅ Hypokalaemia text reads: "K < 3.0. Discuss whether this step is appropriate..." (proper punctuation)
- ✅ Regression test added for line 177
- ✅ All electrolyte/mineral scenarios tested

**Dependency:** Requires P0 (backend stable)

---

## 🔧 P4: MEDIUM - Secondary Fixes

### 4.1 Billing & Messaging
- [ ] Remove "Upgrade when you are ready" CTA for active Premium users
- [ ] Clarify: is $9.99/mo invitation-only, or available to all?
  - Option A: Update landing page to reflect invite-only (remove price)
  - Option B: Enable $9.99/mo checkout for all
  - Current state: confusing mismatch
- [ ] A/B test messaging once decision made

### 4.2 Low-Confidence Markers
- [ ] Add user-facing explanation:
  - "This biomarker is predicted with low confidence (61%). Would you like to confirm the value?"
  - Show confidence % alongside marker
- [ ] Add docs link or tooltip

### 4.3 Ferritin Deduplication
- [ ] Audit: are low/very low ferritin recommendations repeating?
- [ ] If yes: deduplicate in `protocol_templates.py`
- [ ] Rule: only show unique recommendation IDs once per protocol

### 4.4 Protein/Albumin Language
- [ ] Review: are "intake/absorption" vs "proteinrestriction" terms consistent?
- [ ] Check for evidence citations
  - If referenced paper doesn't exist → remove citation
  - If no evidence → generalize to "may benefit from review"

**Dependency:** Only after P0–P3 complete (these are polish)

---

## ✅ P5: VALIDATION - Final Testing

**After P0–P3 fixes are merged:**

### 5.1 Regression: Both CSV Tests
- [ ] Upload same baseline/follow-up CSVs as in audit (zzz@z.com)
- [ ] Verify:
  - All 12 markers appear (not 10/12)
  - Platelets/ANC confirmed and present
  - Urgency levels consistent across Results/Today/Protocol
  - No template artifacts on protocol page

### 5.2 Fresh Longitudinal Test
- [ ] Create new test account (isolated from 17 old uploads)
- [ ] Upload: baseline CSV → wait 7 days (or simulate) → follow-up CSV
- [ ] Compare: ensure longitudinal change detection works
- [ ] Verify: new follow-up doesn't inherit confusion from old uploads

### 5.3 Platform Coverage
- [ ] Mobile: Results, Today, Protocol (responsive layout)
- [ ] Export: CSV download from Results (include all columns)
- [ ] New check-in: add new biomarker via mobile form
- [ ] Session: test 12-hour timeout

**Dependency:** Requires P0–P4 complete

---

## 📋 Tracking Format

### Option 1: Text Checklist (Current)
- Simple, no external dependencies
- Good for: small team, quick iteration

### Option 2: GitHub Issues
- Pro: Built-in to repo, PR links, automation
- Con: Requires GitHub Actions setup
- Good for: transparency, audit trail

### Option 3: Airtable/Linear
- Pro: Custom views, timeline, dependency tracking
- Con: External tool (not in repo)
- Good for: larger team, cross-project sync

**Recommendation:** Start with **GitHub Issues** labeled:
- `priority:p0` / `priority:p1` etc.
- `area:backend` / `area:frontend`
- `status:blocked` / `status:in-progress` / `status:ready-for-review`

Would you like me to:
1. Create GitHub issues for P0–P5?
2. Keep this Markdown file as SSOT and reference from code?
3. Both?

---

## Timeline Estimate

| Phase | Time | Status |
|-------|------|--------|
| P0 (backend debug) | 1–2 hrs | ⏳ IN PROGRESS |
| P1 (biomarker units) | 2–3 hrs | ⏸️ BLOCKED ON P0 |
| P2 (urgency state) | 3–4 hrs | ⏸️ BLOCKED ON P0+P1 |
| P3 (protocol sanitization) | 2–3 hrs | ⏸️ BLOCKED ON P0 |
| P4 (secondary) | 1–2 hrs | ⏸️ BLOCKED ON P0–P3 |
| P5 (testing) | 2–3 hrs | ⏸️ BLOCKED ON P0–P4 |
| **Total** | **11–17 hrs** | **TBD** |

---

**Last Updated:** 2026-09-08 15:45 UTC  
**Prepared By:** Security Audit Team  
**Next Step:** Unblock P0 (backend service stability)
