import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { motion } from 'framer-motion'
import { Sparkles, Calendar, Activity, User } from 'lucide-react'
import api from '../lib/api.js'
import RedFlagBanner from '../components/RedFlagBanner.jsx'
import { useOnboardingState } from '../hooks/useOnboardingState.js'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { subStatus } = useSubscription()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [insights, setInsights] = useState([])
  const { state: onboardingState } = useOnboardingState()

  useEffect(() => {
    Promise.allSettled([
      api.get('/profile'),
      api.get('/checkins/history'),
      api.get('/insights'),
    ]).then(([p, c, i]) => {
      if (p.status === 'fulfilled') {
        setProfile(p.value.data?.profile)
      }
      if (c.status === 'fulfilled') setCheckins(c.value.data || [])
      if (i.status === 'fulfilled') setInsights((i.value.data || []).slice(0, 2))
    })
  }, [])

  const checklist = onboardingState?.checklist || {}
  const steps = [
    { key: 'profile_basics', label: 'Fill profile basics', action: () => navigate('/onboarding') },
    { key: 'location', label: 'Set your location', action: () => navigate('/onboarding') },
    { key: 'complaints', label: 'Add recurring complaints', action: () => navigate('/onboarding') },
    { key: 'first_upload', label: 'Upload your first lab report', action: () => navigate('/upload') },
  ]
  const completedSteps = steps.filter((s) => checklist[s.key]).length
  const progressPct = Math.round((completedSteps / steps.length) * 100)
  const missingSteps = steps.filter((s) => !checklist[s.key])

  const getMonday = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).toISOString().split('T')[0]
  }

  const thisWeekCheckin = checkins.find(c => c.week_start === getMonday())

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <h1 className="text-2xl font-bold" style={{ color: '#1d9e75' }}>VITALOOP</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 uppercase">{subStatus}</span>
          <button onClick={signOut} className="text-sm text-gray-500 hover:text-gray-300">Sign out</button>
        </div>
      </header>

      <p className="text-gray-400 mb-6">Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</p>

      {/* Red flag banner */}
      <RedFlagBanner />

      {/* Onboarding progress + gate cards */}
      {onboardingState?.requires_onboarding && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ background: 'rgba(29,158,117,0.08)', border: '0.5px solid rgba(29,158,117,0.3)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 600, color: '#1d9e75', marginBottom: 4 }}>Onboarding progress: {progressPct}%</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>Complete baseline steps to unlock full personalization.</div>
            <div style={{ height: 6, borderRadius: 8, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: '#1d9e75' }} />
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            {missingSteps.map((step) => (
              <div key={step.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{step.label}</div>
                <button
                  onClick={step.action}
                  style={{ padding: '6px 12px', background: '#1d9e75', borderRadius: 8, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  Continue
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Weekly check-in prompt */}
      {!thisWeekCheckin && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ background: 'rgba(129,140,248,0.08)', border: '0.5px solid rgba(129,140,248,0.25)', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#818cf8', marginBottom: 4 }}>Weekly check-in due</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>How are you feeling this week? Takes 2 minutes.</div>
          </div>
          <button onClick={() => navigate('/checkin')} style={{ padding: '9px 18px', background: '#818cf8', borderRadius: 10, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>Check In</button>
        </motion.div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/upload')}
          className="hover:opacity-90 text-white rounded-xl p-6 text-left transition"
          style={{ background: '#1d9e75' }}
        >
          <div className="text-3xl mb-2">🧪</div>
          <div className="font-semibold">Upload Lab Results</div>
          <div className="text-sm opacity-80 mt-1">Analyze your blood test</div>
        </button>
        <button
          onClick={() => navigate('/avatar')}
          className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-left transition"
        >
          <div className="text-3xl mb-2">🫀</div>
          <div className="font-semibold">Health Avatar</div>
          <div className="text-sm text-gray-400 mt-1">View your body status</div>
        </button>
        <button
          onClick={() => navigate('/progress')}
          className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-left transition"
        >
          <div className="text-3xl mb-2">📈</div>
          <div className="font-semibold">Progress Tracker</div>
          <div className="text-sm text-gray-400 mt-1">Biomarker trends over time</div>
        </button>
        <button
          onClick={() => navigate('/checkin')}
          className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-left transition"
        >
          <div className="text-3xl mb-2">✅</div>
          <div className="font-semibold">Weekly Check-In</div>
          <div className="text-sm text-gray-400 mt-1">Track how you feel</div>
        </button>
        <button
          onClick={() => navigate('/timeline')}
          className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-left transition"
        >
          <div className="text-3xl mb-2">✨</div>
          <div className="font-semibold">Insights & Timeline</div>
          <div className="text-sm text-gray-400 mt-1">Your health journey</div>
        </button>
        <button
          onClick={() => navigate('/admin')}
          className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-left transition"
        >
          <div className="text-3xl mb-2">💊</div>
          <div className="font-semibold">Health Dashboard</div>
          <div className="text-sm text-gray-400 mt-1">Symptoms & protocol</div>
        </button>
      </div>

      {/* Insights preview */}
      {insights.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Sparkles size={15} /> Latest Insights
          </div>
          {insights.map((ins, i) => (
            <div key={ins.id || i} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{ins.title}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{ins.body}</div>
            </div>
          ))}
          <button onClick={() => navigate('/timeline')} style={{ background: 'none', border: 'none', color: '#1d9e75', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>View all insights →</button>
        </div>
      )}
    </div>
  )
}
