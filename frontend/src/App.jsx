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
  const [ferriMessageIndex, setFerriMessageIndex] = useState(0)

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

  const ferriMessages = [
    "Hi! I'm Ferri. Let's investigate your biomarkers.",
    'Most people miss important clues in their blood tests.',
    'Got blood work? Let me take a look.',
    'Not sure where to start? Try a quick symptom check.',
  ]

  useEffect(() => {
    if (isCabinetRoute) return undefined

    setFerriMessageIndex(0)
    const insightTimer = window.setTimeout(() => setFerriMessageIndex(1), 20000)
    const idleTimer = window.setTimeout(() => setFerriMessageIndex(3), 36000)
    return () => {
      window.clearTimeout(insightTimer)
      window.clearTimeout(idleTimer)
    }
  }, [isCabinetRoute, location.pathname])

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
            0%, 100% { transform: translate3d(0, 0, 0) rotate(-2deg); }
            50% { transform: translate3d(0, -9px, 0) rotate(2deg); }
          }
          @keyframes ferriBlink {
            0%, 88%, 100% { transform: scaleY(1); }
            92%, 94% { transform: scaleY(0.12); }
          }
          @keyframes ferriScan {
            0%, 100% { transform: translateX(-3px); opacity: 0.48; }
            50% { transform: translateX(4px); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .ferri-float, .ferri-eye, .ferri-scan { animation: none !important; }
          }
        `}</style>

        <div className="fixed bottom-5 right-5 z-[2999] flex max-w-[calc(100vw-32px)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
          {ferriOpen && (
            <div className="w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
              <div className="relative bg-[radial-gradient(circle_at_top_right,rgba(42,191,170,0.24),transparent_42%),linear-gradient(135deg,#ffffff,#ecfdf5)] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setFerriOpen(false)}
                  aria-label="Close Ferri assistant"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-500 transition hover:border-slate-300 hover:text-slate-950"
                >
                  x
                </button>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Ferri - Iron Detective</p>
                <h3 className="mt-2 pr-9 text-xl font-bold tracking-tight text-slate-950">Let's investigate your biomarkers.</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  I can help you start with symptoms or upload blood work when you have it.
                </p>
              </div>
              <div className="grid gap-2 px-5 py-4">
                <button
                  type="button"
                  onClick={startSymptomCheck}
                  className="rounded-2xl bg-emerald-600 px-4 py-3 text-left text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  Try a quick symptom check
                </button>
                <button
                  type="button"
                  onClick={uploadLabs}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  Upload blood test results
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            {!ferriOpen && (
              <button
                type="button"
                onClick={() => setFerriOpen(true)}
                className="hidden max-w-[260px] rounded-3xl border border-emerald-200 bg-white px-4 py-3 text-left text-sm font-semibold leading-5 text-slate-800 shadow-[0_16px_46px_rgba(15,23,42,0.16)] transition hover:border-emerald-300 sm:block"
              >
                {ferriMessages[ferriMessageIndex]}
              </button>
            )}

            <button
              type="button"
              onClick={() => setFerriOpen((value) => !value)}
              aria-label="Open Ferri biomarker assistant"
              title="Ferri - Iron Detective"
              className="ferri-float relative flex h-[74px] w-[74px] items-center justify-center rounded-full border border-emerald-200 bg-white shadow-[0_18px_52px_rgba(15,23,42,0.22)] transition hover:-translate-y-1"
              style={{ animation: 'ferriFloat 4.6s ease-in-out infinite' }}
            >
              <svg viewBox="0 0 96 96" className="h-[66px] w-[66px]" aria-hidden="true">
                <defs>
                  <radialGradient id="ferriBody" cx="35%" cy="24%" r="72%">
                    <stop offset="0%" stopColor="#7df5e6" />
                    <stop offset="48%" stopColor="#2ABFAA" />
                    <stop offset="100%" stopColor="#0b6b5b" />
                  </radialGradient>
                  <linearGradient id="ferriLens" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.94" />
                    <stop offset="100%" stopColor="#b9f7ef" stopOpacity="0.72" />
                  </linearGradient>
                </defs>
                <ellipse cx="48" cy="78" rx="26" ry="8" fill="#0f766e" opacity="0.10" />
                <path d="M22 56c-7 4-10 10-7 14 3 3 9 2 14-3" fill="none" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" />
                <path d="M73 56c7 4 10 10 7 14-3 3-9 2-14-3" fill="none" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" />
                <circle cx="48" cy="44" r="31" fill="url(#ferriBody)" />
                <circle cx="37" cy="39" r="8.5" fill="#ffffff" />
                <circle cx="59" cy="39" r="8.5" fill="#ffffff" />
                <ellipse className="ferri-eye" cx="39" cy="40" rx="3.5" ry="4.5" fill="#062f2a" style={{ transformOrigin: '39px 40px', animation: 'ferriBlink 4.8s ease-in-out infinite' }} />
                <ellipse className="ferri-eye" cx="57" cy="40" rx="3.5" ry="4.5" fill="#062f2a" style={{ transformOrigin: '57px 40px', animation: 'ferriBlink 4.8s ease-in-out infinite' }} />
                <circle cx="40.5" cy="37.8" r="1.2" fill="#ffffff" />
                <circle cx="58.5" cy="37.8" r="1.2" fill="#ffffff" />
                <path d="M39 55c5 5 13 5 18 0" fill="none" stroke="#073b35" strokeWidth="3" strokeLinecap="round" />
                <path d="M34 21c9-5 20-5 29 0" fill="none" stroke="#d9fff9" strokeWidth="3" strokeLinecap="round" opacity="0.74" />
                <circle cx="66" cy="58" r="10" fill="url(#ferriLens)" stroke="#063f37" strokeWidth="3" />
                <path d="M73 65l11 11" stroke="#063f37" strokeWidth="5" strokeLinecap="round" />
                <path className="ferri-scan" d="M61 58h10" stroke="#2ABFAA" strokeWidth="2" strokeLinecap="round" style={{ animation: 'ferriScan 2.4s ease-in-out infinite' }} />
                <path d="M35 73l-4 8" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" />
                <path d="M58 73l5 8" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" />
              </svg>
              <span className="absolute -left-1 top-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 shadow-sm">
                Ferri
              </span>
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
