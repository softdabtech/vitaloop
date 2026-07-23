import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Calendar, ChevronRight, Upload, Activity, Sparkles } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { useFeature } from '../hooks/useFeature.js'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.jsx'
import { isUkrainianLocale } from '../lib/locale.js'
import '../styles/dashboard2026.css'

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
    premiumCta: 'Upgrade for $4.99/month',
    whatChanged: 'What changed',
    whatChangedBody: 'Contextual review of priority markers and next retest direction.',
    stableZone: 'Stable zone',
    stableBody: 'Keep the routines that support markers currently in range.',
    needsAttention: 'Needs attention',
    needsBody: 'Link these markers to symptoms and adjust protocol targets.',
    clinicianReview: 'Clinician review',
    clinicianBody: 'Use priority markers and symptoms together when discussing next checks.',
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
    whatChanged: 'Що змінилось',
    whatChangedBody: 'Контекстний огляд пріоритетних маркерів і напрям повторної перевірки.',
    stableZone: 'Стабільна зона',
    stableBody: 'Зберігайте звички, які підтримують показники в межах референсу.',
    needsAttention: 'Потребує уваги',
    needsBody: 'Повʼяжіть ці маркери із симптомами й уточніть цілі плану дій.',
    clinicianReview: 'Обговорити з фахівцем',
    clinicianBody: 'Використовуйте пріоритетні маркери разом із симптомами під час консультації.',
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

function getItemDate(item) {
  return item?.test_date || item?.created_at?.slice(0, 10) || 'Unknown date'
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

export default function LabResultsList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { hasAccess } = useFeature('progress')
  const isUk = isUkrainianLocale()
  const copy = isUk ? LAB_RESULTS_COPY.uk : LAB_RESULTS_COPY.en
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

    fetchLabResults()
    return () => {
      active = false
    }
  }, [user])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = new Date(a?.test_date || a?.created_at || 0).getTime()
      const db = new Date(b?.test_date || b?.created_at || 0).getTime()
      return db - da
    })
  }, [items])

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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        onClick={() => uploadId && navigate(`/results/${uploadId}`)}
                        disabled={!uploadId}
                        className="min-w-0 text-left disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
                      >
                        <p className="truncate text-sm font-semibold text-slate-800">{item?.lab_name || copy.labResults(sortedItems.length - index)}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {date}
                        </p>
                      </button>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="vtl-status-pill border border-emerald-200 bg-emerald-50 text-emerald-700">{copy.optimal} {optimal}</span>
                        <span className="vtl-status-pill border border-amber-200 bg-amber-50 text-amber-700">{copy.warning} {warning}</span>
                        <span className="vtl-status-pill border border-rose-200 bg-rose-50 text-rose-700">{copy.review} {critical}</span>
                      </div>

                      <div className="flex items-center gap-2 sm:justify-end">
                        <button
                          onClick={() => uploadId && navigate(`/results/${uploadId}`)}
                          disabled={!uploadId}
                          className="inline-flex min-h-10 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-40"
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

            <aside className="vtl-light-card h-fit p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{copy.whatChanged}</h3>
              <p className="mt-3 text-sm text-slate-500">{copy.whatChangedBody}</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">{copy.stableZone}</p>
                  <p className="mt-1 text-sm text-slate-700">{copy.stableBody}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">{copy.needsAttention}</p>
                  <p className="mt-1 text-sm text-slate-700">{copy.needsBody}</p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-rose-700 font-semibold">{copy.clinicianReview}</p>
                  <p className="mt-1 text-sm text-slate-700">{copy.clinicianBody}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{copy.nextStep}</p>
                  <p className="mt-1 text-sm text-slate-700">{copy.nextBody}</p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
