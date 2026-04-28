import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import HintBanner from '../components/tour/HintBanner.jsx'
import { useTourHints } from '../hooks/useTourHints.js'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  FlaskConical,
  Sparkles,
} from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { useSubscription } from '../hooks/useSubscription.js'
import StatCard from '../components/dashboard/StatCard.jsx'
import HealthChart from '../components/dashboard/HealthChart.jsx'
import AssignmentCard from '../components/dashboard/AssignmentCard.jsx'
import RecommendationsPanel from '../components/dashboard/RecommendationsPanel.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import MetricBar from '../components/dashboard/MetricBar.jsx'
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
  const { uploadCount, uploadLimit } = useSubscription()
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
          <MetricBar stats={stats} uploadCount={uploadCount} uploadLimit={uploadLimit} />

          {uploadLimit === 1 && (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-amber-100 p-2.5 flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-1">Unlock your full potential with Personal Pro</h3>
                  <p className="text-sm text-amber-800 mb-4">Get unlimited uploads, personalized AI protocols, weekly check-ins, and detailed biomarker tracking — all powered by advanced health intelligence.</p>
                  <button onClick={() => window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'SUBSCRIPTION_REQUIRED', source: 'dashboard-upgrade' } }))} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-700 transition">
                    Upgrade to Pro
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <motion.div {...fadeUp(0.04)} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            {/* Left: Chart + Next Task */}
            <div className="space-y-6">
              {progress.length > 0 ? (
                <DashboardCard title="Biomarker Trends" eyebrow="Health data">
                  <HealthChart progress={progress} />
                </DashboardCard>
              ) : (
                <DashboardCard title="Ready for data" eyebrow="Biomarker tracking">
                  <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                    <FlaskConical className="mx-auto h-8 w-8 text-slate-400 mb-3" />
                    <p className="text-sm text-slate-600">Upload your first lab to visualize trends and track your biomarkers over time.</p>
                    <button onClick={() => navigate('/upload')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      Upload your first lab
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </DashboardCard>
              )}

              {todayFocus.length > 0 && (
                <DashboardCard title="Next Task" eyebrow="Priority">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-emerald-900">{todayFocus[0].title}</div>
                        <p className="text-sm text-emerald-700 mt-1">{todayFocus[0].description}</p>
                        <button onClick={() => navigate(todayFocus[0]?.id ? `/assignments/${todayFocus[0].id}` : '/assignments')} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                          Start task
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </DashboardCard>
              )}
            </div>

            {/* Right: Insight + Activity */}
            <div className="space-y-6">
              {insights.length > 0 ? (
                <DashboardCard title="Today's Insight" eyebrow="Recommendation">
                  <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
                    <Sparkles className="h-5 w-5 text-purple-600 mb-2" />
                    <p className="text-sm font-medium text-purple-900">{insights[0].title}</p>
                    <p className="text-sm text-purple-700 mt-2">{insights[0].description}</p>
                  </div>
                </DashboardCard>
              ) : (
                <DashboardCard title="Insights" eyebrow="Coming soon">
                  <div className="text-center py-6">
                    <p className="text-sm text-slate-500">Insights appear after your first upload and check-in.</p>
                  </div>
                </DashboardCard>
              )}

              <DashboardCard title="Recent Activity" eyebrow="What's new">
                <div className="space-y-3 text-sm">
                  {latestUpload && (
                    <div className="flex gap-3 items-start">
                      <div className="rounded-xl bg-emerald-100 p-2"><Activity className="h-4 w-4 text-emerald-600" /></div>
                      <div>
                        <div className="font-medium text-slate-900">Lab uploaded</div>
                        <div className="text-xs text-slate-500">{latestUpload.lab_name || 'Your lab'}</div>
                      </div>
                    </div>
                  )}
                  {latestCheckin && (
                    <div className="flex gap-3 items-start">
                      <div className="rounded-xl bg-blue-100 p-2"><Clock className="h-4 w-4 text-blue-600" /></div>
                      <div>
                        <div className="font-medium text-slate-900">Check-in completed</div>
                        <div className="text-xs text-slate-500">Week of {latestCheckin.week_start}</div>
                      </div>
                    </div>
                  )}
                  {insights.length > 0 && (
                    <div className="flex gap-3 items-start">
                      <div className="rounded-xl bg-purple-100 p-2"><Sparkles className="h-4 w-4 text-purple-600" /></div>
                      <div>
                        <div className="font-medium text-slate-900">{insights.length} insight(s)</div>
                        <div className="text-xs text-slate-500">New recommendations</div>
                      </div>
                    </div>
                  )}
                  {!latestUpload && !latestCheckin && !insights.length && (
                    <p className="text-slate-500 py-4 text-center">No activity yet. Start by uploading your first lab report!</p>
                  )}
                </div>
              </DashboardCard>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
