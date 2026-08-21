import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, RefreshCw, Route, TrendingDown, TrendingUp, UploadCloud } from 'lucide-react'
import api from '../lib/api.js'
import { useProgress } from '../hooks/useQueries.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { CoachBadge, CoachButton, CoachCard, CoachSkeleton, EmptyCoachState, InsightCard, KPIBlock } from '../components/coach/CoachUI.jsx'
import { isUkrainianLocale } from '../lib/locale.js'

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim()
}

function formatDate(value, isUk = false) {
  if (!value) return isUk ? 'Дата невідома' : 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString(isUk ? 'uk-UA' : undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function buildSeries(uploads) {
  const map = new Map()
  uploads.forEach((upload) => {
    const date = upload?.test_date || upload?.created_at
    ;(upload?.biomarkers || []).forEach((marker) => {
      const name = normalizeName(marker?.name)
      const value = toNumber(marker?.value)
      if (!name || value == null) return
      if (!map.has(name)) map.set(name, { name, unit: marker?.unit || '', points: [] })
      map.get(name).points.push({ value, date, marker })
    })
  })
  return [...map.values()].map((item) => ({ ...item, points: item.points.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)) }))
}

function buildTrends(uploads) {
  return buildSeries(uploads)
    .map((series) => {
      if (series.points.length < 2) return { ...series, state: 'baseline' }
      const first = series.points[0]
      const last = series.points[series.points.length - 1]
      const delta = last.value - first.value
      const pct = first.value === 0 ? null : Math.round((delta / first.value) * 100)
      return {
        ...series,
        state: delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'stable',
        first,
        last,
        delta,
        pct,
      }
    })
    .sort((a, b) => Math.abs(b.pct || 0) - Math.abs(a.pct || 0))
}

function normalizeMarkerStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value.includes('critical') || value.includes('review') || value.includes('deficient') || value.includes('elevated') || value.includes('low') || value.includes('high')) return 'review'
  if (value.includes('border') || value.includes('warn') || value.includes('monitor')) return 'monitor'
  if (value.includes('optimal') || value.includes('normal') || value.includes('range')) return 'stable'
  return 'unknown'
}

function trendDirectionTone(state) {
  if (state === 'increased' || state === 'decreased') return 'primary'
  if (state === 'stable') return 'success'
  return 'neutral'
}

function trendLabel(trend, isUk = false) {
  if (trend.state === 'baseline') return isUk ? 'Базова точка' : 'Baseline'
  if (trend.state === 'stable') return isUk ? 'Стабільно' : 'Stable'
  if (trend.state === 'increased') return isUk ? 'Зросло' : 'Changed upward'
  if (trend.state === 'decreased') return isUk ? 'Знизилось' : 'Changed downward'
  return isUk ? 'Тренд' : 'Trend'
}

function trendMeaning(trend, isUk = false) {
  const latest = trend.last || trend.points?.[trend.points.length - 1]
  const markerStatus = normalizeMarkerStatus(latest?.marker?.status)

  if (trend.state === 'baseline') {
    return {
      tone: 'neutral',
      label: isUk ? 'Потрібна друга точка' : 'Second point needed',
      body: isUk
        ? 'Це базове значення. VITALOOP не робить висновок про динаміку, поки немає другого порівнюваного аналізу.'
        : 'This is a baseline value. VITALOOP does not infer a trend until a second comparable result exists.',
    }
  }

  if (markerStatus === 'review') {
    return {
      tone: 'warning',
      label: isUk ? 'Обговорити в контексті' : 'Review in context',
      body: isUk
        ? 'Останнє значення позначене як таке, що потребує перегляду. Напрямок зміни сам по собі не є діагнозом.'
        : 'The latest value is marked for review. Direction alone is not a diagnosis.',
    }
  }

  if (markerStatus === 'monitor') {
    return {
      tone: 'warning',
      label: isUk ? 'Спостерігати' : 'Monitor',
      body: isUk
        ? 'Маркер варто відстежувати разом із симптомами, повторними аналізами та планом дій.'
        : 'Track this marker together with symptoms, repeat labs, and the action plan.',
    }
  }

  if (markerStatus === 'stable') {
    return {
      tone: 'success',
      label: isUk ? 'У стабільній зоні' : 'Stable zone',
      body: isUk
        ? 'Останнє значення перебуває в референсі. Зміна показує напрямок, але не потребує окремого висновку без контексту.'
        : 'The latest value is in range. The movement shows direction, not a standalone conclusion.',
    }
  }

  return {
    tone: 'neutral',
    label: isUk ? 'Контекст потрібен' : 'Context needed',
    body: isUk
      ? 'VITALOOP показує напрямок зміни, але для інтерпретації потрібні референси, симптоми й профіль.'
      : 'VITALOOP shows direction, but interpretation needs reference ranges, symptoms, and profile context.',
  }
}

