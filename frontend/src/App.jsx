import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import AppLoadingScreen from './components/AppLoadingScreen.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useCRMRoleAccess } from './hooks/useCRMRoleAccess.js'
import { useEffect, useState } from 'react'
import { useOnboardingState } from './hooks/useOnboardingState.js'
import { gaPageView } from './lib/analytics.js'

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
  const [chatOpen, setChatOpen] = useState(false)

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
      {!isUaLandingShell && <FloatingSupportChat />}
    </BrowserRouter>
  )
}
