import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Beaker, CalendarCheck2, CheckCircle2, ClipboardList, HelpCircle, MessageCircle, Route, Sparkles, Stethoscope, UploadCloud } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useDashboardSummary, useQuestionnaireSession } from '../hooks/useQueries.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { CoachBadge, CoachButton, CoachCard, CoachProgress, CoachSkeleton, CoachTooltip, EmptyCoachState, InsightCard, KPIBlock } from '../components/coach/CoachUI.jsx'
import { HEALTH_LOOP_STAGES, getHealthLoopStageIndex } from '../lib/cabinetV511.js'

const JOURNEY_STEPS = [
  { label: 'Tell us how you feel', helper: 'Start with the symptom that matters most.', path: '/questionnaire', icon: Stethoscope },
  { label: 'Prepare your lab plan', helper: 'See which tests matter for your concern.', path: '/lab-plan', icon: ClipboardList },
  { label: 'Upload your labs', helper: 'Add PDF, images, spreadsheets, or manual values.', path: '/upload', icon: UploadCloud },
  { label: 'Understand results', helper: 'See what may connect to your symptoms.', path: '/lab-results', icon: Beaker },
  { label: 'Follow your plan', helper: 'Turn findings into practical next steps.', path: '/assignments', icon: Route },
  { label: 'Track progress', helper: 'Check in and compare changes over time.', path: '/progress', icon: CalendarCheck2 },
]

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

function mapTechnicalStageToHumanIndex(stageIndex) {
  if (stageIndex <= 1) return 0
  if (stageIndex === 2) return 1
  if (stageIndex === 3) return 2
  if (stageIndex === 4) return 3
  if (stageIndex === 5) return 4
  return 5
}

