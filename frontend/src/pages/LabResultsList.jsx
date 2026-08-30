import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Calendar, ChevronRight, Upload, Activity, Sparkles } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { useFeature } from '../hooks/useFeature.js'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import HintBanner from '../components/tour/HintBanner.jsx'
import { useTourHints } from '../hooks/useTourHints.js'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.jsx'
import { isUkrainianLocale } from '../lib/locale.js'
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
const LAB_RESULTS_COPY = {
  en: {
    uploadResults: 'Upload Results',
    noResults: 'No results yet. Start symptom-first flow to build context, then upload labs linked to your concern.',
    startSymptom: 'Start symptom check',
    openLabPlan: 'Open lab plan',
    uploads: 'Uploads',
    mostRecent: 'Most recent lab',
    uploadHistory: 'Upload history',
    retestPlan: 'Retest plan',
    reviewWindow: 'Review in 8-12 weeks',
    labResults: (index) => `Lab Results #${index}`,
    optimal: 'Optimal',
    warning: 'Warning',
    review: 'Review',
    viewResults: 'View Results',
    premiumTitle: 'Premium features available',
    premiumBody: 'Upgrade to see your complete lab history, track trends over time, and keep action plans connected to follow-up check-ins.',
    premiumCta: 'Upgrade for $19.99/month',
    safetyContext: 'Safety context',
    safetyBody: 'Review out-of-range markers with a qualified clinician when appropriate.',
    nextStep: 'Next step',
    nextBody: 'Open the action plan and use check-ins to track whether symptoms change.',
  },
  uk: {
    uploadResults: 'Завантажити аналізи',
    noResults: 'Результатів ще немає. Почніть із симптомів, щоб створити контекст, а потім завантажте аналізи, повʼязані зі скаргою.',
    startSymptom: 'Почати перевірку симптомів',
    openLabPlan: 'Відкрити план аналізів',
    uploads: 'Завантаження',
    mostRecent: 'Останній аналіз',
    uploadHistory: 'Історія завантажень',
    retestPlan: 'План повторної перевірки',
    reviewWindow: 'Перегляд через 8-12 тижнів',
    labResults: (index) => `Результати аналізів #${index}`,
    optimal: 'У нормі',
    warning: 'Спостерігати',
    review: 'Перегляд',
    viewResults: 'Переглянути',
    premiumTitle: 'Доступні Premium-функції',
    premiumBody: 'Оновіть тариф, щоб бачити повну історію аналізів, динаміку та повʼязувати плани дій із чек-інами.',
    premiumCta: 'Оновити тариф',
    safetyContext: 'Контекст безпеки',
    safetyBody: 'Обговоріть показники поза референсом із кваліфікованим фахівцем, коли це доречно.',
    nextStep: 'Наступний крок',
    nextBody: 'Відкрийте план дій і використовуйте чек-іни, щоб відстежити зміни симптомів.',
  },
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

function getItemDate(item) {
  return measurementDateValue(item) || 'Unknown date'
}

function getBiomarkerCounts(item) {
  const biomarkers = Array.isArray(item?.biomarkers) ? item.biomarkers : []
  return {
    optimal: biomarkers.filter((b) => normalizeStatus(b?.status) === 'optimal').length,
    warning: biomarkers.filter((b) => normalizeStatus(b?.status) === 'warning').length,
    critical: biomarkers.filter((b) => normalizeStatus(b?.status) === 'critical').length,
  }
}

async function fetchRecentUploadFallback() {
  try {
    const fallbackRes = await api.get('/uploads/recent')
    return normalizeProgressPayload(fallbackRes.data).slice(0, 1)
  } catch {
    return []
  }
}

function buildFetchResultsError(err) {
  const statusCode = err.response?.status || 'unknown'
  const message = err.response?.data?.message || err.message || 'Could not load lab results.'
  return {
    items: [],
    error: `Error loading results (${statusCode}): ${message}`,
    originalError: err,
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
                <p className="text-sm font-semibold text-slate-800">{change.name}</p>
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
  const { show: showHints, dismiss: dismissHints } = useTourHints('lab-results')
  const { hasAccess } = useFeature('progress')
  const isUk = isUkrainianLocale()
  const copy = isUk ? LAB_RESULTS_COPY.uk : LAB_RESULTS_COPY.en
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [overview, setOverview] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(true)

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
  }, [user])

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

  const t = ct()

  if (loading) {
    return (
      <div className="vtl-page px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 h-8 w-56 animate-pulse rounded-xl bg-slate-200" />
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="vtl-page px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
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

        {showHints && !loading && (
          <HintBanner
            hints={[
              '🗂 This is your lab history — every upload you make is stored here with a biomarker quality snapshot.',
              '📊 Each row shows how many markers are in range, worth watching, or ready for review. Click "Results" for the full breakdown.',
              '📋 Open the action plan to see priorities, clinician discussion points, and retest direction.',
            ]}
            onDone={dismissHints}
          />
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
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
              <div className="grid gap-3 md:grid-cols-3">
                <div className="vtl-light-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.uploads}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{sortedItems.length}</p>
                </div>
                <div className="vtl-light-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.mostRecent}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{sortedItems[0]?.lab_name || copy.uploadHistory}</p>
                </div>
                <div className="vtl-light-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.retestPlan}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{copy.reviewWindow}</p>
                </div>
              </div>

              {sortedItems.map((item, index) => {
                const date = getItemDate(item)
                const { optimal, warning, critical } = getBiomarkerCounts(item)
                const uploadId = item?.upload_id || item?.id

                return (
                  <div
                    key={uploadId || `${date}-${index}`}
                    className="vtl-light-card vtl-light-card-hover rounded-2xl px-4 py-3 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
                      <button
                        onClick={() => uploadId && navigate(`/results/${uploadId}`)}
                        disabled={!uploadId}
                        className="flex-1 min-w-0 text-left disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <p className="truncate text-sm font-semibold text-slate-800">{item?.lab_name || copy.labResults(sortedItems.length - index)}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {date}
                        </p>
                      </button>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="vtl-status-pill border border-emerald-200 bg-emerald-50 text-emerald-700">{copy.optimal} {optimal}</span>
                        <span className="vtl-status-pill border border-amber-200 bg-amber-50 text-amber-700">{copy.warning} {warning}</span>
                        <span className="vtl-status-pill border border-rose-200 bg-rose-50 text-rose-700">{copy.review} {critical}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => uploadId && navigate(`/results/${uploadId}`)}
                          disabled={!uploadId}
                          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40"
                        >
                          {copy.viewResults}
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
      </div>
    </div>
  )
}
