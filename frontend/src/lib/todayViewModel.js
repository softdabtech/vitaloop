import { biomarkerDisplayName } from './biomarker-display.js'

// P37d — Today dashboard presentation adapter.
//
// A pure function: given already-loaded data (dashboard summary's
// `today_contract`, profile goals, questionnaire safety, subscription
// state), it returns a small view model the page renders directly. It
// never fetches anything, never mutates anything, never invents a date,
// comparison, or medical urgency value that isn't already present in its
// inputs. See:
//   output/p37a-dashboard-data-state-contract-review-2026-09-20.md
//   output/p37c-dashboard-today-read-only-exposure-2026-09-20.md
//
// Deliberately NOT derived from stats.total_uploads, stats.active_program,
// blocks.latest_upload, or blocks.latest_lab_result -- see P37a for why
// those are unreliable proxies. The only source of "is there a ready
// report" is `todayContract.latest_ready_report` /
// `todayContract.latest_ready_report_status`, exactly as P37c exposes it.
//
// No unit-test runner (vitest/jest) exists in this frontend today -- only
// Playwright e2e and lint/build (confirmed in P37a §Q10). This function is
// kept pure and dependency-free specifically so it CAN be unit tested the
// moment such a runner is added, without any rewrite. Until then it is
// verified via manual/browser-fixture checks per state (documented in the
// P37d delivery report), not by an automated unit suite.

// P37h: evidence_gaps.gaps[].missing_marker / .domain are raw backend keys
// (e.g. "transferrin_saturation"), never meant for direct display -- reuses
// the same biomarkerDisplayName() lookup Results.jsx/ProtocolPage.jsx
// already use for known markers, and for anything not in that table, only
// humanizes the raw string's punctuation/casing (underscores -> spaces,
// capitalized) -- it never invents or reclassifies medical meaning.
function humanizeLabel(raw, isUk) {
  if (!raw) return ''
  const displayed = biomarkerDisplayName(raw, isUk) || String(raw).replaceAll('_', ' ')
  return displayed.charAt(0).toUpperCase() + displayed.slice(1)
}

