import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Beaker, CalendarCheck2, CheckCircle2, ClipboardList, HelpCircle, MessageCircle, Route, ShieldAlert, Sparkles, Stethoscope, UploadCloud } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useDashboardSummary, useQuestionnaireSession } from '../hooks/useQueries.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { CoachBadge, CoachButton, CoachCard, CoachProgress, CoachSkeleton, EmptyCoachState, InsightCard, KPIBlock } from '../components/coach/CoachUI.jsx'
import { getHealthLoopStageIndex } from '../lib/cabinetV511.js'
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
      // Was '/assignments' — that page shows practitioner-assigned CRM tasks,
      // not the user's own protocol, and is hidden for the current
      // self-serve product stage (see App.jsx). /lab-results lists every
      // upload; each one links to its own /protocol/:uploadId, which is
      // where "your plan" actually lives.
      { label: 'Follow your plan', helper: 'Turn findings into practical next steps.', path: '/lab-results', icon: Route },
      { label: 'Track progress', helper: 'Check in and compare changes over time.', path: '/progress', icon: CalendarCheck2 },
    ],
    nextBestStep: 'Your Next Best Step',
    whyThisStep: 'Why this step?',
    nextAction: 'Next Action',
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
    notYetCalculated: 'Not yet calculated',
    safety: 'Safety',
    noRedFlags: 'No urgent red flags reported.',
    // Stage 2G (mobile-audit follow-up): the score card used to show one flat
    // qualitative-free number. Tier labels turn "82%" into "On track" so the
    // score reads as a verdict, not a raw stat the user has to interpret.
    scoreTierGood: 'On track',
    scoreTierFair: 'Fair',
    scoreTierAttention: 'Needs attention',
    scoreBreakdown: 'Score Breakdown',
    groupClinical: 'Health Signals',
    groupEngagement: 'Engagement',
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
      { label: 'Виконуйте план', helper: 'Перетворіть висновки на практичні кроки.', path: '/lab-results', icon: Route },
      { label: 'Відстежуйте прогрес', helper: 'Проходьте чек-іни й порівнюйте зміни з часом.', path: '/progress', icon: CalendarCheck2 },
    ],
    nextBestStep: 'Ваш наступний крок',
    whyThisStep: 'Чому саме цей крок?',
    nextAction: 'Наступна дія',
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
    notYetCalculated: 'Ще не розраховано',
    safety: 'Безпека',
    noRedFlags: 'Термінових тривожних сигналів не повідомлено.',
    scoreTierGood: 'На хорошому шляху',
    scoreTierFair: 'Задовільно',
    scoreTierAttention: 'Потребує уваги',
    scoreBreakdown: 'Деталі оцінки',
    groupClinical: 'Медичні сигнали',
    groupEngagement: 'Активність',
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

function mapTechnicalStageToHumanIndex(stageIndex) {
  if (stageIndex <= 1) return 0
  if (stageIndex === 2) return 1
  if (stageIndex === 3) return 2
  if (stageIndex === 4) return 3
  if (stageIndex === 5) return 4
  return 5
}

// Journey stepper: a fixed node+connector track that shows position in the
// path regardless of how many steps exist (replaces the old .coach-journey
// card grid, which was hardcoded to a 5-column layout and orphaned any 6th
// step onto its own row — see the "00" grid mismatch bug).
function JourneyStepNode({ step, index, active, done, onClick, isFirst, isLast }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`coach-stepper__item ${active ? 'coach-stepper__item--active' : ''}`}
    >
      <div className="coach-stepper__track">
        <span className={`coach-stepper__line ${done || active ? 'coach-stepper__line--filled' : ''}`} style={isFirst ? { visibility: 'hidden' } : undefined} />
        <span className={`coach-stepper__node ${done ? 'coach-stepper__node--done' : ''} ${active ? 'coach-stepper__node--active' : ''}`}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : String(index + 1).padStart(2, '0')}
        </span>
        <span className={`coach-stepper__line ${done ? 'coach-stepper__line--filled' : ''}`} style={isLast ? { visibility: 'hidden' } : undefined} />
      </div>
      <span className="coach-stepper__label">{step.label}</span>
    </button>
  )
}

// No JourneyFocusCard here by design: the "Your Next Best Step" hero above
// already shows the current step's label, helper text, and CTA. Repeating
// that inside the Health Journey card would duplicate the same information
// twice on one screen — this block stays a pure path map (stepper only).

