import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Activity, Clock, RefreshCw, Sparkles, TrendingUp, TriangleAlert, Lightbulb, AlertCircle, BarChart3 } from 'lucide-react'
import api from '../lib/api.js'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import toast from 'react-hot-toast'
import BiomarkerAlertsDisplay from '../components/BiomarkerAlertsDisplay.jsx'
import HealthTipsDisplay from '../components/HealthTipsDisplay.jsx'
import TrendAnalyticsDashboard from '../components/TrendAnalyticsDashboard.jsx'
import { useTimeline, useInsights, useHealthScore, useProgress } from '../hooks/useQueries.js'

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

function pickLatestBiomarkers(progressRows = []) {
  if (!Array.isArray(progressRows) || progressRows.length === 0) return []

  const withDate = progressRows
    .filter((row) => Array.isArray(row?.biomarkers) && row.biomarkers.length > 0)
    .sort((a, b) => {
      const aTime = new Date(a?.created_at || a?.test_date || 0).getTime()
      const bTime = new Date(b?.created_at || b?.test_date || 0).getTime()
      return bTime - aTime
    })

  return withDate[0]?.biomarkers || []
}

export default function Insights() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('insights')
  const [loadingInsights, setLoadingInsights] = useState(false)

  const { data: timeline = [], isError: timelineError } = useTimeline()
  const { data: insights = [] } = useInsights()
  const { data: healthScore = null } = useHealthScore()
  const { data: progressRows = [] } = useProgress()

  const biomarkers = pickLatestBiomarkers(progressRows)

  async function generateInsights() {
    setLoadingInsights(true)
    try {
      const { data } = await api.post('/insights/generate')
      // Optimistic update: prepend new insights to cache
      queryClient.setQueryData(['insights'], (old = []) => [...(data || []), ...old])
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
        helper="Upload a lab result and complete a weekly check-in to unlock personalized AI insights and trend analysis."
        action={(
          <button onClick={generateInsights} disabled={loadingInsights} className="vtl-button-primary inline-flex items-center gap-2 px-4 text-sm disabled:opacity-60">
            <RefreshCw className="h-4 w-4" style={{ animation: loadingInsights ? 'spin 1s linear infinite' : 'none' }} />
            {loadingInsights ? 'Generating...' : 'Refresh insights'}
          </button>
        )}
      />

      {timelineError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load timeline — Please refresh or try again later.
        </div>
      )}

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
              ].map((item) => {
                const safeValue = Number.isFinite(Number(item.value))
                  ? Math.max(0, Math.min(100, Number(item.value)))
                  : 0

                return (
                  <div key={item.label}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/60">
                      <div className="h-full rounded-full" style={{ width: `${safeValue}%`, background: scoreColor }} />
                    </div>
                    <div className="mt-2 text-sm font-semibold" style={{ color: scoreColor }}>{safeValue}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'insights', label: 'Insights', icon: Sparkles },
          { id: 'alerts', label: 'Alerts', icon: AlertCircle },
          { id: 'tips', label: 'Health Tips', icon: Lightbulb },
          { id: 'trends', label: 'Trends', icon: BarChart3 },
          { id: 'timeline', label: 'Timeline', icon: Clock },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition whitespace-nowrap ${tab === id ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div>
          {tab === 'insights' && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="vtl-light-card rounded-3xl p-6"
            >
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
            </motion.section>
          )}

          {tab === 'alerts' && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="vtl-light-card rounded-3xl p-6"
            >
              <div className="mb-5 text-lg font-semibold text-slate-900">Biomarker Alerts</div>

              {biomarkers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  No biomarker data yet. Upload your lab results to see alerts and recommendations.
                </div>
              ) : (
                <BiomarkerAlertsDisplay
                  biomarkers={biomarkers}
                  previousBiomarkers={[]}
                  userPreferences={{}}
                />
              )}
            </motion.section>
          )}

          {tab === 'tips' && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="vtl-light-card rounded-3xl p-6"
            >
              <div className="mb-5 text-lg font-semibold text-slate-900">Personalized Health Tips</div>

              {biomarkers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  No biomarker data yet. Upload your lab results to unlock AI-powered health recommendations.
                </div>
              ) : (
                <HealthTipsDisplay
                  biomarkers={biomarkers}
                  userContext={{
                    age: 30,
                    lifestyle: 'active',
                    goals: ['improve energy', 'optimize recovery'],
                    protocol_adherence: 'high'
                  }}
                />
              )}
            </motion.section>
          )}

          {tab === 'trends' && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="vtl-light-card rounded-3xl p-6"
            >
              <div className="mb-5 text-lg font-semibold text-slate-900">Trend Analysis</div>

              {biomarkers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  No biomarker data yet. Upload multiple lab results to see trend analysis and predictions.
                </div>
              ) : (
                <TrendAnalyticsDashboard
                  biomarkerHistory={biomarkers.map(b => ({
                    id: b.id,
                    name: b.name,
                    values: [b.value],
                    dates: [new Date().toISOString()],
                    ref_low: b.ref_low,
                    ref_high: b.ref_high,
                  }))}
                />
              )}
            </motion.section>
          )}

          {tab === 'timeline' && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="vtl-light-card rounded-3xl p-6"
            >
              <div className="mb-5 text-lg font-semibold text-slate-900">Activity timeline</div>

              {timeline.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  No activity yet. Your timeline will fill in automatically as you upload labs, complete check-ins, and generate insights.
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
            </motion.section>
          )}
        </div>

        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="vtl-light-card rounded-3xl p-6 xl:sticky xl:top-24 xl:h-fit"
        >
          <div className="mb-4 text-lg font-semibold text-slate-900">How insights work</div>
          <div className="space-y-3 text-sm text-slate-500">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">AI analyzes your uploaded biomarkers and symptoms to identify trends — not just flag out-of-range values.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Insights update automatically after each new upload or weekly check-in, or you can refresh them manually.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Each insight ends with a concrete next step: upload, recheck, adjust your protocol, or consult a practitioner.</div>
          </div>
        </motion.aside>
      </div>
    </div>
  )
}
