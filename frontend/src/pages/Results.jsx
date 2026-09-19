import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../lib/api.js'
import FeatureGate from '../components/FeatureGate.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import BiomarkerContextTooltip from '../components/BiomarkerContextTooltip.jsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.jsx'
import { gaResultsView } from '../lib/analytics.js'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  HeartPulse,
  HelpCircle,
  Info,
  MessageCircle,
  Network,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { isUkrainianLocale } from '../lib/locale.js'
import { buildClinicalReasoningMap } from '../lib/clinicalReasoningMap.js'
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
    urgentSignal: 'Prompt medical review signal',
    urgentFallback: 'Some values in this report may require prompt medical review. Contact a qualified clinician or urgent care if symptoms are severe or worsening.',
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
    v2Eyebrow: 'VITALOOP Health Intelligence Engine',
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
    reasoningTitle: 'Clinical Reasoning',
    reasoningIntro: 'How each finding was reached — the markers and symptoms behind it, how confident we are, and what would change the picture.',
    reasoningBasedOn: 'Based on',
    reasoningSupporting: 'Supporting',
    reasoningContradicting: 'Argues against',
    reasoningGaps: "What we still don't know",
    reasoningNextTests: 'Suggested next tests',
    reasoningDoctorFlag: 'Discuss with a doctor',
    reasoningSafety: {
      high_confidence_urgent: 'Needs prompt attention',
      moderate_confidence: 'Worth reviewing',
      low_confidence: 'Early signal, limited certainty',
      blocked_by_missing_data: 'Not enough data for a confident read',
      doctor_only: 'Discuss with a doctor',
    },
    reasoningEmpty: 'No detailed reasoning trace is available for this report yet.',
    mapTitle: 'How VITALOOP connected the dots',
    mapIntro: 'The top possibilities this upload points to, what supports and limits each one, and who should act on it.',
    mapWhatSupports: 'What supports this',
    mapWhatLimits: 'What limits confidence',
    mapNextTests: 'What could reduce uncertainty',
    mapContext: 'Reported context',
    mapConfidence: 'Confidence',
    mapActionBucket: {
      self: 'You can act on this yourself',
      practitioner: 'Worth bringing to a practitioner',
      doctor: 'Discuss with a doctor',
      urgent: 'Needs prompt attention',
    },
    mapConfidenceLabel: {
      high: 'High',
      moderate: 'Moderate',
      low: 'Low',
      blocked: 'Not enough data',
      doctor_only: 'Discuss with a doctor',
      likely: 'Likely',
      possible: 'Possible',
      unlikely_but_flagged: 'Unlikely, still noted',
    },
    mapEmptyWithDomains: (stable, underTested) =>
      `No strong hypothesis was generated from this upload. VITALOOP still checked available domains and found ${stable} stable area${stable === 1 ? '' : 's'} and ${underTested} under-tested area${underTested === 1 ? '' : 's'}.`,
    mapEmptyNoDomains: 'No strong hypothesis was generated from this upload, and no domain summary is available yet for this report.',
    mapStableDomains: 'No strong signal detected in this upload',
    mapUnderTestedDomains: 'Not enough data to assess confidently',
    progressTitle: 'Progress Since Last Time',
    progressIntro: 'How your patterns changed compared with your previous upload.',
    progressStrengthened: 'Stronger signal than last time',
    progressWeakened: 'Weaker signal than last time',
    progressNew: 'New since last time',
    progressResolved: 'No longer detected — improved or resolved',
    progressStable: 'Unchanged since last time',
    progressNoPrevious: 'Upload another report in the future to see how this changes over time.',
    progressConfidenceWas: (from, to) => `${from} → ${to}`,
    evidenceGapsTitle: 'What Could Make This Clearer',
    evidenceGapsIntro: 'A few things are still unclear here — adding them could sharpen the picture. This is about missing context, not a problem with you.',
    evidenceGapsEmpty: 'Nothing stood out as unclear in this report.',
    evidenceGapsHighPriority: 'high priority',
    evidenceGapDomainLabels: {
      knowledge_coverage: 'Not yet interpreted',
      data_quality: 'Data quality',
      general: 'General context',
    },
    testingPlanTitle: 'Testing & Retest Plan',
    testingPlanIntro: 'Ranked by how much each would clarify this report. High-priority items are worth discussing sooner; the rest can wait for your next check-in.',
    testingPlanEmpty: 'No specific tests to suggest from this report right now.',
    testingPlanPriority: { high: 'High priority', medium: 'Medium priority', low: 'Low priority' },
    testingPlanTiming: 'Suggested timing',
    testingPlanCompletedTitle: '✓ Completed since your last report',
    baselineTitle: 'Your Personal Baseline',
    baselineIntro: 'Not just in-range or out-of-range — is this normal for YOU, based on your own history.',
    baselineEmpty: 'Not enough repeat history yet to establish a personal baseline. This builds up as you upload more reports.',
    baselineSilentSignalLabel: 'In range, but a real shift for you',
    baselineSilentSignalIntro: 'These markers are reported as normal by the lab, but have moved meaningfully away from your own typical range — worth a second look.',
    baselineOtherLabel: 'Other tracked markers',
    baselineWas: (value) => `Your typical: ${value}`,
    baselineHistoryPoints: (n) => `based on ${n} prior result${n === 1 ? '' : 's'}`,
    systemMapTitle: 'Your System Map',
    systemMapIntro: 'Every system we checked — not just the ones flagged. Stable systems are reassurance, not an absence of data.',
    systemMapPersonalDrift: 'Personal baseline shift detected here',
    systemMapNoData: 'No markers for this system yet',
    actionPlanTitle: 'Your Action Plan, By Who',
    actionPlanIntro: 'The simplest version of this report: what you can do yourself, what to bring to a specialist, what needs a doctor, and what’s urgent.',
    actionPlanBuckets: {
      urgent: { label: 'Urgent — discuss promptly', tone: 'critical' },
      doctor: { label: 'Discuss with a doctor', tone: 'warning' },
      practitioner: { label: 'Bring to a specialist / nutritionist', tone: 'info' },
      self: { label: 'You can do yourself', tone: 'success' },
    },
    actionPlanEmptyBucket: 'Nothing in this category right now.',
    doctorEscalationTitle: 'Doctor discussion',
    doctorEscalationIntro: 'Based on this report, these points may be worth a conversation with a doctor.',
    doctorEscalationLevelLabels: {
      urgent: 'Needs prompt medical attention',
      doctor: 'Worth discussing with a doctor',
    },
    doctorEscalationTimingLabels: {
      urgent: 'As soon as possible',
      prompt: 'Within the next few days',
      soon: 'In the near term',
      routine: 'At your next routine check-in',
    },
    doctorEscalationMarkersLabel: 'Related markers',
    doctorEscalationDisclaimer: 'This is educational information, not a diagnosis, and does not replace a doctor.',
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
    urgentSignal: 'Сигнал для швидкого медичного перегляду',
    urgentFallback: 'Деякі значення у звіті можуть потребувати швидкого медичного перегляду. Зверніться до лікаря або невідкладної допомоги, якщо симптоми виражені чи погіршуються.',
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
    v2Eyebrow: 'VITALOOP Health Intelligence Engine',
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
    reasoningTitle: 'Клінічне обґрунтування',
    reasoningIntro: 'Як зроблено кожен висновок — які показники й симптоми його підтверджують, наскільки ми впевнені і що може змінити картину.',
    reasoningBasedOn: 'На основі',
    reasoningSupporting: 'Підтверджують',
    reasoningContradicting: 'Проти цього свідчить',
    reasoningGaps: 'Чого ще не вистачає для впевненості',
    reasoningNextTests: 'Рекомендовані наступні аналізи',
    reasoningDoctorFlag: 'Обговорити з лікарем',
    reasoningSafety: {
      high_confidence_urgent: 'Потребує швидкої уваги',
      moderate_confidence: 'Варто переглянути',
      low_confidence: 'Ранній сигнал, обмежена впевненість',
      blocked_by_missing_data: 'Недостатньо даних для впевненого висновку',
      doctor_only: 'Обговорити з лікарем',
    },
    reasoningEmpty: 'Детальне обґрунтування для цього звіту поки недоступне.',
    mapTitle: 'Як VITALOOP з’єднав дані',
    mapIntro: 'Найімовірніші пояснення цього завантаження, що їх підтримує й обмежує, та хто має діяти далі.',
    mapWhatSupports: 'Що це підтримує',
    mapWhatLimits: 'Що обмежує впевненість',
    mapNextTests: 'Що могло б зменшити невизначеність',
    mapContext: 'Зазначений контекст',
    mapConfidence: 'Впевненість',
    mapActionBucket: {
      self: 'Можна діяти самостійно',
      practitioner: 'Варто обговорити зі спеціалістом',
      doctor: 'Обговоріть з лікарем',
      urgent: 'Потребує невідкладної уваги',
    },
    mapConfidenceLabel: {
      high: 'Висока',
      moderate: 'Помірна',
      low: 'Низька',
      blocked: 'Недостатньо даних',
      doctor_only: 'Обговоріть з лікарем',
      likely: 'Ймовірно',
      possible: 'Можливо',
      unlikely_but_flagged: 'Малоймовірно, але відмічено',
    },
    mapEmptyWithDomains: (stable, underTested) =>
      `Із цього завантаження не сформувалась виражена гіпотеза. VITALOOP усе ж перевірив доступні напрямки: стабільних — ${stable}, недостатньо перевірених — ${underTested}.`,
    mapEmptyNoDomains: 'Із цього завантаження не сформувалась виражена гіпотеза, а огляд напрямків для цього звіту поки недоступний.',
    mapStableDomains: 'У цьому завантаженні не виявлено вираженого сигналу',
    mapUnderTestedDomains: 'Недостатньо даних для впевненої оцінки',
    progressTitle: 'Прогрес з минулого разу',
    progressIntro: 'Як змінилися ваші патерни порівняно з попереднім завантаженням.',
    progressStrengthened: 'Сигнал сильніший, ніж минулого разу',
    progressWeakened: 'Сигнал слабший, ніж минулого разу',
    progressNew: 'Нове з минулого разу',
    progressResolved: 'Більше не виявлено — покращення або вирішення',
    progressStable: 'Без змін з минулого разу',
    progressNoPrevious: 'Завантажте ще один звіт у майбутньому, щоб побачити динаміку з часом.',
    progressConfidenceWas: (from, to) => `${from} → ${to}`,
    evidenceGapsTitle: 'Що може прояснити картину',
    evidenceGapsIntro: 'Дещо тут ще не зовсім зрозуміло — доповнення могло б прояснити картину. Це про брак контексту, а не про вас.',
    evidenceGapsEmpty: 'У цьому звіті не виявлено нічого незрозумілого.',
    evidenceGapsHighPriority: 'високий пріоритет',
    evidenceGapDomainLabels: {
      knowledge_coverage: 'Ще не інтерпретовано',
      data_quality: 'Якість даних',
      general: 'Загальний контекст',
    },
    testingPlanTitle: 'План тестування та повторної перевірки',
    testingPlanIntro: 'Впорядковано за тим, наскільки кожен аналіз прояснить звіт. Пріоритетні пункти варто обговорити скоріше; решта може почекати до наступного огляду.',
    testingPlanEmpty: 'Наразі немає конкретних аналізів для пропозиції з цього звіту.',
    testingPlanPriority: { high: 'Високий пріоритет', medium: 'Середній пріоритет', low: 'Низький пріоритет' },
    testingPlanTiming: 'Рекомендований термін',
    testingPlanCompletedTitle: '✓ Виконано з попереднього звіту',
    baselineTitle: 'Ваша особиста базова лінія',
    baselineIntro: 'Не просто в межах чи поза межами референсу — чи це нормально саме для вас, на основі вашої історії.',
    baselineEmpty: 'Поки що недостатньо повторної історії для особистої базової лінії. Вона формується з новими завантаженими звітами.',
    baselineSilentSignalLabel: 'У межах референсу, але реальна зміна для вас',
    baselineSilentSignalIntro: 'Ці показники лабораторія вважає нормальними, але вони суттєво відхилились від вашого типового рівня — варто звернути увагу.',
    baselineOtherLabel: 'Інші відстежені показники',
    baselineWas: (value) => `Ваш типовий рівень: ${value}`,
    baselineHistoryPoints: (n) => `на основі ${n} попередн${n === 1 ? 'ього результату' : 'іх результатів'}`,
    systemMapTitle: 'Карта ваших систем',
    systemMapIntro: 'Кожна система, яку ми перевірили — не тільки позначені. Стабільні системи — це підтвердження, а не брак даних.',
    systemMapPersonalDrift: 'Тут виявлено зміну відносно вашої базової лінії',
    systemMapNoData: 'Поки немає показників для цієї системи',
    actionPlanTitle: 'Ваш план дій, за виконавцем',
    actionPlanIntro: 'Найпростіша версія цього звіту: що можна зробити самостійно, що обговорити з фахівцем, що потребує лікаря, і що термінове.',
    actionPlanBuckets: {
      urgent: { label: 'Терміново — обговоріть якнайшвидше', tone: 'critical' },
      doctor: { label: 'Обговорити з лікарем', tone: 'warning' },
      practitioner: { label: 'Обговорити з фахівцем / нутриціологом', tone: 'info' },
      self: { label: 'Можна зробити самостійно', tone: 'success' },
    },
    actionPlanEmptyBucket: 'У цій категорії поки нічого немає.',
    doctorEscalationTitle: 'Обговорення з лікарем',
    doctorEscalationIntro: 'На основі цього звіту ці моменти може варто обговорити з лікарем.',
    doctorEscalationLevelLabels: {
      urgent: 'Потребує швидкої медичної уваги',
      doctor: 'Варто обговорити з лікарем',
    },
    doctorEscalationTimingLabels: {
      urgent: 'Якнайшвидше',
      prompt: 'Протягом кількох днів',
      soon: 'Найближчим часом',
      routine: 'У плановому порядку',
    },
    doctorEscalationMarkersLabel: 'Пов’язані показники',
    doctorEscalationDisclaimer: 'VITALOOP не ставить діагноз і не замінює лікаря.',
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

