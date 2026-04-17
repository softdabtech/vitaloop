import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Brain,
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
import PremiumEmptyDashboardState from '../components/dashboard/PremiumEmptyDashboardState.jsx'
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

export default function UserDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
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

  const greeting = useMemo(() => profile?.first_name || user?.email?.split('@')?.[0] || 'there', [profile?.first_name, user?.email])

  const fadeUp = (delay = 0) => reduced
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.55, delay, ease: [0.2, 0.65, 0.3, 1] },
        viewport: { once: true, margin: '-10% 0px -10% 0px' },
      }

  if (!loading && !hasUploads) {
    return (
      <div className="space-y-6">
        <CabinetPageHeader
          title={`Welcome back, ${greeting}`}
          subtitle="Your AI-powered health intelligence platform"
          helper="Upload your first lab to activate biomarker analysis, personalized protocols, and longitudinal tracking."
          action={(
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate('/upload')} className="vtl-button-primary px-4 text-sm">Upload first lab</button>
              <button onClick={() => navigate('/how-it-works')} className="vtl-button-secondary px-4 text-sm">How it works</button>
            </div>
          )}
        />

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <PremiumEmptyDashboardState userName={greeting} onUploadClick={() => navigate('/upload')} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={`Welcome back, ${greeting}`}
        subtitle={profile?.onboarding?.requires_onboarding ? profile?.onboarding?.current_stage_label || 'Continue onboarding' : 'Your dashboard is assembled from current uploads, assignments, and check-ins.'}
        helper="Every block below should either show your live data or explain exactly what will unlock after the next action."
        action={(
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/upload')} className="vtl-button-primary px-4 text-sm">Upload labs</button>
            <button onClick={() => navigate('/lab-results')} className="vtl-button-secondary px-4 text-sm">Open results</button>
          </div>
        )}
      />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {startHere?.enabled && (
        <motion.section
          {...fadeUp()}
          className="rounded-[28px] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_48%),linear-gradient(135deg,_#ffffff,_#effcf6_55%,_#f8fafc)] p-5 shadow-sm sm:p-6"
          style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.06), inset 0 1px 0 rgba(29,158,117,0.14)' }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Start here</div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{startHere.title}</h2>
              <p className="max-w-2xl text-sm text-slate-600">{startHere.description}</p>
              <div className="grid gap-2 pt-2 sm:grid-cols-3">
                {(startHere.steps || []).slice(0, 3).map((step, index) => (
                  <div key={step} className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
                    <span className="mr-2 font-semibold text-emerald-600">{index + 1}.</span>{step}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => navigate(startHere.cta_path || '/upload')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              {startHere.cta_label || 'Continue'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Lab uploads" value={loading ? '...' : (stats.total_uploads ?? 0)} unit="total" icon={FlaskConical} color="emerald" />
        <StatCard title="Active assignments" value={loading ? '...' : (stats.active_assignments ?? 0)} unit="live" icon={ClipboardList} color="blue" />
        <StatCard title="Insights ready" value={loading ? '...' : (stats.insights_count ?? 0)} unit="cards" icon={Brain} color="purple" />
        <StatCard title="Subscription" value={loading ? '...' : String(stats.subscription || 'free').replace('_', ' ')} unit="plan" icon={Crown} color="orange" />
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
    </div>
  )
}
