import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Upload from './pages/Upload.jsx'
import Results from './pages/Results.jsx'
import Avatar from './pages/Avatar.jsx'
import Progress from './pages/Progress.jsx'
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
import Insights from './pages/Insights.jsx'
import NotFound from './pages/NotFound.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useCRMRoleAccess } from './hooks/useCRMRoleAccess.js'
import { useEffect, useState } from 'react'
import api from './lib/api.js'
import SupportChat from './components/SupportChat.jsx'

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

function EndUserFlowRoute({ children, allowBeforeOnboarding = false }) {
  const { user, loading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [requiresOnboarding, setRequiresOnboarding] = useState(false)

  useEffect(() => {
    let active = true

    async function resolveContext() {
      if (!user) {
        if (active) {
          setRequiresOnboarding(false)
          setChecking(false)
        }
        return
      }

      try {
        const { data } = await api.get('/auth/onboarding/state')
        const needs = Boolean(data?.requires_onboarding)

        if (active) {
          setRequiresOnboarding(needs)
        }
      } catch {
        if (active) {
          // Fail open for non-critical context errors.
          setRequiresOnboarding(false)
        }
      } finally {
        if (active) {
          setChecking(false)
        }
      }
    }

    resolveContext()

    return () => {
      active = false
    }
  }, [user])

  if (loading || checking) return <div className="flex items-center justify-center h-screen">Loading…</div>
  if (requiresOnboarding && !allowBeforeOnboarding) return <Navigate to="/onboarding" replace />
  if (!requiresOnboarding && allowBeforeOnboarding) return <Navigate to="/dashboard" replace />

  return children
}

export default function App() {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/example-report" element={<ExampleReport />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/confirmation" element={<EmailConfirmation />} />
        <Route path="/dashboard" element={<ProtectedRoute><EndUserFlowRoute><Dashboard /></EndUserFlowRoute></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><EndUserFlowRoute><Upload /></EndUserFlowRoute></ProtectedRoute>} />
        <Route path="/results/:uploadId" element={<ProtectedRoute><EndUserFlowRoute><Results /></EndUserFlowRoute></ProtectedRoute>} />
        <Route path="/avatar" element={<ProtectedRoute><EndUserFlowRoute><Avatar /></EndUserFlowRoute></ProtectedRoute>} />
        <Route path="/progress" element={<ProtectedRoute><EndUserFlowRoute><Progress /></EndUserFlowRoute></ProtectedRoute>} />
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
        <Route path="/onboarding" element={<ProtectedRoute><EndUserFlowRoute allowBeforeOnboarding><Onboarding /></EndUserFlowRoute></ProtectedRoute>} />
        <Route path="/checkin" element={<ProtectedRoute><EndUserFlowRoute><WeeklyCheckIn /></EndUserFlowRoute></ProtectedRoute>} />
        <Route path="/timeline" element={<ProtectedRoute><EndUserFlowRoute><Insights /></EndUserFlowRoute></ProtectedRoute>} />
        <Route path="/404.html" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

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
