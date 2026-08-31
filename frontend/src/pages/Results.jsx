import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../lib/api.js'
import FeatureGate from '../components/FeatureGate.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import BiomarkerContextTooltip from '../components/BiomarkerContextTooltip.jsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.jsx'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  HeartPulse,
  Info,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react'
import { isUkrainianLocale } from '../lib/locale.js'
import { biomarkerDisplayName, riskDisplayLabel } from '../lib/biomarker-display.js'
import { CoachBadge, CoachCard } from '../components/coach/CoachUI.jsx'
// coach-shell/coach-card/etc. have no built-in styles of their own — every
// rule lives in this stylesheet. Vite code-splits CSS per lazy route chunk,
// so each page using CoachUI must import it directly or it renders as
// unstyled browser-default HTML, not a build error.
import '../styles/coach-design-system.css'

const STATUS_META = {
  DEFICIENT: { rank: 0, label: 'Below range', ukLabel: 'Нижче референсу', badge: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  ELEVATED: { rank: 1, label: 'Above range', ukLabel: 'Вище референсу', badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  BORDERLINE: { rank: 2, label: 'Worth watching', ukLabel: 'Потребує спостереження', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  OPTIMAL: { rank: 3, label: 'In range', ukLabel: 'У референсі', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
}

const STATUS_ALIAS_MAP = {
  OPTIMAL: 'OPTIMAL',
  NORMAL: 'OPTIMAL',
  N: 'OPTIMAL',
  BORDERLINE: 'BORDERLINE',
  'LOW NORMAL': 'BORDERLINE',
  'HIGH NORMAL': 'BORDERLINE',
  LOW: 'DEFICIENT',
  L: 'DEFICIENT',
  DEFICIENT: 'DEFICIENT',
  HIGH: 'ELEVATED',
  H: 'ELEVATED',
  ELEVATED: 'ELEVATED',
  CRITICAL: 'ELEVATED',
}

const BIOMARKER_NAME_TRANSLATIONS = [
  [/^Ретикулоцити\s*\(%\)$/i, 'Reticulocytes (%)'],
  [/^Ретикулоцити\s*\(Г\/л\)$/i, 'Reticulocytes (G/L)'],
  [/^Ретикулоцити$/i, 'Reticulocytes'],
  [/^Незрілі ретикулоцити$/i, 'Immature Reticulocytes'],
  [/^Зрілі ретикулоцити\s*\(%\)$/i, 'Mature Reticulocytes (%)'],
  [/^Зрілі ретикулоцити\s*\(Т\/л\)$/i, 'Mature Reticulocytes (T/L)'],
  [/^Зрілі ретикулоцити$/i, 'Mature Reticulocytes'],
  [/^Еритроцити|^RBC|^Red blood cells?/i, 'Red Blood Cells (RBC)'],
  [/^Гемоглобін|^Hemoglobin|^HGB?$/i, 'Hemoglobin'],
  [/^Гематокрит|^Hematocrit|^HCT$/i, 'Hematocrit'],
  [/^MCV|^Середній об[‘’]єм еритроцита/i, 'Mean Cell Volume (MCV)'],
  [/^MCH|^Середній вміст гемоглобіна/i, 'Mean Cell Hemoglobin (MCH)'],
  [/^MCHC|^Середня концентрація гемоглобіна/i, 'Mean Cell Hemoglobin Concentration (MCHC)'],
  [/^Лейкоцити|^WBC|^White blood cells?/i, 'White Blood Cells (WBC)'],
  [/^Нейтрофіли|^Neutrophils?/i, 'Neutrophils'],
  [/^Лімфоцити|^Lymphocytes?/i, 'Lymphocytes'],
  [/^Моноцити|^Monocytes?/i, 'Monocytes'],
  [/^Еозинофіли|^Eosinophils?/i, 'Eosinophils'],
  [/^Базофіли|^Basophils?/i, 'Basophils'],
  [/^Тромбоцити|^Platelets?|^PLT$/i, 'Platelets'],
  [/^Глюкоза|^Glucose$/i, 'Glucose'],
  [/^Креатинін|^Creatinine$/i, 'Creatinine'],
  [/^Сечовина|^BUN|^Urea$/i, 'Blood Urea Nitrogen (BUN)'],
  [/^Білірубін|^Bilirubin$/i, 'Bilirubin'],
  [/^ALT|^SGPT|^Аланін амінотрансфераза/i, 'Alanine Aminotransferase (ALT)'],
  [/^AST|^SGOT|^Аспартат амінотрансфераза/i, 'Aspartate Aminotransferase (AST)'],
  [/^Лужна фосфатаза|^Alkaline phosphatase|^ALP$/i, 'Alkaline Phosphatase'],
  [/^ГГТ|^Gamma-glutamyl transferase|^GGT$/i, 'Gamma-Glutamyl Transferase (GGT)'],
  [/^Холестерин|^Total cholesterol|^TC$/i, 'Total Cholesterol'],
  [/^Тригліцериди|^Triglycerides?$/i, 'Triglycerides'],
  [/^ЛПНЩ|^LDL|^Low-density lipoprotein/i, 'Low-Density Lipoprotein (LDL)'],
  [/^ЛПВЩ|^HDL|^High-density lipoprotein/i, 'High-Density Lipoprotein (HDL)'],
  [/^Альбумін|^Albumin$/i, 'Albumin'],
  [/^Кальцій|^Calcium$/i, 'Calcium'],
  [/^Магній|^Magnesium$/i, 'Magnesium'],
  [/^Калій|^Potassium|^K$/i, 'Potassium'],
  [/^Натрій|^Sodium|^Na$/i, 'Sodium'],
  [/^CRP|^C-reactive protein/i, 'C-Reactive Protein (CRP)'],
]

const RESULTS_HINTS = [
  'Start with the priority markers, not the full table. The goal is to understand what deserves attention first.',
  'Use the doctor discussion list when you want a concise way to talk about the report with a clinician.',
  'VITALOOP is educational software. It helps organize the next step, but it does not diagnose or prescribe treatment.',
]

const RESULTS_COPY = {
  en: {
    hints: RESULTS_HINTS,
    loading: 'Loading your report…',
    back: 'Back to Lab Results',
    export: 'Export summary',
    eyebrow: 'Lab report summary',
    fallbackHeadline: 'Your results are organized into clear priorities.',
    healthSummary: 'Your Health Summary',
    topFindings: 'Top Findings',
    whyMatters: 'Why this matters',
    doctorQuestions: 'Questions for your doctor',
    evidence: 'Evidence & Sources',
    today: 'Today',
    thisWeek: 'This week',
    thisMonth: 'This month',
    intro: 'VITALOOP groups your biomarkers into what looks stable, what is worth watching, and what may deserve a clinician’s review.',
    actionPlan: 'View personal action plan',
    checkIn: 'Start a check-in',
    markersRead: 'markers read',
    watchList: 'watch list',
    outOfRange: 'out of range',
    medicalSignal: 'Medical review signal',
    alertFallback: (marker) => `${marker || 'A marker'} should be reviewed with a clinician.`,
    priorityMarkers: 'Priority markers',
    reference: 'reference',
    noPriorities: 'This report does not show obvious out-of-range priorities. Tracking trends over time is still useful.',
    meaning: 'What this may mean',
    noPattern: 'No deeper knowledge pattern matched this panel yet. Your biomarker table and status groups are still available below.',
    nextSteps: 'Next steps',
    nextFallback: 'Save this report, compare it with your symptoms, and review meaningful changes with a clinician.',
    discuss: 'Discuss with a clinician',
    discussFallback: 'Ask whether the priority markers fit your symptoms, medications, history, and recent lifestyle changes.',
    retest: 'Retest plan',
    retestFallback: 'Retesting depends on the marker, symptoms, and clinician guidance. Keep this report for comparison.',
    tableTitle: 'Full biomarker table',
    tableSummary: (optimal, watch, out) => `${optimal} in range · ${watch} worth watching · ${out} out of range`,
    biomarker: 'Biomarker',
    value: 'Value',
    ref: 'Reference',
    status: 'Status',
    unlockTrends: 'Unlock trends',
    viewTrends: 'View trends',
    readyTitle: 'Ready for the next step?',
    readyBody: 'Turn this report into a practical action plan with priorities, clinician discussion points, and follow-up tracking.',
    openPlan: 'Open action plan',
    disclaimer: 'VITALOOP provides educational information and does not diagnose, treat, or replace professional medical advice.',
    noRange: 'No reference range',
    emptyTitle: 'Results & Interpretation',
    emptySubtitle: 'No processed biomarkers yet.',
    focusNow: 'Focus now',
    watchListLabel: 'Watch list',
    noImmediate: 'No immediate out-of-range marker',
    stableZone: 'Stable zone',
    markersNearBorder: (count) => `${count} marker${count === 1 ? '' : 's'} near the border`,
    markersInRange: (count) => `${count} marker${count === 1 ? '' : 's'} in range`,
    whyThisAppears: 'Why this appears',
    whyDefault: 'Based on extracted biomarker value, reference range, symptom context, and knowledge-base matching when available.',
    evidenceSummary: 'Connected to report signals and knowledge-base context. This is not a diagnosis.',
    reviewTopFinding: 'Review the top finding and avoid starting high-dose supplements from one marker alone.',
    shoppingEyebrow: 'Suggested iHerb searches',
    shoppingTitle: 'Optional items to discuss before buying',
    shoppingBody: 'These are educational search shortcuts based on your report context. Confirm supplement choice, dose, and interactions with a qualified clinician.',
    findIherb: 'Find on iHerb',
    v2Eyebrow: 'Shared Analysis Core V2',
    domainsTitle: 'Health domain states',
    domainsBody: 'Domain-level interpretation from biomarkers, symptoms, profile context, and knowledge-base rules.',
    whyConclusion: 'Why this conclusion',
    dataUsed: 'Data used',
    analysisQuality: 'Analysis quality',
    trends: 'Trends',
    noTrendData: 'No prior comparable upload yet. Trends will appear after the next result.',
    expectedTimeline: 'Expected timeline',
    safetyNotes: 'Safety notes',
    completeness: 'Completeness',
    sourceVersion: 'Core version',
    missingData: 'Missing data',
    score: 'score',
    confidence: 'confidence',
  },
  uk: {
    hints: [
      'Починайте з пріоритетних показників, а не з усієї таблиці одразу.',
      'Використовуйте список питань до лікаря, щоб коротко обговорити результат.',
      'VITALOOP має освітній характер: допомагає структурувати наступний крок, але не ставить діагноз.',
    ],
    loading: 'Завантажуємо ваш звіт…',
    back: 'До результатів',
    export: 'Експортувати підсумок',
    eyebrow: 'Підсумок аналізів',
    fallbackHeadline: 'Ваші результати зібрані в зрозумілі пріоритети.',
    healthSummary: 'Підсумок здоровʼя',
    topFindings: 'Головні знахідки',
    whyMatters: 'Чому це важливо',
    doctorQuestions: 'Питання до лікаря',
    evidence: 'Докази й джерела',
    today: 'Сьогодні',
    thisWeek: 'Цього тижня',
    thisMonth: 'Цього місяця',
    intro: 'VITALOOP групує показники: що виглядає стабільно, що варто відстежити і що краще обговорити з лікарем.',
    actionPlan: 'Переглянути план дій',
    checkIn: 'Почати чек-ін',
    markersRead: 'показників',
    watchList: 'спостерігати',
    outOfRange: 'поза референсом',
    medicalSignal: 'Сигнал для медичного перегляду',
    alertFallback: (marker) => `${marker || 'Показник'} варто обговорити з лікарем.`,
    priorityMarkers: 'Пріоритетні показники',
    reference: 'референс',
    noPriorities: 'У цьому звіті немає очевидних пріоритетів поза референсом. Відстеження динаміки все одно корисне.',
    meaning: 'Що це може означати',
    noPattern: 'Глибший патерн із бази знань поки не знайдено. Таблиця показників і статуси доступні нижче.',
    nextSteps: 'Наступні кроки',
    nextFallback: 'Збережіть цей звіт, порівняйте його із симптомами та обговоріть значущі зміни з лікарем.',
    discuss: 'Обговорити з лікарем',
    discussFallback: 'Запитайте, чи відповідають пріоритетні показники вашим симптомам, лікам, історії та змінам способу життя.',
    retest: 'План повторної перевірки',
    retestFallback: 'Повторна перевірка залежить від показника, симптомів і рекомендацій лікаря. Збережіть звіт для порівняння.',
    tableTitle: 'Повна таблиця показників',
    tableSummary: (optimal, watch, out) => `${optimal} у референсі · ${watch} потребують спостереження · ${out} поза референсом`,
    biomarker: 'Показник',
    value: 'Значення',
    ref: 'Референс',
    status: 'Статус',
    unlockTrends: 'Відкрити динаміку',
    viewTrends: 'Переглянути динаміку',
    readyTitle: 'Готові до наступного кроку?',
    readyBody: 'Перетворіть звіт на практичний план дій із пріоритетами, питаннями до лікаря і відстеженням.',
    openPlan: 'Відкрити план дій',
    disclaimer: 'VITALOOP надає освітню інформацію і не ставить діагноз, не лікує та не замінює професійну медичну консультацію.',
    noRange: 'Референс не вказано',
    emptyTitle: 'Результати й інтерпретація',
    emptySubtitle: 'Оброблених показників ще немає.',
    focusNow: 'Фокус зараз',
    watchListLabel: 'Спостереження',
    noImmediate: 'Немає термінового показника поза референсом',
    stableZone: 'Стабільна зона',
    markersNearBorder: (count) => `${count} ${count === 1 ? 'показник біля межі' : 'показників біля межі'}`,
    markersInRange: (count) => `${count} ${count === 1 ? 'показник у референсі' : 'показників у референсі'}`,
    whyThisAppears: 'Чому це показано',
    whyDefault: 'На основі розпізнаного значення, референсу, контексту симптомів і збігів у базі знань, якщо вони доступні.',
    evidenceSummary: 'Повʼязано із сигналами звіту та контекстом бази знань. Це не діагноз.',
    reviewTopFinding: 'Перегляньте головну знахідку й не починайте високі дози добавок лише за одним показником.',
    shoppingEyebrow: 'Пошук на iHerb',
    shoppingTitle: 'Опційні позиції для обговорення перед покупкою',
    shoppingBody: 'Це освітні пошукові посилання на основі вашого звіту. Підтвердьте вибір добавки, дозу й взаємодії з кваліфікованим фахівцем.',
    findIherb: 'Знайти на iHerb',
    v2Eyebrow: 'Shared Analysis Core V2',
    domainsTitle: 'Доменний стан здоровʼя',
    domainsBody: 'Доменна інтерпретація на основі біомаркерів, симптомів, профілю та правил бази знань.',
    whyConclusion: 'Чому зроблено висновок',
    dataUsed: 'Які дані використані',
    analysisQuality: 'Якість аналізу',
    trends: 'Тренди',
    noTrendData: 'Попереднього порівнянного завантаження ще немає. Тренди зʼявляться після наступного результату.',
    expectedTimeline: 'Очікуваний строк',
    safetyNotes: 'Примітки безпеки',
    completeness: 'Повнота',
    sourceVersion: 'Версія ядра',
    missingData: 'Бракує даних',
    score: 'оцінка',
    confidence: 'впевненість',
  },
}

const HEALTH_DOMAIN_LABELS_UK = {
  iron_status: 'Статус заліза',
  'iron status': 'Статус заліза',
  metabolic_health: 'Метаболічне здоровʼя',
  'metabolic health': 'Метаболічне здоровʼя',
  cardiovascular: 'Серцево-судинний профіль',
  'cardiovascular risk context': 'Серцево-судинний профіль',
  inflammation: 'Запалення',
  thyroid: 'Щитоподібна залоза',
  liver: 'Печінка',
  'liver stress context': 'Печінка',
  kidney: 'Нирки',
  micronutrients: 'Мікронутрієнти',
  recovery_energy: 'Відновлення й енергія',
  'recovery and energy': 'Відновлення й енергія',
}

function toEnglishBiomarkerName(name) {
  const raw = String(name || '').trim()
  for (const [pattern, translated] of BIOMARKER_NAME_TRANSLATIONS) {
    if (pattern.test(raw)) return translated
  }
  return raw
}

function inferStatusFromRange(biomarker) {
  const low = Number(biomarker?.ref_low)
  const high = Number(biomarker?.ref_high)
  const value = Number(biomarker?.value)
  if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(value) || high <= low) return 'BORDERLINE'
  if (value < low) return 'DEFICIENT'
  if (value > high) return 'ELEVATED'
  const span = high - low
  if (value <= low + span * 0.15 || value >= high - span * 0.15) return 'BORDERLINE'
  return 'OPTIMAL'
}

function normalizeBiomarkerStatus(biomarker) {
  const raw = String(biomarker?.status || '').trim().toUpperCase()
  return STATUS_ALIAS_MAP[raw] || inferStatusFromRange(biomarker)
}

function scoreStatus(status) {
  return (STATUS_META[String(status || '').toUpperCase()] || { rank: 4 }).rank
}

function formatMetric(biomarker) {
  if (!biomarker) return '—'
  const unit = biomarker.unit ? ` ${biomarker.unit}` : ''
  return `${biomarker.value ?? '—'}${unit}`
}

function formatRange(biomarker, copy = RESULTS_COPY.en) {
  if (biomarker?.ref_low == null || biomarker?.ref_high == null) return copy.noRange
  return `${biomarker.ref_low} - ${biomarker.ref_high}${biomarker.unit ? ` ${biomarker.unit}` : ''}`
}

function displayBiomarkerName(biomarker, isUk) {
  if (!biomarker) return '—'
  const value = isUk
    ? biomarker.canonical_name || biomarker.name || biomarker.source_name || biomarker.name_en
    : biomarker.name_en || biomarker.canonical_name || biomarker.name || biomarker.source_name
  return biomarkerDisplayName(value, isUk) || '—'
}

function triggerSubscriptionRequiredPaywall() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'SUBSCRIPTION_REQUIRED' } }))
  }
}

