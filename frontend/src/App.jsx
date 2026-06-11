import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import AppLoadingScreen from './components/AppLoadingScreen.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useCRMRoleAccess } from './hooks/useCRMRoleAccess.js'
import { useEffect, useState } from 'react'
import { useOnboardingState } from './hooks/useOnboardingState.js'
import { gaPageView, gaPurchase } from './lib/analytics.js'
import { trackPublicFunnelEvent } from './lib/publicFunnel.js'

// Marketing pages — lazy
const Product = lazy(() => import('./pages/Product.jsx'))
const Features = lazy(() => import('./pages/Features.jsx'))
const Pricing = lazy(() => import('./pages/Pricing.jsx'))
const Stories = lazy(() => import('./pages/Stories.jsx'))
const Investors = lazy(() => import('./pages/Investors.jsx'))
const FAQ = lazy(() => import('./pages/FAQ.jsx'))
const EmailConfirmation = lazy(() => import('./pages/EmailConfirmation.jsx'))
const ExampleReport = lazy(() => import('./pages/ExampleReport.jsx'))
const HowItWorks = lazy(() => import('./pages/HowItWorks.jsx'))
const About = lazy(() => import('./pages/About.jsx'))
const ForInvestors = lazy(() => import('./pages/ForInvestors.jsx'))
const ForNutritionists = lazy(() => import('./pages/ForNutritionists.jsx'))
const Privacy = lazy(() => import('./pages/Privacy.jsx'))
const Terms = lazy(() => import('./pages/Terms.jsx'))
const Help = lazy(() => import('./pages/Help.jsx'))
const SymptomIntake = lazy(() => import('./pages/SymptomIntake.jsx'))
const UaLanding = lazy(() => import('./pages/UaLanding.jsx'))
const UaPage = lazy(() => import('./pages/UaPage.jsx'))

// UI components — lazy
const SupportChat = lazy(() => import('./components/SupportChat.jsx'))
const PaywallModal = lazy(() => import('./components/PaywallModal.jsx'))