function formatDate(isoDate, isUk) {
  if (!isoDate) return null
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString(isUk ? 'uk-UA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// P37j — presentation-only report age classification. Purely a display
// decision: it never changes what data is fetched, never recomputes the
// frozen report's clinical content, and never invents a due/overdue date.
// It answers one question: "is this the same source date already shown in
// sourceLine old enough that calling it 'current' would be misleading?"
//
// Thresholds are day-counts, not calendar months, specifically to stay
// deterministic and boundary-free (a calendar-month diff has to define what
// "12 months" means for e.g. Jan 31 -> Feb 28/29, which day-counting never
// needs to answer). 365/730 days are the closest fixed-day equivalents of
// the spec's suggested "12 months" / "24 months" thresholds:
//   fresh/recent : < 365 days
//   old          : >= 365 and < 730 days
//   very_old     : >= 730 days
// `now` is an explicit parameter (defaulting to `new Date()`) specifically
// so this stays reproducible in adapter verification -- see P37a's own
// design-spec instruction (§19.3) to pass current time explicitly for
// presentation-logic tests rather than reading the clock inside the pure
// function's own call sites.
function classifyReportAge(isoDateCandidates, now) {
  const iso = isoDateCandidates.find(Boolean)
  if (!iso) return 'unknown'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return 'unknown'
  const diffDays = (now.getTime() - parsed.getTime()) / 86400000
  if (diffDays < 0) return 'fresh' // a future-dated source is not "old" -- never invent staleness from clock skew
  if (diffDays >= 730) return 'very_old'
  if (diffDays >= 365) return 'old'
  return 'fresh'
}

// P37e — returning-user sections (comparison, evidence gaps, retest
// checkpoint, report-scoped safety), built ONLY from an already-fetched
// GET /results/{uploadId} response (see P37a: confirmed side-effect-free
// once the upload_id is known; report_history.py's frozen-snapshot
// machinery is what actually serves it, never recomputed here).
//
// Field sources (verified against Results.jsx's own rendering — not
// guessed): progress_intelligence.{available,changes[]}, personal_baseline.
// {available,markers[]}, evidence_gaps.gaps[], knowledge_report.retest_plan[],
// doctor_escalation_precision.escalations[]. None of these are re-derived
// or reclassified here -- only formatted and capped in length.
const PROGRESS_STATUS_LABEL_KEY = {
  strengthened: 'progressStrengthened',
  weakened: 'progressWeakened',
  new_signal: 'progressNew',
  resolved_or_improved: 'progressResolved',
  stable: 'progressStable',
}

// P37k — Today cockpit. Same STATUS_ALIAS_MAP + range-inference logic
// Results.jsx already uses to normalize a biomarker's status band (verified
// against Results.jsx's own normalizeBiomarkerStatus()/inferStatusFromRange()
// -- not reinvented). unit/name are read for display only, never classified.
const STATUS_ALIAS_MAP = {
  OPTIMAL: 'OPTIMAL',
  NORMAL: 'OPTIMAL',
  N: 'OPTIMAL',
  BORDERLINE: 'BORDERLINE',
  'LOW NORMAL': 'BORDERLINE',
  'HIGH NORMAL': 'BORDERLINE',
  LOW: 'DEFICIENT',
  L: 'DEFICIENT',
  DEFICIENT: 'DEFICIENT',
  HIGH: 'ELEVATED',
  H: 'ELEVATED',
  ELEVATED: 'ELEVATED',
  CRITICAL: 'ELEVATED',
}
const STATUS_RANK = { DEFICIENT: 0, ELEVATED: 1, BORDERLINE: 2, OPTIMAL: 3 }

function inferStatusFromRange(biomarker) {
  const low = Number(biomarker?.ref_low)
  const high = Number(biomarker?.ref_high)
  const value = Number(biomarker?.value)
  if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(value) || high <= low) return 'BORDERLINE'
  if (value < low) return 'DEFICIENT'
  if (value > high) return 'ELEVATED'
  const span = high - low
  if (value <= low + span * 0.15 || value >= high - span * 0.15) return 'BORDERLINE'
  return 'OPTIMAL'
}

function normalizeBiomarkerStatus(biomarker) {
  const raw = String(biomarker?.status || '').trim().toUpperCase()
  return STATUS_ALIAS_MAP[raw] || inferStatusFromRange(biomarker)
}

// P37k — Today cockpit view model. Built ONLY from fields already fetched
// for the returning-user sections above (reportDetails.biomarkers,
// .protocol, .knowledge_report.{action_plan,retest_plan}, .evidence_gaps)
// plus the already-fetched summary.blocks.latest_questionnaire.completed_at
// (passed in, never fetched here) -- no new endpoint, no recomputation of
// clinical content, no invented scores/trends/dates. See the P37k delivery
// report for the full field-by-field source mapping.
// P37k.1 — derives the one correct action label for a given destination.
// Fixes the release-blocking bug where every cockpit row said "View
// results" regardless of where it actually navigated (including rows that
// pointed at /protocol/:id or /questionnaire). This is the single source
// of truth for row labels now -- no row is allowed to set its own label
// independently of its actionTo.
function actionLabelForTarget(to, { copy, planTo, resultsTo, uploadTo }) {
  if (to === planTo) return copy.cta.plan
  if (to === resultsTo) return copy.cta.results
  if (to === uploadTo) return copy.cta.upload
  if (to === '/questionnaire') return copy.cockpit.thisWeek.reviewSymptomAnswers
  return copy.cta.results
}

function buildCockpitViewModel({
  contentStatus = 'ready', // P37k.3 -- 'loading' | 'error' | 'ready'. The
  // cockpit shell (header/statusStrip shape/safety/very_old forced CTA) is
  // built the moment a ready report is known to exist, independent of
  // whether GET /results/{uploadId} has resolved yet -- see the call site
  // in buildTodayViewModel for why. Only the fields that actually require
  // reportDetails are gated on contentStatus === 'ready'; everything else
  // (headerContext, questionnaire safety, isVeryOldReport) is already
  // available from the contract alone and renders immediately.
  reportDetails,
  copy,
  isUk,
  resultsTo,
  planTo,
  uploadTo,
  planAccessAllowed,
  planExists,
  reportAge,
  sourceDate,
  symptomCheckDate,
  safety, // questionnaire safety (viewModel.safety), already built by the caller
  reportSafety, // report-scoped safety, already built by buildReturningUserSections
  changes, // P37k.1: same already-built comparison object buildReturningUserSections
  // produces (progress_intelligence/personal_baseline, capped at 3, or null) --
  // not recomputed here, only surfaced in the cockpit's own compact section.
}) {
  const c = copy.cockpit
  const label = (to) => actionLabelForTarget(to, { copy, planTo, resultsTo, uploadTo })
  const isOldReport = reportAge === 'old' || reportAge === 'very_old'
  const isVeryOldReport = reportAge === 'very_old'
  const hasData = contentStatus === 'ready'
  // Every reportDetails-derived computation below already tolerates a null/
  // undefined reportDetails (Array.isArray(reportDetails?.x) guards, etc.),
  // so gating it here -- rather than threading a hasData check through every
  // call site -- keeps the rest of this function byte-for-byte the same as
  // before P37k.3 while guaranteeing no partial/stale reportDetails is ever
  // read while it's still loading or errored.
  reportDetails = hasData ? reportDetails : null

  // --- headerContext: two independent dates, never conflated -- lab date
  // is the same measurement_date/report_generated_at sourceLine already
  // uses; symptom-check date is summary.blocks.latest_questionnaire.
  // completed_at, a completely different event on a different timeline. ---
  const headerContext = {
    labDate: sourceDate || null,
    symptomCheckDate: symptomCheckDate || null,
    reportAge,
  }

  // --- statusStrip ---
  const biomarkers = Array.isArray(reportDetails?.biomarkers) ? reportDetails.biomarkers : []
  const normalizedBiomarkers = biomarkers
    .filter((b) => b && (b.name || b.canonical_name || b.name_en))
    .map((b) => ({ raw: b, status: normalizeBiomarkerStatus(b) }))
  const priorityCount = normalizedBiomarkers.filter((b) => b.status !== 'OPTIMAL').length

  const retestPlan = Array.isArray(reportDetails?.knowledge_report?.retest_plan)
    ? reportDetails.knowledge_report.retest_plan
    : []
  // "retest_plan[0] with marker+timing only" -- only the first item, and
  // only if it actually carries both fields; never fall through to a later
  // item and never synthesize a window for an incomplete first entry.
  const firstRetest = retestPlan[0]
  const nextRetest = (firstRetest?.marker && firstRetest?.timing)
    ? { marker: humanizeLabel(firstRetest.marker, isUk), timing: firstRetest.timing }
    : null

  const basisLabel = normalizedBiomarkers.length === 0
    ? c.statusStrip.basisIncomplete
    : (reportAge === 'old' || reportAge === 'very_old')
      ? c.statusStrip.basisOld
      : c.statusStrip.basisFresh

  const statusStrip = {
    basisLabel,
    priorityCount,
    priorityLabel: priorityCount > 0 ? c.statusStrip.priorityCount(priorityCount) : c.statusStrip.priorityNone,
    nextRetest,
    nextRetestLabel: nextRetest ? c.statusStrip.nextRetestLabel(nextRetest.marker, nextRetest.timing) : c.statusStrip.nextRetestNone,
  }

  // --- safety (same two objects the caller already built; only adding an
  // explicit action target here, never changing tone/text/source) ---
  const cockpitSafety = {
    questionnaire: safety ? { ...safety, actionTo: '/questionnaire' } : null,
    report: reportSafety ? { ...reportSafety, actionTo: resultsTo } : null,
  }

  // --- thisWeek: up to 4 rows, strict priority order, only real data,
  // exactly one primary CTA (the first row inserted) ---
  const thisWeekRows = []
  const pushRow = (row) => { if (thisWeekRows.length < 4) thisWeekRows.push(row) }

  // a. clinician-review flag (report safety takes precedence over
  // questionnaire safety, matching the existing priority order used for
  // the safety banners themselves elsewhere in this file). actionTo/
  // actionLabel are derived together via label() -- P37k.1 fix: this row
  // used to always say "View results" even when it pointed at
  // /questionnaire.
  const topSafety = reportSafety || safety
  if (topSafety) {
    const to = reportSafety ? resultsTo : '/questionnaire'
    pushRow({ kind: 'safety', title: c.thisWeek.clinicianReviewTitle, why: topSafety.text, actionLabel: label(to), actionTo: to })
  }

  // b. first 1-2 protocol/action_plan items (plain-text entries -- see
  // Results.jsx's own consumption of the same fields, treated as strings)
  const planItemsSource = Array.isArray(reportDetails?.protocol) && reportDetails.protocol.length
    ? reportDetails.protocol
    : Array.isArray(reportDetails?.knowledge_report?.action_plan)
      ? reportDetails.knowledge_report.action_plan
      : []
  const planTarget = (planAccessAllowed && planExists) ? planTo : resultsTo
  for (const item of planItemsSource.slice(0, 2)) {
    const text = typeof item === 'string' ? item : (item?.title || item?.text || item?.description || null)
    if (!text) continue
    // P37k.1 fix: label must say "Open my plan" when this row actually
    // targets /protocol/:id, not always "View results".
    pushRow({ kind: 'plan', title: text, why: c.thisWeek.planItemWhy, actionLabel: label(planTarget), actionTo: planTarget })
  }

  // c. first retest_plan item with timing (same source as statusStrip's
  // cell 3, surfaced here as its own actionable row)
  if (nextRetest) {
    pushRow({
      kind: 'retest',
      title: c.thisWeek.retestItemTitle(nextRetest.marker),
      why: c.thisWeek.retestItemWhy(nextRetest.timing),
      actionLabel: label(resultsTo),
      actionTo: resultsTo,
    })
  }

  // d. first evidence gap / missing marker
  const gaps = Array.isArray(reportDetails?.evidence_gaps?.gaps) ? reportDetails.evidence_gaps.gaps : []
  const firstGap = gaps[0]
  if (firstGap) {
    const gapTitle = firstGap.missing_marker || firstGap.domain
    if (gapTitle) {
      pushRow({ kind: 'gap', title: humanizeLabel(gapTitle, isUk), why: c.thisWeek.gapItemWhy, actionLabel: label(resultsTo), actionTo: resultsTo })
    }
  }

  // P37k.1 — restores P37j's very_old primary-action semantics inside the
  // cockpit: an old saved report/plan must never be the page's one primary
  // CTA once it's old enough that "here's your next step" reads as current
  // guidance it isn't. For very_old, Upload new results is unconditionally
  // forced to the front and marked primary; every other row (safety
  // included -- safety already has its own separate banner above, this is
  // only about which THIS WEEK row gets the button) is demoted to a
  // secondary link. This never removes a row, only reorders/relabels.
  if (isVeryOldReport) {
    thisWeekRows.unshift({ kind: 'upload', title: c.thisWeek.uploadRowTitle, why: c.thisWeek.uploadRowWhy, actionLabel: label(uploadTo), actionTo: uploadTo })
    if (thisWeekRows.length > 4) thisWeekRows.length = 4
  }

  // Exactly one primary CTA on the whole page -- the first row present, in
  // the priority order above (or the forced Upload row for very_old).
  // Every other row (here and elsewhere) is a plain secondary link.
  const thisWeek = thisWeekRows.map((row, index) => ({ ...row, isPrimary: index === 0 }))

  // --- labSnapshot: 4-6 priority biomarkers, worst-status-first, no
  // sparkline (no delta field exists on this payload's biomarker objects --
  // see the P37k report's data-shape verification) ---
  const labSnapshot = normalizedBiomarkers
    .slice()
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    .slice(0, 6)
    .map(({ raw, status }) => {
      const name = isUk
        ? raw.canonical_name || raw.name || raw.source_name || raw.name_en
        : raw.name_en || raw.canonical_name || raw.name || raw.source_name
      // P37k.2 -- explicit status text alongside the color accent, never a
      // new clinical interpretation: it only labels the status this row
      // already carries. "Unknown range" only fires when neither an
      // explicit backend status nor a usable ref range exists (the same
      // case inferStatusFromRange otherwise silently defaults to
      // BORDERLINE for) -- everything else maps straight from `status`.
      const hasExplicitStatus = Boolean(STATUS_ALIAS_MAP[String(raw.status || '').trim().toUpperCase()])
      const hasRange = raw.ref_low != null && raw.ref_high != null
      const statusLabel = (!hasExplicitStatus && !hasRange)
        ? c.labSnapshot.unknownRange
        : c.labSnapshot.statusLabels[status]
      return {
        name: humanizeLabel(name, isUk) || name,
        value: raw.value ?? null,
        unit: raw.unit || '',
        status,
        statusLabel,
        rangeLabel: (raw.ref_low != null && raw.ref_high != null)
          ? `${raw.ref_low}–${raw.ref_high}${raw.unit ? ` ${raw.unit}` : ''}`
          : c.labSnapshot.rangeUnavailable,
      }
    })

  // --- followUp: same nextRetest data, "window listed" framing, age-aware
  // like the existing return-checkpoint copy, never a computed date ---
  let followUp = null
  if (nextRetest) {
    followUp = {
      text: isOldReport
        ? c.followUp.windowListedSaved(nextRetest.marker, nextRetest.timing)
        : c.followUp.windowListed(nextRetest.marker, nextRetest.timing),
      to: resultsTo,
    }
  } else if (retestPlan.length) {
    followUp = { text: c.followUp.none, to: resultsTo }
  }

  // --- missingContext (renamed "clarity"): up to 2 items, now including
  // suggested_next_step verbatim when the backend provides one ---
  const missingContextItems = gaps.slice(0, 2).map((gap) => {
    const rawTitle = gap?.missing_marker || gap?.domain
    return {
      title: rawTitle ? humanizeLabel(rawTitle, isUk) : c.missingContext.genericTitle,
      reason: gap?.reason ? humanizeLabel(gap.reason, isUk) : null,
      suggestedNextStep: gap?.suggested_next_step || null,
      to: resultsTo,
    }
  }).filter((item) => item.title)
  const missingContext = missingContextItems.length ? missingContextItems : null

  // P37k.1 — restores "Since your previous report" inside the cockpit.
  // `changes` is the exact same object buildReturningUserSections already
  // produces from progress_intelligence/personal_baseline (capped at 3,
  // never invented -- unchanged from before P37k). This only surfaces it
  // in the cockpit's own compact section; when progress_intelligence is
  // unavailable and no personal-baseline signal exists, `changes` is
  // already null and nothing renders here either.
  const sinceLastReport = changes ? { items: changes.items, to: changes.to } : null

  // P37k.1 — sparse ready-report fix: when there is truly nothing to show
  // in either This week or the lab snapshot, showing both sections' empty-
  // state placeholder copy reads as "a page of blank boxes". Instead,
  // collapse to one honest primary action: for a very_old sparse report,
  // Upload (the report itself is old AND has nothing else to show); for
  // any other sparse report, View results (open the one thing that does
  // exist -- the report itself). This never invents biomarker values, plan
  // rows, retest timing, or safety; it only changes which single action is
  // offered when there is genuinely no other content.
  // P37k.3 -- sparse collapse only ever applies once reportDetails has
  // actually resolved (hasData): while loading, thisWeek/labSnapshot are
  // "empty" simply because they haven't loaded yet, not because there is
  // genuinely nothing to show -- that must render a loading placeholder,
  // never the sparse "one honest primary action" UI meant for real absence
  // of data.
  const isSparse = hasData && thisWeek.length === 0 && labSnapshot.length === 0
  const sparsePrimaryAction = isSparse
    ? { label: isVeryOldReport ? copy.cta.upload : copy.cta.results, to: isVeryOldReport ? uploadTo : resultsTo }
    : null

  return { contentStatus, headerContext, statusStrip, safety: cockpitSafety, thisWeek, labSnapshot, followUp, missingContext, sinceLastReport, isSparse, sparsePrimaryAction }
}

function buildReturningUserSections({
  reportDetailsLoading,
  reportDetailsError,
  reportDetails,
  copy,
  isUk,
  resultsTo,
  returnLinkTo,
  returnLinkLabel,
  reportAge,
}) {
  if (reportDetailsLoading) {
    return { status: 'loading' }
  }
  if (reportDetailsError) {
    return { status: 'error', limitationText: copy.error.resultsSectionsUnavailable }
  }
  if (!reportDetails) {
    // Not fetched (e.g. no ready report yet) -- nothing to show, not an error.
    return { status: 'idle' }
  }

  // --- report-scoped safety (separate from, never merged with, questionnaire safety) ---
  const escalations = Array.isArray(reportDetails.doctor_escalation_precision?.escalations)
    ? reportDetails.doctor_escalation_precision.escalations
    : Array.isArray(reportDetails.final_analysis?.doctor_escalation_precision?.escalations)
      ? reportDetails.final_analysis.doctor_escalation_precision.escalations
      : []
  const urgentEscalation = escalations.find((item) => item?.level === 'urgent')
  const doctorEscalation = escalations.find((item) => item?.level === 'doctor')
  const topEscalation = urgentEscalation || doctorEscalation
  const reportSafety = topEscalation
    ? {
      tone: topEscalation.level === 'urgent' ? 'critical' : 'warning',
      text: topEscalation.human_readable_reason || copy.reportSafety.heading(topEscalation.level),
      timing: topEscalation.recommended_timing || null,
      sourceLabel: copy.reportSafety.sourceLabel,
      to: resultsTo,
    }
    : null

  // --- since your previous report (up to 3 observations, never invented) ---
  const progressIntelligence = reportDetails.progress_intelligence || reportDetails.final_analysis?.progress_intelligence || null
  const personalBaseline = reportDetails.personal_baseline || reportDetails.final_analysis?.personal_baseline || null
  const changeItems = []
  if (progressIntelligence?.available && Array.isArray(progressIntelligence.changes)) {
    for (const change of progressIntelligence.changes) {
      if (changeItems.length >= 3) break
      const labelKey = PROGRESS_STATUS_LABEL_KEY[change?.status]
      if (!labelKey) continue // unknown status -- never guess a label for it
      const name = change?.pattern_name || change?.pattern_id
      if (!name) continue
      changeItems.push(`${name} — ${copy.changes.statusLabels[labelKey]}`)
    }
  }
  if (changeItems.length < 3 && personalBaseline?.available && Array.isArray(personalBaseline.markers)) {
    for (const marker of personalBaseline.markers) {
      if (changeItems.length >= 3) break
      if (!marker?.silent_signal) continue
      const name = marker?.canonical_name || marker?.name
      if (!name) continue
      changeItems.push(copy.changes.silentSignal(humanizeLabel(name, isUk)))
    }
  }
  const changes = changeItems.length
    ? { items: changeItems, to: resultsTo }
    : null

  // --- what could make this clearer (up to 2 gaps, wording kept close to the field) ---
  const gaps = Array.isArray(reportDetails.evidence_gaps?.gaps) ? reportDetails.evidence_gaps.gaps : []
  const clarityItems = gaps.slice(0, 2).map((gap) => {
    const rawTitle = gap?.missing_marker || gap?.domain
    return {
      title: rawTitle ? humanizeLabel(rawTitle, isUk) : copy.clarity.genericTitle,
      body: gap?.reason ? humanizeLabel(gap.reason, isUk) : null,
      to: resultsTo,
    }
  }).filter((item) => item.title)
  const clarity = clarityItems.length ? { items: clarityItems } : null

  // --- when to come back (one checkpoint at most, only from real retest data) ---
  const retestPlan = Array.isArray(reportDetails.knowledge_report?.retest_plan)
    ? reportDetails.knowledge_report.retest_plan
    : []
  const retestWithTiming = retestPlan.find((item) => item?.marker && item?.timing)
  let returnCheckpoint = null
  if (retestWithTiming) {
    // P37j: an interval carried over from an old/very_old report reads as a
    // live checkpoint ("your plan notes: 6-12 weeks") unless the copy makes
    // clear it's a saved value from that older report, not a current
    // recommendation -- still the same interval string verbatim, never a
    // computed date.
    const isOldSource = reportAge === 'old' || reportAge === 'very_old'
    const checkpointText = isOldSource
      ? copy.returnSection.checkpointSaved(humanizeLabel(retestWithTiming.marker, isUk), retestWithTiming.timing)
      : copy.returnSection.checkpoint(humanizeLabel(retestWithTiming.marker, isUk), retestWithTiming.timing)
    returnCheckpoint = { text: checkpointText, to: returnLinkTo, ctaLabel: returnLinkLabel }
  } else if (retestPlan.length) {
    // Retest items exist but none carry a timing string -- do not compute one.
    returnCheckpoint = { text: copy.returnSection.noDate, to: returnLinkTo, ctaLabel: returnLinkLabel }
  }

  return { status: 'ready', reportSafety, changes, clarity, returnCheckpoint }
}

/**
 * @param {object} input
 * @param {boolean} input.summaryLoading - useDashboardSummary().isLoading
 * @param {unknown} input.summaryError - useDashboardSummary().error
 * @param {object|null|undefined} input.todayContract - summary?.today_contract (may be undefined on old cached payloads/tests)
 * @param {boolean} input.isLabsReadyIntent - profile.goals includes 'intent:labs'
 * @param {string} input.safetyText - existing questionnaire urgency text (or the existing "no red flags" fallback)
 * @param {'success'|'warning'|'critical'} input.safetyTone
 * @param {boolean} input.hasConcern - whether an active_concern is set (used only for the safety source label, not for report readiness)
 * @param {boolean} input.planAccessAllowed - proxy for require_active_subscription (see useSubscription().isPremium; NOT the advanced_protocol feature flag -- P37a confirmed those are different gates)
 * @param {object} input.copy - locale copy dictionary (TODAY_COPY.en or TODAY_COPY.uk)
 * @param {boolean} input.isUk
 */
export function buildTodayViewModel({
  summaryLoading,
  summaryError,
  todayContract,
  isLabsReadyIntent,
  safetyText,
  safetyTone,
  hasConcern,
  planAccessAllowed,
  copy,
  isUk,
  // P37e additions -- all optional; omitting them (e.g. from older tests)
  // simply yields returning.status === 'idle', no sections rendered.
  reportDetailsLoading = false,
  reportDetailsError = null,
  reportDetails = null,
  // P37j -- explicit "now" for deterministic, reproducible report-age
  // classification (see classifyReportAge's own comment). Defaulting to
  // `new Date()` keeps every pre-P37j call site working unchanged.
  now = new Date(),
  // P37k -- summary.blocks.latest_questionnaire.completed_at, passed in
  // (never fetched here) for the cockpit's headerContext. A different
  // event/date than the report's own measurement_date -- never conflated.
  symptomCheckCompletedAt = null,
}) {
  const safety = safetyTone === 'success'
    ? null // "no urgent red flags" is not a banner-worthy signal on its own -- see do-not-do §14 (do not carry forward "No urgent red flags reported." as a default banner)
    : {
      text: safetyText,
      tone: safetyTone,
      sourceLabel: hasConcern ? copy.safety.sourceQuestionnaire : null,
    }

  if (summaryLoading) {
    return { status: 'loading', hero: null, documents: null, safety: null }
  }

  if (summaryError) {
    return {
      status: 'summary_error',
      hero: {
        title: copy.error.summaryTitle,
        body: copy.error.summaryBody,
        primaryLabel: copy.error.retry,
        primaryAction: 'retry',
        secondaryLabel: null,
        secondaryTo: null,
      },
      documents: null,
      safety,
    }
  }

  const contract = todayContract || {}
  const latestReadyReport = contract.latest_ready_report || null
  const contractStatus = contract.latest_ready_report_status || (latestReadyReport ? 'ready' : 'none')

  // today_contract itself failed to resolve (distinct from "no report exists"
  // -- see P37c's own null-vs-false distinction). Never render "no reports".
  if (contractStatus === 'error') {
    return {
      status: 'contract_error',
      hero: {
        title: copy.error.reportStatusTitle,
        body: copy.error.reportStatusBody,
        primaryLabel: copy.cta.history,
        primaryTo: '/lab-results',
        secondaryLabel: copy.cta.upload,
        secondaryTo: '/upload',
      },
      documents: null,
      safety,
    }
  }

  if (!latestReadyReport) {
    if (isLabsReadyIntent) {
      return {
        status: 'labs_intent',
        hero: {
          title: copy.labsIntent.title,
          body: copy.labsIntent.body,
          primaryLabel: copy.labsIntent.primary,
          primaryTo: '/upload',
          secondaryLabel: copy.labsIntent.secondary,
          secondaryTo: '/questionnaire',
        },
        documents: null,
        safety,
      }
    }
    return {
      status: 'first_run',
      hero: {
        title: copy.firstRun.title,
        body: copy.firstRun.body,
        primaryLabel: copy.firstRun.primary,
        primaryTo: '/questionnaire',
        secondaryLabel: copy.firstRun.secondary,
        secondaryTo: '/upload',
      },
      documents: null,
      safety,
    }
  }

  // From here on, a ready report exists -- report_generated_at/
  // measurement_date/upload_created_at come verbatim from P37c; nothing
  // here computes or guesses a date.
  const uploadId = latestReadyReport.upload_id
  const sourceDate = formatDate(latestReadyReport.measurement_date, isUk)
    || formatDate(latestReadyReport.report_generated_at, isUk)

  // P37j: same two raw date fields sourceDate already prefers, classified
  // by elapsed time -- see classifyReportAge's own comment for thresholds
  // and rationale. `unknown` (no usable date) is treated as `fresh` for
  // copy purposes: there is nothing to honestly call "old" without a date,
  // and copy.source.unavailable already tells the truth about the date gap.
  const reportAgeRaw = classifyReportAge([latestReadyReport.measurement_date, latestReadyReport.report_generated_at], now)
  const reportAge = reportAgeRaw === 'unknown' ? 'fresh' : reportAgeRaw
  const isOldReport = reportAge === 'old' || reportAge === 'very_old'
  const isVeryOldReport = reportAge === 'very_old'

  const sourceLine = !sourceDate
    ? copy.source.unavailable
    : isVeryOldReport
      ? copy.source.savedReport(sourceDate)
      : isOldReport
        ? copy.source.olderReport(sourceDate)
        : copy.source.report(sourceDate)

  const planExists = contract.plan_exists_for_latest_ready_report === true
  const resultsTo = `/results/${uploadId}`
  const planTo = `/protocol/${uploadId}`
  const uploadTo = '/upload'

  const documentsBase = {
    reportLine: sourceDate ? copy.documents.reportLine(sourceDate) : copy.documents.reportLineUnavailable,
    resultsTo,
    historyTo: '/lab-results',
    uploadTo,
  }

  // P37k: symptom-check date is a wholly different event/timeline than the
  // report's own source date -- summary.blocks.latest_questionnaire.
  // completed_at, passed in verbatim, never conflated with measurement_date/
  // report_generated_at.
  const symptomCheckDate = formatDate(symptomCheckCompletedAt, isUk)

  // P37k.3 -- the cockpit shell is built as soon as a ready report is known
  // to exist (this function is only ever called from the three ready_*
  // branches below), never gated on GET /results/{uploadId} having
  // resolved. Fixes the two-screen flicker where the legacy hero layout
  // rendered first and was replaced by the cockpit once reportDetails
  // arrived -- one stable cockpit-shaped screen now renders from the start,
  // with `contentStatus` telling buildCockpitViewModel/CockpitBody which
  // sections have real data yet vs. which should show a loading/limited
  // placeholder. `returning.status` can be 'loading', 'error', 'ready', or
  // (defensively) 'idle' for a brief instant before the query starts --
  // 'idle' is treated as 'loading', never as an empty/ready state.
  function buildCockpitFor(returning, planLinkTo, planIsAccessible) {
    const contentStatus = returning.status === 'ready' ? 'ready' : returning.status === 'error' ? 'error' : 'loading'
    return buildCockpitViewModel({
      contentStatus,
      reportDetails, copy, isUk, resultsTo, planTo: planLinkTo, uploadTo, reportAge, sourceDate, symptomCheckDate,
      planAccessAllowed: planIsAccessible, planExists,
      safety, reportSafety: returning.reportSafety, changes: returning.changes,
    })
  }

  if (!planExists) {
    const returning = buildReturningUserSections({
      reportDetailsLoading, reportDetailsError, reportDetails, copy, isUk, resultsTo, returnLinkTo: resultsTo, returnLinkLabel: 'results', reportAge,
    })
    // P37j: an old/very_old report with no plan already only ever offers
    // "View results" as its action -- no "next steps are in your plan"
    // framing exists to soften here, so only the title/body and the
    // upload prominence change; the results link itself never moves.
    const oldHero = isOldReport
      ? {
        title: copy.oldReport.reportTitle,
        body: isVeryOldReport ? copy.oldReport.veryOldBody : copy.oldReport.body,
        primaryLabel: isVeryOldReport ? copy.cta.upload : copy.cta.results,
        primaryTo: isVeryOldReport ? uploadTo : resultsTo,
        secondaryLabel: isVeryOldReport ? copy.cta.results : copy.cta.upload,
        secondaryTo: isVeryOldReport ? resultsTo : uploadTo,
      }
      : null
    return {
      status: 'ready_no_plan',
      hero: oldHero || {
        title: copy.readyNoPlan.title,
        body: copy.readyNoPlan.body,
        primaryLabel: copy.cta.results,
        primaryTo: resultsTo,
        secondaryLabel: null,
        secondaryTo: null,
      },
      documents: { ...documentsBase, planTo: null, planLocked: false },
      safety,
      sourceLine,
      reportAge,
      returning,
      cockpit: buildCockpitFor(returning, null, false),
    }
  }

  if (!planAccessAllowed) {
    // Plan exists in the database, but require_active_subscription gates the
    // real GET /protocol/:uploadId for this user (see P37a/P37c -- this is
    // NOT the advanced_protocol export flag). Never render an active link
    // that would 402; never hide that a plan exists either.
    const returning = buildReturningUserSections({
      reportDetailsLoading, reportDetailsError, reportDetails, copy, isUk, resultsTo, returnLinkTo: resultsTo, returnLinkLabel: 'results', reportAge,
    })
    const oldHeroGated = isOldReport
      ? {
        title: copy.oldReport.reportTitle,
        body: isVeryOldReport ? copy.oldReport.veryOldBody : copy.oldReport.body,
        primaryLabel: isVeryOldReport ? copy.cta.upload : copy.cta.results,
        primaryTo: isVeryOldReport ? uploadTo : resultsTo,
        secondaryLabel: isVeryOldReport ? copy.cta.results : copy.cta.upload,
        secondaryTo: isVeryOldReport ? resultsTo : uploadTo,
      }
      : null
    return {
      status: 'ready_plan_gated',
      hero: oldHeroGated || {
        title: copy.readyNoPlan.title,
        body: copy.readyNoPlan.body,
        primaryLabel: copy.cta.results,
        primaryTo: resultsTo,
        secondaryLabel: null,
        secondaryTo: null,
      },
      documents: {
        ...documentsBase,
        planTo: null,
        planLocked: true,
        upgradeNote: copy.documents.upgradeNote,
      },
      safety,
      sourceLine,
      reportAge,
      returning,
      cockpit: buildCockpitFor(returning, null, false),
    }
  }

  const returning = buildReturningUserSections({
    reportDetailsLoading, reportDetailsError, reportDetails, copy, isUk, resultsTo, returnLinkTo: planTo, returnLinkLabel: 'plan', reportAge,
  })
  // P37j: an accessible plan is the one case where the ORIGINAL hero
  // actively implies current guidance ("Your next steps are in your
  // plan") -- old/very_old swaps in "Review your latest saved plan" and,
  // at very_old, promotes Upload to primary while demoting the plan link
  // to secondary (never removing it -- see requirement #5, plan/results
  // must stay reachable). "old" (12-24mo) keeps the plan as primary, only
  // relabels title/body and swaps the secondary link to Upload, since a
  // 12-24 month old plan is still plausibly the most useful single action,
  // just not implicitly "current".
  const oldHeroWithPlan = isOldReport
    ? {
      title: copy.oldReport.planTitle,
      body: isVeryOldReport ? copy.oldReport.veryOldBody : copy.oldReport.body,
      primaryLabel: isVeryOldReport ? copy.cta.upload : copy.cta.plan,
      primaryTo: isVeryOldReport ? uploadTo : planTo,
      secondaryLabel: isVeryOldReport ? copy.cta.plan : copy.cta.upload,
      secondaryTo: isVeryOldReport ? planTo : uploadTo,
    }
    : null
  return {
    status: 'ready_with_plan',
    hero: oldHeroWithPlan || {
      title: copy.readyWithPlan.title,
      body: copy.readyWithPlan.body,
      primaryLabel: copy.cta.plan,
      primaryTo: planTo,
      secondaryLabel: copy.cta.results,
      secondaryTo: resultsTo,
    },
    documents: { ...documentsBase, planTo, planLocked: false },
    safety,
    sourceLine,
    reportAge,
    returning,
    cockpit: buildCockpitFor(returning, planTo, true),
  }
}
