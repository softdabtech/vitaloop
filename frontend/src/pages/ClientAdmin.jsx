import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth.js'
import { supabase } from '../lib/supabase.js'
import api from '../lib/api.js'
import { SYMPTOM_OPTIONS } from '../lib/symptoms.js'
import { Calendar, TrendingUp, Heart, CreditCard, Download, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import AdminShell from '../components/admin/AdminShell.jsx'

async function fetchDashboardData(userId) {
  // Post-release entitlement consistency fix: this used to read
  // users.sub_status/sub_current_period_end directly via a client-side
  // Supabase query — sub_current_period_end isn't even a real column on
  // users (the real field lives on the subscriptions table), and sub_status
  // is the same legacy field that can disagree with the canonical resolver.
  // /auth/entitlements calls the exact same resolve_user_entitlements()
  // /auth/me and the rest of the product already use.
  const [profileResp, uploadsResp, subscriptionResp, symptomsResp] = await Promise.allSettled([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('lab_uploads').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    api.get('/auth/entitlements'),
    api.get('/symptoms/summary?days=30'),
  ])

  return { profileResp, uploadsResp, subscriptionResp, symptomsResp }
}

function buildStatsFromUploads(uploads) {
  return {
    totalTests: uploads.length,
    lastTest: uploads[0]?.created_at ? new Date(uploads[0].created_at) : null,
  }
}

export default function ClientAdmin() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [uploads, setUploads] = useState([])
  const [stats, setStats] = useState({ totalTests: 0, lastTest: null, improvement: 0 })
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedSymptoms, setSelectedSymptoms] = useState([])
  const [severity, setSeverity] = useState(5)
  const [savingSymptoms, setSavingSymptoms] = useState(false)
  const [symptomSummary, setSymptomSummary] = useState({
    entries: 0,
    average_severity: 0,
    top_symptoms: [],
    top_zones: [],
    recent_logs: [],
  })

  useEffect(() => {
    if (!user) return

    async function loadDashboardData() {
      setLoading(true)
      const {
        profileResp,
        uploadsResp,
        subscriptionResp,
        symptomsResp,
      } = await fetchDashboardData(user.id)

      if (profileResp.status === 'fulfilled') {
        setProfile(profileResp.value.data)
      }

      if (uploadsResp.status === 'fulfilled') {
        const data = uploadsResp.value.data ?? []
        setUploads(data)
        setStats((prev) => ({
          ...prev,
          ...buildStatsFromUploads(data),
        }))
      }

      if (subscriptionResp.status === 'fulfilled') {
        setSubscription(subscriptionResp.value.data)
      }

      if (symptomsResp.status === 'fulfilled') {
        setSymptomSummary(symptomsResp.value.data)
      }

      setLoading(false)
    }

    loadDashboardData()
  }, [user])

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const daysSinceLastTest = stats.lastTest ? Math.floor((new Date() - stats.lastTest) / (1000 * 60 * 60 * 24)) : null

  function toggleSymptom(id) {
    setSelectedSymptoms((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  async function handleLogSymptoms() {
    if (!selectedSymptoms.length) {
      toast.error('Select at least one symptom before logging')
      return
    }

    setSavingSymptoms(true)
    try {
      await api.post('/symptoms', {
        tags: selectedSymptoms,
        severity,
      })

      const { data } = await api.get('/symptoms/summary?days=30')
      setSymptomSummary(data)
      setSelectedSymptoms([])
      setSeverity(5)
      toast.success('Symptoms logged successfully')
    } catch (error) {
      toast.error(error?.response?.data?.detail?.detail || 'Failed to log symptoms')
    } finally {
      setSavingSymptoms(false)
    }
  }

  if (loading) {
    return (
      <AdminShell title="Health Dashboard" variant="client">
        <div style={{ textAlign: 'center', padding: 64, color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title="Health Dashboard"
      subtitle={profile?.full_name || undefined}
      variant="client"
    >
      <div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 rounded-lg p-6 border border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-sm mb-1">Total Tests</p>
                <p className="text-3xl font-bold text-white">{stats.totalTests}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-green-900/30 to-green-800/10 rounded-lg p-6 border border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-300 text-sm mb-1">Last Test</p>
                <p className="text-2xl font-bold text-white">{daysSinceLastTest !== null ? `${daysSinceLastTest}d ago` : '—'}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 rounded-lg p-6 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-300 text-sm mb-1">Subscription</p>
                <p className={`text-2xl font-bold ${subscription?.sub_status === 'active' ? 'text-green-400' : 'text-gray-400'}`}>
                  {subscription?.sub_status === 'active' ? 'Premium' : 'Free'}
                </p>
              </div>
              <CreditCard className="w-8 h-8 text-purple-400 opacity-50" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-rose-900/30 to-rose-800/10 rounded-lg p-6 border border-rose-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-rose-300 text-sm mb-1">Symptom Logs (30d)</p>
                <p className="text-2xl font-bold text-white">{symptomSummary.entries || 0}</p>
              </div>
              <Heart className="w-8 h-8 text-rose-400 opacity-50" />
            </div>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Health Journey */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Health Journey
              </h2>

              {uploads.length > 0 ? (
                <div className="space-y-4">
                  {uploads.slice(0, 5).map((upload, idx) => (
                    <motion.div
                      key={upload.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-start gap-4 pb-4 border-b border-gray-700/50 last:border-0"
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-lg flex items-center justify-center">
                        <span className="text-blue-400 text-lg">#{idx + 1}</span>
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-semibold text-white">{upload.lab_name}</h3>
                        <p className="text-sm text-gray-400">{formatDate(upload.created_at)}</p>
                      </div>
                      <button className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded text-sm text-blue-300 transition flex items-center gap-1">
                        <Download className="w-4 h-4" /> View
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>No lab results yet. Upload your first test to get started.</p>
                </div>
              )}
            </motion.div>

            {/* Progress Tracker Chart Placeholder */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                6-Month Trends
              </h2>
              <div className="h-64 flex items-center justify-center bg-gray-900/30 rounded-lg border border-gray-700/50">
                {symptomSummary.top_zones?.length > 0 ? (
                  <div className="w-full p-6 space-y-3">
                    {symptomSummary.top_zones.slice(0, 5).map((zone) => (
                      <div key={zone.zone}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300 capitalize">{zone.zone}</span>
                          <span className="text-blue-300">{zone.score.toFixed(1)}</span>
                        </div>
                        <div className="h-2 rounded bg-gray-700/60 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${Math.max(6, zone.normalized_score * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 pt-1">Symptom pressure by body zone over last 30 days</p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center">
                    Start logging symptoms to unlock zone trend analytics.
                  </p>
                )}
              </div>
            </motion.div>
          </div>

          {/* Right Column: Sidebar */}
          <div className="space-y-6">
            {/* Subscription Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 rounded-xl p-6 border border-purple-500/30 backdrop-blur-sm">
              <h3 className="font-semibold text-white mb-4">Subscription</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-1">Current Plan</p>
                <p className={`text-xl font-bold ${subscription?.is_premium ? 'text-green-400' : 'text-gray-400'}`}>
                  {subscription?.is_premium ? 'Vitaloop Premium' : 'Vitaloop Free'}
                </p>
              </div>
              <button className={`w-full py-2 rounded-lg font-semibold transition ${
                subscription?.is_premium
                  ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                  : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
              }`}>
                {subscription?.is_premium ? 'Manage Subscription' : 'Upgrade to Premium'}
              </button>
            </motion.div>

            {/* Symptom Log Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-400" />
                Daily Symptoms
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {SYMPTOM_OPTIONS.slice(0, 12).map((symptom) => (
                  <button
                    key={symptom.id}
                    type="button"
                    onClick={() => toggleSymptom(symptom.id)}
                    className={`px-2.5 py-1 rounded-full text-xs transition ${
                      selectedSymptoms.includes(symptom.id)
                        ? 'bg-rose-500/90 text-white'
                        : 'bg-gray-900/70 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {symptom.label}
                  </button>
                ))}
              </div>
              <label className="block text-xs text-gray-400 mb-1">Severity ({severity}/10)</label>
              <input
                type="range"
                min="1"
                max="10"
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="w-full accent-rose-400"
              />

              <div className="mt-4 p-3 rounded bg-gray-900/50 border border-gray-700/70">
                <p className="text-xs text-gray-400 mb-2">Top symptoms (30d)</p>
                {symptomSummary.top_symptoms?.length ? (
                  <div className="space-y-1.5">
                    {symptomSummary.top_symptoms.slice(0, 3).map((item) => (
                      <div key={item.tag} className="flex items-center justify-between text-xs">
                        <span className="text-gray-300">{item.label}</span>
                        <span className="text-blue-300">{item.count}x</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    No symptom history yet
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogSymptoms}
                disabled={savingSymptoms}
                className="w-full mt-4 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded text-sm text-blue-300 transition font-medium disabled:opacity-60"
              >
                {savingSymptoms ? 'Saving...' : 'Log Today'}
              </button>
            </motion.div>

            {/* Key Actions */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
              <h3 className="font-semibold text-white mb-4">Key Actions</h3>
              <div className="space-y-2">
                <button className="w-full px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded text-sm font-medium transition">
                  📊 Upload New Test
                </button>
                <button className="w-full px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded text-sm font-medium transition">
                  👁️ View Avatar
                </button>
                <button className="w-full px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded text-sm font-medium transition">
                  📋 View Protocol
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
