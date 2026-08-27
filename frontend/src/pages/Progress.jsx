import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Info,
  Route,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import api from '../lib/api.js'
import { CoachBadge, CoachButton, CoachCard, CoachSkeleton, EmptyCoachState, InsightCard } from '../components/coach/CoachUI.jsx'
import { isUkrainianLocale } from '../lib/locale.js'

const UK_COPY = {
  emptyTitle: 'Даних для динаміки ще немає',
  emptyBody: 'Завантажте перший результат аналізів, щоб створити базову точку. VITALOOP покаже тренди лише коли буде щонайменше дві різні лабораторні дати.',
  upload: 'Завантажити результати',
  unableTitle: 'Не вдалося завантажити динаміку',
  unableBody: 'Спробуйте ще раз. Ваші завантаження та звіти не змінено.',
  retry: 'Повторити',
  eyebrow: 'Прогрес за лабораторними датами',
  title: 'Що змінилося між аналізами?',
  dateSpine: 'Вісь дат',
  confidence: 'Надійність порівняння',
  topChanges: 'Головні зміни',
  stable: 'Стабільно між датами',
  allMarkers: 'Усі порівнювані маркери',
  timeline: 'Хронологія за датою аналізу',
  nextStep: 'Наступний найкращий крок',
  markers: 'показників',
  uploads: 'завантажень',
  uniqueDates: 'унікальні дати',
  comparable: 'порівнювані маркери',
  missingDates: 'без дати',
  dateSpan: 'період',
  days: 'дн.',
  startCheckin: 'Почати check-in',
  uploadAnother: 'Завантажити ще аналіз',
  hiddenPercent: 'Відсоток не акцентується: перше значення близьке до нуля або зміна може виглядати непропорційно.',
  noProgressTitle: 'Це ще не прогрес у часі',
  noProgressBody: 'VITALOOP не будує часову динаміку без щонайменше двох різних лабораторних дат. Дата завантаження файлу не використовується як дата аналізу.',
  undatedTitle: 'Потрібні дати аналізів',
  snapshotTitle: 'Snapshot, не trend',
  trendTitle: 'Динаміка за датами',
  strongTrendTitle: 'Сильніша динаміка',
  educational: 'Освітня інтерпретація. Це не діагноз і не заміна консультації лікаря.',
}

const EN_COPY = {
  emptyTitle: 'No progress data yet',
  emptyBody: 'Upload your first lab result to create a baseline. VITALOOP will only show trends after there are at least two different lab dates.',
  upload: 'Upload results',
  unableTitle: 'Unable to load progress',
  unableBody: 'Please try again. Your uploads and reports are not changed.',
  retry: 'Retry',
  eyebrow: 'Progress by lab dates',
  title: 'What changed between lab tests?',
  dateSpine: 'Date spine',
  confidence: 'Comparison confidence',
  topChanges: 'Top changes',
  stable: 'Stable across dates',
  allMarkers: 'All comparable markers',
  timeline: 'Timeline by lab date',
  nextStep: 'Next best step',
  markers: 'markers',
  uploads: 'uploads',
  uniqueDates: 'unique dates',
  comparable: 'comparable markers',
  missingDates: 'missing dates',
  dateSpan: 'date span',
  days: 'days',
  startCheckin: 'Start check-in',
  uploadAnother: 'Upload another lab',
  hiddenPercent: 'Percent is not emphasized because the first value is close to zero or the change may look disproportionate.',
  noProgressTitle: 'This is not progress over time yet',
  noProgressBody: 'VITALOOP does not build time progress without at least two different lab dates. File upload date is not used as the lab date.',
  undatedTitle: 'Lab dates needed',
  snapshotTitle: 'Snapshot, not trend',
  trendTitle: 'Date-aware trend',
  strongTrendTitle: 'Higher-confidence trend',
  educational: 'Educational interpretation. This is not a diagnosis or a replacement for medical care.',
}