function TrendCard({ trend, isUk = false }) {
  const latest = trend.last || trend.points?.[trend.points.length - 1]
  const first = trend.first || trend.points?.[0]
  const meaning = trendMeaning(trend, isUk)
  return (
    <CoachCard className="p-4" interactive>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-950">{trend.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{latest ? `${latest.value}${trend.unit ? ` ${trend.unit}` : ''}` : (isUk ? 'Немає значення' : 'No value')}</p>
        </div>
        <CoachBadge tone={trendDirectionTone(trend.state)}>{trendLabel(trend, isUk)}</CoachBadge>
      </div>
      {trend.state === 'baseline' ? (
        <p className="text-sm leading-6 text-slate-600">{isUk ? 'Є одна валідна точка даних. Завантажте ще один аналіз, щоб порівняти динаміку.' : 'One valid data point. Upload another test to compare direction over time.'}</p>
      ) : (
        <p className="text-sm leading-6 text-slate-600">
          {first?.value}{trend.unit ? ` ${trend.unit}` : ''} → {latest?.value}{trend.unit ? ` ${trend.unit}` : ''}
          {trend.pct != null ? ` (${trend.pct > 0 ? '+' : ''}${trend.pct}%)` : ''}
        </p>
      )}
      <div className="mt-3 rounded-xl border border-slate-200 bg-white/75 p-3">
        <div className="mb-1">
          <CoachBadge tone={meaning.tone}>{meaning.label}</CoachBadge>
        </div>
        <p className="text-xs leading-5 text-slate-600">{meaning.body}</p>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500">{isUk ? 'Від' : 'Since'} {formatDate(first?.date, isUk)}</p>
    </CoachCard>
  )
}

function triggerPaywall() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'SUBSCRIPTION_REQUIRED', source: '/progress' } }))
  }
}

