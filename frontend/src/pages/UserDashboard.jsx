import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import HintBanner from '../components/tour/HintBanner.jsx'
import { useTourHints } from '../hooks/useTourHints.js'
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardList,
  Crown,
  FlaskConical,
  Sparkles,
} from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import StatCard from '../components/dashboard/StatCard.jsx'
import HealthChart from '../components/dashboard/HealthChart.jsx'
import AssignmentCard from '../components/dashboard/AssignmentCard.jsx'
import QuickActionsPanel from '../components/dashboard/QuickActionsPanel.jsx'
import ProgressTimeline from '../components/dashboard/ProgressTimeline.jsx'
import RecommendationsPanel from '../components/dashboard/RecommendationsPanel.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { enrichAssignments } from '../lib/assignmentScoring.js'
import '../styles/userDashboard.css'
import '../styles/dashboard2026.css'

function DashboardCard({ title, eyebrow, children, action }) {
  return (
    <section
      className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 backdrop-blur-sm sm:p-6"
      style={{
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.06), inset 0 1px 0 rgba(29,158,117,0.08)',
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">{eyebrow}</div>}
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function EmptyBlock({ title, body, cta, onClick }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/85 p-5 text-center">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
      {cta && (
        <button onClick={onClick} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600">
          {cta}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function DashboardLoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[128px] animate-pulse rounded-3xl border border-slate-200/80 bg-white/90" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.95fr_320px]">
        <div className="h-[320px] animate-pulse rounded-3xl border border-slate-200/80 bg-white/90" />
        <div className="h-[320px] animate-pulse rounded-3xl border border-slate-200/80 bg-white/90" />
        <div className="h-[320px] animate-pulse rounded-3xl border border-slate-200/80 bg-white/90" />
      </div>
    </div>
  )
}

function FirstRunDashboard({ startHere, steps, completedCount, onboardingComplete, onUploadClick, onProfileClick }) {
  const total = steps.length
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const title = startHere?.title || 'Start here: get first value in 30 seconds'
  const description = startHere?.description || 'Upload one lab file to unlock results, insights, and your first protocol direction.'
  const topSteps = (startHere?.steps || steps.map((step) => step.label)).slice(0, 3)

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_48%),linear-gradient(135deg,_#ffffff,_#effcf6_55%,_#f8fafc)] p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Start here</div>
            <h2 className="max-w-2xl text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
            <div className="grid gap-2 pt-2 sm:grid-cols-3">
              {topSteps.map((step, index) => (
                <div key={step} className="rounded-2xl border border-white/70 bg-white/80 px-3.5 py-3 text-sm leading-5 text-slate-600 shadow-sm sm:px-4">
                  <span className="mr-2 font-semibold text-emerald-600">{index + 1}.</span>{step}
                </div>
              ))}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-[280px] lg:min-w-[240px] lg:max-w-[240px]">
            <button
              onClick={onUploadClick}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              {startHere?.cta_label || 'Upload first lab'}
              <ArrowRight className="h-4 w-4" />
            </button>
            {!onboardingComplete && (
              <button
                onClick={onProfileClick}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Complete health profile
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <DashboardCard title="What unlocks after the first upload" eyebrow="Immediate value">
          <div className="space-y-3">
            {[
              'Structured biomarker extraction from your report',
              'A readable results screen instead of raw PDF numbers',
              'Insight cards and your next best action',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-5 text-slate-700 sm:px-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard title="Account readiness" eyebrow="Setup progress">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-4">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Progress</span>
              <span>{completedCount}/{total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="space-y-2">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-5 text-slate-700 sm:px-4">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${step.done ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span className={step.done ? 'font-medium text-slate-900' : ''}>{step.label}</span>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>
    </div>
  )
}

function HealthRing({ value }) {
  const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0
  return (
    <div className="mx-auto flex h-[240px] w-[240px] items-center justify-center">
      <div
        className="relative h-[220px] w-[220px] rounded-full"
        style={{ background: `conic-gradient(#10B981 ${safeValue * 3.6}deg, rgba(148,163,184,0.18) 0deg)` }}
      >
        <div className="absolute inset-[16px] flex items-center justify-center rounded-full bg-white shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
          <div className="text-center">
            <div className="text-5xl font-bold tracking-tight text-slate-900">{value ?? '--'}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">health score</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const DASHBOARD_HINTS = [
  '👋 Welcome to your health cabinet! Start by uploading your first lab report — the dashboard fills in automatically after analysis.',
  '📋 The checklist below tracks your setup progress. Each step you complete improves the accuracy of your AI-generated protocol and insights.',
  '⚡ After your first upload you\'ll see biomarker scores, supplement assignments, and a health score — all updated automatically with each new test.',
]

export default function UserDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const { show: showHints, dismiss: dismissHints } = useTourHints('dashboard')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return

    let active = true
    setLoading(true)

    api.get('/dashboard/summary')
      .then((response) => {
        if (!active) return
        const payload = response?.data || {}
        const rankedAssignments = enrichAssignments(payload?.blocks?.assignments || [])
          .sort((a, b) => (b?.priority?.score || 0) - (a?.priority?.score || 0))

        setSummary({
          ...payload,
          blocks: {
            ...payload.blocks,
            assignments: rankedAssignments,
            today_focus: rankedAssignments.filter((item) => String(item?.status || '').toLowerCase() !== 'completed').slice(0, 3),
          },
        })
        setError(null)
      })
      .catch(() => {
        if (!active) return
        setError('Could not load current dashboard data.')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  const profile = summary?.profile || {}
  const stats = summary?.stats || {}
  const startHere = summary?.start_here || {}
  const nextBestAction = summary?.next_best_action || {}
  const progress = summary?.blocks?.progress || []
  const assignments = summary?.blocks?.assignments || []
  const todayFocus = summary?.blocks?.today_focus || []
  const insights = summary?.blocks?.insights || []
  const latestUpload = summary?.blocks?.latest_upload || null
  const latestCheckin = summary?.blocks?.latest_checkin || null
  const hasUploads = Number(stats.total_uploads || 0) > 0
  const onboardingComplete = Boolean(user?.onboarding_complete || profile?.onboarding_complete)
  const hasProtocol = Boolean(stats.active_program && String(stats.active_program).toLowerCase() !== 'not started')
  const isFirstRun = !loading && !hasUploads
  const showStartHere = Boolean(startHere?.enabled && isFirstRun)
  const journeySteps = [
    { id: 'account', label: 'Account created', done: true },
    { id: 'upload', label: 'Upload your first lab', done: hasUploads },
    { id: 'profile', label: 'Complete health profile', done: onboardingComplete },
    { id: 'symptoms', label: 'Add symptoms or check-in', done: Boolean(latestCheckin) },
    { id: 'protocol', label: 'Unlock first protocol', done: hasProtocol },
  ]
  const completedJourneyCount = journeySteps.filter((step) => step.done).length

  const greeting = useMemo(() => profile?.first_name || user?.email?.split('@')?.[0] || 'there', [profile?.first_name, user?.email])

  const fadeUp = (delay = 0) => reduced
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.55, delay, ease: [0.2, 0.65, 0.3, 1] },
        viewport: { once: true, margin: '-10% 0px -10% 0px' },
      }

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={`Welcome back, ${greeting}`}
        subtitle={profile?.onboarding?.requires_onboarding ? profile?.onboarding?.current_stage_label || 'Continue onboarding' : 'Your dashboard is assembled from current uploads, assignments, and check-ins.'}
        helper={isFirstRun ? 'Start with one upload. The dashboard expands as soon as your first lab is processed.' : 'Your biomarker trends, supplement protocol, and assignments are all kept in sync here.'}
        action={!loading && !isFirstRun ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/upload')} className="vtl-button-primary px-4 text-sm">Upload labs</button>
            {hasUploads && <button onClick={() => navigate('/lab-results')} className="vtl-button-secondary px-4 text-sm">Open results</button>}
          </div>
        ) : null}
      />

      {showHints && !loading && (
        <HintBanner hints={DASHBOARD_HINTS} onDone={dismissHints} />
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <DashboardLoadingState />
      ) : isFirstRun ? (
        <FirstRunDashboard
          startHere={showStartHere ? startHere : null}
          steps={journeySteps}
          completedCount={completedJourneyCount}
          onboardingComplete={onboardingComplete}
          onUploadClick={() => navigate((showStartHere && startHere?.cta_path) || '/upload')}
          onProfileClick={() => navigate('/settings')}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Lab uploads"
              value={stats.total_uploads ?? 0}
              unit="total"
              icon={FlaskConical}
              color="emerald"
              onClick={() => navigate('/lab-results')}
            />
            <StatCard title="Active assignments" value={stats.active_assignments ?? 0} unit="live" icon={ClipboardList} color="blue" />
            <StatCard title="Insights ready" value={stats.insights_count ?? 0} unit="cards" icon={Brain} color="purple" />
            <StatCard
              title="Current Plan"
              value={
                stats.subscription === 'free' ? 'Free' :
                stats.subscription === 'personal_pro' ? 'Personal Pro' :
                stats.subscription === 'enterprise' ? 'Enterprise' :
                (String(stats.subscription || 'free').replace('_', ' '))
              }
              unit="plan"
              icon={Crown}
              color="orange"
              onClick={() => window.location.href = '/subscription'}
            />
          </div>

          <motion.div {...fadeUp(0.04)} className="grid items-start gap-4 xl:grid-cols-[1.1fr_0.95fr_320px]">
        <DashboardCard title="Current account state" eyebrow="Live summary">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next best action</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{nextBestAction?.title || 'No urgent action'}</div>
              <p className="mt-1 text-sm text-slate-500">{nextBestAction?.description || 'Your dashboard will surface the next meaningful task here.'}</p>
              {nextBestAction?.path && (
                <button onClick={() => navigate(nextBestAction.path)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  {nextBestAction.cta_label || 'Open'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Most recent upload</div>
              {latestUpload ? (
                <>
                  <div className="mt-2 text-base font-semibold text-slate-900">{latestUpload.lab_name || 'Latest lab upload'}</div>
                  <p className="mt-1 text-sm text-slate-500">{latestUpload.test_date || latestUpload.created_at?.slice(0, 10) || 'Date unavailable'}</p>
                  <button onClick={() => navigate('/lab-results')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    Review upload history
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No upload yet. The moment you add the first report, this block becomes your freshest biomarker snapshot.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Latest check-in</div>
              {latestCheckin ? (
                <>
                  <div className="mt-2 text-base font-semibold text-slate-900">Week of {latestCheckin.week_start}</div>
                  <p className="mt-1 text-sm text-slate-500">Energy {latestCheckin.energy_score ?? '--'}/10, sleep {latestCheckin.sleep_quality ?? '--'}/10, mood {latestCheckin.mood_score ?? '--'}/10.</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No weekly check-in recorded yet. Logging one gives the system a current symptom and adherence pulse.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current protocol state</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{stats.active_program || 'Not started'}</div>
              <p className="mt-1 text-sm text-slate-500">{assignments.length > 0 ? `${assignments.length} assignment(s) currently connected to your plan.` : 'Assignments will appear here after onboarding, uploads, or weekly updates.'}</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard title="Health score" eyebrow="Current status">
          <HealthRing value={stats.health_score} />
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Score movement</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{stats.health_score_change > 0 ? '+' : ''}{stats.health_score_change ?? 0}</div>
              <p className="mt-1 text-sm text-slate-600">Difference from the previous calculation.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed tasks</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{stats.completed_tasks ?? 0}</div>
              <p className="mt-1 text-sm text-slate-600">Finished protocol actions tracked by the system.</p>
            </div>
          </div>
        </DashboardCard>

            <QuickActionsPanel />
          </motion.div>

          <motion.div {...fadeUp(0.08)} className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardCard
          title="Today focus"
          eyebrow="Priority queue"
          action={<button onClick={() => navigate('/assignments')} className="text-sm font-semibold text-emerald-700">Open all</button>}
        >
          {todayFocus.length > 0 ? (
            <div className="space-y-3">
              {todayFocus.map((assignment) => (
                <AssignmentCard
                  key={assignment.id || assignment.title}
                  assignment={assignment}
                  onClick={() => navigate(assignment?.id ? `/assignments/${assignment.id}` : '/assignments')}
                />
              ))}
            </div>
          ) : (
            <EmptyBlock
              title="No urgent tasks right now"
              body="After your next upload or weekly check-in, this block will promote the most important next step instead of leaving you guessing."
              cta="Run weekly check-in"
              onClick={() => navigate('/check-ins')}
            />
          )}
        </DashboardCard>

        <DashboardCard title="What changed recently" eyebrow="Recent signal">
          {latestUpload ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><Activity className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Latest upload ready</div>
                    <p className="mt-1 text-sm text-slate-500">{latestUpload.lab_name || 'Recent upload'} was processed and is ready for biomarker review and protocol generation.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-purple-50 p-3 text-purple-600"><Sparkles className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Insights waiting</div>
                    <p className="mt-1 text-sm text-slate-500">{insights.length > 0 ? `${insights.length} active insight card(s) are already available.` : 'No insight cards yet. This area will become richer after more uploads or check-ins.'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyBlock
              title="The dashboard is ready for live lab data"
              body="Once your first report is uploaded, this block will show the newest result, protocol availability, and the latest interpretation context."
              cta="Upload first lab"
              onClick={() => navigate('/upload')}
            />
          )}
        </DashboardCard>
          </motion.div>

          <motion.div {...fadeUp(0.12)} className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardCard title="Progress trend" eyebrow="Biomarker history">
          {progress.length > 0 ? <HealthChart progress={progress} /> : (
            <EmptyBlock
              title="Trend charts appear after uploads"
              body="When you upload at least one lab report, this section becomes your biomarker progress surface instead of a blank chart."
              cta="Add your first upload"
              onClick={() => navigate('/upload')}
            />
          )}
        </DashboardCard>

        <DashboardCard title="Recommendations" eyebrow="Live intelligence">
          {insights.length > 0 ? <RecommendationsPanel insights={insights} /> : (
            <EmptyBlock
              title="No active recommendations yet"
              body="This area will explain detected trends, red flags, and retest suggestions once enough data arrives."
              cta="Open insights"
              onClick={() => navigate('/insights')}
            />
          )}
        </DashboardCard>
          </motion.div>

          <motion.div {...fadeUp(0.14)}>
            <DashboardCard title="Health activity timeline" eyebrow="Historical context">
              {progress.length > 0 ? <ProgressTimeline progress={progress} /> : (
                <EmptyBlock
                  title="Your timeline starts with the first upload"
                  body="After the first lab, timeline events will record uploads, generated protocols, insights, and follow-up actions in one place."
                  cta="Go to upload"
                  onClick={() => navigate('/upload')}
                />
              )}
            </DashboardCard>
          </motion.div>
        </>
      )}
    </div>
  )
}
