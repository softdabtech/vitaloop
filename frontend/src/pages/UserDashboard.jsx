import { useNavigate } from 'react-router-dom'
import { ArrowRight, HelpCircle, RefreshCw, ShieldAlert, Stethoscope, TrendingUp } from 'lucide-react'
import { useDashboardSummary, useQuestionnaireSession, useReportDetails } from '../hooks/useQueries.js'
import { useProfile } from '../hooks/useProfile.ts'
import { useSubscription } from '../hooks/useSubscription.js'
import { CoachButton, CoachCard, CoachSkeleton, EmptyCoachState } from '../components/coach/CoachUI.jsx'
import { buildTodayViewModel } from '../lib/todayViewModel.js'
import { isUkrainianLocale } from '../lib/locale.js'
// coach-shell/coach-card/etc. (CoachUI.jsx) have no built-in styles of their
// own — every rule lives in this stylesheet. Vite code-splits CSS per lazy
// route chunk, so each page using CoachUI must import it directly or it
// renders as unstyled browser-default HTML, not a build error.
import '../styles/coach-design-system.css'

// P37d — Today core layout & state adapter. Replaces the previous Health
// Signal Score / Journey Progress / Score Breakdown framing (see
// output/p37a-.../p37c-.../p37d-...-2026-09-20.md for the full contract
// review and rationale). The page itself only renders a view model built by
// buildTodayViewModel() (src/lib/todayViewModel.js) — all state selection
// and copy assembly lives there, kept pure and dependency-free.
const TODAY_COPY = {
  en: {
    pageTitle: 'Today',
    firstRun: {
      title: 'Let’s start with what matters to you',
      body: 'Share what has been on your mind to add context before your first report.',
      primary: 'Start symptom check',
      secondary: 'I have lab results to upload',
    },
    labsIntent: {
      title: 'Add your lab results to get started',
      body: 'Upload your results, or enter values manually, to begin your first report.',
      primary: 'Upload lab results',
      secondary: 'Add symptom context',
    },
    readyNoPlan: {
      title: 'Your latest report is ready to review',
      body: 'Review the main observations, what is still uncertain, and the next steps in your report.',
    },
    readyWithPlan: {
      title: 'Your next steps are in your plan',
      body: 'Review the suggested actions and any questions to discuss with a doctor.',
    },
    cta: {
      results: 'View results',
      plan: 'Open my plan',
      history: 'All reports',
      upload: 'Upload new results',
    },
    source: {
      report: (date) => `Based on your report from ${date}`,
      unavailable: 'Report date unavailable',
    },
    documents: {
      reportLine: (date) => `Report from ${date}`,
      reportLineUnavailable: 'Report date unavailable',
      upgradeNote: 'Viewing your plan requires an active subscription. Explore options for adding future reports.',
    },
    safety: {
      sourceQuestionnaire: 'Source: your symptom check',
    },
    reportSafety: {
      heading: (level) => level === 'urgent'
        ? 'Your report includes a recommendation for prompt medical review'
        : 'Your report includes a recommendation to speak with a doctor',
      sourceLabel: 'Source: your report',
    },
    changes: {
      title: 'Since your previous report',
      cta: 'View changes',
      statusLabels: {
        progressStrengthened: 'Stronger signal than last time',
        progressWeakened: 'Weaker signal than last time',
        progressNew: 'New since last time',
        progressResolved: 'No longer detected — improved or resolved',
        progressStable: 'Unchanged since last time',
      },
      silentSignal: (name) => `${name} — in range, but a shift from your typical level.`,
    },
    clarity: {
      title: 'What could make this clearer',
      cta: 'See why this matters',
      genericTitle: 'Additional context',
    },
    returnSection: {
      title: 'When to come back',
      checkpoint: (marker, timing) => `For ${marker}, your plan notes: ${timing}`,
      noDate: 'Your plan does not include a repeat-test date yet.',
    },
    error: {
      summaryTitle: 'We couldn’t load your overview',
      summaryBody: 'Your account is safe. Please try again.',
      retry: 'Try again',
      reportStatusTitle: 'Your report details are temporarily unavailable',
      reportStatusBody: 'You can still open your report history or upload new results.',
      resultsSectionsUnavailable: 'We couldn’t load additional detail for this report right now. You can still view your full results.',
    },
  },
  uk: {
    pageTitle: 'Сьогодні',
    firstRun: {
      title: 'Почнімо з того, що для вас важливо',
      body: 'Опишіть, що вас турбує, щоб додати контекст перед першим звітом.',
      primary: 'Почати перевірку симптомів',
      secondary: 'У мене вже є результати аналізів',
    },
    labsIntent: {
      title: 'Додайте результати аналізів, щоб почати',
      body: 'Завантажте результати або введіть значення вручну, щоб отримати перший звіт.',
      primary: 'Завантажити аналізи',
      secondary: 'Додати контекст симптомів',
    },
    readyNoPlan: {
      title: 'Ваш останній звіт готовий до перегляду',
      body: 'Перегляньте основні спостереження, що ще залишається невизначеним, і наступні кроки у звіті.',
    },
    readyWithPlan: {
      title: 'Ваші наступні кроки — у плані дій',
      body: 'Перегляньте рекомендовані дії та питання, які варто обговорити з лікарем.',
    },
    cta: {
      results: 'Переглянути результати',
      plan: 'Відкрити план дій',
      history: 'Усі звіти',
      upload: 'Завантажити нові результати',
    },
    source: {
      report: (date) => `На основі звіту від ${date}`,
      unavailable: 'Дата звіту недоступна',
    },
    documents: {
      reportLine: (date) => `Звіт від ${date}`,
      reportLineUnavailable: 'Дата звіту недоступна',
      upgradeNote: 'Перегляд плану вимагає активної підписки. Дізнайтеся про варіанти для майбутніх звітів.',
    },
    safety: {
      sourceQuestionnaire: 'Джерело: ваша перевірка симптомів',
    },
    reportSafety: {
      heading: (level) => level === 'urgent'
        ? 'Ваш звіт містить рекомендацію щодо термінового медичного огляду'
        : 'Ваш звіт містить рекомендацію обговорити результати з лікарем',
      sourceLabel: 'Джерело: ваш звіт',
    },
    changes: {
      title: 'З часу попереднього звіту',
      cta: 'Переглянути зміни',
      statusLabels: {
        progressStrengthened: 'Сигнал сильніший, ніж минулого разу',
        progressWeakened: 'Сигнал слабший, ніж минулого разу',
        progressNew: 'Нове з минулого разу',
        progressResolved: 'Більше не виявлено — покращення або вирішення',
        progressStable: 'Без змін з минулого разу',
      },
      silentSignal: (name) => `${name} — у межах референсу, але є зміна відносно вашого типового рівня.`,
    },
    clarity: {
      title: 'Що могло б це прояснити',
      cta: 'Дізнатися, чому це важливо',
      genericTitle: 'Додатковий контекст',
    },
    returnSection: {
      title: 'Коли повернутися',
      checkpoint: (marker, timing) => `Для показника «${marker}» ваш план зазначає: ${timing}`,
      noDate: 'У вашому плані ще немає дати повторного аналізу.',
    },
    error: {
      summaryTitle: 'Не вдалося завантажити огляд',
      summaryBody: 'Ваш акаунт у безпеці. Спробуйте ще раз.',
      retry: 'Спробувати ще раз',
      reportStatusTitle: 'Деталі звіту тимчасово недоступні',
      reportStatusBody: 'Ви все ще можете відкрити історію звітів або завантажити нові результати.',
      resultsSectionsUnavailable: 'Наразі не вдалося завантажити додаткові деталі цього звіту. Ви все ще можете переглянути повний звіт.',
    },
  },
}