export default function Progress() {
  const navigate = useNavigate()
  const isUk = isUkrainianLocale()
  const { isActive: hasPremium, loading: subscriptionLoading } = useSubscription()
  const { data = [], isLoading, isError, error, refetch } = useProgress()
  const { data: timeline = [], isError: timelineError } = useQuery({
    queryKey: ['timeline'],
    queryFn: async () => {
      const { data } = await api.get('/timeline')
      return data || []
    },
    enabled: Boolean(hasPremium),
    initialData: [],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const { data: insights = [], isError: insightsError } = useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const { data } = await api.get('/insights')
      return data || []
    },
    enabled: Boolean(hasPremium),
    initialData: [],
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
  const { data: checkins = [], isError: checkinsError } = useQuery({
    queryKey: ['checkins'],
    queryFn: async () => {
      const { data } = await api.get('/checkins/history')
      return Array.isArray(data) ? data : data?.checkins || []
    },
    enabled: Boolean(hasPremium),
    initialData: [],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const uploads = useMemo(() => {
    return [...data]
      .filter((upload) => Array.isArray(upload?.biomarkers) && upload.biomarkers.length > 0)
      .sort((a, b) => new Date(a?.test_date || a?.created_at || 0) - new Date(b?.test_date || b?.created_at || 0))
  }, [data])
  const trends = useMemo(() => buildTrends(uploads), [uploads])
  const multiplePointTrends = trends.filter((trend) => trend.points.length >= 2)
  const baselineTrends = trends.filter((trend) => trend.points.length === 1)
  const recentImprovements = multiplePointTrends.filter((trend) => normalizeMarkerStatus((trend.last || trend.points?.[trend.points.length - 1])?.marker?.status) === 'stable').slice(0, 4)
  const attentionTrends = multiplePointTrends.filter((trend) => ['review', 'monitor', 'unknown'].includes(normalizeMarkerStatus((trend.last || trend.points?.[trend.points.length - 1])?.marker?.status))).slice(0, 4)
  const latestUpload = uploads[uploads.length - 1]
  const latestDate = latestUpload?.test_date || latestUpload?.created_at
  const daysSinceLatest = latestDate ? Math.floor((Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24)) : null
  const retestOverdue = daysSinceLatest != null && daysSinceLatest >= 90
  const partialFailure = timelineError || insightsError || checkinsError

  if (isLoading) return <div className="coach-shell"><CoachSkeleton rows={4} /></div>

  if (isError) {
    const isPaywall = error?.response?.status === 402 && !subscriptionLoading && !hasPremium
    return (
      <div className="coach-shell">
        <EmptyCoachState
          icon={isPaywall ? CalendarClock : AlertTriangle}
          title={isPaywall ? (isUk ? 'Динаміка доступна в Premium' : 'Progress is a Premium feature') : (isUk ? 'Не вдалося завантажити динаміку' : 'Unable to load progress')}
          body={isPaywall ? (isUk ? 'Відкрийте тренди, чек-іни та нагадування про повторні аналізи.' : 'Unlock trend tracking, check-ins, and retest reminders.') : (isUk ? 'Спробуйте ще раз. Ваші завантаження та звіти не змінено.' : 'Please try again. Your uploads and reports are not changed.')}
          actionLabel={isPaywall ? (isUk ? 'Переглянути Premium' : 'View Premium') : (isUk ? 'Повторити' : 'Retry')}
          onAction={isPaywall ? triggerPaywall : refetch}
        />
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="coach-shell">
        <EmptyCoachState
          icon={UploadCloud}
          title={isUk ? 'Даних для динаміки ще немає' : 'No progress data yet'}
          body={isUk ? 'Завантажте перший результат аналізів, щоб створити базову точку. VITALOOP покаже тренди, коли буде щонайменше дві порівнювані точки.' : 'Upload your first lab result to create a baseline. VITALOOP will only show trends after there are at least two comparable data points.'}
          actionLabel={isUk ? 'Завантажити результати' : 'Upload results'}
          onAction={() => navigate('/upload')}
        />
      </div>
    )
  }

  return (
    <div className="coach-shell coach-grid">
      <section className="coach-hero">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="coach-eyebrow">{isUk ? 'Підсумок динаміки' : 'Progress Summary'}</p>
            <h1 className="coach-title-xl">{isUk ? 'Що змінилося після останніх перевірок?' : 'What changed since your last checks?'}</h1>
            <p className="coach-body mt-4 max-w-2xl">
              {isUk ? 'Динаміка базується на реальних завантаженнях і чек-інах. Графіки зʼявляються, коли VITALOOP має щонайменше дві валідні точки для порівняння.' : 'Progress is based on real uploads and check-ins. Charts appear only when VITALOOP has at least two valid points to compare.'}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <CoachButton icon={UploadCloud} onClick={() => navigate('/upload')}>{isUk ? 'Завантажити новий аналіз' : 'Upload new test'}</CoachButton>
              <CoachButton variant="secondary" icon={CalendarClock} onClick={() => navigate('/check-ins')}>{isUk ? 'Чек-ін' : 'Check in'}</CoachButton>
            </div>
          </div>
          <CoachCard className="p-5" tone={retestOverdue ? 'attention' : 'soft'}>
            <p className="coach-eyebrow">{isUk ? 'Наступна рекомендована дія' : 'Next Recommended Action'}</p>
            <h2 className="text-xl font-extrabold text-slate-950">{retestOverdue ? (isUk ? 'Заплануйте повторний аналіз' : 'Plan a retest window') : multiplePointTrends.length ? (isUk ? 'Перегляньте змінені маркери' : 'Review changed markers') : (isUk ? 'Створіть другу точку даних' : 'Create your second data point')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {retestOverdue
                ? (isUk ? 'Останнє завантаження було понад 90 днів тому. Час повторного аналізу варто підтвердити з лікарем.' : 'Your latest upload is 90+ days old. Retest timing should be confirmed with your clinician.')
                : multiplePointTrends.length
                  ? (isUk ? 'Відкрийте маркери з найбільшими змінами та зіставте їх із симптомами.' : 'Open the markers with the biggest movement and compare them with symptoms.')
                  : (isUk ? 'Одне завантаження створює базову точку. Друге відкриває напрямок тренду.' : 'One upload is a baseline. A second upload unlocks trend direction.')}
            </p>
          </CoachCard>
        </div>
      </section>

      {partialFailure && (
        <CoachCard tone="attention" className="p-4">
          <p className="text-sm font-semibold text-amber-900">{isUk ? 'Частину допоміжних даних динаміки не вдалося завантажити. Доступні секції нижче використовують дані, які завантажилися успішно.' : 'Some supporting progress data could not load. Available sections below still use the data that loaded successfully.'}</p>
        </CoachCard>
      )}

      <div className="coach-grid coach-grid--3">
        <KPIBlock label={isUk ? 'Завантажені аналізи' : 'Lab uploads'} value={data.length} helper={isUk ? 'Реальні завантажені звіти.' : 'Real uploaded reports.'} icon={UploadCloud} />
        <KPIBlock label={isUk ? 'Порівнювані тренди' : 'Comparable trends'} value={multiplePointTrends.length} helper={isUk ? 'Маркери з 2+ валідними точками.' : 'Markers with 2+ valid points.'} icon={TrendingUp} tone={multiplePointTrends.length ? 'success' : 'neutral'} />
        <KPIBlock label={isUk ? 'Чек-іни' : 'Check-ins'} value={checkins.length} helper={isUk ? 'Записані перевірки симптомів.' : 'Symptom follow-ups recorded.'} icon={CheckCircle2} tone={checkins.length ? 'success' : 'neutral'} />
      </div>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5">
          <p className="coach-eyebrow">{isUk ? 'Тренди біомаркерів' : 'Biomarker Trends'}</p>
          <h2 className="coach-title-lg">{multiplePointTrends.length ? (isUk ? 'Напрямок доступний для порівнюваних маркерів' : 'Direction is available for comparable markers') : (isUk ? 'Базовий стан' : 'Baseline state')}</h2>
        </div>
        {multiplePointTrends.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {multiplePointTrends.slice(0, 9).map((trend) => <TrendCard key={trend.name} trend={trend} isUk={isUk} />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {baselineTrends.slice(0, 6).map((trend) => <TrendCard key={trend.name} trend={trend} isUk={isUk} />)}
          </div>
        )}
      </CoachCard>

      <div className="coach-grid coach-grid--2">
        <CoachCard className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-extrabold text-slate-950">{isUk ? 'Нещодавні покращення' : 'Recent Improvements'}</h2>
          </div>
          {recentImprovements.length ? (
            <div className="space-y-3">
              {recentImprovements.map((trend) => <TrendCard key={trend.name} trend={trend} isUk={isUk} />)}
            </div>
          ) : <p className="text-sm leading-6 text-slate-600">{isUk ? 'Порівнюваного тренду покращення ще немає. Завантажте ще один звіт або пройдіть чек-ін, щоб відстежити відповідь.' : 'No comparable improvement trend yet. Upload another report or complete check-ins to track response.'}</p>}
        </CoachCard>

        <CoachCard className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-extrabold text-slate-950">{isUk ? 'Потребує перегляду' : 'Needs Review'}</h2>
          </div>
          {attentionTrends.length ? (
            <div className="space-y-3">
              {attentionTrends.map((trend) => <TrendCard key={trend.name} trend={trend} isUk={isUk} />)}
            </div>
          ) : <p className="text-sm leading-6 text-slate-600">{isUk ? 'У завантажених даних не видно погіршення порівнюваних біомаркерів.' : 'No worsening comparable biomarker trend is visible in the loaded data.'}</p>}
        </CoachCard>
      </div>

      <div className="coach-grid coach-grid--2">
        <CoachCard className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Route className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-extrabold text-slate-950">{isUk ? 'Хронологія' : 'Timeline'}</h2>
          </div>
          <div className="space-y-3">
            {(Array.isArray(timeline) && timeline.length ? timeline : data).slice(0, 8).map((item, index) => (
              <div key={item.id || index} className="rounded-2xl bg-slate-50 p-3">
                <p className="font-bold text-slate-950">{item.title || item.lab_name || item.event_type || (isUk ? `Завантаження ${index + 1}` : `Upload ${index + 1}`)}</p>
                <p className="mt-1 text-sm text-slate-600">{formatDate(item.created_at || item.test_date || item.date, isUk)}</p>
              </div>
            ))}
          </div>
        </CoachCard>

        <CoachCard className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-extrabold text-slate-950">{isUk ? 'Нагадування про повторні аналізи' : 'Retest Reminders'}</h2>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            {latestDate
              ? (isUk ? `Останнє завантаження: ${formatDate(latestDate, isUk)}${daysSinceLatest != null ? ` (${daysSinceLatest} дн. тому).` : '.'}` : `Latest upload: ${formatDate(latestDate)}${daysSinceLatest != null ? ` (${daysSinceLatest} days ago).` : '.'}`)
              : (isUk ? 'Дата завантаження недоступна.' : 'No upload date is available.')}
          </p>
          <CoachBadge tone={retestOverdue ? 'warning' : 'neutral'} className="mt-3">
            {retestOverdue ? (isUk ? 'Може наставати час повторного аналізу' : 'Retest window may be due') : (isUk ? 'Час повторного аналізу залежить від контексту' : 'Retest timing depends on context')}
          </CoachBadge>
        </CoachCard>
      </div>

      <div className="coach-grid coach-grid--2">
        <CoachCard className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-extrabold text-slate-950">{isUk ? 'Історія чек-інів' : 'Check-In History'}</h2>
          </div>
          {checkins.length ? (
            <div className="space-y-3">
              {checkins.slice(0, 6).map((item, index) => (
                <div key={item.id || index} className="rounded-2xl bg-slate-50 p-3">
                  <p className="font-bold text-slate-950">{formatDate(item.created_at || item.date, isUk)}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.summary || item.note || item.status || (isUk ? 'Чек-ін записано.' : 'Check-in recorded.')}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm leading-6 text-slate-600">{isUk ? 'Чек-інів ще немає. Додайте один, щоб повʼязати симптоми з динамікою аналізів.' : 'No check-ins yet. Add one to connect symptoms with lab trends.'}</p>}
        </CoachCard>

        <CoachCard className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <SparkIcon />
            <h2 className="text-lg font-extrabold text-slate-950">{isUk ? 'Інсайти' : 'Insights'}</h2>
          </div>
          {Array.isArray(insights) && insights.length ? (
            <div className="space-y-3">
              {insights.slice(0, 5).map((item, index) => (
                <div key={item.id || index} className="rounded-2xl bg-slate-50 p-3">
                  <p className="font-bold text-slate-950">{item.title || item.type || (isUk ? 'Інсайт' : 'Insight')}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.body || item.summary || item.description || (isUk ? 'Перегляньте цей інсайт у контексті.' : 'Review this insight in context.')}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm leading-6 text-slate-600">{isUk ? 'Згенерованих інсайтів ще немає. Вони зʼявляться після завантажень, чек-інів і даних для динаміки.' : 'No generated insights yet. Insights appear after uploads, check-ins, and trendable data.'}</p>}
        </CoachCard>
      </div>

      <InsightCard
        icon={CalendarClock}
        title={isUk ? 'Що робити далі?' : 'What should I do next?'}
        body={multiplePointTrends.length ? (isUk ? 'Перегляньте змінені маркери та пройдіть чек-ін, щоб симптоми й біомаркери можна було інтерпретувати разом.' : 'Review changed markers and complete a check-in so symptoms and biomarkers can be interpreted together.') : (isUk ? 'Коли буде доречно, завантажте ще один порівнюваний звіт, щоб перейти від базової точки до тренду.' : 'Upload another comparable lab report when appropriate to move from baseline to trend.')}
        actionLabel={multiplePointTrends.length ? (isUk ? 'Почати чек-ін' : 'Start check-in') : (isUk ? 'Завантажити результат' : 'Upload result')}
        onAction={() => navigate(multiplePointTrends.length ? '/check-ins' : '/upload')}
      />
    </div>
  )
}

function SparkIcon() {
  return <CheckCircle2 className="h-5 w-5 text-teal-600" />
}
