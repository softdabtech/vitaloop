import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, ClipboardCheck, FlaskConical, Route, Upload } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useQuestionnaireSession } from '../hooks/useQueries.js'

const CORE_LABS = [
  { name: 'CBC', why: 'Baseline inflammation and blood pattern context', related: 'Fatigue, recovery, dizziness', priority: 'Core' },
  { name: 'Ferritin', why: 'Iron storage status for energy and recovery', related: 'Fatigue, hair shedding, low stamina', priority: 'Core' },
  { name: 'CRP', why: 'General inflammatory activity marker', related: 'Pain, swelling, persistent symptoms', priority: 'Core' },
  { name: 'Vitamin D', why: 'Immunity, mood, musculoskeletal support', related: 'Mood, fatigue, aches', priority: 'Core' },
]

const OPTIONAL_LABS = [
  { name: 'TSH + fT4', why: 'Thyroid context if fatigue or cold intolerance persist', related: 'Energy, focus, temperature sensitivity', priority: 'Discuss with clinician' },
  { name: 'B12 + Folate', why: 'Nervous system and red blood cell support', related: 'Fatigue, numbness, cognitive fog', priority: 'Optional' },
]

function statusBadge(status) {
  if (status === 'uploaded') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'ordered') return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

export default function LabPlan() {
  const navigate = useNavigate()
  const { data: questionnaireSession } = useQuestionnaireSession()
  const sessionContext = questionnaireSession?.session_context || questionnaireSession?.session?.session_metadata || {}
  const concern = sessionContext?.active_concern || 'your active concern'
  const concernSummary = sessionContext?.summary || null

  const readiness = useMemo(() => {
    const base = Number(concernSummary?.readiness || 42)
    return Math.max(20, Math.min(98, base))
  }, [concernSummary?.readiness])

  const statusRows = useMemo(() => {
    const uploaded = new Set(Array.isArray(concernSummary?.linkedLabs) ? concernSummary.linkedLabs : [])
    return CORE_LABS.map((item, idx) => {
      const normalized = item.name.toLowerCase()
      const isUploaded = uploaded.has(normalized)
      const status = isUploaded ? 'uploaded' : idx < 2 ? 'ordered' : 'suggested'
      return { ...item, status }
    })
  }, [concernSummary])

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={ct().labPlan.title}
        subtitle={ct().labPlan.subtitle(concern)}
        helper={ct().labPlan.helper}
        action={(
          <button
            onClick={() => navigate('/upload')}
            className="vtl-button-primary inline-flex items-center gap-2 px-4 text-sm"
          >
            <Upload className="h-4 w-4" />
            Upload Results
          </button>
        )}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lab plan readiness</p>
            <p className="text-sm text-slate-600">Based on symptom context, safety answers, and profile completeness.</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-lg font-bold text-emerald-700">{readiness}%</div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${readiness}%` }} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900">Core first-pass labs</h3>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[0.9fr_1.2fr_1fr] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Lab</span>
              <span>Why</span>
              <span>Related symptoms</span>
            </div>
            <div className="divide-y divide-slate-100">
              {CORE_LABS.map((item) => (
                <article key={item.name} className="grid grid-cols-1 gap-2 px-3 py-3 text-sm sm:grid-cols-[0.9fr_1.2fr_1fr]">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-slate-600">{item.why}</p>
                  <p className="text-slate-500">{item.related}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Route className="h-4 w-4 text-slate-600" />
            <h3 className="text-base font-semibold text-slate-900">Doctor direction</h3>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Bring your symptom timeline and this lab list to clinician discussion.
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Urgency guidance: if red flags are present or symptoms worsen quickly, do not delay medical review.
            </div>
            {OPTIONAL_LABS.map((item) => (
              <div key={item.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{item.name} <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Optional</span></p>
                <p className="mt-1 text-xs text-slate-600">{item.why}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-900">Plan status</h3>
        </div>
        <div className="space-y-2">
          {statusRows.map((row) => (
            <div key={row.name} className="grid grid-cols-[1.2fr_0.8fr_0.8fr] items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{row.name}</p>
                <p className="text-xs text-slate-500">{row.related}</p>
              </div>
              <span className="text-xs text-slate-600">{row.priority}</span>
              <span className={`inline-flex items-center justify-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${statusBadge(row.status)}`}>
                {row.status === 'uploaded' ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
