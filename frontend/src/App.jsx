import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
// Landing is lazy — it's heavy (framer-motion) and never renders on ua.vitaloop.today
const Landing = lazy(() => import('./pages/Landing.jsx'))
// NotFound is rare — no reason to eager-load
const NotFound = lazy(() => import('./pages/NotFound.jsx'))
import AppLoadingScreen from './components/AppLoadingScreen.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useCRMRoleAccess } from './hooks/useCRMRoleAccess.js'
import { useEffect, useState } from 'react'
import { useOnboardingState } from './hooks/useOnboardingState.js'
import { gaPageView, gaPurchase } from './lib/analytics.js'
import { trackPublicFunnelEvent } from './lib/publicFunnel.js'
import { isUkrainianLocale } from './lib/locale.js'
import { reportClientActivity } from './lib/errorReporter.js'

// Marketing pages — lazy
const Features = lazy(() => import('./pages/Features.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
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
const HealthHub = lazy(() => import('./pages/HealthHub.jsx'))
const HealthHubArticle = lazy(() => import('./pages/HealthHubArticle.jsx'))
const HealthHubCluster = lazy(() => import('./pages/HealthHubCluster.jsx'))
const SiteMap = lazy(() => import('./pages/SiteMap.jsx'))
const EditorialPolicy = lazy(() => import('./pages/EditorialPolicy.jsx'))
const MedicalReviewPolicy = lazy(() => import('./pages/MedicalReviewPolicy.jsx'))
const EditorialTeam = lazy(() => import('./pages/EditorialTeam.jsx'))
const UaLanding = lazy(() => import('./pages/UaLanding.jsx'))
const UaPage = lazy(() => import('./pages/UaPage.jsx'))
const UaHealthHubHome = lazy(() => import('./pages/UaHealthHub.jsx').then(m => ({ default: m.UaHealthHubHome })))
const UaHealthHubCluster = lazy(() => import('./pages/UaHealthHub.jsx').then(m => ({ default: m.UaHealthHubCluster })))
const UaHealthHubArticle = lazy(() => import('./pages/UaHealthHub.jsx').then(m => ({ default: m.UaHealthHubArticle })))
const UaAbout = lazy(() => import('./pages/UaLegal.jsx').then(m => ({ default: m.UaAbout })))
const UaPrivacy = lazy(() => import('./pages/UaLegal.jsx').then(m => ({ default: m.UaPrivacy })))
const UaTerms = lazy(() => import('./pages/UaLegal.jsx').then(m => ({ default: m.UaTerms })))

// UI components — lazy
const SupportChat = lazy(() => import('./components/SupportChat.jsx'))
const PaywallModal = lazy(() => import('./components/PaywallModal.jsx'))
const WellbeingCheckModal = lazy(() => import('./components/landing/WellbeingCheckModal.jsx'))
// CookieConsent is handled by vanilla JS in index.html (loads before React bundle).
// const CookieConsent = lazy(() => import('./components/CookieConsent.jsx'))

// Cabinet pages — lazy
const UserDashboard = lazy(() => import('./pages/UserDashboard.jsx'))
const Upload = lazy(() => import('./pages/Upload.jsx'))
const LabPlan = lazy(() => import('./pages/LabPlan.jsx'))
const Results = lazy(() => import('./pages/Results.jsx'))
const ProtocolPage = lazy(() => import('./pages/ProtocolPage.jsx'))
const Insights = lazy(() => import('./pages/Insights.jsx'))
const LabResultsList = lazy(() => import('./pages/LabResultsList.jsx'))
const Progress = lazy(() => import('./pages/Progress.jsx'))
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
    const route = location.pathname + location.search
    gaPageView(route)
    reportClientActivity({
      type: 'route_view',
      route,
      metadata: {
        hash: location.hash || null,
      },
    })

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

function buildLoginRedirect(location) {
  const params = new URLSearchParams()
  const returnUrl = `${location.pathname}${location.search}${location.hash}`

  if (isUkrainianLocale()) {
    params.set('locale', 'uk')
  }
  if (returnUrl && returnUrl !== '/') {
    params.set('returnUrl', returnUrl)
  }

  const query = params.toString()
  return query ? `/login?${query}` : '/login'
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <AppLoadingScreen />
  if (!user) return <Navigate to={buildLoginRedirect(location)} replace />

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

function RegisterRedirect() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set('signup', 'true')
  const query = params.toString()
  return <Navigate to={`/login${query ? `?${query}` : '?signup=true'}`} replace />
}

function FloatingSupportChat() {
  const location = useLocation()
  const navigate = useNavigate()
  const [chatOpen, setChatOpen] = useState(false)
  const [ferriOpen, setFerriOpen] = useState(false)
  const [ferriInvestigating, setFerriInvestigating] = useState(false)
  const [ferriGreetingVisible, setFerriGreetingVisible] = useState(false)
  const [ferriAction, setFerriAction] = useState('idle')

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

    try {
      const greetedKey = 'vtl_ferri_first_visit_greeting_seen'
      if (window.localStorage.getItem(greetedKey) !== '1') {
        setFerriGreetingVisible(true)
        window.localStorage.setItem(greetedKey, '1')
        window.setTimeout(() => setFerriGreetingVisible(false), 4000)
      }
    } catch {
      setFerriGreetingVisible(false)
    }

    let settleTimer
    const triggerInvestigation = () => {
      setFerriInvestigating(true)
      setFerriAction('jump')
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

  useEffect(() => {
    if (isCabinetRoute) return undefined

    const actions = ['scan', 'chart', 'think', 'particles', 'jump', 'sleepy', 'toss']
    let actionTimer
    let clearTimer
    const scheduleAction = () => {
      const delay = 10000 + Math.round(Math.random() * 15000)
      actionTimer = window.setTimeout(() => {
        const nextAction = actions[Math.floor(Math.random() * actions.length)]
        setFerriAction(nextAction)
        setFerriInvestigating(nextAction === 'scan' || nextAction === 'jump')
        clearTimer = window.setTimeout(() => {
          setFerriAction('idle')
          setFerriInvestigating(false)
          scheduleAction()
        }, 3600)
      }, delay)
    }

    scheduleAction()
    return () => {
      window.clearTimeout(actionTimer)
      window.clearTimeout(clearTimer)
    }
  }, [isCabinetRoute, location.pathname])

  const toggleFerriHints = () => {
    setFerriOpen((value) => !value)
    setFerriInvestigating(true)
    setFerriAction('scan')
    window.setTimeout(() => setFerriInvestigating(false), 1400)
    window.setTimeout(() => setFerriAction('idle'), 2200)
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
            0%, 100% { transform: translate3d(-5px, 3px, 0) rotate(-2.4deg) scale(1); }
            26% { transform: translate3d(3px, -7px, 0) rotate(2.6deg) scale(1.025); }
            52% { transform: translate3d(7px, -2px, 0) rotate(1deg) scale(1.01); }
            76% { transform: translate3d(-2px, -5px, 0) rotate(-1.2deg) scale(1.018); }
          }
          @keyframes ferriLookAround {
            0%, 32%, 100% { transform: translateX(0); }
            45% { transform: translateX(-2.4px); }
            66% { transform: translateX(2.6px); }
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
          @keyframes ferriBrowCurious {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            35% { transform: translateY(-1.5px) rotate(-4deg); }
            68% { transform: translateY(0.8px) rotate(3deg); }
          }
          @keyframes ferriWave {
            0%, 100% { transform: rotate(0deg); }
            35% { transform: rotate(-22deg); }
            70% { transform: rotate(14deg); }
          }
          @keyframes ferriShellShimmer {
            0%, 100% { opacity: 0.28; transform: translateX(-5px) rotate(-8deg); }
            45% { opacity: 0.72; transform: translateX(7px) rotate(8deg); }
          }
          @keyframes ferriPulseCore {
            0%, 100% { opacity: 0.56; transform: scale(1); }
            50% { opacity: 0.9; transform: scale(1.12); }
          }
          @keyframes ferriParticleDrift {
            0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.45; }
            45% { transform: translate3d(2px, -3px, 0); opacity: 0.92; }
            75% { transform: translate3d(-2px, 2px, 0); opacity: 0.7; }
          }
          @keyframes ferriChartPeek {
            0%, 70%, 100% { opacity: 0; transform: translate3d(4px, 8px, 0) scale(0.72); }
            78%, 93% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          }
          @keyframes ferriHologramBuild {
            0%, 100% { opacity: 0; transform: translate3d(5px, 8px, 0) scale(0.78); }
            16%, 78% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
            88% { opacity: 0; transform: translate3d(-4px, -2px, 0) scale(0.9); }
          }
          @keyframes ferriGraphToss {
            0%, 100% { opacity: 0; transform: translate3d(5px, 8px, 0) rotate(0deg) scale(0.72); }
            15%, 48% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
            78% { opacity: 0; transform: translate3d(-22px, -16px, 0) rotate(-18deg) scale(0.84); }
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
          @keyframes ferriBeam {
            0%, 100% { opacity: 0; transform: scaleX(0.6); }
            32%, 74% { opacity: 0.62; transform: scaleX(1); }
          }
          @keyframes ferriScannerPulse {
            0%, 100% { opacity: 0.12; transform: scale(0.85); }
            45% { opacity: 0.72; transform: scale(1.18); }
          }
          @keyframes ferriLegHover {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(2px); }
          }
          @keyframes ferriFootprints {
            0%, 100% { opacity: 0; transform: translate3d(0, 0, 0) scale(0.55); }
            30%, 62% { opacity: 0.55; transform: translate3d(-5px, 2px, 0) scale(1); }
          }
          @keyframes ferriNod {
            0%, 100% { transform: rotate(0deg); }
            45% { transform: rotate(4deg); }
            70% { transform: rotate(-2deg); }
          }
          @keyframes ferriSleepy {
            0%, 100% { opacity: 0; transform: translate3d(0, 6px, 0) scale(0.8); }
            30%, 78% { opacity: 0.84; transform: translate3d(-8px, -10px, 0) scale(1); }
          }
          @keyframes ferriGreeting {
            0% { opacity: 0; transform: translate3d(10px, 8px, 0) scale(0.92); }
            14%, 82% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
            100% { opacity: 0; transform: translate3d(6px, 4px, 0) scale(0.96); }
          }
          .ferri-bounce {
            animation: ferriBounce 1.9s ease-in-out 1 !important;
          }
          .group:hover .ferri-left-arm {
            animation: ferriWave 0.9s ease-in-out 1;
          }
          .ferri-action-think .ferri-body-shell {
            animation: ferriNod 2.2s ease-in-out 1;
          }
          .ferri-action-scan .ferri-scan-beam,
          .ferri-action-chart .ferri-hologram,
          .ferri-action-think .ferri-hologram,
          .ferri-action-particles .ferri-hologram {
            animation: ferriHologramBuild 3.2s ease-in-out 1;
          }
          .ferri-action-toss .ferri-hologram {
            animation: ferriGraphToss 3.2s ease-in-out 1;
          }
          .ferri-action-scan .ferri-lens-glow {
            opacity: 0.72;
          }
          .ferri-action-scan .ferri-scanner-ring {
            animation: ferriScannerPulse 1.4s ease-in-out 2;
          }
          .ferri-action-sleepy .ferri-sleepy-mark {
            animation: ferriSleepy 3s ease-in-out 1;
          }
          .ferri-action-particles .ferri-footprint {
            animation: ferriFootprints 3s ease-in-out 1;
          }
          @media (prefers-reduced-motion: reduce) {
            .ferri-float, .ferri-eye, .ferri-scan, .ferri-lens, .ferri-arm, .ferri-core, .ferri-chart, .ferri-bounce, .ferri-sparkle, .ferri-pupils, .ferri-particle, .ferri-hologram, .ferri-leg, .ferri-shimmer, .ferri-brow, .ferri-footprint, .ferri-sleepy-mark, .ferri-scanner-ring { animation: none !important; }
          }
        `}</style>

        <div className="fixed bottom-6 right-6 z-[2999] flex max-w-[calc(100vw-48px)] flex-col items-end gap-3 sm:bottom-8 sm:right-8">
          {ferriOpen && (
            <div className="mb-2 grid w-[min(260px,calc(100vw-56px))] gap-2 rounded-2xl border border-emerald-200 bg-white/95 p-3 shadow-[0_18px_54px_rgba(15,23,42,0.2)] backdrop-blur">
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

          {ferriGreetingVisible && (
            <div
              className="pointer-events-none absolute bottom-[92px] right-0 rounded-[22px] border border-cyan-200/90 bg-white/95 px-4 py-3 text-sm font-bold text-slate-900 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur sm:bottom-[124px]"
              style={{ animation: 'ferriGreeting 4s ease-in-out forwards' }}
            >
              Hi, I'm Ferri 👋
            </div>
          )}

          <div className="relative flex h-[90px] w-[90px] items-end justify-end overflow-visible sm:h-28 sm:w-28">
            <button
              type="button"
              onClick={toggleFerriHints}
              aria-label="Open Ferri biomarker assistant"
              title="Ferri - Iron Detective"
              className={`ferri-float ferri-action-${ferriAction} group relative flex h-[51px] w-[51px] items-center justify-center rounded-full bg-transparent transition hover:scale-[1.06] focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/60 sm:h-[77px] sm:w-[77px] ${ferriInvestigating ? 'ferri-bounce' : ''}`}
              style={{ animation: 'ferriFloat 4.6s ease-in-out infinite' }}
            >
              <svg viewBox="0 0 120 120" className="h-16 w-16 overflow-visible drop-shadow-[0_18px_28px_rgba(15,23,42,0.22)] sm:h-[90px] sm:w-[90px]" aria-hidden="true">
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
                  <filter id="ferriGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <ellipse cx="62" cy="101" rx="30" ry="8" fill="#0f766e" opacity="0.14" />
                <g className="ferri-footprint" opacity="0">
                  <circle cx="43" cy="104" r="2" fill="#8cf7ec" opacity="0.72" />
                  <circle cx="53" cy="106" r="1.6" fill="#8cf7ec" opacity="0.5" />
                  <circle cx="65" cy="104" r="1.8" fill="#8cf7ec" opacity="0.58" />
                </g>
                <g className="ferri-hologram" style={{ transformOrigin: '28px 52px', opacity: 0 }}>
                  <rect x="9" y="35" width="35" height="25" rx="7" fill="#eafffb" fillOpacity="0.76" stroke="#80eadb" strokeWidth="1.8" />
                  <path d="M15 54h4l4-8 5 10 5-13 5 7" fill="none" stroke="#2ABFAA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 43h13m-13 4h8" stroke="#0f766e" strokeWidth="1.4" strokeLinecap="round" opacity="0.72" />
                </g>
                <g className="ferri-sleepy-mark" opacity="0">
                  <path d="M86 25h10l-9 10h10" fill="none" stroke="#8cf7ec" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M99 14h7l-6 7h7" fill="none" stroke="#8cf7ec" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
                </g>
                <g className="ferri-chart" style={{ transformOrigin: '30px 50px', animation: 'ferriChartPeek 16s ease-in-out infinite' }}>
                  <rect x="16" y="69" width="31" height="19" rx="6" fill="#ffffff" fillOpacity="0.72" stroke="#80eadb" strokeWidth="1.6" />
                  <path d="M22 82v-5m6 5V73m6 9v-8m6 8V70" stroke="#2ABFAA" strokeWidth="3" strokeLinecap="round" />
                </g>
                <path className="ferri-arm ferri-left-arm" d="M31 68c-8 3-13 10-11 14 2 4 10 2 16-5" fill="none" stroke="#0b7668" strokeWidth="5.2" strokeLinecap="round" style={{ transformOrigin: '34px 70px' }} />
                <path className="ferri-arm ferri-right-arm" d="M89 66c8 4 12 11 8 15-3 4-10 1-16-6" fill="none" stroke="#0b7668" strokeWidth="5.2" strokeLinecap="round" style={{ transformOrigin: '86px 67px', animation: 'ferriLensSpin 8s ease-in-out infinite' }} />
                <g className="ferri-body-shell" style={{ transformOrigin: '60px 57px' }}>
                  <path d="M59 18c15-1 30 8 37 22 8 15 4 32-7 45-10 12-28 18-44 12-16-5-27-19-27-37 0-15 8-29 20-36 6-4 13-5 21-6z" fill="url(#ferriBody)" />
                  <path d="M59 24c13-1 25 7 31 19 6 13 3 26-6 37-9 10-24 14-37 10-14-5-23-17-23-31 0-12 7-24 17-30 5-3 11-4 18-5z" fill="url(#ferriShell)" stroke="#b8fff5" strokeWidth="1.6" opacity="0.84" />
                  <path d="M32 50c9-8 20-12 32-12 11 0 20 4 28 11M29 64c10 5 21 8 34 8 10 0 19-2 27-7M45 27c-4 10-5 20-2 31 3 13 10 23 20 31M72 28c7 11 9 24 5 38-2 9-7 17-14 24" fill="none" stroke="#d9fff9" strokeWidth="1.7" strokeLinecap="round" opacity="0.42" />
                  <path className="ferri-shimmer" d="M38 31c11-9 30-9 44 0" fill="none" stroke="#f4fffd" strokeWidth="4" strokeLinecap="round" opacity="0.54" style={{ transformOrigin: '60px 44px', animation: 'ferriShellShimmer 5.8s ease-in-out infinite' }} />
                </g>
                <g className="ferri-core" filter="url(#ferriGlow)" style={{ transformOrigin: '60px 60px', animation: 'ferriPulseCore 3.8s ease-in-out infinite' }}>
                  <circle cx="56" cy="60" r="5.2" fill="url(#ironCore)" opacity="0.78" />
                  <circle cx="66" cy="63" r="4.1" fill="url(#ironCore)" opacity="0.7" />
                  <circle cx="63" cy="52" r="3.5" fill="url(#ironCore)" opacity="0.6" />
                </g>
                <g>
                  <circle className="ferri-particle" cx="47" cy="51" r="1.7" fill="#ffd27a" style={{ animation: 'ferriParticleDrift 4.8s ease-in-out infinite' }} />
                  <circle className="ferri-particle" cx="72" cy="57" r="1.3" fill="#ffe7b8" style={{ animation: 'ferriParticleDrift 5.5s ease-in-out infinite 0.8s' }} />
                  <circle className="ferri-particle" cx="54" cy="76" r="1.4" fill="#ffd27a" style={{ animation: 'ferriParticleDrift 5.1s ease-in-out infinite 1.3s' }} />
                  <circle className="ferri-particle" cx="41" cy="68" r="1.1" fill="#fff0c4" style={{ animation: 'ferriParticleDrift 4.4s ease-in-out infinite 0.4s' }} />
                  <circle className="ferri-particle" cx="79" cy="72" r="1" fill="#ffd27a" style={{ animation: 'ferriParticleDrift 5.8s ease-in-out infinite 1.6s' }} />
                </g>
                <g className="ferri-pupils" style={{ transformOrigin: '60px 51px', animation: 'ferriLookAround 7.4s ease-in-out infinite' }}>
                  <path d="M38 48c2-8 13-11 19-5 5 6 2 17-7 19-8 1-15-6-12-14z" fill="#ffffff" />
                  <path d="M65 43c7-5 17-1 19 7 2 9-8 16-16 12-7-3-10-13-3-19z" fill="#ffffff" />
                  <ellipse className="ferri-eye transition-transform group-hover:scale-y-110" cx="50" cy="52" rx="4.4" ry="5.8" fill="#062f2a" style={{ transformOrigin: '50px 52px', animation: 'ferriBlink 4.8s ease-in-out infinite' }} />
                  <ellipse className="ferri-eye transition-transform group-hover:scale-y-110" cx="72" cy="52" rx="4.4" ry="5.8" fill="#062f2a" style={{ transformOrigin: '72px 52px', animation: 'ferriBlink 4.8s ease-in-out infinite' }} />
                  <circle cx="51.8" cy="49" r="1.7" fill="#ffffff" />
                  <circle cx="73.8" cy="49" r="1.7" fill="#ffffff" />
                </g>
                <g className="ferri-brow" style={{ transformOrigin: '62px 40px', animation: 'ferriBrowCurious 6.2s ease-in-out infinite' }}>
                  <path d="M49 39c4-3 9-3 13 0m6 0c4-3 9-3 13 0" fill="none" stroke="#06463d" strokeWidth="2.4" strokeLinecap="round" opacity="0.72" />
                </g>
                <path d="M51 68c6 5 16 5 22-1" fill="none" stroke="#073b35" strokeWidth="3.2" strokeLinecap="round" className="transition-transform group-hover:translate-y-0.5" />
                <g className="ferri-lens" style={{ transformOrigin: '86px 73px', animation: 'ferriLensSpin 8s ease-in-out infinite' }}>
                  <circle className="ferri-scanner-ring" cx="84" cy="70" r="20" fill="none" stroke="#8cf7ec" strokeWidth="2" opacity="0" />
                  <circle className="ferri-lens-glow" cx="86" cy="70" r="16" fill="#7df5e6" opacity="0.12" />
                  <circle cx="84" cy="70" r="12" fill="url(#ferriLens)" stroke="#063f37" strokeWidth="3.2" />
                  <path d="M92 79l13 13" stroke="#063f37" strokeWidth="6" strokeLinecap="round" />
                  <path className="ferri-scan" d="M78 70h12" stroke="#2ABFAA" strokeWidth="2.2" strokeLinecap="round" style={{ animation: 'ferriScan 2.4s ease-in-out infinite' }} />
                  <path className="ferri-scan-beam" d="M73 70L35 57 73 83z" fill="#8cf7ec" opacity="0" style={{ animation: ferriInvestigating ? 'ferriBeam 1.4s ease-in-out 1' : 'none' }} />
                </g>
                <path className="ferri-leg transition-transform group-hover:-translate-y-1" d="M45 91l-5 9" stroke="#0f766e" strokeWidth="5.2" strokeLinecap="round" style={{ animation: 'ferriLegHover 3.2s ease-in-out infinite' }} />
                <path className="ferri-leg transition-transform group-hover:-translate-y-1" d="M67 91l6 9" stroke="#0f766e" strokeWidth="5.2" strokeLinecap="round" style={{ animation: 'ferriLegHover 3.2s ease-in-out infinite 0.4s' }} />
                <g className="ferri-sparkle" style={{ transformOrigin: '94px 29px', animation: ferriInvestigating ? 'ferriSparkle 0.9s ease-in-out 2' : 'none' }}>
                  <path d="M94 20l2.3 5.8 6 2.2-6 2.1-2.3 5.9-2.3-5.9-6-2.1 6-2.2z" fill="#8cf7ec" />
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
const SYMPTOM_PROMPT_STARTED_AT_KEY = 'vitaloop_symptom_prompt_started_at'
const SYMPTOM_PROMPT_DELAY_MS = 10000

function PublicSymptomPrompt({ disabled = false }) {
  const location = useLocation()
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

    const storedStartedAt = Number(window.sessionStorage.getItem(SYMPTOM_PROMPT_STARTED_AT_KEY))
    const startedAt = Number.isFinite(storedStartedAt) && storedStartedAt > 0 ? storedStartedAt : Date.now()
    if (startedAt !== storedStartedAt) {
      window.sessionStorage.setItem(SYMPTOM_PROMPT_STARTED_AT_KEY, String(startedAt))
    }
    const remainingDelay = Math.max(0, SYMPTOM_PROMPT_DELAY_MS - (Date.now() - startedAt))

    const timerId = window.setTimeout(() => {
      window.sessionStorage.setItem(SYMPTOM_PROMPT_STORAGE_KEY, '1')
      setVisible(true)
    }, remainingDelay)

    return () => window.clearTimeout(timerId)
  }, [disabled, loading, user, isExcludedRoute, location.pathname])

  if (!visible) return null

  const closePrompt = () => setVisible(false)

  return (
    <Suspense fallback={null}>
      <WellbeingCheckModal open={visible} onClose={closePrompt} />
    </Suspense>
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
          <Route path="/ua/about" element={<UaAbout />} />
          <Route path="/ua/privacy-policy" element={<UaPrivacy />} />
          <Route path="/ua/terms" element={<UaTerms />} />
          <Route path="/ua/health-hub" element={<UaHealthHubHome />} />
          <Route path="/ua/health-hub/topics/:clusterSlug" element={<UaHealthHubCluster />} />
          <Route path="/ua/health-hub/:articleSlug" element={<UaHealthHubArticle />} />
          <Route path="/ua/:pageSlug" element={<UaPage />} />
          {/* UA Health Hub */}
          <Route path="/health-hub" element={isUaHost ? <UaHealthHubHome /> : <HealthHub />} />
          <Route path="/health-hub/topics/:clusterSlug" element={isUaHost ? <UaHealthHubCluster /> : <HealthHubCluster />} />
          <Route path="/health-hub/:articleSlug" element={isUaHost ? <UaHealthHubArticle /> : <HealthHubArticle />} />

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
          <Route path="/product" element={<Navigate to="/how-it-works/" replace />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Navigate to="/#pricing" replace />} />
          <Route path="/stories" element={<Navigate to="/#stories" replace />} />
          <Route path="/investors" element={<Navigate to="/for-investors/" replace />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/example-report" element={<ExampleReport />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={isUaHost ? <UaAbout /> : <About />} />
          <Route path="/for-investors" element={<ForInvestors />} />
          <Route path="/for-nutritionists" element={<ForNutritionists />} />
          <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
          <Route path="/privacy-policy" element={isUaHost ? <UaPrivacy /> : <Privacy />} />
          <Route path="/terms" element={isUaHost ? <UaTerms /> : <Terms />} />
          <Route path="/help" element={<Help />} />
          <Route path="/help/section/:sectionId" element={<Help />} />
          <Route path="/help/:articleId" element={<Help />} />
          <Route path="/symptom-intake" element={<SymptomIntake />} />
          <Route path="/health-hub" element={<HealthHub />} />
          <Route path="/site-map" element={<SiteMap />} />
          <Route path="/health-hub/topics/:clusterSlug" element={<HealthHubCluster />} />
          <Route path="/health-hub/:articleSlug" element={<HealthHubArticle />} />
          <Route path="/editorial-policy" element={<EditorialPolicy />} />
          <Route path="/medical-review-policy" element={<MedicalReviewPolicy />} />
          <Route path="/authors/vitaloop-editorial-team" element={<EditorialTeam />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterRedirect />} />
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
          <Route path="/progress" element={renderCabinetRoute(<Progress />, { allowBeforeOnboarding: true })} />
          <Route path="/progress/" element={renderCabinetRoute(<Progress />, { allowBeforeOnboarding: true })} />
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
