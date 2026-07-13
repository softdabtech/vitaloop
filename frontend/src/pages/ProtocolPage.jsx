import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, CheckCircle2, Download, ExternalLink, FileText, MessageCircle, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import api from '../lib/api.js'
import { useFeature } from '../hooks/useFeature.js'
import { CoachBadge, CoachButton, CoachCard, CoachSkeleton, EmptyCoachState, InsightCard } from '../components/coach/CoachUI.jsx'
import { isUkrainianLocale } from '../lib/locale.js'

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }
const TIMING_LABELS = {
  morning: 'Morning',
  with_breakfast: 'With breakfast',
  before_breakfast: 'Before breakfast',
  with_food: 'With food',
  with_lunch: 'With lunch',
  afternoon: 'Afternoon',
  with_dinner: 'With dinner',
  evening: 'Evening',
  night: 'Night',
  before_bed: 'Before bed',
  bedtime: 'Before bed',
}

const TIMING_LABELS_UK = {
  morning: 'Ранок',
  with_breakfast: 'Зі сніданком',
  before_breakfast: 'До сніданку',
  with_food: 'З їжею',
  with_lunch: 'З обідом',
  afternoon: 'Після обіду',
  with_dinner: 'З вечерею',
  evening: 'Вечір',
  night: 'Ніч',
  before_bed: 'Перед сном',
  bedtime: 'Перед сном',
}

