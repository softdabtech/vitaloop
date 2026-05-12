import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { useFeature } from '../hooks/useFeature.js'
import FeatureGate from '../components/FeatureGate.jsx'
import HintBanner from '../components/tour/HintBanner.jsx'
import { useTourHints } from '../hooks/useTourHints.js'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import {
  ArrowLeft, Pill, Droplets, Moon, Zap, Check,
  ExternalLink, UtensilsCrossed, Clock, Download,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

const TIMING_TO_SCHEDULE = {
  morning: '8:00 am',
  with_breakfast: '8:00 am',
  before_breakfast: '7:30 am',
  with_food: '12:00 pm · 6:00 pm',
  with_lunch: '12:00 pm',
  afternoon: '2:00 pm',
  with_dinner: '6:00 pm',
  morning_with_food: '8:00 am',
  morning_empty: '7:30 am',
  between_meals: '2:00 pm',
  evening: '6:00 pm',
  night: '9:00 pm',
  before_bed: '9:00 pm',
  bedtime: '10:00 pm',
}

const NUTRITION_MAP = [
  {
    name: 'Leafy Greens',
    keywords: ['iron', 'folate', 'folic acid', 'magnesium', 'calcium', 'vitamin k', 'b9'],
    foods: ['Spinach, kale, arugula', 'Broccoli & Brussels sprouts', 'Swiss chard, collard greens'],
    color: 'emerald',
  },
  {
    name: 'Lean Proteins',
    keywords: ['b12', 'vitamin b12', 'zinc', 'protein', 'albumin', 'ferritin', 'selenium'],
    foods: ['Chicken breast, turkey', 'Eggs, tuna, legumes', 'Greek yogurt, cottage cheese'],
    color: 'teal',
  },
  {
    name: 'Healthy Fats',
    keywords: ['vitamin d', 'd3', 'omega', 'omega-3', 'vitamin a', 'vitamin e', 'epa', 'dha'],
    foods: ['Salmon, sardines, mackerel', 'Avocado, extra-virgin olive oil', 'Walnuts, flaxseeds'],
    color: 'amber',
  },
  {
    name: 'Complex Carbs',
    keywords: ['glucose', 'blood sugar', 'insulin', 'hba1c', 'glycated', 'cortisol'],
    foods: ['Oats, quinoa, sweet potato', 'Brown rice, whole grains', 'Lentils, black beans'],
    color: 'blue',
  },
]

const LIFESTYLE_SECTIONS = [
  {
    icon: Droplets,
    title: 'Hydration',
    color: 'blue',
    items: [
      'Drink 2–3 L of water daily',
      'Add electrolytes post-exercise',
      'Limit caffeine after noon',
    ],
  },
  {
    icon: Moon,
    title: 'Sleep',
    color: 'indigo',
    items: [
      'Aim for 7–9 hours per night',
      'Consistent sleep/wake schedule',
      'Reduce screen time 1h before bed',
    ],
  },
  {
    icon: Zap,
    title: 'Exercise',
    color: 'emerald',
    items: [
      'Protocol-aligned movement daily',
      'Strength training 3× per week',
      'Morning walks to aid absorption',
    ],
  },
]

const COLOR_CLASSES = {
  emerald: { bg: 'bg-emerald-500', text: 'text-white', ring: 'ring-emerald-500/20' },
  teal:    { bg: 'bg-teal-500',    text: 'text-white', ring: 'ring-teal-500/20' },
  amber:   { bg: 'bg-amber-400',   text: 'text-white', ring: 'ring-amber-400/20' },
  blue:    { bg: 'bg-blue-500',    text: 'text-white', ring: 'ring-blue-500/20' },
  indigo:  { bg: 'bg-indigo-500',  text: 'text-white', ring: 'ring-indigo-500/20' },
}

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }
const NUTRITION_RELEVANT_STATUSES = new Set(['DEFICIENT', 'BORDERLINE'])
const DEFICIENT_STATUSES = new Set(['DEFICIENT', 'ELEVATED'])

function hasStatusIn(status, allowedStatuses) {
  return allowedStatuses.has(String(status || '').toUpperCase())
}

function normalizeBiomarkerName(name) {
  return String(name || '').toLowerCase()
}

