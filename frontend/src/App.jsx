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
import { useAuth } from './hooks/useAuth.js'
import { useEffect } from 'react'

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
      </Routes>
    </BrowserRouter>
  )
}
