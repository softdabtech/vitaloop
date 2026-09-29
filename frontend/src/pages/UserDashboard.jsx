import { Link, useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, FileUp, HelpCircle, ListChecks, RefreshCw, ShieldAlert, Stethoscope, TrendingUp, UserRound } from 'lucide-react'
import { useDashboardSummary, useQuestionnaireSession, useReportDetails } from '../hooks/useQueries.js'
import { useProfile } from '../hooks/useProfile.ts'
import { useSubscription } from '../hooks/useSubscription.js'
import { CoachBadge, CoachButton, CoachSkeleton, EmptyCoachState } from '../components/coach/CoachUI.jsx'
import CabinetPageFrame from '../components/dashboard/CabinetPageFrame.jsx'
import { buildTodayViewModel } from '../lib/todayViewModel.js'
import { isUkrainianLocale } from '../lib/locale.js'
// coach-shell/coach-card/etc. (CoachUI.jsx) have no built-in styles of their
// own — every rule lives in this stylesheet. Vite code-splits CSS per lazy
// route chunk, so each page using CoachUI must import it directly or it
// renders as unstyled browser-default HTML, not a build error.
import '../styles/coach-design-system.css'
// P37h: Today-specific calmer layout (compact hero, no card-stack). Scoped
// to this page only -- see today-page.css's own header comment for why
// coach-design-system.css's shared .coach-hero/.coach-card were not edited
// directly (both are used by other pages).
import '../styles/today-page.css'