function formatDate(value, isUk = false) {
  if (!value) return isUk ? 'Дата відсутня' : 'Date missing'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString(isUk ? 'uk-UA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatValue(value, unit = '') {
  if (value == null || Number.isNaN(Number(value))) return '-'
  const numeric = Number(value)
  const rounded = Math.abs(numeric) >= 100 ? Math.round(numeric) : Math.round(numeric * 100) / 100
  return `${rounded}${unit ? ` ${unit}` : ''}`
}

function formatDelta(value, unit = '') {
  if (value == null || Number.isNaN(Number(value))) return '-'
  const numeric = Number(value)
  const sign = numeric > 0 ? '+' : ''
  const rounded = Math.abs(numeric) >= 100 ? Math.round(numeric) : Math.round(numeric * 100) / 100
  return `${sign}${rounded}${unit ? ` ${unit}` : ''}`
}

function toneForStatus(statusGroup) {
  if (statusGroup === 'needs_review') return 'warning'
  if (statusGroup === 'monitor') return 'attention'
  if (statusGroup === 'stable') return 'success'
  return 'neutral'
}

function modeView(mode, copy) {
  if (mode === 'undated') return { title: copy.undatedTitle, tone: 'attention' }
  if (mode === 'snapshot') return { title: copy.snapshotTitle, tone: 'warning' }
  if (mode === 'high_confidence_time_trend') return { title: copy.strongTrendTitle, tone: 'success' }
  if (mode === 'time_trend') return { title: copy.trendTitle, tone: 'primary' }
  return { title: copy.noProgressTitle, tone: 'neutral' }
}

function progressHeroBody(overview, isUk) {
  const summary = overview?.summary || {}
  if (overview?.mode === 'undated') {
    return isUk
      ? `Є ${summary.biomarker_rows || 0} рядків показників, але лабораторні дати не знайдені. Ці дані не потрапляють на вісь прогресу.`
      : `${summary.biomarker_rows || 0} biomarker rows are present, but lab dates were not found. These data points stay off the progress timeline.`
  }
  if (overview?.mode === 'snapshot') {
    return isUk
      ? `Знайдена одна лабораторна дата: ${formatDate(summary.first_lab_date, true)}. Це знімок стану, а не зміна в часі.`
      : `One lab date was found: ${formatDate(summary.first_lab_date)}. This is a health snapshot, not change over time.`
  }
  if (overview?.timeline_eligible) {
    return isUk
      ? `Порівнюємо ${summary.unique_lab_dates} лабораторні дати з ${formatDate(summary.first_lab_date, true)} до ${formatDate(summary.latest_lab_date, true)}.`
      : `Comparing ${summary.unique_lab_dates} lab dates from ${formatDate(summary.first_lab_date)} to ${formatDate(summary.latest_lab_date)}.`
  }
  return isUk ? 'Після наступного аналізу з лабораторною датою тут зʼявиться чесна динаміка.' : 'After another dated lab result, this page will show a reliable timeline.'
}

function MetricTile({ label, value, tone = 'neutral' }) {
  const className = tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-slate-200 bg-white text-slate-950'
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${className}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value ?? '-'}</p>
    </div>
  )
}

