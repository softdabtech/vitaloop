import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Avatar from './pages/Avatar.jsx'
import Settings from './pages/Settings.jsx'
import ExampleReport from './pages/ExampleReport.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import ClientAdmin from './pages/ClientAdmin.jsx'
import MasterAdmin from './pages/MasterAdmin.jsx'
import OpsDashboard from './pages/crm/OpsDashboard.jsx'
import CRMPrograms from './pages/crm/Programs.jsx'
import CRMClients from './pages/crm/Clients.jsx'
import CRMClientDetails from './pages/crm/ClientDetails.jsx'
import CRMPractitioners from './pages/crm/Practitioners.jsx'
import CRMAuditLog from './pages/crm/AuditLog.jsx'
import EmailConfirmation from './pages/EmailConfirmation.jsx'
import Onboarding from './pages/Onboarding.jsx'
import WeeklyCheckIn from './pages/WeeklyCheckIn.jsx'
import Questionnaire from './pages/Questionnaire.jsx'
import NotFound from './pages/NotFound.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useSubscription } from './hooks/useSubscription.js'
import { useCRMRoleAccess } from './hooks/useCRMRoleAccess.js'
import { useEffect, useState } from 'react'
import { useOnboardingState } from './hooks/useOnboardingState.js'
import SupportChat from './components/SupportChat.jsx'

const UserDashboard = lazy(() => import('./pages/UserDashboard.jsx'))
const Upload = lazy(() => import('./pages/Upload.jsx'))
const Results = lazy(() => import('./pages/Results.jsx'))
const Progress = lazy(() => import('./pages/Progress.jsx'))
const Insights = lazy(() => import('./pages/Insights.jsx'))
const LabResultsList = lazy(() => import('./pages/LabResultsList.jsx'))
const Assignments = lazy(() => import('./pages/Assignments.jsx'))
const AssignmentDetails = lazy(() => import('./pages/AssignmentDetails.jsx'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>
  if (!user) return <Navigate to="/login" replace />

  return children
}

function CRMRoute({ children, needsOps = false }) {
  const { loading, canAccessCRM, canAccessOps } = useCRMRoleAccess()
  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>
  if (needsOps && !canAccessOps) return <Navigate to="/dashboard" replace />
  if (!needsOps && !canAccessCRM) return <Navigate to="/dashboard" replace />
  return children
}

function EndUserFlowRoute({ children, allowBeforeOnboarding = false, redirectIfOnboardingComplete = false }) {
  const { user, loading } = useAuth()
  const { state, loading: onboardingLoading } = useOnboardingState()
  const onboardingStateKnown = state?.requires_onboarding !== null && state?.requires_onboarding !== undefined
  const requiresOnboarding = Boolean(state?.requires_onboarding)

  if (loading || onboardingLoading || !onboardingStateKnown) {
    return <div className="flex items-center justify-center h-screen">Loading…</div>
  }
  if (requiresOnboarding && !allowBeforeOnboarding) return <Navigate to="/onboarding" replace />
  if (!requiresOnboarding && redirectIfOnboardingComplete) return <Navigate to="/dashboard" replace />

  return children
}

function PremiumRoute({ children }) {
  const { isActive, loading } = useSubscription()

  useEffect(() => {
    if (!loading && !isActive) {
      window.dispatchEvent(new CustomEvent('vitaloop:paywall'))
    }
  }, [loading, isActive])

  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>
  if (!isActive) return <Navigate to="/dashboard" replace />
  return children
}

function RouteFallback() {
  return <div className="flex items-center justify-center h-screen">Loading…</div>
}

export default function App() {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/example-report" element={<ExampleReport />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/confirmation" element={<EmailConfirmation />} />
          <Route path="/dashboard" element={<ProtectedRoute><EndUserFlowRoute allowBeforeOnboarding><UserDashboard /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/dashboard-legacy" element={<ProtectedRoute><EndUserFlowRoute allowBeforeOnboarding><Dashboard /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><EndUserFlowRoute><Upload /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/results/:uploadId" element={<ProtectedRoute><EndUserFlowRoute><Results /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/avatar" element={<ProtectedRoute><EndUserFlowRoute><Avatar /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><EndUserFlowRoute><PremiumRoute><Progress /></PremiumRoute></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/assignments" element={<ProtectedRoute><EndUserFlowRoute allowBeforeOnboarding><Assignments /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/assignments/:assignmentId" element={<ProtectedRoute><EndUserFlowRoute allowBeforeOnboarding><AssignmentDetails /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/lab-results" element={<ProtectedRoute><EndUserFlowRoute allowBeforeOnboarding><LabResultsList /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><EndUserFlowRoute><Settings /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><ClientAdmin /></ProtectedRoute>} />
          <Route path="/ops" element={<ProtectedRoute><CRMRoute needsOps><OpsDashboard /></CRMRoute></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><CRMRoute><OpsDashboard /></CRMRoute></ProtectedRoute>} />
          <Route path="/ops/legacy" element={<ProtectedRoute><MasterAdmin /></ProtectedRoute>} />
          <Route path="/crm/programs" element={<ProtectedRoute><CRMRoute><CRMPrograms /></CRMRoute></ProtectedRoute>} />
          <Route path="/crm/clients" element={<ProtectedRoute><CRMRoute><CRMClients /></CRMRoute></ProtectedRoute>} />
          <Route path="/crm/clients/:id" element={<ProtectedRoute><CRMRoute><CRMClientDetails /></CRMRoute></ProtectedRoute>} />
          <Route path="/crm/practitioners" element={<ProtectedRoute><CRMRoute><CRMPractitioners /></CRMRoute></ProtectedRoute>} />
          <Route path="/crm/activity" element={<ProtectedRoute><CRMRoute><CRMAuditLog /></CRMRoute></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute><EndUserFlowRoute allowBeforeOnboarding redirectIfOnboardingComplete><Onboarding /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/questionnaire" element={<ProtectedRoute><EndUserFlowRoute allowBeforeOnboarding><Questionnaire /></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/checkin" element={<ProtectedRoute><EndUserFlowRoute><PremiumRoute><WeeklyCheckIn /></PremiumRoute></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/timeline" element={<ProtectedRoute><EndUserFlowRoute><PremiumRoute><Insights /></PremiumRoute></EndUserFlowRoute></ProtectedRoute>} />
          <Route path="/404.html" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      {/* Floating chat button - visible on all pages */}
      <button
        onClick={() => setChatOpen(v => !v)}
        aria-label="Open support chat"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 2999,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--teal-800,#085041)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(8,80,65,0.35)',
          transition: 'transform 200ms, background 200ms',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-600,#0F6E56)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--teal-800,#085041)'}
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

      {chatOpen && <SupportChat onClose={() => setChatOpen(false)} />}
    </BrowserRouter>
  )
}
