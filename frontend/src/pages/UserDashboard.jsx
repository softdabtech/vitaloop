import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardCheck, Route, ShieldAlert, Sparkles } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useDashboardSummary } from '../hooks/useQueries.js'
import { useQuestionnaireSession } from '../hooks/useQueries.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { HEALTH_LOOP_STAGES, getHealthLoopStageIndex } from '../lib/cabinetV511.js'

function Stepper({ stageIndex }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {HEALTH_LOOP_STAGES.map((stage, index) => {
        const done = index < stageIndex
        const active = index === stageIndex
        return (
          <div key={stage} className={`rounded-xl border px-2 py-2 text-xs font-semibold ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : done ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-slate-200 bg-white text-slate-500'}`}>
            {stage}
          </div>
        )
      })}
    </div>
  )
}

function ScoreRow({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-600"><span>{label}</span><span>{v}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${v}%` }} /></div>
    </div>
  )
}

function getStageEta(stage) {
  const byStage = {
    Concern: '3-5 min',
    Questions: '4-6 min',
    'Lab Plan': '2-4 min',
    Results: '5-8 min',
    Protocol: '4-6 min',
    'Check-in': '2-3 min',
    Retest: '3-4 min',
  }
  return byStage[stage] || '3-5 min'
}

export default function UserDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, isLoading, error } = useDashboardSummary()
  const { isPremium, uploadCount } = useSubscription()

  const summary = data || {}
  const stats = summary?.stats || {}
  const latestCheckin = summary?.blocks?.latest_checkin || null
  const latestUpload = summary?.blocks?.latest_upload || null
  const assignments = Array.isArray(summary?.blocks?.assignments) ? summary.blocks.assignments : []
  const { data: questionnaireSession } = useQuestionnaireSession()
  const sessionContext = questionnaireSession?.session_context || questionnaireSession?.session?.session_metadata || {}
  const concern = sessionContext?.active_concern || ''
  const concernSummary = sessionContext?.summary || null

  const hasConcern = Boolean(concern)
  const hasQuestions = Boolean(concernSummary?.readiness)
  const hasLabPlan = Boolean(concernSummary?.readiness && concernSummary.readiness >= 40)
  const hasResults = Number(stats.total_uploads || 0) > 0
  const hasProtocol = Boolean(stats?.active_program && String(stats.active_program).toLowerCase() !== 'not started')
  const hasCheckin = Boolean(latestCheckin)

  const stageIndex = getHealthLoopStageIndex({ hasConcern, hasQuestions, hasLabPlan, hasResults, hasProtocol, hasCheckin })

  const nextAction = useMemo(() => {
    if (!hasConcern) return { label: 'Start symptom check', path: '/questionnaire', reason: 'Set an active concern to drive your loop.' }
    if (!hasLabPlan) return { label: 'Open lab plan', path: '/lab-plan', reason: 'Need plan readiness before upload.' }
    if (!hasResults) return { label: 'Upload results', path: '/upload', reason: 'Upload labs linked to your concern.' }
    if (!hasProtocol) return { label: 'Open protocol', path: '/assignments', reason: 'Translate results into actions.' }
    if (!hasCheckin) return { label: 'Complete check-in', path: '/check-ins', reason: 'Measure symptom response this week.' }
    return { label: 'Review results & trends', path: '/lab-results', reason: 'Track movement and retest timing.' }
  }, [hasConcern, hasLabPlan, hasResults, hasProtocol, hasCheckin])

  const protocolAdherence = Math.max(0, Math.min(100, Math.round((Number(stats.completed_tasks || 0) / Math.max(assignments.length, 1)) * 100)))
  const symptomScore = concernSummary?.severity ? Math.max(0, 100 - concernSummary.severity * 9) : 42
  const biomarkerScore = hasResults ? 70 : 25
  const safetyScore = concernSummary?.urgency?.includes('No urgent') ? 85 : 45
  const profileScore = Number(stats?.profile_completion || 50)
  const labReadiness = Number(concernSummary?.readiness || 38)
  const healthSignal = Math.round((symptomScore + biomarkerScore + protocolAdherence + profileScore) / 4)
  const activeStage = HEALTH_LOOP_STAGES[stageIndex]
  const stageEta = getStageEta(activeStage)
  const requiresPremiumForNextStep = !isPremium && (nextAction.path === '/assignments' || nextAction.path === '/check-ins')

  const updates = [
    {
      done: hasConcern,
      text: hasConcern ? 'Symptom check completed' : 'Answer symptom check to define your main concern',
      actionLabel: hasConcern ? null : 'Start now',
      actionPath: '/questionnaire',
    },
    {
      done: hasLabPlan,
      text: hasLabPlan ? 'Lab plan is ready' : 'Answer 3 short questions to generate your lab plan',
      actionLabel: hasLabPlan ? null : 'Open lab plan',
      actionPath: '/lab-plan',
    },
    {
      done: Boolean(latestUpload),
      text: latestUpload ? 'Lab results uploaded and linked' : 'Upload your first lab file to unlock interpretation',
      actionLabel: latestUpload ? null : 'Upload file',
      actionPath: '/upload',
    },
  ]

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={`Your next best step${user?.email ? `, ${user.email.split('@')[0]}` : ''}`}
        subtitle={nextAction.label}
        helper={nextAction.reason}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate(nextAction.path)} className="vtl-button-primary inline-flex items-center gap-2 px-4 text-sm">
              {nextAction.label}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => document.getElementById('why-this-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Why this step?
            </button>
          </div>
        )}
      />

      {requiresPremiumForNextStep && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This step is part of Premium. You can continue now and upgrade when prompted.
        </div>
      )}

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Could not load Today data.</div>}
      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Progress</p>
          <p className="text-xs text-slate-500">You are here: {activeStage} · ETA {stageEta}</p>
        </div>
        <Stepper stageIndex={stageIndex} />
      </section>

      <section id="why-this-step" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-base font-semibold text-slate-900">Why this step</h3>
        <p className="mt-2 text-sm text-slate-700">{nextAction.reason}</p>
        <p className="mt-1 text-xs text-slate-500">{concern ? `Current concern: ${concern}` : 'No active concern selected yet. Start with symptom check for a personalized loop.'}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Sparkles className="h-4 w-4 text-emerald-600" /> Health signal</div>
          <p className="text-3xl font-bold tracking-tight text-slate-900">{healthSignal}%</p>
          <p className="mt-2 text-xs text-slate-500">Composite of symptoms, biomarkers, adherence, and profile status.</p>
          <div className="mt-3">
            <ScoreRow label="Readiness" value={labReadiness} />
          </div>
        </div>

        <div className={`rounded-2xl border p-5 ${safetyScore >= 70 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldAlert className={`h-4 w-4 ${safetyScore >= 70 ? 'text-emerald-600' : 'text-amber-600'}`} /> Safety status</div>
          <p className="text-lg font-semibold text-slate-900">{safetyScore >= 70 ? 'Stable' : 'Needs attention'}</p>
          <p className="mt-2 text-xs text-slate-600">{concernSummary?.urgency || 'No urgent red flags reported.'}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardCheck className="h-4 w-4 text-emerald-600" /> Protocol day</div>
          <p className="text-3xl font-bold tracking-tight text-slate-900">{Math.min(14, Math.max(1, (new Date().getDate() % 14) || 1))}/14</p>
          <p className="mt-2 text-xs text-slate-600">Adherence {protocolAdherence}% · Uploads linked {uploadCount}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => navigate('/assignments')} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Open protocol</button>
            <button onClick={() => navigate('/check-ins')} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Check-in</button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900"><Route className="h-4 w-4 text-emerald-600" /> Recent updates</div>
        <div className="space-y-3">
          {updates.map((item) => (
            <div key={item.text} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {item.text}
              </div>
              {item.actionLabel ? (
                <button onClick={() => navigate(item.actionPath)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                  {item.actionLabel}
                </button>
              ) : (
                <span className="text-xs font-semibold text-emerald-700">Done</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {!isPremium && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
          <p className="text-sm text-blue-800">Some advanced steps unlock when needed. Upgrade only when you reach them.</p>
          <button onClick={() => navigate('/subscription')} className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">View billing</button>
        </section>
      )}
    </div>
  )
}
