import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, ClipboardCheck, Route, ShieldAlert, Sparkles, Upload } from 'lucide-react'
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
  const profileScore = Number(stats?.profile_completion || 55)
  const labReadiness = Number(concernSummary?.readiness || 38)

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={`Today${user?.email ? `, ${user.email.split('@')[0]}` : ''}`}
        subtitle="One clear next action across your health loop."
        helper="Symptom-first path: concern -> questions -> lab plan -> results -> protocol -> check-in -> retest."
        action={(
          <button onClick={() => navigate(nextAction.path)} className="vtl-button-primary inline-flex items-center gap-2 px-4 text-sm">
            {nextAction.label}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Could not load Today data.</div>}
      {isLoading && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Loading Today page...</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Health Loop Status</p>
          <p className="text-xs text-slate-500">Current stage: {HEALTH_LOOP_STAGES[stageIndex]}</p>
        </div>
        <Stepper stageIndex={stageIndex} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h3 className="text-base font-semibold text-slate-900">Current Focus</h3>
            <p className="mt-2 text-sm text-slate-700">{concern || 'No active concern selected yet.'}</p>
            <p className="mt-1 text-xs text-slate-500">{nextAction.reason}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900"><Sparkles className="h-4 w-4 text-emerald-600" /> Health Signal Score</div>
            <div className="space-y-3">
              <ScoreRow label="Symptoms" value={symptomScore} />
              <ScoreRow label="Biomarkers" value={biomarkerScore} />
              <ScoreRow label="Adherence" value={protocolAdherence} />
              <ScoreRow label="Safety/Profile" value={Math.round((safetyScore + profileScore) / 2)} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900"><Route className="h-4 w-4 text-emerald-600" /> Lab Readiness</div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${labReadiness}%` }} /></div>
            <p className="text-sm text-slate-700">Readiness: {labReadiness}% | Uploads linked: {uploadCount}</p>
          </section>
        </div>

        <div className="space-y-6">
          <section className={`rounded-2xl border p-5 sm:p-6 ${safetyScore >= 70 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900"><ShieldAlert className={`h-4 w-4 ${safetyScore >= 70 ? 'text-emerald-600' : 'text-amber-600'}`} /> Safety</div>
            <p className="text-sm text-slate-700">{concernSummary?.urgency || 'No urgent red flags reported.'}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900"><ClipboardCheck className="h-4 w-4 text-emerald-600" /> Protocol Cycle</div>
            <p className="text-sm text-slate-700">Day {Math.min(14, Math.max(1, (new Date().getDate() % 14) || 1))} of 14 | Adherence {protocolAdherence}%</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => navigate('/assignments')} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Open protocol</button>
              <button onClick={() => navigate('/check-ins')} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Check-in now</button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h3 className="mb-3 text-base font-semibold text-slate-900">Recent Changes</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center gap-2"><Circle className="h-3.5 w-3.5 text-slate-400" /> Symptom check {hasConcern ? 'completed' : 'pending'}</div>
              <div className="flex items-center gap-2"><Circle className="h-3.5 w-3.5 text-slate-400" /> Lab plan {hasLabPlan ? 'ready' : 'needs answers'}</div>
              <div className="flex items-center gap-2"><Circle className="h-3.5 w-3.5 text-slate-400" /> Upload analyzed {latestUpload ? 'yes' : 'not yet'}</div>
              <div className="flex items-center gap-2"><Circle className="h-3.5 w-3.5 text-slate-400" /> Check-in {hasCheckin ? 'updated' : 'overdue'}</div>
            </div>
          </section>

          {!isPremium && (
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
              <div className="mb-2 flex items-center gap-2 text-base font-semibold text-blue-900"><Upload className="h-4 w-4" /> Loop stages unlocked by premium</div>
              <p className="text-sm text-blue-800">Symptom intake, lab plan depth, protocol adaptation, weekly optimization, and retest tracking.</p>
              <button onClick={() => navigate('/subscription')} className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Open billing</button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
