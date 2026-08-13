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
  SearchCheck,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react'
import { isUkrainianLocale } from '../lib/locale.js'
import { biomarkerDisplayName, riskDisplayLabel } from '../lib/biomarker-display.js'
import { CoachBadge, CoachCard, CoachButton } from '../components/coach/CoachUI.jsx'

const STATUS_META = {
  DEFICIENT: { rank: 0, label: 'Below range', ukLabel: 'Нижче референсу', badge: 'bg-sky-50 text-sky-700 border-sky-200', card: 'border-sky-200 bg-sky-50/80 shadow-sky-100', dot: 'bg-sky-500' },
  ELEVATED: { rank: 1, label: 'Above range', ukLabel: 'Вище референсу', badge: 'bg-rose-50 text-rose-700 border-rose-200', card: 'border-rose-200 bg-rose-50/80 shadow-rose-100', dot: 'bg-rose-500' },
  BORDERLINE: { rank: 2, label: 'Worth watching', ukLabel: 'Потребує спостереження', badge: 'bg-amber-50 text-amber-700 border-amber-200', card: 'border-amber-200 bg-amber-50/80 shadow-amber-100', dot: 'bg-amber-500' },
  OPTIMAL: { rank: 3, label: 'In range', ukLabel: 'У референсі', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', card: 'border-emerald-200 bg-emerald-50/70 shadow-emerald-100', dot: 'bg-emerald-500' },
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
    reportSubtitle: 'What is happening, why it matters, and what to do next.',
    back: 'Back to Lab Results',
    export: 'Export summary',
    exporting: 'Preparing report...',
    downloadReport: 'Download report',
    reportFilePrefix: 'vitaloop-report',
    pdfTitle: 'VITALOOP Health Report',
    pdfSubtitle: 'Educational lab scan summary',
    pdfGenerated: 'Generated',
    pdfUploadId: 'Upload ID',
    pdfSummary: 'Summary',
    pdfKeyNumbers: 'Key numbers',
    pdfFindings: 'Top findings',
    pdfWhyMatters: 'Why this matters',
    pdfActionPlan: 'Next steps',
    pdfDoctorQuestions: 'Questions for your doctor',
    pdfRetestPlan: 'Retest plan',
    pdfBiomarkers: 'Detailed biomarkers',
    pdfSafety: 'Safety & disclaimer',
    pdfMarkersAnalyzed: 'Markers analyzed',
    pdfInRange: 'In range',
    pdfOutOfRange: 'Out of range',
    pdfFooter: 'Educational information only. Not a diagnosis or treatment plan.',
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
    notConfirmed: 'What this does not confirm',
    missingContext: 'Context still needed',
    nutritionContext: 'Nutrition context',
    reportQuality: 'Extraction quality',
    nutrientSignals: 'Nutrition context from KB',
    nutrientRequirements: 'Reference intake context',
    foodSources: 'Food sources to consider',
    safeBoundary: 'Safe boundary',
    noPattern: 'No deeper knowledge pattern matched this panel yet. Your biomarker table and status groups are still available below.',
    nextSteps: 'Next steps',
    nextBestStep: 'Your next best step',
    nextFallback: 'Save this report, compare it with your symptoms, and review meaningful changes with a clinician.',
    methodDetails: 'How VITALOOP reached this conclusion',
    methodDetailsBody: 'Open this only if you want to see the signals and safeguards behind the interpretation.',
    rangePosition: 'Position in reference range',
    belowLowerBound: 'below lower limit',
    aboveUpperBound: 'above upper limit',
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
    importantNow: 'Important now',
    importantNowBody: (count) => `${count} marker${count === 1 ? '' : 's'} outside the reference range. Review them as a pattern, not as isolated values.`,
    contextGap: 'Context gap',
    contextGapBody: 'The conclusion becomes stronger when related markers and symptoms are reviewed together.',
    safetyContext: 'Safety context',
    safetyContextBody: 'Use this report to prepare a clinician discussion. Do not start supplements from indirect markers alone.',
    watchListLabel: 'Watch list',
    noImmediate: 'No immediate out-of-range marker',
    stableZone: 'Stable zone',
    markersNearBorder: (count) => `${count} marker${count === 1 ? '' : 's'} near the border`,
    markersInRange: (count) => `${count} marker${count === 1 ? '' : 's'} in range`,
    whyThisAppears: 'Why this matters here',
    markerContext: 'Why this matters here',
    whyDefault: 'Connected to report signals and knowledge-base context. This is not a diagnosis.',
    evidenceSummary: 'Connected to report signals and knowledge-base context. This is not a diagnosis.',
    reviewTopFinding: 'Review the top finding and avoid starting high-dose supplements from one marker alone.',
    shoppingEyebrow: 'Suggested iHerb searches',
    shoppingTitle: 'Optional items to discuss before buying',
    shoppingBody: 'These are educational search shortcuts based on your report context. Confirm supplement choice, dose, and interactions with a qualified clinician.',
    findIherb: 'Find on iHerb',
    v2Eyebrow: 'Shared Analysis Core V2',
    domainsTitle: 'Health domain states',
    domainsBody: 'Domain-level interpretation from biomarkers, symptoms, profile context, and knowledge-base rules.',
    reportBasis: 'Signals behind the conclusion',
    reportBasisBody: 'This section shows which signals strengthened the interpretation, what context is missing, and where VITALOOP keeps the conclusion conservative.',
    keyInterpretation: 'Key interpretation',
    confidenceLabel: 'Confidence',
    safetyBoundary: 'Safety boundary',
    noSelfTreatment: 'Do not start supplements or treatment from this report alone. Use it to prepare a clinician discussion.',
    pediatricContext: 'Pediatric context',
    pediatricBody: 'For children, out-of-range markers should be interpreted with age, growth, symptoms, diet, and pediatric clinician review.',
    needsData: 'Data that would make this stronger',
    stableContext: 'Useful stable context',
    confirmatoryPlan: 'What to clarify next',
    evidenceGapsTitle: 'What would reduce uncertainty',
    evidenceGapsBody: 'These are missing markers or context that would make the interpretation stronger.',
    evidenceGapMarker: 'Missing marker',
    evidenceGapContext: 'Context',
    contextRequired: 'Context required',
    needsAttention: 'Needs attention',
    stablePattern: 'Stable pattern',
    domainWhyText: 'The available markers point to a pattern worth reviewing with symptoms, profile context, and a clinician when needed.',
    contextRetestTiming: 'Context-based timing',
    priorityAction: 'Priority action',
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
    risk: 'risk',
    confidence: 'confidence',
    upTo: 'up to',
    from: 'from',
  },
  uk: {
    hints: [
      'Починайте з пріоритетних показників, а не з усієї таблиці одразу.',
      'Використовуйте список питань до лікаря, щоб коротко обговорити результат.',
      'VITALOOP має освітній характер: допомагає структурувати наступний крок, але не ставить діагноз.',
    ],
    loading: 'Завантажуємо ваш звіт…',
    reportSubtitle: 'Що відбувається, чому це важливо і що робити далі.',
    back: 'До результатів',
    export: 'Експортувати підсумок',
    exporting: 'Готуємо звіт...',
    downloadReport: 'Скачати звіт',
    reportFilePrefix: 'vitaloop-zvit',
    pdfTitle: 'VITALOOP звіт здоровʼя',
    pdfSubtitle: 'Освітній підсумок сканування аналізів',
    pdfGenerated: 'Сформовано',
    pdfUploadId: 'ID завантаження',
    pdfSummary: 'Короткий висновок',
    pdfKeyNumbers: 'Ключові числа',
    pdfFindings: 'Головні знахідки',
    pdfWhyMatters: 'Чому це важливо',
    pdfActionPlan: 'Наступні кроки',
    pdfDoctorQuestions: 'Питання до лікаря',
    pdfRetestPlan: 'План повторної перевірки',
    pdfBiomarkers: 'Детальні біомаркери',
    pdfSafety: 'Безпека й застереження',
    pdfMarkersAnalyzed: 'Показників',
    pdfInRange: 'У референсі',
    pdfOutOfRange: 'Поза референсом',
    pdfFooter: 'Освітня інформація. Не є діагнозом або планом лікування.',
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
    notConfirmed: 'Що це не підтверджує',
    missingContext: 'Якого контексту бракує',
    nutritionContext: 'Харчовий контекст',
    reportQuality: 'Якість зчитування',
    nutrientSignals: 'Харчовий контекст із KB',
    nutrientRequirements: 'Контекст добових потреб',
    foodSources: 'Харчові джерела для обговорення',
    safeBoundary: 'Межа безпеки',
    noPattern: 'Глибший патерн із бази знань поки не знайдено. Таблиця показників і статуси доступні нижче.',
    nextSteps: 'Наступні кроки',
    nextBestStep: 'Ваш наступний найкращий крок',
    nextFallback: 'Збережіть цей звіт, порівняйте його із симптомами та обговоріть значущі зміни з лікарем.',
    methodDetails: 'Як VITALOOP дійшов цього висновку',
    methodDetailsBody: 'Відкрийте цей блок, якщо хочете побачити сигнали та перевірки безпеки за інтерпретацією.',
    rangePosition: 'Позиція у референсному діапазоні',
    belowLowerBound: 'нижче нижньої межі',
    aboveUpperBound: 'вище верхньої межі',
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
    importantNow: 'Що важливо зараз',
    importantNowBody: (count) => `${count} ${count === 1 ? 'показник поза референсом' : 'показники поза референсом'}. Їх варто дивитися як патерн, а не як ізольовані числа.`,
    contextGap: 'Чого бракує для сильного висновку',
    contextGapBody: 'Висновок стане точнішим, якщо переглянути повʼязані показники й симптоми разом.',
    safetyContext: 'Межа безпеки',
    safetyContextBody: 'Використайте звіт для розмови з лікарем. Не починайте добавки лише за непрямими маркерами.',
    watchListLabel: 'Спостереження',
    noImmediate: 'Немає термінового показника поза референсом',
    stableZone: 'Стабільна зона',
    markersNearBorder: (count) => `${count} ${count === 1 ? 'показник біля межі' : 'показників біля межі'}`,
    markersInRange: (count) => `${count} ${count === 1 ? 'показник у референсі' : 'показників у референсі'}`,
    whyThisAppears: 'Чому це важливо тут',
    markerContext: 'Чому це важливо тут',
    whyDefault: 'Повʼязано із сигналами звіту та контекстом бази знань. Це не діагноз.',
    evidenceSummary: 'Повʼязано із сигналами звіту та контекстом бази знань. Це не діагноз.',
    reviewTopFinding: 'Перегляньте головну знахідку й не починайте високі дози добавок лише за одним показником.',
    shoppingEyebrow: 'Пошук на iHerb',
    shoppingTitle: 'Опційні позиції для обговорення перед покупкою',
    shoppingBody: 'Це освітні пошукові посилання на основі вашого звіту. Підтвердьте вибір добавки, дозу й взаємодії з кваліфікованим фахівцем.',
    findIherb: 'Знайти на iHerb',
    v2Eyebrow: 'Ядро аналізу V2',
    domainsTitle: 'Доменний стан здоровʼя',
    domainsBody: 'Доменна інтерпретація на основі біомаркерів, симптомів, профілю та правил бази знань.',
    reportBasis: 'Сигнали за висновком',
    reportBasisBody: 'Тут видно, що посилило інтерпретацію, якого контексту бракує і де VITALOOP навмисно залишає висновок обережним.',
    keyInterpretation: 'Ключова інтерпретація',
    confidenceLabel: 'Впевненість',
    safetyBoundary: 'Межа безпеки',
    noSelfTreatment: 'Не починайте добавки або лікування лише за цим звітом. Використайте його для підготовки до розмови з лікарем.',
    pediatricContext: 'Дитячий контекст',
    pediatricBody: 'Для дітей показники поза референсом потрібно оцінювати з урахуванням віку, росту, симптомів, харчування та консультації педіатра.',
    needsData: 'Дані, які зроблять висновок сильнішим',
    stableContext: 'Корисний стабільний контекст',
    confirmatoryPlan: 'Що уточнити далі',
    evidenceGapsTitle: 'Що зменшить невизначеність',
    evidenceGapsBody: 'Це показники або контекст, яких бракує для сильнішої інтерпретації.',
    evidenceGapMarker: 'Бракує показника',
    evidenceGapContext: 'Контекст',
    contextRequired: 'Потрібен контекст',
    needsAttention: 'Потребує уваги',
    stablePattern: 'Стабільний патерн',
    domainWhyText: 'Доступні показники формують патерн, який варто переглянути разом із симптомами, профілем і лікарем за потреби.',
    contextRetestTiming: 'Строк залежить від контексту',
    priorityAction: 'Пріоритетна дія',
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
    risk: 'ризик',
    confidence: 'впевненість',
    upTo: 'до',
    from: 'від',
  },
}

