import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Calendar, ChevronRight, Upload, Activity, Sparkles } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { useFeature } from '../hooks/useFeature.js'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import CabinetPageFrame from '../components/dashboard/CabinetPageFrame.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.jsx'
import { isUkrainianLocale } from '../lib/locale.js'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import '../styles/dashboard2026.css'

// Cabinet reconciliation: full EN/UA coverage ported from origin/main's
// LabResultsList.jsx (LAB_RESULTS_COPY). Applied on top of the CURRENT
// file's data logic, not origin/main's — origin/main's version regresses
// two Stage 2D invariants that must not be ported: (1) its getItemDate()
// falls back to the upload's created-at timestamp when no real lab date
// exists, violating Stage 2D-1's test_date -> collected_at -> reported_at
// chronology; (2) it has no /progress/overview call or ClinicalProgressPanel
// at all — its sidebar is static placeholder copy, not backend-computed
// longitudinal data, which is a regression from Stage 2D-2 here, not an
// upgrade. Kept the current, Stage-2D-compliant logic; only added the
// missing localization this page previously lacked (hardcoded English
// throughout body copy, badges, and the empty/premium states).
const LAB_RESULTS_COPY_KEYS = [
  'uploadResults', 'noResults', 'startSymptom', 'openLabPlan', 'uploads', 'mostRecent',
  'uploadHistory', 'retestPlan', 'reviewWindow', 'labResults', 'processing', 'processingBody',
  'failed', 'failedBody', 'queued', 'queuedBody', 'uploadAgain', 'noCompletedReport',
  'newerUploadProcessing', 'newerUploadFailed', 'optimal', 'warning', 'review', 'viewResults',
  'premiumTitle', 'premiumBody', 'premiumCta', 'safetyContext', 'safetyBody', 'nextStep', 'nextBody',
]

function createLabResultsCopy(values) {
  return Object.fromEntries(LAB_RESULTS_COPY_KEYS.map((key, index) => [key, values[index]]))
}

const LAB_RESULTS_COPY = {
  en: createLabResultsCopy([
    'Upload Results',
    'No results yet. Start symptom-first flow to build context, then upload labs linked to your concern.',
    'Start symptom check',
    'Open lab plan',
    'Uploads',
    'Most recent lab',
    'Upload history',
    'Retest plan',
    'Use your latest protocol to decide when to repeat',
    (index) => `Lab Results #${index}`,
    'Processing',
    "We're processing this upload. Your previous completed report remains available.",
    'Could not process',
    "We couldn't finish processing this upload. You can upload the file again.",
    'Upload received',
    'This upload is waiting to be processed.',
    'Upload again',
    'No completed report yet',
    'A newer upload is still being processed.',
    'A newer upload could not be processed.',
    'Optimal',
    'Warning',
    'Review',
    'View Results',
    'Premium features available',
    'Upgrade to see your complete lab history, track trends over time, and keep action plans connected to follow-up check-ins.',
    // Was hardcoded '$19.99/month' — stale, drifted from the actual price;
    // sourced from lib/pricing.js now like every other paywall prompt.
    `Upgrade for ${PREMIUM_PRICE_LABEL}`,
    'Safety context',
    'Review out-of-range markers with a qualified clinician when appropriate.',
    'Next step',
    'Open the action plan and use check-ins to track whether symptoms change.',
  ]),
  uk: createLabResultsCopy([
    'Завантажити аналізи',
    'Результатів ще немає. Почніть із симптомів, щоб створити контекст, а потім завантажте аналізи, повʼязані зі скаргою.',
    'Почати перевірку симптомів',
    'Відкрити план аналізів',
    'Завантаження',
    'Останній аналіз',
    'Історія завантажень',
    'План повторної перевірки',
    'Терміни повторної перевірки залежать від вашого плану дій',
    (index) => `Результати аналізів #${index}`,
    'В обробці',
    'Ми обробляємо це завантаження. Попередній завершений звіт залишається доступним.',
    'Не вдалося обробити',
    'Не вдалося завершити обробку. Ви можете завантажити файл ще раз.',
    'Завантаження отримано',
    'Це завантаження очікує на обробку.',
    'Завантажити ще раз',
    'Завершених звітів ще немає',
    'Нове завантаження ще обробляється.',
    'Нове завантаження не вдалося обробити.',
    'У нормі',
    'Спостерігати',
    'Перегляд',
    'Переглянути',
    'Доступні Premium-функції',
    'Оновіть тариф, щоб бачити повну історію аналізів, динаміку та повʼязувати плани дій із чек-інами.',
    'Оновити тариф',
    'Контекст безпеки',
    'Обговоріть показники поза референсом із кваліфікованим фахівцем, коли це доречно.',
    'Наступний крок',
    'Відкрийте план дій і використовуйте чек-іни, щоб відстежити зміни симптомів.',
  ]),
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value.includes('optimal') || value.includes('normal')) return 'optimal'
  if (value.includes('border') || value.includes('warn')) return 'warning'
  if (value.includes('critical') || value.includes('deficient') || value.includes('elevated')) return 'critical'
  return 'warning'
}

function normalizeProgressPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

// Stage 2D-1: clinical chronology priority is test_date -> collected_at ->
// reported_at, matching the backend's choose_measurement_date() helper
// (app/services/lab_date_extraction.py). created_at (upload time) is
// deliberately excluded — it is never a substitute for a real lab date.
function measurementDateValue(item) {
  return item?.test_date || item?.collected_at || item?.reported_at || null
}

function getItemDate(item, isUk) {
  return measurementDateValue(item) || (isUk ? 'Дата невідома' : 'Unknown date')
}

export function patientFacingLabName(value, fallback = 'Lab result') {
  const name = String(value || '').trim()
  if (!name || /^(b2c_file|synthetic|validation|qa|smoke)$/i.test(name) || /^[a-f0-9-]{24,}$/i.test(name)) {
    return fallback
  }
  return name
}

function getBiomarkerCounts(item) {
  const biomarkers = Array.isArray(item?.biomarkers) ? item.biomarkers : []
  return {
    optimal: biomarkers.filter((b) => normalizeStatus(b?.status) === 'optimal').length,
    warning: biomarkers.filter((b) => normalizeStatus(b?.status) === 'warning').length,
    critical: biomarkers.filter((b) => normalizeStatus(b?.status) === 'critical').length,
  }
}

export function lifecycleState(item) {
  const status = String(item?.status || '').trim().toLowerCase()
  if (!status || ['done', 'completed', 'ready'].includes(status)) return 'ready'
  if (['processing', 'analyzing'].includes(status)) return 'processing'
  if (['failed', 'error'].includes(status)) return 'failed'
  if (['uploaded', 'queued', 'pending'].includes(status)) return 'queued'
  return 'queued'
}

export function canViewResults(item) {
  return lifecycleState(item) === 'ready'
}

export function shouldShowBiomarkerCounts(item) {
  return canViewResults(item)
}

function lifecycleStateCopy(state, copy) {
  if (state === 'processing') return { label: copy.processing, body: copy.processingBody }
  if (state === 'failed') return { label: copy.failed, body: copy.failedBody }
  if (state === 'queued') return { label: copy.queued, body: copy.queuedBody }
  return null
}

function latestActivityCopy(state, copy) {
  if (state === 'processing') return copy.newerUploadProcessing
  if (state === 'failed') return copy.newerUploadFailed
  return copy.queued
}

function lifecycleActionLabel(state, item, copy) {
  if (canViewResults(item)) return copy.viewResults
  if (state === 'failed') return copy.uploadAgain
  return lifecycleStateCopy(state, copy)?.label
}

async function fetchRecentUploadFallback() {
  try {
    const fallbackRes = await api.get('/uploads/recent')
    return normalizeProgressPayload(fallbackRes.data).slice(0, 1)
  } catch {
    return []
  }
}

export function buildFetchResultsError(_err) {
  return {
    items: [],
    error: 'We could not load your lab results right now. Please try again.',
    originalError: _err,
  }
}