const PROTOCOL_COPY = {
  en: {
    errorTitle: 'Protocol is not available',
    notFound: 'This upload was not found or is no longer available.',
    premium: 'This protocol requires Premium access.',
    genericError: 'Unable to load this protocol right now.',
    backResults: 'Back to results',
    noProtocol: 'No protocol yet',
    noProtocolBody: 'Open your result first. If the report has no generated actions yet, VITALOOP will show them after analysis completes.',
    openResult: 'Open result',
    summaryEyebrow: 'Protocol Summary',
    summaryTitle: 'Your plan, organized by when to act.',
    summaryBody: 'Educational next steps based on this report. Confirm supplements, medication interactions, and dosing with a qualified clinician when relevant.',
    exporting: 'Exporting...',
    exportPdf: 'Export PDF',
    planContext: 'Plan Context',
    actions: 'Actions',
    biomarkers: 'Biomarkers reviewed',
    retestItems: 'Retest items',
    safetyWarning: 'Safety warning',
    sections: {
      today: ['Today', 'Small actions to start with now.'],
      week: ['This Week', 'Actions that need a few days of consistency.'],
      month: ['This Month', 'Follow-up actions and review windows.'],
      longTerm: ['Long-Term Habits', 'Repeatable habits that support the loop.'],
    },
    shoppingEyebrow: 'Suggested iHerb searches',
    shoppingTitle: 'Optional shopping aids connected to this protocol.',
    shoppingBody: 'These links are educational search shortcuts, not prescriptions. Confirm supplements, dosing, and interactions with a qualified clinician before use.',
    findIherb: 'Find on iHerb',
    retestPlan: 'Retest Plan',
    marker: 'Marker',
    discussTiming: 'Discuss timing with a clinician.',
    retestFallback: 'Retest timing depends on the marker, symptoms, and clinician guidance.',
    safetyDiscussion: 'Safety and Clinician Discussion',
    discussionFallback: 'Ask whether the plan fits your symptoms, medications, history, and current lab context.',
    evidenceTitle: 'Evidence / Why this appears',
    evidenceBody: 'When available, each action shows timing, priority, category, evidence, effort, safety notes, and intended outcome from the existing report data. Empty fields are hidden instead of fabricated.',
    effort: 'Effort',
    evidence: 'Evidence',
    outcome: 'Intended outcome',
    basedOn: 'Based on',
    dataUsed: 'Data used',
    healthDomains: 'Health domains',
    expectedTimeline: 'Expected timeline',
    retestMarkers: 'Retest markers',
    safetyNotes: 'Safety notes',
    kbContext: 'Knowledge-base context',
    pdfTitle: 'VITALOOP Action Protocol',
    pdfUpload: 'Upload',
    pdfGenerated: 'Generated',
    pdfSummary: '1. Protocol Summary',
    pdfSummaryBody: (count) => `This educational protocol contains ${count} action item${count === 1 ? '' : 's'} grouped by practical timing.`,
    pdfActions: '2. Actions',
    pdfDiscussion: '3. Clinician Discussion',
    pdfRetest: '4. Retest Plan',
    pdfDisclaimer: '5. Disclaimer',
    disclaimer: 'VITALOOP provides educational information only. It does not diagnose, treat, prescribe, or replace professional medical advice.',
  },
  uk: {
    errorTitle: 'План дій недоступний',
    notFound: 'Це завантаження не знайдено або воно більше недоступне.',
    premium: 'Для цього плану потрібен Premium.',
    genericError: 'Не вдалося завантажити план дій зараз.',
    backResults: 'До результатів',
    noProtocol: 'Плану дій ще немає',
    noProtocolBody: 'Спочатку відкрийте результат. Якщо звіт ще не має дій, VITALOOP покаже їх після завершення аналізу.',
    openResult: 'Відкрити результат',
    summaryEyebrow: 'Підсумок плану',
    summaryTitle: 'Ваш план, згрупований за часом дії.',
    summaryBody: 'Освітні наступні кроки на основі звіту. Підтвердьте добавки, взаємодії та дозування з кваліфікованим фахівцем.',
    exporting: 'Експортуємо...',
    exportPdf: 'Експорт PDF',
    planContext: 'Контекст плану',
    actions: 'Дій',
    biomarkers: 'Показників переглянуто',
    retestItems: 'Повторних перевірок',
    safetyWarning: 'Попередження безпеки',
    sections: {
      today: ['Сьогодні', 'Невеликі кроки, з яких можна почати зараз.'],
      week: ['Цього тижня', 'Дії, яким потрібна кількаденна послідовність.'],
      month: ['Цього місяця', 'Кроки для перегляду й повторної перевірки.'],
      longTerm: ['Довгострокові звички', 'Повторювані дії, що підтримують цикл.'],
    },
    shoppingEyebrow: 'Пошук на iHerb',
    shoppingTitle: 'Опційні підказки для покупок, повʼязані з цим планом.',
    shoppingBody: 'Це освітні пошукові посилання, не призначення. Підтвердьте добавки, дозування й взаємодії з фахівцем перед використанням.',
    findIherb: 'Знайти на iHerb',
    retestPlan: 'План повторної перевірки',
    marker: 'Показник',
    discussTiming: 'Обговоріть терміни з фахівцем.',
    retestFallback: 'Терміни повторної перевірки залежать від показника, симптомів і рекомендацій фахівця.',
    safetyDiscussion: 'Безпека та питання до фахівця',
    discussionFallback: 'Запитайте, чи відповідає план вашим симптомам, лікам, історії та поточному контексту аналізів.',
    evidenceTitle: 'Доказовість / Чому це показано',
    evidenceBody: 'Коли дані доступні, кожна дія показує час, пріоритет, категорію, доказовість, зусилля, примітки безпеки й очікуваний результат. Порожні поля приховані, а не вигадані.',
    effort: 'Зусилля',
    evidence: 'Доказовість',
    outcome: 'Очікуваний результат',
    basedOn: 'На основі',
    dataUsed: 'Використані дані',
    healthDomains: 'Домени здоровʼя',
    expectedTimeline: 'Очікуваний строк',
    retestMarkers: 'Повторні аналізи',
    safetyNotes: 'Примітки безпеки',
    kbContext: 'Контекст бази знань',
    pdfTitle: 'VITALOOP План дій',
    pdfUpload: 'Завантаження',
    pdfGenerated: 'Сформовано',
    pdfSummary: '1. Підсумок плану',
    pdfSummaryBody: (count) => `Цей освітній план містить ${count} ${count === 1 ? 'дію' : 'дій'}, згрупованих за практичним часом виконання.`,
    pdfActions: '2. Дії',
    pdfDiscussion: '3. Обговорення з фахівцем',
    pdfRetest: '4. Повторна перевірка',
    pdfDisclaimer: '5. Дисклеймер',
    disclaimer: 'VITALOOP надає лише освітню інформацію. Він не ставить діагноз, не лікує, не призначає терапію і не замінює професійну медичну консультацію.',
  },
}

const HEALTH_DOMAIN_LABELS_UK = {
  iron_status: 'Статус заліза',
  metabolic_health: 'Метаболічне здоровʼя',
  cardiovascular: 'Серцево-судинний профіль',
  inflammation: 'Запалення',
  thyroid: 'Щитоподібна залоза',
  liver: 'Печінка',
  kidney: 'Нирки',
  micronutrients: 'Мікронутрієнти',
  recovery_energy: 'Відновлення й енергія',
}

