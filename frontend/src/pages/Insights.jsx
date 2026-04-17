import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Clock, BarChart2, Activity, X, RefreshCw } from 'lucide-react'
import api from '../lib/api.js'
import toast from 'react-hot-toast'

const EVENT_ICONS = {
  lab_uploaded: '🧪',
  biomarkers_extracted: '📊',
  protocol_generated: '📋',
  symptoms_logged: '💊',
  weekly_checkin_submitted: '✅',
  complaint_added: '⚠️',
  insight_created: '✨',
  red_flag_triggered: '🚨',
  notification_sent: '📬',
  profile_updated: '👤',
  onboarding_completed: '🎉',
  adherence_updated: '📌',
  integration_synced: '🔗',
}

const INSIGHT_COLORS = {
  symptom_trend: '#f472b6',
  biomarker_trend: '#818cf8',
  adherence: '#f59e0b',
  retest_suggestion: '#1d9e75',
  general: 'rgba(255,255,255,0.5)',
}

function fmt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const s = {
  page: { minHeight: '100vh', background: '#080808', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '0 16px 48px' },
  header: { maxWidth: 860, margin: '0 auto', padding: '32px 0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  back: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 },
  body: { maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' },
  card: { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24 },
  cardTitle: { fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 },
  insightCard: (color) => ({ background: `${color}10`, border: `0.5px solid ${color}30`, borderRadius: 14, padding: '16px 18px', marginBottom: 12, position: 'relative' }),
  dismissBtn: { position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer' },
  timelineItem: { display: 'flex', gap: 16, paddingBottom: 20, position: 'relative' },
  timelineDot: { width: 10, height: 10, borderRadius: '50%', background: '#1d9e75', flexShrink: 0, marginTop: 5 },
  timelineLine: { position: 'absolute', left: 4, top: 15, bottom: 0, width: '2px', background: 'rgba(255,255,255,0.06)' },
}

export default function Timeline() {
  const navigate = useNavigate()
  const [timeline, setTimeline] = useState([])
  const [insights, setInsights] = useState([])
  const [healthScore, setHealthScore] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [tab, setTab] = useState('timeline')

  useEffect(() => {
    Promise.allSettled([
      api.get('/timeline'),
      api.get('/insights'),
      api.get('/insights/health-score'),
    ]).then(([t, i, h]) => {
      if (t.status === 'fulfilled') setTimeline(t.value.data || [])
      if (i.status === 'fulfilled') setInsights(i.value.data || [])
      if (h.status === 'fulfilled') setHealthScore(h.value.data)
    })
  }, [])

  const generateInsights = async () => {
    setLoadingInsights(true)
    try {
      const { data } = await api.post('/insights/generate')
      setInsights(prev => [...(data || []).map(i => ({ ...i, _new: true })), ...prev])
      toast.success(`${data?.length || 0} new insight(s) generated`)
    } catch {
      toast.error('Failed to generate insights')
    } finally {
      setLoadingInsights(false)
    }
  }

  const dismissInsight = async (id) => {
    setInsights(prev => prev.filter(i => i.id !== id))
    await api.post(`/insights/${id}/dismiss`).catch(() => {})
  }

  const scoreColor = healthScore ? (healthScore.score >= 70 ? '#1d9e75' : healthScore.score >= 50 ? '#f59e0b' : '#ef4444') : '#555'

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Health Timeline</div>
        <div style={{ width: 100 }} />
      </div>

      {/* Health Score summary bar */}
      {healthScore && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ maxWidth: 860, margin: '0 auto 24px', background: `${scoreColor}15`, border: `0.5px solid ${scoreColor}40`, borderRadius: 16, padding: '16px 24px', display: 'flex', gap: 32, alignItems: 'center' }}
        >
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Health Score</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{healthScore.score}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>/ 100</div>
          </div>
          {[
            { label: 'Symptom', val: healthScore.symptom_component },
            { label: 'Biomarker', val: healthScore.biomarker_component },
            { label: 'Adherence', val: healthScore.adherence_component },
          ].map(({ label, val }) => (
            <div key={label} style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{label}</div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${val}%`, background: scoreColor, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 12, color: scoreColor, marginTop: 4 }}>{val}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Tabs */}
      <div style={{ maxWidth: 860, margin: '0 auto 24px', display: 'flex', gap: 4, borderBottom: '0.5px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
        {[{ id: 'timeline', label: 'Timeline', icon: Clock }, { id: 'insights', label: 'Insights', icon: Sparkles }].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '12px 20px', background: 'none', border: 'none', color: tab === id ? '#1d9e75' : 'rgba(255,255,255,0.4)', fontWeight: tab === id ? 700 : 400, borderBottom: `2px solid ${tab === id ? '#1d9e75' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 14 }}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      <div style={s.body}>
        {/* Main content */}
        <div>
          {tab === 'timeline' && (
            <div style={s.card}>
              <div style={s.cardTitle}><Clock size={18} style={{ color: '#1d9e75' }} /> Activity Timeline</div>
              {timeline.length === 0 && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>No activity yet. Upload labs or log symptoms to see your timeline.</p>}
              <div style={{ position: 'relative' }}>
                {timeline.map((ev, i) => (
                  <motion.div key={ev.id || i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} style={s.timelineItem}>
                    {i < timeline.length - 1 && <div style={s.timelineLine} />}
                    <div style={s.timelineDot} />
                    <div>
                      <div style={{ fontSize: 14, color: '#fff', fontWeight: 500, marginBottom: 3 }}>
                        {EVENT_ICONS[ev.event_type] || '•'} {ev.summary}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{fmt(ev.occurred_at)}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {tab === 'insights' && (
            <div style={s.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={s.cardTitle}><Sparkles size={18} style={{ color: '#f472b6' }} /> Your Insights</div>
                <button onClick={generateInsights} disabled={loadingInsights}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={13} style={{ animation: loadingInsights ? 'spin 1s linear infinite' : 'none' }} />
                  {loadingInsights ? 'Generating…' : 'Refresh'}
                </button>
              </div>
              {insights.length === 0 && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>No insights yet. Click Refresh to generate your first personalised insights.</p>}
              {insights.map((ins, i) => {
                const color = INSIGHT_COLORS[ins.insight_type] || INSIGHT_COLORS.general
                return (
                  <motion.div key={ins.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} style={s.insightCard(color)}>
                    <button style={s.dismissBtn} onClick={() => dismissInsight(ins.id)}><X size={14} /></button>
                    <div style={{ fontSize: 13, color, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ins.insight_type?.replace('_', ' ')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{ins.title}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{ins.body}</div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar: quick stats */}
        <div>
          <div style={{ ...s.card, marginBottom: 16 }}>
            <div style={s.cardTitle}><Activity size={16} style={{ color: '#818cf8' }} /> Quick Actions</div>
            {[
              { label: '📋 Weekly Check-In', path: '/check-ins' },
              { label: '🧪 Upload Labs', path: '/upload' },
              { label: '💊 Log Symptoms', path: '/admin' },
              { label: '👤 Update Profile', path: '/onboarding' },
            ].map(({ label, path }) => (
              <button key={path} onClick={() => navigate(path)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '11px 14px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14, marginBottom: 8 }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