const UA_REPORT_PHRASES = [
  [/^Low Transferrin Saturation$/i, 'Низька сатурація трансферину'],
  [/^Low Serum Iron$/i, 'Низький рівень сироваткового заліза'],
  [/^Repeat Iron Panel$/i, 'Повторити панель заліза'],
  [/^Iron-Rich Diet Guidance$/i, 'Харчування з джерелами заліза'],
  [/^Iron Supplementation Review$/i, 'Перегляд потреби в препаратах заліза'],
  [/^Vitamin C$/i, 'Вітамін C'],
  [/^B12 and folate support$/i, 'Підтримка B12 і фолатів'],
  [/^blocked$/i, 'потребує медичного перегляду'],
  [/^approved_with_warnings$/i, 'схвалено із застереженнями'],
  [/^approved$/i, 'освітній висновок'],
  [/^Very low vitamin D$/i, 'Дуже низький рівень вітаміну D'],
  [/^Low vitamin D$/i, 'Низький рівень вітаміну D'],
  [/^Review very low vitamin D follow-up$/i, 'Перегляньте подальші кроки щодо дуже низького рівня вітаміну D'],
  [/^Plan retesting based on symptoms, clinician guidance, and the marker involved\.$/i, 'Плануйте повторну перевірку з урахуванням симптомів, рекомендацій лікаря та конкретного показника.'],
  [/^CBC: hemoglobin, RBC, hematocrit, MCV, MCH, MCHC, RDW$/i, 'ЗАК: гемоглобін, RBC, гематокрит, MCV, MCH, MCHC, RDW'],
  [/^Ferritin \+ transferrin saturation \+ serum iron$/i, 'Феритин + сатурація трансферину + сироваткове залізо'],
  [/^Vitamin B12 \+ folate$/i, 'Вітамін B12 + фолат'],
  [/^CRP or inflammation context when relevant$/i, 'CRP або контекст запалення, якщо це релевантно'],
  [/^educational$/i, 'освітній висновок'],
  [/^manual entry$/i, 'Ручне введення'],
  [/^Health domain$/i, 'Домен здоровʼя'],
  [/^Shared Analysis Core V2$/i, 'Ядро аналізу V2'],
]