function formatPriority(priority, isUk = false) {
  return String(priority || 'LOW').toUpperCase()
    .replace('HIGH', isUk ? 'ВИСОКИЙ' : 'HIGH')
    .replace('MEDIUM', isUk ? 'СЕРЕДНІЙ' : 'MEDIUM')
    .replace('LOW', isUk ? 'НИЗЬКИЙ' : 'LOW')
}

function sortProtocolByPriority(protocol) {
  return [...protocol].sort((a, b) => (PRIORITY_ORDER[formatPriority(a.priority)] ?? 9) - (PRIORITY_ORDER[formatPriority(b.priority)] ?? 9))
}

async function loadProtocolData(uploadId) {
  const { data } = await api.get(`/results/${uploadId}`)
  const biomarkers = data?.biomarkers ?? []
  const storedProtocol = Array.isArray(data?.protocol) ? data.protocol : []
  const actionPlan = Array.isArray(data?.knowledge_report?.action_plan) ? data.knowledge_report.action_plan : []
  const doctorDiscussion = Array.isArray(data?.knowledge_report?.doctor_discussion) ? data.knowledge_report.doctor_discussion : []
  const retestPlan = Array.isArray(data?.knowledge_report?.retest_plan) ? data.knowledge_report.retest_plan : []
  const safetyAlerts = Array.isArray(data?.knowledge_report?.safety_alerts) ? data.knowledge_report.safety_alerts : []
  const shoppingLinks = Array.isArray(data?.shopping_links)
    ? data.shopping_links
    : Array.isArray(data?.final_analysis?.shopping_links)
      ? data.final_analysis.shopping_links
      : []
  return {
    biomarkers,
    protocol: storedProtocol.length ? storedProtocol : actionPlan,
    doctorDiscussion,
    retestPlan,
    safetyAlerts,
    shoppingLinks,
    knowledgeReport: data?.knowledge_report ?? null,
  }
}

function protocolTitle(item) {
  return item?.title || item?.supplement || item?.name || 'Action item'
}

function protocolBody(item) {
  return item?.body || item?.rationale || item?.explanation || item?.reason || ''
}

function protocolTiming(item, isUk = false) {
  const raw = String(item?.timing || item?.schedule || '').trim()
  const labels = isUk ? TIMING_LABELS_UK : TIMING_LABELS
  return labels[raw] || raw.replaceAll('_', ' ') || ''
}

function protocolCategory(item) {
  return String(item?.category || item?.type || '').trim()
}

function effortLabel(item) {
  return item?.effort || item?.expected_effort || null
}

function outcomeLabel(item) {
  return item?.intended_outcome || item?.outcome || null
}

function evidenceLabel(item) {
  return item?.evidence_level || item?.evidence || item?.confidence || null
}

function safetyLabel(item) {
  return item?.safety_note || item?.warning || item?.clinician_note || null
}

function asTextList(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (!item) return []
        if (typeof item === 'string') return [item]
        if (typeof item !== 'object') return [String(item)]
        return [item.label || item.name || item.marker || item.biomarker || item.domain || item.key || item.reason || item.summary || item.title || ''].filter(Boolean)
      })
      .filter(Boolean)
  }
  if (typeof value === 'object') return Object.values(value).flatMap(asTextList).filter(Boolean)
  return [String(value)]
}

function basedOnList(item) {
  const basedOn = item?.based_on || {}
  return [
    ...asTextList(basedOn.biomarkers || basedOn.markers || item?.biomarkers),
    ...asTextList(basedOn.symptoms || item?.symptoms),
    ...asTextList(basedOn.rules || basedOn.knowledge_rules),
  ].slice(0, 6)
}

function healthDomainList(item) {
  return asTextList(
    item?.knowledge_domain_context
    || item?.health_domains
    || item?.based_on?.health_domains
    || item?.based_on?.domains
  ).slice(0, 5)
}

function safetyNotesList(item) {
  return asTextList(item?.safety_notes || item?.safety_note || item?.warnings || item?.warning).slice(0, 4)
}

function retestMarkersList(item) {
  return asTextList(item?.retest_markers || item?.retest_marker || item?.follow_up_markers).slice(0, 5)
}