// P37d — Today core layout & state adapter. Replaces the previous Health
// Signal Score / Journey Progress / Score Breakdown framing (see
// output/p37a-.../p37c-.../p37d-...-2026-09-20.md for the full contract
// review and rationale). The page itself only renders a view model built by
// buildTodayViewModel() (src/lib/todayViewModel.js) — all state selection
// and copy assembly lives there, kept pure and dependency-free.
const TODAY_COPY = {
  en: {
    pageTitle: 'Dashboard',
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
      // P37j: 12-24 months and 24+ months get progressively more
      // distancing language -- "an older report" still reads as "your"
      // report, just aging; "your latest saved report" is deliberately more
      // neutral, framing it as simply what's on file rather than an
      // implicitly current reading.
      olderReport: (date) => `Based on an older report from ${date}`,
      savedReport: (date) => `Based on your latest saved report from ${date}`,
    },
    documents: {
      reportLine: (date) => `Report from ${date}`,
      reportLineUnavailable: 'Report date unavailable',
      upgradeNote: 'Viewing your plan requires an active subscription. Explore options for adding future reports.',
    },
    // P37j: old/very_old report hero copy -- never implies the saved plan
    // or report is current guidance; "reportTitle" is used when there is no
    // accessible plan to reference (ready_no_plan/ready_plan_gated),
    // "planTitle" when a plan is the accessible next step (ready_with_plan).
    oldReport: {
      reportTitle: 'Review your latest saved report',
      planTitle: 'Review your latest saved plan',
      body: 'This report is older. Review what was saved, or upload newer results to refresh your view.',
      veryOldBody: 'This report is over two years old. Review what was saved, or upload newer results for a current picture.',
    },
    safety: {
      sourceQuestionnaire: 'Source: your symptom check',
      // P37k.2: right-side action text for the now fully clickable
      // questionnaire safety banner in the cockpit -- same destination
      // (/questionnaire) the banner already navigated to as a whole card.
      reviewSymptomAnswersAction: 'Review symptom answers →',
    },
    reportSafety: {
      heading: (level, domainLabel) => level === 'urgent'
        ? (domainLabel ? `Your ${domainLabel} results include a recommendation for prompt medical review` : 'Your report includes a recommendation for prompt medical review')
        : (domainLabel ? `Your ${domainLabel} results are worth discussing with a doctor` : 'Your report includes a recommendation to speak with a doctor'),
      timingPrefix: 'Recommended timing',
      cta: 'See the flagged results →',
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
      // P37j: same interval, verbatim, but phrased as a value read from an
      // old/very_old saved plan rather than a live checkpoint -- never a
      // computed or overdue date, just honest framing of its source.
      checkpointSaved: (marker, timing) => `Your saved plan listed ${timing} for ${marker}.`,
      noDate: 'Your plan does not include a repeat-test date yet.',
    },
    // P37k: Today cockpit copy. Namespaced separately from the pre-existing
    // hero/documents/changes/clarity keys above (which stay in place for
    // first_run/labs_intent/error states -- states with no report to build
    // a cockpit from).
    cockpit: {
      header: {
        labDateLabel: (date) => `Lab date: ${date}`,
        labDateUnavailable: 'Lab date unavailable',
        symptomCheckLabel: (date) => `Symptom check: ${date}`,
        // P37k.2: very_old gets stronger, still-calm framing -- "Saved"
        // read as neutral/current-adjacent; "Old saved report" makes clear
        // this is not current health data without alarmist styling.
        freshness: { fresh: 'Recent', old: 'Older', very_old: 'Old saved report' },
      },
      statusStrip: {
        basisFresh: 'Latest lab report',
        basisOld: 'Older lab report',
        basisIncomplete: 'Incomplete data',
        priorityCount: (n) => n === 1 ? '1 result needs follow-up' : `${n} results need follow-up`,
        priorityNone: 'No results need follow-up',
        nextRetestLabel: (marker, timing) => `Repeat ${marker} in ${timing}`,
        nextRetestNone: 'No retest window listed',
      },
      thisWeek: {
        title: 'This week',
        clinicianReviewTitle: 'Discuss with a doctor',
        planItemWhy: 'From your saved plan',
        retestItemTitle: (marker) => `Retest ${marker}`,
        retestItemWhy: (timing) => `Window listed: ${timing}`,
        gapItemWhy: 'Missing context in your report',
        empty: 'Nothing new to flag from your latest report.',
        // P37k.1: label used whenever a row's actionTo is /questionnaire --
        // never "View results" for that destination.
        reviewSymptomAnswers: 'Review symptom answers',
        // P37k.1: forced primary row for very_old reports.
        uploadRowTitle: 'Upload newer results',
        uploadRowWhy: 'This report is old enough that fresher data would be more useful than acting on it as-is.',
      },
      labSnapshot: {
        title: 'Pinned markers',
        empty: 'No biomarker values available for this report.',
        rangeUnavailable: 'No reference range on file',
        // P37k.2: explicit status text alongside the color accent -- never
        // a new interpretation, just labeling the status band already
        // computed in todayViewModel.js.
        statusLabels: { ELEVATED: 'High', DEFICIENT: 'Low', BORDERLINE: 'Watch', OPTIMAL: 'In range' },
        unknownRange: 'Unknown range',
        viewAll: 'View all results',
      },
      followUp: {
        title: 'Follow-up timing',
        windowListed: (marker, timing) => `${marker}: window listed as ${timing}`,
        windowListedSaved: (marker, timing) => `${marker}: your saved plan listed a window of ${timing}`,
        none: 'Your plan does not include a repeat-test window yet.',
      },
      missingContext: {
        title: 'Missing context',
        cta: 'See why this matters',
        genericTitle: 'Additional context',
      },
      clinicalSummary: {
        title: 'Clinical summary',
        disclaimer: 'Not a diagnosis. Based on available data only — not all systems have been tested.',
      },
      clinicalFinding: {
        title: 'Main clinical signal',
        microLabel: 'Main finding',
        incompleteMicroLabel: 'Incomplete read',
        incompleteTitle: 'Not enough context for a confident read yet',
        mutedPatternLine: (label) => `Possible pattern kept in background: ${label} (low confidence)`,
        confidenceLabels: { likely: 'Higher confidence', possible: 'Moderate confidence', unlikely_but_flagged: 'Low confidence' },
        supportsLabel: 'Supports:',
        missingLabel: 'Missing:',
        emptyTitle: 'No clinical pattern flagged',
        emptyBody: 'Nothing in this report’s markers or symptoms matched a known clinical pattern strongly enough to surface here.',
        cta: 'See full reasoning',
      },
      attentionLevel: {
        title: 'Medical attention level',
        microLabel: 'Attention level',
        labels: {
          urgent: 'Urgent consultation needed',
          doctor: 'Doctor discussion recommended',
          practitioner: 'Increased attention recommended',
          self: 'Routine monitoring',
        },
        bodyWithDomain: (domain) => `Recommended: clarify ${domain} with a clinician.`,
        bodyNone: 'Nothing in this report needs escalation right now — continue with your current plan.',
      },
      evidenceBasis: {
        title: 'Basis',
        microLabel: 'Evidence basis',
        labels: { low: 'Sufficient', moderate: 'Partial', high: 'Limited', blocked: 'Very limited' },
        markersAnalyzed: (n) => `${n} marker${n === 1 ? '' : 's'} analyzed`,
        missingContext: (n) => `${n} important context item${n === 1 ? '' : 's'} missing`,
        noMissingContext: 'No additional context flagged as missing.',
        symptomsUpdated: (date) => `Symptoms updated ${date}`,
        symptomsUnavailable: 'No symptom check on file',
      },
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
    pageTitle: 'Дашборд',
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
      olderReport: (date) => `На основі старішого звіту від ${date}`,
      savedReport: (date) => `На основі вашого останнього збереженого звіту від ${date}`,
    },
    documents: {
      reportLine: (date) => `Звіт від ${date}`,
      reportLineUnavailable: 'Дата звіту недоступна',
      upgradeNote: 'Перегляд плану вимагає активної підписки. Дізнайтеся про варіанти для майбутніх звітів.',
    },
    oldReport: {
      reportTitle: 'Перегляньте ваш останній збережений звіт',
      planTitle: 'Перегляньте ваш останній збережений план',
      body: 'Цей звіт застарів. Перегляньте, що було збережено, або завантажте нові результати, щоб оновити картину.',
      veryOldBody: 'Цьому звіту більше двох років. Перегляньте, що було збережено, або завантажте нові результати для актуальної картини.',
    },
    safety: {
      sourceQuestionnaire: 'Джерело: ваша перевірка симптомів',
      reviewSymptomAnswersAction: 'Переглянути відповіді про симптоми →',
    },
    reportSafety: {
      heading: (level, domainLabel) => {
        const domain = domainLabel ? domainLabel.charAt(0).toUpperCase() + domainLabel.slice(1) : null
        return level === 'urgent'
          ? (domain ? `Ваш звіт відзначає результати в напрямку «${domain}», що потребують термінового медичного огляду` : 'Ваш звіт містить рекомендацію щодо термінового медичного огляду')
          : (domain ? `Ваш звіт відзначає результати в напрямку «${domain}», варті обговорення з лікарем` : 'Ваш звіт містить рекомендацію обговорити результати з лікарем')
      },
      timingPrefix: 'Рекомендований термін',
      cta: 'Переглянути позначені показники →',
      sourceLabel: 'Джерело: автоматичний аналіз VITALOOP',
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
      checkpointSaved: (marker, timing) => `У вашому збереженому плані для показника «${marker}» зазначено: ${timing}.`,
      noDate: 'У вашому плані ще немає дати повторного аналізу.',
    },
    cockpit: {
      header: {
        labDateLabel: (date) => `Дата аналізів: ${date}`,
        labDateUnavailable: 'Дата аналізів недоступна',
        symptomCheckLabel: (date) => `Перевірка симптомів: ${date}`,
        freshness: { fresh: 'Свіжий', old: 'Старіший', very_old: 'Старий збережений звіт' },
      },
      statusStrip: {
        basisFresh: 'Останній лабораторний звіт',
        basisOld: 'Старіший лабораторний звіт',
        basisIncomplete: 'Дані неповні',
        priorityCount: (n) => n === 1 ? '1 результат потребує контролю' : `${n} результати потребують контролю`,
        priorityNone: 'Немає результатів, що потребують контролю',
        nextRetestLabel: (marker, timing) => `Повторити ${marker} через ${timing}`,
        nextRetestNone: 'Немає вказаного вікна повторного аналізу',
      },
      thisWeek: {
        title: 'На цьому тижні',
        clinicianReviewTitle: 'Обговорити з лікарем',
        planItemWhy: 'З вашого збереженого плану',
        retestItemTitle: (marker) => `Повторити ${marker}`,
        retestItemWhy: (timing) => `Вказане вікно: ${timing}`,
        gapItemWhy: 'Бракує контексту у звіті',
        empty: 'Немає нових позначок з вашого останнього звіту.',
        reviewSymptomAnswers: 'Переглянути відповіді про симптоми',
        uploadRowTitle: 'Завантажити новіші результати',
        uploadRowWhy: 'Цей звіт достатньо застарів, щоб свіжі дані були кориснішими, ніж дії на основі поточного.',
      },
      labSnapshot: {
        title: 'Закріплені показники',
        empty: 'Для цього звіту немає значень показників.',
        rangeUnavailable: 'Референс недоступний',
        statusLabels: { ELEVATED: 'Підвищено', DEFICIENT: 'Знижено', BORDERLINE: 'Слідкувати', OPTIMAL: 'В нормі' },
        unknownRange: 'Референс невідомий',
        viewAll: 'Переглянути всі результати',
      },
      followUp: {
        title: 'Терміни повторного аналізу',
        windowListed: (marker, timing) => `${marker}: вказане вікно — ${timing}`,
        windowListedSaved: (marker, timing) => `${marker}: у вашому збереженому плані вказане вікно — ${timing}`,
        none: 'У вашому плані ще немає вікна повторного аналізу.',
      },
      missingContext: {
        title: 'Бракує контексту',
        cta: 'Дізнатися, чому це важливо',
        genericTitle: 'Додатковий контекст',
      },
      clinicalSummary: {
        title: 'Клінічний підсумок',
        disclaimer: 'Це не діагноз. На основі доступних даних — перевірені не всі системи.',
      },
      clinicalFinding: {
        title: 'Головний клінічний сигнал',
        microLabel: 'Головна знахідка',
        incompleteMicroLabel: 'Неповний розбір',
        incompleteTitle: 'Поки недостатньо контексту для впевненого висновку',
        mutedPatternLine: (label) => `Можливий патерн (у фоні): ${label} (низька впевненість)`,
        confidenceLabels: { likely: 'Вища впевненість', possible: 'Помірна впевненість', unlikely_but_flagged: 'Низька впевненість' },
        supportsLabel: 'Підтверджує:',
        missingLabel: 'Бракує:',
        emptyTitle: 'Клінічний патерн не виявлено',
        emptyBody: 'У цьому звіті жоден показник чи симптом не збігся з відомим клінічним патерном достатньою мірою.',
        cta: 'Переглянути повне обґрунтування',
      },
      attentionLevel: {
        title: 'Рівень медичної уваги',
        microLabel: 'Рівень уваги',
        labels: {
          urgent: 'Потрібна термінова консультація',
          doctor: 'Рекомендоване обговорення з лікарем',
          practitioner: 'Рекомендована підвищена увага',
          self: 'Планове спостереження',
        },
        bodyWithDomain: (domain) => `Рекомендовано уточнити з лікарем: ${domain}.`,
        bodyNone: 'У цьому звіті немає нічого, що потребує ескалації — дотримуйтесь поточного плану.',
      },
      evidenceBasis: {
        title: 'Основа цього висновку',
        microLabel: 'Основа доказів',
        labels: { low: 'Достатня', moderate: 'Часткова', high: 'Обмежена', blocked: 'Дуже обмежена' },
        markersAnalyzed: (n) => `Проаналізовано показників: ${n}`,
        missingContext: (n) => `Бракує важливого контексту: ${n}`,
        noMissingContext: 'Додаткового бракуючого контексту не виявлено.',
        symptomsUpdated: (date) => `Симптоми оновлено ${date}`,
        symptomsUnavailable: 'Перевірку симптомів ще не пройдено',
      },
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

// P38b — presentational-only tone classification for the status-strip
// cells: each cell already renders a value todayViewModel.js computed
// (priorityCount, basisLabel's freshness, nextRetest presence) -- this only
// picks which of the 3 existing CSS tone modifiers to apply, it does not
// reclassify or recompute anything. Never applied when there's nothing to
// classify (loading/error placeholder cells skip this entirely).
function statusCellToneClass(kind, statusStrip, reportAge) {
  if (kind === 'basis') return (reportAge === 'old' || reportAge === 'very_old') ? 'cockpit-status-cell--attention' : 'cockpit-status-cell--info'
  if (kind === 'priority') return statusStrip.priorityCount > 0 ? 'cockpit-status-cell--attention' : 'cockpit-status-cell--good'
  if (kind === 'retest') return statusStrip.nextRetest ? 'cockpit-status-cell--info' : ''
  return ''
}

// P41 -- dot meter for ORDINAL/degree values (confidence, evidence basis).
// Per the dataviz skill's form guidance: a categorical STATE (attention
// level) earns a colored status badge with an icon, but a DEGREE on a fixed
// scale is a meter, not a badge -- filled/unfilled dots read the same
// regardless of color vision, so identity never depends on hue alone here.
function MeterDots({ filled, total, label }) {
  return (
    <span className="cockpit-meter-dots" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`cockpit-meter-dot${i < filled ? ' cockpit-meter-dot--filled' : ''}`} />
      ))}
    </span>
  )
}

