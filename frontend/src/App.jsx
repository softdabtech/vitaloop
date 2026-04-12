import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import { useAuth } from './hooks/useAuth.js'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/example-report" element={<ExampleReport />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/upload" element={<PrivateRoute><Upload /></PrivateRoute>} />
        <Route path="/results/:uploadId" element={<PrivateRoute><Results /></PrivateRoute>} />
        <Route path="/avatar" element={<PrivateRoute><Avatar /></PrivateRoute>} />
        <Route path="/progress" element={<PrivateRoute><Progress /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