function localizeDomainLabel(value, isUk) {
  const raw = String(value || '').trim()
  if (!raw || !isUk) return raw
  const key = raw.toLowerCase().replace(/\s+/g, '_')
  return HEALTH_DOMAIN_LABELS_UK[key] || raw
}

function groupProtocol(rows) {
  const groups = {
    today: [],
    week: [],
    month: [],
    longTerm: [],
  }
  rows.forEach((item, index) => {
    const text = `${item?.timing || ''} ${item?.category || ''} ${item?.title || ''} ${item?.body || ''}`.toLowerCase()
    if (index < 2 || text.includes('today') || text.includes('morning') || text.includes('breakfast') || text.includes('daily')) groups.today.push(item)
    else if (text.includes('week') || text.includes('sleep') || text.includes('nutrition') || text.includes('food')) groups.week.push(item)
    else if (text.includes('month') || text.includes('retest') || text.includes('follow')) groups.month.push(item)
    else groups.longTerm.push(item)
  })
  return groups
}

function priorityTone(priority) {
  const p = formatPriority(priority)
  if (p === 'HIGH') return 'critical'
  if (p === 'MEDIUM') return 'warning'
  return 'neutral'
}

function ActionCard({ item, copy, isUk }) {
  const title = protocolTitle(item)
  const body = protocolBody(item)
  const timing = protocolTiming(item, isUk)
  const category = protocolCategory(item)
  const effort = effortLabel(item)
  const outcome = outcomeLabel(item)
  const evidence = evidenceLabel(item)
  const safety = safetyLabel(item)
  const basedOn = basedOnList(item)
  const domains = healthDomainList(item).map((domain) => localizeDomainLabel(domain, isUk))
  const safetyNotes = safetyNotesList(item)
  const retestMarkers = retestMarkersList(item)
  const expectedTimeline = item?.expected_timeline || item?.timeline || item?.expected_timeframe || null
  return (
    <CoachCard className="p-4" interactive>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-950">{title}</h3>
          {category && <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{category}</p>}
        </div>
        <CoachBadge tone={priorityTone(item?.priority)}>{formatPriority(item?.priority, isUk)}</CoachBadge>
      </div>
      {body && <p className="text-sm leading-6 text-slate-600">{body}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {timing && <CoachBadge tone="primary">{timing}</CoachBadge>}
        {effort && <CoachBadge tone="neutral">{copy.effort}: {effort}</CoachBadge>}
        {evidence && <CoachBadge tone="neutral">{copy.evidence}: {evidence}</CoachBadge>}
      </div>
      {outcome && <p className="mt-3 text-sm font-semibold text-slate-700">{copy.outcome}: <span className="font-normal text-slate-600">{outcome}</span></p>}
      {(basedOn.length || domains.length || expectedTimeline || retestMarkers.length) && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          {!!basedOn.length && <p><span className="font-semibold text-slate-800">{copy.basedOn}:</span> {basedOn.join(', ')}</p>}
          {!!domains.length && <p><span className="font-semibold text-slate-800">{copy.healthDomains}:</span> {domains.join(', ')}</p>}
          {expectedTimeline && <p><span className="font-semibold text-slate-800">{copy.expectedTimeline}:</span> {expectedTimeline}</p>}
          {!!retestMarkers.length && <p><span className="font-semibold text-slate-800">{copy.retestMarkers}:</span> {retestMarkers.join(', ')}</p>}
        </div>
      )}
      {(safety || safetyNotes.length) && (
        <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
          <span className="font-semibold">{copy.safetyNotes}: </span>
          {[safety, ...safetyNotes].filter(Boolean).join(' ')}
        </div>
      )}
    </CoachCard>
  )
}

