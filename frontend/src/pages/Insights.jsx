import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Clock, RefreshCw, Sparkles, TrendingUp, TriangleAlert } from 'lucide-react'
import api from '../lib/api.js'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import toast from 'react-hot-toast'

const EVENT_LABELS = {
  lab_uploaded: 'Upload',
  biomarkers_extracted: 'Biomarkers',
  protocol_generated: 'Protocol',
  symptoms_logged: 'Symptoms',
  weekly_checkin_submitted: 'Check-in',
  complaint_added: 'Complaint',
  insight_created: 'Insight',
  red_flag_triggered: 'Alert',
  notification_sent: 'Notification',
  profile_updated: 'Profile',
  onboarding_completed: 'Onboarding',
  adherence_updated: 'Adherence',
  integration_synced: 'Sync',
}

const INSIGHT_COLORS = {
  symptom_trend: '#f472b6',
  biomarker_trend: '#818cf8',
  adherence: '#f59e0b',
  retest_suggestion: '#1d9e75',
  general: '#cbd5e1',
}

function formatDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
}

export default function Insights() {
  const [timeline, setTimeline] = useState([])
  const [insights, setInsights] = useState([])
  const [healthScore, setHealthScore] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [tab, setTab] = useState('insights')

  useEffect(() => {
    Promise.allSettled([
      api.get('/timeline'),
      api.get('/insights'),
      api.get('/insights/health-score'),
    ]).then(([timelineResult, insightsResult, healthResult]) => {
      if (timelineResult.status === 'fulfilled') setTimeline(timelineResult.value.data || [])
      if (insightsResult.status === 'fulfilled') setInsights(insightsResult.value.data || [])
      if (healthResult.status === 'fulfilled') setHealthScore(healthResult.value.data || null)
    })
  }, [])

  async function generateInsights() {
    setLoadingInsights(true)
    try {
      const { data } = await api.post('/insights/generate')
      setInsights((prev) => [...(data || []), ...prev])
      toast.success(`${data?.length || 0} new insight(s) generated`)
    } catch {
      toast.error('Failed to generate insights')
    } finally {
      setLoadingInsights(false)
    }
  }

  const scoreColor = healthScore ? (healthScore.score >= 70 ? '#1d9e75' : healthScore.score >= 50 ? '#f59e0b' : '#ef4444') : '#64748b'

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <CabinetPageHeader
        title="Insights"
        subtitle="Interpretation layer for uploads, adherence, timeline, and follow-up signals."
        helper="If live insights are not available yet, this page should still preview what the user will unlock next."
        action={(
          <button onClick={generateInsights} disabled={loadingInsights} className="vtl-button-primary inline-flex items-center gap-2 px-4 text-sm disabled:opacity-60">
            <RefreshCw className="h-4 w-4" style={{ animation: loadingInsights ? 'spin 1s linear infinite' : 'none' }} />
            {loadingInsights ? 'Generating...' : 'Refresh insights'}
          </button>
        )}
      />

      {healthScore && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl px-6 py-5"
          style={{ background: `${scoreColor}12`, border: `1px solid ${scoreColor}30` }}
        >
          <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Health score</div>
              <div className="mt-2 text-5xl font-bold" style={{ color: scoreColor }}>{healthScore.score}</div>
              <div className="mt-1 text-xs text-slate-500">out of 100</div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: 'Symptom', value: healthScore.symptom_component },
                { label: 'Biomarker', value: healthScore.biomarker_component },
                { label: 'Adherence', value: healthScore.adherence_component },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/60">
                    <div className="h-full rounded-full" style={{ width: `${item.value}%`, background: scoreColor }} />
                  </div>
                  <div className="mt-2 text-sm font-semibold" style={{ color: scoreColor }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'insights', label: 'Insights', icon: Sparkles },
          { id: 'timeline', label: 'Timeline', icon: Clock },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${tab === id ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div>
          {tab === 'insights' && (
            <section className="vtl-light-card rounded-3xl p-6">
              <div className="mb-5 text-lg font-semibold text-slate-900">Current insights</div>

              {insights.length === 0 && (
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    {
                      title: 'Trend interpretation',
                      body: 'You will see which biomarkers are stabilizing, worsening, or worth retesting next.',
                      icon: TrendingUp,
                    },
                    {
                      title: 'Risk context',
                      body: 'The system will highlight critical markers, adherence gaps, and symptoms that deserve attention.',
                      icon: TriangleAlert,
                    },
                    {
                      title: 'Concrete next step',
                      body: 'Each insight should end with what to do next: upload, recheck, protocol, or practitioner discussion.',
                      icon: Activity,
                    },
                  ].map((card) => {
                    const Icon = card.icon
                    return (
                      <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-emerald-600 shadow-sm"><Icon className="h-4 w-4" /></div>
                        <div className="text-sm font-semibold text-slate-900">{card.title}</div>
                        <p className="mt-2 text-sm text-slate-500">{card.body}</p>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="space-y-3">
                {insights.map((insight, index) => {
                  const color = INSIGHT_COLORS[insight.insight_type] || INSIGHT_COLORS.general
                  return (
                    <motion.div
                      key={insight.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-2xl border p-4"
                      style={{ background: `${color}10`, borderColor: `${color}30` }}
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color }}>{String(insight.insight_type || 'general').replaceAll('_', ' ')}</div>
                      <div className="mt-2 text-base font-semibold text-slate-900">{insight.title}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{insight.body}</p>
                    </motion.div>
                  )
                })}
              </div>
            </section>
          )}

          {tab === 'timeline' && (
            <section className="vtl-light-card rounded-3xl p-6">
              <div className="mb-5 text-lg font-semibold text-slate-900">Activity timeline</div>

              {timeline.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  No activity yet. After uploads, questionnaire completion, insights, and check-ins, this area becomes a chronological product memory instead of an empty feed.
                </div>
              )}

              <div className="space-y-4">
                {timeline.map((event, index) => (
                  <motion.div
                    key={event.id || index}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex h-10 min-w-10 items-center justify-center rounded-2xl bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">{EVENT_LABELS[event.event_type] || 'Event'}</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{event.summary}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDate(event.occurred_at)}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="vtl-light-card rounded-3xl p-6 xl:sticky xl:top-24 xl:h-fit">
          <div className="mb-4 text-lg font-semibold text-slate-900">Why this page matters</div>
          <div className="space-y-3 text-sm text-slate-500">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">This page should explain the meaning of the data, not just repeat numbers from results.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">If there is no data yet, the product must still preview the value the user will see later.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Timeline and insights together turn the cabinet into a coherent premium product surface.</div>
          </div>
        </aside>
      </div>
    </div>
  )
}
