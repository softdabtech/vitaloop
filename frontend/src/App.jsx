import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { X, ListChecks, ShieldCheck, Clock3, ArrowRight, Stethoscope } from 'lucide-react'
// Landing is lazy — it's heavy (framer-motion) and never renders on ua.vitaloop.today
const Landing = lazy(() => import('./pages/Landing.jsx'))
// NotFound is rare — no reason to eager-load
const NotFound = lazy(() => import('./pages/NotFound.jsx'))
import AppLoadingScreen from './components/AppLoadingScreen.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useCRMRoleAccess } from './hooks/useCRMRoleAccess.js'
import { useEffect, useState } from 'react'
import { useOnboardingState } from './hooks/useOnboardingState.js'
import { gaPageView, gaSetUserId } from './lib/analytics.js'
import { trackPublicFunnelEvent } from './lib/publicFunnel.js'
import { isUkrainianLocale } from './lib/locale.js'

// Marketing pages — lazy
const Features = lazy(() => import('./pages/Features.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const FAQ = lazy(() => import('./pages/FAQ.jsx'))
const EmailConfirmation = lazy(() => import('./pages/EmailConfirmation.jsx'))
const ExampleReport = lazy(() => import('./pages/ExampleReport.jsx'))
const HowItWorks = lazy(() => import('./pages/HowItWorks.jsx'))
const Team = lazy(() => import('./pages/Team.jsx'))
const Contact = lazy(() => import('./pages/Contact.jsx'))
const ForInvestors = lazy(() => import('./pages/ForInvestors.jsx'))
const ForNutritionists = lazy(() => import('./pages/ForNutritionists.jsx'))
const Privacy = lazy(() => import('./pages/Privacy.jsx'))
const Terms = lazy(() => import('./pages/Terms.jsx'))
const RefundPolicy = lazy(() => import('./pages/RefundPolicy.jsx'))
const UaPrivacy = lazy(() => import('./pages/UaPrivacy.jsx'))
const UaTerms = lazy(() => import('./pages/UaTerms.jsx'))
const UaRefundPolicy = lazy(() => import('./pages/UaRefundPolicy.jsx'))
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

// UI components — lazy
const PaywallModal = lazy(() => import('./components/PaywallModal.jsx'))
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
const Assignments = lazy(() => import('./pages/Assignments.jsx'))
const AssignmentDetails = lazy(() => import('./pages/AssignmentDetails.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const HealthProfile = lazy(() => import('./pages/HealthProfile.jsx'))
const Subscription = lazy(() => import('./pages/Subscription.jsx'))
const BillingHistory = lazy(() => import('./pages/BillingHistory.jsx'))
const CheckInHistory = lazy(() => import('./pages/CheckInHistory.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))
const Questionnaire = lazy(() => import('./pages/SymptomCheck.jsx'))
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

    // Access is granted solely by the server-side Creem webhook. Do not emit
    // ecommerce purchase events for the international product.
  }, [location.pathname, location.search])
  return null
}

// Stitches GA4 sessions to the logged-in user (Supabase user id — a UUID,
// never email/PII) so cross-visit/cross-device journeys ("who went where")
// are attributable per user instead of only per anonymous client id. Mounted
// once at the top level, independent of GAPageTracker, since identity and
// navigation are separate concerns and this must also fire on plain
// login/logout with no route change.
function GAIdentityTracker() {
  const { user, loading } = useAuth()
  useEffect(() => {
    if (loading) return
    gaSetUserId(user?.id ?? null)
  }, [loading, user?.id])
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
  const { user, loading } = useAuth()
  const shouldWaitForOnboarding = !allowBeforeOnboarding || redirectIfOnboardingComplete
  const { state, loading: onboardingLoading, isError, error, retry } = useOnboardingState({
    enabled: Boolean(user) && !loading && shouldWaitForOnboarding,
  })
  const onboardingStateKnown = state?.requires_onboarding !== null && state?.requires_onboarding !== undefined
  const requiresOnboarding = Boolean(state?.requires_onboarding)

  if (loading) {
    return <AppLoadingScreen />
  }
  if (!shouldWaitForOnboarding) return children

  // Show error state when onboarding request fails
  if (isError) {
    return <AppLoadingScreen error={error} onRetry={retry} />
  }

  // Wait for onboarding state to resolve (not loading, not error)
  if (onboardingLoading || !onboardingStateKnown) return <AppLoadingScreen />

  if (shouldRedirectToOnboarding({ onboardingStateKnown, requiresOnboarding, allowBeforeOnboarding })) {
    return <Navigate to="/onboarding" replace />
  }
  if (!requiresOnboarding && redirectIfOnboardingComplete) return <Navigate to="/dashboard" replace />

  return children
}

export function shouldRedirectToOnboarding({ onboardingStateKnown, requiresOnboarding, allowBeforeOnboarding }) {
  return onboardingStateKnown && requiresOnboarding && !allowBeforeOnboarding
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

const CABINET_ROUTE_PREFIXES = [
  '/dashboard',
  '/upload',
  '/lab-plan',
  '/results/',
  '/protocol/',
  '/progress',
  '/assignments',
  '/lab-results',
  '/account',
  '/settings',
  '/health-profile',
  '/subscription',
  '/billing-history',
  '/help-center',
  '/onboarding',
  '/questionnaire',
  '/check-ins',
  '/insights',
]

export function isCabinetRoutePath(pathname) {
  return CABINET_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))
}

const SYMPTOM_PROMPT_STORAGE_KEY = 'vitaloop_symptom_prompt_seen'
const SYMPTOM_PROMPT_STARTED_AT_KEY = 'vitaloop_symptom_prompt_started_at'
const SYMPTOM_PROMPT_DELAY_MS = 10000

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
    '/progress',
    '/assignments',
    '/lab-results',
    '/account',
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

  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (!visible) {
      setEntered(false)
      return undefined
    }
    const raf = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(raf)
  }, [visible])

  if (!visible) return null

  const closePrompt = () => setVisible(false)
  const startIntake = () => {
    setVisible(false)
    navigate('/symptom-intake')
  }

  const steps = [
    { icon: ListChecks, label: 'Pick what you feel' },
    { icon: Stethoscope, label: 'Get a discussion list' },
    { icon: ArrowRight, label: 'Bring it to your next lab' },
  ]

  return (
    <div
      className={`fixed inset-0 z-[3200] flex items-end justify-center bg-slate-950/50 px-4 pb-4 pt-10 backdrop-blur-sm transition-opacity duration-300 sm:items-center sm:pb-10 ${entered ? 'opacity-100' : 'opacity-0'}`}
      onClick={closePrompt}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="symptom-prompt-heading"
        onClick={(event) => event.stopPropagation()}
        className={`w-full max-w-[540px] overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.32)] transition-all duration-300 ${entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.97] opacity-0'}`}
      >
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.28),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.16),transparent_50%),linear-gradient(135deg,#f8fffb,#ecfdf5)] px-6 pb-6 pt-6 sm:px-8 sm:pt-8">
          <button
            type="button"
            onClick={closePrompt}
            aria-label="Close symptom check prompt"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
            <Stethoscope className="h-3.5 w-3.5" strokeWidth={2.5} />
            Quick symptom check
          </div>
          <h2 id="symptom-prompt-heading" className="mt-4 max-w-[420px] text-[26px] font-bold leading-tight tracking-tight text-slate-950 sm:text-[30px]">
            Feel off, but not sure what to check?
          </h2>
          <p className="mt-3 max-w-[430px] text-[15px] leading-6 text-slate-600">
            Answer a few questions and get a safe lab discussion list before creating an account — something concrete to bring to your doctor, not a diagnosis.
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <ol className="grid grid-cols-3 gap-2 text-center">
            {steps.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-slate-600">{label}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid grid-cols-2 gap-2.5 text-[13px] text-slate-700">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 font-semibold">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.25} />
              No login required
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 font-semibold">
              <Clock3 className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.25} />
              About one minute
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              onClick={startIntake}
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(5,150,105,0.28)] transition hover:bg-emerald-700"
            >
              Start symptom check
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
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
      <GAIdentityTracker />
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={isUaHost ? <UaLanding /> : <Landing />} />
          <Route path="/ua" element={<UaLanding />} />
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
          <Route path="/pricing" element={isUaHost ? <Navigate to="/tarify" replace /> : <Navigate to="/#pricing" replace />} />
          <Route path="/stories" element={<Navigate to="/how-it-works" replace />} />
          <Route path="/investors" element={<Navigate to="/for-investors/" replace />} />
          <Route path="/faq" element={isUaHost ? <UaPage pageSlug="faq" /> : <FAQ />} />
          <Route path="/example-report" element={<ExampleReport />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<Navigate to={isUaHost ? '/' : '/team/'} replace />} />
          <Route path="/team" element={isUaHost ? <Navigate to="/" replace /> : <Team />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/for-investors" element={<ForInvestors />} />
          <Route path="/for-nutritionists" element={<ForNutritionists />} />
          <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
          <Route path="/privacy-policy" element={isUaHost ? <UaPrivacy /> : <Privacy />} />
          <Route path="/terms" element={isUaHost ? <UaTerms /> : <Terms />} />
          <Route path="/refund-policy" element={isUaHost ? <UaRefundPolicy /> : <RefundPolicy />} />
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
          <Route path="/dashboard" element={renderCabinetRoute(<UserDashboard />)} />
          <Route path="/today" element={<Navigate to="/dashboard" replace />} />
          <Route path="/symptom-check" element={<Navigate to="/questionnaire" replace />} />
          <Route path="/results-trends" element={<Navigate to="/lab-results" replace />} />
          <Route path="/upload" element={renderCabinetRoute(<Upload />)} />
          <Route path="/lab-plan" element={renderCabinetRoute(<LabPlan />)} />
          <Route path="/results/:uploadId" element={renderCabinetRoute(<Results />)} />
          <Route path="/protocol/:uploadId" element={renderCabinetRoute(<ProtocolPage />)} />
          <Route path="/avatar" element={<Navigate to="/dashboard" replace />} />
          <Route path="/progress" element={<Navigate to="/lab-results" replace />} />
          {/* /assignments and /assignments/:id show tasks a human practitioner/coach
              assigned via the CRM (practitioner_assignments table) — NOT the user's
              own AI-generated protocol. Self-serve end_users never have a
              practitioner attached, so this page is permanently, structurally
              empty for every current user and only confuses them (a real user hit
              this directly). Hidden behind a redirect — intentionally, for a later
              coached/practitioner product stage — rather than deleted, since the
              Assignments/AssignmentDetails components and their CRM-facing backend
              are still real and still used by the practitioner side of the
              product. Do not re-enable this route for end_users without also
              fixing the "Follow your plan" journey step and nextAction fallback in
              UserDashboard.jsx, and the removed sidebar entry in
              UserDashboardSidebar.jsx, which were pointed elsewhere for the same
              reason. */}
          <Route path="/assignments" element={<Navigate to="/dashboard" replace />} />
          <Route path="/assignments/:assignmentId" element={<Navigate to="/dashboard" replace />} />
          <Route path="/lab-results" element={renderCabinetRoute(<LabResultsList />, { allowBeforeOnboarding: true })} />
          <Route path="/account" element={renderCabinetRoute(<Settings />)} />
          <Route path="/settings" element={<Navigate to="/account" replace />} />
          <Route path="/health-profile" element={renderCabinetRoute(<HealthProfile />)} />
          <Route path="/subscription" element={renderCabinetRoute(<Subscription />, { allowBeforeOnboarding: true })} />
          <Route path="/billing-history" element={renderCabinetRoute(<BillingHistory />)} />
          <Route path="/help-center" element={renderCabinetRoute(<Help embedded basePath="/help-center" />)} />
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
          <Route path="/insights" element={renderCabinetRoute(<Insights />)} />
          {/* Legacy check-in URLs currently lead to the structured symptom flow.
              The old mixed free-text questionnaire remains outside the active
              route while the server-owned three-stage flow is validated. */}
          <Route path="/check-ins" element={renderCabinetRoute(<CheckInHistory />)} />
          <Route path="/checkin" element={<Navigate to="/check-ins" replace />} />
          <Route path="/timeline" element={<Navigate to="/insights" replace />} />
          <Route path="/dashboard-legacy" element={<Navigate to="/dashboard" replace />} />
          <Route path="/ops/legacy" element={<Navigate to="/ops" replace />} />
          <Route path="/404.html" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {!isUaLandingShell && <PublicSymptomPrompt disabled={isUaLandingShell} />}
    </BrowserRouter>
  )
}