// Same closed, code-owned 3-string enum Questionnaire.jsx's urgencyGuidance()
// produces (or the local "no red flags" fallback) — unchanged from the
// pre-P37d dashboard. Kept exactly as-is: P37d preserves this signal, it
// does not reinterpret it. Keep in sync with Questionnaire.jsx if that copy
// changes.
function classifySafetyTone(text) {
  const t = String(text || '')
  if (t.includes('Multiple') || t.includes('кілька')) return 'critical'
  if (t.includes('Some answers') || t.includes('Деякі відповіді')) return 'warning'
  return 'success'
}

const SAFETY_TONE_STYLES = {
  warning: { bg: '#fef3c7', border: 'rgba(245,158,11,.3)', color: '#92400e' },
  critical: { bg: '#fee2e2', border: 'rgba(239,68,68,.28)', color: '#b91c1c' },
}

export default function UserDashboard() {
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useDashboardSummary()
  const { data: questionnaireSession } = useQuestionnaireSession()
  const { data: profileData } = useProfile()
  const { isPremium } = useSubscription()
  const isUk = isUkrainianLocale()
  const copy = isUk ? TODAY_COPY.uk : TODAY_COPY.en

  const summary = data || {}
  const onboardingGoals = Array.isArray(profileData?.profile?.goals) ? profileData.profile.goals : []
  const isLabsReadyIntent = onboardingGoals.includes('intent:labs')

  const sessionContext = questionnaireSession?.session_context || questionnaireSession?.session?.session_metadata || {}
  const concern = sessionContext?.active_concern || ''
  const concernSummary = sessionContext?.summary || null
  const hasConcern = Boolean(concern)
  const safetyText = concernSummary?.urgency || null
  const safetyTone = classifySafetyTone(safetyText)

  // P37e: fetch report details ONLY once a ready report's upload_id is
  // confirmed via today_contract -- never speculatively, never derived from
  // stats.total_uploads/active_program/latest_upload/latest_lab_result (see
  // P37a/P37c). useReportDetails()'s own `enabled` guard is the actual
  // no-speculative-fetch mechanism; this is just the id source.
  const readyUploadId = summary?.today_contract?.latest_ready_report_status === 'ready'
    ? summary?.today_contract?.latest_ready_report?.upload_id
    : undefined
  const { data: reportDetails, isLoading: reportDetailsLoading, error: reportDetailsError } = useReportDetails(readyUploadId)

  // planAccessAllowed mirrors backend require_active_subscription's real
  // gate on GET /protocol/:uploadId (is_paid OR non-end-user role) -- NOT
  // the advanced_protocol export flag, which is a separate, narrower gate.
  // See P37a/P37c for why those two must not be conflated.
  const viewModel = buildTodayViewModel({
    summaryLoading: isLoading,
    summaryError: error,
    todayContract: summary.today_contract,
    isLabsReadyIntent,
    safetyText,
    safetyTone,
    hasConcern,
    planAccessAllowed: isPremium,
    copy,
    isUk,
    reportDetailsLoading: Boolean(readyUploadId) && reportDetailsLoading,
    reportDetailsError,
    reportDetails: readyUploadId ? reportDetails : null,
  })

  if (viewModel.status === 'loading') {
    return <div className="coach-shell"><CoachSkeleton rows={3} /></div>
  }

  return (
    <div className="coach-shell coach-grid">
      <div className="flex items-start justify-between gap-3">
        <p className="coach-eyebrow">{copy.pageTitle}</p>
        {viewModel.documents && (
          <button
            type="button"
            onClick={() => navigate(viewModel.documents.uploadTo)}
            className="text-sm font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap"
          >
            {copy.cta.upload}
          </button>
        )}
      </div>
      {viewModel.sourceLine && <p className="text-sm text-slate-500 -mt-2">{viewModel.sourceLine}</p>}

      {/* Report-scoped safety (P37e, from GET /results/:uploadId) and
          questionnaire safety (existing, unchanged) are rendered as two
          separate banners when both are present -- never merged, never
          deduplicated by domain guesswork, both above the hero so neither
          can be visually buried below a lower-priority CTA. */}
      {viewModel.returning?.reportSafety && (
        <div
          role="note"
          className="rounded-2xl border px-4 py-3.5"
          style={{
            background: SAFETY_TONE_STYLES[viewModel.returning.reportSafety.tone]?.bg,
            borderColor: SAFETY_TONE_STYLES[viewModel.returning.reportSafety.tone]?.border,
          }}
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SAFETY_TONE_STYLES[viewModel.returning.reportSafety.tone]?.color }} />
            <div>
              <p className="text-sm font-semibold leading-5" style={{ color: SAFETY_TONE_STYLES[viewModel.returning.reportSafety.tone]?.color }}>
                {viewModel.returning.reportSafety.text}
              </p>
              {viewModel.returning.reportSafety.timing && (
                <p className="mt-1 text-sm leading-5" style={{ color: SAFETY_TONE_STYLES[viewModel.returning.reportSafety.tone]?.color }}>
                  {viewModel.returning.reportSafety.timing}
                </p>
              )}
              <button
                type="button"
                onClick={() => navigate(viewModel.returning.reportSafety.to)}
                className="mt-1.5 block text-sm font-bold underline"
                style={{ color: SAFETY_TONE_STYLES[viewModel.returning.reportSafety.tone]?.color }}
              >
                {copy.cta.results}
              </button>
              <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide opacity-70" style={{ color: SAFETY_TONE_STYLES[viewModel.returning.reportSafety.tone]?.color }}>
                {viewModel.returning.reportSafety.sourceLabel}
              </p>
            </div>
          </div>
        </div>
      )}

      {viewModel.safety && (
        <div
          role="note"
          className="rounded-2xl border px-4 py-3.5"
          style={{
            background: SAFETY_TONE_STYLES[viewModel.safety.tone]?.bg,
            borderColor: SAFETY_TONE_STYLES[viewModel.safety.tone]?.border,
          }}
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SAFETY_TONE_STYLES[viewModel.safety.tone]?.color }} />
            <div>
              <p className="text-sm font-semibold leading-5" style={{ color: SAFETY_TONE_STYLES[viewModel.safety.tone]?.color }}>
                {viewModel.safety.text}
              </p>
              {viewModel.safety.sourceLabel && (
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide opacity-70" style={{ color: SAFETY_TONE_STYLES[viewModel.safety.tone]?.color }}>
                  {viewModel.safety.sourceLabel}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {viewModel.status === 'summary_error' && (
        <EmptyCoachState
          title={viewModel.hero.title}
          body={viewModel.hero.body}
          actionLabel={viewModel.hero.primaryLabel}
          onAction={() => refetch()}
        />
      )}

      {viewModel.status !== 'summary_error' && viewModel.hero && (
        <section className="coach-hero">
          <h1 className="coach-title-xl max-w-2xl">{viewModel.hero.title}</h1>
          <p className="coach-body mt-4 max-w-2xl">{viewModel.hero.body}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CoachButton onClick={() => navigate(viewModel.hero.primaryTo)} trailingIcon={ArrowRight}>
              {viewModel.hero.primaryLabel}
            </CoachButton>
            {viewModel.hero.secondaryLabel && (
              <button
                type="button"
                onClick={() => navigate(viewModel.hero.secondaryTo)}
                className="text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                {viewModel.hero.secondaryLabel} &rarr;
              </button>
            )}
          </div>
        </section>
      )}

      {/* P37e returning-user sections. Loading/error only affect these two
          sections -- the P37d core hero/documents above are unaffected, so
          a slow or failed /results/:uploadId fetch never collapses the
          whole page (see delivery report §3). */}
      {viewModel.returning?.status === 'loading' && (
        <CoachCard className="p-5 sm:p-6">
          <CoachSkeleton rows={2} />
        </CoachCard>
      )}

      {viewModel.returning?.status === 'error' && (
        <CoachCard className="p-4">
          <p className="text-sm text-slate-500">{viewModel.returning.limitationText}</p>
        </CoachCard>
      )}

      {(viewModel.returning?.changes || viewModel.returning?.returnCheckpoint) && (
        <div className="coach-grid coach-grid--2">
          {viewModel.returning.changes && (
            <CoachCard className="p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                {copy.changes.title}
              </div>
              <div className="space-y-2">
                {viewModel.returning.changes.items.map((text, index) => (
                  <p key={index} className="text-sm leading-6 text-slate-700">{text}</p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate(viewModel.returning.changes.to)}
                className="mt-3 text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                {copy.changes.cta} &rarr;
              </button>
            </CoachCard>
          )}

          {viewModel.returning.returnCheckpoint && (
            <CoachCard className="p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
                <RefreshCw className="h-4 w-4 text-emerald-600" />
                {copy.returnSection.title}
              </div>
              <p className="text-sm leading-6 text-slate-700">{viewModel.returning.returnCheckpoint.text}</p>
              {viewModel.returning.returnCheckpoint.to && (
                <button
                  type="button"
                  onClick={() => navigate(viewModel.returning.returnCheckpoint.to)}
                  className="mt-3 text-sm font-semibold text-teal-700 hover:text-teal-900"
                >
                  {/* P37f fix: label must match the actual destination -- a
                      gated/no-plan user's checkpoint correctly links to
                      resultsTo (never the protected plan route), but the
                      button previously always said "Open my plan" even
                      then, misdescribing where the click goes. */}
                  {viewModel.returning.returnCheckpoint.ctaLabel === 'plan' ? copy.cta.plan : copy.cta.results} &rarr;
                </button>
              )}
            </CoachCard>
          )}
        </div>
      )}

      {viewModel.returning?.clarity && (
        <CoachCard className="p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
            <HelpCircle className="h-4 w-4 text-emerald-600" />
            {copy.clarity.title}
          </div>
          <div className="space-y-3">
            {viewModel.returning.clarity.items.map((item, index) => (
              <div key={index}>
                <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                {item.body && <p className="mt-0.5 text-sm leading-6 text-slate-600">{item.body}</p>}
                <button
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="mt-0.5 text-sm font-semibold text-teal-700 hover:text-teal-900"
                >
                  {copy.clarity.cta} &rarr;
                </button>
              </div>
            ))}
          </div>
        </CoachCard>
      )}

      {viewModel.documents && (
        <CoachCard className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-base font-extrabold text-slate-950">
            <Stethoscope className="h-4 w-4 text-emerald-600" />
            {viewModel.documents.reportLine}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <button type="button" onClick={() => navigate(viewModel.documents.resultsTo)} className="font-semibold text-teal-700 hover:text-teal-900">
              {copy.cta.results}
            </button>
            {viewModel.documents.planTo && (
              <>
                <span className="text-slate-300">&middot;</span>
                <button type="button" onClick={() => navigate(viewModel.documents.planTo)} className="font-semibold text-teal-700 hover:text-teal-900">
                  {copy.cta.plan}
                </button>
              </>
            )}
            {viewModel.documents.planLocked && (
              <>
                <span className="text-slate-300">&middot;</span>
                <span className="font-semibold text-slate-400" title={viewModel.documents.upgradeNote}>{copy.cta.plan}</span>
              </>
            )}
            <span className="text-slate-300">&middot;</span>
            <button type="button" onClick={() => navigate(viewModel.documents.historyTo)} className="font-semibold text-teal-700 hover:text-teal-900">
              {copy.cta.history}
            </button>
          </div>
          {viewModel.documents.upgradeNote && (
            <p className="mt-3 text-xs text-slate-500">{viewModel.documents.upgradeNote}</p>
          )}
        </CoachCard>
      )}
    </div>
  )
}
