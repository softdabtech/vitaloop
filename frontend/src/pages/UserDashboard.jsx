import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Beaker, CalendarCheck2, CheckCircle2, ClipboardList, HelpCircle, MessageCircle, Route, ShieldAlert, Sparkles, Stethoscope, UploadCloud } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useDashboardSummary, useQuestionnaireSession } from '../hooks/useQueries.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { CoachBadge, CoachButton, CoachCard, CoachProgress, CoachSkeleton, CoachTooltip, EmptyCoachState, InsightCard, KPIBlock } from '../components/coach/CoachUI.jsx'
import { HEALTH_LOOP_STAGES, getHealthLoopStageIndex } from '../lib/cabinetV511.js'
import { isUkrainianLocale } from '../lib/locale.js'
// coach-shell/coach-card/etc. (CoachUI.jsx) have no built-in styles of their
// own — every rule lives in this stylesheet. Vite code-splits CSS per lazy
// route chunk, so each page using CoachUI must import it directly or it
// renders as unstyled browser-default HTML, not a build error.
import '../styles/coach-design-system.css'

const DASHBOARD_COPY = {
  en: {
    steps: [
      { label: 'Tell us how you feel', helper: 'Start with the symptom that matters most.', path: '/questionnaire', icon: Stethoscope },
      { label: 'Prepare your lab plan', helper: 'See which tests matter for your concern.', path: '/lab-plan', icon: ClipboardList },
      { label: 'Upload your labs', helper: 'Add PDF, images, spreadsheets, or manual values.', path: '/upload', icon: UploadCloud },
      { label: 'Understand results', helper: 'See what may connect to your symptoms.', path: '/lab-results', icon: Beaker },
      { label: 'Follow your plan', helper: 'Turn findings into practical next steps.', path: '/assignments', icon: Route },
      { label: 'Track progress', helper: 'Check in and compare changes over time.', path: '/progress', icon: CalendarCheck2 },
    ],
    nextBestStep: 'Your Next Best Step',
    whyThisStep: 'Why this step?',
    nextAction: 'Next Action',
    etaTooltip: 'Estimated time is based on the current step, not a medical risk score.',
    journeyProgress: 'Journey progress',
    premiumNotice: 'Premium unlocks deeper protocols, check-ins, and trend guidance when you reach those steps.',
    viewPlans: 'View plans',
    healthJourney: 'Health Journey',
    journeyTitle: 'From symptom chaos to a clear loop',
    current: 'Current',
    whyMatters: 'Why This Matters',
    whyTitle: 'VITALOOP explains what is happening, why it matters, and what to do next.',
    whatHappening: 'What is happening?',
    noConcern: 'Your symptom focus has not been set yet.',
    updateSymptoms: 'Update symptoms',
    setConcern: 'Set concern',
    whyDoesItMatter: 'Why does it matter?',
    symptomsContext: 'Symptoms are connected to biomarker patterns, safety context, and your profile. This keeps the report focused instead of generic.',
    whatNext: 'What should I do next?',
    symptomContext: 'Symptom context',
    labContext: 'Lab context',
    progressTracking: 'Progress tracking',
    ready: 'Ready',
    missing: 'Missing',
    uploaded: 'Uploaded',
    notUploaded: 'Not uploaded',
    active: 'Active',
    notStarted: 'Not started',
    startConcern: 'Start with the main concern.',
    resultsAvailable: 'Results are available for interpretation.',
    addLabs: 'Add labs when you have them.',
    checkinsHelp: 'Check-ins show whether actions are helping.',
    recentContext: 'Recent Context',
    keepMoving: 'Keep the loop moving',
    next: 'Next',
    noLoadTitle: 'We could not load your dashboard',
    noLoadBody: 'Your account is safe. Try refreshing, or open your journey to continue from the last saved step.',
    openJourney: 'Open journey',
    healthSignalScore: 'Health Signal Score',
    overallNotCalculated: 'Overall score not yet calculated — upload a lab and complete a check-in to generate it.',
    overallLabel: (v) => `Overall: ${v}%`,
    notYetCalculated: 'Not yet calculated',
    safety: 'Safety',
    noRedFlags: 'No urgent red flags reported.',
    scoreLabels: {
      symptom: 'Symptoms',
      biomarker: 'Biomarkers',
      adherence: 'Check-in adherence',
      profile: 'Profile completeness',
    },
    actions: {
      startSymptom: 'Start Symptom Check',
      openLabPlan: 'Open Lab Plan',
      uploadResults: 'Upload Results',
      openActionPlan: 'Open Action Plan',
      completeCheckin: 'Complete Check-in',
      reviewProgress: 'Review Progress',
    },
    nextActions: {
      symptomWhy: 'Your symptoms are the starting point. They tell VITALOOP which biomarkers and next questions matter first.',
      symptomOutcome: 'You will leave with a clearer concern and a focused lab direction.',
      labWhy: 'A focused lab plan prevents random testing and connects your symptoms to the markers worth checking.',
      labOutcome: 'You will see core, recommended, and optional tests.',
      uploadWhy: 'Your lab values help explain what may be contributing to the symptoms you selected.',
      uploadOutcome: 'You will get a plain-language summary and priority findings.',
      protocolWhy: 'The report becomes useful when it turns into what to do today, this week, and before retesting.',
      protocolOutcome: 'You will get actions, doctor questions, and retest timing.',
      checkinWhy: 'Progress is measured by symptom response, not only by lab values.',
      checkinOutcome: 'You will track what improved, what stayed the same, and what needs adjustment.',
      progressWhy: 'Your loop is active. Review trends and plan the next retest window.',
      progressOutcome: 'You will see changes over time and what to watch next.',
    },
    recent: {
      concernReady: 'Main concern is set',
      concernMissing: 'No main concern yet',
      concernMissingBody: 'Tell VITALOOP what feels off first.',
      review: 'Review',
      start: 'Start',
      uploadReady: 'Latest lab upload is ready',
      uploadMissing: 'No lab upload yet',
      uploadReadyBody: 'Your latest results are available for interpretation.',
      uploadMissingBody: 'Upload PDF, images, or enter values manually.',
      openResults: 'Open results',
      upload: 'Upload',
      actionsReady: 'Action items available',
      actionsMissing: 'No action plan yet',
      waiting: (count) => `${count} action item${count === 1 ? '' : 's'} are waiting.`,
      generate: 'Generate a protocol after your results.',
      openPlan: 'Open plan',
      seeJourney: 'See journey',
    },
  },
  uk: {
    steps: [
      { label: 'Опишіть самопочуття', helper: 'Почніть із симптому, який турбує найбільше.', path: '/questionnaire', icon: Stethoscope },
      { label: 'Підготуйте план аналізів', helper: 'Подивіться, які перевірки мають сенс для вашої скарги.', path: '/lab-plan', icon: ClipboardList },
      { label: 'Завантажте аналізи', helper: 'Додайте PDF, фото, таблицю або введіть показники вручну.', path: '/upload', icon: UploadCloud },
      { label: 'Зрозумійте результати', helper: 'Побачте, що може бути повʼязано з вашими симптомами.', path: '/lab-results', icon: Beaker },
      { label: 'Виконуйте план', helper: 'Перетворіть висновки на практичні кроки.', path: '/assignments', icon: Route },
      { label: 'Відстежуйте прогрес', helper: 'Проходьте чек-іни й порівнюйте зміни з часом.', path: '/progress', icon: CalendarCheck2 },
    ],
    nextBestStep: 'Ваш наступний крок',
    whyThisStep: 'Чому саме цей крок?',
    nextAction: 'Наступна дія',
    etaTooltip: 'Оцінка часу стосується поточного кроку, а не медичного ризику.',
    journeyProgress: 'Прогрес шляху',
    premiumNotice: 'Premium відкриває глибші протоколи, чек-іни та динаміку, коли ви доходите до цих етапів.',
    viewPlans: 'Переглянути тарифи',
    healthJourney: 'Шлях здоровʼя',
    journeyTitle: 'Від хаосу симптомів до зрозумілого циклу',
    current: 'Поточний етап',
    whyMatters: 'Чому це важливо',
    whyTitle: 'VITALOOP пояснює, що відбувається, чому це важливо і що робити далі.',
    whatHappening: 'Що відбувається?',
    noConcern: 'Фокус симптомів ще не задано.',
    updateSymptoms: 'Оновити симптоми',
    setConcern: 'Задати скаргу',
    whyDoesItMatter: 'Чому це має значення?',
    symptomsContext: 'Симптоми повʼязуються з патернами біомаркерів, профілем і контекстом безпеки. Так звіт лишається конкретним, а не загальним.',
    whatNext: 'Що робити далі?',
    symptomContext: 'Контекст симптомів',
    labContext: 'Контекст аналізів',
    progressTracking: 'Відстеження прогресу',
    ready: 'Готово',
    missing: 'Не вистачає',
    uploaded: 'Завантажено',
    notUploaded: 'Не завантажено',
    active: 'Активно',
    notStarted: 'Не почато',
    startConcern: 'Почніть із головної скарги.',
    resultsAvailable: 'Результати доступні для інтерпретації.',
    addLabs: 'Додайте аналізи, коли вони будуть.',
    checkinsHelp: 'Чек-іни показують, чи допомагають дії.',
    recentContext: 'Останній контекст',
    keepMoving: 'Продовжуйте цикл',
    next: 'Далі',
    noLoadTitle: 'Не вдалося завантажити кабінет',
    noLoadBody: 'Ваш акаунт у безпеці. Оновіть сторінку або відкрийте шлях, щоб продовжити з останнього збереженого кроку.',
    openJourney: 'Відкрити шлях',
    healthSignalScore: 'Індекс здоровʼя',
    overallNotCalculated: 'Загальний бал ще не розраховано — завантажте аналіз і пройдіть чек-ін, щоб отримати його.',
    overallLabel: (v) => `Загалом: ${v}%`,
    notYetCalculated: 'Ще не розраховано',
    safety: 'Безпека',
    noRedFlags: 'Термінових тривожних сигналів не повідомлено.',
    scoreLabels: {
      symptom: 'Симптоми',
      biomarker: 'Біомаркери',
      adherence: 'Дотримання чек-інів',
      profile: 'Повнота профілю',
    },
    actions: {
      startSymptom: 'Почати перевірку симптомів',
      openLabPlan: 'Відкрити план аналізів',
      uploadResults: 'Завантажити результати',
      openActionPlan: 'Відкрити план дій',
      completeCheckin: 'Пройти чек-ін',
      reviewProgress: 'Переглянути прогрес',
    },
    nextActions: {
      symptomWhy: 'Симптоми — це стартова точка. Вони підказують VITALOOP, які біомаркери й питання важливі першими.',
      symptomOutcome: 'Ви отримаєте чіткішу скаргу й сфокусований напрям аналізів.',
      labWhy: 'Сфокусований план аналізів зменшує випадкові перевірки й повʼязує симптоми з потрібними маркерами.',
      labOutcome: 'Ви побачите базові, рекомендовані та додаткові перевірки.',
      uploadWhy: 'Значення аналізів допомагають пояснити, що може впливати на вибрані симптоми.',
      uploadOutcome: 'Ви отримаєте зрозумілий підсумок і пріоритетні знахідки.',
      protocolWhy: 'Звіт стає корисним, коли перетворюється на дії на сьогодні, тиждень і до повторної перевірки.',
      protocolOutcome: 'Ви отримаєте дії, питання до лікаря і терміни повторної перевірки.',
      checkinWhy: 'Прогрес вимірюється не лише аналізами, а й реакцією симптомів.',
      checkinOutcome: 'Ви зафіксуєте, що покращилось, що не змінилось і що треба скоригувати.',
      progressWhy: 'Ваш цикл активний. Перегляньте динаміку й заплануйте наступне вікно повторної перевірки.',
      progressOutcome: 'Ви побачите зміни з часом і що варто відстежувати далі.',
    },
    recent: {
      concernReady: 'Головну скаргу задано',
      concernMissing: 'Головної скарги ще немає',
      concernMissingBody: 'Спочатку опишіть, що саме турбує.',
      review: 'Переглянути',
      start: 'Почати',
      uploadReady: 'Останнє завантаження готове',
      uploadMissing: 'Аналізів ще немає',
      uploadReadyBody: 'Останні результати доступні для інтерпретації.',
      uploadMissingBody: 'Завантажте PDF, фото або введіть значення вручну.',
      openResults: 'Відкрити результати',
      upload: 'Завантажити',
      actionsReady: 'Є кроки плану дій',
      actionsMissing: 'Плану дій ще немає',
      waiting: (count) => `${count} ${count === 1 ? 'крок очікує' : 'кроків очікують'}.`,
      generate: 'Згенеруйте протокол після результатів.',
      openPlan: 'Відкрити план',
      seeJourney: 'Подивитись шлях',
    },
  },
}

