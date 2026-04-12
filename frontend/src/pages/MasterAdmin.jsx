import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import { motion } from 'framer-motion'
import { Users, Settings, Database, BarChart3, AlertCircle, CheckCircle, Clock } from 'lucide-react'

export default function MasterAdmin() {
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [symptomAnalytics, setSymptomAnalytics] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    
    // Check if user is super_admin
    if (!user.user_metadata?.is_super_admin) {
      return
    }

    async function loadAdminData() {
      setLoading(true)
      const [overviewRes, symptomsRes] = await Promise.allSettled([
        api.get('/admin/overview'),
        api.get('/symptoms/summary/all?days=30'),
      ])

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value.data)
      }

      if (symptomsRes.status === 'fulfilled') {
        setSymptomAnalytics(symptomsRes.value.data)
      }

      if (overviewRes.status === 'rejected') {
        console.error('Failed to load admin overview:', overviewRes.reason)
      }

      if (symptomsRes.status === 'rejected') {
        console.error('Failed to load platform symptom analytics:', symptomsRes.reason)
      }

      setLoading(false)
    }

    loadAdminData()
  }, [user])

  if (loading) return <div className="text-center p-8">Loading admin panel...</div>

  if (!user?.user_metadata?.is_super_admin) {
    return (
      <div className="min-h-screen bg-gray-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You don't have permission to access this area.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Operations Dashboard</h1>
          <p className="text-gray-400">Master admin panel - System monitoring & business intelligence</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-700">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'knowledge', label: 'Knowledge Base', icon: Database },
            { id: 'monitoring', label: 'System', icon: Settings },
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 border-b-2 transition font-semibold flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
          <div className="grid lg:grid-cols-4 gap-4 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 rounded-lg p-6 border border-blue-500/20">
              <p className="text-blue-300 text-sm mb-2">Total Users</p>
              <p className="text-4xl font-bold text-white">{overview?.total_users || 0}</p>
              <p className="text-xs text-gray-400 mt-2">Active this month: {overview?.active_users || 0}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-green-900/30 to-green-800/10 rounded-lg p-6 border border-green-500/20">
              <p className="text-green-300 text-sm mb-2">Premium Subscribers</p>
              <p className="text-4xl font-bold text-white">{overview?.premium_subscribers || 0}</p>
              <p className="text-xs text-gray-400 mt-2">MRR: ${(overview?.mrr || 0).toFixed(2)}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 rounded-lg p-6 border border-purple-500/20">
              <p className="text-purple-300 text-sm mb-2">Tests Uploaded</p>
              <p className="text-4xl font-bold text-white">{overview?.total_uploads || 0}</p>
              <p className="text-xs text-gray-400 mt-2">This week: {overview?.weekly_uploads || 0}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-rose-900/30 to-rose-800/10 rounded-lg p-6 border border-rose-500/20">
              <p className="text-rose-300 text-sm mb-2">Symptom Logs (30d)</p>
              <p className={`text-4xl font-bold ${(symptomAnalytics?.entries || 0) > 100 ? 'text-red-300' : 'text-green-400'}`}>
                {symptomAnalytics?.entries || 0}
              </p>
              <p className="text-xs text-gray-400 mt-2">Users reporting: {symptomAnalytics?.users_reporting || 0}</p>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Symptom Hotspots (30d)</h2>
            {symptomAnalytics?.top_zones?.length ? (
              <div className="space-y-3">
                {symptomAnalytics.top_zones.slice(0, 6).map((zone) => (
                  <div key={zone.zone}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 capitalize">{zone.zone}</span>
                      <span className="text-cyan-300">{zone.score.toFixed(1)}</span>
                    </div>
                    <div className="h-2 rounded bg-gray-700/50 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${Math.max(5, zone.normalized_score * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No symptom data available yet for the selected window.</p>
            )}
          </motion.div>
          </>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Management
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-300">
                <thead className="text-xs font-semibold text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4">User ID</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Subscription</th>
                    <th className="text-left py-3 px-4">Tests</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-700/50 hover:bg-gray-700/20">
                    <td className="py-3 px-4"><code className="text-xs bg-gray-900/50 p-1 rounded">user_id_123</code></td>
                    <td className="py-3 px-4">user@example.com</td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle className="w-4 h-4" /> Active
                      </span>
                    </td>
                    <td className="py-3 px-4"><span className="bg-green-500/20 text-green-300 px-2 py-1 rounded text-xs">Premium</span></td>
                    <td className="py-3 px-4">5</td>
                    <td className="py-3 px-4"><button className="text-blue-400 hover:text-blue-300 text-xs font-semibold">View</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Knowledge Base Tab */}
        {activeTab === 'knowledge' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Biomarker Knowledge Base
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-700/50">
                  <h3 className="font-semibold text-white mb-2">Body Zone Mappings</h3>
                  <p className="text-sm text-gray-400 mb-4">Define which biomarkers relate to body zones</p>
                  <button className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded text-xs font-semibold transition">Edit</button>
                </div>
                <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-700/50">
                  <h3 className="font-semibold text-white mb-2">Supplement Recommendations</h3>
                  <p className="text-sm text-gray-400 mb-4">Manage supplement protocols and dosages</p>
                  <button className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded text-xs font-semibold transition">Edit</button>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-4">Affiliate Content</h2>
              <p className="text-sm text-gray-400 mb-4">Review and manage affiliate links for supplements</p>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-gray-900/30 rounded p-3 border border-gray-700/50 flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium text-sm">Supplement #{i}</p>
                      <p className="text-xs text-gray-400">Amazon Affiliate Link</p>
                    </div>
                    <button className="text-yellow-400 hover:text-yellow-300 text-xs font-semibold">Edit</button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* System Monitoring Tab */}
        {activeTab === 'monitoring' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  API Health
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Claude API</span>
                    <span className="flex items-center gap-1 text-green-400 text-sm"><CheckCircle className="w-4 h-4" /> Operational</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Stripe Webhooks</span>
                    <span className="flex items-center gap-1 text-green-400 text-sm"><CheckCircle className="w-4 h-4" /> Operational</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Supabase</span>
                    <span className="flex items-center gap-1 text-green-400 text-sm"><CheckCircle className="w-4 h-4" /> Operational</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Recent Errors
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-300">
                    502 Bad Gateway: Claude API - 2 min ago
                  </div>
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-300">
                    High latency detected - 15 min ago
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white mb-4">Revenue Dashboard</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gray-900/30 p-4 rounded border border-gray-700/50">
                  <p className="text-gray-400 text-sm mb-1">Monthly Recurring</p>
                  <p className="text-2xl font-bold text-green-400">$4,250</p>
                </div>
                <div className="bg-gray-900/30 p-4 rounded border border-gray-700/50">
                  <p className="text-gray-400 text-sm mb-1">Active Subscriptions</p>
                  <p className="text-2xl font-bold text-blue-400">28</p>
                </div>
                <div className="bg-gray-900/30 p-4 rounded border border-gray-700/50">
                  <p className="text-gray-400 text-sm mb-1">Churn Rate</p>
                  <p className="text-2xl font-bold text-yellow-400">3.2%</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white mb-4">Top Reported Symptoms</h3>
              {symptomAnalytics?.top_symptoms?.length ? (
                <div className="space-y-2">
                  {symptomAnalytics.top_symptoms.slice(0, 5).map((item) => (
                    <div key={item.tag} className="bg-gray-900/30 p-3 rounded border border-gray-700/50 flex justify-between items-center">
                      <span className="text-gray-200 text-sm">{item.label}</span>
                      <span className="text-blue-300 text-sm font-semibold">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No symptom logs yet.</p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
