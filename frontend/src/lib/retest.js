const PENDING_STATES = new Set(['pending', 'planned', 'open'])
const FULFILLED_STATES = new Set(['fulfilled', 'completed', 'complete'])

export function createRetestCopy(notDue, dueNow, overdue, pending, completed, window, source, completedBy, viewLaterResult) {
  return {
    retestNotDue: notDue,
    retestDueNow: dueNow,
    retestOverdue: overdue,
    retestPending: pending,
    retestCompleted: completed,
    retestWindow: window,
    retestSource: source,
    retestCompletedBy: completedBy,
    viewLaterResult,
  }
}

function normalizeMarker(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const MARKER_ALIASES = {
  canonical_hemoglobin: 'hemoglobin',
  hgb: 'hemoglobin',
  'mean cell hemoglobin': 'mch',
  'mean cell hemoglobin (mch)': 'mch',
  canonical_mch: 'mch',
}

export function normalizeRetestMarker(value) {
  const normalized = normalizeMarker(value)
  return MARKER_ALIASES[normalized] || normalized.replace(/^canonical_/, '')
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function retestMarker(event) {
  return String(
    event?.metadata?.retest_target
      || event?.related_recommendation_id
      || event?.metadata?.marker
      || '',
  ).trim()
}

export function retestState(event, today = new Date()) {
  const fulfillmentStatus = String(event?.fulfillment_status || '').trim().toLowerCase()
  if (FULFILLED_STATES.has(fulfillmentStatus)) return 'fulfilled'
  if (!PENDING_STATES.has(fulfillmentStatus)) return 'pending_no_window'

  const currentDate = new Date(today)
  currentDate.setUTCHours(0, 0, 0, 0)
  const start = parseDate(event?.retest_window_start)
  const end = parseDate(event?.retest_window_end)
  if (!start || !end || end < start) return 'pending_no_window'
  if (currentDate < start) return 'pending_not_open'
  if (currentDate > end) return 'overdue'
  return 'due_now'
}

export function selectRetestObligations(interventions, reportVersionId) {
  const selected = new Map()
  for (const event of Array.isArray(interventions) ? interventions : []) {
    if (event?.action_type !== 'retest') continue
    if (reportVersionId && event?.source_report_version_id !== reportVersionId) continue
    const marker = retestMarker(event)
    const key = normalizeRetestMarker(marker)
    if (!key) continue
    selected.set(key, {
      id: event.id,
      marker,
      source_report_version_id: event.source_report_version_id,
      retest_window_start: event.retest_window_start,
      retest_window_end: event.retest_window_end,
      fulfillment_status: event.fulfillment_status,
      fulfilled_by_upload_id: event.fulfilled_by_upload_id,
      fulfilled_by_report_version_id: event.fulfilled_by_report_version_id,
      fulfilled_at: event.fulfilled_at,
      timing: event.metadata?.timing,
      priority: event.metadata?.priority,
    })
  }
  return [...selected.values()]
}

export function reliableClinicalDate(result) {
  const candidates = [
    result?.test_date,
    result?.measurement_date,
    result?.collected_at,
    result?.reported_at,
    result?.metadata?.test_date,
    result?.metadata?.measurement_date,
    result?.metadata?.collected_at,
    result?.metadata?.reported_at,
    result?.upload?.test_date,
    result?.upload?.collected_at,
    result?.report_version?.test_date,
    result?.report_version?.collected_at,
  ]
  for (const candidate of candidates) {
    if (parseDate(candidate)) return String(candidate).slice(0, 10)
  }
  return null
}

export function formatRetestDate(value, locale = 'en-US') {
  const date = parseDate(value)
  if (!date) return null
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
