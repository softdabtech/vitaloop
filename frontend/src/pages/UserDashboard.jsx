import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
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
import StreakCounter from '../components/StreakCounter.jsx'
import AchievementBadges from '../components/AchievementBadges.jsx'
import PersonalizedHealthTips from '../components/PersonalizedHealthTips.jsx'
import { enrichAssignments } from '../lib/assignmentScoring.js'
import '../styles/userDashboard.css'
import '../styles/dashboard2026.css'

// Helper functions for computing dashboard state
function computeOnboardingComplete(profile) {
  return Boolean(
    profile?.onboarding?.checklist?.onboarding_complete
    || profile?.onboarding?.requires_onboarding === false
  )
}

function computeHasProtocol(stats) {
  return Boolean(stats?.active_program && String(stats.active_program).toLowerCase() !== 'not started')
}

function buildJourneySteps(hasUploads, onboardingComplete, latestCheckin, hasProtocol) {
  return [
    { id: 'account', label: 'Account created', done: true },
    { id: 'upload', label: 'Upload your first lab', done: hasUploads },
    { id: 'profile', label: 'Complete health profile', done: onboardingComplete },
    { id: 'symptoms', label: 'Add symptoms or check-in', done: Boolean(latestCheckin) },
    { id: 'protocol', label: 'Unlock first protocol', done: hasProtocol },
  ]
}

function getGreeting(profile, userEmail) {
  return profile?.first_name || userEmail?.split('@')?.[0] || 'there'
}

function getLatestUploadId(latestUpload) {
  return latestUpload?.upload_id || latestUpload?.id || null
}

function triggerDashboardUpgradePaywall() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'SUBSCRIPTION_REQUIRED', source: 'dashboard-upgrade' } }))
  }
}

function DashboardCard({ title, eyebrow, children, action, animated = true, delay = 0 }) {
  const animationProps = animated
    ? {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-100px' },
        transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] },
      }
    : {}

  const WrapperComponent = animated ? motion.section : 'section'

  return (
    <WrapperComponent
      className="cabinet-card rounded-3xl p-5 sm:p-6 hover:shadow-lg transition-all duration-300"
      style={{
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.06), inset 0 1px 0 rgba(29,158,117,0.08)',
      }}
      {...animationProps}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        {eyebrow && <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{eyebrow}</div>}
        {action && <div className="ml-auto flex-shrink-0">{action}</div>}
      </div>
      {title && <h3 className="mb-3 text-lg font-semibold text-slate-900">{title}</h3>}
      {children}
    </WrapperComponent>
  )
}

export default function UserDashboard() {
        <div>
          {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">{eyebrow}</div>}
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </WrapperComponent>
  )
}