const CONFIDENCE_METER = { likely: 3, possible: 2, unlikely_but_flagged: 1 }
const EVIDENCE_METER = { low: 4, moderate: 3, high: 2, blocked: 1 }

// P37k — Today cockpit body. Renders viewModel.cockpit (built entirely in
// todayViewModel.js). Exactly one primary CTA on the whole page: the first
// "This week" row, when any row exists. P45 -- Dashboard home has no
// filled/pill button chrome at all: every action here (header Upload,
// This week rows, "See full reasoning", "View all results", Missing
// context links, and the Documents footer) is bold text with a hover
// color/underline change only. CoachButton is never rendered inside this
// component.
//
// P37k.3 -- this now renders for EVERY ready-report state, not only once
// GET /results/{uploadId} has resolved: cockpit.contentStatus ('loading' |
// 'error' | 'ready') tells each data-dependent section whether to show its
// real content, a loading placeholder, or a limited-detail message. This is
// what fixes the two-screen flicker -- the same cockpit shell mounts
// immediately and fills in, instead of a whole different (legacy) layout
// rendering first and being replaced once the fetch resolves.
function CockpitBody({ viewModel, cockpit, copy, navigate, symptomContext, symptomSessionId, reportSymptomSnapshot }) {
  const c = copy.cockpit
  const { headerContext, statusStrip, safety, thisWeek, labSnapshot, missingContext, isSparse, sparsePrimaryAction, contentStatus, clinicalFinding, attentionLevel, evidenceBasis } = cockpit
  const isLoadingContent = contentStatus === 'loading'
  const isErrorContent = contentStatus === 'error'

  return (
    <div className="cockpit-page">
      <div className="cockpit-hero">
        <div className="cockpit-header">
          <p className="coach-eyebrow">Your VITALOOP workspace</p>
          <div className="cockpit-header__top">
            <h1 className="cockpit-title">{copy.pageTitle}</h1>
            {viewModel.documents && (
              <button type="button" onClick={() => navigate(viewModel.documents.uploadTo)} className="cockpit-header__upload-btn">
                <FileUp className="h-4 w-4" aria-hidden="true" />
                {copy.cta.upload}
              </button>
            )}
          </div>
          <p className="cockpit-header__intro">Your latest symptom context, lab findings, priorities, and follow-up steps in one structured view.</p>
          <div className="cockpit-header__dates">
            <span>{headerContext.labDate ? c.header.labDateLabel(headerContext.labDate) : c.header.labDateUnavailable}</span>
            {headerContext.symptomCheckDate && <span>{c.header.symptomCheckLabel(headerContext.symptomCheckDate)}</span>}
            <span className={`cockpit-freshness-chip${headerContext.reportAge === 'very_old' ? ' cockpit-freshness-chip--very-old' : ''}`}>
              {c.header.freshness[headerContext.reportAge] || c.header.freshness.fresh}
            </span>
          </div>
        </div>
      </div>

      <section className="cockpit-section cockpit-report-overview" aria-label="Current report overview" aria-busy={isLoadingContent || undefined}>
        <div className="today-section-label"><Activity className="h-4 w-4 text-emerald-600" />Current report overview</div>
        <p className="cockpit-section-intro">What the latest report found and the next follow-up step.</p>
        <div className="cockpit-status-strip">
          {contentStatus === 'ready' ? (
            <>
              <div className={`cockpit-status-cell ${statusCellToneClass('basis', statusStrip, headerContext.reportAge)}`}>
                <Activity className="h-4 w-4 shrink-0 text-emerald-600" />
                <span><small>Data source</small>{statusStrip.basisLabel}</span>
              </div>
              <div className={`cockpit-status-cell ${statusCellToneClass('priority', statusStrip, headerContext.reportAge)}`}>
                <ListChecks className="h-4 w-4 shrink-0 text-emerald-600" />
                <span><small>Follow-up</small>{statusStrip.priorityLabel}</span>
              </div>
              <div className={`cockpit-status-cell ${statusCellToneClass('retest', statusStrip, headerContext.reportAge)}`}>
                <CalendarClock className="h-4 w-4 shrink-0 text-emerald-600" />
                <span><small>Next check</small>{statusStrip.nextRetestLabel}</span>
              </div>
            </>
          ) : (
            [0, 1, 2].map((i) => (
              <div key={i} className="cockpit-status-cell cockpit-status-cell--placeholder">
                {isLoadingContent ? <span className="cockpit-skeleton-line" /> : <span className="text-slate-400">—</span>}
              </div>
            ))
          )}
        </div>
      </section>

      {safety.questionnaire && (
        <section className="cockpit-section cockpit-safety-note" aria-label="Symptom-check safety note">
          <div className="today-section-label"><ShieldAlert className="h-4 w-4 text-red-700" />Symptom-check safety note</div>
          <p>{safety.questionnaire.text}</p>
          <button type="button" onClick={() => navigate(safety.questionnaire.actionTo)} className="cockpit-link mt-2">{copy.safety.reviewSymptomAnswersAction}</button>
        </section>
      )}

      {symptomContext?.primary_signal && (
        <section className="cockpit-section" aria-label="Latest symptom context">
          <div className="today-section-label"><Activity className="h-4 w-4 text-emerald-600" />Latest symptom context</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Main signal</p><p className="mt-1 text-sm font-bold text-slate-950">{symptomContext.primary_signal}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Duration</p><p className="mt-1 text-sm text-slate-700">{String(symptomContext.duration_bucket || 'Not recorded').replaceAll('_', ' ')}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Severity</p><p className="mt-1 text-sm text-slate-700">{symptomContext.severity != null ? `${symptomContext.severity}/10` : 'Not recorded'}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Wellbeing</p><p className="mt-1 text-sm text-slate-700">{String(symptomContext.overall_wellbeing || 'Not recorded').replaceAll('_', ' ')}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Pattern</p><p className="mt-1 text-sm text-slate-700">{String(symptomContext.symptom_pattern || 'Not recorded').replaceAll('_', ' ')}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Daily impact</p><p className="mt-1 text-sm text-slate-700">{String(symptomContext.functional_impact || 'Not recorded').replaceAll('_', ' ')}</p></div>
          </div>
          {Array.isArray(symptomContext.related_symptoms) && symptomContext.related_symptoms.length > 0 && <p className="mt-3 text-sm text-slate-600"><span className="font-semibold">Related:</span> {symptomContext.related_symptoms.join(', ')}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className={`text-xs font-bold ${reportSymptomSnapshot?.session_id === symptomSessionId ? 'text-emerald-700' : 'text-amber-700'}`}>
              {reportSymptomSnapshot?.session_id === symptomSessionId ? 'Included in the current lab report analysis' : 'Saved after this report — upload or regenerate a report to include it'}
            </p>
            <button type="button" onClick={() => navigate('/questionnaire')} className="cockpit-link">Review symptom answers &rarr;</button>
          </div>
        </section>
      )}
      {/* Clinical-engine transparency block (P40, merged into one card in
          P41 per direct product feedback -- these three were confirmed
          non-redundant, see the P40 session's field-overlap check, so this
          is a compaction of presentation only, not a data change). Shows
          the engine's own reasoning output (clinical_hypotheses/
          doctor_escalation_precision/evidence_debt, all already frozen into
          every report) instead of only its action items. Renders nothing
          for fields reportDetails doesn't have (loading/error/no report
          yet). One shared disclaimer + one CTA at the bottom instead of
          repeating "not a diagnosis" per sub-block. */}
      {(clinicalFinding || attentionLevel || evidenceBasis) && (
        <div className="cockpit-section cockpit-clinical-summary">
          <div className="today-section-label"><Stethoscope className="h-4 w-4 text-emerald-600" />{c.clinicalSummary.title}</div>

          {clinicalFinding && (
            <div className="cockpit-clinical-summary__block">
              <p className="cockpit-clinical-summary__label">
                {clinicalFinding.empty || !clinicalFinding.isLowConfidence ? c.clinicalFinding.microLabel : c.clinicalFinding.incompleteMicroLabel}
              </p>
              {clinicalFinding.empty ? (
                <div>
                  <p className="text-sm font-bold text-slate-950">{c.clinicalFinding.emptyTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{c.clinicalFinding.emptyBody}</p>
                </div>
              ) : (
                <div>
                  {/* P42: low-confidence patterns never headline as the named
                      finding -- "Thyroid pattern" then "but low confidence"
                      reads as a diagnosis walked back, not a diagnosis. The
                      pattern-specific reasoningStatement is suppressed for
                      the same reason; supports/missing/confidence meter stay
                      since those are the honest "why" regardless of tone. */}
                  <p className="text-sm font-bold text-slate-950">
                    {clinicalFinding.isLowConfidence ? c.clinicalFinding.incompleteTitle : clinicalFinding.label}
                  </p>
                  {/* P44: the pattern name is allowed back in at Incomplete
                      read, but only as a quiet secondary line -- never the
                      card's H1 again. */}
                  {clinicalFinding.isLowConfidence && clinicalFinding.label && (
                    <p className="mt-0.5 text-xs text-slate-400">{c.clinicalFinding.mutedPatternLine(clinicalFinding.label)}</p>
                  )}
                  {clinicalFinding.likelihoodBucket && (
                    <div className="mt-1 flex items-center gap-2">
                      <MeterDots filled={CONFIDENCE_METER[clinicalFinding.likelihoodBucket] || 0} total={3} label={c.clinicalFinding.confidenceLabels[clinicalFinding.likelihoodBucket]} />
                      <span className="text-xs text-slate-500">{c.clinicalFinding.confidenceLabels[clinicalFinding.likelihoodBucket]}</span>
                    </div>
                  )}
                  {!clinicalFinding.isLowConfidence && clinicalFinding.reasoningStatement && (
                    <p className="mt-1.5 text-sm leading-6 text-slate-700">{clinicalFinding.reasoningStatement}</p>
                  )}
                  {clinicalFinding.supportingEvidence.length > 0 && (
                    <p className="mt-2 text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-700">{c.clinicalFinding.supportsLabel}</span> {clinicalFinding.supportingEvidence.join(', ')}</p>
                  )}
                  {clinicalFinding.missingContext.length > 0 && (
                    <p className="mt-1 text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-700">{c.clinicalFinding.missingLabel}</span> {clinicalFinding.missingContext.join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {attentionLevel && (
            <div className="cockpit-clinical-summary__block cockpit-clinical-summary__block--divided">
              <p className="cockpit-clinical-summary__label">{c.attentionLevel.microLabel}</p>
              <CoachBadge tone={attentionLevel.level === 'urgent' ? 'critical' : attentionLevel.level === 'doctor' ? 'warning' : attentionLevel.level === 'practitioner' ? 'primary' : 'success'}>
                {attentionLevel.level === 'self'
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <ShieldAlert className="h-3.5 w-3.5" />}
                {c.attentionLevel.labels[attentionLevel.level]}
              </CoachBadge>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {attentionLevel.domain ? c.attentionLevel.bodyWithDomain(attentionLevel.domain) : c.attentionLevel.bodyNone}
              </p>
            </div>
          )}

          {evidenceBasis && (
            <div className="cockpit-clinical-summary__block cockpit-clinical-summary__block--divided">
              <p className="cockpit-clinical-summary__label">{c.evidenceBasis.microLabel}</p>
              <div className="flex flex-wrap items-center gap-2">
                <MeterDots filled={EVIDENCE_METER[evidenceBasis.level] || 1} total={4} label={c.evidenceBasis.labels[evidenceBasis.level] || c.evidenceBasis.labels.high} />
                <span className="text-sm font-bold text-slate-950">{c.evidenceBasis.labels[evidenceBasis.level] || c.evidenceBasis.labels.high}</span>
                <span className="text-xs text-slate-500">{c.evidenceBasis.markersAnalyzed(evidenceBasis.markerCount)}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {evidenceBasis.missingContextCount != null && evidenceBasis.missingContextCount > 0
                  ? c.evidenceBasis.missingContext(evidenceBasis.missingContextCount)
                  : c.evidenceBasis.noMissingContext}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {evidenceBasis.symptomCheckDate ? c.evidenceBasis.symptomsUpdated(evidenceBasis.symptomCheckDate) : c.evidenceBasis.symptomsUnavailable}
              </p>
            </div>
          )}

          <div className="cockpit-clinical-summary__footer">
            <p className="text-xs text-slate-400">{c.clinicalSummary.disclaimer}</p>
            {clinicalFinding && !clinicalFinding.empty && (
              <button type="button" onClick={() => navigate(clinicalFinding.to)} className="cockpit-link">{c.clinicalFinding.cta} &rarr;</button>
            )}
          </div>
        </div>
      )}

      {/* P38b required visual order, items 3-4: This week (the dominant
          action section) then Latest lab snapshot. P37k.1: when there is
          truly nothing for either to show, collapse both into one honest
          primary action instead of two empty-placeholder sections -- see
          buildCockpitViewModel's own isSparse/sparsePrimaryAction comment. */}
      {isSparse ? (
        <div className="cockpit-section cockpit-section--sparse">
          <p className="text-sm text-slate-600 mb-3">{c.thisWeek.empty}</p>
          <button type="button" onClick={() => navigate(sparsePrimaryAction.to)} className="cockpit-link">{sparsePrimaryAction.label} &rarr;</button>
        </div>
      ) : (
        <>
          <div className="cockpit-section">
            <div className="today-section-label"><ClipboardList className="h-4 w-4 text-emerald-600" />{c.thisWeek.title}</div>
            {thisWeek.length === 0 ? (
              isLoadingContent ? (
                <div className="cockpit-skeleton-rows" aria-busy="true">
                  <span className="cockpit-skeleton-line" />
                  <span className="cockpit-skeleton-line" />
                </div>
              ) : isErrorContent ? (
                <p className="text-sm text-slate-500">{copy.error.resultsSectionsUnavailable}</p>
              ) : (
                <p className="text-sm text-slate-500">{c.thisWeek.empty}</p>
              )
            ) : (
              <div className="cockpit-row-list">
                {thisWeek.map((row, index) => (
                  <div key={index} className={`cockpit-row${row.kind === 'safety' || row.kind === 'upload' ? ' cockpit-row--attention' : ''}`}>
                    <div className="cockpit-row__text">
                      <p className="cockpit-row__title">{row.title}</p>
                      {row.why && <p className="cockpit-row__why">{row.why}</p>}
                    </div>
                    {/* P45: no filled/pill button chrome on Dashboard home --
                        every action here is bold text, isPrimary or not.
                        isPrimary still exists in the data (still exactly one
                        row is "the" primary action), it just no longer gets
                        different visual weight than the rest. */}
                    <button type="button" onClick={() => navigate(row.actionTo)} className="cockpit-link cockpit-link--row">{row.actionLabel} &rarr;</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="cockpit-section">
            <div className="today-section-label"><Activity className="h-4 w-4 text-emerald-600" />{c.labSnapshot.title}</div>
            {labSnapshot.length === 0 ? (
              isLoadingContent ? (
                <div className="cockpit-skeleton-rows" aria-busy="true">
                  <span className="cockpit-skeleton-line" />
                  <span className="cockpit-skeleton-line" />
                </div>
              ) : isErrorContent ? (
                <p className="text-sm text-slate-500">{copy.error.resultsSectionsUnavailable}</p>
              ) : (
                <p className="text-sm text-slate-500">{c.labSnapshot.empty}</p>
              )
            ) : (
              <>
                <div className="cockpit-lab-grid">
                  {labSnapshot.map((m, index) => (
                    <div key={index} className={`cockpit-lab-row cockpit-lab-row--${m.status.toLowerCase()}`}>
                      <span className="cockpit-lab-row__name">{m.name}</span>
                      <span className="cockpit-lab-row__value">{m.value ?? '—'}{m.unit ? ` ${m.unit}` : ''}</span>
                      <span className="cockpit-lab-row__status">{m.statusLabel}</span>
                      <span className="cockpit-lab-row__range">{m.rangeLabel}</span>
                    </div>
                  ))}
                </div>
                {/* P44: home only ever pins the top 1-2 markers -- the rest
                    of the panel lives on /lab-results, not on a growing
                    home-screen registry. */}
                <button type="button" onClick={() => navigate('/lab-results')} className="cockpit-link mt-2">{c.labSnapshot.viewAll} &rarr;</button>
              </>
            )}
          </div>
        </>
      )}

      {/* P44 Dashboard rebuild: "Since your previous report" (pattern-name
          strings from progress_intelligence -- e.g. "Cardiovascular risk
          pattern - no longer detected" with current_confidence: null) and
          the standalone "Follow-up timing" block (the exact same retest
          window already shown in the status strip above and as a This
          Week row) were both removed from Dashboard home. Neither is
          fabricated data, but the first has no real per-marker delta
          behind it (personal_baseline.markers has real numbers, but
          against a rolling baseline, not the previous report -- labeling
          that "since previous report" would be a false pairing) and the
          second is a third copy of one fact already shown twice above.
          Both remain fully intact on /results -- this only removes the
          redundant/misleading copies from the home summary. */}

      {missingContext && (
        <div className="cockpit-section cockpit-section--detail">
          <div className="today-section-label"><HelpCircle className="h-4 w-4 text-slate-500" />{c.missingContext.title}</div>
          <div className="today-clarity-grid">
            {missingContext.map((item, index) => (
              <div key={index} className="today-clarity-item">
                <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                {item.reason && <p className="mt-0.5 text-sm leading-6 text-slate-600">{item.reason}</p>}
                {item.suggestedNextStep && <p className="mt-0.5 text-xs text-slate-500">{item.suggestedNextStep}</p>}
                <button type="button" onClick={() => navigate(item.to)} className="cockpit-link mt-1">{c.missingContext.cta} &rarr;</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P38b's original wording kept plain-text links here so this footer
          never competed with This week's single primary CTA. Per direct
          product feedback these should read as real buttons -- kept at
          --sm/secondary weight (not --primary) so that intent still holds:
          findable and clickable, but visually quieter than the page's one
          primary action. */}
      {viewModel.documents && (
        <div className="cockpit-section cockpit-documents">
          <div className="cockpit-documents__report-line">
            <Stethoscope className="h-4 w-4 text-slate-500" />
            {viewModel.documents.reportLine}
          </div>
          {/* P45: no filled/pill button chrome on Dashboard home -- these
              three used to be cabinet-btn--secondary pill buttons; now bold
              text like every other action on this page. */}
          <div className="cockpit-documents__links">
            <button type="button" onClick={() => navigate(viewModel.documents.resultsTo)} className="cockpit-link">{copy.cta.results}</button>
            {viewModel.documents.planTo && (
              <button type="button" onClick={() => navigate(viewModel.documents.planTo)} className="cockpit-link">{copy.cta.plan}</button>
            )}
            {viewModel.documents.planLocked && (
              <span className="cockpit-documents__locked" title={viewModel.documents.upgradeNote}>{copy.cta.plan}</span>
            )}
            <button type="button" onClick={() => navigate(viewModel.documents.historyTo)} className="cockpit-link">{copy.cta.history}</button>
          </div>
          {viewModel.documents.upgradeNote && <p className="mt-2 text-xs text-slate-500">{viewModel.documents.upgradeNote}</p>}
        </div>
      )}
    </div>
  )
}

function FirstRunWorkspace({ navigate, hasConcern, isLabsReadyIntent, safety }) {
  const completedSteps = hasConcern ? 2 : 1
  const progress = Math.round((completedSteps / 3) * 100)
  const primaryAction = hasConcern || isLabsReadyIntent
    ? { label: 'Upload lab results', to: '/upload', Icon: FileUp }
    : { label: 'Start symptom check', to: '/questionnaire', Icon: Stethoscope }
  const secondaryAction = primaryAction.to === '/upload'
    ? { label: hasConcern ? 'Review symptom context' : 'Add symptom context', to: '/questionnaire' }
    : { label: 'I have lab results to upload', to: '/upload' }

  const steps = [
    {
      title: 'Health profile',
      body: 'Your required baseline information is saved.',
      state: 'complete',
      Icon: UserRound,
      action: 'Review profile',
      to: '/health-profile',
    },
    {
      title: 'Symptom context',
      body: hasConcern ? 'Your current concern is saved and can be updated.' : 'Add how you feel so reports have useful context.',
      state: hasConcern ? 'complete' : 'next',
      Icon: Stethoscope,
      action: hasConcern ? 'Review' : 'Start check',
      to: '/questionnaire',
    },
    {
      title: 'Lab results',
      body: 'Upload a report or enter values manually to create your first analysis.',
      state: 'pending',
      Icon: FileUp,
      action: 'Add results',
      to: '/upload',
    },
  ]

  return (
    <div className="grid gap-5">
      {safety && (
        <button
          type="button"
          onClick={() => navigate('/questionnaire')}
          className="flex w-full items-start justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left text-amber-950 transition hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <span className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <span><strong className="block">Review your symptom safety note</strong><span className="mt-1 block text-sm leading-6">{safety.text}</span>{safety.sourceLabel && <span className="mt-2 block text-xs font-black uppercase tracking-wide opacity-70">{safety.sourceLabel}</span>}</span>
          </span>
          <span className="shrink-0 text-sm font-black">Review &rarr;</span>
        </button>
      )}
      <section className="today-focus">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-center">
          <div>
            <p className="coach-eyebrow">Your VITALOOP workspace</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl xl:text-5xl">Turn your health data into a clear next step</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Complete your symptom context, add lab results, and VITALOOP will organize both into one structured view you can return to and compare over time.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to={primaryAction.to} className="coach-button coach-button--primary coach-button--md w-full justify-center whitespace-nowrap sm:w-auto">
                <primaryAction.Icon className="coach-button__icon" aria-hidden="true" />
                <span>{primaryAction.label}</span>
                <ArrowRight className="coach-button__icon" aria-hidden="true" />
              </Link>
              <Link to={secondaryAction.to} className="whitespace-nowrap text-center text-sm font-bold text-teal-700 hover:text-teal-900 sm:text-left">
                {secondaryAction.label} &rarr;
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">Getting started</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{completedSteps} of 3</p>
              </div>
              <span className="text-sm font-bold text-slate-500">{progress}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200" aria-label={`${progress}% setup complete`}>
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Your dashboard will fill with reports, priorities, and comparisons as you add information.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="setup-steps-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="coach-eyebrow">Your path</p>
            <h2 id="setup-steps-title" className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">Build your first health snapshot</h2>
          </div>
          <p className="hidden text-sm text-slate-500 sm:block">Every card leads to a working action</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {steps.map(({ title, body, state, Icon, action, to }, index) => (
            <article key={title} className={`rounded-2xl border bg-white p-5 shadow-sm ${state === 'next' ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${state === 'complete' ? 'bg-emerald-100 text-emerald-700' : state === 'next' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                  {state === 'complete' ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Step {index + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">{body}</p>
              <Link to={to} className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-teal-700 hover:text-teal-900">
                {action} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white sm:grid-cols-3 sm:p-6">
        {[
          ['1', 'Structured context', 'Symptoms and lab values stay connected instead of living in separate forms.'],
          ['2', 'Focused analysis', 'See what is supported by your data, what remains uncertain, and what deserves attention.'],
          ['3', 'Progress over time', 'Future reports can be compared with the same saved baseline and symptom context.'],
        ].map(([number, title, body]) => (
          <div key={number} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400 font-black text-slate-950">{number}</span>
            <div><h3 className="font-black">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{body}</p></div>
          </div>
        ))}
      </section>
    </div>
  )
}

function LimitedDashboard({ summary, symptomContext, safety, navigate, refetch }) {
  const latestUpload = summary?.blocks?.latest_upload || summary?.blocks?.latest_lab_result || null
  const biomarkers = Array.isArray(latestUpload?.biomarkers) ? latestUpload.biomarkers.slice(0, 3) : []
  const labDate = latestUpload?.measurement_date || latestUpload?.test_date || latestUpload?.created_at
  const formattedDate = labDate ? new Date(labDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  return (
    <div className="cockpit-page">
      <header className="cockpit-hero">
        <div className="cockpit-header">
          <p className="coach-eyebrow">Your VITALOOP workspace</p>
          <div className="cockpit-header__top"><h1 className="cockpit-title">Dashboard</h1></div>
          <p className="cockpit-header__intro">Your saved health information remains available while report details reconnect.</p>
          {formattedDate && <div className="cockpit-header__dates"><span>Latest lab date: {formattedDate}</span></div>}
        </div>
      </header>

      <section className="cockpit-section" aria-label="Report connection status">
        <div className="today-section-label"><AlertTriangle className="h-4 w-4 text-slate-500" />Report connection</div>
        <h2 className="text-base font-bold text-slate-950">Additional report detail is temporarily unavailable</h2>
        <p className="mt-1">Your saved symptom and lab data are still shown below. Retry the connection or open report history.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          <button type="button" onClick={() => refetch()} className="cockpit-link">Try again &rarr;</button>
          <button type="button" onClick={() => navigate('/lab-results')} className="cockpit-link">All reports &rarr;</button>
        </div>
      </section>

      {safety && (
        <section className="cockpit-section cockpit-safety-note" aria-label="Symptom-check safety note">
          <div className="today-section-label"><ShieldAlert className="h-4 w-4 text-red-700" />Symptom-check safety note</div>
          <p>{safety.text}</p>
          <button type="button" onClick={() => navigate('/questionnaire')} className="cockpit-link mt-2">Review symptom answers &rarr;</button>
        </section>
      )}

      {symptomContext?.primary_signal && (
        <section className="cockpit-section" aria-label="Latest symptom context">
          <div className="today-section-label"><Activity className="h-4 w-4 text-emerald-600" />Latest symptom context</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="coach-eyebrow">Main signal</p><p className="mt-1 text-sm font-bold text-slate-950">{symptomContext.primary_signal}</p></div>
            <div><p className="coach-eyebrow">Duration</p><p className="mt-1 text-sm text-slate-700">{String(symptomContext.duration_bucket || 'Not recorded').replaceAll('_', ' ')}</p></div>
            <div><p className="coach-eyebrow">Severity</p><p className="mt-1 text-sm text-slate-700">{symptomContext.severity != null ? `${symptomContext.severity}/10` : 'Not recorded'}</p></div>
          </div>
        </section>
      )}

      {latestUpload && (
        <section className="cockpit-section" aria-label="Latest lab results">
          <div className="today-section-label"><Stethoscope className="h-4 w-4 text-emerald-600" />Latest lab results</div>
          {biomarkers.length ? <div className="cockpit-lab-grid">{biomarkers.map((marker) => (
            <div key={marker.name} className="cockpit-lab-row">
              <span className="cockpit-lab-row__name">{marker.name}</span>
              <span className="cockpit-lab-row__value">{marker.value}{marker.unit ? ` ${marker.unit}` : ''}</span>
              <span className="cockpit-lab-row__status">{marker.status || 'Recorded'}</span>
            </div>
          ))}</div> : <p>Lab results are saved. Open report history to review them.</p>}
        </section>
      )}
    </div>
  )
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
  const legacyRelatedSymptoms = Array.isArray(concernSummary?.related_symptoms)
    ? concernSummary.related_symptoms
    : Array.isArray(concernSummary?.relatedSymptoms)
      ? concernSummary.relatedSymptoms
      : String(concernSummary?.related_symptoms || concernSummary?.relatedSymptoms || '').split(',').map((item) => item.trim()).filter(Boolean)
  const primarySymptomSignal = concernSummary?.primary_signal || legacyRelatedSymptoms[0] || concern || null
  const symptomContext = concernSummary ? {
    ...concernSummary,
    primary_signal: primarySymptomSignal,
    related_symptoms: legacyRelatedSymptoms.filter((item) => item !== primarySymptomSignal),
    duration_bucket: concernSummary.duration_bucket || concernSummary.duration,
    overall_wellbeing: concernSummary.overall_wellbeing || concernSummary.overallWellbeing,
    symptom_pattern: concernSummary.symptom_pattern || concernSummary.symptomPattern,
    functional_impact: concernSummary.functional_impact || concernSummary.functionalImpact,
  } : null
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
    // P37k: summary.blocks.latest_questionnaire.completed_at -- a distinct
    // event/date from the report's own measurement_date, already present
    // on the same GET /dashboard/summary payload (no new fetch).
    symptomCheckCompletedAt: summary?.blocks?.latest_questionnaire?.completed_at || null,
  })

  if (viewModel.status === 'loading') {
    return <div className="coach-shell"><CoachSkeleton rows={3} /></div>
  }

  // P37i: whether there's anything to show below the focus band at all --
  // documents is only ever set once a ready report exists (see
  // todayViewModel.js), and returning-user sections (changes/clarity/
  // returnCheckpoint/loading/error) are only ever built in that same
  // branch, so "documents exists" is a safe, already-established proxy for
  // "there is a lower grid to render". This does not change what is
  // fetched or when -- purely a layout decision over already-computed
  // viewModel fields.
  const hasLowerGrid = Boolean(viewModel.documents)

  // P37k.3: the cockpit now renders for ANY ready report, immediately --
  // not only once reportDetails has resolved (fixes the two-screen flicker
  // where this legacy hero-first layout rendered first and was replaced by
  // the cockpit once GET /results/{uploadId} came back). cockpit.
  // contentStatus tells CockpitBody which sections have real data yet.
  // Only true non-ready states (no report yet -- first_run/labs_intent/
  // contract_error/summary_error) keep the legacy hero+lower-grid layout
  // below; it's never shown for a ready report merely because reportDetails
  // is still loading or failed.
  const cockpit = viewModel.cockpit

  return (
    <div className="coach-shell">
      <CabinetPageFrame>
        {viewModel.status === 'contract_error' ? (
          <LimitedDashboard summary={summary} symptomContext={symptomContext} safety={viewModel.safety} navigate={navigate} refetch={refetch} />
        ) : cockpit ? (
          <CockpitBody
            viewModel={viewModel}
            cockpit={cockpit}
            copy={copy}
            navigate={navigate}
            symptomContext={symptomContext}
            symptomSessionId={questionnaireSession?.session?.id}
            reportSymptomSnapshot={reportDetails?.symptom_snapshot}
          />
        ) : (viewModel.status === 'first_run' || viewModel.status === 'labs_intent') && !isUk ? (
          <FirstRunWorkspace navigate={navigate} hasConcern={hasConcern} isLabsReadyIntent={isLabsReadyIntent} safety={viewModel.safety} />
        ) : (
          <>
            <div className="today-focus">
              <div className="today-header">
                <div className="today-header__top">
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
                {viewModel.sourceLine && <p className="today-header__source">{viewModel.sourceLine}</p>}
              </div>

              {/* Report-scoped safety (P37e, from GET /results/:uploadId) and
              questionnaire safety (existing, unchanged) are rendered as two
              separate banners when both are present -- never merged, never
              deduplicated by domain guesswork, both above the hero so
              neither can be visually buried below a lower-priority CTA.
              Shared in one .today-safety-stack wrapper so two present
              banners read as one compact stack -- each banner keeps its
              own tone/text/source, nothing is merged. */}
              {(viewModel.returning?.reportSafety || viewModel.safety) && (
                <div className="today-safety-stack mt-4">
                  {viewModel.returning?.reportSafety && (
                    <div
                      role="note"
                      className="today-safety"
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
                              <span className="font-semibold">{copy.reportSafety.timingPrefix}:</span> {viewModel.returning.reportSafety.timing}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(viewModel.returning.reportSafety.to)}
                            className="mt-1.5 block text-sm font-bold underline"
                            style={{ color: SAFETY_TONE_STYLES[viewModel.returning.reportSafety.tone]?.color }}
                          >
                            {copy.reportSafety.cta}
                          </button>
                          <p className="today-safety__source mt-1.5 text-[11px] font-bold uppercase tracking-wide opacity-70" style={{ color: SAFETY_TONE_STYLES[viewModel.returning.reportSafety.tone]?.color }}>
                            {viewModel.returning.reportSafety.sourceLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {viewModel.safety && (
                    <div
                      role="note"
                      className="today-safety"
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
                            <p className="today-safety__source mt-1.5 text-[11px] font-bold uppercase tracking-wide opacity-70" style={{ color: SAFETY_TONE_STYLES[viewModel.safety.tone]?.color }}>
                              {viewModel.safety.sourceLabel}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {viewModel.status === 'summary_error' && (
                <div className="mt-4">
                  <EmptyCoachState
                    title={viewModel.hero.title}
                    body={viewModel.hero.body}
                    actionLabel={viewModel.hero.primaryLabel}
                    onAction={() => refetch()}
                  />
                </div>
              )}

              {/* One primary CTA, one plain secondary link -- matches the
              spec's "current focus" hero (§7). No decorative background
              shape; the focus band itself (today-focus) now carries the
              tinted surface, so the hero stays a plain content block. */}
              {viewModel.status !== 'summary_error' && viewModel.hero && (
                <section className="today-hero">
                  <h1>{viewModel.hero.title}</h1>
                  <p>{viewModel.hero.body}</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
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
            </div>

            {hasLowerGrid && <div className="today-divider" />}

            {hasLowerGrid && (
              <div className="today-grid-lower">
                {/* P37e returning-user sections. Loading/error only affect this
                grid -- the focus band above is unaffected, so a slow or
                failed /results/:uploadId fetch never collapses the whole
                page (see delivery report §3). Documents still renders
                below regardless, so the grid is never left empty. */}
                {viewModel.returning?.status === 'loading' && (
                  <div className="today-tile today-tile--wide">
                    <CoachSkeleton rows={2} />
                  </div>
                )}

                {viewModel.returning?.status === 'error' && (
                  <div className="today-tile today-tile--wide">
                    <p className="text-sm text-slate-500">{viewModel.returning.limitationText}</p>
                  </div>
                )}

                {/* A balanced row when both exist (spec §17.1); when only one
                exists, .today-pair's :only-child rule (today-page.css)
                makes it span the full row instead of leaving an orphaned
                half beside empty space. */}
                {(viewModel.returning?.changes || viewModel.returning?.returnCheckpoint) && (
                  <div className="today-pair">
                    {viewModel.returning.changes && (
                      <div className="today-tile">
                        <div className="today-section-label">
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
                      </div>
                    )}

                    {viewModel.returning.returnCheckpoint && (
                      <div className="today-tile">
                        <div className="today-section-label">
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
                            {/* P37f fix: label must match the actual destination
                            -- a gated/no-plan user's checkpoint correctly
                            links to resultsTo (never the protected plan
                            route), but the button must say so, not always
                            "Open my plan". */}
                            {viewModel.returning.returnCheckpoint.ctaLabel === 'plan' ? copy.cta.plan : copy.cta.results} &rarr;
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {viewModel.returning?.clarity && (
                  <div className="today-tile today-tile--wide">
                    <div className="today-section-label">
                      <HelpCircle className="h-4 w-4 text-emerald-600" />
                      {copy.clarity.title}
                    </div>
                    <div className="today-clarity-grid">
                      {viewModel.returning.clarity.items.map((item, index) => (
                        <div key={index} className="today-clarity-item">
                          <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                          {item.body && <p className="mt-0.5 text-sm leading-6 text-slate-600">{item.body}</p>}
                          <button
                            type="button"
                            onClick={() => navigate(item.to)}
                            className="mt-1 text-sm font-semibold text-teal-700 hover:text-teal-900"
                          >
                            {copy.clarity.cta} &rarr;
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents/"Latest report" keeps a single, slightly stronger
                surface -- the spec's own "stable navigational anchor"
                (§11) that should never disappear just because a different
                section became the primary CTA. */}
                {viewModel.documents && (
                  <div className="today-tile today-tile--wide today-documents">
                    <div className="today-documents__report-line">
                      <Stethoscope className="h-4 w-4 text-emerald-600" />
                      {viewModel.documents.reportLine}
                    </div>
                    <div className="today-documents__links">
                      <button type="button" onClick={() => navigate(viewModel.documents.resultsTo)} className="today-documents__link">
                        {copy.cta.results}
                      </button>
                      {viewModel.documents.planTo && (
                        <button type="button" onClick={() => navigate(viewModel.documents.planTo)} className="today-documents__link">
                          {copy.cta.plan}
                        </button>
                      )}
                      {viewModel.documents.planLocked && (
                        <span className="today-documents__link today-documents__link--locked" title={viewModel.documents.upgradeNote}>
                          {copy.cta.plan}
                        </span>
                      )}
                      <button type="button" onClick={() => navigate(viewModel.documents.historyTo)} className="today-documents__link">
                        {copy.cta.history}
                      </button>
                    </div>
                    {viewModel.documents.upgradeNote && (
                      <p className="mt-3 text-xs text-slate-500">{viewModel.documents.upgradeNote}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CabinetPageFrame>

      {/* Reserves space so the site-wide fixed-bottom cookie banner never
          sits on top of the last content section before it is dismissed --
          see today-page.css's own comment for the established pattern this
          reuses. Purely a page-bottom spacer; does not touch
          CookieConsent.jsx. */}
      <div aria-hidden="true" className="today-bottom-spacer" />
    </div>
  )
}
