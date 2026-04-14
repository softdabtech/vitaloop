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
import Onboarding from './pages/Onboarding.jsx'
import WeeklyCheckIn from './pages/WeeklyCheckIn.jsx'
import Insights from './pages/Insights.jsx'
import NotFound from './pages/NotFound.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useEffect, useState } from 'react'
import SupportChat from './components/SupportChat.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>
  return user ? children : <Navigate to="/login" replace />
}

function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  const meta = user?.user_metadata || {}
  const app = user?.app_metadata || {}
  const isSuperAdmin = meta.is_super_admin || app.is_super_admin
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />
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
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/upload" element={<PrivateRoute><Upload /></PrivateRoute>} />
        <Route path="/results/:uploadId" element={<PrivateRoute><Results /></PrivateRoute>} />
        <Route path="/avatar" element={<PrivateRoute><Avatar /></PrivateRoute>} />
        <Route path="/progress" element={<PrivateRoute><Progress /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><ClientAdmin /></PrivateRoute>} />
        <Route path="/ops" element={<SuperAdminRoute><MasterAdmin /></SuperAdminRoute>} />
        <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
        <Route path="/checkin" element={<PrivateRoute><WeeklyCheckIn /></PrivateRoute>} />
        <Route path="/timeline" element={<PrivateRoute><Insights /></PrivateRoute>} />
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
