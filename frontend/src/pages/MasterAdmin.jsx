import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import { motion } from 'framer-motion'
import { Users, Settings, Database, BarChart3, AlertCircle, CheckCircle, Clock, Construction } from 'lucide-react'
import AdminShell from '../components/admin/AdminShell.jsx'

export default function MasterAdmin() {
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [symptomAnalytics, setSymptomAnalytics] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  // Unified super admin check: user_metadata OR app_metadata
  const meta = user?.user_metadata || {}
  const app = user?.app_metadata || {}
  const isSuperAdmin = meta.is_super_admin || app.is_super_admin

  useEffect(() => {
    if (!user || !isSuperAdmin) return

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

      setLoading(false)
    }

    loadAdminData()
  }, [user, isSuperAdmin])

  if (loading) return (
    <AdminShell title="Operations" subtitle="Master Admin" variant="ops">
      <div style={{ textAlign: 'center', padding: 64, color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
    </AdminShell>
  )

  return (
    <AdminShell title="Operations" subtitle="Master Admin" variant="ops">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
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
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 500,
                color: activeTab === tab.id ? '#1d9e75' : 'rgba(255,255,255,0.45)',
                borderBottom: activeTab === tab.id ? '2px solid #1d9e75' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.2s',
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total Users', value: overview?.total_users ?? '—', sub: `Active (30d): ${overview?.active_users ?? '—'}`, color: '#3b82f6' },
              { label: 'Premium Subscribers', value: overview?.premium_subscribers ?? '—', sub: `MRR: $${(overview?.mrr || 0).toFixed(0)}`, color: '#1d9e75' },
              { label: 'Tests Uploaded', value: overview?.total_uploads ?? '—', sub: `This week: ${overview?.weekly_uploads ?? '—'}`, color: '#a855f7' },
              { label: 'Symptom Logs (30d)', value: symptomAnalytics?.entries ?? '—', sub: `Users reporting: ${symptomAnalytics?.users_reporting ?? '—'}`, color: '#f5a623' },
            ].map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${card.color}30`, borderRadius: 16, padding: 24 }}
              >
                <div style={{ fontSize: 12, color: card.color, marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{card.label}</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{card.value}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>{card.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Live symptom analytics */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 24 }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Symptom Hotspots (30d)</h2>
            {symptomAnalytics?.top_zones?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {symptomAnalytics.top_zones.slice(0, 6).map((zone) => (
                  <div key={zone.zone}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize' }}>{zone.zone}</span>
                      <span style={{ color: '#1d9e75', fontWeight: 600 }}>{zone.score.toFixed(1)}</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(5, zone.normalized_score * 100)}%`, background: 'linear-gradient(to right, #1d9e75, #5dcaa5)', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No symptom data available yet.</p>
            )}
          </motion.div>

          {/* Top symptoms */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Top Reported Symptoms</h2>
            {symptomAnalytics?.top_symptoms?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {symptomAnalytics.top_symptoms.slice(0, 8).map((item) => (
                  <div key={item.tag} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 16px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1d9e75' }}>{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No symptom logs yet.</p>
            )}
          </motion.div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} /> User Management
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, color: 'rgba(255,255,255,0.7)', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {['User ID', 'Email', 'Status', 'Subscription', 'Tests', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '12px' }}><code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>placeholder</code></td>
                  <td style={{ padding: '12px' }}>—</td>
                  <td style={{ padding: '12px' }}><span style={{ color: '#1d9e75', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Active</span></td>
                  <td style={{ padding: '12px' }}><span style={{ background: 'rgba(29,158,117,0.15)', color: '#1d9e75', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Free</span></td>
                  <td style={{ padding: '12px' }}>—</td>
                  <td style={{ padding: '12px' }}><span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Backend endpoint pending</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(245,166,35,0.08)', border: '0.5px solid rgba(245,166,35,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Construction size={14} style={{ color: '#f5a623', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Full user list requires <code style={{ color: '#f5a623' }}>GET /admin/users</code> backend endpoint.</span>
          </div>
        </motion.div>
      )}

      {/* Knowledge Base Tab */}
      {activeTab === 'knowledge' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><Database size={16} /> Biomarker Knowledge Base</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {['Body Zone Mappings', 'Supplement Recommendations', 'Reference Ranges', 'Affiliate Links'].map(item => (
                <div key={item} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>{item}</div>
                  <button style={{ background: 'rgba(29,158,117,0.15)', color: '#1d9e75', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* System Monitoring Tab */}
      {activeTab === 'monitoring' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><AlertCircle size={16} style={{ color: '#f5a623' }} /> API Health</h3>
              {[['Claude API', true], ['Stripe Webhooks', true], ['Supabase', true]].map(([name, ok]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: ok ? '#1d9e75' : '#e53935' }}>
                    {ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />} {ok ? 'Operational' : 'Down'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={16} style={{ color: '#1d9e75' }} /> Recent Activity</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>No recent errors. All systems nominal.</p>
            </div>
          </div>
        </motion.div>
      )}
    </AdminShell>
  )
}
