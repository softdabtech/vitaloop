import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, ClipboardCheck, Route, ShieldAlert, Sparkles, Upload } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
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

// Stage 2F: only renders a percentage bar when `value` is an actual backend
// number (not undefined/null) — a missing real value shows truthful "Not yet
// calculated" text instead of silently defaulting to a fabricated number.
function ScoreRow({ label, value }) {
  if (value === null || value === undefined) {
    return (
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-600"><span>{label}</span><span className="text-slate-400">Not yet calculated</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" />
      </div>
    )
  }
  const v = Math.max(0, Math.min(100, Number(value)))
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
  // Stage 2E: a check-in must be "current" based on real elapsed time, not
  // just the presence of any historical check-in ever — otherwise the very
  // first check-in permanently satisfies this forever, and the loop never
  // asks for one again. week_start mirrors the backend's 7-day interval
  // (dashboard.py CHECKIN_DUE_INTERVAL_DAYS).
  const CHECKIN_DUE_INTERVAL_DAYS = 7
  const isCheckinCurrent = (() => {
    const reference = latestCheckin?.week_start || latestCheckin?.created_at
    if (!reference) return false
    const days = (Date.now() - new Date(reference).getTime()) / 86400000
    return days >= 0 && days < CHECKIN_DUE_INTERVAL_DAYS
  })()
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
  const hasCheckin = isCheckinCurrent

  const stageIndex = getHealthLoopStageIndex({ hasConcern, hasQuestions, hasLabPlan, hasResults, hasProtocol, hasCheckin })

  const nextAction = useMemo(() => {
    if (!hasConcern) return { label: 'Start symptom check', path: '/questionnaire', reason: 'Set an active concern to drive your loop.' }
    if (!hasLabPlan) return { label: 'Open lab plan', path: '/lab-plan', reason: 'Need plan readiness before upload.' }
    if (!hasResults) return { label: 'Upload results', path: '/upload', reason: 'Upload labs linked to your concern.' }
    if (!hasProtocol) return { label: 'Open protocol', path: '/assignments', reason: 'Translate results into actions.' }
    if (!hasCheckin) return { label: 'Complete check-in', path: '/check-ins', reason: 'Measure symptom response this week.' }
    return { label: 'Review results & trends', path: '/lab-results', reason: 'Track movement and retest timing.' }
  }, [hasConcern, hasLabPlan, hasResults, hasProtocol, hasCheckin])

  // Stage 2F: every value below now comes directly from a real, traceable
  // backend calculation (calculate_health_score() -> health_scores table,
  // exposed via stats.health_score_components) — none is invented in this
  // component, and a missing real value renders as "Not yet calculated"
  // (ScoreRow) rather than a fabricated fallback number. See the Stage 2F
  // audit report for the full before/after inventory of what this replaced:
  // biomarkerScore (flat 70/25 constant), safetyScore (binary substring
  // match), symptomScore (frontend-invented formula over a client-computed-
  // then-stored questionnaire value), profileScore (read a field that does
  // not exist in the API response and always fell back to a hardcoded 55).
  const healthScoreComponents = stats?.health_score_components || {}
  const symptomScore = healthScoreComponents.symptom
  const biomarkerScore = healthScoreComponents.biomarker
  const adherenceScore = healthScoreComponents.adherence
  const profileScore = summary?.profile?.onboarding?.completion_pct ?? null

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={ct().dashboard.title(user?.email?.split('@')[0])}
        subtitle={ct().dashboard.subtitle}
        helper={ct().dashboard.helper}
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
            <div className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900"><Sparkles className="h-4 w-4 text-emerald-600" /> Health Signal Score</div>
            <p className="mb-3 text-xs text-slate-500">
              {stats?.health_score != null
                ? `Overall: ${Math.round(stats.health_score)}%`
                : 'Overall score not yet calculated — upload a lab and complete a check-in to generate it.'}
            </p>
            <div className="space-y-3">
              <ScoreRow label="Symptoms" value={symptomScore} />
              <ScoreRow label="Biomarkers" value={biomarkerScore} />
              <ScoreRow label="Check-in adherence" value={adherenceScore} />
              <ScoreRow label="Profile completeness" value={profileScore} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900"><Route className="h-4 w-4 text-emerald-600" /> Symptom Check &amp; Lab Plan</div>
            <p className="text-sm text-slate-700">
              {!hasConcern
                ? 'Not started — set an active concern to begin.'
                : !hasQuestions
                  ? 'Symptom check in progress.'
                  : hasLabPlan
                    ? 'Lab plan ready for upload.'
                    : 'Symptom check complete — more context needed for a focused lab plan.'}
              {' '}| Uploads linked: {uploadCount}
            </p>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900"><ShieldAlert className="h-4 w-4 text-slate-500" /> Safety</div>
            <p className="text-sm text-slate-700">{concernSummary?.urgency || 'No urgent red flags reported.'}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900"><ClipboardCheck className="h-4 w-4 text-emerald-600" /> Protocol</div>
            <p className="text-sm text-slate-700">
              {assignments.length > 0
                ? `${stats.completed_tasks || 0} of ${assignments.length} tasks completed`
                : 'No active protocol tasks yet.'}
              {adherenceScore != null ? ` | Check-in adherence ${Math.round(adherenceScore)}%` : ''}
            </p>
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