function DateSpine({ overview, copy, isUk }) {
  const dates = overview?.date_spine || []
  if (!dates.length) {
    return (
      <CoachCard tone="attention" className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><CalendarClock className="h-5 w-5" /></div>
          <div>
            <p className="coach-eyebrow">{copy.dateSpine}</p>
            <h2 className="coach-title-lg">{copy.undatedTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-amber-950">{copy.noProgressBody}</p>
          </div>
        </div>
      </CoachCard>
    )
  }

  return (
    <CoachCard className="p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <Route className="h-5 w-5 text-teal-600" />
        <div>
          <p className="coach-eyebrow">{copy.dateSpine}</p>
          <h2 className="coach-title-lg">{isUk ? 'Лабораторні дати, які реально порівнюються' : 'Lab dates used for comparison'}</h2>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {dates.map((item, index) => (
          <div key={item.date} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-black text-slate-950">{formatDate(item.date, isUk)}</p>
              <CoachBadge tone={index === dates.length - 1 ? 'primary' : 'neutral'}>
                {index === 0 ? (isUk ? 'Перша' : 'First') : index === dates.length - 1 ? (isUk ? 'Остання' : 'Latest') : (isUk ? 'Проміжна' : 'Mid')}
              </CoachBadge>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600">{item.upload_count} {copy.uploads} · {item.marker_count} {copy.markers}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(item.status_counts || {}).map(([key, value]) => (
                <CoachBadge key={key} tone={toneForStatus(key)}>{key.replace('_', ' ')} {value}</CoachBadge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CoachCard>
  )
}

function ConfidenceBlock({ overview, copy, isUk }) {
  const summary = overview?.summary || {}
  const confidence = overview?.confidence || {}
  const mode = modeView(overview?.mode, copy)
  return (
    <CoachCard className="p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="coach-eyebrow">{copy.confidence}</p>
          <h2 className="coach-title-lg">{mode.title}</h2>
        </div>
        <CoachBadge tone={mode.tone}>{confidence.label || 'none'} · {Math.round((confidence.score || 0) * 100)}%</CoachBadge>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <MetricTile label={copy.dateSpan} value={summary.date_span_days != null ? `${summary.date_span_days} ${copy.days}` : '-'} />
        <MetricTile label={copy.uniqueDates} value={summary.unique_lab_dates || 0} />
        <MetricTile label={copy.comparable} value={summary.markers_with_2plus_dates || 0} />
        <MetricTile label={copy.markers} value={summary.biomarker_rows || 0} />
        <MetricTile label={copy.missingDates} value={summary.uploads_missing_lab_date || 0} tone={summary.uploads_missing_lab_date ? 'warning' : 'success'} />
      </div>
      {confidence.warnings?.length ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          {isUk ? 'Обмеження порівняння: ' : 'Comparison limits: '}
          {confidence.warnings.map((item) => item.replaceAll('_', ' ')).join(', ')}.
        </div>
      ) : null}
    </CoachCard>
  )
}

function ChangeCard({ item, isUk }) {
  const tone = toneForStatus(item.current_status_group)
  const percent = Number.isFinite(Number(item.percent_change)) && Math.abs(Number(item.percent_change)) <= 300
    ? `${Number(item.percent_change) > 0 ? '+' : ''}${Math.round(Number(item.percent_change) * 10) / 10}%`
    : null
  return (
    <div className="rounded-3xl border border-slate-200 bg-sky-50/70 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold text-slate-950">{item.name}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {isUk
              ? `${formatDate(item.previous_date, true)}: ${formatValue(item.previous_value, item.unit)} → ${formatDate(item.latest_date, true)}: ${formatValue(item.latest_value, item.unit)}.`
              : `${formatDate(item.previous_date)}: ${formatValue(item.previous_value, item.unit)} → ${formatDate(item.latest_date)}: ${formatValue(item.latest_value, item.unit)}.`}
          </p>
        </div>
        <CoachBadge tone={tone}>{item.current_status_group?.replace('_', ' ') || item.current_status || 'status'}</CoachBadge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricTile label={isUk ? 'Фактична зміна' : 'Absolute change'} value={formatDelta(item.absolute_change, item.unit)} tone={tone === 'warning' ? 'warning' : 'neutral'} />
        <MetricTile label={isUk ? 'Відсоток' : 'Percent'} value={percent || (isUk ? 'не акцентуємо' : 'not emphasized')} />
        <MetricTile label={isUk ? 'Надійність' : 'Reliability'} value={item.reliability || 'medium'} tone={item.reliability === 'high' ? 'success' : 'neutral'} />
      </div>
      {!percent ? <p className="mt-3 text-xs font-semibold text-amber-700">{isUk ? UK_COPY.hiddenPercent : EN_COPY.hiddenPercent}</p> : null}
    </div>
  )
}

function MarkerRow({ item, isUk }) {
  const tone = toneForStatus(item.current_status_group)
  return (
    <div className="grid gap-3 border-b border-slate-100 py-3 last:border-0 md:grid-cols-[1.2fr_1fr_0.8fr_0.8fr] md:items-center">
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-950">{item.name}</p>
        <p className="text-xs text-slate-500">{formatDate(item.first_date, isUk)} → {formatDate(item.latest_date, isUk)}</p>
      </div>
      <p className="text-sm font-semibold text-slate-700">{formatValue(item.first_value, item.unit)} → {formatValue(item.latest_value, item.unit)}</p>
      <CoachBadge tone={tone}>{item.direction || 'stable'}</CoachBadge>
      <p className="text-sm font-semibold text-slate-600">{formatDelta(item.absolute_change, item.unit)}</p>
    </div>
  )
}

function RuleInsights({ items = [], isUk }) {
  if (!items.length) return null
  const translated = items.map((item) => {
    if (!isUk) return item
    if (item.key === 'lab_dates_only') {
      return { ...item, title: 'Тільки лабораторні дати', body: 'Дата завантаження не використовується як дата аналізу.' }
    }
    if (item.key === 'not_diagnostic') {
      return { ...item, title: 'Освітня інтерпретація', body: 'Зміни призначені для обговорення з лікарем, а не для самостійного діагнозу.' }
    }
    return item
  })
  return (
    <CoachCard className="p-5 sm:p-6">
      <div className="mb-5">
        <p className="coach-eyebrow">{isUk ? 'Правила читання' : 'Reading rules'}</p>
        <h2 className="coach-title-lg">{isUk ? 'Як VITALOOP читає прогрес' : 'How VITALOOP reads progress'}</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {translated.map((item) => (
          <div key={item.key || item.title} className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
            <p className="font-extrabold text-slate-950">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{item.body}</p>
          </div>
        ))}
      </div>
    </CoachCard>
  )
}

export default function Progress() {
  const navigate = useNavigate()
  const isUk = isUkrainianLocale()
  const copy = isUk ? UK_COPY : EN_COPY
  const [showAllMarkers, setShowAllMarkers] = useState(false)

  const { data: overview, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['progress-overview'],
    queryFn: async () => {
      const { data } = await api.get('/progress/overview')
      return data || null
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  })

  const summary = overview?.summary || {}
  const mode = useMemo(() => modeView(overview?.mode, copy), [overview?.mode, copy])
  const nextAction = overview?.next_action || {}
  const nextHref = nextAction.href || '/check-ins'
  const comparableMarkers = overview?.all_comparable_markers || [
    ...(overview?.top_changes || []),
    ...(overview?.stable_markers || []),
  ]

  if (isLoading) return <div className="coach-shell"><CoachSkeleton rows={4} /></div>

  if (isError) {
    return (
      <div className="coach-shell">
        <EmptyCoachState
          icon={AlertTriangle}
          title={copy.unableTitle}
          body={error?.response?.status === 404 ? copy.emptyBody : copy.unableBody}
          actionLabel={copy.retry}
          onAction={refetch}
        />
      </div>
    )
  }

  if (!overview || summary.upload_count === 0) {
    return (
      <div className="coach-shell">
        <EmptyCoachState
          icon={UploadCloud}
          title={copy.emptyTitle}
          body={copy.emptyBody}
          actionLabel={copy.upload}
          onAction={() => navigate('/upload')}
        />
      </div>
    )
  }

  return (
    <div className="coach-shell coach-grid pb-10">
      <section className="coach-hero">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="coach-eyebrow">{copy.eyebrow}</p>
            <h1 className="coach-title-xl">{copy.title}</h1>
            <p className="coach-body mt-4 max-w-2xl">{progressHeroBody(overview, isUk)}</p>
          </div>
          <CoachCard tone={overview.mode === 'undated' || overview.mode === 'snapshot' ? 'attention' : 'soft'} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="coach-eyebrow">{isUk ? 'Поточний режим' : 'Current mode'}</p>
                <h2 className="text-xl font-extrabold text-slate-950">{mode.title}</h2>
              </div>
              <CoachBadge tone={mode.tone}>{overview.mode}</CoachBadge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {summary.upload_count} {copy.uploads} · {summary.biomarker_rows} {copy.markers} · {summary.markers_with_2plus_dates} {copy.comparable}
            </p>
          </CoachCard>
        </div>
      </section>

      <DateSpine overview={overview} copy={copy} isUk={isUk} />
      <ConfidenceBlock overview={overview} copy={copy} isUk={isUk} />

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5">
          <p className="coach-eyebrow">{copy.topChanges}</p>
          <h2 className="coach-title-lg">
            {overview.top_changes?.length ? (isUk ? '3-5 змін, які варто переглянути першими' : '3-5 changes to review first') : copy.noProgressTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {overview.top_changes?.length
              ? (isUk ? 'Список сформований backend-ом на основі різних лабораторних дат, не дати завантаження.' : 'This list is produced by the backend from different lab dates, not upload dates.')
              : copy.noProgressBody}
          </p>
        </div>
        {overview.top_changes?.length ? (
          <div className="space-y-4">{overview.top_changes.map((item) => <ChangeCard key={`${item.canonical_name}-${item.latest_date}`} item={item} isUk={isUk} />)}</div>
        ) : (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <Info className="mt-1 h-5 w-5 text-amber-700" />
              <p className="text-sm leading-6 text-amber-950">{copy.noProgressBody}</p>
            </div>
          </div>
        )}
      </CoachCard>

      <InsightCard
        icon={Clock3}
        eyebrow={copy.nextStep}
        title={isUk ? 'Звʼяжіть зміни з самопочуттям' : 'Connect changes with how you feel'}
        body={isUk
          ? (nextAction.reason === 'Progress requires real lab dates, not upload dates.' ? 'Додайте лабораторні дати до недатованих завантажень. Без них маркери не потраплять на часову вісь.' : 'Короткий check-in допоможе читати зміни маркерів разом із симптомами, навантаженням, харчуванням і самопочуттям.')
          : (nextAction.reason || 'A short check-in helps connect symptoms with dated lab results.')}
        actionLabel={nextHref.includes('upload') ? copy.uploadAnother : copy.startCheckin}
        onAction={() => navigate(nextHref)}
      />

      {overview.stable_markers?.length ? (
        <CoachCard className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-extrabold text-slate-950">{copy.stable}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {overview.stable_markers.slice(0, 6).map((item) => <MarkerRow key={`${item.canonical_name}-${item.latest_date}`} item={item} isUk={isUk} />)}
          </div>
        </CoachCard>
      ) : null}

      <CoachCard className="p-5 sm:p-6">
        <button type="button" onClick={() => setShowAllMarkers((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left" aria-expanded={showAllMarkers}>
          <div>
            <p className="coach-eyebrow">{copy.allMarkers}</p>
            <h2 className="coach-title-lg">{isUk ? 'Повний список порівнюваних маркерів' : 'Full comparable marker list'}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {summary.markers_with_2plus_dates || 0} {copy.comparable}. {summary.uploads_missing_lab_date || 0} {copy.missingDates}.
            </p>
          </div>
          {showAllMarkers ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronRight className="h-5 w-5 text-slate-500" />}
        </button>
        {showAllMarkers && (
          <div className="mt-5">
            {comparableMarkers.length ? (
              <div className="divide-y divide-slate-100">
                {comparableMarkers.map((item) => <MarkerRow key={`${item.canonical_name}-${item.latest_date}-all`} item={item} isUk={isUk} />)}
              </div>
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{copy.noProgressBody}</p>
            )}
          </div>
        )}
      </CoachCard>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Route className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-extrabold text-slate-950">{copy.timeline}</h2>
        </div>
        {overview.timeline?.length ? (
          <div className="space-y-3">
            {overview.timeline.map((item) => (
              <div key={item.date} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-950">{formatDate(item.date, isUk)}</p>
                  <CoachBadge tone="neutral">{item.marker_count} {copy.markers}</CoachBadge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.upload_count} {copy.uploads}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">{copy.noProgressBody}</p>
        )}
      </CoachCard>

      <RuleInsights items={overview.rule_insights || []} isUk={isUk} />

      {overview.undated_uploads?.length ? (
        <CoachCard tone="attention" className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 text-amber-700" />
            <div>
              <h2 className="text-lg font-extrabold text-amber-950">{isUk ? 'Недатовані завантаження не входять у тренди' : 'Undated uploads are excluded from trends'}</h2>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                {isUk
                  ? `${overview.undated_uploads.length} завантаження залишаються поза віссю часу. Додайте дату вручну або завантажте файл, де дата аналізу читається.`
                  : `${overview.undated_uploads.length} uploads stay off the timeline. Add the lab date manually or upload a file where the test date is readable.`}
              </p>
            </div>
          </div>
        </CoachCard>
      ) : null}

      <p className="px-1 text-xs text-slate-500">{copy.educational}</p>
    </div>
  )
}