async function fetchResultsWithFallback() {
  try {
    const res = await api.get('/progress')
    return { items: normalizeProgressPayload(res.data), error: null }
  } catch (err) {
    if (err.response?.status === 402) {
      return { items: await fetchRecentUploadFallback(), error: null }
    }

    return buildFetchResultsError(err)
  }
}

function triggerLabHistoryAccessPaywall() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'LAB_HISTORY_ACCESS' } }))
  }
}

// Stage 2D-2: /progress/overview is the single backend-owned source of truth
// for clinical/biomarker longitudinal progress (chronology, comparable marker
// history, latest/previous clinical values, trend direction). This component
// only formats/renders that data — it must never independently determine any
// of those. See app/services/progress_overview.py::build_progress_overview().
async function fetchProgressOverview() {
  try {
    const res = await api.get('/progress/overview')
    return res.data || null
  } catch (err) {
    console.error('LabResultsList overview fetch error:', err)
    return null
  }
}

// Stage 2D-2: status_group is a backend-owned clinical classification
// ("needs_review" | "monitor" | "stable" | "unknown", see
// progress_overview.py::_status_group()) — reused here only for badge color,
// never recomputed from raw status text.
function statusGroupTone(group) {
  if (group === 'needs_review') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (group === 'monitor') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (group === 'stable') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

// Stage 2D-2: renders the backend's already-computed `/progress/overview`
// data. Formatting only — direction, dates, and values below are read
// directly from the overview payload, never derived in this component.
function ClinicalProgressPanel({ overview, loading, t, copy }) {
  const labels = t.labProgress

  if (loading) {
    return (
      <aside className="vtl-light-card h-fit p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{labels.title}</h3>
        <div className="mt-4 space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </aside>
    )
  }

  const mode = overview?.mode
  const topChanges = Array.isArray(overview?.top_changes) ? overview.top_changes : []
  const stableMarkers = Array.isArray(overview?.stable_markers) ? overview.stable_markers : []
  const newMarkers = Array.isArray(overview?.insufficient_history_markers) ? overview.insufficient_history_markers : []
  const comparableMarkers = Array.isArray(overview?.all_comparable_markers) ? overview.all_comparable_markers : []
  const historyMarkers = [...comparableMarkers, ...newMarkers].filter((marker, index, markers) => (
    (Array.isArray(marker?.history) && marker.history.length > 0 || marker?.comparison_reason) &&
    markers.findIndex((candidate) => candidate.canonical_name === marker.canonical_name) === index
  ))
  const timelineEligible = overview?.timeline_eligible === true

  let helperText = labels.helperEmpty
  if (mode === 'undated') helperText = labels.helperUndated
  else if (mode === 'snapshot') helperText = labels.helperSnapshot
  else if (timelineEligible) helperText = labels.helperTimeTrend

  return (
    <aside className="vtl-light-card h-fit p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{labels.title}</h3>
      <p className="mt-3 text-sm text-slate-500">{helperText}</p>

      {timelineEligible && topChanges.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{labels.changed}</p>
          {topChanges.map((change) => (
            <div key={change.canonical_name} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="lab-progress-name min-w-0 flex-1 text-sm font-semibold text-slate-800">{change.name}</p>
                <span className={`vtl-status-pill border ${statusGroupTone(change.current_status_group)}`}>
                  {labels.direction[change.direction] || change.direction}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {labels.previousLabel} {change.previous_value}{change.unit ? ` ${change.unit}` : ''} ({labels.onLabel} {change.previous_date})
                {' → '}
                {labels.latestLabel} {change.latest_value}{change.unit ? ` ${change.unit}` : ''} ({labels.onLabel} {change.latest_date})
              </p>
            </div>
          ))}
        </div>
      )}

      {timelineEligible && stableMarkers.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          {labels.stable}: {stableMarkers.length}
        </p>
      )}

      {historyMarkers.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">History</p>
          {historyMarkers.map((marker) => {
            const history = marker.history
            const hasUnsafeComparison = Boolean(marker.comparison_reason)
            return (
              <div key={marker.canonical_name} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="lab-progress-name min-w-0 flex-1 text-sm font-semibold text-slate-800">{marker.name}</p>
                  {history.length < 2 && (
                    <span className="vtl-status-pill border border-slate-200 bg-slate-50 text-slate-600">
                      {labels.insufficientHistory}
                    </span>
                  )}
                </div>
                {hasUnsafeComparison ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Trend unavailable due to incompatible units.
                  </p>
                ) : history.length > 0 ? (
                  <ol className="mt-2 space-y-1 text-xs text-slate-600">
                    {history.map((point) => (
                      <li key={`${marker.canonical_name}-${point.test_date}`}>
                        {point.test_date}: {point.value}{point.unit ? ` ${point.unit}` : ''}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {newMarkers.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{labels.newMarkers}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {newMarkers.slice(0, 8).map((marker) => (
              <span
                key={marker.canonical_name}
                className={`vtl-status-pill border ${statusGroupTone(marker.current_status_group)}`}
                title={labels.insufficientHistory}
              >
                {marker.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs uppercase tracking-wide text-rose-700 font-semibold">{copy.safetyContext}</p>
          <p className="mt-1 text-sm text-slate-700">{copy.safetyBody}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{copy.nextStep}</p>
          <p className="mt-1 text-sm text-slate-700">{copy.nextBody}</p>
        </div>
      </div>
    </aside>
  )
}

export default function LabResultsList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { hasAccess } = useFeature('progress')
  const isUk = isUkrainianLocale()
  const copy = isUk ? LAB_RESULTS_COPY.uk : LAB_RESULTS_COPY.en
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [overview, setOverview] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!user) return

    let active = true

    const fetchLabResults = async () => {
      try {
        const result = await fetchResultsWithFallback()
        if (!active) return
        setItems(result.items)
        setError(result.error)
        if (result.originalError) {
          console.error('LabResultsList fetch error:', result.originalError)
        }
      } finally {
        setLoading(false)
      }
      if (!active) return
    }

    const fetchOverview = async () => {
      const data = await fetchProgressOverview()
      if (!active) return
      setOverview(data)
      setOverviewLoading(false)
    }

    fetchLabResults()
    fetchOverview()
    return () => {
      active = false
    }
  }, [user, reloadToken])

  const sortedItems = useMemo(() => {
    // The backend already returns items in correct clinical order (real lab
    // date, undated results last — see get_user_progress()). This re-sort only
    // guards against a non-chronological API response; it must never rank an
    // undated item above a properly dated one by falling back to created_at.
    return [...items].sort((a, b) => {
      const da = measurementDateValue(a)
      const db = measurementDateValue(b)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return new Date(db).getTime() - new Date(da).getTime()
    })
  }, [items])
  const latestReadyItem = sortedItems.find((item) => canViewResults(item))
  const latestActivity = sortedItems[0]
  const latestActivityState = lifecycleState(latestActivity)

  const t = ct()

  if (loading) {
    return (
      <div className="vtl-page px-4 py-8 sm:px-6">
        <CabinetPageFrame>
          <div className="mb-6 h-8 w-56 animate-pulse rounded-xl bg-slate-200" />
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </CabinetPageFrame>
      </div>
    )
  }

  return (
    <div className="vtl-page px-4 py-8 sm:px-6">
      <CabinetPageFrame>
        <CabinetPageHeader
          title={ct().labResults.title}
          subtitle={ct().labResults.subtitle}
          helper={ct().labResults.helper}
          action={(
            <button
              onClick={() => navigate('/upload')}
              className="vtl-button-primary inline-flex items-center justify-center gap-2 px-5 text-sm"
            >
              <Upload className="h-4 w-4" />
              {copy.uploadResults}
            </button>
          )}
        />

        {error && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setError(null)
                setReloadToken((value) => value + 1)
              }}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 font-semibold text-rose-800"
            >
              Retry
            </button>
          </div>
        )}

        {sortedItems.length === 0 ? (
          <div className="space-y-4 py-8">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {copy.noResults}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate('/questionnaire')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">{copy.startSymptom}</button>
              <button onClick={() => navigate('/lab-plan')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">{copy.openLabPlan}</button>
            </div>
            <div className="py-6">
              <EmptyStateIllustration type="upload" size="lg" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
            <div className="space-y-3">
              <div className="lab-results-summary grid gap-3 md:grid-cols-3">
                <div className="lab-results-summary-card vtl-light-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.uploads}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{sortedItems.length}</p>
                </div>
                <div className="lab-results-summary-card vtl-light-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.mostRecent}</p>
                  <p className="lab-results-summary-source mt-1 text-sm font-semibold text-slate-900">{latestReadyItem ? patientFacingLabName(latestReadyItem.lab_name, copy.labResults(sortedItems.length)) : copy.noCompletedReport}</p>
                  {latestActivity && latestActivity !== latestReadyItem && latestActivityState !== 'ready' && (
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {latestActivityCopy(latestActivityState, copy)}
                    </p>
                  )}
                </div>
                <div className="lab-results-summary-card vtl-light-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.retestPlan}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{copy.reviewWindow}</p>
                </div>
              </div>

              {sortedItems.map((item, index) => {
                const date = getItemDate(item, isUk)
                const state = lifecycleState(item)
                const showCounts = shouldShowBiomarkerCounts(item)
                const { optimal, warning, critical } = showCounts ? getBiomarkerCounts(item) : { optimal: 0, warning: 0, critical: 0 }
                const uploadId = item?.upload_id || item?.id
                const stateCopy = lifecycleStateCopy(state, copy)

                return (
                  <div
                    key={uploadId || `${date}-${index}`}
                    className="lab-result-card vtl-light-card vtl-light-card-hover rounded-2xl px-4 py-3 transition"
                  >
                    <div className="lab-result-card__body flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
                      <button
                        onClick={() => canViewResults(item) && uploadId && navigate(`/results/${uploadId}`)}
                        disabled={!canViewResults(item) || !uploadId}
                        className="lab-result-card__identity flex-1 min-w-0 text-left disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <p className="lab-result-card__source text-sm font-semibold text-slate-800">{patientFacingLabName(item?.lab_name, copy.labResults(sortedItems.length - index))}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {date}
                        </p>
                      </button>

                      {showCounts ? (
                        <div className="lab-result-card__badges flex flex-wrap items-center gap-2 text-xs">
                          <span className="vtl-status-pill border border-emerald-200 bg-emerald-50 text-emerald-700">{copy.optimal} {optimal}</span>
                          <span className="vtl-status-pill border border-amber-200 bg-amber-50 text-amber-700">{copy.warning} {warning}</span>
                          <span className="vtl-status-pill border border-rose-200 bg-rose-50 text-rose-700">{copy.review} {critical}</span>
                        </div>
                      ) : (
                        <output className="lab-result-card__state min-w-0 flex-1 text-xs text-slate-600" aria-live="polite">
                          <span className="font-semibold">{stateCopy.label}</span>
                          <span className="mt-1 block leading-5">{stateCopy.body}</span>
                        </output>
                      )}

                      <div className="lab-result-card__action flex items-center gap-2">
                        <button
                          onClick={() => state === 'failed'
                            ? navigate('/upload')
                            : canViewResults(item) && uploadId && navigate(`/results/${uploadId}`)}
                          disabled={state !== 'failed' && (!canViewResults(item) || !uploadId)}
                          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40"
                        >
                          {lifecycleActionLabel(state, item, copy)}
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Premium features hint for free users */}
              {!hasAccess && (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 text-amber-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">{copy.premiumTitle}</p>
                      <p className="mt-1 text-sm text-amber-700">
                        {copy.premiumBody}
                      </p>
                      <button
                        onClick={triggerLabHistoryAccessPaywall}
                        className="mt-3 rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition"
                      >
                        {copy.premiumCta}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <ClinicalProgressPanel overview={overview} loading={overviewLoading} t={t} copy={copy} />
          </div>
        )}
      </CabinetPageFrame>
    </div>
  )
}
