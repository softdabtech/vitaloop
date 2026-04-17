import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { useSubscription } from '../hooks/useSubscription.js'
import UserDashboardSidebar from '../components/dashboard/UserDashboardSidebar.jsx'
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

function deriveNutritionGroups(biomarkers) {
  if (!biomarkers?.length) return NUTRITION_MAP.slice(0, 3)
  const deficientNames = biomarkers
    .filter((b) => b.status === 'DEFICIENT' || b.status === 'BORDERLINE')
    .map((b) => (b.name || '').toLowerCase())
  const matched = NUTRITION_MAP.filter((group) =>
    group.keywords.some((kw) => deficientNames.some((n) => n.includes(kw)))
  )
  const unmatched = NUTRITION_MAP.filter((g) => !matched.includes(g))
  return [...matched, ...unmatched].slice(0, Math.max(3, matched.length))
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
    <tr className={`border-b border-slate-100 transition-colors ${isHighlighted ? 'bg-emerald-50/70 hover:bg-emerald-50' : 'hover:bg-slate-50/80'}`}>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isHighlighted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            <Pill className="w-3.5 h-3.5" />
          </div>
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
    </tr>
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
          Upgrade — $49/month
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
  const { isActive, loading: subLoading } = useSubscription()
  const [biomarkers, setBiomarkers] = useState([])
  const [protocol, setProtocol] = useState([])
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  useEffect(() => {
    async function load() {
      const [bmRes, prRes] = await Promise.all([
        supabase.from('biomarkers').select('*').eq('upload_id', uploadId),
        supabase.from('protocols').select('*').eq('upload_id', uploadId).single(),
      ])
      setBiomarkers(bmRes.data ?? [])
      setProtocol(prRes.data?.recommendations ?? [])
      setLoading(false)
    }
    load()
  }, [uploadId])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const nutritionGroups = deriveNutritionGroups(biomarkers)
  const sortedProtocol = [...protocol].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return (order[a.priority] ?? 9) - (order[b.priority] ?? 9)
  })

  const deficientCount = biomarkers.filter(
    (b) => b.status === 'DEFICIENT' || b.status === 'ELEVATED'
  ).length

  if (loading || subLoading) {
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
    <div className="vtl-page flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="hidden lg:block">
        <UserDashboardSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          user={user}
          onLogout={handleLogout}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
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
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Print
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-16">

            {/* Hero header */}
            <div className="rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 p-6 sm:p-8 text-white shadow-lg overflow-hidden relative">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 50%)' }} />
              <p className="text-emerald-100 text-xs font-semibold uppercase tracking-widest mb-2">Personalized Protocol</p>
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight mb-2">Your 7-Day Health Plan</h2>
              <p className="text-emerald-100 text-sm max-w-lg leading-relaxed">
                Based on your lab results{deficientCount > 0 ? ` and ${deficientCount} flagged biomarkers` : ''}, here is your personalized supplement, nutrition, and lifestyle protocol.
              </p>
              <div className="flex flex-wrap gap-6 mt-5">
                <div>
                  <div className="text-2xl font-bold">{sortedProtocol.length}</div>
                  <div className="text-emerald-200 text-xs uppercase tracking-wider">Supplements</div>
                </div>
                <div className="w-px bg-emerald-400/60" />
                <div>
                  <div className="text-2xl font-bold">{nutritionGroups.length}</div>
                  <div className="text-emerald-200 text-xs uppercase tracking-wider">Food Groups</div>
                </div>
                <div className="w-px bg-emerald-400/60" />
                <div>
                  <div className="text-2xl font-bold">3</div>
                  <div className="text-emerald-200 text-xs uppercase tracking-wider">Lifestyle Areas</div>
                </div>
              </div>
            </div>

            {/* ── Nutrition Plan ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                    <div
                      key={group.name}
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
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Supplement Protocol Table ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  Supplement Protocol
                </h3>
                <span className="text-xs text-slate-400">{sortedProtocol.length} supplements · 7 days</span>
              </div>

              {isActive ? (
                sortedProtocol.length > 0 ? (
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
                )
              ) : (
                <PaywallTeaser
                  onUpgrade={() =>
                    window.dispatchEvent(
                      new CustomEvent('paywall:trigger', {
                        detail: { reason: 'SUBSCRIPTION_REQUIRED' },
                      })
                    )
                  }
                />
              )}
            </div>

            {/* ── Lifestyle Recommendations ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  Lifestyle Recommendations
                </h3>
                <span className="text-xs text-slate-400">Daily habits for best results</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {LIFESTYLE_SECTIONS.map(({ icon: Icon, title, color, items }) => {
                  const c = COLOR_CLASSES[color] ?? COLOR_CLASSES.emerald
                  return (
                    <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg} text-white shadow-sm`}>
                          <Icon className="w-4 h-4" />
                        </div>
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
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