function JourneyCard({ step, index, active, done, onClick }) {
  const Icon = step.icon
  return (
    <button type="button" onClick={onClick} className={`coach-journey__step text-left ${active ? 'coach-journey__step--active' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="coach-journey__number">{done ? <CheckCircle2 className="h-4 w-4" /> : String(index + 1).padStart(2, '0')}</span>
        <Icon className={`h-5 w-5 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
      </div>
      <h3>{step.label}</h3>
      <p>{step.helper}</p>
    </button>
  )
}

export default function UserDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, isLoading, error } = useDashboardSummary()
  const { data: questionnaireSession } = useQuestionnaireSession()
  const { isPremium } = useSubscription()

  const summary = data || {}
  const stats = summary?.stats || {}
  const latestCheckin = summary?.blocks?.latest_checkin || null
  const latestUpload = summary?.blocks?.latest_upload || null
  const assignments = Array.isArray(summary?.blocks?.assignments) ? summary.blocks.assignments : []
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
  const humanStageIndex = mapTechnicalStageToHumanIndex(stageIndex)
  const activeStage = HEALTH_LOOP_STAGES[stageIndex]
  const stageEta = getStageEta(activeStage)

  const nextAction = useMemo(() => {
    if (!hasConcern) {
      return {
        label: 'Start Symptom Check',
        path: '/questionnaire',
        why: 'Your symptoms are the starting point. They tell VITALOOP which biomarkers and next questions matter first.',
        outcome: 'You will leave with a clearer concern and a focused lab direction.',
      }
    }
    if (!hasLabPlan) {
      return {
        label: 'Open Lab Plan',
        path: '/lab-plan',
        why: 'A focused lab plan prevents random testing and connects your symptoms to the markers worth checking.',
        outcome: 'You will see core, recommended, and optional tests.',
      }
    }
    if (!hasResults) {
      return {
        label: 'Upload Results',
        path: '/upload',
        why: 'Your lab values help explain what may be contributing to the symptoms you selected.',
        outcome: 'You will get a plain-language summary and priority findings.',
      }
    }
    if (!hasProtocol) {
      return {
        label: 'Open Action Plan',
        path: latestUpload?.id ? `/protocol/${latestUpload.id}` : '/assignments',
        why: 'The report becomes useful when it turns into what to do today, this week, and before retesting.',
        outcome: 'You will get actions, doctor questions, and retest timing.',
      }
    }
    if (!hasCheckin) {
      return {
        label: 'Complete Check-in',
        path: '/check-ins',
        why: 'Progress is measured by symptom response, not only by lab values.',
        outcome: 'You will track what improved, what stayed the same, and what needs adjustment.',
      }
    }
    return {
      label: 'Review Progress',
      path: '/progress',
      why: 'Your loop is active. Review trends and plan the next retest window.',
      outcome: 'You will see changes over time and what to watch next.',
    }
  }, [hasConcern, hasLabPlan, hasResults, hasProtocol, hasCheckin, latestUpload?.id])

  const recentItems = [
    {
      title: hasConcern ? 'Main concern is set' : 'No main concern yet',
      body: hasConcern ? concern : 'Tell VITALOOP what feels off first.',
      done: hasConcern,
      action: hasConcern ? 'Review' : 'Start',
      path: '/questionnaire',
    },
    {
      title: latestUpload ? 'Latest lab upload is ready' : 'No lab upload yet',
      body: latestUpload ? 'Your latest results are available for interpretation.' : 'Upload PDF, images, or enter values manually.',
      done: Boolean(latestUpload),
      action: latestUpload ? 'Open results' : 'Upload',
      path: latestUpload?.id ? `/results/${latestUpload.id}` : '/upload',
    },
    {
      title: assignments.length ? 'Action items available' : 'No action plan yet',
      body: assignments.length ? `${assignments.length} action item${assignments.length === 1 ? '' : 's'} are waiting.` : 'Generate a protocol after your results.',
      done: Boolean(assignments.length),
      action: assignments.length ? 'Open plan' : 'See journey',
      path: assignments.length ? '/assignments' : '/lab-plan',
    },
  ]

  if (isLoading) {
    return <div className="coach-shell"><CoachSkeleton rows={3} /></div>
  }

  if (error) {
    return (
      <div className="coach-shell">
        <EmptyCoachState
          title="We could not load your dashboard"
          body="Your account is safe. Try refreshing, or open your journey to continue from the last saved step."
          actionLabel="Open journey"
          onAction={() => navigate('/questionnaire')}
        />
      </div>
    )
  }

  return (
    <div className="coach-shell coach-grid">
      <section className="coach-hero">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <p className="coach-eyebrow">Your Next Best Step</p>
            <h1 className="coach-title-xl">{nextAction.label}{user?.email ? `, ${user.email.split('@')[0]}` : ''}</h1>
            <p className="coach-body mt-4 max-w-2xl">{nextAction.why}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <CoachButton onClick={() => navigate(nextAction.path)} trailingIcon={ArrowRight}>
                {nextAction.label}
              </CoachButton>
              <CoachButton
                variant="secondary"
                icon={HelpCircle}
                onClick={() => document.getElementById('why-this-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Why this step?
              </CoachButton>
            </div>
          </div>

          <CoachCard className="p-5" tone="soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="coach-eyebrow">Next Action</p>
                <h2 className="text-xl font-extrabold text-slate-950">{nextAction.label}</h2>
              </div>
              <CoachTooltip text="Estimated time is based on the current step, not a medical risk score.">
                <CoachBadge tone="primary">{stageEta}</CoachBadge>
              </CoachTooltip>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{nextAction.outcome}</p>
            <div className="mt-5">
              <CoachProgress value={Math.round(((humanStageIndex + 1) / JOURNEY_STEPS.length) * 100)} label="Journey progress" />
            </div>
          </CoachCard>
        </div>
      </section>

      {!isPremium && (
        <CoachCard tone="attention" className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-amber-900">Premium unlocks deeper protocols, check-ins, and trend guidance when you reach those steps.</p>
            <CoachButton variant="secondary" size="sm" onClick={() => navigate('/subscription')}>View plans</CoachButton>
          </div>
        </CoachCard>
      )}

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="coach-eyebrow">Health Journey</p>
            <h2 className="coach-title-lg">From symptom chaos to a clear loop</h2>
          </div>
          <CoachBadge tone="neutral">Current: {JOURNEY_STEPS[humanStageIndex]?.label}</CoachBadge>
        </div>
        <div className="coach-journey">
          {JOURNEY_STEPS.map((step, index) => (
            <JourneyCard
              key={step.label}
              step={step}
              index={index}
              active={index === humanStageIndex}
              done={index < humanStageIndex}
              onClick={() => navigate(step.path)}
            />
          ))}
        </div>
      </CoachCard>

      <div className="coach-grid coach-grid--2">
        <CoachCard id="why-this-step" className="p-5 sm:p-6">
          <p className="coach-eyebrow">Why This Matters</p>
          <h2 className="coach-title-lg">VITALOOP explains what is happening, why it matters, and what to do next.</h2>
          <div className="mt-5 grid gap-4">
            <InsightCard
              icon={Sparkles}
              title="What is happening?"
              body={concern ? `Your current focus is: ${concern}.` : 'Your symptom focus has not been set yet.'}
              actionLabel={hasConcern ? 'Update symptoms' : 'Set concern'}
              onAction={() => navigate('/questionnaire')}
            />
            <InsightCard
              icon={MessageCircle}
              title="Why does it matter?"
              body="Symptoms are connected to biomarker patterns, safety context, and your profile. This keeps the report focused instead of generic."
            />
            <InsightCard
              icon={Route}
              title="What should I do next?"
              body={nextAction.outcome}
              actionLabel={nextAction.label}
              onAction={() => navigate(nextAction.path)}
            />
          </div>
        </CoachCard>

        <div className="coach-grid">
          <KPIBlock
            icon={Stethoscope}
            tone={hasConcern ? 'success' : 'warning'}
            label="Symptom context"
            value={hasConcern ? 'Ready' : 'Missing'}
            helper={hasConcern ? concern : 'Start with the main concern.'}
          />
          <KPIBlock
            icon={Beaker}
            tone={latestUpload ? 'success' : 'warning'}
            label="Lab context"
            value={latestUpload ? 'Uploaded' : 'Not uploaded'}
            helper={latestUpload ? 'Results are available for interpretation.' : 'Add labs when you have them.'}
          />
          <KPIBlock
            icon={CalendarCheck2}
            tone={hasCheckin ? 'success' : 'neutral'}
            label="Progress tracking"
            value={hasCheckin ? 'Active' : 'Not started'}
            helper="Check-ins show whether actions are helping."
          />
        </div>
      </div>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="coach-eyebrow">Recent Context</p>
            <h2 className="coach-title-lg">Keep the loop moving</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {recentItems.map((item) => (
            <CoachCard key={item.title} className="p-4" interactive>
              <div className="mb-4 flex items-start justify-between gap-3">
                <CoachBadge tone={item.done ? 'success' : 'warning'}>{item.done ? 'Ready' : 'Next'}</CoachBadge>
                <button type="button" onClick={() => navigate(item.path)} className="text-sm font-extrabold text-teal-700 hover:text-teal-900">{item.action}</button>
              </div>
              <h3 className="text-lg font-extrabold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </CoachCard>
          ))}
        </div>
      </CoachCard>
    </div>
  )
}