// Stage 2F: only renders a percentage bar when `value` is an actual backend
// number (not undefined/null) — a missing real value shows truthful "Not yet
// calculated" text instead of silently defaulting to a fabricated number.
// Kept as a dedicated component (rather than reusing CoachProgress, which
// defaults a missing value to 0%) specifically to preserve this distinction
// — CoachProgress cannot tell "genuinely 0" apart from "not calculated yet".
// Stage 2G.2: a compact SVG ring gauge for the overall score — used instead
// of a flat number so the hero status card reads as a real "verdict" widget
// rather than another stat line, and so it stays legible in a narrow column
// (unlike a side-by-side split, a ring doesn't need extra horizontal room).
function ScoreRing({ value, tone, size = 84, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  const offset = circumference * (1 - pct / 100)
  const strokeColor = {
    success: 'var(--coach-success)',
    warning: 'var(--coach-warning)',
    critical: 'var(--coach-critical)',
    neutral: '#cbd5e1',
  }[tone] || 'var(--coach-primary)'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={value != null ? `${pct}%` : undefined}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      {value != null && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 500ms ease' }}
        />
      )}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.24} fontWeight="800" fill="#0f172a">
        {value != null ? `${value}%` : '—'}
      </text>
    </svg>
  )
}

function CoachScoreRow({ label, value, tone = 'primary', notYetCalculated }) {
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
  return <CoachProgress value={safeValue} label={label} tone={tone} />
}

// Stage 2G: turns a raw 0-100 number into the same three-tier verdict
// everywhere it appears on the dashboard (score badge + progress bar color).
// Bands are a presentation choice only — not a new clinical calculation and
// not stored anywhere — so they're safe to define purely in the frontend.
function scoreTone(value) {
  if (value === null || value === undefined) return 'neutral'
  const v = Number(value)
  if (v >= 70) return 'success'
  if (v >= 40) return 'warning'
  return 'critical'
}

function scoreTierLabel(tone, copy) {
  if (tone === 'success') return copy.scoreTierGood
  if (tone === 'warning') return copy.scoreTierFair
  if (tone === 'critical') return copy.scoreTierAttention
  return copy.notYetCalculated
}

// Colors mirror .coach-badge--{success,warning,critical} in
// coach-design-system.css exactly, so the safety strip reads as the same
// "tone language" as every badge elsewhere on the page.
const SAFETY_TONE_STYLES = {
  success: { bg: '#dcfce7', border: 'rgba(34,197,94,.25)', color: '#15803d' },
  warning: { bg: '#fef3c7', border: 'rgba(245,158,11,.3)', color: '#92400e' },
  critical: { bg: '#fee2e2', border: 'rgba(239,68,68,.28)', color: '#b91c1c' },
}