// Cabinet pages — lazy
const UserDashboard = lazy(() => import('./pages/UserDashboard.jsx'))
const Upload = lazy(() => import('./pages/Upload.jsx'))
const LabPlan = lazy(() => import('./pages/LabPlan.jsx'))
const Results = lazy(() => import('./pages/Results.jsx'))
const ProtocolPage = lazy(() => import('./pages/ProtocolPage.jsx'))
const Insights = lazy(() => import('./pages/Insights.jsx'))
const LabResultsList = lazy(() => import('./pages/LabResultsList.jsx'))
const Assignments = lazy(() => import('./pages/Assignments.jsx'))
const AssignmentDetails = lazy(() => import('./pages/AssignmentDetails.jsx'))
const Avatar = lazy(() => import('./pages/Avatar.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const HealthProfile = lazy(() => import('./pages/HealthProfile.jsx'))
const Subscription = lazy(() => import('./pages/Subscription.jsx'))
const BillingHistory = lazy(() => import('./pages/BillingHistory.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))
const WeeklyCheckIn = lazy(() => import('./pages/WeeklyCheckIn.jsx'))
const Questionnaire = lazy(() => import('./pages/Questionnaire.jsx'))
const UserCabinetLayout = lazy(() => import('./components/dashboard/UserCabinetLayout.jsx'))

// CRM pages — lazy (role-gated, not on main user path)
const OpsDashboard = lazy(() => import('./pages/crm/OpsDashboard.jsx'))
const CRMPrograms = lazy(() => import('./pages/crm/Programs.jsx'))
const CRMClients = lazy(() => import('./pages/crm/Clients.jsx'))
const CRMClientDetails = lazy(() => import('./pages/crm/ClientDetails.jsx'))
const CRMPractitioners = lazy(() => import('./pages/crm/Practitioners.jsx'))
const CRMAuditLog = lazy(() => import('./pages/crm/AuditLog.jsx'))

function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      // Support deep links like /for-investors#about and /#pricing.
      const targetId = decodeURIComponent(hash.replace('#', ''))
      const maxWaitMs = 2500
      const pollMs = 50
      const scrollToHashTarget = () => {
        const element = document.getElementById(targetId)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return true
        }
        return false
      }

      // Lazy routes/components can render after this effect; poll briefly for target presence.
      let elapsedMs = 0
      const intervalId = window.setInterval(() => {
        const found = scrollToHashTarget()
        if (found || elapsedMs >= maxWaitMs) {
          window.clearInterval(intervalId)
          if (!found) window.scrollTo(0, 0)
        }
        elapsedMs += pollMs
      }, pollMs)

      return () => window.clearInterval(intervalId)
    }

    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}

function GAPageTracker() {
  const location = useLocation()
  useEffect(() => {
    gaPageView(location.pathname + location.search)

    if (typeof window === 'undefined') return
    const params = new URLSearchParams(location.search)
    if (params.get('sub') !== 'success') return

    const purchaseTrackedKey = 'vtl_purchase_tracked_sub_success'
    if (window.sessionStorage.getItem(purchaseTrackedKey) === '1') return
    window.sessionStorage.setItem(purchaseTrackedKey, '1')
    gaPurchase(`stripe_sub_success_${Date.now()}`)
  }, [location.pathname, location.search])
  return null
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AppLoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  return children
}

function CRMRoute({ children, needsOps = false }) {
  const { loading, canAccessCRM, canAccessOps } = useCRMRoleAccess()
  if (loading) return <AppLoadingScreen />
  if (needsOps && !canAccessOps) return <Navigate to="/dashboard" replace />
  if (!needsOps && !canAccessCRM) return <Navigate to="/dashboard" replace />
  return children
}

function EndUserFlowRoute({ children, allowBeforeOnboarding = false, redirectIfOnboardingComplete = false }) {
  const { loading } = useAuth()
  const { state, loading: onboardingLoading } = useOnboardingState()
  const shouldWaitForOnboarding = !allowBeforeOnboarding || redirectIfOnboardingComplete
  const onboardingStateKnown = state?.requires_onboarding !== null && state?.requires_onboarding !== undefined
  const requiresOnboarding = Boolean(state?.requires_onboarding)

  if (loading) {
    return <AppLoadingScreen />
  }
  if (!shouldWaitForOnboarding) return children
  if (onboardingLoading || !onboardingStateKnown) return <AppLoadingScreen />

  if (requiresOnboarding && !allowBeforeOnboarding) return <Navigate to="/onboarding" replace />
  if (!requiresOnboarding && redirectIfOnboardingComplete) return <Navigate to="/dashboard" replace />

  return children
}

// PremiumRoute removed — use <FeatureGate> component instead for fine-grained access control

function RouteFallback() {
  return <AppLoadingScreen />
}

function FloatingSupportChat() {
  const location = useLocation()
  const navigate = useNavigate()
  const [chatOpen, setChatOpen] = useState(false)
  const [ferriOpen, setFerriOpen] = useState(false)
  const [ferriInvestigating, setFerriInvestigating] = useState(false)

  const isCabinetRoute = [
    '/dashboard',
    '/upload',
    '/lab-plan',
    '/results/',
    '/protocol/',
    '/avatar',
    '/progress',
    '/assignments',
    '/lab-results',
    '/settings',
    '/health-profile',
    '/subscription',
    '/billing-history',
    '/onboarding',
    '/questionnaire',
    '/check-ins',
    '/insights',
  ].some((prefix) => location.pathname === prefix || location.pathname.startsWith(prefix))

  useEffect(() => {
    if (isCabinetRoute) return undefined

    let settleTimer
    const triggerInvestigation = () => {
      setFerriInvestigating(true)
      settleTimer = window.setTimeout(() => setFerriInvestigating(false), 1900)
    }
    const firstJumpTimer = window.setTimeout(triggerInvestigation, 15000)
    const repeatJumpTimer = window.setInterval(triggerInvestigation, 21000)
    return () => {
      window.clearTimeout(firstJumpTimer)
      window.clearTimeout(settleTimer)
      window.clearInterval(repeatJumpTimer)
    }
  }, [isCabinetRoute, location.pathname])

  const toggleFerriHints = () => {
    setFerriOpen((value) => !value)
    setFerriInvestigating(true)
    window.setTimeout(() => setFerriInvestigating(false), 1400)
  }

  const startSymptomCheck = () => {
    trackPublicFunnelEvent('symptom_started', { source: 'ferri_assistant' })
    navigate('/symptom-intake')
  }

  const uploadLabs = () => {
    trackPublicFunnelEvent('upload_clicked', { source: 'ferri_assistant' })
    navigate('/upload')
  }

  if (!isCabinetRoute) {
    return (
      <>
        <style>{`
          @keyframes ferriFloat {
            0%, 100% { transform: translate3d(0, 0, 0) rotate(-2deg) scale(1); }
            50% { transform: translate3d(0, -9px, 0) rotate(2deg) scale(1.025); }
          }
          @keyframes ferriLookAround {
            0%, 42%, 100% { transform: translateX(0); }
            52% { transform: translateX(-2px); }
            68% { transform: translateX(2px); }
          }
          @keyframes ferriLensSpin {
            0%, 84%, 100% { transform: rotate(0deg); }
            91% { transform: rotate(-13deg); }
            96% { transform: rotate(10deg); }
          }
          @keyframes ferriBlink {
            0%, 88%, 100% { transform: scaleY(1); }
            92%, 94% { transform: scaleY(0.12); }
          }
          @keyframes ferriWave {
            0%, 100% { transform: rotate(0deg); }
            35% { transform: rotate(-22deg); }
            70% { transform: rotate(14deg); }
          }
          @keyframes ferriPulseCore {
            0%, 100% { opacity: 0.56; transform: scale(1); }
            50% { opacity: 0.9; transform: scale(1.12); }
          }
          @keyframes ferriChartPeek {
            0%, 70%, 100% { opacity: 0; transform: translate3d(4px, 8px, 0) scale(0.72); }
            78%, 93% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          }
          @keyframes ferriBounce {
            0%, 100% { transform: translateY(0) scale(1); }
            28% { transform: translateY(-13px) scale(1.04); }
            52% { transform: translateY(1px) scale(0.98); }
            76% { transform: translateY(-5px) scale(1.02); }
          }
          @keyframes ferriSparkle {
            0%, 100% { opacity: 0; transform: scale(0.55) rotate(0deg); }
            45% { opacity: 1; transform: scale(1.05) rotate(18deg); }
          }
          @keyframes ferriScan {
            0%, 100% { transform: translateX(-3px); opacity: 0.48; }
            50% { transform: translateX(4px); opacity: 1; }
          }
          .ferri-bounce {
            animation: ferriBounce 1.9s ease-in-out 1 !important;
          }
          .group:hover .ferri-left-arm {
            animation: ferriWave 0.9s ease-in-out 1;
          }
          @media (prefers-reduced-motion: reduce) {
            .ferri-float, .ferri-eye, .ferri-scan, .ferri-lens, .ferri-arm, .ferri-core, .ferri-chart, .ferri-bounce, .ferri-sparkle, .ferri-pupils { animation: none !important; }
          }
        `}</style>

        <div className="fixed bottom-7 right-7 z-[2999] flex max-w-[calc(100vw-48px)] flex-col items-end gap-3 sm:bottom-8 sm:right-8">
          {ferriOpen && (
            <div className="mb-1 grid w-[min(260px,calc(100vw-56px))] gap-2 rounded-2xl border border-emerald-200 bg-white/95 p-3 shadow-[0_18px_54px_rgba(15,23,42,0.2)] backdrop-blur">
              <button
                type="button"
                onClick={startSymptomCheck}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-left text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Try a quick symptom check
              </button>
              <button
                type="button"
                onClick={uploadLabs}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                Upload blood test results
              </button>
            </div>
          )}

          <div className="flex h-20 w-20 items-center justify-center">
            <button
              type="button"
              onClick={toggleFerriHints}
              aria-label="Open Ferri biomarker assistant"
              title="Ferri - Iron Detective"
              className={`ferri-float group relative flex h-20 w-20 items-center justify-center rounded-full bg-transparent transition hover:scale-[1.03] focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/60 ${ferriInvestigating ? 'ferri-bounce' : ''}`}
              style={{ animation: 'ferriFloat 4.6s ease-in-out infinite' }}
            >
              <svg viewBox="0 0 104 104" className="h-20 w-20 overflow-visible drop-shadow-[0_18px_28px_rgba(15,23,42,0.22)]" aria-hidden="true">
                <defs>
                  <radialGradient id="ferriBody" cx="35%" cy="24%" r="72%">
                    <stop offset="0%" stopColor="#c7fff8" />
                    <stop offset="48%" stopColor="#2ABFAA" />
                    <stop offset="100%" stopColor="#087060" />
                  </radialGradient>
                  <radialGradient id="ferriShell" cx="34%" cy="20%" r="78%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.62" />
                    <stop offset="58%" stopColor="#8cf7ec" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#0b6b5b" stopOpacity="0.28" />
                  </radialGradient>
                  <radialGradient id="ironCore" cx="45%" cy="45%" r="58%">
                    <stop offset="0%" stopColor="#ffe7b8" />
                    <stop offset="100%" stopColor="#d48b32" />
                  </radialGradient>
                  <linearGradient id="ferriLens" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.94" />
                    <stop offset="100%" stopColor="#b9f7ef" stopOpacity="0.72" />
                  </linearGradient>
                </defs>
                <ellipse cx="52" cy="88" rx="26" ry="7" fill="#0f766e" opacity="0.13" />
                <g className="ferri-chart" style={{ transformOrigin: '31px 50px', animation: 'ferriChartPeek 13s ease-in-out infinite' }}>
                  <rect x="13" y="39" width="25" height="18" rx="5" fill="#ffffff" stroke="#80eadb" strokeWidth="2" />
                  <path d="M18 51h3l3-6 4 8 4-10 3 5" fill="none" stroke="#2ABFAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </g>
                <path className="ferri-arm ferri-left-arm" d="M25 59c-8 3-12 9-10 13 2 4 9 3 15-3" fill="none" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" style={{ transformOrigin: '28px 61px' }} />
                <path className="ferri-arm ferri-right-arm" d="M77 60c7 4 10 10 7 14-3 3-9 2-14-3" fill="none" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" style={{ transformOrigin: '76px 60px', animation: 'ferriLensSpin 8s ease-in-out infinite' }} />
                <circle cx="52" cy="49" r="33" fill="url(#ferriBody)" />
                <circle cx="52" cy="49" r="28" fill="url(#ferriShell)" stroke="#b8fff5" strokeWidth="1.5" opacity="0.82" />
                <g className="ferri-core" style={{ transformOrigin: '52px 51px', animation: 'ferriPulseCore 3.8s ease-in-out infinite' }}>
                  <circle cx="49" cy="53" r="4.2" fill="url(#ironCore)" opacity="0.72" />
                  <circle cx="57" cy="55" r="3.4" fill="url(#ironCore)" opacity="0.64" />
                  <circle cx="54" cy="46" r="2.8" fill="url(#ironCore)" opacity="0.55" />
                </g>
                <path d="M31 36c7-9 22-14 36-5" fill="none" stroke="#eafffb" strokeWidth="3" strokeLinecap="round" opacity="0.72" />
                <path d="M26 51c7 4 14 5 21 2m11-13c9 2 16 7 22 14m-43 19c10-2 19-1 27 4" fill="none" stroke="#d9fff9" strokeWidth="1.8" strokeLinecap="round" opacity="0.42" />
                <g className="ferri-pupils" style={{ transformOrigin: '52px 46px', animation: 'ferriLookAround 7.4s ease-in-out infinite' }}>
                  <circle cx="41" cy="44" r="8.8" fill="#ffffff" />
                  <circle cx="63" cy="44" r="8.8" fill="#ffffff" />
                  <ellipse className="ferri-eye transition-transform group-hover:scale-y-110" cx="43" cy="45" rx="3.6" ry="4.7" fill="#062f2a" style={{ transformOrigin: '43px 45px', animation: 'ferriBlink 4.8s ease-in-out infinite' }} />
                  <ellipse className="ferri-eye transition-transform group-hover:scale-y-110" cx="61" cy="45" rx="3.6" ry="4.7" fill="#062f2a" style={{ transformOrigin: '61px 45px', animation: 'ferriBlink 4.8s ease-in-out infinite' }} />
                  <circle cx="44.5" cy="42.7" r="1.2" fill="#ffffff" />
                  <circle cx="62.5" cy="42.7" r="1.2" fill="#ffffff" />
                </g>
                <path d="M43 59c5 5 13 5 18 0" fill="none" stroke="#073b35" strokeWidth="3" strokeLinecap="round" className="transition-transform group-hover:translate-y-0.5" />
                <g className="ferri-lens" style={{ transformOrigin: '72px 66px', animation: 'ferriLensSpin 8s ease-in-out infinite' }}>
                  <circle cx="72" cy="64" r="10" fill="url(#ferriLens)" stroke="#063f37" strokeWidth="3" />
                  <path d="M79 71l11 11" stroke="#063f37" strokeWidth="5" strokeLinecap="round" />
                  <path className="ferri-scan" d="M67 64h10" stroke="#2ABFAA" strokeWidth="2" strokeLinecap="round" style={{ animation: 'ferriScan 2.4s ease-in-out infinite' }} />
                </g>
                <path className="transition-transform group-hover:-translate-y-1" d="M38 78l-4 8" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" />
                <path className="transition-transform group-hover:-translate-y-1" d="M60 78l5 8" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" />
                <g className="ferri-sparkle" style={{ transformOrigin: '82px 26px', animation: ferriInvestigating ? 'ferriSparkle 0.9s ease-in-out 2' : 'none' }}>
                  <path d="M82 18l2.2 5.5 5.8 2-5.8 2-2.2 5.5-2.2-5.5-5.8-2 5.8-2z" fill="#8cf7ec" />
                </g>
              </svg>
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setChatOpen((v) => !v)}
        aria-label="Open support chat"
        className={`fixed right-6 z-[2999] flex h-[52px] w-[52px] items-center justify-center rounded-full border-0 bg-[var(--teal-800,#085041)] shadow-[0_4px_20px_rgba(8,80,65,0.35)] transition hover:bg-[var(--teal-600,#0F6E56)] ${isCabinetRoute ? 'bottom-24 md:bottom-6' : 'bottom-6'}`}
        style={{ bottom: isCabinetRoute ? 'calc(env(safe-area-inset-bottom) + var(--vtl-bottom-bar-height) + 12px)' : 'max(24px, calc(env(safe-area-inset-bottom) + 12px))' }}
      >
        {chatOpen
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        }
      </button>

      {chatOpen && <Suspense fallback={null}><SupportChat onClose={() => setChatOpen(false)} /></Suspense>}
    </>
  )
}

const SYMPTOM_PROMPT_STORAGE_KEY = 'vitaloop_symptom_prompt_seen'

function PublicSymptomPrompt({ disabled = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [visible, setVisible] = useState(false)

  const isExcludedRoute = [
    '/ua',
    '/symptom-intake',
    '/login',
    '/auth',
    '/dashboard',
    '/today',
    '/upload',
    '/lab-plan',
    '/results/',
    '/protocol/',
    '/avatar',
    '/progress',
    '/assignments',
    '/lab-results',
    '/settings',
    '/health-profile',
    '/subscription',
    '/billing-history',
    '/help-center',
    '/admin',
    '/ops',
    '/crm',
    '/onboarding',
    '/questionnaire',
    '/check-ins',
    '/checkin',
    '/insights',
  ].some((prefix) => location.pathname === prefix || location.pathname.startsWith(prefix))

  useEffect(() => {
    setVisible(false)
    if (disabled || loading || user || isExcludedRoute) return undefined
    if (typeof window === 'undefined') return undefined
    if (window.sessionStorage.getItem(SYMPTOM_PROMPT_STORAGE_KEY) === '1') return undefined

    const timerId = window.setTimeout(() => {
      window.sessionStorage.setItem(SYMPTOM_PROMPT_STORAGE_KEY, '1')
      setVisible(true)
    }, 3000)

    return () => window.clearTimeout(timerId)
  }, [disabled, loading, user, isExcludedRoute, location.pathname])

  if (!visible) return null

  const closePrompt = () => setVisible(false)
  const startIntake = () => {
    setVisible(false)
    navigate('/symptom-intake')
  }

  return (
    <div className="fixed inset-0 z-[3200] flex items-end justify-center bg-slate-950/35 px-4 pb-4 pt-10 backdrop-blur-[2px] sm:items-center sm:pb-10">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.26)]">
        <div className="relative bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.20),transparent_38%),linear-gradient(135deg,#ffffff,#f0fdfa)] px-5 py-5 sm:px-6">
          <button
            type="button"
            onClick={closePrompt}
            aria-label="Close symptom check prompt"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
          >
            x
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Quick symptom check</p>
          <h2 className="mt-3 max-w-[390px] text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">
            Feel off, but not sure what to check?
          </h2>
          <p className="mt-3 max-w-[420px] text-sm leading-6 text-slate-600">
            Answer a few questions and get a safe lab discussion list before creating an account.
          </p>
        </div>
        <div className="px-5 py-5 sm:px-6">
          <div className="grid gap-2 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold">No login required</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold">Takes about one minute</div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              onClick={startIntake}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Start symptom check
            </button>
            <button
              type="button"
              onClick={closePrompt}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const isUaHost = typeof window !== 'undefined' && window.location.hostname.toLowerCase() === 'ua.vitaloop.today'
  const isUaPreviewPath = typeof window !== 'undefined' && (window.location.pathname === '/ua' || window.location.pathname.startsWith('/ua/'))
  const isUaLandingShell = isUaHost || isUaPreviewPath

  const renderCabinetRoute = (page, options = {}) => (
    <ProtectedRoute>
      <EndUserFlowRoute
        allowBeforeOnboarding={Boolean(options.allowBeforeOnboarding)}
        redirectIfOnboardingComplete={Boolean(options.redirectIfOnboardingComplete)}
      >
        <UserCabinetLayout>{page}</UserCabinetLayout>
      </EndUserFlowRoute>
    </ProtectedRoute>
  )

  return (
    <BrowserRouter>
      {!isUaLandingShell && <Suspense fallback={null}><PaywallModal /></Suspense>}
      <GAPageTracker />
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={isUaHost ? <UaLanding /> : <Landing />} />
          <Route path="/ua" element={<UaLanding />} />
          <Route path="/ua/:pageSlug" element={<UaPage />} />
          <Route path="/samopochuttia" element={isUaHost ? <UaPage pageSlug="samopochuttia" /> : <NotFound />} />
          <Route path="/symptomy" element={isUaHost ? <UaPage pageSlug="symptomy" /> : <NotFound />} />
          <Route path="/analizy" element={isUaHost ? <UaPage pageSlug="analizy" /> : <NotFound />} />
          <Route path="/laboratorii" element={isUaHost ? <UaPage pageSlug="laboratorii" /> : <NotFound />} />
          <Route path="/tarify" element={isUaHost ? <UaPage pageSlug="tarify" /> : <NotFound />} />
          <Route path="/ferytyn" element={isUaHost ? <UaPage pageSlug="ferytyn" /> : <NotFound />} />
          <Route path="/vtoma" element={isUaHost ? <UaPage pageSlug="vtoma" /> : <NotFound />} />
          <Route path="/vitamin-d" element={isUaHost ? <UaPage pageSlug="vitamin-d" /> : <NotFound />} />
          <Route path="/volossia" element={isUaHost ? <UaPage pageSlug="volossia" /> : <NotFound />} />
          <Route path="/son" element={isUaHost ? <UaPage pageSlug="son" /> : <NotFound />} />
          <Route path="/dity-analizy" element={isUaHost ? <UaPage pageSlug="dity-analizy" /> : <NotFound />} />
          <Route path="/product" element={<Product />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/investors" element={<Investors />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/example-report" element={<ExampleReport />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/for-investors" element={<ForInvestors />} />
          <Route path="/for-nutritionists" element={<ForNutritionists />} />
          <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
          <Route path="/privacy-policy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/help" element={<Help />} />
          <Route path="/help/section/:sectionId" element={<Help />} />
          <Route path="/help/:articleId" element={<Help />} />
          <Route path="/symptom-intake" element={<SymptomIntake />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/confirmation" element={<EmailConfirmation />} />
          <Route path="/dashboard" element={renderCabinetRoute(<UserDashboard />, { allowBeforeOnboarding: true })} />
          <Route path="/today" element={<Navigate to="/dashboard" replace />} />
          <Route path="/symptom-check" element={<Navigate to="/questionnaire" replace />} />
          <Route path="/results-trends" element={<Navigate to="/lab-results" replace />} />
          <Route path="/upload" element={renderCabinetRoute(<Upload />, { allowBeforeOnboarding: true })} />
          <Route path="/lab-plan" element={renderCabinetRoute(<LabPlan />, { allowBeforeOnboarding: true })} />
          <Route path="/results/:uploadId" element={renderCabinetRoute(<Results />)} />
          <Route path="/protocol/:uploadId" element={renderCabinetRoute(<ProtocolPage />)} />
          <Route path="/avatar" element={renderCabinetRoute(<Avatar />)} />
          <Route path="/progress" element={<Navigate to="/lab-results" replace />} />
          <Route path="/assignments" element={renderCabinetRoute(<Assignments />, { allowBeforeOnboarding: true })} />
          <Route path="/assignments/:assignmentId" element={renderCabinetRoute(<AssignmentDetails />, { allowBeforeOnboarding: true })} />
          <Route path="/lab-results" element={renderCabinetRoute(<LabResultsList />, { allowBeforeOnboarding: true })} />
          <Route path="/settings" element={renderCabinetRoute(<Settings />, { allowBeforeOnboarding: true })} />
          <Route path="/health-profile" element={renderCabinetRoute(<HealthProfile />, { allowBeforeOnboarding: true })} />
          <Route path="/subscription" element={renderCabinetRoute(<Subscription />, { allowBeforeOnboarding: true })} />
          <Route path="/billing-history" element={renderCabinetRoute(<BillingHistory />, { allowBeforeOnboarding: true })} />
          <Route path="/help-center" element={renderCabinetRoute(<Help embedded basePath="/help-center" />, { allowBeforeOnboarding: true })} />
          <Route path="/admin" element={<ProtectedRoute><CRMRoute needsOps><Navigate to="/ops" replace /></CRMRoute></ProtectedRoute>} />
          <Route path="/ops" element={<ProtectedRoute><CRMRoute needsOps><OpsDashboard /></CRMRoute></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><CRMRoute><OpsDashboard /></CRMRoute></ProtectedRoute>} />
          <Route path="/crm/programs" element={<ProtectedRoute><CRMRoute><CRMPrograms /></CRMRoute></ProtectedRoute>} />
          <Route path="/crm/clients" element={<ProtectedRoute><CRMRoute><CRMClients /></CRMRoute></ProtectedRoute>} />
          <Route path="/crm/clients/:id" element={<ProtectedRoute><CRMRoute><CRMClientDetails /></CRMRoute></ProtectedRoute>} />
          <Route path="/crm/practitioners" element={<ProtectedRoute><CRMRoute><CRMPractitioners /></CRMRoute></ProtectedRoute>} />
          <Route path="/crm/activity" element={<ProtectedRoute><CRMRoute><CRMAuditLog /></CRMRoute></ProtectedRoute>} />
          <Route path="/onboarding" element={renderCabinetRoute(<Onboarding />, { allowBeforeOnboarding: true })} />
          <Route path="/questionnaire" element={renderCabinetRoute(<Questionnaire />, { allowBeforeOnboarding: true })} />
          <Route path="/check-ins" element={renderCabinetRoute(<WeeklyCheckIn />)} />
          <Route path="/insights" element={renderCabinetRoute(<Insights />)} />
          {/* Legacy route redirects */}
          <Route path="/checkin" element={<Navigate to="/check-ins" replace />} />
          <Route path="/timeline" element={<Navigate to="/insights" replace />} />
          <Route path="/dashboard-legacy" element={<Navigate to="/dashboard" replace />} />
          <Route path="/ops/legacy" element={<Navigate to="/ops" replace />} />
          <Route path="/404.html" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {!isUaLandingShell && <PublicSymptomPrompt disabled={isUaLandingShell} />}
      {!isUaLandingShell && <FloatingSupportChat />}
    </BrowserRouter>
  )
}