function SectionCard({ icon: Icon, title, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function asTextList(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item
        if (!item || typeof item !== 'object') return String(item)
        return item.label || item.name || item.marker || item.biomarker || item.reason || item.summary || item.key || ''
      })
      .filter(Boolean)
  }
  if (typeof value === 'object') return Object.values(value).flatMap(asTextList).filter(Boolean)
  return [String(value)]
}

function formatPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return `${Math.round(number * (number <= 1 ? 100 : 1))}%`
}

function localizeDomainLabel(value, copy) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (copy === RESULTS_COPY.uk) {
    const key = raw.toLowerCase().replace(/\s+/g, '_')
    const textKey = raw.toLowerCase()
    return HEALTH_DOMAIN_LABELS_UK[key] || HEALTH_DOMAIN_LABELS_UK[textKey] || raw
  }
  return raw
}

function HealthDomainCard({ state, copy }) {
  const labelSource = copy === RESULTS_COPY.uk
    ? state?.domain || state?.key || state?.label || state?.domain_label || 'Health domain'
    : state?.label || state?.domain_label || state?.domain || state?.key || 'Health domain'
  const label = localizeDomainLabel(labelSource, copy)
  const score = Number(state?.score ?? state?.health_score)
  const risk = riskDisplayLabel(state?.risk_level || state?.status || state?.state, copy === RESULTS_COPY.uk)
  const confidence = formatPercent(state?.confidence)
  const dataUsed = asTextList(state?.used_biomarkers || state?.biomarkers || state?.contributing_biomarkers || state?.matched_biomarkers).slice(0, 5)
  const missing = asTextList(state?.missing_data || state?.missing_markers).slice(0, 4)
  const reasons = asTextList(state?.why || state?.reasons || state?.matched_signals || state?.evidence).slice(0, 3)
  if (!reasons.length) {
    const parts = [
      risk ? `risk: ${risk}` : null,
      Number.isFinite(score) ? `${copy.score}: ${Math.round(score)}` : null,
      dataUsed.length ? `${copy.dataUsed.toLowerCase()}: ${dataUsed.join(', ')}` : null,
    ].filter(Boolean)
    if (parts.length) reasons.push(parts.join(' · '))
  }
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{label}</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {[risk, Number.isFinite(score) ? `${copy.score} ${Math.round(score)}` : null, confidence ? `${confidence} ${copy.confidence}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      {!!reasons.length && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.whyConclusion}</p>
          <ul className="mt-1 space-y-1 text-sm leading-5 text-slate-600">
            {reasons.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      )}
      {!!dataUsed.length && (
        <p className="mt-3 text-sm leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">{copy.dataUsed}:</span> {dataUsed.join(', ')}
        </p>
      )}
      {!!missing.length && (
        <p className="mt-2 text-sm leading-5 text-amber-800">
          <span className="font-semibold">{copy.missingData}:</span> {missing.join(', ')}
        </p>
      )}
    </div>
  )
}

function AnalysisCoreV2Panel({ finalAnalysis, copy }) {
  if (!finalAnalysis) return null
  const healthStates = finalAnalysis.health_states || {}
  const quality = finalAnalysis.quality_snapshot || {}
  const trends = finalAnalysis.trend_analysis || {}
  const metadata = finalAnalysis.metadata || {}
  const states = Array.isArray(healthStates.top_priorities) && healthStates.top_priorities.length
    ? healthStates.top_priorities
    : Array.isArray(healthStates.states)
      ? healthStates.states
      : []
  const trendRows = asTextList(trends.priority_changes || trends.changes || trends.summary || trends.signals).slice(0, 4)
  const completeness = formatPercent(quality?.coverage?.completeness ?? quality?.coverage?.analysis_completeness ?? quality?.completeness)
  const topDomains = asTextList(quality.top_health_domains).slice(0, 4).map((item) => localizeDomainLabel(item, copy))

  if (!states.length && !Object.keys(quality).length && !Object.keys(trends).length) return null

  return (
    <SectionCard icon={HeartPulse} title={copy.domainsTitle} className="mb-6">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{copy.v2Eyebrow}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.domainsBody}</p>
      </div>
      {!!states.length && (
        <div className="grid gap-3 md:grid-cols-2">
          {states.slice(0, 6).map((state, index) => <HealthDomainCard key={state?.key || state?.domain || index} state={state} copy={copy} />)}
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.analysisQuality}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {[completeness ? `${copy.completeness}: ${completeness}` : null, quality.version, metadata.analysis_core_version].filter(Boolean).join(' · ') || copy.sourceVersion}
          </p>
          {!!topDomains.length && <p className="mt-2 text-xs leading-5 text-slate-500">{topDomains.join(', ')}</p>}
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.trends}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{trendRows.length ? trendRows.join(' · ') : copy.noTrendData}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.sourceVersion}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {[healthStates.version, healthStates.domain_registry_version, metadata.health_context_version].filter(Boolean).join(' · ') || 'V2'}
          </p>
        </div>
      </div>
    </SectionCard>
  )
}

export default function Results() {
  const { uploadId } = useParams()
  const navigate = useNavigate()
  const [biomarkers, setBiomarkers] = useState([])
  const [protocol, setProtocol] = useState([])
  const [shoppingLinks, setShoppingLinks] = useState([])
  const [knowledgeReport, setKnowledgeReport] = useState(null)
  const [finalAnalysis, setFinalAnalysis] = useState(null)
  const [explainability, setExplainability] = useState(null)
  const [safetyResult, setSafetyResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const isUk = isUkrainianLocale()
  const copy = isUk ? RESULTS_COPY.uk : RESULTS_COPY.en

  useEffect(() => {
    let active = true
    async function load() {
      try {
        // Cabinet reconciliation: a single call to /results/{uploadId} is
        // sufficient — no second /analyze/{uploadId} fetch. Verified against
        // the current backend contract (report_history.py::assemble_frozen_response
        // + both GET callers): explainability/safety_result are present at the
        // TOP LEVEL of the response for a frozen historical report, and nested
        // under final_analysis.explainability/final_analysis.safety_result for
        // the live-rendered fallback path (run_lab_analysis_pipeline's return
        // dict always carries both keys) — so this fallback chain covers both
        // cases with one request instead of two.
        const { data } = await api.get(`/results/${uploadId}`)
        if (!active) return
        setBiomarkers(data.biomarkers ?? [])
        setProtocol(data.protocol ?? [])
        setShoppingLinks(
          Array.isArray(data.shopping_links)
            ? data.shopping_links
            : Array.isArray(data.final_analysis?.shopping_links)
              ? data.final_analysis.shopping_links
              : []
        )
        setKnowledgeReport(data.knowledge_report ?? null)
        setFinalAnalysis(data.final_analysis ?? null)
        setExplainability(data.explainability ?? data.final_analysis?.explainability ?? null)
        setSafetyResult(data.safety_result ?? data.final_analysis?.safety_result ?? null)
      } catch (_e) {
        if (!active) return
        setBiomarkers([])
        setProtocol([])
        setShoppingLinks([])
        setKnowledgeReport(null)
        setFinalAnalysis(null)
        setExplainability(null)
        setSafetyResult(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [uploadId])

  const normalizedBiomarkers = useMemo(() => biomarkers.map((b) => ({
    ...b,
    name_en: toEnglishBiomarkerName(b?.name),
    status_normalized: normalizeBiomarkerStatus(b),
  })), [biomarkers])

  const rankedBiomarkers = useMemo(
    () => [...normalizedBiomarkers].sort((a, b) => scoreStatus(a.status_normalized) - scoreStatus(b.status_normalized)),
    [normalizedBiomarkers]
  )

  const priorityMarkers = rankedBiomarkers.filter((b) => b.status_normalized !== 'OPTIMAL').slice(0, 5)
  const optimalCount = normalizedBiomarkers.filter((b) => b.status_normalized === 'OPTIMAL').length
  const watchCount = normalizedBiomarkers.filter((b) => b.status_normalized === 'BORDERLINE').length
  const outOfRangeCount = normalizedBiomarkers.filter((b) => ['DEFICIENT', 'ELEVATED'].includes(b.status_normalized)).length

  const reportSummary = knowledgeReport?.summary || null
  const reportFound = knowledgeReport?.what_was_found || null
  const reportPatterns = Array.isArray(knowledgeReport?.why_it_matters) ? knowledgeReport.why_it_matters : []
  const reportActions = Array.isArray(knowledgeReport?.action_plan) ? knowledgeReport.action_plan : []
  const reportDiscussion = Array.isArray(knowledgeReport?.doctor_discussion) ? knowledgeReport.doctor_discussion : []
  const reportRetest = Array.isArray(knowledgeReport?.retest_plan) ? knowledgeReport.retest_plan : []
  const reportAlerts = Array.isArray(knowledgeReport?.safety_alerts) ? knowledgeReport.safety_alerts : []
  const explanations = Array.isArray(explainability?.recommendations)
    ? explainability.recommendations
    : Array.isArray(explainability?.marker_explanations)
      ? explainability.marker_explanations
      : []

  async function exportResultsAsPDF() {
    try {
      const jsPDF = (await import('jspdf')).jsPDF
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
      const margin = 44
      const width = pdf.internal.pageSize.getWidth() - margin * 2
      let y = 48
      const addTitle = (text, size = 18) => {
        if (y > 720) { pdf.addPage(); y = 48 }
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(size)
        pdf.setTextColor(15, 23, 42)
        pdf.text(text, margin, y)
        y += size + 12
      }
      const addText = (text, size = 10) => {
        if (!text) return
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(size)
        pdf.setTextColor(71, 85, 105)
        const lines = pdf.splitTextToSize(String(text), width)
        lines.forEach((line) => {
          if (y > 760) { pdf.addPage(); y = 48 }
          pdf.text(line, margin, y)
          y += size + 5
        })
        y += 4
      }
      const addList = (items = []) => {
        items.filter(Boolean).slice(0, 10).forEach((item) => {
          const text = typeof item === 'string' ? item : [item.title, item.body || item.summary || item.reason].filter(Boolean).join(' - ')
          addText(`• ${text}`, 10)
        })
      }

      addTitle('VITALOOP Health Report', 20)
      addText(reportSummary?.headline || copy.fallbackHeadline, 12)
      addTitle('1. Executive Summary', 14)
      addText(reportFound?.summary || copy.intro)
      addTitle('2. Findings', 14)
      addList(priorityMarkers.slice(0, 5).map((b) => `${displayBiomarkerName(b, isUk)}: ${formatMetric(b)} (${formatRange(b, copy)})`))
      addTitle('3. Action Plan', 14)
      addList(reportActions.length ? reportActions : protocol)
      addTitle('4. Doctor Questions', 14)
      addList(reportDiscussion)
      addTitle('5. Biomarkers', 14)
      addList(rankedBiomarkers.map((b) => `${displayBiomarkerName(b, isUk)}: ${formatMetric(b)}; reference ${formatRange(b, copy)}; status ${b.status_normalized}`))
      addTitle('6. Retest Plan', 14)
      addList(reportRetest)
      addTitle('7. Disclaimer', 14)
      addText(reportSummary?.disclaimer || copy.disclaimer, 9)
      pdf.save('vitaloop-results.pdf')
    } catch (err) {
      console.error('Failed to export PDF', err)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        {copy.loading}
      </div>
    )
  }

  if (normalizedBiomarkers.length === 0) {
    return (
      <div className="space-y-6">
        <CabinetPageHeader title={copy.emptyTitle} subtitle={copy.emptySubtitle} />
        <div className="max-w-4xl">
          <button onClick={() => navigate('/lab-results')} className="mb-6 inline-flex items-center gap-2 text-slate-600 transition hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            {copy.back}
          </button>
          <div className="rounded-2xl border border-slate-200 bg-white py-12 shadow-sm">
            <EmptyStateIllustration type="results" size="lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={copy.healthSummary}
        subtitle="What is happening, why it matters, and what to do next."
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate('/lab-results')} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {copy.back}
            </button>
            <button onClick={exportResultsAsPDF} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700">
              <Download className="h-4 w-4" />
              {copy.export}
            </button>
          </div>
        )}
      />

      <div className="max-w-6xl">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-6 overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-sm"
        >
          <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="p-6 sm:p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                <HeartPulse className="h-3.5 w-3.5" />
                {copy.healthSummary}
              </div>
              <h1 className="max-w-3xl text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
                {reportSummary?.headline || (priorityMarkers[0] ? `${displayBiomarkerName(priorityMarkers[0], isUk)} may need attention.` : copy.fallbackHeadline)}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                {reportFound?.summary || copy.intro}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => navigate(`/protocol/${uploadId}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  {copy.actionPlan}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate('/check-ins')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700"
                >
                  {copy.checkIn}
                </button>
              </div>
            </div>
            <div className="border-t border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 lg:border-l lg:border-t-0">
              <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-2xl font-bold text-slate-950">{normalizedBiomarkers.length}</div>
                  <div className="text-xs font-medium text-slate-500">{copy.markersRead}</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-2xl font-bold text-amber-600">{watchCount}</div>
                  <div className="text-xs font-medium text-slate-500">{copy.watchList}</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-2xl font-bold text-rose-600">{outOfRangeCount}</div>
                  <div className="text-xs font-medium text-slate-500">{copy.outOfRange}</div>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.focusNow}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{priorityMarkers[0] ? displayBiomarkerName(priorityMarkers[0], isUk) : copy.noImmediate}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{copy.watchListLabel}</p>
            <p className="mt-1 text-sm font-semibold text-amber-900">{copy.markersNearBorder(watchCount)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{copy.stableZone}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-900">{copy.markersInRange(optimalCount)}</p>
          </div>
        </div>

        <AnalysisCoreV2Panel finalAnalysis={finalAnalysis} copy={copy} />

        {!!reportAlerts.length && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-5 w-5" />
              {copy.medicalSignal}
            </div>
            <ul className="space-y-2 text-sm leading-6">
              {reportAlerts.map((alert, idx) => (
                <li key={`alert-${idx}`}>{alert.message || copy.alertFallback(alert.marker)}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <SectionCard icon={ClipboardList} title={copy.topFindings}>
            {priorityMarkers.length ? (
              <div className="space-y-3">
                {priorityMarkers.slice(0, 3).map((b) => {
                  const meta = STATUS_META[b.status_normalized] || STATUS_META.BORDERLINE
                  return (
                    <div key={b.id || `${b.name_en}-${b.value}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                            <h3 className="font-semibold text-slate-950">{displayBiomarkerName(b, isUk)}</h3>
                            <BiomarkerContextTooltip biomarkerName={displayBiomarkerName(b, isUk)} value={b.value} status={b.status_normalized} size="sm" />
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{formatMetric(b)} · {copy.reference} {formatRange(b, copy)}</p>
                          <details className="mt-3 text-sm">
                            <summary className="cursor-pointer font-semibold text-teal-700">{copy.whyThisAppears}</summary>
                            <p className="mt-2 leading-6 text-slate-600">
                              {(() => {
                                const explanation = explanations.find((item) => String(item.triggered_biomarker || item.marker || '').toLowerCase().includes(String(displayBiomarkerName(b, false)).toLowerCase().split(' ')[0]))
                                return explanation?.explanation || explanation?.reason || explanation?.summary || explanation?.why || copy.whyDefault
                              })()}
                            </p>
                          </details>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>{isUk ? meta.ukLabel || meta.label : meta.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                {copy.noPriorities}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Info} title={copy.whyMatters}>
            {reportPatterns.length ? (
              <div className="space-y-3">
                {reportPatterns.slice(0, 4).map((item, idx) => (
                  <div key={`pattern-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-950">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.why_it_matters || item.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                {copy.noPattern}
              </p>
            )}
          </SectionCard>
        </div>

        {/* Full biomarker table moved up here (right after Top Findings / Why
            This Matters) per explicit request — it used to sit near the
            bottom of the page, after Next Steps/Today/This Month/Doctor
            Questions and the shopping links, which buried the one place that
            shows every marker (not just the top 3 priority ones) below a lot
            of secondary content. */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{copy.tableTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">{copy.tableSummary(optimalCount, watchCount, outOfRangeCount)}</p>
            </div>
            <FeatureGate
              feature="advanced_protocol"
              onLocked={triggerSubscriptionRequiredPaywall}
              fallback={
                <button onClick={triggerSubscriptionRequiredPaywall} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
                  {copy.unlockTrends}
                </button>
              }
            >
              <button onClick={() => navigate('/progress')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                {copy.viewTrends}
              </button>
            </FeatureGate>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">{copy.biomarker}</th>
                  <th className="px-4 py-3 text-left font-semibold">{copy.value}</th>
                  <th className="px-4 py-3 text-left font-semibold">{copy.ref}</th>
                  <th className="px-4 py-3 text-left font-semibold">{copy.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rankedBiomarkers.map((b, idx) => {
                  const meta = STATUS_META[b.status_normalized] || STATUS_META.BORDERLINE
                  return (
                    <tr key={b.id || `${b.name}-${idx}`} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-950">{displayBiomarkerName(b, isUk)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatMetric(b)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatRange(b, copy)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>{isUk ? meta.ukLabel || meta.label : meta.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stacked vertically, one full-width card per row — corrected per
            direct feedback after the horizontal-row version shipped (was
            `grid lg:grid-cols-4`, then briefly a horizontal-scroll flex row;
            neither was the intended layout). Content length varies a lot
            between these 4 cards (Today/This month are one line, Next
            steps/Doctor questions are long lists) — stacked full-width lets
            each size to its own content instead of forcing uneven columns
            side by side. */}
        <div className="mt-6 flex flex-col gap-4">
          <SectionCard icon={CheckCircle2} title={copy.nextSteps}>
            {reportActions.length ? (
              <ul className="space-y-3 text-sm leading-6 text-slate-700">
                {reportActions.slice(0, 4).map((item, idx) => (
                  <li key={`action-${item.key || idx}`} className="rounded-xl bg-slate-50 p-3">
                    <span className="font-semibold text-slate-950">{item.title}</span>
                    <span className="block text-slate-600">{item.body}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-slate-600">{copy.nextFallback}</p>
            )}
          </SectionCard>

          <SectionCard icon={ArrowRight} title={copy.today}>
            <p className="text-sm leading-6 text-slate-600">{reportActions[0]?.body || reportActions[0]?.title || copy.reviewTopFinding}</p>
          </SectionCard>

          <SectionCard icon={RefreshCw} title={copy.thisMonth}>
            <p className="text-sm leading-6 text-slate-600">{reportRetest[0]?.timing || 'Plan retesting based on symptoms, clinician guidance, and the marker involved.'}</p>
          </SectionCard>

          <SectionCard icon={MessageCircle} title={copy.doctorQuestions}>
            {reportDiscussion.length ? (
              <ul className="space-y-2 text-sm leading-6 text-slate-700">
                {reportDiscussion.slice(0, 5).map((item, idx) => (
                  <li key={`discussion-${idx}`} className="rounded-xl bg-slate-50 px-3 py-2">{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-slate-600">{copy.discussFallback}</p>
            )}
          </SectionCard>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <CoachCard className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">{copy.evidence}</h2>
              <CoachBadge tone={safetyResult?.status === 'blocked' ? 'critical' : safetyResult?.status === 'approved_with_warnings' ? 'warning' : 'success'}>
                {safetyResult?.status || 'educational'}
              </CoachBadge>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              {explanations.length ? copy.evidenceSummary : copy.whyDefault}
            </p>
          </CoachCard>

          <CoachCard className="p-5">
            <h2 className="text-lg font-semibold text-slate-950">{copy.retest}</h2>
            {reportRetest.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {reportRetest.slice(0, 5).map((item, idx) => (
                  <li key={`retest-${idx}`} className="rounded-xl bg-slate-50 px-3 py-2">
                    <span className="font-semibold text-slate-950">{item.marker}</span>
                    <span className="block text-slate-600">{item.timing}</span>
                    {item.reason && <span className="block text-xs text-slate-500">{item.reason}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">{copy.retestFallback}</p>
            )}
          </CoachCard>
        </div>

        {!!shoppingLinks.length && (
          <div className="mt-6 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{copy.shoppingEyebrow}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{copy.shoppingTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {copy.shoppingBody}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shoppingLinks.slice(0, 6).map((item, idx) => (
                <div key={`${item.search_query || item.label}-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-950">{item.label || item.search_query}</h3>
                      {item.reason && <p className="mt-1 text-sm leading-6 text-slate-600">{item.reason}</p>}
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        {copy.findIherb}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-950">{copy.readyTitle}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {copy.readyBody}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/protocol/${uploadId}`)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              {copy.openPlan}
              <FileText className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          {reportSummary?.disclaimer || copy.disclaimer}
        </p>
      </div>
    </div>
  )
}
