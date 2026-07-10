import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Beaker, CheckCircle2, Circle, Coins, FlaskConical, HelpCircle, Upload } from 'lucide-react'
import { CoachBadge, CoachButton, CoachCard, CoachProgress, EmptyCoachState, InsightCard } from '../components/coach/CoachUI.jsx'
import { useQuestionnaireSession } from '../hooks/useQueries.js'

const CORE_LABS = [
  { name: 'CBC', why: 'Baseline blood pattern and inflammation context.', related: 'Fatigue, dizziness, recovery', priority: 'Core' },
  { name: 'Ferritin', why: 'Iron storage can affect energy, hair shedding, stamina, and mood.', related: 'Fatigue, hair shedding, low stamina', priority: 'Core' },
  { name: 'CRP', why: 'Helps understand whether inflammation may be part of the picture.', related: 'Pain, swelling, persistent symptoms', priority: 'Core' },
  { name: 'Vitamin D', why: 'Supports immunity, mood, muscle function, and recovery.', related: 'Low mood, aches, fatigue', priority: 'Core' },
]

const RECOMMENDED_LABS = [
  { name: 'TSH + fT4', why: 'Thyroid context matters when fatigue, cold intolerance, or brain fog persist.', related: 'Energy, focus, temperature sensitivity', priority: 'Recommended' },
  { name: 'B12 + Folate', why: 'Supports nerve function, red blood cell production, and cognitive energy.', related: 'Fatigue, numbness, brain fog', priority: 'Recommended' },
  { name: 'Glucose + HbA1c', why: 'Shows whether blood sugar patterns may affect energy and cravings.', related: 'Energy dips, cravings, sleepiness after meals', priority: 'Recommended' },
]

const OPTIONAL_LABS = [
  { name: 'Omega-3 Index', why: 'Useful when inflammation, recovery, or cardiometabolic goals are important.', related: 'Recovery, inflammation, cardiovascular context', priority: 'Optional' },
  { name: 'Magnesium', why: 'Can be relevant for sleep quality, cramps, and stress response.', related: 'Sleep, cramps, tension', priority: 'Optional' },
]

function LabCard({ item, status }) {
  const tone = item.priority === 'Core' ? 'primary' : item.priority === 'Recommended' ? 'warning' : 'neutral'
  return (
    <CoachCard className="p-4" interactive>
      <div className="mb-4 flex items-start justify-between gap-3">
        <CoachBadge tone={tone}>{item.priority}</CoachBadge>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${status === 'uploaded' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {status === 'uploaded' ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
          {status}
        </span>
      </div>
      <h3 className="text-xl font-extrabold text-slate-950">{item.name}</h3>
      <p className="mt-3 text-sm font-bold text-slate-700">Why</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{item.why}</p>
      <p className="mt-3 text-sm font-bold text-slate-700">Related symptoms</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{item.related}</p>
    </CoachCard>
  )
}

export default function LabPlan() {
  const navigate = useNavigate()
  const { data: questionnaireSession } = useQuestionnaireSession()
  const sessionContext = questionnaireSession?.session_context || questionnaireSession?.session?.session_metadata || {}
  const concern = sessionContext?.active_concern || ''
  const concernSummary = sessionContext?.summary || null

  const readiness = useMemo(() => {
    const base = Number(concernSummary?.readiness || 42)
    return Math.max(20, Math.min(98, base))
  }, [concernSummary?.readiness])

  const uploaded = useMemo(() => new Set(Array.isArray(concernSummary?.linkedLabs) ? concernSummary.linkedLabs : []), [concernSummary])
  const statusFor = (item) => uploaded.has(item.name.toLowerCase()) ? 'uploaded' : 'suggested'

  if (!concern) {
    return (
      <div className="coach-shell">
        <EmptyCoachState
          icon={FlaskConical}
          title="Start with symptoms first"
          body="A focused lab plan works best when VITALOOP knows what you are trying to understand."
          actionLabel="Start symptom check"
          onAction={() => navigate('/questionnaire')}
        />
      </div>
    )
  }

  return (
    <div className="coach-shell coach-grid">
      <section className="coach-hero">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="coach-eyebrow">Lab Plan</p>
            <h1 className="coach-title-xl">Tests that make sense for your current question.</h1>
            <p className="coach-body mt-4 max-w-2xl">Based on: <strong>{concern}</strong>. This is not a diagnosis. It is a prioritized checklist for clinician discussion and result upload.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <CoachButton icon={Upload} trailingIcon={ArrowRight} onClick={() => navigate('/upload')}>Upload existing results</CoachButton>
              <CoachButton variant="secondary" icon={HelpCircle} onClick={() => document.getElementById('why-tests')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Why these tests?</CoachButton>
            </div>
          </div>
          <CoachCard className="p-5" tone="soft">
            <p className="coach-eyebrow">Plan readiness</p>
            <h2 className="text-2xl font-extrabold text-slate-950">{readiness}%</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">More symptom context and profile data make the plan more specific.</p>
            <div className="mt-5"><CoachProgress value={readiness} label="Readiness" /></div>
          </CoachCard>
        </div>
      </section>

      <div className="coach-grid coach-grid--3">
        <InsightCard icon={Beaker} title="Core tests" body="Start here when you want the broadest signal with the lowest complexity." />
        <InsightCard icon={FlaskConical} tone="warning" title="Recommended tests" body="Add these when symptoms point to a likely system or missing context." />
        <InsightCard icon={Coins} title="Budget note" body="Start with core tests if budget is limited. Add recommended tests when clinically reasonable." />
      </div>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5">
          <p className="coach-eyebrow">Core Tests</p>
          <h2 className="coach-title-lg">Best first pass</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CORE_LABS.map((item) => <LabCard key={item.name} item={item} status={statusFor(item)} />)}
        </div>
      </CoachCard>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5">
          <p className="coach-eyebrow">Recommended Tests</p>
          <h2 className="coach-title-lg">Add when they match your symptom pattern</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {RECOMMENDED_LABS.map((item) => <LabCard key={item.name} item={item} status={statusFor(item)} />)}
        </div>
      </CoachCard>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5">
          <p className="coach-eyebrow">Optional Tests</p>
          <h2 className="coach-title-lg">Useful for deeper context, not always necessary first</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {OPTIONAL_LABS.map((item) => <LabCard key={item.name} item={item} status={statusFor(item)} />)}
        </div>
      </CoachCard>

      <CoachCard id="why-tests" className="p-5 sm:p-6">
        <p className="coach-eyebrow">Why These Tests</p>
        <h2 className="coach-title-lg">The goal is priority, not more data.</h2>
        <p className="coach-body mt-3">VITALOOP groups tests by the question they help answer: energy and recovery, inflammation, nutrient status, thyroid context, and metabolic stability. Upload results when ready and the report will connect markers back to symptoms.</p>
      </CoachCard>
    </div>
  )
}