function deriveNutritionGroups(biomarkers) {
  if (!biomarkers?.length) return NUTRITION_MAP.slice(0, 3)
  const deficientNames = biomarkers
    .filter((biomarker) => hasStatusIn(biomarker.status, NUTRITION_RELEVANT_STATUSES))
    .map((biomarker) => normalizeBiomarkerName(biomarker.name))
  const matched = NUTRITION_MAP.filter((group) =>
    group.keywords.some((keyword) => deficientNames.some((name) => name.includes(keyword)))
  )
  const unmatched = NUTRITION_MAP.filter((g) => !matched.includes(g))
  return [...matched, ...unmatched].slice(0, Math.max(3, matched.length))
}

function formatPriority(priority) {
  return String(priority || 'LOW').toUpperCase()
}

function sortProtocolByPriority(protocol) {
  return [...protocol].sort((a, b) => {
    return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
  })
}

function countDeficientBiomarkers(biomarkers) {
  return biomarkers.filter((biomarker) => hasStatusIn(biomarker.status, DEFICIENT_STATUSES)).length
}

function triggerSubscriptionRequiredPaywall() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('paywall:trigger', {
        detail: { reason: 'SUBSCRIPTION_REQUIRED' },
      })
    )
  }
}

async function loadProtocolData(uploadId) {
  const [bmRes, prRes] = await Promise.all([
    supabase.from('biomarkers').select('*').eq('upload_id', uploadId),
    supabase.from('protocols').select('*').eq('upload_id', uploadId).single(),
  ])

  return {
    biomarkers: bmRes.data ?? [],
    protocol: prRes.data?.recommendations ?? [],
  }
}

function buildPdfRows(protocolRows) {
  return protocolRows.map((rec) => {
    const schedule = TIMING_TO_SCHEDULE[rec.timing] ?? (rec.timing?.replace(/_/g, ' ') ?? '-')
    return [
      rec.supplement || '-',
      rec.dosage || '-',
      schedule,
      formatPriority(rec.priority),
      rec.rationale || '-',
    ]
  })
}