function EmptyBlock({ title, body, cta, onClick, animated = true, delay = 0 }) {
  const animationProps = animated
    ? {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-100px' },
        transition: { duration: 0.5, delay },
      }
    : {}

  const WrapperComponent = animated ? motion.div : 'div'

  return (
    <WrapperComponent
      className="rounded-2xl border border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 p-6 text-center hover:border-emerald-400 transition-all duration-300"
      {...animationProps}
    >
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      {cta && (
        <motion.button
          onClick={onClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 shadow-lg hover:shadow-emerald-500/30"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      )}
    </WrapperComponent>
  )
}

function DashboardLoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="h-[128px] rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-100 to-slate-50 cabinet-skeleton"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.95fr_320px]">
        {Array.from({ length: 3 }).map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
            className="h-[320px] rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-100 to-slate-50 cabinet-skeleton"
          />
        ))}
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
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[28px] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_48%),linear-gradient(135deg,_#ffffff,_#effcf6_55%,_#f8fafc)] p-4 shadow-lg sm:p-6 hover:shadow-xl transition-all duration-300"
      >
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
      </motion.section>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <DashboardCard title="What unlocks after the first upload" eyebrow="Immediate value" animated delay={0.2}>
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

        <DashboardCard title="Account readiness" eyebrow="Setup progress" animated delay={0.35}>
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
  const displayValue = value ?? '--'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto flex h-[240px] w-[240px] items-center justify-center"
    >
      <motion.div
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative h-[220px] w-[220px] rounded-full"
        style={{
          background: `conic-gradient(#10B981 ${safeValue * 3.6}deg, rgba(148,163,184,0.18) 0deg)`,
          boxShadow: '0 0 0 8px rgba(16, 185, 129, 0.1)',
        }}
      >
        <motion.div
          animate={{ boxShadow: ['0 12px 34px rgba(15,23,42,0.08)', '0 20px 45px rgba(15,23,42,0.12)', '0 12px 34px rgba(15,23,42,0.08)'] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-[16px] flex items-center justify-center rounded-full bg-white"
        >
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl font-bold tracking-tight text-slate-900"
            >
              {displayValue}
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
            >
              health score
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
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
  const { isPremium, subStatus, uploadCount, uploadLimit, loading: subscriptionLoading } = useSubscription()
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
  const onboardingComplete = computeOnboardingComplete(profile)
  const hasProtocol = computeHasProtocol(stats)
  const isFirstRun = !loading && !hasUploads
  const showStartHere = Boolean(startHere?.enabled && isFirstRun)
  const journeySteps = buildJourneySteps(hasUploads, onboardingComplete, latestCheckin, hasProtocol)
  const completedJourneyCount = journeySteps.filter((step) => step.done).length

  const greeting = useMemo(() => getGreeting(profile, user?.email), [profile?.first_name, user?.email])
  const latestUploadId = getLatestUploadId(latestUpload)

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
        title={`${isFirstRun ? 'Welcome' : 'Welcome back'}, ${greeting}`}
        subtitle={profile?.onboarding?.requires_onboarding ? profile?.onboarding?.current_stage_label || 'Continue onboarding' : 'Your dashboard is assembled from current uploads, assignments, and check-ins.'}
        helper={isFirstRun ? 'Start with one upload. The dashboard expands as soon as your first lab is processed.' : `Your biomarker trends, supplement protocol, and assignments are all kept in sync here. ${isPremium ? '🌟 Premium Member' : '📋 Free Plan'}`}
        action={!loading && !isFirstRun ? (
          <div className="flex flex-wrap gap-2 items-center">
            <div className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${isPremium ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
              {isPremium ? '✨ Premium' : 'Free Plan'}
            </div>
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
          <MetricBar
            stats={stats}
            uploadCount={uploadCount}
            uploadLimit={uploadLimit}
            subStatus={subStatus}
            isPremium={isPremium}
            latestCheckin={latestCheckin}
          />

          {/* Health Score + Next Action Block */}
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Health Score Card */}
            <DashboardCard title="Health Score" eyebrow="Overall status" animated delay={0.15}>
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                >
                  <div className="text-4xl font-bold text-slate-900">{stats.health_score ?? 68}</div>
                  <p className="text-sm text-slate-500 mt-1">
                    {(stats.health_score ?? 68) >= 75 ? '✅ Great progress' : (stats.health_score ?? 68) >= 50 ? '⚠️ Keep going' : '📈 Get started'}
                  </p>
                </motion.div>

                {/* Adherence */}
                <div className="pt-2 space-y-2 text-xs text-slate-600 border-t border-slate-100">
                  <div className="flex justify-between">
                    <span>Protocol Adherence</span>
                    <span className="font-semibold">{Math.round((stats.completed_tasks / Math.max(assignments.length, 1)) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.round((stats.completed_tasks / Math.max(assignments.length, 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Check-in Status */}
                {latestCheckin && (
                  <div className="pt-2 space-y-2 text-xs text-slate-600 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span>Weekly Check-in</span>
                      <span className="font-semibold text-emerald-600">✅ Done</span>
                    </div>
                    <p className="text-slate-500">
                      {latestCheckin?.feeling === 'great' ? '🌟 Feeling great this week' :
                        latestCheckin?.feeling === 'steady' ? '😊 Steady progress' :
                          latestCheckin?.feeling === 'off' ? '⚠️ Needing support' : '💪 Building momentum'}
                    </p>
                  </div>
                )}
              </div>
            </DashboardCard>

            {/* Next Action CTA */}
            <DashboardCard title="What's next?" eyebrow="Recommended action" animated delay={0.25}>
              <div className="space-y-3">
                {!hasUploads ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900 mb-2">📄 Upload your first lab</p>
                    <p className="text-xs text-emerald-700 mb-3">Get your first biomarker analysis and personalized protocol in 2 minutes</p>
                    <button
                      onClick={() => navigate('/upload')}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      Start upload
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ) : !onboardingComplete ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">👤 Complete health profile</p>
                    <p className="text-xs text-blue-700 mb-3">Personalize your results and get better recommendations</p>
                    <button
                      onClick={() => navigate('/health-profile')}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      Complete profile
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ) : !latestCheckin || (new Date() - new Date(latestCheckin?.created_at || 0)) > 7 * 24 * 60 * 60 * 1000 ? (
                  <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
                    <p className="text-sm font-semibold text-purple-900 mb-2">✅ Weekly check-in</p>
                    <p className="text-xs text-purple-700 mb-3">Update us on how you're feeling and your progress</p>
                    <button
                      onClick={() => navigate('/check-ins')}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      Start check-in
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ) : assignments.length > 0 && assignments.filter(a => String(a?.status || '').toLowerCase() !== 'completed').length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900 mb-2">📋 {assignments.filter(a => String(a?.status || '').toLowerCase() !== 'completed').length} task{assignments.filter(a => String(a?.status || '').toLowerCase() !== 'completed').length > 1 ? 's' : ''} pending</p>
                    <p className="text-xs text-amber-700 mb-3">Keep your protocol on track</p>
                    <button
                      onClick={() => navigate('/assignments')}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      View tasks
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900 mb-2">🎉 You're all set!</p>
                    <p className="text-xs text-emerald-700 mb-3">Stay consistent and track your progress</p>
                    <button
                      onClick={() => navigate('/progress')}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      View progress
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </DashboardCard>
          </div>

          {/* Celebration Features */}
          <div className="space-y-4">
            {/* Achievement Milestone */}
            {stats.completed_tasks > 0 && stats.completed_tasks % 5 === 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-emerald-500 p-3">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-emerald-900">🎉 Milestone Reached!</h3>
                    <p className="text-sm text-emerald-700">You've completed {stats.completed_tasks} health assignments. You're on fire! 🔥</p>
                  </div>
                  <button onClick={() => navigate('/assignments')} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                    View all →
                  </button>
                </div>
              </div>
            )}

            {/* Recent Wins */}
            {(stats.health_score > 70 || stats.completed_tasks > 0 || latestCheckin) && (
              <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-5">
                <h3 className="font-semibold text-purple-900 mb-3">⭐ Your Recent Wins</h3>
                <div className="space-y-2">
                  {stats.health_score > 70 && (
                    <p className="text-sm text-purple-700 flex items-center gap-2">
                      <span>🏆</span> Health Score is {stats.health_score} — keep up the great work!
                    </p>
                  )}
                  {stats.completed_tasks > 0 && (
                    <p className="text-sm text-purple-700 flex items-center gap-2">
                      <span>✅</span> {stats.completed_tasks} task{stats.completed_tasks > 1 ? 's' : ''} completed this cycle
                    </p>
                  )}
                  {latestCheckin && (
                    <p className="text-sm text-purple-700 flex items-center gap-2">
                      <span>📝</span> Consistent with your weekly check-ins — great habit!
                    </p>
                  )}
                  {stats.total_uploads > 1 && (
                    <p className="text-sm text-purple-700 flex items-center gap-2">
                      <span>📊</span> {stats.total_uploads} lab uploads tracked — you're serious about your health!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Share Progress */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Share Your Progress</h3>
                <p className="text-sm text-slate-600 mt-1">Inspire others on their health journey</p>
              </div>
              <button
                onClick={() => {
                  const shareText = `Just improved my health score to ${stats.health_score || 0} on Vitaloop! 🚀 #HealthJourney #Vitaloop`
                  if (navigator.share) {
                    navigator.share({ text: shareText })
                  } else {
                    navigator.clipboard.writeText(shareText)
                    // Show toast notification
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition"
              >
                Share Progress
              </button>
            </div>
          </div>

          {!subscriptionLoading && subStatus !== 'active' && !isPremium && uploadLimit === 1 && (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-amber-100 p-2.5 flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-1">Unlock your full potential with Premium</h3>
                  <p className="text-sm text-amber-800 mb-4">Get unlimited uploads, personalized AI protocols, weekly check-ins, and detailed biomarker tracking — all powered by advanced health intelligence.</p>
                  <button onClick={triggerDashboardUpgradePaywall} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-700 transition">
                    Upgrade to Premium
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
                <DashboardCard title="Biomarker Trends" eyebrow="Health data" animated delay={0.15}>
                  <HealthChart progress={progress} />
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => navigate('/progress')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                      View detailed trends →
                    </button>
                    <button onClick={() => navigate('/lab-results')} className="text-sm text-slate-500 hover:text-slate-600">
                      All lab results →
                    </button>
                  </div>
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
                <DashboardCard title="Next Task" eyebrow="Priority" animated delay={0.25}>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-emerald-900">{todayFocus[0].title}</div>
                        <p className="text-sm text-emerald-700 mt-1">{todayFocus[0].description}</p>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => navigate(todayFocus[0]?.id ? `/assignments/${todayFocus[0].id}` : '/assignments')} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                            Start task
                            <ArrowRight className="h-4 w-4" />
                          </button>
                          {todayFocus[0]?.priority?.score > 80 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-rose-100 text-rose-700 rounded-full">
                              <Sparkles className="h-3 w-3" />
                              High priority
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </DashboardCard>
              )}

              {/* Health Goals Section */}
              <DashboardCard title="Health Goals" eyebrow="Progress tracking" animated delay={0.35}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Optimize Vitamin D levels</span>
                    <span className="text-sm text-emerald-600 font-semibold">75% complete</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                  <p className="text-xs text-slate-500">Target: 50-80 ng/mL, Current: 62 ng/mL</p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Improve sleep quality</span>
                    <span className="text-sm text-blue-600 font-semibold">In progress</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                  <p className="text-xs text-slate-500">Weekly check-ins completed: 3/7</p>

                  <button onClick={() => navigate('/settings')} className="w-full mt-4 text-center py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition">
                    Set new health goal →
                  </button>
                </div>
              </DashboardCard>
            </div>

            {/* Right: Insight + Activity */}
            <div className="space-y-6">
              {insights.length > 0 ? (
                <DashboardCard title="Today's Insight" eyebrow="AI Recommendation">
                  <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
                    <Sparkles className="h-5 w-5 text-purple-600 mb-2" />
                    <p className="text-sm font-medium text-purple-900">{insights[0].title}</p>
                    <p className="text-sm text-purple-700 mt-2">{insights[0].description}</p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => navigate('/insights')} className="text-sm font-semibold text-purple-700 hover:text-purple-800">
                        View details →
                      </button>
                      <button
                        onClick={() => navigate(latestUploadId ? `/protocol/${latestUploadId}` : '/lab-results')}
                        className="text-sm text-purple-600 hover:text-purple-700"
                      >
                        Update protocol →
                      </button>
                    </div>
                  </div>
                </DashboardCard>
              ) : (
                <DashboardCard title="AI Insights" eyebrow="Coming soon">
                  <div className="text-center py-6">
                    <Sparkles className="h-8 w-8 text-purple-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 mb-1">Personalized AI insights</p>
                    <p className="text-xs text-slate-500">Upload more labs to unlock AI-powered recommendations</p>
                  </div>
                </DashboardCard>
              )}

              {/* Weekly Progress Summary */}
              <DashboardCard title="This Week" eyebrow="Progress summary">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Assignments completed</span>
                    <span className="text-sm font-semibold text-emerald-600">{stats.completed_tasks || 0}</span>
                  </div>
                  <button
                    onClick={() => navigate('/lab-results')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-blue-50 transition cursor-pointer group">
                    <span className="text-sm text-slate-600 group-hover:text-slate-800">Labs uploaded</span>
                    <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">{stats.total_uploads || 0} →</span>
                  </button>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Check-ins done</span>
                    <span className="text-sm font-semibold text-purple-600">{latestCheckin ? 1 : 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Health score change</span>
                    <span className={`text-sm font-semibold ${stats.health_score_change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {stats.health_score_change > 0 ? '+' : ''}{stats.health_score_change || 0}
                    </span>
                  </div>
                </div>
                <button onClick={() => navigate('/progress')} className="w-full mt-4 text-center py-2 text-sm font-medium text-slate-600 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  View full progress →
                </button>
              </DashboardCard>

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
                  {assignments.filter(a => a.status === 'completed').length > 0 && (
                    <div className="flex gap-3 items-start">
                      <div className="rounded-xl bg-emerald-100 p-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
                      <div>
                        <div className="font-medium text-slate-900">Assignment completed</div>
                        <div className="text-xs text-slate-500">Keep up the great work!</div>
                      </div>
                    </div>
                  )}
                  {!latestUpload && !latestCheckin && !insights.length && assignments.filter(a => a.status === 'completed').length === 0 && (
                    <p className="text-slate-500 py-4 text-center">No activity yet. Start by uploading your first lab report!</p>
                  )}
                </div>
              </DashboardCard>

              {/* Personalized Health Tips */}
              <DashboardCard title="Health Tips" eyebrow="Personalized">
                <PersonalizedHealthTips
                  profile={profile}
                  latestUpload={latestUpload}
                  allUploads={progress}
                />
              </DashboardCard>
            </div>
          </motion.div>

          {/* Gamification Section - Streaks & Achievements */}
          <motion.div {...fadeUp(0.08)} className="mt-8 space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              {/* Streaks */}
              <DashboardCard title="Your Streaks" eyebrow="Motivation">
                <StreakCounter
                  checkInStreak={summary?.checkin_streak || 0}
                  adherenceStreak={summary?.adherence_streak || 0}
                  uploadStreak={summary?.upload_streak || 0}
                />
              </DashboardCard>

              {/* Achievements */}
              <DashboardCard title="Achievements" eyebrow="Unlock badges">
                <AchievementBadges
                  stats={{
                    total_uploads: stats.total_uploads || 0,
                    profile_complete: onboardingComplete,
                    adherence_streak: summary?.adherence_streak || 0,
                    checkins_completed: summary?.checkins_completed || 0,
                    health_score: stats.health_score || 0,
                    perfect_weeks: summary?.perfect_weeks || 0,
                  }}
                />
              </DashboardCard>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