function getStageEta(stage) {
  const byStage = {
    Concern: '3-5 min',
    Questions: '4-6 min',
    'Lab Plan': '2-4 min',
    Results: '5-8 min',
    Protocol: '4-6 min',
    'Check-in': '2-3 min',
    Retest: '3-4 min',
  }
  return byStage[stage] || '3-5 min'
}

function mapTechnicalStageToHumanIndex(stageIndex) {
  if (stageIndex <= 1) return 0
  if (stageIndex === 2) return 1
  if (stageIndex === 3) return 2
  if (stageIndex === 4) return 3
  if (stageIndex === 5) return 4
  return 5
}

function JourneyCard({ step, index, active, done, onClick }) {
  const Icon = step.icon
  return (
    <button type="button" onClick={onClick} className={`coach-journey__step text-left ${active ? 'coach-journey__step--active' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="coach-journey__number">{done ? <CheckCircle2 className="h-4 w-4" /> : String(index + 1).padStart(2, '0')}</span>
        <Icon className={`h-5 w-5 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
      </div>
      <h3>{step.label}</h3>
      <p>{step.helper}</p>
    </button>
  )
}

// Stage 2F: only renders a percentage bar when `value` is an actual backend
// number (not undefined/null) — a missing real value shows truthful "Not yet
// calculated" text instead of silently defaulting to a fabricated number.
// Kept as a dedicated component (rather than reusing CoachProgress, which
// defaults a missing value to 0%) specifically to preserve this distinction
// — CoachProgress cannot tell "genuinely 0" apart from "not calculated yet".
function CoachScoreRow({ label, value, notYetCalculated }) {
  if (value === null || value === undefined) {
    return (
      <div className="coach-progress" aria-label={label}>
        <div className="coach-progress__header">
          <span>{label}</span>
          <span className="text-slate-400">{notYetCalculated}</span>
        </div>
        <div className="coach-progress__track" />
      </div>
    )
  }
  const safeValue = Math.max(0, Math.min(100, Number(value)))
  return <CoachProgress value={safeValue} label={label} />
}

export default function UserDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, isLoading, error } = useDashboardSummary()
  const { data: questionnaireSession } = useQuestionnaireSession()
  const { isPremium } = useSubscription()
  const isUk = isUkrainianLocale()
  const copy = isUk ? DASHBOARD_COPY.uk : DASHBOARD_COPY.en
  const journeySteps = copy.steps

  const summary = data || {}
  const stats = summary?.stats || {}
  const latestCheckin = summary?.blocks?.latest_checkin || null
  // Stage 2E: a check-in must be "current" based on real elapsed time, not
  // just the presence of any historical check-in ever — otherwise the very
  // first check-in permanently satisfies this forever, and the loop never
  // asks for one again. week_start mirrors the backend's 7-day interval
  // (dashboard.py CHECKIN_DUE_INTERVAL_DAYS). origin/main's dashboard used a
  // plain Boolean(latestCheckin) here — that regresses this invariant, so it
  // was NOT ported; this recency check was kept instead.
  const CHECKIN_DUE_INTERVAL_DAYS = 7
  const isCheckinCurrent = (() => {
    const reference = latestCheckin?.week_start || latestCheckin?.created_at
    if (!reference) return false
    const days = (Date.now() - new Date(reference).getTime()) / 86400000
    return days >= 0 && days < CHECKIN_DUE_INTERVAL_DAYS
  })()
  const latestUpload = summary?.blocks?.latest_upload || null
  const assignments = Array.isArray(summary?.blocks?.assignments) ? summary.blocks.assignments : []
  const sessionContext = questionnaireSession?.session_context || questionnaireSession?.session?.session_metadata || {}
  const concern = sessionContext?.active_concern || ''
  const concernSummary = sessionContext?.summary || null

  const hasConcern = Boolean(concern)
  const hasQuestions = Boolean(concernSummary?.readiness)
  const hasLabPlan = Boolean(concernSummary?.readiness && concernSummary.readiness >= 40)
  const hasResults = Number(stats.total_uploads || 0) > 0
  const hasProtocol = Boolean(stats?.active_program && String(stats.active_program).toLowerCase() !== 'not started')
  const hasCheckin = isCheckinCurrent

  const stageIndex = getHealthLoopStageIndex({ hasConcern, hasQuestions, hasLabPlan, hasResults, hasProtocol, hasCheckin })
  const humanStageIndex = mapTechnicalStageToHumanIndex(stageIndex)
  const activeStage = HEALTH_LOOP_STAGES[stageIndex]
  const stageEta = getStageEta(activeStage)

  // Stage 2F: every value below comes directly from a real, traceable
  // backend calculation (calculate_health_score() -> health_scores table,
  // exposed via stats.health_score_components) — none is invented in this
  // component. See the Stage 2F audit report for the full before/after
  // inventory of what this replaced: biomarkerScore (flat 70/25 constant),
  // safetyScore (binary substring match), symptomScore (frontend-invented
  // formula over a client-computed-then-stored questionnaire value),
  // profileScore (read a field that does not exist in the API response and
  // always fell back to a hardcoded 55). origin/main's dashboard had no
  // Health Score section at all — this was ported forward from current
  // production, restyled onto CoachCard/CoachProgress, not dropped.
  const healthScoreComponents = stats?.health_score_components || {}
  const symptomScore = healthScoreComponents.symptom
  const biomarkerScore = healthScoreComponents.biomarker
  const adherenceScore = healthScoreComponents.adherence
  const profileScore = summary?.profile?.onboarding?.completion_pct ?? null

  const nextAction = useMemo(() => {
    if (!hasConcern) {
      return {
        label: copy.actions.startSymptom,
        path: '/questionnaire',
        why: copy.nextActions.symptomWhy,
        outcome: copy.nextActions.symptomOutcome,
      }
    }
    if (!hasLabPlan) {
      return {
        label: copy.actions.openLabPlan,
        path: '/lab-plan',
        why: copy.nextActions.labWhy,
        outcome: copy.nextActions.labOutcome,
      }
    }
    if (!hasResults) {
      return {
        label: copy.actions.uploadResults,
        path: '/upload',
        why: copy.nextActions.uploadWhy,
        outcome: copy.nextActions.uploadOutcome,
      }
    }
    if (!hasProtocol) {
      return {
        label: copy.actions.openActionPlan,
        path: latestUpload?.id ? `/protocol/${latestUpload.id}` : '/assignments',
        why: copy.nextActions.protocolWhy,
        outcome: copy.nextActions.protocolOutcome,
      }
    }
    if (!hasCheckin) {
      return {
        label: copy.actions.completeCheckin,
        path: '/check-ins',
        why: copy.nextActions.checkinWhy,
        outcome: copy.nextActions.checkinOutcome,
      }
    }
    return {
      label: copy.actions.reviewProgress,
      path: '/progress',
      why: copy.nextActions.progressWhy,
      outcome: copy.nextActions.progressOutcome,
    }
  }, [copy, hasConcern, hasLabPlan, hasResults, hasProtocol, hasCheckin, latestUpload?.id])

  const recentItems = [
    {
      title: hasConcern ? copy.recent.concernReady : copy.recent.concernMissing,
      body: hasConcern ? concern : copy.recent.concernMissingBody,
      done: hasConcern,
      action: hasConcern ? copy.recent.review : copy.recent.start,
      path: '/questionnaire',
    },
    {
      title: latestUpload ? copy.recent.uploadReady : copy.recent.uploadMissing,
      body: latestUpload ? copy.recent.uploadReadyBody : copy.recent.uploadMissingBody,
      done: Boolean(latestUpload),
      action: latestUpload ? copy.recent.openResults : copy.recent.upload,
      path: latestUpload?.id ? `/results/${latestUpload.id}` : '/upload',
    },
    {
      title: assignments.length ? copy.recent.actionsReady : copy.recent.actionsMissing,
      body: assignments.length ? copy.recent.waiting(assignments.length) : copy.recent.generate,
      done: Boolean(assignments.length),
      action: assignments.length ? copy.recent.openPlan : copy.recent.seeJourney,
      path: assignments.length ? '/assignments' : '/lab-plan',
    },
  ]

  if (isLoading) {
    return <div className="coach-shell"><CoachSkeleton rows={3} /></div>
  }

  if (error) {
    return (
      <div className="coach-shell">
        <EmptyCoachState
          title={copy.noLoadTitle}
          body={copy.noLoadBody}
          actionLabel={copy.openJourney}
          onAction={() => navigate('/questionnaire')}
        />
      </div>
    )
  }

  return (
    <div className="coach-shell coach-grid">
      <section className="coach-hero">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <p className="coach-eyebrow">{copy.nextBestStep}</p>
            <h1 className="coach-title-xl">{nextAction.label}{user?.email ? `, ${user.email.split('@')[0]}` : ''}</h1>
            <p className="coach-body mt-4 max-w-2xl">{nextAction.why}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <CoachButton onClick={() => navigate(nextAction.path)} trailingIcon={ArrowRight}>
                {nextAction.label}
              </CoachButton>
              <CoachButton
                variant="secondary"
                icon={HelpCircle}
                onClick={() => document.getElementById('why-this-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                {copy.whyThisStep}
              </CoachButton>
            </div>
          </div>

          <CoachCard className="p-5" tone="soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="coach-eyebrow">{copy.nextAction}</p>
                <h2 className="text-xl font-extrabold text-slate-950">{nextAction.label}</h2>
              </div>
              <CoachTooltip text={copy.etaTooltip}>
                <CoachBadge tone="primary">{stageEta}</CoachBadge>
              </CoachTooltip>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{nextAction.outcome}</p>
            <div className="mt-5">
              <CoachProgress value={Math.round(((humanStageIndex + 1) / journeySteps.length) * 100)} label={copy.journeyProgress} />
            </div>
          </CoachCard>
        </div>
      </section>

      {!isPremium && (
        <CoachCard tone="attention" className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-amber-900">{copy.premiumNotice}</p>
            <CoachButton variant="secondary" size="sm" onClick={() => navigate('/subscription')}>{copy.viewPlans}</CoachButton>
          </div>
        </CoachCard>
      )}

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2 text-lg font-extrabold text-slate-950">
          <Sparkles className="h-4 w-4 text-emerald-600" /> {copy.healthSignalScore}
        </div>
        <p className="mb-4 text-sm leading-6 text-slate-600">
          {stats?.health_score != null
            ? copy.overallLabel(Math.round(stats.health_score))
            : copy.overallNotCalculated}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <CoachScoreRow label={copy.scoreLabels.symptom} value={symptomScore} notYetCalculated={copy.notYetCalculated} />
          <CoachScoreRow label={copy.scoreLabels.biomarker} value={biomarkerScore} notYetCalculated={copy.notYetCalculated} />
          <CoachScoreRow label={copy.scoreLabels.adherence} value={adherenceScore} notYetCalculated={copy.notYetCalculated} />
          <CoachScoreRow label={copy.scoreLabels.profile} value={profileScore} notYetCalculated={copy.notYetCalculated} />
        </div>
      </CoachCard>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-2 flex items-center gap-2 text-lg font-extrabold text-slate-950">
          <ShieldAlert className="h-4 w-4 text-slate-500" /> {copy.safety}
        </div>
        <p className="text-sm leading-6 text-slate-600">{concernSummary?.urgency || copy.noRedFlags}</p>
      </CoachCard>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="coach-eyebrow">{copy.healthJourney}</p>
            <h2 className="coach-title-lg">{copy.journeyTitle}</h2>
          </div>
          <CoachBadge tone="neutral">{copy.current}: {journeySteps[humanStageIndex]?.label}</CoachBadge>
        </div>
        <div className="coach-journey">
          {journeySteps.map((step, index) => (
            <JourneyCard
              key={step.label}
              step={step}
              index={index}
              active={index === humanStageIndex}
              done={index < humanStageIndex}
              onClick={() => navigate(step.path)}
            />
          ))}
        </div>
      </CoachCard>

      <div className="coach-grid coach-grid--2">
        <CoachCard id="why-this-step" className="p-5 sm:p-6">
          <p className="coach-eyebrow">{copy.whyMatters}</p>
          <h2 className="coach-title-lg">{copy.whyTitle}</h2>
          <div className="mt-5 grid gap-4">
            <InsightCard
              icon={Sparkles}
              title={copy.whatHappening}
              body={concern ? `${isUk ? 'Поточний фокус' : 'Your current focus is'}: ${concern}.` : copy.noConcern}
              actionLabel={hasConcern ? copy.updateSymptoms : copy.setConcern}
              onAction={() => navigate('/questionnaire')}
            />
            <InsightCard
              icon={MessageCircle}
              title={copy.whyDoesItMatter}
              body={copy.symptomsContext}
            />
            <InsightCard
              icon={Route}
              title={copy.whatNext}
              body={nextAction.outcome}
              actionLabel={nextAction.label}
              onAction={() => navigate(nextAction.path)}
            />
          </div>
        </CoachCard>

        <div className="coach-grid">
          <KPIBlock
            icon={Stethoscope}
            tone={hasConcern ? 'success' : 'warning'}
            label={copy.symptomContext}
            value={hasConcern ? copy.ready : copy.missing}
            helper={hasConcern ? concern : copy.startConcern}
          />
          <KPIBlock
            icon={Beaker}
            tone={latestUpload ? 'success' : 'warning'}
            label={copy.labContext}
            value={latestUpload ? copy.uploaded : copy.notUploaded}
            helper={latestUpload ? copy.resultsAvailable : copy.addLabs}
          />
          <KPIBlock
            icon={CalendarCheck2}
            tone={hasCheckin ? 'success' : 'neutral'}
            label={copy.progressTracking}
            value={hasCheckin ? copy.active : copy.notStarted}
            helper={copy.checkinsHelp}
          />
        </div>
      </div>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="coach-eyebrow">{copy.recentContext}</p>
            <h2 className="coach-title-lg">{copy.keepMoving}</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {recentItems.map((item) => (
            <CoachCard key={item.title} className="p-4" interactive>
              <div className="mb-4 flex items-start justify-between gap-3">
                <CoachBadge tone={item.done ? 'success' : 'warning'}>{item.done ? copy.ready : copy.next}</CoachBadge>
                <button type="button" onClick={() => navigate(item.path)} className="text-sm font-extrabold text-teal-700 hover:text-teal-900">{item.action}</button>
              </div>
              <h3 className="text-lg font-extrabold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </CoachCard>
          ))}
        </div>
      </CoachCard>
    </div>
  )
}