async function exportProtocolPdf({ protocolRows, retestPlan, doctorDiscussion, uploadId, copy, isUk }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
  const margin = 44
  const width = doc.internal.pageSize.getWidth() - margin * 2
  let y = 48
  const safeUpload = String(uploadId || 'protocol').replace(/[^a-zA-Z0-9_-]/g, '')

  const addTitle = (text, size = 18) => {
    if (y > 720) { doc.addPage(); y = 48 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(size)
    doc.setTextColor(15, 23, 42)
    doc.text(text, margin, y)
    y += size + 12
  }
  const addText = (text, size = 10) => {
    if (!text) return
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(71, 85, 105)
    const lines = doc.splitTextToSize(String(text), width)
    lines.forEach((line) => {
      if (y > 760) { doc.addPage(); y = 48 }
      doc.text(line, margin, y)
      y += size + 5
    })
    y += 4
  }

  addTitle(copy.pdfTitle, 20)
  addText(`${copy.pdfUpload}: ${uploadId}`)
  addText(`${copy.pdfGenerated}: ${new Date().toLocaleString()}`)
  addTitle(copy.pdfSummary, 14)
  addText(copy.pdfSummaryBody(protocolRows.length))
  addTitle(copy.pdfActions, 14)
  protocolRows.forEach((item, index) => {
    addText(`${index + 1}. ${protocolTitle(item)}${item?.priority ? ` [${formatPriority(item.priority, isUk)}]` : ''}`, 11)
    addText(protocolBody(item), 9)
    const meta = [protocolTiming(item, isUk), protocolCategory(item), evidenceLabel(item)].filter(Boolean).join(' · ')
    addText(meta, 9)
  })
  addTitle(copy.pdfDiscussion, 14)
  ;(doctorDiscussion || []).slice(0, 8).forEach((item) => addText(`• ${item}`))
  addTitle(copy.pdfRetest, 14)
  ;(retestPlan || []).slice(0, 8).forEach((item) => addText(`• ${item.marker || copy.marker}: ${item.timing || item.reason || ''}`))
  addTitle(copy.pdfDisclaimer, 14)
  addText(copy.disclaimer)
  doc.save(`vitaloop-protocol-${safeUpload}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export default function ProtocolPage() {
  const { uploadId } = useParams()
  const navigate = useNavigate()
  const { hasAccess: canExport } = useFeature('advanced_protocol')
  const isUk = isUkrainianLocale()
  const copy = isUk ? PROTOCOL_COPY.uk : PROTOCOL_COPY.en
  const [biomarkers, setBiomarkers] = useState([])
  const [protocol, setProtocol] = useState([])
  const [doctorDiscussion, setDoctorDiscussion] = useState([])
  const [retestPlan, setRetestPlan] = useState([])
  const [safetyAlerts, setSafetyAlerts] = useState([])
  const [shoppingLinks, setShoppingLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await loadProtocolData(uploadId)
        if (!active) return
        setBiomarkers(data.biomarkers)
        setProtocol(data.protocol)
        setDoctorDiscussion(data.doctorDiscussion)
        setRetestPlan(data.retestPlan)
        setSafetyAlerts(data.safetyAlerts)
        setShoppingLinks(data.shoppingLinks)
      } catch (err) {
        if (!active) return
        const status = err?.response?.status
        if (status === 404) setError(copy.notFound)
        else if (status === 402) setError(copy.premium)
        else setError(copy.genericError)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [uploadId])

  const sortedProtocol = useMemo(() => sortProtocolByPriority(protocol), [protocol])
  const grouped = useMemo(() => groupProtocol(sortedProtocol), [sortedProtocol])
  const sections = [
    { key: 'today', title: copy.sections.today[0], body: copy.sections.today[1], rows: grouped.today },
    { key: 'week', title: copy.sections.week[0], body: copy.sections.week[1], rows: grouped.week },
    { key: 'month', title: copy.sections.month[0], body: copy.sections.month[1], rows: grouped.month },
    { key: 'longTerm', title: copy.sections.longTerm[0], body: copy.sections.longTerm[1], rows: grouped.longTerm },
  ].filter((section) => section.rows.length > 0)

  async function handleExportPdf() {
    if (!canExport || exporting || sortedProtocol.length === 0) return
    try {
      setExporting(true)
      await exportProtocolPdf({ protocolRows: sortedProtocol, retestPlan, doctorDiscussion, uploadId, copy, isUk })
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <div className="coach-shell"><CoachSkeleton rows={4} /></div>

  if (error) {
    return (
      <div className="coach-shell">
        <EmptyCoachState
          icon={ShieldAlert}
          title={copy.errorTitle}
          body={error}
          actionLabel={copy.backResults}
          onAction={() => navigate(`/results/${uploadId}`)}
        />
      </div>
    )
  }

  if (sortedProtocol.length === 0) {
    return (
      <div className="coach-shell">
        <EmptyCoachState
          icon={FileText}
          title={copy.noProtocol}
          body={copy.noProtocolBody}
          actionLabel={copy.openResult}
          onAction={() => navigate(`/results/${uploadId}`)}
        />
      </div>
    )
  }

  return (
    <div className="coach-shell coach-grid">
      <section className="coach-hero">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="coach-eyebrow">{copy.summaryEyebrow}</p>
            <h1 className="coach-title-xl">{copy.summaryTitle}</h1>
            <p className="coach-body mt-4 max-w-2xl">
              {copy.summaryBody}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <CoachButton variant="secondary" icon={ArrowLeft} onClick={() => navigate(`/results/${uploadId}`)}>{copy.backResults}</CoachButton>
              <CoachButton icon={Download} disabled={!canExport || exporting} onClick={handleExportPdf}>{exporting ? copy.exporting : copy.exportPdf}</CoachButton>
            </div>
          </div>
          <CoachCard className="p-5" tone="soft">
            <p className="coach-eyebrow">{copy.planContext}</p>
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-600">{copy.actions}</span><strong>{sortedProtocol.length}</strong></div>
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-600">{copy.biomarkers}</span><strong>{biomarkers.length}</strong></div>
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-600">{copy.retestItems}</span><strong>{retestPlan.length}</strong></div>
            </div>
          </CoachCard>
        </div>
      </section>

      {!!safetyAlerts.length && (
        <CoachCard tone="attention" className="p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 h-5 w-5 text-amber-600" />
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">{copy.safetyWarning}</h2>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-900">
                {safetyAlerts.slice(0, 4).map((alert, index) => <li key={index}>{alert.message || alert.body || String(alert)}</li>)}
              </ul>
            </div>
          </div>
        </CoachCard>
      )}

      {sections.map((section) => (
        <CoachCard key={section.key} className="p-5 sm:p-6">
          <div className="mb-5">
            <p className="coach-eyebrow">{section.title}</p>
            <h2 className="coach-title-lg">{section.body}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {section.rows.map((item, index) => <ActionCard key={`${protocolTitle(item)}-${index}`} item={item} copy={copy} isUk={isUk} />)}
          </div>
        </CoachCard>
      ))}

      {!!shoppingLinks.length && (
        <CoachCard className="p-5 sm:p-6">
          <div className="mb-5">
            <p className="coach-eyebrow">{copy.shoppingEyebrow}</p>
            <h2 className="coach-title-lg">{copy.shoppingTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {copy.shoppingBody}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {shoppingLinks.slice(0, 6).map((item, index) => (
              <div key={`${item.search_query || item.label}-${index}`} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-950">{item.label || item.search_query}</h3>
                    {item.category && <p className="mt-1 text-xs font-bold uppercase tracking-wide text-emerald-700">{item.category}</p>}
                  </div>
                  {item.priority && <CoachBadge tone={priorityTone(item.priority)}>{formatPriority(item.priority, isUk)}</CoachBadge>}
                </div>
                {item.reason && <p className="mt-3 text-sm leading-6 text-slate-600">{item.reason}</p>}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 sm:w-auto"
                  >
                    {copy.findIherb}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </CoachCard>
      )}

      <div className="coach-grid coach-grid--2">
        <CoachCard className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-extrabold text-slate-950">{copy.retestPlan}</h2>
          </div>
          {retestPlan.length ? (
            <div className="space-y-3">
              {retestPlan.slice(0, 6).map((item, index) => (
                <div key={index} className="rounded-2xl bg-slate-50 p-3">
                  <p className="font-bold text-slate-950">{item.marker || copy.marker}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.timing || item.reason || copy.discussTiming}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm leading-6 text-slate-600">{copy.retestFallback}</p>}
        </CoachCard>

        <CoachCard className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-extrabold text-slate-950">{copy.safetyDiscussion}</h2>
          </div>
          {doctorDiscussion.length ? (
            <ul className="space-y-2 text-sm leading-6 text-slate-700">
              {doctorDiscussion.slice(0, 6).map((item, index) => <li key={index} className="rounded-2xl bg-slate-50 p-3">{item}</li>)}
            </ul>
          ) : <p className="text-sm leading-6 text-slate-600">{copy.discussionFallback}</p>}
        </CoachCard>
      </div>

      <InsightCard
        icon={Sparkles}
        title={copy.evidenceTitle}
        body={copy.evidenceBody}
      />
    </div>
  )
}