async function exportProtocolPdf({ protocolRows, nutritionGroups, lifestyleSections, uploadId }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 44
  const contentWidth = pageWidth - margin * 2
  const createdAt = new Date().toLocaleString()

  const supplementsTotal = protocolRows.length
  const highPriority = protocolRows.filter((row) => formatPriority(row.priority) === 'HIGH').length
  const mediumPriority = protocolRows.filter((row) => formatPriority(row.priority) === 'MEDIUM').length
  const lowPriority = Math.max(0, supplementsTotal - highPriority - mediumPriority)

  const drawLogo = () => {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(margin, 24, 32, 32, 6, 6, 'F')
    doc.setTextColor(16, 185, 129)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('V', margin + 11, 44)
    doc.setLineWidth(1.8)
    doc.setDrawColor(16, 185, 129)
    doc.line(margin + 19, 42, margin + 23, 46)
    doc.line(margin + 23, 46, margin + 29, 36)
  }

  const drawHeader = (title, subtitle) => {
    doc.setFillColor(16, 185, 129)
    doc.rect(0, 0, pageWidth, 86, 'F')
    drawLogo()

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.text(title, margin + 42, 40)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    if (subtitle) {
      doc.text(subtitle, margin + 42, 56)
    }

    doc.setFontSize(9)
    doc.text(`Upload: ${uploadId}`, pageWidth - margin - 120, 38)
    doc.text(`Generated: ${createdAt}`, pageWidth - margin - 120, 52)
  }

  const drawFooter = (pageNum, totalPages) => {
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.6)
    doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('VITALOOP Confidential Protocol', margin, pageHeight - 20)
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 54, pageHeight - 20)
  }

  const addPage = (title, subtitle) => {
    doc.addPage()
    drawHeader(title, subtitle)
    return 112
  }

  const ensureSpace = (cursorY, requiredHeight, title, subtitle) => {
    if (cursorY + requiredHeight <= pageHeight - 52) {
      return cursorY
    }
    return addPage(title, subtitle)
  }

  // Summary page
  drawHeader('VITALOOP - 7-Day Health Protocol', 'Personalized summary and action plan')

  let y = 112
  doc.setTextColor(31, 41, 55)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Executive Summary', margin, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const summaryLines = [
    `Total supplements in current protocol: ${supplementsTotal}`,
    `Priority split: HIGH ${highPriority}, MEDIUM ${mediumPriority}, LOW ${lowPriority}`,
    `Nutrition focus groups: ${nutritionGroups.map((group) => group.name).slice(0, 4).join(', ') || 'N/A'}`,
    `Lifestyle blocks included: ${lifestyleSections.map((item) => item.title).join(', ')}`,
  ]
  summaryLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(`- ${line}`, contentWidth)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 12 + 2
  })

  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Top Priority Supplements', margin, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const topRows = protocolRows.slice(0, 5)
  if (topRows.length === 0) {
    doc.text('- No supplements available for this upload yet.', margin, y)
    y += 12
  } else {
    topRows.forEach((row) => {
      const schedule = TIMING_TO_SCHEDULE[row.timing] ?? (row.timing?.replace(/_/g, ' ') ?? '-')
      const line = `${row.supplement || '-'} (${row.dosage || '-'}) - ${schedule} [${formatPriority(row.priority)}]`
      const wrapped = doc.splitTextToSize(`- ${line}`, contentWidth)
      y = ensureSpace(y, wrapped.length * 12 + 4, 'Protocol Summary (cont.)', 'Auto-generated continuation')
      doc.text(wrapped, margin, y)
      y += wrapped.length * 12 + 2
    })
  }

  // Detailed table starts on a new page
  addPage('Supplement Protocol', 'Detailed dosage, schedule, and rationale')
  autoTable(doc, {
    startY: 112,
    margin: { left: margin, right: margin },
    head: [['Supplement', 'Dosage', 'Schedule', 'Priority', 'Rationale']],
    body: buildPdfRows(protocolRows),
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      textColor: [31, 41, 55],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      valign: 'top',
    },
    headStyles: {
      fillColor: [240, 253, 250],
      textColor: [15, 118, 110],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 70 },
      2: { cellWidth: 85 },
      3: { cellWidth: 55 },
      4: { cellWidth: contentWidth - 300 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const value = String(data.cell.raw || '').toUpperCase()
        if (value === 'HIGH') data.cell.styles.textColor = [190, 18, 60]
        if (value === 'MEDIUM') data.cell.styles.textColor = [180, 83, 9]
      }
    },
    didDrawPage: () => {
      drawHeader('Supplement Protocol', 'Detailed dosage, schedule, and rationale')
    },
  })

  const tableY = (doc.lastAutoTable?.finalY || 112) + 18
  y = tableY

  y = ensureSpace(y, 24, 'Protocol Details', 'Nutrition and lifestyle guidance')
  if (y === 112) {
    drawHeader('Protocol Details', 'Nutrition and lifestyle guidance')
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(31, 41, 55)
  doc.text('Nutrition Plan', margin, y)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  nutritionGroups.forEach((group) => {
    const foods = (group.foods || []).join(', ')
    const wrappedFoods = doc.splitTextToSize(foods, contentWidth - 8)
    const blockHeight = 12 + wrappedFoods.length * 12 + 8
    y = ensureSpace(y, blockHeight, 'Protocol Details (cont.)', 'Nutrition and lifestyle guidance')
    if (y === 112) {
      drawHeader('Protocol Details (cont.)', 'Nutrition and lifestyle guidance')
    }
    doc.setFont('helvetica', 'bold')
    doc.text(group.name, margin, y)
    y += 12
    doc.setFont('helvetica', 'normal')
    doc.text(wrappedFoods, margin + 4, y)
    y += wrappedFoods.length * 12 + 8
  })

  y += 2
  y = ensureSpace(y, 24, 'Protocol Details (cont.)', 'Lifestyle guidance')
  if (y === 112) {
    drawHeader('Protocol Details (cont.)', 'Lifestyle guidance')
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Lifestyle Recommendations', margin, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  lifestyleSections.forEach((section) => {
    const sectionLines = section.items.reduce((acc, item) => {
      const wrapped = doc.splitTextToSize(`- ${item}`, contentWidth - 8)
      return acc + wrapped.length
    }, 0)
    const requiredHeight = 12 + sectionLines * 12 + 10
    y = ensureSpace(y, requiredHeight, 'Protocol Details (cont.)', 'Lifestyle guidance')
    if (y === 112) {
      drawHeader('Protocol Details (cont.)', 'Lifestyle guidance')
    }

    doc.setFont('helvetica', 'bold')
    doc.text(section.title, margin, y)
    y += 12
    doc.setFont('helvetica', 'normal')

    section.items.forEach((item) => {
      const wrapped = doc.splitTextToSize(`- ${item}`, contentWidth - 8)
      doc.text(wrapped, margin + 4, y)
      y += wrapped.length * 12 + 2
    })
    y += 6
  })

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    drawFooter(page, totalPages)
  }

  const safeUpload = String(uploadId || 'protocol').replace(/[^a-zA-Z0-9_-]/g, '')
  const datePart = new Date().toISOString().slice(0, 10)
  doc.save(`vitaloop-protocol-${safeUpload}-${datePart}.pdf`)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PriorityBadge({ priority }) {
  const colors = {
    HIGH:   'bg-rose-100 text-rose-700 border-rose-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    LOW:    'bg-slate-100 text-slate-500 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colors[priority] ?? colors.LOW}`}>
      {priority ?? 'LOW'}
    </span>
  )
}

function SupplementRow({ rec, index }) {
  const isHighlighted = rec.priority === 'HIGH' || index === 0
  const schedule = TIMING_TO_SCHEDULE[rec.timing] ?? (rec.timing?.replace(/_/g, ' ') ?? '—')

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={`border-b border-slate-100 transition-colors ${isHighlighted ? 'bg-emerald-50/70 hover:bg-emerald-50' : 'hover:bg-slate-50/80'}`}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: isHighlighted ? Infinity : 0 }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isHighlighted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
          >
            <Pill className="w-3.5 h-3.5" />
          </motion.div>
          <div>
            <div className={`font-semibold text-sm ${isHighlighted ? 'text-emerald-900' : 'text-slate-900'}`}>
              {rec.supplement}
            </div>
            <div className="text-xs text-slate-400">{rec.dosage}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell max-w-xs">
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{rec.rationale}</p>
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-600">{schedule}</span>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-col gap-1.5 items-start">
          <PriorityBadge priority={rec.priority} />
          {rec.iherb_url && (
            <a
              href={rec.iherb_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              iHerb <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </td>
    </motion.tr>
  )
}

function PaywallTeaser({ onUpgrade }) {
  return (
    <div className="relative select-none">
      {/* Blurred rows */}
      <div className="blur-sm pointer-events-none">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-slate-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-slate-200" />
              <div className="h-2.5 w-20 rounded bg-slate-100" />
            </div>
            <div className="h-3 w-20 rounded bg-slate-100 hidden md:block" />
            <div className="h-3 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-[2px] rounded-b-xl">
        <p className="text-slate-900 font-bold text-base mb-1">Unlock Your Protocol</p>
        <p className="text-slate-500 text-sm mb-4">Subscribe to see your personalized supplement schedule</p>
        <button
          onClick={onUpgrade}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
        >
          Upgrade — {PREMIUM_PRICE_LABEL}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProtocolPage() {
  const { uploadId } = useParams()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { show: showHints, dismiss: dismissHints } = useTourHints('protocol')
  const { hasAccess: canExport } = useFeature('advanced_protocol')
  const [biomarkers, setBiomarkers] = useState([])
  const [protocol, setProtocol] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function load() {
      const data = await loadProtocolData(uploadId)
      setBiomarkers(data.biomarkers)
      setProtocol(data.protocol)
      setLoading(false)
    }
    load()
  }, [uploadId])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const nutritionGroups = deriveNutritionGroups(biomarkers)
  const sortedProtocol = sortProtocolByPriority(protocol)

  const deficientCount = countDeficientBiomarkers(biomarkers)

  const handleExportPdf = async () => {
    if (!canExport || sortedProtocol.length === 0 || exporting) return
    try {
      setExporting(true)
      await exportProtocolPdf({
        protocolRows: sortedProtocol,
        nutritionGroups,
        lifestyleSections: LIFESTYLE_SECTIONS,
        uploadId,
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm">Loading your protocol…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="vtl-page w-full">
      <div className="w-full">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex h-[76px] items-center justify-between gap-4 border-b border-slate-200 bg-white/90 backdrop-blur-sm px-4 sm:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/results/${uploadId}`)}
              className="vtl-focus-ring flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors rounded-lg px-2 py-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Results</span>
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <h1 className="text-base sm:text-lg font-semibold text-slate-900">7-Day Health Protocol</h1>
          </div>
          <button
            onClick={handleExportPdf}
            disabled={!canExport || sortedProtocol.length === 0 || exporting}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-16">

            {showHints && (
              <HintBanner
                hints={[
                  '💊 Each supplement is ranked by health impact — highest priority first. Focus on the first 1–3 items before adding more.',
                  '⏰ Timing matters: "morning empty stomach" means 30 min before food. "With food" means any meal. Follow the schedule for best absorption.',
                  '📥 Premium subscribers can export this protocol as a PDF to share with their doctor or nutritionist.',
                ]}
                onDone={dismissHints}
              />
            )}

            {/* Hero header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 p-6 sm:p-8 text-white shadow-lg overflow-hidden relative"
            >
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 50%)' }} />
              <p className="text-emerald-100 text-xs font-semibold uppercase tracking-widest mb-2">Personalized Protocol</p>
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight mb-2">Your 7-Day Health Plan</h2>
              <p className="text-emerald-100 text-sm max-w-lg leading-relaxed">
                Based on your lab results{deficientCount > 0 ? ` and ${deficientCount} flagged biomarkers` : ''}, here is your personalized supplement, nutrition, and lifestyle protocol.
              </p>
              <div className="flex flex-wrap gap-6 mt-5">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <div className="text-2xl font-bold">{sortedProtocol.length}</div>
                  <div className="text-emerald-200 text-xs uppercase tracking-wider">Supplements</div>
                </motion.div>
                <div className="w-px bg-emerald-400/60" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <div className="text-2xl font-bold">{nutritionGroups.length}</div>
                  <div className="text-emerald-200 text-xs uppercase tracking-wider">Food Groups</div>
                </motion.div>
                <div className="w-px bg-emerald-400/60" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <div className="text-2xl font-bold">3</div>
                  <div className="text-emerald-200 text-xs uppercase tracking-wider">Lifestyle Areas</div>
                </motion.div>
              </div>
            </motion.div>

            {/* ── Nutrition Plan ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
                  Nutrition Plan
                </h3>
                <span className="text-xs text-slate-400">Prioritised by your deficiencies</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {nutritionGroups.map((group, i) => {
                  const c = COLOR_CLASSES[group.color] ?? COLOR_CLASSES.emerald
                  const isHighlight = i < 2
                  return (
                    <motion.div
                      key={group.name}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      whileHover={{ y: -4, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      className={`rounded-xl p-4 transition-shadow ${
                        isHighlight
                          ? `${c.bg} ${c.text} shadow-md`
                          : 'border border-slate-200 bg-slate-50 text-slate-800 hover:shadow-sm'
                      }`}
                    >
                      <div className="font-semibold text-sm mb-2.5">{group.name}</div>
                      <ul className="space-y-1.5">
                        {group.foods.map((food) => (
                          <li
                            key={food}
                            className={`text-xs flex items-start gap-2 ${isHighlight ? 'text-white/85' : 'text-slate-500'}`}
                          >
                            <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isHighlight ? 'bg-white/60' : 'bg-slate-300'}`} />
                            {food}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>

            {/* ── Supplement Protocol Table ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  Supplement Protocol
                </h3>
                <span className="text-xs text-slate-400">{sortedProtocol.length} supplements · 7 days</span>
              </div>

              <FeatureGate
                feature="advanced_protocol"
                onLocked={triggerSubscriptionRequiredPaywall}
                fallback={<PaywallTeaser onUpgrade={triggerSubscriptionRequiredPaywall} />}
              >
                {sortedProtocol.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                          <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Supplement / Dosage</th>
                          <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Rationale</th>
                          <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Daily Schedule</th>
                          <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedProtocol.map((rec, i) => (
                          <SupplementRow key={`${rec.supplement}-${i}`} rec={rec} index={i} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    No supplement protocol generated yet.
                  </div>
                )}
              </FeatureGate>
            </motion.div>

            {/* ── Lifestyle Recommendations ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  Lifestyle Recommendations
                </h3>
                <span className="text-xs text-slate-400">Daily habits for best results</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {LIFESTYLE_SECTIONS.map(({ icon: Icon, title, color, items }, idx) => {
                  const c = COLOR_CLASSES[color] ?? COLOR_CLASSES.emerald
                  return (
                    <motion.div
                      key={title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: idx * 0.1 }}
                      whileHover={{ y: -4, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-2.5 mb-3">
                        <motion.div
                          animate={{ rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 3, repeat: Infinity, delay: idx * 0.2 }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg} text-white shadow-sm`}
                        >
                          <Icon className="w-4 h-4" />
                        </motion.div>
                        <span className="font-semibold text-sm text-slate-900">{title}</span>
                      </div>
                      <ul className="space-y-2">
                        {items.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                            <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  )
}