function localizeReportText(value, isUk) {
  if (value == null) return value
  if (typeof value !== 'string') return value
  let text = value
    .replace(/Consider oral iron supplementation \(e\.g\., ferrous sulfate 325 mg TID with food\) after confirming iron-deficiency etiology\. Re-check CBC and ferritin after 8 weeks\./gi, isUk ? 'Не починайте препарати заліза самостійно. Для дитини форму, потребу і дозу має визначити лікар або педіатр після підтвердження причини дефіциту. Повторну оцінку CBC і феритину узгодьте з лікарем.' : 'Do not start iron supplements on your own. Confirm the need, form, dose, interactions, and follow-up timing with a qualified clinician before using iron.')
    .replace(/\(e\.g\.,\s*ferrous sulfate 325 mg TID with food\)/gi, isUk ? '(форму та дозу потрібно узгодити з лікарем)' : '(confirm form and dose with a clinician)')
    .replace(/\bferrous sulfate\s+\d+(?:[.,]\d+)?\s*mg\s+TID\b/gi, isUk ? 'препарат заліза у дозі, визначеній лікарем' : 'an iron supplement dose selected by a clinician')
    .replace(/\bTID\b/gi, isUk ? 'за схемою лікаря' : 'on a clinician-directed schedule')
  if (!isUk) return text
  for (const [pattern, replacement] of UA_REPORT_PHRASES) {
    text = text.replace(pattern, replacement)
  }
  return text
    .replace(/Transferrin saturation \(([^)]+)\) is below 20%, indicating that a significant proportion of binding capacity is unfilled\./gi, 'Сатурація трансферину ($1) нижче 20%, що може свідчити про недостатнє насичення трансферину залізом.')
    .replace(/Transferrin saturation is low, consistent with iron deficiency\./gi, 'Сатурація трансферину низька, що може відповідати дефіциту заліза.')
    .replace(/Serum iron \(([^)]+)\) is below the lower reference limit\. Correlate with ferritin and TIBC\./gi, 'Сироваткове залізо ($1) нижче нижньої межі. Варто оцінювати разом із феритином і TIBC та обговорити з лікарем.')
    .replace(/Serum iron is low — may indicate iron deficiency or redistribution in chronic disease\./gi, 'Сироваткове залізо низьке. Це може вказувати на дефіцит заліза або перерозподіл заліза при хронічному запальному процесі; варто оцінювати разом із лікарем.')
    .replace(/Re-measure serum iron, TIBC, transferrin saturation and ferritin simultaneously to evaluate iron stores and transport capacity\./gi, 'Повторно перевірте сироваткове залізо, TIBC, сатурацію трансферину та феритин одночасно, щоб оцінити запаси й транспорт заліза.')
    .replace(/Re-measure serum iron, TIBC, transferrin saturation, ferritin and CBC after dietary or clinical intervention\./gi, 'Повторно перевірте сироваткове залізо, TIBC, сатурацію трансферину, феритин і CBC після узгоджених із лікарем кроків.')
    .replace(/Increase dietary heme iron \(red meat, poultry, fish\) and non-heme sources \(legumes, leafy greens\)\. Combine with vitamin C to improve absorption; avoid tea and calcium-rich foods within 1 h of iron meals\./gi, 'Додайте харчові джерела гемового заліза (мʼясо, птиця, риба) і негемового заліза (бобові, зелень). Поєднуйте з вітаміном C для кращого засвоєння; чай і продукти з високим вмістом кальцію краще не вживати протягом 1 години поруч із такими прийомами їжі.')
    .replace(/Increase dietary heme iron \(red meat, liver, shellfish\) and non-heme iron with vitamin C; avoid tea\/coffee around iron-rich meals\./gi, 'Додайте харчові джерела заліза та поєднуйте рослинні джерела з вітаміном C; чай і каву краще не вживати поруч із прийомами їжі, багатими на залізо.')
    .replace(/Can support iron absorption; consider vitamin C-rich foods first\./gi, 'Може підтримувати засвоєння заліза; спершу варто розглянути продукти, багаті на вітамін C.')
    .replace(/Useful search context when CBC pattern suggests anemia workup; confirm labs first\./gi, 'Може бути корисним контекстом для пошуку, якщо CBC вказує на потребу оцінки анемії; спершу підтвердьте потрібні аналізи з лікарем.')
    .replace(/Vitamin D value \(([^)]+)\) is very low and may require focused follow-up, context review, and repeat testing\./gi, 'Рівень вітаміну D ($1) дуже низький і може потребувати цільового перегляду, оцінки контексту та повторного аналізу.')
    .replace(/Vitamin D value \(([^)]+)\) may indicate possible insufficiency\. Consider discussing with a clinician\./gi, 'Рівень вітаміну D ($1) може вказувати на можливу недостатність. Варто обговорити це з лікарем.')
    .replace(/Very low vitamin D should be reviewed with context such as sun exposure, diet, malabsorption risk, medications, calcium status, and follow-up testing interval\./gi, 'Дуже низький рівень вітаміну D варто переглядати з урахуванням сонячної експозиції, харчування, ризику мальабсорбції, ліків, статусу кальцію та строку повторного аналізу.')
    .replace(/Relevant to low ferritin or iron-status context; confirm need and dose with a clinician\./gi, 'Може бути релевантно при низькому феритині або контексті статусу заліза. Потребу й дозу підтвердьте з лікарем.')
    .replace(/Discuss pattern: Low vitamin D\./gi, 'Обговоріть патерн: низький рівень вітаміну D.')
    .replace(/Discuss pattern: Very low vitamin D\./gi, 'Обговоріть патерн: дуже низький рівень вітаміну D.')
    .replace(/Discuss pattern: Low Serum Iron\./gi, 'Обговоріть патерн: низький рівень сироваткового заліза.')
    .replace(/Discuss pattern: Low Transferrin Saturation\./gi, 'Обговоріть патерн: низька сатурація трансферину.')
    .replace(/Low Serum Iron/gi, 'низький рівень сироваткового заліза')
    .replace(/Low Transferrin Saturation/gi, 'низька сатурація трансферину')
    .replace(/Low vitamin D/gi, 'низький рівень вітаміну D')
    .replace(/Very low vitamin D/gi, 'дуже низький рівень вітаміну D')
    .replace(/Iron bisglycinate/gi, 'Бісгліцинат заліза')
    .replace(/analysis_quality_snapshot_v1/gi, 'знімок якості аналізу v1')
    .replace(/lab_analysis_pipeline_v1/gi, 'пайплайн аналізу лабораторних даних v1')
    .replace(/health_state_engine_v1/gi, 'ядро стану здоровʼя v1')
    .replace(/managed_seed_v1/gi, 'керована база правил v1')
    .replace(/health_context_v1/gi, 'контекст здоровʼя v1')
    .replace(/risk:/gi, 'ризик:')
    .replace(/Data used:/gi, 'Які дані використані:')
    .replace(/Missing data:/gi, 'Бракує даних:')
}

function localizeReportObject(value, isUk) {
  if (value == null) return value
  if (typeof value === 'string') return localizeReportText(value, isUk)
  if (Array.isArray(value)) return value.map((item) => localizeReportObject(item, isUk))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeReportObject(item, isUk)]))
  }
  return value
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
  const { ref_low: low, ref_high: high } = normalizeReferenceBounds(biomarker)
  const value = parseNumericValue(biomarker?.value)
  if (!Number.isFinite(value)) return 'BORDERLINE'
  if (low != null && value < low) return 'DEFICIENT'
  if (high != null && value > high) return 'ELEVATED'
  if (low == null || high == null) return 'OPTIMAL'
  const span = high - low
  if (value <= low + span * 0.15 || value >= high - span * 0.15) return 'BORDERLINE'
  return 'OPTIMAL'
}

function normalizeBiomarkerStatus(biomarker) {
  if (normalizeReferenceBounds(biomarker).inverted) return inferStatusFromRange(biomarker)
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

function parseNumericValue(value) {
  if (value == null) return NaN
  if (typeof value === 'number') return value
  const normalized = String(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  return normalized ? Number.parseFloat(normalized[0]) : NaN
}

function normalizeReferenceBounds(biomarker) {
  const low = parseNumericValue(biomarker?.ref_low)
  const high = parseNumericValue(biomarker?.ref_high)
  const hasLow = biomarker?.ref_low != null && Number.isFinite(low)
  const hasHigh = biomarker?.ref_high != null && Number.isFinite(high)
  if (hasLow && hasHigh && low > high) {
    return { ref_low: null, ref_high: high, inverted: true }
  }
  return {
    ref_low: hasLow ? low : null,
    ref_high: hasHigh ? high : null,
    inverted: false,
  }
}

function formatRange(biomarker, copy = RESULTS_COPY.en) {
  const { ref_low: low, ref_high: high } = normalizeReferenceBounds(biomarker)
  const unit = biomarker?.unit ? ` ${biomarker.unit}` : ''
  if (low == null && high == null) return copy.noRange
  if (low == null) return `${copy.upTo} ${high}${unit}`
  if (high == null) return `${copy.from} ${low}${unit}`
  return `${low} - ${high}${unit}`
}

function includesCorrectedRangeMarker(value, correctedNames) {
  if (!correctedNames?.size) return false
  const text = typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? Object.values(value).join(' ')
      : String(value || '')
  const normalizedText = text.toLowerCase()
  return [...correctedNames].some((name) => name && normalizedText.includes(name.toLowerCase()))
}

function getStatusLabel(status, isUk) {
  const meta = STATUS_META[String(status || '').toUpperCase()] || STATUS_META.BORDERLINE
  return isUk ? meta.ukLabel || meta.label : meta.label
}

function itemToReportText(item) {
  if (!item) return ''
  if (typeof item === 'string') return item
  if (typeof item !== 'object') return String(item)
  return [
    item.title || item.marker || item.label || item.name,
    item.body || item.summary || item.reason || item.why_it_matters || item.what_this_means?.[0] || item.timing,
  ].filter(Boolean).join(' - ')
}

function actionTimeframeLabel(timeframe, copy) {
  const key = String(timeframe || '').toLowerCase()
  if (key === 'today') return copy.today
  if (key === 'this_week') return copy.thisWeek
  if (key === 'this_month') return copy.thisMonth
  if (key === 'next') return copy.confirmatoryPlan
  return copy.nextSteps
}

function confidencePercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return `${Math.round(number * (number <= 1 ? 100 : 1))}%`
}

function safeReportFilename(prefix, uploadId) {
  const safePrefix = String(prefix || 'vitaloop-report').replace(/[^a-zA-Z0-9_-]/g, '-')
  const safeUpload = String(uploadId || 'result').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12)
  return `${safePrefix}-${safeUpload || 'result'}-${new Date().toISOString().slice(0, 10)}.pdf`
}