// P31d: asTextList()'s object fallback chain (label/name/.../key) can map
// two distinct gap entries onto the same display string (e.g. two gaps
// with no more specific label falling back to the same domain/key) --
// this collapses those into one, preserving first-seen order, before the
// list is rendered. Presentation-only: never touches the source trace
// data.
function dedupeTextList(list) {
  const seen = new Set()
  const result = []
  for (const item of list) {
    if (seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
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

const SYSTEM_MAP_RISK_META = {
  high_attention: 'border-rose-200 bg-rose-50 text-rose-700',
  needs_attention: 'border-amber-200 bg-amber-50 text-amber-800',
  watch: 'border-amber-200 bg-amber-50 text-amber-700',
  stable: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  unknown: 'border-slate-200 bg-slate-100 text-slate-500',
}

// P7 System Map: shows EVERY domain health_state_engine.py evaluated, not
// just the filtered top_priorities subset AnalysisCoreV2Panel below
// falls back to hiding when even one domain is flagged — the whole point
// of a system map is that stable systems are visible reassurance, not
// omitted because they're not the problem. Cross-references
// personal_baseline's silent_signal markers (P6) by canonical_name against
// each domain's contributing_biomarkers, per the product plan's own
// suggestion that the system map should get smarter once a personal
// baseline exists, not just report current status.
function SystemMapSection({ healthStates, personalBaseline, copy }) {
  const states = Array.isArray(healthStates?.states) ? healthStates.states : []
  if (!states.length) return null

  const silentSignalNames = new Set(
    (Array.isArray(personalBaseline?.markers) ? personalBaseline.markers : [])
      .filter((m) => m?.silent_signal)
      .map((m) => String(m?.canonical_name || '').toLowerCase())
  )

  return (
    <SectionCard icon={HeartPulse} title={copy.systemMapTitle} className="mb-6">
      <p className="mb-4 text-sm leading-6 text-slate-500">{copy.systemMapIntro}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {states.map((state, index) => {
          const badgeClass = SYSTEM_MAP_RISK_META[state?.risk_level] || SYSTEM_MAP_RISK_META.unknown
          const riskLabel = riskDisplayLabel(state?.risk_level, copy === RESULTS_COPY.uk)
          const label = localizeDomainLabel(state?.label || state?.domain, copy)
          const hasDrift = (state?.contributing_biomarkers || []).some((b) =>
            silentSignalNames.has(String(b?.canonical_name || '').toLowerCase())
          )
          return (
            <div key={state?.domain || index} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-950">{label}</h3>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>{riskLabel}</span>
              </div>
              {state?.risk_level === 'unknown' ? (
                <p className="mt-2 text-xs text-slate-500">{copy.systemMapNoData}</p>
              ) : (
                Number.isFinite(Number(state?.score)) && (
                  <p className="mt-2 text-xs text-slate-500">{copy.score}: {Math.round(Number(state.score))}</p>
                )
              )}
              {hasDrift && (
                <p className="mt-2 text-xs font-semibold text-amber-700">{copy.systemMapPersonalDrift}</p>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

const ACTION_PLAN_BUCKET_STYLE = {
  critical: { icon: ShieldAlert, badge: 'border-rose-200 bg-rose-50 text-rose-700' },
  warning: { icon: Stethoscope, badge: 'border-amber-200 bg-amber-50 text-amber-800' },
  info: { icon: MessageCircle, badge: 'border-sky-200 bg-sky-50 text-sky-700' },
  success: { icon: CheckCircle2, badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
}
const ACTION_PLAN_BUCKET_ORDER = ['urgent', 'doctor', 'practitioner', 'self']

// P9 Action Plan by Role: renders action_plan_by_role
// (backend/app/services/action_plan_by_role.py) as four always-visible
// buckets — the simplest possible answer after everything else on this
// page: what to do yourself, what to bring to a specialist, what needs a
// doctor, what's urgent. Pure display over data already bucketed
// server-side; this component does no classification of its own.
function ActionPlanByRoleSection({ actionPlan, copy }) {
  if (!actionPlan?.buckets) return null
  return (
    <SectionCard icon={CheckCircle2} title={copy.actionPlanTitle} className="mb-6">
      <p className="mb-4 text-sm leading-6 text-slate-500">{copy.actionPlanIntro}</p>
      <div className="space-y-4">
        {ACTION_PLAN_BUCKET_ORDER.map((bucketKey) => {
          const meta = copy.actionPlanBuckets[bucketKey]
          const style = ACTION_PLAN_BUCKET_STYLE[meta.tone] || ACTION_PLAN_BUCKET_STYLE.info
          const Icon = style.icon
          const items = Array.isArray(actionPlan.buckets[bucketKey]) ? actionPlan.buckets[bucketKey] : []
          if (!items.length) return null
          return (
            <div key={bucketKey}>
              <div className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${style.badge}`}>
                <Icon className="h-3.5 w-3.5" /> {meta.label}
              </div>
              <div className="space-y-2">
                {items.slice(0, 8).map((item, index) => (
                  <div key={`${item.source_id || item.title}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    {!!item.reason && <p className="mt-1 text-sm leading-5 text-slate-600">{item.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// P29: renders doctor_escalation_precision (backend/app/services/
// doctor_escalation_precision.py) as a small, restrained "doctor
// discussion" card — never a full-width panic banner, even for an
// "urgent" entry. Renders nothing at all when there is no doctor/urgent
// level escalation: a practitioner/self-only report already has its
// own place in ActionPlanByRoleSection above, so this section would
// otherwise duplicate it. Deliberately does not display reason_codes,
// internal ids, related_profiles, related_hypotheses, raw
// contradictions, or pattern_escalation_reasons — see P29's scope: the
// first UI pass only shows fields already vetted as consumer-safe
// (docs/P29A_DOCTOR_ESCALATION_FRONTEND_EXPOSURE_REVIEW_2026-09-18.md).
const DOCTOR_ESCALATION_LEVEL_ORDER = { urgent: 0, doctor: 1 }
const DOCTOR_ESCALATION_MAX_ITEMS = 3

function DoctorEscalationSection({ doctorEscalationPrecision, copy }) {
  const escalations = Array.isArray(doctorEscalationPrecision?.escalations)
    ? doctorEscalationPrecision.escalations
    : []
  const relevant = escalations
    .filter((item) => item?.level === 'urgent' || item?.level === 'doctor')
    .sort((a, b) => DOCTOR_ESCALATION_LEVEL_ORDER[a.level] - DOCTOR_ESCALATION_LEVEL_ORDER[b.level])
    .slice(0, DOCTOR_ESCALATION_MAX_ITEMS)

  if (!relevant.length) return null

  return (
    <SectionCard icon={Stethoscope} title={copy.doctorEscalationTitle} className="mb-6">
      <p className="mb-4 text-sm leading-6 text-slate-500">{copy.doctorEscalationIntro}</p>
      <div className="space-y-3">
        {relevant.map((item, index) => {
          const style = item.level === 'urgent' ? ACTION_PLAN_BUCKET_STYLE.critical : ACTION_PLAN_BUCKET_STYLE.warning
          const Icon = style.icon
          const levelLabel = copy.doctorEscalationLevelLabels?.[item.level]
          const timingLabel = copy.doctorEscalationTimingLabels?.[item.recommended_timing]
          const markers = asTextList(item.related_markers).slice(0, 6)
          return (
            <div key={item.id || index} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${style.badge}`}>
                <Icon className="h-3.5 w-3.5" /> {levelLabel}
              </div>
              {!!item.human_readable_reason && (
                <p className="text-sm leading-6 text-slate-700">{item.human_readable_reason}</p>
              )}
              {!!markers.length && (
                <p className="mt-2 text-sm leading-5 text-slate-600">
                  <span className="font-semibold text-slate-800">{copy.doctorEscalationMarkersLabel}:</span> {markers.join(', ')}
                </p>
              )}
              {!!timingLabel && (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{timingLabel}</p>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">{copy.doctorEscalationDisclaimer}</p>
    </SectionCard>
  )
}

const REASONING_SAFETY_BADGE = {
  high_confidence_urgent: 'border-rose-200 bg-rose-50 text-rose-700',
  doctor_only: 'border-rose-200 bg-rose-50 text-rose-700',
  moderate_confidence: 'border-amber-200 bg-amber-50 text-amber-800',
  low_confidence: 'border-slate-200 bg-slate-100 text-slate-600',
  blocked_by_missing_data: 'border-slate-200 bg-slate-100 text-slate-600',
}

// Surfaces the clinical_reasoning_trace object the backend now assembles
// per detected pattern (see backend/app/services/clinical_reasoning_trace.py):
// what matched, how confident, what still argues against it, what's
// missing, and what to test next — a transparent chain instead of a single
// opaque recommendation. Reads from the same data every other card on this
// page already gets via the /results response (final_analysis fallback).
function ReasoningTraceCard({ trace, copy }) {
  const confidence = formatPercent(trace?.confidence)
  const safetyKey = String(trace?.safety_level || '').trim()
  const safetyLabel = copy.reasoningSafety?.[safetyKey]
  const badgeClass = REASONING_SAFETY_BADGE[safetyKey] || 'border-slate-200 bg-slate-100 text-slate-600'
  const supporting = asTextList(trace?.supporting_markers).slice(0, 5)
  const contradicting = asTextList(trace?.contradicting_markers).slice(0, 4)
  const gaps = dedupeTextList(asTextList(trace?.evidence_gaps)).slice(0, 4)
  const nextTests = asTextList(trace?.next_best_tests).slice(0, 4)
  const matchedBiomarkers = asTextList(trace?.matched_biomarkers).slice(0, 5)

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-950">
          {trace?.user_explanation?.headline || trace?.pattern_name || trace?.pattern_id}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {confidence && (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              {confidence} {copy.confidence}
            </span>
          )}
          {(trace?.doctor_flag || safetyLabel) && (
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
              {trace?.doctor_flag ? copy.reasoningDoctorFlag : safetyLabel}
            </span>
          )}
        </div>
      </div>

      {!!trace?.user_explanation?.summary && (
        <p className="mt-2 text-sm leading-6 text-slate-600">{trace.user_explanation.summary}</p>
      )}

      {!!matchedBiomarkers.length && (
        <p className="mt-3 text-sm leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">{copy.reasoningBasedOn}:</span> {matchedBiomarkers.join(', ')}
        </p>
      )}
      {!!supporting.length && (
        <p className="mt-2 text-sm leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">{copy.reasoningSupporting}:</span> {supporting.join(', ')}
        </p>
      )}
      {!!contradicting.length && (
        <p className="mt-2 text-sm leading-5 text-amber-800">
          <span className="font-semibold">{copy.reasoningContradicting}:</span> {contradicting.join(', ')}
        </p>
      )}
      {!!gaps.length && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <HelpCircle className="h-3.5 w-3.5" /> {copy.reasoningGaps}
          </p>
          <ul className="mt-1 space-y-1 text-sm leading-5 text-slate-600">
            {gaps.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      )}
      {!!nextTests.length && (
        <p className="mt-3 text-sm leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">{copy.reasoningNextTests}:</span> {nextTests.join(', ')}
        </p>
      )}
    </div>
  )
}

const PROGRESS_STATUS_META = {
  strengthened: { icon: TrendingUp, badge: 'border-amber-200 bg-amber-50 text-amber-800', labelKey: 'progressStrengthened' },
  weakened: { icon: TrendingDown, badge: 'border-emerald-200 bg-emerald-50 text-emerald-700', labelKey: 'progressWeakened' },
  new_signal: { icon: TrendingUp, badge: 'border-rose-200 bg-rose-50 text-rose-700', labelKey: 'progressNew' },
  resolved_or_improved: { icon: CheckCircle2, badge: 'border-emerald-200 bg-emerald-50 text-emerald-700', labelKey: 'progressResolved' },
  stable: { icon: RefreshCw, badge: 'border-slate-200 bg-slate-100 text-slate-600', labelKey: 'progressStable' },
}

// Surfaces progress_intelligence (see backend/app/services/progress_intelligence.py):
// a per-pattern diff of THIS upload's clinical_reasoning_traces against the
// user's previous upload — the pattern-level counterpart to the
// biomarker-level trend cards already shown elsewhere on this page.
function ProgressIntelligenceSection({ progress, copy }) {
  if (!progress) return null
  const changes = Array.isArray(progress.changes) ? progress.changes : []

  return (
    <SectionCard icon={TrendingUp} title={copy.progressTitle} className="mb-6">
      <p className="mb-4 text-sm leading-6 text-slate-500">{copy.progressIntro}</p>
      {!progress.available || !changes.length ? (
        <p className="text-sm leading-6 text-slate-600">{copy.progressNoPrevious}</p>
      ) : (
        <div className="space-y-3">
          {changes.slice(0, 8).map((change, index) => {
            const meta = PROGRESS_STATUS_META[change.status] || PROGRESS_STATUS_META.stable
            const Icon = meta.icon
            const currentPct = formatPercent(change.current_confidence)
            const previousPct = formatPercent(change.previous_confidence)
            return (
              <div key={change.pattern_id || index} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${meta.badge}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-950">{change.pattern_name || change.pattern_id}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>{copy[meta.labelKey]}</span>
                  </div>
                  {(currentPct || previousPct) && (
                    <p className="mt-1 text-sm text-slate-500">
                      {copy.confidence}: {copy.progressConfidenceWas(previousPct || '—', currentPct || '—')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}

// Standalone "What We Can't Say Yet" block, sourced from the report-level
// evidence_gaps object (backend/app/services/evidence_gaps.py) rather than
// the per-pattern subset already shown inside each Reasoning Trace card.
// Report-level gaps include entries with no detected pattern at all yet —
// knowledge_coverage (measured but no active rule interprets it),
// data_quality (unit/profile issues), and domain-expected markers that
// were never drawn — none of which live inside any single trace card.
// P31e: backend evidence-gap/testing-plan entries often reuse one of a
// handful of generic boilerplate sentences across many items (e.g. the
// same "add or review this context" line for ten different markers) --
// repeating that sentence under every single card is the literal
// repetition flagged in the P31c QA pass. When any text repeats across
// two or more items, this drops it from the per-item cards and lists
// each distinct message once at the end instead; a report where every
// item's message is genuinely unique is left per-item, unchanged. Pure
// presentation grouping over already-fetched data -- never mutates the
// source list or re-fetches anything. Shared by EvidenceGapsSection and
// TestingPlanSection.
function collapseRepeatedNotes(values) {
  const present = values.filter(Boolean)
  const distinct = [...new Set(present)]
  return { distinct, hasRepeats: present.length > distinct.length }
}

function EvidenceGapsSection({ evidenceGaps, copy }) {
  const gaps = Array.isArray(evidenceGaps?.gaps) ? evidenceGaps.gaps : []
  if (!gaps.length) {
    return (
      <SectionCard icon={HelpCircle} title={copy.evidenceGapsTitle} className="mb-6">
        <p className="text-sm leading-6 text-slate-600">{copy.evidenceGapsEmpty}</p>
      </SectionCard>
    )
  }

  const visibleGaps = gaps.slice(0, 12)
  const { distinct: distinctSteps, hasRepeats } = collapseRepeatedNotes(visibleGaps.map((g) => g?.suggested_next_step))

  return (
    <SectionCard icon={HelpCircle} title={copy.evidenceGapsTitle} className="mb-6">
      <p className="mb-4 text-sm leading-6 text-slate-500">{copy.evidenceGapsIntro}</p>
      <div className="space-y-2">
        {visibleGaps.map((gap, index) => {
          const domainLabel = copy.evidenceGapDomainLabels?.[gap?.domain] || gap?.domain
          const isHighPriority = gap?.priority === 'high'
          return (
            <div key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-950">
                  {gap?.missing_marker ? gap.missing_marker : domainLabel}
                </span>
                {isHighPriority && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {copy.evidenceGapsHighPriority}
                  </span>
                )}
              </div>
              {!!gap?.reason && <p className="mt-1 text-sm leading-5 text-slate-600">{String(gap.reason).replaceAll('_', ' ')}</p>}
              {!!gap?.suggested_next_step && !hasRepeats && (
                <p className="mt-1 text-xs text-slate-500">{gap.suggested_next_step}</p>
              )}
            </div>
          )
        })}
      </div>
      {hasRepeats && !!distinctSteps.length && (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
          {distinctSteps.map((step, index) => <li key={index}>{step}</li>)}
        </ul>
      )}
    </SectionCard>
  )
}

const TESTING_PRIORITY_BADGE = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-slate-200 bg-slate-100 text-slate-600',
}
const TESTING_PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

// Merges the report-level next_best_tests (globally ranked across every
// domain — previously only ever shown as a per-pattern, unranked subset
// inside trace cards) with the existing knowledge-report retest_plan
// (which has timing, next_best_tests does not) into one deduplicated,
// priority-sorted plan — a single canonical "what to test and when"
// instead of the same marker potentially appearing in several places
// with no consistent priority ordering.
function buildTestingPlan(nextBestTests, retestPlan) {
  const byMarker = new Map()
  for (const item of Array.isArray(nextBestTests?.recommended_tests) ? nextBestTests.recommended_tests : []) {
    const marker = String(item?.marker || '').trim()
    if (!marker) continue
    byMarker.set(marker.toLowerCase(), {
      marker,
      domain: item?.domain,
      priority: String(item?.priority || 'medium').toLowerCase(),
      reason: item?.reason,
      timing: null,
    })
  }
  for (const item of Array.isArray(retestPlan) ? retestPlan : []) {
    const marker = String(item?.marker || '').trim()
    if (!marker) continue
    const key = marker.toLowerCase()
    const existing = byMarker.get(key)
    if (existing) {
      existing.timing = item?.timing || existing.timing
      existing.reason = existing.reason || item?.reason
    } else {
      byMarker.set(key, {
        marker,
        domain: null,
        priority: String(item?.priority || 'medium').toLowerCase(),
        reason: item?.reason,
        timing: item?.timing,
      })
    }
  }
  return [...byMarker.values()].sort(
    (a, b) => (TESTING_PRIORITY_RANK[a.priority] ?? 1) - (TESTING_PRIORITY_RANK[b.priority] ?? 1)
  )
}

function formatBaselineValue(value, unit) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  const rounded = Math.abs(num) >= 100 ? Math.round(num) : Math.round(num * 100) / 100
  return `${rounded}${unit ? ` ${unit}` : ''}`
}

// Surfaces personal_baseline (backend/app/services/personal_baseline.py):
// a personal historical mean per marker, and — the actual differentiator —
// a "silent_signal" flag for a marker the lab calls normal but that has
// drifted meaningfully from the user's own typical range. Only rendered
// once there's enough repeat history to say anything (personal_baseline
// itself is unavailable until then).
function PersonalBaselineSection({ personalBaseline, copy, isUk }) {
  if (!personalBaseline?.available) return null
  const markers = Array.isArray(personalBaseline.markers) ? personalBaseline.markers : []
  if (!markers.length) return null
  const silentSignals = markers.filter((m) => m?.silent_signal)
  const others = markers.filter((m) => !m?.silent_signal)

  const renderRow = (marker, index) => (
    <div key={marker.canonical_name || index} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-950">{displayBiomarkerName({ name: marker.name }, isUk)}</span>
        <span className="text-sm font-semibold text-slate-700">{formatBaselineValue(marker.current_value, marker.unit)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {copy.baselineWas(formatBaselineValue(marker.personal_baseline_value, marker.unit))} · {copy.baselineHistoryPoints(marker.history_points)}
      </p>
    </div>
  )

  return (
    <SectionCard icon={TrendingUp} title={copy.baselineTitle} className="mb-6">
      <p className="mb-4 text-sm leading-6 text-slate-500">{copy.baselineIntro}</p>
      {!!silentSignals.length && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {copy.baselineSilentSignalLabel}
            </span>
          </div>
          <p className="mb-2 text-sm leading-6 text-slate-500">{copy.baselineSilentSignalIntro}</p>
          <div className="space-y-2">{silentSignals.map(renderRow)}</div>
        </div>
      )}
      {!!others.length && (
        <div>
          {!!silentSignals.length && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.baselineOtherLabel}</p>}
          <div className="space-y-2">{others.slice(0, 8).map(renderRow)}</div>
        </div>
      )}
    </SectionCard>
  )
}

function TestingPlanSection({ nextBestTests, retestPlan, nextTestFunnel, copy, isUk }) {
  const plan = buildTestingPlan(nextBestTests, retestPlan)
  // P12 Next-Test Funnel: the only genuinely new signal vs the P4 plan
  // above — which previously-suggested tests have since been completed.
  // Shown as a banner on the SAME section rather than a separate card, to
  // avoid duplicating the testing-plan surface P4 already built.
  const completed = Array.isArray(nextTestFunnel?.completed_since_last_upload)
    ? nextTestFunnel.completed_since_last_upload
    : []
  const visiblePlan = plan.slice(0, 10)
  // P31e: same repeated-boilerplate pattern as EvidenceGapsSection above
  // (e.g. "Repeat timing should be based on clinician review..." reused
  // across several markers) -- collapse into one shared list instead of
  // repeating per card.
  const { distinct: distinctReasons, hasRepeats: reasonsRepeat } = collapseRepeatedNotes(visiblePlan.map((item) => item.reason))
  return (
    <SectionCard icon={RefreshCw} title={copy.testingPlanTitle} className="mb-6">
      <p className="mb-4 text-sm leading-6 text-slate-500">{copy.testingPlanIntro}</p>
      {!!completed.length && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-800">{copy.testingPlanCompletedTitle}</p>
          <p className="mt-1 text-sm leading-5 text-emerald-700">
            {completed.map((item) => displayBiomarkerName({ name: item.marker }, isUk)).join(', ')}
          </p>
        </div>
      )}
      {visiblePlan.length ? (
        <div className="space-y-2">
          {visiblePlan.map((item, index) => (
            <div key={`${item.marker}-${index}`} className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-slate-950">{displayBiomarkerName({ name: item.marker }, isUk)}</span>
                {!!item.reason && !reasonsRepeat && <p className="mt-1 text-sm leading-5 text-slate-600">{item.reason}</p>}
                {!!item.timing && (
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-semibold">{copy.testingPlanTiming}:</span> {item.timing}
                  </p>
                )}
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${TESTING_PRIORITY_BADGE[item.priority] || TESTING_PRIORITY_BADGE.medium}`}>
                {copy.testingPlanPriority[item.priority] || copy.testingPlanPriority.medium}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-slate-600">{copy.testingPlanEmpty}</p>
      )}
      {reasonsRepeat && !!distinctReasons.length && (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
          {distinctReasons.map((reason, index) => <li key={index}>{reason}</li>)}
        </ul>
      )}
    </SectionCard>
  )
}

const MAP_ACTION_BUCKET_STYLE = {
  urgent: 'border-rose-200 bg-rose-50 text-rose-700',
  doctor: 'border-amber-200 bg-amber-50 text-amber-800',
  practitioner: 'border-sky-200 bg-sky-50 text-sky-700',
  self: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

// P18 Clinical Reasoning Map: a compact "how VITALOOP connected the dots"
// card per top hypothesis (backend/app/services/hypothesis_engine.py,
// calibrated by confidence_calibration.py), showing supporting evidence,
// what limits confidence (contradictions + evidence gaps), what could
// reduce uncertainty next, and who should act — a summary of P14-P17,
// not a duplicate of the detailed Clinical Reasoning / Evidence Gaps
// sections already below it on this page.
function ClinicalReasoningMapCard({ card, copy }) {
  const bucketLabel = copy.mapActionBucket?.[card.actionBucket]
  const bucketBadge = MAP_ACTION_BUCKET_STYLE[card.actionBucket] || 'border-slate-200 bg-slate-100 text-slate-600'
  const confidenceLabel = card.confidenceLabel ? copy.mapConfidenceLabel?.[card.confidenceLabel] || card.confidenceLabel : null
  const scorePct = formatPercent(card.confidenceScore)

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-950">{card.title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {confidenceLabel && (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              {copy.mapConfidence}: {confidenceLabel}{scorePct ? ` (${scorePct})` : ''}
            </span>
          )}
          {bucketLabel && (
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${bucketBadge}`}>{bucketLabel}</span>
          )}
        </div>
      </div>

      {!!card.hypothesis && <p className="mt-2 text-sm leading-6 text-slate-600">{card.hypothesis}</p>}

      {!!card.symptoms.length && (
        <p className="mt-3 text-sm leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">{copy.mapContext}:</span> {card.symptoms.join(', ')}
        </p>
      )}
      {!!card.supportingMarkers.length && (
        <p className="mt-2 text-sm leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">{copy.mapWhatSupports}:</span> {card.supportingMarkers.join(', ')}
        </p>
      )}
      {!!(card.contradictions.length || card.evidenceGaps.length) && (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{copy.mapWhatLimits}</p>
          <ul className="mt-1 space-y-1 text-sm leading-5 text-amber-900">
            {[...card.contradictions, ...card.evidenceGaps].slice(0, 5).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {!!card.nextTests.length && (
        <p className="mt-3 text-sm leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">{copy.mapNextTests}:</span> {card.nextTests.join(', ')}
        </p>
      )}
    </div>
  )
}

function ClinicalReasoningMapSection({
  clinicalHypotheses,
  clinicalContradictions,
  reasoningTraces,
  evidenceGaps,
  actionPlanByRole,
  negativeEvidence,
  copy,
}) {
  const map = useMemo(
    () =>
      buildClinicalReasoningMap({
        clinicalHypotheses,
        clinicalContradictions,
        reasoningTraces,
        evidenceGaps,
        actionPlanByRole,
        negativeEvidence,
      }),
    [clinicalHypotheses, clinicalContradictions, reasoningTraces, evidenceGaps, actionPlanByRole, negativeEvidence]
  )

  // Nothing to show at all — no hypotheses AND no negative-evidence domain
  // summary either (e.g. an old report from before P14-P17 existed).
  // Hide the whole section rather than render an empty shell.
  if (!map.cards.length && !map.stableDomains.length && !map.underTestedDomains.length) return null

  return (
    <SectionCard icon={Network} title={copy.mapTitle} className="mb-6">
      <p className="mb-4 text-sm leading-6 text-slate-500">{copy.mapIntro}</p>
      {map.cards.length ? (
        <div className="space-y-3">
          {map.cards.map((card) => (
            <ClinicalReasoningMapCard key={card.id} card={card} copy={copy} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p>
            {map.stableDomains.length || map.underTestedDomains.length
              ? copy.mapEmptyWithDomains(map.stableDomains.length, map.underTestedDomains.length)
              : copy.mapEmptyNoDomains}
          </p>
          {!!map.stableDomains.length && (
            <p className="mt-2 text-xs text-slate-500">
              <span className="font-semibold">{copy.mapStableDomains}:</span>{' '}
              {map.stableDomains.map((d) => localizeDomainLabel(d.domain, copy)).join(', ')}
            </p>
          )}
          {!!map.underTestedDomains.length && (
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-semibold">{copy.mapUnderTestedDomains}:</span>{' '}
              {map.underTestedDomains.map((d) => localizeDomainLabel(d.domain, copy)).join(', ')}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// P31b: raw per-pattern trace cards are the pattern engine's own debug-
// level output (see P31a audit) -- kept available, but collapsed behind
// a <details> disclosure by default so it doesn't compete with the
// already-concise ClinicalReasoningMapSection above for attention. The
// data is never removed, only hidden until the user opts in.
function ReasoningTraceSection({ traces, copy }) {
  const list = Array.isArray(traces) ? traces.filter(Boolean) : []
  if (!list.length) return null
  return (
    <details className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">{copy.reasoningTitle}</summary>
      <p className="mb-4 mt-3 text-sm leading-6 text-slate-500">{copy.reasoningIntro}</p>
      <div className="space-y-3">
        {list.slice(0, 6).map((trace, index) => (
          <ReasoningTraceCard key={trace?.pattern_id || index} trace={trace} copy={copy} />
        ))}
      </div>
    </details>
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
  const [reasoningTraces, setReasoningTraces] = useState([])
  const [progressIntelligence, setProgressIntelligence] = useState(null)
  const [evidenceGaps, setEvidenceGaps] = useState(null)
  const [nextBestTests, setNextBestTests] = useState(null)
  const [personalBaseline, setPersonalBaseline] = useState(null)
  const [actionPlanByRole, setActionPlanByRole] = useState(null)
  const [doctorEscalationPrecision, setDoctorEscalationPrecision] = useState(null)
  const [nextTestFunnel, setNextTestFunnel] = useState(null)
  const [clinicalHypotheses, setClinicalHypotheses] = useState(null)
  const [clinicalContradictions, setClinicalContradictions] = useState(null)
  const [negativeEvidence, setNegativeEvidence] = useState(null)
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
        setReasoningTraces(
          Array.isArray(data.clinical_reasoning_traces)
            ? data.clinical_reasoning_traces
            : Array.isArray(data.final_analysis?.clinical_reasoning_traces)
              ? data.final_analysis.clinical_reasoning_traces
              : []
        )
        setProgressIntelligence(data.progress_intelligence ?? data.final_analysis?.progress_intelligence ?? null)
        setEvidenceGaps(data.evidence_gaps ?? data.final_analysis?.evidence_gaps ?? null)
        setNextBestTests(data.next_best_tests ?? data.final_analysis?.next_best_tests ?? null)
        setPersonalBaseline(data.personal_baseline ?? data.final_analysis?.personal_baseline ?? null)
        setActionPlanByRole(data.action_plan_by_role ?? data.final_analysis?.action_plan_by_role ?? null)
        setDoctorEscalationPrecision(data.doctor_escalation_precision ?? data.final_analysis?.doctor_escalation_precision ?? null)
        setNextTestFunnel(data.next_test_funnel ?? data.final_analysis?.next_test_funnel ?? null)
        setClinicalHypotheses(data.clinical_hypotheses ?? data.final_analysis?.clinical_hypotheses ?? null)
        setClinicalContradictions(data.clinical_contradictions ?? data.final_analysis?.clinical_contradictions ?? null)
        setNegativeEvidence(data.negative_evidence ?? data.final_analysis?.negative_evidence ?? null)
        gaResultsView(uploadId)
      } catch (_e) {
        if (!active) return
        setBiomarkers([])
        setProtocol([])
        setShoppingLinks([])
        setKnowledgeReport(null)
        setFinalAnalysis(null)
        setExplainability(null)
        setSafetyResult(null)
        setReasoningTraces([])
        setProgressIntelligence(null)
        setEvidenceGaps(null)
        setNextBestTests(null)
        setPersonalBaseline(null)
        setActionPlanByRole(null)
        setDoctorEscalationPrecision(null)
        setNextTestFunnel(null)
        setClinicalHypotheses(null)
        setClinicalContradictions(null)
        setNegativeEvidence(null)
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
  const urgentWarning = safetyResult?.urgent_review_required
    ? (safetyResult?.prominent_user_warning || copy.urgentFallback)
    : null
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

        {/* P31b: removed the "Focus now / Watch list / Stable zone" row --
            it repeated the same counts/priority-marker name already shown
            in the hero header above (headline + 3-stat box), one of three
            redundant top-of-page overview widgets identified in the P31a
            audit. AnalysisCoreV2Panel below carries the remaining
            domain-level detail that isn't already in the hero. */}
        <AnalysisCoreV2Panel finalAnalysis={finalAnalysis} copy={copy} />

        {!!urgentWarning && (
          <div className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-5 text-rose-950 shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-5 w-5" />
              {copy.urgentSignal}
            </div>
            <p className="text-sm leading-6">{urgentWarning}</p>
          </div>
        )}

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

        <DoctorEscalationSection doctorEscalationPrecision={doctorEscalationPrecision} copy={copy} />

        <ActionPlanByRoleSection actionPlan={actionPlanByRole} copy={copy} />

        <ClinicalReasoningMapSection
          clinicalHypotheses={clinicalHypotheses}
          clinicalContradictions={clinicalContradictions}
          reasoningTraces={reasoningTraces}
          evidenceGaps={evidenceGaps}
          actionPlanByRole={actionPlanByRole}
          negativeEvidence={negativeEvidence}
          copy={copy}
        />

        <EvidenceGapsSection evidenceGaps={evidenceGaps} copy={copy} />

        <ReasoningTraceSection traces={reasoningTraces} copy={copy} />

        <TestingPlanSection nextBestTests={nextBestTests} retestPlan={reportRetest} nextTestFunnel={nextTestFunnel} copy={copy} isUk={isUk} />

        <SystemMapSection healthStates={finalAnalysis?.health_states} personalBaseline={personalBaseline} copy={copy} />

        <PersonalBaselineSection personalBaseline={personalBaseline} copy={copy} isUk={isUk} />

        {progressIntelligence?.available && <ProgressIntelligenceSection progress={progressIntelligence} copy={copy} />}

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

        {/* P31b: removed the legacy "Next steps / Today / This month /
            Doctor questions" cards (driven by pre-P9 knowledgeReport.
            action_plan/doctor_discussion) -- they duplicated
            ActionPlanByRoleSection/DoctorEscalationSection above with
            older, less calibrated copy. reportActions/reportDiscussion/
            reportRetest are kept as variables: still used by the PDF
            export above and (reportRetest) by TestingPlanSection below. */}

        <div className="mt-6">
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
        </div>
        {/* P31b: removed the duplicate "Retest" CoachCard here -- it
            repeated the same reportRetest data TestingPlanSection above
            already renders as this page's one primary testing/retest
            surface. */}

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

        {/* P31d: reserved space so the fixed floating support-chat button
            (App.jsx's FloatingSupportChat, bottom-right) never sits on top
            of the page's own last line of text once the user scrolls all
            the way down -- see P31c QA finding. Purely a page-bottom
            spacer; does not touch the widget itself. */}
        <div aria-hidden="true" className="h-28" />
      </div>
    </div>
  )
}
