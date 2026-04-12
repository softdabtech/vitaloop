import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Upload from './pages/Upload.jsx'
import Results from './pages/Results.jsx'
import Avatar from './pages/Avatar.jsx'
import Progress from './pages/Progress.jsx'
import Settings from './pages/Settings.jsx'
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import DisclaimerModal from './components/DisclaimerModal.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import { useAuth } from './hooks/useAuth.js'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <DisclaimerModal />
      <InstallPrompt />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151' },
          error: { duration: 5000 },
        }}
      />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
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