async function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return window.btoa(binary)
}

async function registerNotoSans(pdf) {
  try {
    const [regular, bold] = await Promise.all([
      fetch('/fonts/NotoSans-Regular.ttf').then((res) => res.arrayBuffer()),
      fetch('/fonts/NotoSans-Bold.ttf').then((res) => res.arrayBuffer()),
    ])
    pdf.addFileToVFS('NotoSans-Regular.ttf', await arrayBufferToBase64(regular))
    pdf.addFileToVFS('NotoSans-Bold.ttf', await arrayBufferToBase64(bold))
    pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
    pdf.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold')
    pdf.setFont('NotoSans', 'normal')
    return 'NotoSans'
  } catch (error) {
    console.warn('Unable to load PDF font, falling back to built-in font', error)
    pdf.setFont('helvetica', 'normal')
    return 'helvetica'
  }
}

function displayBiomarkerName(biomarker, isUk) {
  if (!biomarker) return '—'
  const value = isUk
    ? biomarker.canonical_name || biomarker.name || biomarker.source_name || biomarker.name_en
    : biomarker.name_en || biomarker.canonical_name || biomarker.name || biomarker.source_name
  return biomarkerDisplayName(value, isUk) || '—'
}

function isTechnicalCountHeadline(value) {
  const text = String(value || '').trim().toLowerCase()
  return /^(found|знайдено)\s+\d+/.test(text) || text.includes('biomarkers found') || text.includes('показників')
}

function buildHumanHeadline(summaryHeadline, priorityMarkers, isUk, fallback) {
  if (summaryHeadline && !isTechnicalCountHeadline(summaryHeadline)) return summaryHeadline
  const first = priorityMarkers[0]
  const second = priorityMarkers[1]
  if (!first) return fallback
  const firstName = displayBiomarkerName(first, isUk)
  if (second) {
    const secondName = displayBiomarkerName(second, isUk)
    return isUk
      ? `${firstName} і ${secondName} можуть пояснювати частину симптомів.`
      : `${firstName} and ${secondName} may explain part of your symptoms.`
  }
  return isUk ? `${firstName} потребує уваги в контексті симптомів.` : `${firstName} may need attention in context.`
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

function interpretationStatusLabel(value, copy) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return copy.contextRequired
  if (raw === 'context_required' || raw === 'context required') return copy.contextRequired
  if (raw === 'needs_attention' || raw === 'monitor' || raw === 'review') return copy.needsAttention
  if (raw === 'stable' || raw === 'ok' || raw === 'normal') return copy.stablePattern
  return localizeDomainLabel(raw.replace(/_/g, ' '), copy)
}