// The dashboard only ever receives one of the three fixed sentences produced
// by Questionnaire.jsx's urgencyGuidance() (or the local noRedFlags fallback
// when no concern is set yet) — this is a closed, code-owned enum, not
// open-ended user text, so matching on each variant's unique keyword is safe.
// Keep these keywords in sync with Questionnaire.jsx if that copy changes.
function classifySafetyTone(text) {
  const t = String(text || '')
  if (t.includes('Multiple') || t.includes('кілька')) return 'critical'
  if (t.includes('Some answers') || t.includes('Деякі відповіді')) return 'warning'
  return 'success'
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

  // Stage 2G: computed once here so the hero status card and the breakdown
  // card below agree on the exact same numbers instead of each formatting
  // stats.health_score independently.
  const overallScore = stats?.health_score != null ? Math.round(stats.health_score) : null
  const overallTone = scoreTone(overallScore)
  const safetyText = concernSummary?.urgency || copy.noRedFlags
  const safetyTone = classifySafetyTone(safetyText)
  const journeyPct = Math.round(((humanStageIndex + 1) / journeySteps.length) * 100)

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
      // Fallback was '/assignments' (practitioner-assigned CRM tasks, hidden
      // for this product stage — see App.jsx). If somehow there's no
      // latestUpload.id yet, /lab-results is the correct, always-valid page
      // to send the user to instead.
      return {
        label: copy.actions.openActionPlan,
        path: latestUpload?.id ? `/protocol/${latestUpload.id}` : '/lab-results',
        why: copy.nextActions.protocolWhy,
        outcome: copy.nextActions.protocolOutcome,
      }
    }
    if (!hasCheckin) {
      return {
        // Structural merge: /check-ins now redirects into /questionnaire's
        // 'pulse' mode (same page, no separate check-in wizard anymore).
        label: copy.actions.completeCheckin,
        path: '/questionnaire',
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
      // `assignments` (blocks.assignments from /dashboard/summary) is the same
      // practitioner_assignments-backed data as the hidden /assignments page —
      // always empty for a self-serve end_user, so this branch is currently
      // unreachable in practice. Left as a ternary (not hardcoded to the
      // "missing" branch) rather than restructured, since /assignments' own
      // redirect to /dashboard makes the '/assignments' path harmless even if
      // this ever does become reachable — see App.jsx.
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

          {/* Stage 2G.2: dropped the ETA badge — "2-3 min" read as an urgency
              countdown next to a health score, not what it actually meant
              (just how long the next step usually takes). This variant swaps
              the flat "31%" number for a ring gauge — a materially different
              treatment from the two stacked-number layouts already tried,
              and one that stays compact at this card's real width (a
              side-by-side score/safety split was tried here first and broke:
              this slot only gets ~0.75 of the hero's width, so Tailwind's
              sm: breakpoint — keyed to viewport width, not this card's own
              width — never actually kicked in narrow). Everything below the
              ring stays single-column, which is what this narrow column can
              actually hold cleanly. */}
          <CoachCard className="p-5" tone="soft">
            <p className="coach-eyebrow">{copy.healthSignalScore}</p>

            <div className="mt-2 flex items-center gap-4">
              <ScoreRing value={overallScore} tone={overallTone} />
              <CoachBadge tone={overallTone}>{scoreTierLabel(overallTone, copy)}</CoachBadge>
            </div>

            <div
              role="note"
              aria-label={copy.safety}
              className="mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5"
              style={{ background: SAFETY_TONE_STYLES[safetyTone].bg, borderColor: SAFETY_TONE_STYLES[safetyTone].border }}
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SAFETY_TONE_STYLES[safetyTone].color }} />
              <p className="text-xs font-semibold leading-5" style={{ color: SAFETY_TONE_STYLES[safetyTone].color }}>{safetyText}</p>
            </div>

            <div className="mt-4 border-t border-slate-200/70 pt-4">
              <p className="coach-eyebrow mb-1">{copy.nextAction}</p>
              <p className="text-base font-extrabold text-slate-950">{nextAction.label}</p>

              <div className="mt-4 flex items-baseline justify-between gap-3">
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400">{copy.journeyProgress}</span>
                <span className="text-lg font-extrabold text-slate-950">{journeyPct}%</span>
              </div>
              <div className="mt-2">
                <CoachProgress value={journeyPct} />
              </div>
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

      {/* Stage 2G: the overall number + safety flag now live in the hero
          status card above, so this card's only job is the breakdown behind
          that number. Splitting it into "Health Signals" (symptom +
          biomarker — the actual clinical-ish inputs) vs "Engagement"
          (check-in adherence + profile completeness — usage/data-completion
          metrics) fixes the previous flat 2x2 grid, which gave a low
          check-in-adherence number the exact same red-flag visual weight as
          a real biomarker finding even though the two mean very different
          things. Engagement rows intentionally stay a fixed "primary" tone
          rather than the value-based success/warning/critical bands used for
          health signals — low adherence is a nudge, not a health alarm. */}
      <CoachCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-lg font-extrabold text-slate-950">
          <Sparkles className="h-4 w-4 text-emerald-600" /> {copy.scoreBreakdown}
        </div>

        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">{copy.groupClinical}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <CoachScoreRow label={copy.scoreLabels.symptom} value={symptomScore} tone={scoreTone(symptomScore)} notYetCalculated={copy.notYetCalculated} />
          <CoachScoreRow label={copy.scoreLabels.biomarker} value={biomarkerScore} tone={scoreTone(biomarkerScore)} notYetCalculated={copy.notYetCalculated} />
        </div>

        <p className="mb-2 mt-5 text-xs font-extrabold uppercase tracking-wide text-slate-400">{copy.groupEngagement}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <CoachScoreRow label={copy.scoreLabels.adherence} value={adherenceScore} tone="primary" notYetCalculated={copy.notYetCalculated} />
          <CoachScoreRow label={copy.scoreLabels.profile} value={profileScore} tone="primary" notYetCalculated={copy.notYetCalculated} />
        </div>
      </CoachCard>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="coach-eyebrow">{copy.healthJourney}</p>
            <h2 className="coach-title-lg">{copy.journeyTitle}</h2>
          </div>
          <CoachBadge tone="neutral">{copy.current}: {journeySteps[humanStageIndex]?.label}</CoachBadge>
        </div>
        <div className="coach-stepper">
          {journeySteps.map((step, index) => (
            <JourneyStepNode
              key={step.label}
              step={step}
              index={index}
              active={index === humanStageIndex}
              done={index < humanStageIndex}
              isFirst={index === 0}
              isLast={index === journeySteps.length - 1}
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

        {/* flex column, not .coach-grid: the sibling "why this matters" card
            is much taller, and as a CSS grid item this column used to get
            stretched to match it — with only 3 short rows of text, that left
            each KPIBlock with a lot of dead space instead of sizing to its
            own content. */}
        <div className="flex flex-col gap-6">
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
