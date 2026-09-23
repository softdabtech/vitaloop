import { useNavigate } from 'react-router-dom'
import { Activity, Apple, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, HelpCircle, ListChecks, RefreshCw, ShieldAlert, Stethoscope, TrendingUp } from 'lucide-react'
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
        basisFresh: 'Based on recent labs',
        basisOld: 'Based on outdated labs',
        basisIncomplete: 'Incomplete data',
        priorityCount: (n) => n === 1 ? '1 marker to watch' : `${n} markers to watch`,
        priorityNone: 'No markers flagged',
        nextRetestLabel: (marker, timing) => `${marker}: ${timing}`,
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
        title: 'Key biomarkers',
        empty: 'No biomarker values available for this report.',
        rangeUnavailable: 'No reference range on file',
        // P37k.2: explicit status text alongside the color accent -- never
        // a new interpretation, just labeling the status band already
        // computed in todayViewModel.js.
        statusLabels: { ELEVATED: 'High', DEFICIENT: 'Low', BORDERLINE: 'Watch', OPTIMAL: 'In range' },
        unknownRange: 'Unknown range',
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
      nutritionFocus: {
        title: 'Nutrition focus',
        cta: 'See full plan',
      },
      clinicalSummary: {
        title: 'Clinical summary',
        disclaimer: 'Not a diagnosis. Based on available data only — not all systems have been tested.',
      },
      clinicalFinding: {
        title: 'Main clinical signal',
        microLabel: 'Main finding',
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
        basisFresh: 'На основі свіжих аналізів',
        basisOld: 'На основі застарілих аналізів',
        basisIncomplete: 'Дані неповні',
        priorityCount: (n) => n === 1 ? '1 показник потребує уваги' : `${n} показники потребують уваги`,
        priorityNone: 'Немає позначених показників',
        nextRetestLabel: (marker, timing) => `${marker}: ${timing}`,
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
        title: 'Останній зріз аналізів',
        empty: 'Для цього звіту немає значень показників.',
        rangeUnavailable: 'Референс недоступний',
        statusLabels: { ELEVATED: 'Підвищено', DEFICIENT: 'Знижено', BORDERLINE: 'Слідкувати', OPTIMAL: 'В нормі' },
        unknownRange: 'Референс невідомий',
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
      nutritionFocus: {
        title: 'Фокус на харчуванні',
        cta: 'Переглянути повний план',
      },
      clinicalSummary: {
        title: 'Клінічний підсумок',
        disclaimer: 'Це не діагноз. На основі доступних даних — перевірені не всі системи.',
      },
      clinicalFinding: {
        title: 'Головний клінічний сигнал',
        microLabel: 'Головна знахідка',
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
// "This week" row, when any row exists -- nothing else in this component
// renders a CoachButton.
//
// P37k.3 -- this now renders for EVERY ready-report state, not only once
// GET /results/{uploadId} has resolved: cockpit.contentStatus ('loading' |
// 'error' | 'ready') tells each data-dependent section whether to show its
// real content, a loading placeholder, or a limited-detail message. This is
// what fixes the two-screen flicker -- the same cockpit shell mounts
// immediately and fills in, instead of a whole different (legacy) layout
// rendering first and being replaced once the fetch resolves.
function CockpitBody({ viewModel, cockpit, copy, navigate }) {
  const c = copy.cockpit
  const { headerContext, statusStrip, safety, thisWeek, labSnapshot, followUp, missingContext, sinceLastReport, isSparse, sparsePrimaryAction, contentStatus, nutritionFocus, clinicalFinding, attentionLevel, evidenceBasis } = cockpit
  const isLoadingContent = contentStatus === 'loading'
  const isErrorContent = contentStatus === 'error'

  return (
    <div className="cockpit-page">
      <div className="cockpit-hero">
        <div className="cockpit-header">
          <div className="cockpit-header__top">
            <h1 className="cockpit-title">{copy.pageTitle}</h1>
            {viewModel.documents && (
              <button type="button" onClick={() => navigate(viewModel.documents.uploadTo)} className="cockpit-header__upload-btn">
                {copy.cta.upload}
              </button>
            )}
          </div>
          <div className="cockpit-header__dates">
            <span>{headerContext.labDate ? c.header.labDateLabel(headerContext.labDate) : c.header.labDateUnavailable}</span>
            {headerContext.symptomCheckDate && <span>{c.header.symptomCheckLabel(headerContext.symptomCheckDate)}</span>}
            <span className={`cockpit-freshness-chip${headerContext.reportAge === 'very_old' ? ' cockpit-freshness-chip--very-old' : ''}`}>
              {c.header.freshness[headerContext.reportAge] || c.header.freshness.fresh}
            </span>
          </div>
        </div>

      {/* P38b required visual order, item 1: safety comes first, above
          current status -- a safety signal outranks everything else on the
          page. Report-scoped safety and questionnaire safety stay two
          separate banners, exactly as before -- only an explicit actionTo
          was added in todayViewModel.js, nothing here merges tone, text, or
          source between them. */}
      {(safety.report || safety.questionnaire) && (
        <div className="today-safety-stack">
          {safety.report && (
            <div role="note" className="today-safety" style={{ background: SAFETY_TONE_STYLES[safety.report.tone]?.bg, borderColor: SAFETY_TONE_STYLES[safety.report.tone]?.border }}>
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SAFETY_TONE_STYLES[safety.report.tone]?.color }} />
                <div>
                  <p className="text-sm font-semibold leading-5" style={{ color: SAFETY_TONE_STYLES[safety.report.tone]?.color }}>{safety.report.text}</p>
                  {safety.report.timing && <p className="mt-1 text-sm leading-5" style={{ color: SAFETY_TONE_STYLES[safety.report.tone]?.color }}>{safety.report.timing}</p>}
                  <button type="button" onClick={() => navigate(safety.report.actionTo)} className="mt-1.5 block text-sm font-bold underline" style={{ color: SAFETY_TONE_STYLES[safety.report.tone]?.color }}>{copy.cta.results}</button>
                  <p className="today-safety__source mt-1.5 text-[11px] font-bold uppercase tracking-wide opacity-70" style={{ color: SAFETY_TONE_STYLES[safety.report.tone]?.color }}>{safety.report.sourceLabel}</p>
                </div>
              </div>
            </div>
          )}
          {safety.questionnaire && (
            // P37k.2.1: a real <button> instead of a div+role="button" --
            // gets keyboard activation (Enter/Space), focus, and semantics
            // for free from the browser/AT instead of hand-rolled onKeyDown.
            // Dedicated .today-safety__action-row/.today-safety__content
            // classes (not Tailwind utility classes) carry the layout so the
            // CSS media query below never depends on utility-class internals
            // -- see .today-safety--actionable's own comment in
            // today-page.css for why that mattered.
            <button
              type="button"
              onClick={() => navigate(safety.questionnaire.actionTo)}
              className="today-safety today-safety--actionable"
              style={{ background: SAFETY_TONE_STYLES[safety.questionnaire.tone]?.bg, borderColor: SAFETY_TONE_STYLES[safety.questionnaire.tone]?.border }}
            >
              <div className="today-safety__action-row">
                <div className="today-safety__content">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SAFETY_TONE_STYLES[safety.questionnaire.tone]?.color }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-5" style={{ color: SAFETY_TONE_STYLES[safety.questionnaire.tone]?.color }}>{safety.questionnaire.text}</p>
                    {safety.questionnaire.sourceLabel && <p className="today-safety__source mt-1.5 text-[11px] font-bold uppercase tracking-wide opacity-70" style={{ color: SAFETY_TONE_STYLES[safety.questionnaire.tone]?.color }}>{safety.questionnaire.sourceLabel}</p>}
                  </div>
                </div>
                <span className="today-safety__action" style={{ color: SAFETY_TONE_STYLES[safety.questionnaire.tone]?.color }}>{copy.safety.reviewSymptomAnswersAction}</span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* P38b required visual order, item 2: current status. While loading/
          error, todayViewModel.js's statusStrip values are placeholder text
          (no reportDetails yet) and would read as false "nothing to report"
          content if shown -- render skeleton bars instead. On error, a
          static "—" avoids implying real (if sparse) data was found. Given
          a stronger surface than the sections below it (see .cockpit-
          status-cell in today-page.css) so "current state" outranks
          "archive/detail" at a glance, plus a semantic tone per cell
          (statusCellToneClass -- purely a color choice over an already-
          computed value, never a new classification). */}
      <div className="cockpit-status-strip" aria-busy={isLoadingContent || undefined}>
        {contentStatus === 'ready' ? (
          <>
            <div className={`cockpit-status-cell ${statusCellToneClass('basis', statusStrip, headerContext.reportAge)}`}>
              <Activity className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{statusStrip.basisLabel}</span>
            </div>
            <div className={`cockpit-status-cell ${statusCellToneClass('priority', statusStrip, headerContext.reportAge)}`}>
              <ListChecks className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{statusStrip.priorityLabel}</span>
            </div>
            <div className={`cockpit-status-cell ${statusCellToneClass('retest', statusStrip, headerContext.reportAge)}`}>
              <CalendarClock className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{statusStrip.nextRetestLabel}</span>
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
      </div>

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
              <p className="cockpit-clinical-summary__label">{c.clinicalFinding.microLabel}</p>
              {clinicalFinding.empty ? (
                <div>
                  <p className="text-sm font-bold text-slate-950">{c.clinicalFinding.emptyTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{c.clinicalFinding.emptyBody}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-950">{clinicalFinding.label}</p>
                  {clinicalFinding.likelihoodBucket && (
                    <div className="mt-1 flex items-center gap-2">
                      <MeterDots filled={CONFIDENCE_METER[clinicalFinding.likelihoodBucket] || 0} total={3} label={c.clinicalFinding.confidenceLabels[clinicalFinding.likelihoodBucket]} />
                      <span className="text-xs text-slate-500">{c.clinicalFinding.confidenceLabels[clinicalFinding.likelihoodBucket]}</span>
                    </div>
                  )}
                  {clinicalFinding.reasoningStatement && <p className="mt-1.5 text-sm leading-6 text-slate-700">{clinicalFinding.reasoningStatement}</p>}
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
          <CoachButton onClick={() => navigate(sparsePrimaryAction.to)} trailingIcon={ArrowRight} size="sm">{sparsePrimaryAction.label}</CoachButton>
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
                    {row.isPrimary ? (
                      <CoachButton onClick={() => navigate(row.actionTo)} trailingIcon={ArrowRight} size="sm">{row.actionLabel}</CoachButton>
                    ) : (
                      <button type="button" onClick={() => navigate(row.actionTo)} className="cockpit-link cockpit-link--row">{row.actionLabel} &rarr;</button>
                    )}
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
            )}
          </div>
        </>
      )}

      {/* P38b required visual order, item 5: comparisons / follow-up /
          missing context -- grouped as the "archive/detail" tier, one step
          quieter than the current-state tier above (.cockpit-section--
          detail: lighter fill, muted icon color -- see today-page.css).
          P37k.1: "Since your previous report" is the same already-built
          comparison object (progress_intelligence/personal_baseline,
          capped at 3) buildReturningUserSections has produced since P37e.
          Renders nothing if unavailable; never invents a comparison. */}
      {sinceLastReport && (
        <div className="cockpit-section cockpit-section--detail">
          <div className="today-section-label"><TrendingUp className="h-4 w-4 text-slate-500" />{copy.changes.title}</div>
          <div className="space-y-1.5">
            {sinceLastReport.items.map((text, index) => (
              <p key={index} className="text-sm leading-6 text-slate-700">{text}</p>
            ))}
          </div>
          <button type="button" onClick={() => navigate(sinceLastReport.to)} className="cockpit-link mt-1.5">{copy.changes.cta} &rarr;</button>
        </div>
      )}

      {followUp && (
        <div className="cockpit-section cockpit-section--detail">
          <div className="today-section-label"><CalendarClock className="h-4 w-4 text-slate-500" />{c.followUp.title}</div>
          <p className="text-sm leading-6 text-slate-700">{followUp.text}</p>
          <button type="button" onClick={() => navigate(followUp.to)} className="cockpit-link mt-1">{copy.cta.results} &rarr;</button>
        </div>
      )}

      {nutritionFocus && (
        <div className="cockpit-section cockpit-section--detail">
          <div className="today-section-label"><Apple className="h-4 w-4 text-slate-500" />{c.nutritionFocus.title}</div>
          <p className="text-sm font-semibold text-slate-950">{nutritionFocus.title}</p>
          {nutritionFocus.body && <p className="mt-0.5 text-sm leading-6 text-slate-700">{nutritionFocus.body}</p>}
          <button type="button" onClick={() => navigate(nutritionFocus.to)} className="cockpit-link mt-1.5">{c.nutritionFocus.cta} &rarr;</button>
        </div>
      )}

      {missingContext && (
        <div className="cockpit-section cockpit-section--detail">
          <div className="today-section-label"><HelpCircle className="h-4 w-4 text-slate-500" />{c.missingContext.title}</div>
          <div className="today-clarity-grid">
            {missingContext.map((item, index) => (
              <div key={index} className="today-clarity-item">
                <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                {item.reason && <p className="mt-0.5 text-sm leading-6 text-slate-600">{item.reason}</p>}
                {item.suggestedNextStep && <p className="mt-0.5 text-xs text-slate-500">{item.suggestedNextStep}</p>}
                <button type="button" onClick={() => navigate(item.to)} className="mt-1 text-sm font-semibold text-teal-700 hover:text-teal-900">{c.missingContext.cta} &rarr;</button>
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
          <div className="cockpit-documents__links">
            <button type="button" onClick={() => navigate(viewModel.documents.resultsTo)} className="cabinet-btn cabinet-btn--secondary cabinet-btn--sm">{copy.cta.results}</button>
            {viewModel.documents.planTo && (
              <button type="button" onClick={() => navigate(viewModel.documents.planTo)} className="cabinet-btn cabinet-btn--secondary cabinet-btn--sm">{copy.cta.plan}</button>
            )}
            {viewModel.documents.planLocked && (
              <span className="cockpit-documents__locked" title={viewModel.documents.upgradeNote}>{copy.cta.plan}</span>
            )}
            <button type="button" onClick={() => navigate(viewModel.documents.historyTo)} className="cabinet-btn cabinet-btn--secondary cabinet-btn--sm">{copy.cta.history}</button>
          </div>
          {viewModel.documents.upgradeNote && <p className="mt-2 text-xs text-slate-500">{viewModel.documents.upgradeNote}</p>}
        </div>
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
        {cockpit ? (
          <CockpitBody viewModel={viewModel} cockpit={cockpit} copy={copy} navigate={navigate} />
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