function nutritionContextBody(context, copy) {
  if (!context?.body) return ''
  const title = String(context.title || copy.nutritionContext || '').trim()
  const body = String(context.body || '').trim()
  if (!title) return body
  const cleaned = body.replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:：-]?\\s*`, 'i'), '')
  if (copy === RESULTS_COPY.uk && /^тут\s+важлив/i.test(cleaned)) {
    return cleaned.replace(/^тут\s+важливий/i, 'важливий у цьому випадку')
  }
  return cleaned
}

function isProfileContextAction(item) {
  const text = `${item?.title || ''} ${item?.body || ''}`.toLowerCase()
  return /profile|anthropometr|профіль|антропометр/.test(text)
}

function interpretationTone(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'context_required' || raw === 'context required' || raw === 'needs_attention' || raw === 'monitor' || raw === 'review') return 'warning'
  if (raw === 'stable' || raw === 'ok' || raw === 'normal') return 'success'
  return 'info'
}

function interpretationPanelClass(value) {
  const tone = interpretationTone(value)
  if (tone === 'warning') return 'border-amber-200 bg-amber-50/90 shadow-amber-100'
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50/90 shadow-emerald-100'
  return 'border-sky-200 bg-sky-50/90 shadow-sky-100'
}

function actionCardClass(index) {
  if (index === 0) return 'border-emerald-200 bg-emerald-50 text-emerald-950 shadow-emerald-100'
  if (index === 1) return 'border-amber-200 bg-amber-50 text-amber-950 shadow-amber-100'
  return 'border-slate-200 bg-slate-50 text-slate-700 shadow-slate-100'
}

function retestTimingLabel(item, copy) {
  const timing = String(item?.timing || '').trim()
  if (!timing) return ''
  if (/context[-\s]?based/i.test(timing)) return copy.contextRetestTiming
  return timing
}

function rangePosition(biomarker) {
  const value = parseNumericValue(biomarker?.value ?? biomarker?.numeric_value)
  const { ref_low: low, ref_high: high } = normalizeReferenceBounds(biomarker)
  if (!Number.isFinite(value) || low == null || high == null || high <= low) return null
  const raw = ((value - low) / (high - low)) * 100
  return Math.max(0, Math.min(100, raw))
}

function rangeDeltaText(biomarker, copy) {
  const value = parseNumericValue(biomarker?.value ?? biomarker?.numeric_value)
  const { ref_low: low, ref_high: high } = normalizeReferenceBounds(biomarker)
  const unit = biomarker?.unit ? ` ${biomarker.unit}` : ''
  if (!Number.isFinite(value)) return ''
  if (low != null && value < low) return `${Math.abs(low - value).toFixed(1).replace(/\.0$/, '')}${unit} ${copy.belowLowerBound}`
  if (high != null && value > high) return `${Math.abs(value - high).toFixed(1).replace(/\.0$/, '')}${unit} ${copy.aboveUpperBound}`
  return ''
}

function biomarkerReasonText(biomarker, copy, isUk, interpretedPattern) {
  const name = displayBiomarkerName(biomarker, isUk)
  const status = String(biomarker?.status_normalized || '').toUpperCase()
  const delta = rangeDeltaText(biomarker, copy)
  const patternTitle = interpretedPattern?.title ? localizeReportText(interpretedPattern.title, isUk) : ''
  const patternText = patternTitle
    ? (isUk ? ` у патерні "${patternTitle}"` : ` in the "${patternTitle}" pattern`)
    : ''

  if (isUk) {
    if (status === 'DEFICIENT') {
      return `${name} нижче лабораторного референсу${delta ? ` (${delta})` : ''}. Це важливо${patternText}, але сам показник не підтверджує дефіцит або діагноз без повʼязаних маркерів, симптомів і клінічного контексту.`
    }
    if (status === 'ELEVATED') {
      return `${name} вище лабораторного референсу${delta ? ` (${delta})` : ''}. VITALOOP виділяє його як сигнал для перегляду разом із симптомами, ліками, навантаженням і суміжними показниками.`
    }
    if (status === 'BORDERLINE') {
      return `${name} біля межі референсу. Такий результат краще оцінювати в динаміці та разом із симптомами, а не як окремий висновок.`
    }
    return `${name} у межах референсу. У цьому звіті він допомагає зрозуміти загальний контекст і відрізнити ізольоване відхилення від ширшого патерну.`
  }

  if (status === 'DEFICIENT') {
    return `${name} is below the lab reference range${delta ? ` (${delta})` : ''}. It matters${patternText}, but it does not confirm a deficiency or diagnosis without related markers, symptoms, and clinical context.`
  }
  if (status === 'ELEVATED') {
    return `${name} is above the lab reference range${delta ? ` (${delta})` : ''}. VITALOOP treats it as a signal to review alongside symptoms, medications, recent load, and adjacent biomarkers.`
  }
  if (status === 'BORDERLINE') {
    return `${name} sits near the reference boundary. It is better interpreted as a trend and symptom-context signal, not as a standalone conclusion.`
  }
  return `${name} is within the reference range. In this report it helps separate an isolated abnormal value from a broader pattern.`
}

function evidenceBodyText(copy, isUk, interpretedPattern, priorityMarkers, missingContextPreview) {
  const markerNames = priorityMarkers.slice(0, 3).map((marker) => displayBiomarkerName(marker, isUk)).filter(Boolean)
  const missing = missingContextPreview.slice(0, 3).map((item) => localizeReportText(item, isUk)).filter(Boolean)
  if (isUk) {
    const markerPart = markerNames.length
      ? `VITALOOP порівняв пріоритетні показники (${markerNames.join(', ')}) з референсами лабораторії.`
      : 'VITALOOP порівняв доступні показники з референсами лабораторії.'
    const patternPart = interpretedPattern?.title
      ? ` Висновок привʼязаний до патерну "${localizeReportText(interpretedPattern.title, true)}".`
      : ''
    const missingPart = missing.length
      ? ` Сила висновку обмежена без додаткового контексту: ${missing.join('; ')}.`
      : ''
    return `${markerPart}${patternPart}${missingPart} Це освітня інтерпретація, не діагноз.`
  }
  const markerPart = markerNames.length
    ? `VITALOOP compared priority markers (${markerNames.join(', ')}) with the lab reference ranges.`
    : 'VITALOOP compared available markers with the lab reference ranges.'
  const patternPart = interpretedPattern?.title ? ` The conclusion is tied to the "${interpretedPattern.title}" pattern.` : ''
  const missingPart = missing.length ? ` Confidence is limited without extra context: ${missing.join('; ')}.` : ''
  return `${markerPart}${patternPart}${missingPart} This is educational interpretation, not a diagnosis.`
}

function BiomarkerRangeBar({ biomarker, copy }) {
  const position = rangePosition(biomarker)
  const delta = rangeDeltaText(biomarker, copy)
  if (position == null && !delta) return null
  return (
    <div className="mt-3 rounded-xl border border-white/80 bg-white/75 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>{copy.rangePosition}</span>
        {delta && <span className="text-sky-700">{delta}</span>}
      </div>
      <div className="relative h-2 rounded-full bg-slate-200">
        <div className="absolute left-[15%] top-0 h-2 w-[70%] rounded-full bg-emerald-200" />
        {position != null && (
          <div
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-sky-600 shadow"
            style={{ left: `calc(${15 + position * 0.7}% - 8px)` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{copy.belowLowerBound}</span>
        <span>{copy.aboveUpperBound}</span>
      </div>
    </div>
  )
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
    reasons.push(copy.domainWhyText)
  }
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{label}</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {[risk, confidence ? `${confidence} ${copy.confidence}` : null].filter(Boolean).join(' · ')}
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
  const interpretedReport = finalAnalysis.interpreted_report || {}
  const healthStates = finalAnalysis.health_states || {}
  const quality = finalAnalysis.quality_snapshot || {}
  const trends = finalAnalysis.trend_analysis || {}
  const interpretedDomains = Array.isArray(interpretedReport.health_domains) ? interpretedReport.health_domains : []
  const legacyStates = Array.isArray(healthStates.top_priorities) && healthStates.top_priorities.length
    ? healthStates.top_priorities
    : Array.isArray(healthStates.states)
      ? healthStates.states.filter((state) => state?.risk_level !== 'unknown' && Number(state?.score || 0) > 0)
      : []
  const states = interpretedDomains.length ? interpretedDomains : legacyStates
  const trendRows = asTextList(trends.priority_changes || trends.changes || trends.summary || trends.signals).slice(0, 4)
  const completeness = formatPercent(quality?.coverage?.completeness ?? quality?.coverage?.analysis_completeness ?? quality?.completeness)
  const topDomains = asTextList(quality.top_health_domains).slice(0, 4).map((item) => localizeDomainLabel(item, copy))

  if (!states.length && !Object.keys(quality).length && !Object.keys(trends).length) return null

  return (
    <SectionCard icon={HeartPulse} title={copy.reportBasis} className="mb-6">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{copy.keyInterpretation}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.reportBasisBody}</p>
      </div>
      {!!states.length && (
        <div className="grid gap-3 md:grid-cols-2">
          {states.slice(0, 6).map((state, index) => <HealthDomainCard key={state?.key || state?.domain || index} state={state} copy={copy} />)}
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.analysisQuality}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{completeness ? `${copy.completeness}: ${completeness}` : copy.reportBasisBody}</p>
          {!!topDomains.length && <p className="mt-2 text-xs leading-5 text-slate-500">{topDomains.join(', ')}</p>}
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.trends}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{trendRows.length ? trendRows.join(' · ') : copy.noTrendData}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.safetyBoundary}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{copy.noSelfTreatment}</p>
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
  const [exporting, setExporting] = useState(false)
  const isUk = isUkrainianLocale()
  const copy = isUk ? RESULTS_COPY.uk : RESULTS_COPY.en
  const localizedKnowledgeReport = useMemo(() => localizeReportObject(knowledgeReport, isUk), [knowledgeReport, isUk])
  const localizedFinalAnalysis = useMemo(() => localizeReportObject(finalAnalysis, isUk), [finalAnalysis, isUk])
  const localizedShoppingLinks = useMemo(() => localizeReportObject(shoppingLinks, isUk), [shoppingLinks, isUk])
  const localizedSafetyResult = useMemo(() => localizeReportObject(safetyResult, isUk), [safetyResult, isUk])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [{ data }, analysisResponse] = await Promise.all([
          api.get(`/results/${uploadId}`),
          api.get(`/analyze/${uploadId}`).catch(() => null),
        ])
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
        setKnowledgeReport(analysisResponse?.data?.knowledge_report ?? data.knowledge_report ?? null)
        const interpreted =
          analysisResponse?.data?.interpreted_report
          ?? analysisResponse?.data?.final_analysis?.interpreted_report
          ?? data.interpreted_report
          ?? data.final_analysis?.interpreted_report
          ?? data.knowledge_report?.interpreted_report
          ?? null
        setFinalAnalysis({
          ...(data.final_analysis ?? {}),
          ...(analysisResponse?.data?.final_analysis ?? {}),
          ...(interpreted ? { interpreted_report: interpreted } : {}),
        })
        setExplainability(analysisResponse?.data?.explainability ?? null)
        setSafetyResult(
          analysisResponse?.data?.safety_result
          ?? data.safety_result
          ?? data.final_analysis?.safety_result
          ?? null
        )
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

  const interpretedReport = localizedFinalAnalysis?.interpreted_report || localizedKnowledgeReport?.interpreted_report || null
  const interpretedPattern = Array.isArray(interpretedReport?.patterns) ? interpretedReport.patterns[0] : null
  const hasPediatricContext = /child|pediatric|дит/i.test(String(interpretedReport?.nutrition_context?.person_group || '')) ||
    /child|pediatric|дит/i.test(String(interpretedPattern?.profile_context || interpretedPattern?.context || ''))
  const missingContextPreview = Array.isArray(interpretedPattern?.missing_context)
    ? interpretedPattern.missing_context.slice(0, 4)
    : []
  const reportSummary = interpretedReport?.summary || localizedKnowledgeReport?.summary || null
  const reportFound = localizedKnowledgeReport?.what_was_found || null
  const reportPatterns = interpretedPattern
    ? [interpretedPattern]
    : Array.isArray(localizedKnowledgeReport?.why_it_matters)
      ? localizedKnowledgeReport.why_it_matters
      : []
  const hasInterpretedActions = Array.isArray(interpretedReport?.next_best_steps) && interpretedReport.next_best_steps.length
  const reportActions = hasInterpretedActions
    ? interpretedReport.next_best_steps.map((item) => ({
      ...item,
      title: item.title || actionTimeframeLabel(item.timeframe, copy),
      body: item.body || item.reason || item.text,
    })).filter((item) => !(hasPediatricContext && isProfileContextAction(item)))
    : Array.isArray(localizedKnowledgeReport?.action_plan)
      ? localizedKnowledgeReport.action_plan
      : []
  const reportDiscussion = Array.isArray(interpretedReport?.doctor_questions) && interpretedReport.doctor_questions.length
    ? interpretedReport.doctor_questions
    : Array.isArray(localizedKnowledgeReport?.doctor_discussion)
      ? localizedKnowledgeReport.doctor_discussion
      : []
  const reportRetest = Array.isArray(interpretedReport?.retest_plan) && interpretedReport.retest_plan.length
    ? interpretedReport.retest_plan
    : Array.isArray(localizedKnowledgeReport?.retest_plan)
      ? localizedKnowledgeReport.retest_plan
      : []
  const reportAlerts = Array.isArray(localizedKnowledgeReport?.safety_alerts) ? localizedKnowledgeReport.safety_alerts : []
  const correctedRangeNames = useMemo(
    () => new Set(
      normalizedBiomarkers
        .filter((item) => normalizeReferenceBounds(item).inverted)
        .flatMap((item) => [
          item.name,
          item.name_en,
          item.canonical_name,
          item.source_name,
          displayBiomarkerName(item, false),
          displayBiomarkerName(item, true),
        ])
        .filter(Boolean)
    ),
    [normalizedBiomarkers]
  )
  const visibleReportDiscussion = reportDiscussion.filter((item) => !includesCorrectedRangeMarker(item, correctedRangeNames))
  const visibleReportRetest = reportRetest.filter((item) => !includesCorrectedRangeMarker(item, correctedRangeNames))
  const humanHeadline = interpretedReport?.summary?.headline || buildHumanHeadline(reportSummary?.headline, priorityMarkers, isUk, copy.fallbackHeadline)
  const humanSummary = interpretedReport?.summary?.body || reportFound?.summary || copy.intro
  const reportInfoScore = Number(interpretedReport?.informativeness?.score)
  const nutritionSignals = Array.isArray(interpretedReport?.nutrition_context?.signals)
    ? interpretedReport.nutrition_context.signals
    : []
  const nutrientRequirements = Array.isArray(interpretedReport?.nutrition_context?.nutrient_requirements)
    ? interpretedReport.nutrition_context.nutrient_requirements
    : []
  const explanations = Array.isArray(explainability?.recommendations)
    ? explainability.recommendations
    : Array.isArray(explainability?.marker_explanations)
      ? explainability.marker_explanations
      : []
  const evidenceGapItems = useMemo(() => {
    const direct = localizedFinalAnalysis?.evidence_gaps?.gaps
    const fromExplainability = explainability?.evidence_gaps?.gaps
    const items = Array.isArray(direct) ? direct : (Array.isArray(fromExplainability) ? fromExplainability : [])
    return items.filter(Boolean).slice(0, 6)
  }, [localizedFinalAnalysis, explainability])

  async function exportResultsAsPDF() {
    if (exporting) return
    try {
      setExporting(true)
      const jsPDF = (await import('jspdf')).jsPDF
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
      const fontName = await registerNotoSans(pdf)
      const margin = 44
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const contentWidth = pageWidth - margin * 2
      const colors = {
        ink: [15, 23, 42],
        muted: [71, 85, 105],
        light: [248, 250, 252],
        line: [226, 232, 240],
        teal: [20, 163, 139],
        tealDark: [15, 118, 110],
        amber: [245, 158, 11],
        rose: [225, 29, 72],
        green: [34, 197, 94],
      }
      let y = 42
      const generatedAt = new Date().toLocaleString(isUk ? 'uk-UA' : 'en-US')

      const setFont = (style = 'normal', size = 10, color = colors.ink) => {
        pdf.setFont(fontName, style)
        pdf.setFontSize(size)
        pdf.setTextColor(...color)
      }
      const ensurePage = (height = 60) => {
        if (y + height <= pageHeight - 54) return
        pdf.addPage()
        y = 42
      }
      const lineHeightFor = (size) => Math.round(size * 1.45)
      const addWrappedText = (text, x, width, { size = 10, style = 'normal', color = colors.muted, lineGap = 2 } = {}) => {
        if (!text) return 0
        setFont(style, size, color)
        const lines = pdf.splitTextToSize(String(text), width)
        const lineHeight = lineHeightFor(size)
        lines.forEach((line) => {
          ensurePage(lineHeight + 2)
          pdf.text(line, x, y)
          y += lineHeight + lineGap
        })
        return lines.length * (lineHeight + lineGap)
      }
      const addSection = (title) => {
        ensurePage(52)
        y += 14
        pdf.setDrawColor(...colors.teal)
        pdf.setLineWidth(2)
        pdf.line(margin, y - 7, margin + 24, y - 7)
        setFont('bold', 13, colors.ink)
        pdf.text(title, margin + 34, y)
        y += 18
      }
      const drawHeader = () => {
        pdf.setFillColor(241, 250, 247)
        pdf.roundedRect(margin, 28, contentWidth, 96, 18, 18, 'F')
        pdf.setFillColor(...colors.teal)
        pdf.roundedRect(margin + 18, 48, 48, 48, 14, 14, 'F')
        setFont('bold', 22, colors.ink)
        pdf.text(copy.pdfTitle, margin + 82, 62)
        setFont('normal', 10, colors.muted)
        pdf.text(copy.pdfSubtitle, margin + 82, 80)
        pdf.text(`${copy.pdfGenerated}: ${generatedAt}`, margin + 82, 98)
        setFont('bold', 10, colors.tealDark)
        pdf.text('VITALOOP', margin + 28, 77)
        y = 154
      }
      const drawMetricCard = (x, title, value, color = colors.tealDark) => {
        pdf.setFillColor(...colors.light)
        pdf.setDrawColor(...colors.line)
        pdf.roundedRect(x, y, (contentWidth - 24) / 3, 62, 14, 14, 'FD')
        setFont('bold', 17, color)
        pdf.text(String(value), x + 14, y + 26)
        setFont('normal', 9, colors.muted)
        pdf.text(title, x + 14, y + 46)
      }
      const addList = (items = [], limit = 8) => {
        items.filter(Boolean).slice(0, limit).forEach((item) => {
          const text = itemToReportText(item)
          if (!text) return
          ensurePage(36)
          pdf.setFillColor(...colors.light)
          pdf.setDrawColor(...colors.line)
          const lines = pdf.splitTextToSize(text, contentWidth - 42)
          const rowHeight = Math.max(34, 18 + lines.length * 14)
          ensurePage(rowHeight + 8)
          pdf.roundedRect(margin, y, contentWidth, rowHeight, 10, 10, 'FD')
          setFont('bold', 12, colors.tealDark)
          pdf.text('•', margin + 14, y + 20)
          setFont('normal', 9.5, colors.muted)
          pdf.text(lines, margin + 30, y + 19)
          y += rowHeight + 8
        })
      }

      drawHeader()
      setFont('bold', 16, colors.ink)
      addWrappedText(humanHeadline, margin, contentWidth, { size: 16, style: 'bold', color: colors.ink })
      addWrappedText(humanSummary, margin, contentWidth, { size: 10.5, color: colors.muted })

      addSection(copy.pdfKeyNumbers)
      drawMetricCard(margin, copy.pdfMarkersAnalyzed, normalizedBiomarkers.length, colors.tealDark)
      drawMetricCard(margin + (contentWidth - 24) / 3 + 12, copy.pdfInRange, optimalCount, colors.green)
      drawMetricCard(margin + ((contentWidth - 24) / 3 + 12) * 2, copy.pdfOutOfRange, outOfRangeCount, outOfRangeCount ? colors.rose : colors.green)
      y += 82

      addSection(copy.pdfFindings)
      addList(priorityMarkers.slice(0, 5).map((b) => `${displayBiomarkerName(b, isUk)}: ${formatMetric(b)} · ${copy.reference} ${formatRange(b, copy)} · ${getStatusLabel(b.status_normalized, isUk)}`), 5)

      addSection(copy.pdfWhyMatters)
      addList(reportPatterns.length ? reportPatterns : [copy.noPattern], 5)

      addSection(copy.pdfActionPlan)
      addList(reportActions.length ? reportActions : [copy.nextFallback], 6)

      addSection(copy.pdfDoctorQuestions)
      addList(visibleReportDiscussion.length ? visibleReportDiscussion : [copy.discussFallback], 6)

      addSection(copy.pdfRetestPlan)
      addList(visibleReportRetest.length ? visibleReportRetest : [copy.retestFallback], 6)

      addSection(copy.pdfBiomarkers)
      const columns = [
        { key: 'marker', label: copy.biomarker, width: contentWidth * 0.33 },
        { key: 'value', label: copy.value, width: contentWidth * 0.18 },
        { key: 'range', label: copy.ref, width: contentWidth * 0.25 },
        { key: 'status', label: copy.status, width: contentWidth * 0.24 },
      ]
      const drawTableHeader = () => {
        ensurePage(36)
        pdf.setFillColor(15, 118, 110)
        pdf.roundedRect(margin, y, contentWidth, 30, 8, 8, 'F')
        let x = margin + 10
        columns.forEach((column) => {
          setFont('bold', 8.5, [255, 255, 255])
          pdf.text(column.label, x, y + 19)
          x += column.width
        })
        y += 34
      }
      drawTableHeader()
      rankedBiomarkers.forEach((b, index) => {
        const row = [
          displayBiomarkerName(b, isUk),
          formatMetric(b),
          formatRange(b, copy),
          getStatusLabel(b.status_normalized, isUk),
        ]
        const wrapped = row.map((text, idx) => pdf.splitTextToSize(String(text), columns[idx].width - 12))
        const rowHeight = Math.max(30, 12 + Math.max(...wrapped.map((lines) => lines.length)) * 12)
        if (y + rowHeight > pageHeight - 76) drawTableHeader()
        pdf.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252)
        pdf.setDrawColor(...colors.line)
        pdf.rect(margin, y, contentWidth, rowHeight, 'FD')
        let x = margin + 10
        wrapped.forEach((lines, idx) => {
          const status = b.status_normalized
          const color = idx === 3 && status === 'ELEVATED' ? colors.rose : idx === 3 && status === 'DEFICIENT' ? [37, 99, 235] : idx === 3 && status === 'BORDERLINE' ? colors.amber : colors.muted
          setFont(idx === 0 || idx === 3 ? 'bold' : 'normal', 8.2, idx === 0 ? colors.ink : color)
          pdf.text(lines.slice(0, 3), x, y + 16)
          x += columns[idx].width
        })
        y += rowHeight
      })

      addSection(copy.pdfSafety)
      addWrappedText(localizedSafetyResult?.status ? `${copy.status}: ${localizedSafetyResult.status}` : '', margin, contentWidth, { size: 9.5, color: colors.muted })
      addWrappedText(reportSummary?.disclaimer || copy.disclaimer, margin, contentWidth, { size: 9.5, color: colors.muted })

      const pageCount = pdf.internal.getNumberOfPages()
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page)
        pdf.setDrawColor(...colors.line)
        pdf.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34)
        setFont('normal', 8, colors.muted)
        pdf.text(copy.pdfFooter, margin, pageHeight - 18)
        pdf.text(`${page}/${pageCount}`, pageWidth - margin - 24, pageHeight - 18)
      }

      pdf.save(safeReportFilename(copy.reportFilePrefix, uploadId))
    } catch (err) {
      console.error('Failed to export PDF', err)
    } finally {
      setExporting(false)
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
        subtitle={copy.reportSubtitle}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate('/lab-results')} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {copy.back}
            </button>
            <button disabled={exporting} onClick={exportResultsAsPDF} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              <Download className="h-4 w-4" />
              {exporting ? copy.exporting : copy.downloadReport}
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
                {humanHeadline}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                {humanSummary}
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
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div className={`rounded-2xl border p-4 shadow-sm ${outOfRangeCount ? 'border-rose-200 bg-rose-50 ring-1 ring-rose-100' : 'border-slate-100 bg-white'}`}>
                  <div className="text-2xl font-bold text-rose-600">{outOfRangeCount}</div>
                  <div className="text-xs font-medium text-slate-500">{copy.outOfRange}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="text-2xl font-bold text-slate-950">{normalizedBiomarkers.length}</div>
                  <div className="text-xs font-medium text-slate-500">{copy.markersRead}</div>
                </div>
                <div className={`rounded-2xl border p-4 shadow-sm ${watchCount ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-white'}`}>
                  <div className="text-2xl font-bold text-amber-600">{watchCount}</div>
                  <div className="text-xs font-medium text-slate-500">{copy.watchList}</div>
                </div>
                {Number.isFinite(reportInfoScore) && (
                  <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                    <div className="text-2xl font-bold text-emerald-700">{reportInfoScore}%</div>
                    <div className="text-xs font-medium text-slate-500">{copy.reportQuality}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.header>

        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm ring-1 ring-sky-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{copy.importantNow}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-950">{copy.importantNowBody(outOfRangeCount)}</p>
            {!!priorityMarkers.length && (
              <p className="mt-2 text-xs leading-5 text-sky-900">
                {priorityMarkers.slice(0, 2).map((item) => displayBiomarkerName(item, isUk)).join(' · ')}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{copy.contextGap}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-amber-950">{missingContextPreview.length ? missingContextPreview.slice(0, 3).join(' · ') : copy.contextGapBody}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{copy.safetyContext}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-emerald-950">{hasPediatricContext ? copy.pediatricBody : copy.safetyContextBody}</p>
          </div>
        </div>

        {interpretedPattern && (
          <SectionCard icon={Info} title={copy.keyInterpretation} className="mb-6">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className={`rounded-2xl border p-4 shadow-sm ${interpretationPanelClass(interpretedPattern.status || reportSummary?.status)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <CoachBadge tone="success">{interpretationStatusLabel(interpretedPattern.status || reportSummary?.status, copy)}</CoachBadge>
                  {confidencePercent(interpretedPattern.confidence || reportSummary?.confidence) && (
                    <CoachBadge tone="info">
                      {copy.confidenceLabel}: {confidencePercent(interpretedPattern.confidence || reportSummary?.confidence)}
                    </CoachBadge>
                  )}
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-950">{interpretedPattern.title || humanHeadline}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">{interpretedPattern.summary || humanSummary}</p>
                {!!nutritionContextBody(interpretedPattern.nutrition_context, copy) && (
                  <div className="mt-4 rounded-xl bg-white p-3 text-sm leading-6 text-emerald-950">
                    <span className="font-semibold">{interpretedPattern.nutrition_context.title || copy.nutritionContext}:</span> {nutritionContextBody(interpretedPattern.nutrition_context, copy)}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {!!interpretedPattern.what_this_means?.length && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{copy.meaning}</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                      {interpretedPattern.what_this_means.slice(0, 3).map((text, index) => <li key={`meaning-${index}`}>{text}</li>)}
                    </ul>
                  </div>
                )}
                {!!interpretedPattern.what_this_does_not_confirm?.length && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.notConfirmed}</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                      {interpretedPattern.what_this_does_not_confirm.slice(0, 3).map((text, index) => <li key={`not-confirmed-${index}`}>{text}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{copy.needsData}</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-950">
                  {(interpretedPattern.missing_context || []).slice(0, 5).map((text, index) => <li key={`missing-context-${index}`}>{text}</li>)}
                </ul>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{copy.stableContext}</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-sky-950">
                  {(interpretedPattern.normal_context || []).slice(0, 4).map((marker, index) => (
                    <li key={`normal-context-${index}`}>{marker.name}: {marker.value}{marker.unit ? ` ${marker.unit}` : ''}</li>
                  ))}
                </ul>
              </div>
              {hasPediatricContext && (
                <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{copy.pediatricContext}</p>
                  <p className="mt-2 text-sm leading-6 text-teal-950">{copy.pediatricBody}</p>
                </div>
              )}
            </div>
          </SectionCard>
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

	        {!!evidenceGapItems.length && (
	          <SectionCard icon={SearchCheck} title={copy.evidenceGapsTitle} className="mb-6 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white">
	            <p className="mb-4 text-sm leading-6 text-slate-600">{copy.evidenceGapsBody}</p>
	            <div className="grid gap-3 md:grid-cols-2">
	              {evidenceGapItems.map((gap, index) => (
	                <div key={`evidence-gap-${gap.missing_marker || gap.reason || index}`} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
	                  <div className="mb-2 flex flex-wrap items-center gap-2">
	                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
	                      {gap.priority || copy.contextRequired}
	                    </span>
	                    {gap.domain && <span className="text-xs font-semibold text-slate-500">{localizeDomainLabel({ domain: gap.domain }, copy)}</span>}
	                  </div>
	                  <p className="text-sm font-bold text-slate-950">
	                    {gap.missing_marker ? `${copy.evidenceGapMarker}: ${gap.missing_marker}` : copy.evidenceGapContext}
	                  </p>
	                  <p className="mt-1 text-sm leading-6 text-slate-600">{gap.reason || gap.suggested_next_step}</p>
	                  {gap.suggested_next_step && gap.suggested_next_step !== gap.reason && (
	                    <p className="mt-2 text-xs font-semibold leading-5 text-amber-900">{gap.suggested_next_step}</p>
	                  )}
	                </div>
	              ))}
	            </div>
	          </SectionCard>
	        )}

	        <div className={`grid gap-6 ${interpretedPattern ? 'lg:grid-cols-1' : 'lg:grid-cols-[0.95fr_1.05fr]'}`}>
          <SectionCard icon={ClipboardList} title={copy.topFindings}>
            {priorityMarkers.length ? (
              <div className="space-y-3">
                {priorityMarkers.slice(0, 3).map((b) => {
                  const meta = STATUS_META[b.status_normalized] || STATUS_META.BORDERLINE
                  return (
                    <div key={b.id || `${b.name_en}-${b.value}`} className={`rounded-2xl border p-4 shadow-sm ${meta.card}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                            <h3 className="font-semibold text-slate-950">{displayBiomarkerName(b, isUk)}</h3>
                            <BiomarkerContextTooltip biomarkerName={displayBiomarkerName(b, isUk)} value={b.value} status={b.status_normalized} size="sm" />
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-700">{formatMetric(b)} · {copy.reference} {formatRange(b, copy)}</p>
                          <BiomarkerRangeBar biomarker={b} copy={copy} />
                          <div className="mt-3 rounded-xl border border-white/80 bg-white/80 p-3 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{copy.markerContext}</p>
                            <p className="mt-1 leading-6 text-slate-700">{biomarkerReasonText(b, copy, isUk, interpretedPattern)}</p>
                          </div>
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

          {!interpretedPattern && <SectionCard icon={Info} title={copy.whyMatters}>
            {reportPatterns.length ? (
              <div className="space-y-3">
                {reportPatterns.slice(0, 4).map((item, idx) => (
                  <div key={`pattern-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-950">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary || item.why_it_matters}</p>
                    {!!item.what_this_means?.length && (
                      <div className="mt-3 rounded-xl bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{copy.meaning}</p>
                        <ul className="mt-1 space-y-1 text-sm leading-6 text-slate-600">
                          {item.what_this_means.slice(0, 3).map((text, index) => <li key={`means-${index}`}>{text}</li>)}
                        </ul>
                      </div>
                    )}
                    {!!item.what_this_does_not_confirm?.length && (
                      <div className="mt-3 rounded-xl bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.notConfirmed}</p>
                        <ul className="mt-1 space-y-1 text-sm leading-6 text-slate-600">
                          {item.what_this_does_not_confirm.slice(0, 3).map((text, index) => <li key={`not-${index}`}>{text}</li>)}
                        </ul>
                      </div>
                    )}
                    {!!item.missing_context?.length && (
                      <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{copy.missingContext}</p>
                        <ul className="mt-1 space-y-1 text-sm leading-6 text-amber-900">
                          {item.missing_context.slice(0, 5).map((text, index) => <li key={`missing-${index}`}>{text}</li>)}
                        </ul>
                      </div>
                    )}
                    {!!item.nutrition_context?.body && (
                      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{item.nutrition_context.title || copy.nutritionContext}</p>
                        <p className="mt-1 text-sm leading-6 text-emerald-950">{item.nutrition_context.body}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                {copy.noPattern}
              </p>
            )}
          </SectionCard>}
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <SectionCard icon={CheckCircle2} title={copy.nextBestStep} className="border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white">
            {reportActions.length ? (
              <ul className="grid gap-3 text-sm leading-6 text-slate-700 sm:grid-cols-2">
                {reportActions.slice(0, 4).map((item, idx) => (
                  <li key={`action-${item.key || idx}`} className={`rounded-xl border p-3 shadow-sm ${idx === 0 ? 'sm:col-span-2' : ''} ${actionCardClass(idx)}`}>
                    {idx === 0 && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{copy.priorityAction}</span>}
                    <span className="font-semibold text-slate-950">{item.title}</span>
                    {item.body && item.body !== item.title && <span className="block text-slate-600">{item.body}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-slate-600">{copy.nextFallback}</p>
            )}
          </SectionCard>

          <div className="grid gap-4">
            <SectionCard icon={ArrowRight} title={copy.today}>
              <p className="text-sm leading-6 text-slate-600">{reportActions[0]?.body || reportActions[0]?.title || copy.reviewTopFinding}</p>
            </SectionCard>

            <SectionCard icon={RefreshCw} title={copy.thisMonth}>
              <p className="text-sm leading-6 text-slate-600">{retestTimingLabel(visibleReportRetest[0], copy) || (isUk ? 'Плануйте повторну перевірку з урахуванням симптомів, рекомендацій лікаря та конкретного показника.' : 'Plan retesting based on symptoms, clinician guidance, and the marker involved.')}</p>
            </SectionCard>

            <SectionCard icon={MessageCircle} title={copy.doctorQuestions}>
              {visibleReportDiscussion.length ? (
                <ul className="space-y-2 text-sm leading-6 text-slate-700">
                  {visibleReportDiscussion.slice(0, 5).map((item, idx) => (
                    <li key={`discussion-${idx}`} className="rounded-xl bg-slate-50 px-3 py-2">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-slate-600">{copy.discussFallback}</p>
              )}
            </SectionCard>
          </div>

        </div>

        <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <HeartPulse className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-lg font-semibold text-slate-950">{copy.methodDetails}</span>
                <span className="block text-sm leading-6 text-slate-500">{copy.methodDetailsBody}</span>
              </span>
            </span>
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">{copy.evidence}</span>
          </summary>
          <div className="mt-5">
            <AnalysisCoreV2Panel finalAnalysis={localizedFinalAnalysis} copy={copy} />
          </div>
        </details>

        {!!nutritionSignals.length && (
          <div className="mt-6 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{copy.nutrientSignals}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{copy.nutritionContext}</h2>
              </div>
              {!!interpretedReport?.nutrition_context?.person_group && (
                <span className="w-fit rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {interpretedReport.nutrition_context.person_group}
                </span>
              )}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {nutritionSignals.slice(0, 4).map((signal, idx) => (
                <div key={signal.key || idx} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold capitalize text-slate-950">{String(signal.nutrient || '').replace(/_/g, ' ')}</h3>
                    <CoachBadge tone={signal.priority === 'high' ? 'warning' : 'info'}>{signal.priority || 'context'}</CoachBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{signal.explanation}</p>
                  {!!signal.missing_context?.length && (
                    <p className="mt-3 text-sm leading-6 text-amber-800">
                      <span className="font-semibold">{copy.missingContext}:</span> {signal.missing_context.slice(0, 4).join(', ')}
                    </p>
                  )}
                  {!!signal.food_sources?.length && (
                    <p className="mt-3 text-sm leading-6 text-emerald-900">
                      <span className="font-semibold">{copy.foodSources}:</span> {signal.food_sources.slice(0, 6).join(', ')}
                    </p>
                  )}
                  {!!signal.safety_notes?.length && (
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      <span className="font-semibold">{copy.safeBoundary}:</span> {signal.safety_notes[1] || signal.safety_notes[0]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {!!nutrientRequirements.length && (
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.nutrientRequirements}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {nutrientRequirements.slice(0, 6).map((row) => (
                    <div key={row.nutrient} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                      <span className="font-semibold capitalize text-slate-950">{String(row.nutrient || '').replace(/_/g, ' ')}</span>
                      <span className="block text-xs text-slate-500">
                        {row.rda_or_ai} {row.unit}{row.upper_limit ? ` · UL ${row.upper_limit}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <CoachCard className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">{copy.evidence}</h2>
              <CoachBadge tone={safetyResult?.status === 'blocked' ? 'critical' : safetyResult?.status === 'approved_with_warnings' ? 'warning' : 'success'}>
                {localizedSafetyResult?.status || (isUk ? 'освітній висновок' : 'educational')}
              </CoachBadge>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              {evidenceBodyText(copy, isUk, interpretedPattern, priorityMarkers, missingContextPreview)}
            </p>
          </CoachCard>

          <CoachCard className="p-5">
            <h2 className="text-lg font-semibold text-slate-950">{copy.retest}</h2>
            {visibleReportRetest.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {visibleReportRetest.slice(0, 5).map((item, idx) => (
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
              {localizedShoppingLinks.slice(0, 6).map((item, idx) => (
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
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                disabled={exporting}
                onClick={exportResultsAsPDF}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {exporting ? copy.exporting : copy.downloadReport}
              </button>
              <button
                onClick={() => navigate(`/protocol/${uploadId}`)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                {copy.openPlan}
                <FileText className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          {reportSummary?.disclaimer || copy.disclaimer}
        </p>
      </div>
    </div>
  )
}
