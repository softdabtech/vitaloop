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

function formatDate(isoDate, isUk) {
  if (!isoDate) return null
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString(isUk ? 'uk-UA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

function buildReturningUserSections({
  reportDetailsLoading,
  reportDetailsError,
  reportDetails,
  copy,
  isUk,
  resultsTo,
  returnLinkTo,
  returnLinkLabel,
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
      changeItems.push(copy.changes.silentSignal(name))
    }
  }
  const changes = changeItems.length
    ? { items: changeItems, to: resultsTo }
    : null

  // --- what could make this clearer (up to 2 gaps, wording kept close to the field) ---
  const gaps = Array.isArray(reportDetails.evidence_gaps?.gaps) ? reportDetails.evidence_gaps.gaps : []
  const clarityItems = gaps.slice(0, 2).map((gap) => ({
    title: gap?.missing_marker || gap?.domain || copy.clarity.genericTitle,
    body: gap?.reason ? String(gap.reason).replaceAll('_', ' ') : null,
    to: resultsTo,
  })).filter((item) => item.title)
  const clarity = clarityItems.length ? { items: clarityItems } : null

  // --- when to come back (one checkpoint at most, only from real retest data) ---
  const retestPlan = Array.isArray(reportDetails.knowledge_report?.retest_plan)
    ? reportDetails.knowledge_report.retest_plan
    : []
  const retestWithTiming = retestPlan.find((item) => item?.marker && item?.timing)
  let returnCheckpoint = null
  if (retestWithTiming) {
    returnCheckpoint = { text: copy.returnSection.checkpoint(retestWithTiming.marker, retestWithTiming.timing), to: returnLinkTo, ctaLabel: returnLinkLabel }
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
  const sourceLine = sourceDate ? copy.source.report(sourceDate) : copy.source.unavailable

  const planExists = contract.plan_exists_for_latest_ready_report === true
  const resultsTo = `/results/${uploadId}`
  const planTo = `/protocol/${uploadId}`

  const documentsBase = {
    reportLine: sourceDate ? copy.documents.reportLine(sourceDate) : copy.documents.reportLineUnavailable,
    resultsTo,
    historyTo: '/lab-results',
    uploadTo: '/upload',
  }

  if (!planExists) {
    const returning = buildReturningUserSections({
      reportDetailsLoading, reportDetailsError, reportDetails, copy, isUk, resultsTo, returnLinkTo: resultsTo, returnLinkLabel: 'results',
    })
    return {
      status: 'ready_no_plan',
      hero: {
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
      returning,
    }
  }

  if (!planAccessAllowed) {
    // Plan exists in the database, but require_active_subscription gates the
    // real GET /protocol/:uploadId for this user (see P37a/P37c -- this is
    // NOT the advanced_protocol export flag). Never render an active link
    // that would 402; never hide that a plan exists either.
    const returning = buildReturningUserSections({
      reportDetailsLoading, reportDetailsError, reportDetails, copy, isUk, resultsTo, returnLinkTo: resultsTo, returnLinkLabel: 'results',
    })
    return {
      status: 'ready_plan_gated',
      hero: {
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
      returning,
    }
  }

  const returning = buildReturningUserSections({
    reportDetailsLoading, reportDetailsError, reportDetails, copy, isUk, resultsTo, returnLinkTo: planTo, returnLinkLabel: 'plan',
  })
  return {
    status: 'ready_with_plan',
    hero: {
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
    returning,
  }
}
